import { useState } from "react";
import type { PeriodInfo } from "../../lib/dates";
import { todayStr } from "../../lib/dates";
import type { Summary } from "../budget/calc";
import { getSpendTier, pickQuip, TIERS } from "./quips";

/** 한 달 예산 사용률에 따라 바뀌는 오늘의 한마디. 탭하면 다른 문구 */
export function QuipBubble({ s, period, now }: { s: Summary; period: PeriodInfo; now: Date }) {
  const [shuffle, setShuffle] = useState(0);
  const tier = getSpendTier(s, period);
  if (tier === null) return null;
  const t = TIERS[tier];
  const pct = Math.round((s.totalVariableSpent / s.totalVariableBudget) * 100);
  return (
    <button type="button" onClick={() => setShuffle((n) => n + 1)} aria-label="다른 한마디 보기"
      className={`w-full text-left mb-4 px-4 py-3 rounded-2xl border ${t.bg} active:scale-[0.99] transition`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${t.chip}`}>{t.label}</span>
        <span className="text-[11px] font-semibold text-toss-sub num">예산 {pct}% 사용</span>
      </div>
      <p className="text-sm font-semibold text-toss-text mt-1.5 leading-snug">{pickQuip(tier, `${period.key}|${todayStr(now)}`, shuffle)}</p>
    </button>
  );
}
