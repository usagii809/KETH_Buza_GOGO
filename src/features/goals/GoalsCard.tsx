import { formatKRW, formatShort } from "../../lib/format";
import type { Goal } from "../../lib/types";
import { Card, ProgressBar } from "../../ui/controls";
import { goalEta, goalPct, goalRemain, type MonthlyPlan } from "./calc";

export function GoalsCard({ goals, planned, plan, now, onOpen, onNew }:
  { goals: Goal[]; planned: number; plan: MonthlyPlan | null; now: Date; onOpen: (g: Goal) => void; onNew: () => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-toss-text">저축 목표</h2>
        <button type="button" onClick={onNew} className="text-sm font-bold text-toss-blue px-2 py-1 -mr-2 rounded-lg active:bg-toss-blueLight">+ 추가</button>
      </div>
      {plan && <PlanBox plan={plan} />}
      {goals.length > 0 && !plan && (
        <p className="mb-2.5 px-3 py-2 rounded-xl bg-toss-bg text-xs text-toss-sub">💡 목표에 <b>매달 모을 돈</b>을 정하면, 그 돈을 빼고 얼마나 쓸 수 있는지 알려드려요</p>
      )}
      {goals.length === 0 ? (
        <button type="button" onClick={onNew} className="w-full text-left p-4 rounded-2xl bg-toss-bg active:scale-[0.99] transition">
          <p className="text-base font-bold text-toss-text">🏝️ 모으고 싶은 목표를 만들어보세요</p>
          <p className="text-sm text-toss-sub mt-0.5">신혼여행, 내 집 마련처럼 정해두면 얼마나 왔는지 보여드려요</p>
        </button>
      ) : (
        <div className="space-y-2.5">
          {goals.map((g) => {
            const pct = goalPct(g);
            const remain = goalRemain(g);
            const eta = goalEta(g, planned, now);
            return (
              <button key={g.id} type="button" onClick={() => onOpen(g)} className="w-full text-left p-4 rounded-2xl bg-toss-bg active:scale-[0.99] transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-toss-text truncate">{g.emoji || "💰"} {g.name}</span>
                  <span className="text-base font-bold text-toss-blue num shrink-0">{pct}%</span>
                </div>
                <div className="mt-2"><ProgressBar pct={pct} barClass={pct >= 100 ? "bg-toss-green" : "bg-toss-blue"} track="bg-white" /></div>
                <div className="flex justify-between text-xs text-toss-sub mt-1.5 num gap-2">
                  <span>{formatShort(g.saved || 0)} / {formatShort(g.target || 0)}</span>
                  <span className="font-semibold">{remain > 0 ? `목표까지 ${formatShort(remain)}` : "달성 완료 🎉"}</span>
                </div>
                {eta && <p className="text-xs font-semibold text-toss-blue mt-1">{eta}</p>}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** 🧮 매달 모을 돈을 빼고 이번 달에 쓸 수 있는 돈 */
function PlanBox({ plan }: { plan: MonthlyPlan }) {
  const pct = plan.canSpend > 0 ? Math.min(100, Math.round((plan.spent / plan.canSpend) * 100)) : 100;
  const over = plan.left < 0;
  return (
    <div className="plan-box mb-3 p-4 rounded-2xl bg-green-50/80 border border-green-100">
      <p className="text-sm font-bold text-toss-text">🧮 매달 모을 돈 빼고 쓸 수 있는 돈</p>
      <p className="text-2xl font-bold num text-toss-text mt-1">{formatKRW(plan.canSpend)}</p>
      <p className="text-[11px] text-toss-sub num leading-relaxed">수입 − 고정지출 − 매달 모을 돈 {formatShort(plan.monthlyTotal)}</p>
      <div className="mt-2.5"><ProgressBar pct={pct} barClass={over ? "bg-toss-red" : "bg-toss-green"} track="bg-white" /></div>
      <p className="text-sm num mt-1.5">
        <span className="text-toss-sub">지금까지 {formatShort(plan.spent)} 썼어요 · </span>
        <b className={over ? "text-toss-red" : "text-toss-green"}>{over ? `${formatShort(-plan.left)} 넘었어요` : `${formatShort(plan.left)} 남았어요`}</b>
      </p>
      {plan.perDay !== null && !over && <p className="text-xs text-toss-sub num mt-0.5">남은 날 동안 하루 {formatShort(plan.perDay)}씩 쓰면 돼요</p>}
      <p className={`text-xs mt-2 pt-2 border-t border-green-100 leading-relaxed ${plan.vsBudget < 0 ? "text-toss-red font-semibold" : "text-toss-sub"}`}>
        {plan.vsBudget >= 0
          ? `변동지출 예산 안에서만 쓰면 목표를 지킬 수 있어요 👍 (${formatShort(plan.vsBudget)} 여유)`
          : `변동지출 예산이 이보다 ${formatShort(-plan.vsBudget)} 많아요. 예산을 다 쓰면 매달 모을 돈이 모자라요`}
      </p>
    </div>
  );
}
