import { useState } from "react";
import { saveBudget } from "../../data/db";
import { CATEGORIES, FIXED_FIELDS, GROUPS, ZERO_BUDGET, fixedTotalOf, plannedSavingsOf, variableBudgetOf, type Budget, type BudgetKey } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import { formatKRW } from "../../lib/format";
import { MoneyInput, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";

const SECTIONS: { title: string; fields: [BudgetKey, string][] }[] = [
  { title: "고정지출 · 매달 꼭 나가는 돈", fields: FIXED_FIELDS },
  ...GROUPS.map((g) => ({ title: `${g.label} 예산`, fields: CATEGORIES.filter((c) => c.group === g.key).map((c) => [c.key, c.label] as [BudgetKey, string]) }))
];

export function BudgetSheet({ period, budget, onClose }: { period: PeriodInfo; budget: Budget; onClose: () => void }) {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<Budget>(budget);
  // 지난달을 고칠 때는 기본 예산까지 바뀌지 않도록 기본값 해제
  const [alsoDefault, setAlsoDefault] = useState(period.state !== "past");
  const [busy, setBusy] = useState(false);
  const set = (k: BudgetKey) => (v: number) => setDraft((d) => ({ ...d, [k]: v }));

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

        {SECTIONS.map((sec) => (
          <div key={sec.title} className="pt-3 border-t border-toss-border space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-toss-sub">{sec.title}</p>
              <span className="text-sm font-bold text-toss-blue num">합계 {formatKRW(sec.fields.reduce((t, [k]) => t + draft[k], 0))}</span>
            </div>
            {sec.fields.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <label htmlFor={`edit_${key}`} className="text-sm font-medium text-toss-text min-w-0">{label}</label>
                <MoneyInput id={`edit_${key}`} value={draft[key]} onChange={set(key)}
                  className="w-36 shrink-0 bg-toss-bg text-right text-base font-bold num rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-toss-blue" />
              </div>
            ))}
          </div>
        ))}

        <div className="p-3.5 rounded-2xl bg-toss-bg space-y-1">
          <div className="flex justify-between text-sm"><span className="text-toss-sub">고정지출 합계</span><span className="font-bold num">{formatKRW(fixedTotalOf(draft))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-toss-sub">변동지출 예산 합계</span><span className="font-bold num">{formatKRW(variableBudgetOf(draft))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-toss-sub">이대로면 매달 모이는 돈</span>
            <span className={`font-bold num ${planned < 0 ? "text-toss-red" : "text-toss-blue"}`}>{formatKRW(planned)}{rate}</span></div>
        </div>

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
