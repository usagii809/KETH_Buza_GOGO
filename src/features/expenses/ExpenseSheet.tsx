import { useMemo, useState } from "react";
import { addExpense, deleteExpense, deleteExpenses, localFirst, restoreExpenses, updateExpense } from "../../data/db";
import { CATEGORY_MAP, GROUPS, SPENDERS, normalizeCategory, normalizeSpender, visibleCategories, type CategoryKey } from "../../lib/categories";
import { defaultDateForMonth, todayStr } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import { store } from "../../lib/storage";
import { isRefund, type Spender, type Transaction } from "../../lib/types";
import { CalcMoneyInput, QuickAddChips, inputClass, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { confetti } from "../fun/confetti";
import { expenseEgg } from "../fun/eggs";
import { buildMemoIndex, findDuplicate, frequentExpenses, suggestItems, suggestMemos } from "./memo";
import { timeAgo } from "../feed/calc";
import type { DiningBan } from "../lottery/ticket";
import { refundCandidates, refundableOf, type RefundIndex } from "./refunds";
import { notify } from "../feed/notify";

interface Props {
  /** 있으면 수정, 없으면 새 기록 */
  tx?: Transaction;
  /** 이 결제의 환불·부분취소를 새로 기록 (원래 기록) */
  refundFor?: Transaction;
  /** 수정 화면에서 '환불·부분취소 기록'을 눌렀을 때 */
  onRefund?: (tx: Transaction) => void;
  viewedYm: string;
  uid: string;
  /** 자동완성용 최근 기록 */
  history: Transaction[];
  /** 저장 직전에 호출 (첫 지출이면 그 달 예산 고정) */
  beforeAdd: (ym: string) => Promise<void>;
  /** 내 이름 (프로필) — 처음 기록할 때 기본 '누가' */
  myName?: string;
  /** 💣 외식 금지 (날짜 → 금지 기간) */
  bans?: Record<string, DiningBan>;
  /** ↩️ 결제 ↔ 환불 연결 (두 번 빠지는 걸 막으려고) */
  refundIndex?: RefundIndex;
  /** 원래 결제를 고치러 가기 */
  onEditOriginal?: (tx: Transaction) => void;
  /** 이 기록 내용으로 새로 적기 (오늘 날짜) */
  copyFrom?: Transaction;
  /** 수정 화면의 '오늘 날짜로 한 번 더' */
  onDuplicate?: (tx: Transaction) => void;
  /** uid → 이름 (같은 지출 경고에 누가 적었는지) */
  nameOf?: (uid?: string) => string | undefined;
  /** 저장 직후 예산 알림 문구 (없으면 null) */
  budgetAlertFor?: (category: CategoryKey, date: string, added: number) => string | null;
  /** 다른 달 날짜로 저장했을 때 그 달로 이동 */
  onMovedMonth: (ym: string) => void;
  onClose: () => void;
}

export function ExpenseSheet({ tx, refundFor, onRefund, viewedYm, uid, history, beforeAdd, myName, bans = {}, refundIndex, onEditOriginal, copyFrom, onDuplicate, nameOf, budgetAlertFor, onMovedMonth, onClose }: Props) {
  const { toast, confirm, choose } = useFeedback();
  // 환불을 새로 적을 때는 원래 결제 내용을 그대로 가져와요
  const base = tx || refundFor || copyFrom;
  const [amount, setAmount] = useState(tx ? Math.abs(Number(tx.amount) || 0) : copyFrom ? Math.abs(Number(copyFrom.amount) || 0) : 0);
  const [refund, setRefund] = useState(tx ? isRefund(tx) : !!refundFor);
  const [memo, setMemo] = useState(base?.memo || "");
  const [items, setItems] = useState(base?.items || "");
  const [category, setCategory] = useState<CategoryKey>(normalizeCategory(base ? base.category : store.get("lastCategory", "foodIngredients")));
  const [spender, setSpender] = useState<Spender>(normalizeSpender(base ? base.spender : store.get("lastSpender", myName || "공동")));
  const [date, setDate] = useState(tx?.date || (refundFor || copyFrom ? todayStr() : defaultDateForMonth(viewedYm)));
  const [company, setCompany] = useState(!!base?.company);
  // ↩️ 이 환불이 연결된 원래 결제 (환불 · 부분취소 버튼으로 왔으면 고정, 아니면 아래 목록에서 골라요)
  const [link, setLink] = useState<string | null>(tx?.refundOf || refundFor?.id || null);
  const original = refundFor || (link ? refundIndex?.byId.get(link) ?? null : null);
  const refundOf = refund ? link : null;
  // 이 결제에 더 환불할 수 있는 금액 (이미 연결된 다른 환불은 빼요)
  const refundable = original ? refundableOf(original, refundIndex, tx?.id) : 0;
  const candidates = useMemo(
    () => (refund && !refundFor && refundIndex ? refundCandidates(memo, refundIndex.byId.values(), refundIndex, 5, tx?.id).filter((c) => c.tx.id !== tx?.id) : []),
    [refund, refundFor, refundIndex, memo, tx?.id]
  );
  // 이 결제에 연결된 환불들 (결제를 지우거나 금액을 줄일 때 경고)
  const linkedRefunds = tx && !isRefund(tx) ? refundIndex?.refunds.get(tx.id) || [] : [];
  const linkedTotal = linkedRefunds.reduce((s, r) => s - (Number(r.amount) || 0), 0);
  // 입력 화면 항목: 숨긴 항목은 빼되, 지금 고르고 있는 항목은 보여요
  const cats = visibleCategories();
  if (!cats.some((c) => c.key === category) && CATEGORY_MAP[category]) cats.push(CATEGORY_MAP[category]);
  const [busy, setBusy] = useState(false);

  const memoIndex = useMemo(() => buildMemoIndex(history), [history]);
  // ⭐ 자주 쓰는 지출 (새 기록일 때만)
  const frequent = useMemo(() => (!tx && !refundFor && !copyFrom ? frequentExpenses(history) : []), [tx, refundFor, copyFrom, history]);
  const fillFrequent = (f: { memo: string; amount: number; category: CategoryKey; spender: string }) => {
    setMemo(f.memo); setAmount(f.amount); setCategory(f.category); setSpender(normalizeSpender(f.spender));
  };
  const suggestions = useMemo(() => suggestMemos(memoIndex, memo), [memoIndex, memo]);
  const itemSuggestions = useMemo(() => suggestItems(history, memo, items), [history, memo, items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { toast("금액을 입력해 주세요"); return; }
    // 회사 돈은 태형이만 (다른 사람으로 바꾸면 자동으로 꺼져요)
    const isCompany = spender === "태형" && company;
    const signed = refund ? -amount : amount;
    let linkTo = refundOf;
    // ↩️ 남은 금액보다 많이 환불하면 거의 실수예요 (같은 환불을 두 번 적었거나 다른 결제에 연결)
    if (refund && original && amount > refundable) {
      const already = (Number(original.amount) || 0) - refundable;
      const pick = await choose({
        title: "남은 금액보다 많아요",
        message: `${original.date.slice(5).replace("-", "/")} ${original.memo || "결제"}는 ${formatKRW(Math.max(0, refundable))}만 남았어요.` +
          (already > 0 ? `\n(${formatKRW(original.amount)} 중 ${formatKRW(already)}은 이미 환불됐어요)` : ""),
        choices: [
          ...(onEditOriginal ? [{ key: "fix", label: "원래 결제 금액 고치기" }] : []),
          { key: "unlink", label: "연결 안 하고 기록" }
        ]
      });
      if (pick === "fix") { onClose(); onEditOriginal?.(original); return; }
      if (pick !== "unlink") return;
      linkTo = null;
    }
    // 환불이 연결된 결제의 금액을 줄이면 → 환불과 함께 두 번 빠질 수 있어요
    if (tx && !refund && linkedTotal > 0 && amount < Math.abs(Number(tx.amount) || 0)) {
      const ok = await confirm({
        title: "환불이 연결된 결제예요",
        message: `이 결제엔 환불 ${formatKRW(linkedTotal)}이 따로 기록돼 있어요.\n금액까지 줄이면 두 번 빠질 수 있어요. 그래도 저장할까요?`,
        okText: "그래도 저장",
        danger: false
      });
      if (!ok) return;
    }
    const input = {
      date, category, spender, amount: signed, memo: memo.trim(), items: items.trim(), company: isCompany,
      // 연결을 끊으면 "" (고칠 때 원래 연결을 지워요)
      ...(refund && linkTo ? { refundOf: linkTo } : tx?.refundOf ? { refundOf: "" } : {})
    };
    const ym = date.slice(0, 7);
    // 👯 같은 날 · 같은 금액 기록이 이미 있으면 (둘이 같은 지출을 두 번 적는 경우)
    if (!tx && !refund) {
      const dup = findDuplicate(history, date, amount);
      if (dup) {
        const who = nameOf?.(dup.createdBy) || dup.spender || "누군가";
        const when = dup.createdAt ? timeAgo(Number(dup.createdAt)) : "";
        const ok = await confirm({
          title: "같은 지출이 이미 있어요",
          message: `${who} 님이 ${when ? `${when} ` : ""}${dup.memo || CATEGORY_MAP[normalizeCategory(dup.category)].label} ${formatKRW(Number(dup.amount))}을 기록했어요.\n그래도 추가할까요?`,
          okText: "그래도 추가",
          danger: false
        });
        if (!ok) return;
      }
    }
    // 💣 외식 금지 주간에 외식·배달을 새로 적으려 하면 한 번 더 물어봐요 (회사 돈·환불은 괜찮아요)
    const ban = bans[date];
    if (!tx && !isCompany && !refund && ban && category === "foodDining") {
      const ok = await confirm({
        title: "💣 이번 주는 외식 금지!",
        message: `${ban.by}의 폭탄 때문에 ${Number(ban.to.slice(5, 7))}월 ${Number(ban.to.slice(8))}일(일)까지 외식·배달은 봉인이에요.\n그래도 기록할까요?`,
        okText: "그래도 기록"
      });
      if (!ok) return;
    }
    // ⚠️ 저장하면 항목 예산 80% · 100%를 넘는지 (저장 전 숫자로 계산해 둬요)
    const alert = !refund && !isCompany && budgetAlertFor
      ? budgetAlertFor(category, date, amount - (tx && !isRefund(tx) && normalizeCategory(tx.category) === category && !tx.company ? Math.abs(Number(tx.amount) || 0) : 0))
      : null;
    setBusy(true);
    try {
      let saved: "synced" | "queued";
      if (tx) {
        saved = await localFirst(updateExpense(tx.id, input));
      } else {
        await localFirst(beforeAdd(ym), 1500).catch((err) => console.warn("월 예산 고정 참고:", err));
        saved = await localFirst(addExpense(input, uid));
        notify.record(input); // 🔔 상대 폰에 알림
        if (!refund) {
          store.set("lastCategory", category);
          store.set("lastSpender", spender);
        }
      }
      onClose();
      if (ym !== viewedYm) {
        onMovedMonth(ym);
        toast(`${Number(ym.slice(5))}월에 기록하고 그 달로 이동했어요`);
      } else if (saved === "queued") {
        toast("📴 인터넷이 약해서 폰에 먼저 저장했어요. 연결되면 알아서 올라가요");
      } else {
        toast(tx ? "수정했어요" : refund ? `↩️ ${formatShort(amount)} 환불을 기록했어요` : isCompany ? `🏢 회사 돈 ${formatShort(amount)} 기록했어요 (가계부엔 안 들어가요)` : `${formatShort(amount)} 기록했어요`);
      }
      if (alert) setTimeout(() => toast(alert), 1600);
      // 🤫 새 기록에 숨은 반응
      const egg = tx || refund ? null : expenseEgg(amount, input.memo, input.items);
      if (egg) setTimeout(() => { toast(egg.text); if (egg.confetti) confetti(); }, alert ? 4200 : 1500);
    } catch (err) {
      console.error("지출 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  /** 지운 뒤 알림의 '되돌리기': 같은 id · 같은 내용으로 다시 저장 */
  const undoAction = (removed: Transaction[]) => ({
    label: "되돌리기",
    onClick: () => {
      localFirst(restoreExpenses(removed))
        .then(() => toast(removed.length > 1 ? `${removed.length}건을 되살렸어요` : "되살렸어요"))
        .catch(() => toast("되살리지 못했어요. 다시 시도해 주세요"));
    }
  });

  const remove = async () => {
    if (!tx) return;
    // 환불이 연결된 결제: 결제만 지우면 환불과 함께 두 번 빠져요 → 같이 지워요
    if (linkedRefunds.length) {
      const list = linkedRefunds.map((r) => `${r.date.slice(5).replace("-", "/")} 환불 ${formatKRW(-(Number(r.amount) || 0))}`).join(", ");
      const pick = await choose({
        title: "환불 기록이 연결돼 있어요",
        message: `이 결제엔 ${list}이 연결돼 있어요.\n결제만 지우면 ${formatKRW(linkedTotal)}이 두 번 빠져요.`,
        choices: [{ key: "both", label: "환불도 같이 지우기", tone: "danger" }]
      });
      if (pick !== "both") return;
      try {
        const removed = [tx, ...linkedRefunds];
        const saved = await localFirst(deleteExpenses(removed.map((r) => r.id)));
        onClose();
        toast(saved === "queued" ? `환불 ${linkedRefunds.length}건과 같이 지웠어요 (연결되면 반영돼요)` : `환불 ${linkedRefunds.length}건과 같이 지웠어요`, undoAction(removed));
      } catch {
        toast("지우지 못했어요. 다시 시도해 주세요");
      }
      return;
    }
    if (!(await confirm({ title: "이 기록을 지울까요?", message: "지우면 둘 다 볼 수 없어요.", okText: "지우기" }))) return;
    try {
      const saved = await localFirst(deleteExpense(tx.id));
      onClose();
      toast(saved === "queued" ? "지웠어요 (연결되면 반영돼요)" : "지웠어요", undoAction([tx]));
    } catch {
      toast("지우지 못했어요. 다시 시도해 주세요");
    }
  };

  const chip = (on: boolean) => `py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${on ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub hover:bg-gray-200"}`;

  return (
    <Sheet title={refund ? (tx ? "환불 기록 수정" : "↩️ 환불 · 취소 기록") : tx ? "기록 수정" : "지출 기록"}
      subtitle={original ? `${original.date.slice(5).replace("-", "/")} ${original.memo || original.items || CATEGORY_MAP[normalizeCategory(original.category)].label} · ${formatKRW(Math.abs(Number(original.amount) || 0))} 결제`
        : copyFrom ? `${copyFrom.date.slice(5).replace("-", "/")} 기록을 그대로 가져왔어요 · 날짜만 확인하세요` : undefined}
      onClose={onClose}
      footer={<>
        {tx && <button type="button" onClick={remove} className="px-4 py-3.5 rounded-2xl bg-red-50 hover:bg-red-100 text-toss-red text-sm font-bold transition">지우기</button>}
        <button type="submit" form="expenseForm" disabled={busy} className={primaryButton}>{busy ? "저장하는 중..." : tx ? "수정하기" : refund ? "환불 기록하기" : "기록하기"}</button>
      </>}>
      <form id="expenseForm" onSubmit={submit} className="space-y-5">
        {frequent.length > 0 && amount === 0 && !memo && (
          <div>
            <span className="block text-sm font-medium text-toss-sub mb-1.5">⭐ 자주 쓰는 지출</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {frequent.map((f) => (
                <button key={`${f.memo}|${f.amount}|${f.category}|${f.spender}`} type="button" onClick={() => fillFrequent(f)}
                  className="frequent-chip shrink-0 px-3 py-2 rounded-2xl bg-amber-50 text-left active:scale-95 transition">
                  <span className="block text-sm font-bold text-toss-text whitespace-nowrap">{f.memo} <span className="num">{formatShort(f.amount)}</span></span>
                  <span className="block text-xs text-toss-sub whitespace-nowrap">{CATEGORY_MAP[f.category]?.short ?? ""} · {f.spender} · {f.count}번</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tx && !refund && onDuplicate && (
          <button type="button" onClick={() => onDuplicate(tx)}
            className="copy-btn w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-toss-blueLight text-left active:scale-[0.99] transition">
            <span>
              <span className="block text-sm font-bold text-toss-blue">🔁 오늘 날짜로 한 번 더 기록</span>
              <span className="block text-xs text-toss-sub mt-0.5">같은 사용처 · 금액 · 항목으로 새 기록을 만들어요</span>
            </span>
            <span className="text-sm font-bold text-toss-blue">→</span>
          </button>
        )}
        {tx && !refund && onRefund && (
          <button type="button" onClick={() => onRefund(tx)}
            className="refund-btn w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-green-50 text-left active:scale-[0.99] transition">
            <span>
              <span className="block text-sm font-bold text-toss-green">↩️ 환불 · 부분취소 기록하기</span>
              <span className="block text-xs text-toss-sub mt-0.5">반품·취소로 돌려받은 돈을 이 결제에 연결해서 남겨요</span>
            </span>
            <span className="text-sm font-bold text-toss-green">→</span>
          </button>
        )}
        <div>
          <label htmlFor="expenseDate" className="block text-sm font-medium text-toss-sub mb-1.5">{refund ? "언제 돌려받았나요?" : "언제 썼나요?"}</label>
          <input id="expenseDate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} num block min-w-0 max-w-full appearance-none`} />
        </div>

        <div>
          <span className="block text-sm font-medium text-toss-sub mb-1.5">어떤 지출인가요?</span>
          <div className="space-y-2">
            {GROUPS.map((g) => (
              <div key={g.key} className="flex items-center gap-2">
                <span className={`w-12 shrink-0 text-xs font-bold ${g.text}`}>{g.shortLabel}</span>
                <div className="flex-1 grid grid-cols-3 gap-1.5">
                  {cats.filter((c) => c.group === g.key).map((c) => (
                    <button key={c.key} type="button" data-cat={c.key} onClick={() => setCategory(c.key)} className={chip(c.key === category)}>{c.short}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="expenseMemo" className="block text-sm font-medium text-toss-sub mb-1.5">어디서 썼나요? <span className="font-normal">(선택)</span></label>
          <input id="expenseMemo" maxLength={30} placeholder="예: 쿠팡, 이마트, 스타벅스" autoComplete="off" value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} />
          {suggestions.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1 -mx-1 px-1">
              {suggestions.map((sg) => (
                <button key={sg.memo} type="button" onClick={() => { setMemo(sg.memo); setCategory(sg.category); }}
                  className="memo-chip shrink-0 px-3 py-1.5 rounded-full bg-toss-blueLight text-sm font-semibold text-toss-blue active:scale-95 transition whitespace-nowrap">
                  {sg.memo} <span className="font-normal text-toss-sub">· {CATEGORY_MAP[sg.category].short}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="expenseItems" className="block text-sm font-medium text-toss-sub mb-1.5">무엇을 샀나요? <span className="font-normal">(선택)</span></label>
          <input id="expenseItems" maxLength={60} placeholder="예: 휴지 30롤, 우유, 계란" autoComplete="off" value={items} onChange={(e) => setItems(e.target.value)} className={inputClass} />
          {itemSuggestions.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1 -mx-1 px-1">
              {itemSuggestions.map((it) => (
                <button key={it} type="button" onClick={() => setItems(it)}
                  className="item-chip shrink-0 px-3 py-1.5 rounded-full bg-toss-bg text-sm font-semibold text-toss-sub active:scale-95 transition whitespace-nowrap">
                  {it}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="expenseAmount" className="text-sm font-medium text-toss-sub">{refund ? "얼마 돌려받았나요?" : "얼마 썼나요?"}</label>
            <button type="button" onClick={() => setAmount(0)} className="text-xs font-semibold text-toss-sub hover:text-toss-text">지우기</button>
          </div>
          <CalcMoneyInput id="expenseAmount" value={amount} onChange={setAmount} />
          {refund && original ? (
            refundable > 0 ? (
              <button type="button" onClick={() => setAmount(refundable)}
                className="mt-2 px-3 py-1.5 rounded-full bg-green-50 text-sm font-semibold text-toss-green active:scale-95 transition">
                {refundable < (Number(original.amount) || 0) ? `남은 금액 ${formatKRW(refundable)}` : `전액 ${formatKRW(refundable)}`}
              </button>
            ) : <p className="mt-2 text-xs font-semibold text-toss-red">이 결제는 이미 전액 환불됐어요</p>
          ) : (
            <QuickAddChips amounts={[[1000, "+1천"], [5000, "+5천"], [10000, "+1만"], [30000, "+3만"], [50000, "+5만"]]} onAdd={(n) => setAmount((a) => a + n)} />
          )}
          {!refundFor && (
            <button type="button" role="switch" aria-checked={refund} onClick={() => setRefund((r) => !r)}
              className={`refund-toggle mt-2 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border transition ${refund ? "bg-green-50 border-green-300" : "bg-white border-toss-border"}`}>
              <span className="text-left">
                <span className="block text-sm font-bold text-toss-text">↩️ 환불 · 취소로 돌려받은 돈이에요</span>
                <span className="block text-xs text-toss-sub mt-0.5">돌려받은 날의 지출에서 빠져요</span>
              </span>
              <span className={`relative w-11 h-6 shrink-0 rounded-full transition ${refund ? "bg-toss-green" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${refund ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          )}
          {refund && !refundFor && (
            <RefundPicker memo={memo} candidates={candidates} link={link} onPick={setLink} currentOriginal={original} />
          )}
          {refund && (
            <p className="mt-2 text-xs text-toss-sub leading-relaxed">
              원래 결제한 달 기록은 그대로 두고, <b>돌려받은 날짜의 달</b> 지출에서 빠져요.
              {original && " 원래 결제 금액은 고치지 마세요. 두 번 빠져요."}
            </p>
          )}
        </div>

        <div>
          <span className="block text-sm font-medium text-toss-sub mb-1.5">{refund ? "누가 돌려받았나요?" : "누가 썼나요?"}</span>
          <div className="grid grid-cols-3 gap-2">
            {SPENDERS.map((sp) => (
              <button key={sp} type="button" onClick={() => setSpender(sp)} className={`${chip(sp === spender)} py-2.5 font-bold`}>{sp}</button>
            ))}
          </div>
          {spender === "태형" && (
            <button type="button" role="switch" aria-checked={company} onClick={() => setCompany((c) => !c)}
              className={`mt-2 w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition ${company ? "bg-indigo-50 border-indigo-300" : "bg-white border-toss-border"}`}>
              <span className="text-left">
                <span className="block text-sm font-bold text-toss-text">🏢 회사 돈으로 썼어요</span>
                <span className="block text-xs text-toss-sub mt-0.5">영업활동비로 모아두고, 가계부 지출에서는 빠져요</span>
              </span>
              <span className={`relative w-11 h-6 shrink-0 rounded-full transition ${company ? "bg-indigo-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${company ? "left-[22px]" : "left-0.5"}`} />
              </span>
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

/** ↩️ 어떤 결제의 환불인지 고르기: 같은 사용처의 최근 결제 + '연결 안 함' */
function RefundPicker({ memo, candidates, link, onPick, currentOriginal }: {
  memo: string;
  candidates: { tx: Transaction; remaining: number }[];
  link: string | null;
  onPick: (id: string | null) => void;
  currentOriginal: Transaction | null;
}) {
  const md = (d: string) => d.slice(5).replace("-", "/");
  // 이미 연결된 결제가 목록(최근 5건) 밖이면 맨 위에 보여줘요
  const list = currentOriginal && !candidates.some((c) => c.tx.id === currentOriginal.id)
    ? [{ tx: currentOriginal, remaining: 0, pinned: true }, ...candidates]
    : candidates;
  const row = (on: boolean, disabled = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${on ? "border-toss-blue bg-toss-blueLight" : "border-toss-border bg-white"} ${disabled ? "opacity-50" : "active:scale-[0.99]"}`;
  return (
    <div className="refund-picker mt-3">
      <p className="text-sm font-bold text-toss-text">어떤 결제의 환불인가요?</p>
      <p className="text-xs text-toss-sub mt-0.5 mb-2">
        {!memo.trim() ? "사용처를 먼저 적으면 그 사용처의 결제를 찾아드려요" : candidates.length ? "같은 사용처의 최근 결제예요" : "같은 사용처의 결제를 못 찾았어요. 연결 없이 기록돼요"}
      </p>
      <div className="space-y-1.5">
        {list.map((c) => {
          const on = link === c.tx.id;
          const full = c.remaining <= 0 && !("pinned" in c);
          return (
            <button key={c.tx.id} type="button" disabled={full && !on} onClick={() => onPick(c.tx.id)} className={row(on, full && !on)}>
              <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${on ? "border-toss-blue bg-toss-blue" : "border-gray-300"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-toss-text truncate">{md(c.tx.date)} {c.tx.memo || c.tx.items || "결제"}</span>
                <span className="block text-xs text-toss-sub num">
                  {"pinned" in c ? "지금 연결된 결제" : full ? "전액 환불돼서 고를 수 없어요" : c.remaining < (Number(c.tx.amount) || 0) ? `${formatKRW(c.remaining)} 남음 (${formatKRW((Number(c.tx.amount) || 0) - c.remaining)} 환불됨)` : `${formatKRW(c.remaining)} 남음`}
                </span>
              </span>
              <span className="text-sm font-bold num text-toss-text shrink-0">{formatKRW(Number(c.tx.amount) || 0)}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => onPick(null)} className={row(link === null)}>
          <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${link === null ? "border-toss-blue bg-toss-blue" : "border-gray-300"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-toss-text">연결 안 함</span>
            <span className="block text-xs text-toss-sub">어느 결제인지 모를 때</span>
          </span>
        </button>
      </div>
    </div>
  );
}
