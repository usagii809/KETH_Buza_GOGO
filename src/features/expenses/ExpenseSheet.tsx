import { useMemo, useState } from "react";
import { addExpense, deleteExpense, updateExpense } from "../../data/db";
import { CATEGORIES, CATEGORY_MAP, GROUPS, SPENDERS, normalizeCategory, normalizeSpender, type CategoryKey } from "../../lib/categories";
import { defaultDateForMonth } from "../../lib/dates";
import { formatShort } from "../../lib/format";
import { store } from "../../lib/storage";
import type { Spender, Transaction } from "../../lib/types";
import { BigMoneyInput, QuickAddChips, inputClass, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { confetti } from "../fun/confetti";
import { expenseEgg } from "../fun/eggs";
import { buildMemoIndex, suggestItems, suggestMemos } from "./memo";

interface Props {
  /** 있으면 수정, 없으면 새 기록 */
  tx?: Transaction;
  viewedYm: string;
  uid: string;
  /** 자동완성용 최근 기록 */
  history: Transaction[];
  /** 저장 직전에 호출 (첫 지출이면 그 달 예산 고정) */
  beforeAdd: (ym: string) => Promise<void>;
  /** 내 이름 (프로필) — 처음 기록할 때 기본 '누가' */
  myName?: string;
  /** 💣 강제 무지출 데이 (날짜 → 폭탄 긁은 사람) */
  forcedDays?: Record<string, string>;
  /** 다른 달 날짜로 저장했을 때 그 달로 이동 */
  onMovedMonth: (ym: string) => void;
  onClose: () => void;
}

export function ExpenseSheet({ tx, viewedYm, uid, history, beforeAdd, myName, forcedDays = {}, onMovedMonth, onClose }: Props) {
  const { toast, confirm } = useFeedback();
  const [amount, setAmount] = useState(tx ? Number(tx.amount) || 0 : 0);
  const [memo, setMemo] = useState(tx?.memo || "");
  const [items, setItems] = useState(tx?.items || "");
  const [category, setCategory] = useState<CategoryKey>(normalizeCategory(tx ? tx.category : store.get("lastCategory", "foodIngredients")));
  const [spender, setSpender] = useState<Spender>(normalizeSpender(tx ? tx.spender : store.get("lastSpender", myName || "공동")));
  const [date, setDate] = useState(tx?.date || defaultDateForMonth(viewedYm));
  const [company, setCompany] = useState(!!tx?.company);
  const [busy, setBusy] = useState(false);

  const memoIndex = useMemo(() => buildMemoIndex(history), [history]);
  const suggestions = useMemo(() => suggestMemos(memoIndex, memo), [memoIndex, memo]);
  const itemSuggestions = useMemo(() => suggestItems(history, memo, items), [history, memo, items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { toast("금액을 입력해 주세요"); return; }
    // 회사 돈은 태형이만 (다른 사람으로 바꾸면 자동으로 꺼져요)
    const isCompany = spender === "태형" && company;
    const input = { date, category, spender, amount, memo: memo.trim(), items: items.trim(), company: isCompany };
    const ym = date.slice(0, 7);
    // 💣 강제 무지출 데이에 새 지출을 적으려 하면 한 번 더 물어봐요 (회사 돈은 괜찮아요)
    if (!tx && !isCompany && forcedDays[date]) {
      const ok = await confirm({
        title: "💣 오늘은 강제 무지출 데이!",
        message: `${forcedDays[date]}의 폭탄 때문에 오늘은 지갑 봉인이에요.\n그래도 기록할까요?`,
        okText: "그래도 기록"
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (tx) {
        await updateExpense(tx.id, input);
      } else {
        await beforeAdd(ym).catch((err) => console.warn("월 예산 고정 참고:", err));
        await addExpense(input, uid);
        store.set("lastCategory", category);
        store.set("lastSpender", spender);
      }
      onClose();
      if (ym !== viewedYm) {
        onMovedMonth(ym);
        toast(`${Number(ym.slice(5))}월에 기록하고 그 달로 이동했어요`);
      } else {
        toast(tx ? "수정했어요" : isCompany ? `🏢 회사 돈 ${formatShort(amount)} 기록했어요 (가계부엔 안 들어가요)` : `${formatShort(amount)} 기록했어요`);
      }
      // 🤫 새 기록에 숨은 반응
      const egg = tx ? null : expenseEgg(amount, input.memo, input.items);
      if (egg) setTimeout(() => { toast(egg.text); if (egg.confetti) confetti(); }, 1500);
    } catch (err) {
      console.error("지출 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!tx) return;
    if (!(await confirm({ title: "이 기록을 지울까요?", message: "지우면 둘 다 볼 수 없어요.", okText: "지우기" }))) return;
    try {
      await deleteExpense(tx.id);
      onClose();
      toast("지웠어요");
    } catch {
      toast("지우지 못했어요. 다시 시도해 주세요");
    }
  };

  const chip = (on: boolean) => `py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${on ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub hover:bg-gray-200"}`;

  return (
    <Sheet title={tx ? "기록 수정" : "지출 기록"} onClose={onClose}
      footer={<>
        {tx && <button type="button" onClick={remove} className="px-4 py-3.5 rounded-2xl bg-red-50 hover:bg-red-100 text-toss-red text-sm font-bold transition">지우기</button>}
        <button type="submit" form="expenseForm" disabled={busy} className={primaryButton}>{busy ? "저장하는 중..." : tx ? "수정하기" : "기록하기"}</button>
      </>}>
      <form id="expenseForm" onSubmit={submit} className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="expenseAmount" className="text-sm font-medium text-toss-sub">얼마 썼나요?</label>
            <button type="button" onClick={() => setAmount(0)} className="text-xs font-semibold text-toss-sub hover:text-toss-text">지우기</button>
          </div>
          {/* 새 기록일 때만 바로 키패드가 뜨도록 */}
          <BigMoneyInput id="expenseAmount" value={amount} onChange={setAmount} autoFocus={!tx} />
          <QuickAddChips amounts={[[1000, "+1천"], [5000, "+5천"], [10000, "+1만"], [30000, "+3만"], [50000, "+5만"]]} onAdd={(n) => setAmount((a) => a + n)} />
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
          <span className="block text-sm font-medium text-toss-sub mb-1.5">어떤 지출인가요?</span>
          <div className="space-y-2">
            {GROUPS.map((g) => (
              <div key={g.key} className="flex items-center gap-2">
                <span className={`w-12 shrink-0 text-xs font-bold ${g.text}`}>{g.shortLabel}</span>
                <div className="flex-1 grid grid-cols-3 gap-1.5">
                  {CATEGORIES.filter((c) => c.group === g.key).map((c) => (
                    <button key={c.key} type="button" data-cat={c.key} onClick={() => setCategory(c.key)} className={chip(c.key === category)}>{c.short}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-toss-sub mb-1.5">누가 썼나요?</span>
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

        <div>
          <label htmlFor="expenseDate" className="block text-sm font-medium text-toss-sub mb-1.5">날짜</label>
          <input id="expenseDate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} num`} />
        </div>
      </form>
    </Sheet>
  );
}
