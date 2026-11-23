import { useState } from "react";
import { saveBudget } from "../../data/db";
import { CATEGORIES, FIXED_FIELDS, budgetOf, isHiddenCategory, GROUPS, ZERO_BUDGET, fixedTotalOf, plannedSavingsOf, variableBudgetOf, type Budget, type BudgetKey } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import { formatKRW } from "../../lib/format";
import { MoneyInput, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";

const inputCls = "w-36 shrink-0 bg-white text-right text-base font-bold num rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue placeholder:text-toss-muted placeholder:font-medium";

function Field({ id, label, value, onChange, hint, empty = "0" }: { id: string; label: string; value: number; onChange: (v: number) => void; hint?: string; empty?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-sm font-medium text-toss-text min-w-0">
        {label}
        {hint && <span className="block text-[11px] font-normal text-toss-sub">{hint}</span>}
      </label>
      <MoneyInput id={id} value={value} onChange={onChange} placeholder={empty} className={inputCls} />
    </div>
  );
}

export function BudgetSheet({ period, budget, onClose }: { period: PeriodInfo; budget: Budget; onClose: () => void }) {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<Budget>(budget);
  // 지난달을 고칠 때는 기본 예산까지 바뀌지 않도록 기본값 해제
  const [alsoDefault, setAlsoDefault] = useState(period.state !== "past");
  const [busy, setBusy] = useState(false);
  const set = (k: BudgetKey) => (v: number) => setDraft((d) => ({ ...d, [k]: v }));
  const setCat = (k: string) => (v: number) => setDraft((d) => ({ ...d, [k]: v }));

  const planned = plannedSavingsOf(draft);
  const rate = draft.income > 0 ? ` (${((planned / draft.income) * 100).toFixed(1)}%)` : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveBudget(period.key, draft, alsoDefault);
      toast("예산을 저장했어요 👍");
      onClose();
    } catch (err) {
      console.error("예산 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="예산 설정" subtitle={`${period.y}년 ${period.m}월에 적용돼요`} onClose={onClose}
      footer={<>
        <button type="button" onClick={() => { setDraft(ZERO_BUDGET); toast("모두 비웠어요. 저장해야 반영돼요"); }}
          className="px-4 py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub hover:bg-gray-200 transition">비우기</button>
        <button type="submit" form="budgetForm" disabled={busy} className={primaryButton}>{busy ? "저장하는 중..." : "저장하기"}</button>
      </>}>
      <form id="budgetForm" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="edit_income" className="block text-sm font-bold text-toss-blue mb-1.5">한 달 수입 <span className="font-medium">(세후)</span></label>
          <MoneyInput id="edit_income" value={draft.income} onChange={set("income")}
            className="w-full bg-toss-blueLight/70 text-toss-text text-lg font-bold num rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue" />
        </div>

        {/* 한눈에 보기: 수입 = 고정 + 변동 + 저축 */}
        <BudgetFlow income={draft.income} fixed={fixedTotalOf(draft)} variable={variableBudgetOf(draft)} planned={planned} rate={rate} />

        <section className="rounded-2xl bg-toss-bg p-3.5 space-y-2.5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-base font-bold text-toss-text">📌 고정지출</p>
              <p className="text-xs text-toss-sub">매달 꼭 나가는 돈 · 가용 예산에서 빠져요</p>
            </div>
            <span className="text-base font-bold num text-toss-text">{formatKRW(fixedTotalOf(draft))}</span>
          </div>
          {FIXED_FIELDS.map(([key, label]) => <Field key={key} id={`edit_${key}`} label={label} value={draft[key]} onChange={set(key)} />)}
        </section>

        <section className="rounded-2xl bg-toss-blueLight/60 border border-blue-100 p-3.5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-base font-bold text-toss-blue">🛒 변동지출 예산</p>
              <p className="text-xs text-toss-sub">이번 달에 나눠 쓸 돈 · 기록하면 여기서 빠져요</p>
            </div>
            <span id="variableTotal" className="text-lg font-bold num text-toss-blue">{formatKRW(variableBudgetOf(draft))}</span>
          </div>
          {GROUPS.map((g) => {
            // 숨긴 항목은 예산이 남아 있을 때만 보여요
            const cats = CATEGORIES.filter((c) => c.group === g.key && (!isHiddenCategory(c.key) || budgetOf(draft, c.key) > 0));
            return (
              <div key={g.key} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${g.badge}`}>{g.label}</span>
                  <span className="text-xs font-bold text-toss-sub num">소계 {formatKRW(cats.reduce((t, c) => t + budgetOf(draft, c.key), 0))}</span>
                </div>
                {cats.map((c) => (
                  <Field key={c.key} id={`edit_${c.key}`} label={c.label} value={budgetOf(draft, c.key)} onChange={setCat(c.key)} empty="기록만"
                    hint={NO_LIMIT_OK.includes(c.key) && !budgetOf(draft, c.key) ? "비워두면 예산 없이 기록만 해요" : undefined} />
                ))}
              </div>
            );
          })}
        </section>

        <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
          <input type="checkbox" checked={alsoDefault} onChange={(e) => setAlsoDefault(e.target.checked)} className="w-4 h-4 mt-0.5 rounded text-toss-blue focus:ring-toss-blue" />
          <span className="text-sm font-medium text-toss-sub leading-snug">
            다음 달에도 이 예산 쓰기
            <span className="block text-xs font-normal">예산을 따로 정하지 않은 달에 자동으로 적용돼요</span>
          </span>
        </label>
      </form>
    </Sheet>
  );
}

/** 통신비·교통비처럼 정해두기 어려운 항목은 0으로 둬도 돼요 */
const NO_LIMIT_OK: string[] = ["livingTelecom", "livingTransport"];

/** 수입이 어디로 가는지 막대 하나로 */
function BudgetFlow({ income, fixed, variable, planned, rate }: { income: number; fixed: number; variable: number; planned: number; rate: string }) {
  const base = Math.max(income, fixed + variable, 1);
  const w = (n: number) => `${Math.max(0, (n / base) * 100)}%`;
  const row = (dot: string, label: string, value: number, cls = "text-toss-text") => (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-toss-sub"><span className={`w-2.5 h-2.5 rounded-sm ${dot}`} />{label}</span>
      <span className={`font-bold num ${cls}`}>{value < 0 ? "-" : ""}{formatKRW(Math.abs(value))}</span>
    </div>
  );
  return (
    <div className="p-3.5 rounded-2xl border border-toss-border space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-toss-bg">
        <div className="bg-gray-400" style={{ width: w(fixed) }} />
        <div className="bg-toss-blue" style={{ width: w(variable) }} />
        {planned > 0 && <div className="bg-toss-green" style={{ width: w(planned) }} />}
      </div>
      {row("bg-gray-400", "📌 고정지출", fixed)}
      {row("bg-toss-blue", "🛒 변동지출 예산", variable, "text-toss-blue")}
      <div className="pt-1.5 border-t border-toss-border">
        {row(planned < 0 ? "bg-toss-red" : "bg-toss-green", planned < 0 ? "💸 수입보다 많이 잡았어요" : "💰 매달 모이는 돈", planned, planned < 0 ? "text-toss-red" : "text-toss-green")}
        {rate && planned >= 0 && <p className="text-right text-xs text-toss-sub num">수입의{rate.replace(/[()]/g, "")}</p>}
      </div>
    </div>
  );
}
