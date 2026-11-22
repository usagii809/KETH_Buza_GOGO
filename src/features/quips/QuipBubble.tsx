import { useState } from "react";
import type { PeriodInfo } from "../../lib/dates";
import { todayStr } from "../../lib/dates";
import type { Summary } from "../budget/calc";
import { getSpendLevel, LEVEL_LABEL, pickQuip, type SpendLevel } from "./quips";

const STYLE: Record<SpendLevel, { bg: string; chip: string }> = {
  rich: { bg: "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200", chip: "bg-amber-400 text-white" },
  good: { bg: "bg-green-50 border-green-200", chip: "bg-toss-green text-white" },
  normal: { bg: "bg-white border-toss-border", chip: "bg-toss-blue text-white" },
  warning: { bg: "bg-orange-50 border-orange-200", chip: "bg-toss-amber text-white" },
  broke: { bg: "bg-red-50 border-red-200", chip: "bg-toss-red text-white" }
};

/** 지출 페이스에 따라 바뀌는 오늘의 한마디. 탭하면 다른 문구 */
export function QuipBubble({ s, period, now }: { s: Summary; period: PeriodInfo; now: Date }) {
  const [shuffle, setShuffle] = useState(0);
  const level = getSpendLevel(s, period);
  if (!level) return null;
  const st = STYLE[level];
  return (
    <button type="button" onClick={() => setShuffle((n) => n + 1)} aria-label="다른 한마디 보기"
      className={`w-full text-left mb-4 px-4 py-3 rounded-2xl border ${st.bg} active:scale-[0.99] transition`}>
      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${st.chip}`}>{LEVEL_LABEL[level]}</span>
      <p className="text-sm font-semibold text-toss-text mt-1.5 leading-snug">{pickQuip(level, `${period.key}|${todayStr(now)}`, shuffle)}</p>
    </button>
  );
}
