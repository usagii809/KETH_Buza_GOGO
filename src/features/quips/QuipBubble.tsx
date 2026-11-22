import type { PeriodInfo } from "../../lib/dates";
import { todayStr } from "../../lib/dates";
import type { Summary } from "../budget/calc";
import { dateEgg } from "../fun/eggs";
import { getSpendTier, pickQuip, TIERS } from "./quips";

/** 한 달 예산 사용률에 따라 바뀌는 오늘의 한마디. 하루에 한 문구만 보여줘요 */
/** override: 오늘 복권 1등 같은 특별한 날의 문구 */
export function QuipBubble({ s, period, now, override }: { s: Summary; period: PeriodInfo; now: Date; override?: string | null }) {
  const tier = getSpendTier(s, period);
  if (tier === null) return null;
  const t = TIERS[tier];
  const pct = Math.round((s.totalVariableSpent / s.totalVariableBudget) * 100);
  return (
    <div className={`mb-4 px-4 py-3 rounded-2xl border ${t.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${t.chip}`}>{t.label}</span>
        <span className="text-[11px] font-semibold text-toss-sub num">예산 {pct}% 사용</span>
      </div>
      <p className="text-sm font-semibold text-toss-text mt-1.5 leading-snug">{(period.state === "current" && (override || dateEgg(todayStr(now)))) || pickQuip(tier, `${period.key}|${todayStr(now)}`)}</p>
    </div>
  );
}
