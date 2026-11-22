import { CATEGORIES, normalizeSpender } from "../../lib/categories";
import { todayStr, type PeriodInfo } from "../../lib/dates";
import { formatShort } from "../../lib/format";
import type { Transaction } from "../../lib/types";
import { pctChange, sumByCategory, type Summary } from "../budget/calc";
import { countNoSpendDays, spentByDate } from "../noSpend/calc";

export interface ReportRow {
  label: string;
  value: string;
  tone?: "good" | "bad";
}

export interface Report {
  emoji: string;
  title: string;
  sub: string;
  rows: ReportRow[];
  shareText: string;
}

export function buildReport(period: PeriodInfo, s: Summary, txs: Transaction[], prevTxs: Transaction[], now = new Date(), noSpendStart: string | null = null): Report {
  const m = period.m;
  const spentTotal = s.totalVariableSpent;
  const actual = s.projectedSavings;
  const gap = s.gap;

  let emoji: string, title: string, sub = "";
  if (s.income === 0) { emoji = "📒"; title = `${m}월에 ${formatShort(spentTotal)} 썼어요`; }
  else if (gap >= 0) { emoji = "🥇"; title = `계획 달성! ${formatShort(actual)} 모았어요`; sub = gap > 0 ? `계획보다 ${formatShort(gap)} 더 모았어요` : "계획한 만큼 딱 모았어요"; }
  else if (actual > 0) { emoji = "🥈"; title = `${formatShort(actual)} 모았어요`; sub = `계획보다 ${formatShort(-gap)} 모자랐어요. 다음 달엔 채워봐요`; }
  else { emoji = "💪"; title = "이번 달은 저축을 못 했어요"; sub = "다음 달엔 꼭 만회해봐요"; }

  const rows: ReportRow[] = [];
  if (s.income > 0) rows.push({ label: "저축률", value: `${s.savingsRate.toFixed(1)}%` });
  // 무지출은 챌린지를 하던 달에만 보여줘요
  const monthEnd = `${period.key}-${String(period.dim).padStart(2, "0")}`;
  if (noSpendStart && noSpendStart <= monthEnd) {
    rows.push({ label: "무지출", value: `${countNoSpendDays(period, spentByDate(txs), todayStr(now), noSpendStart)}일 🌱` });
  }

  const sorted = CATEGORIES.map((c) => [c, s.usage[c.key]] as const).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (sorted.length) rows.push({ label: "가장 많이 쓴 곳", value: `${sorted[0][0].label} · ${formatShort(sorted[0][1])}` });

  let shareLine = "";
  if (prevTxs.length) {
    const prev = sumByCategory(prevTxs);
    const changes = CATEGORIES
      .map((c) => [c, pctChange(s.usage[c.key], prev[c.key])] as const)
      .filter((x): x is readonly [(typeof CATEGORIES)[number], number] => x[1] !== null);
    const best = changes.filter(([, p]) => p < 0).sort((a, b) => a[1] - b[1])[0];
    const worst = changes.filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1])[0];
    if (best) {
      rows.push({ label: "가장 많이 줄인 곳", value: `${best[0].label} ${Math.abs(best[1])}% ↓`, tone: "good" });
      shareLine = `${best[0].label} 지출을 지난달보다 ${Math.abs(best[1])}% 줄였어요`;
    }
    if (worst) rows.push({ label: "가장 많이 늘어난 곳", value: `${worst[0].label} ${worst[1]}% ↑`, tone: "bad" });
  }

  const topDay = Object.entries(spentByDate(txs)).sort((a, b) => b[1] - a[1])[0];
  if (topDay) rows.push({ label: "가장 많이 쓴 날", value: `${m}월 ${Number(topDay[0].slice(8))}일 · ${formatShort(topDay[1])}` });

  const bySpender: Record<string, number> = { 태형: 0, 경은: 0, 공동: 0 };
  txs.forEach((tx) => { bySpender[normalizeSpender(tx.spender)] += Number(tx.amount) || 0; });
  rows.push({
    label: "누가 얼마나",
    value: Object.entries(bySpender).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${formatShort(v)}`).join(" · ") || "-"
  });

  const shareText = `[${period.y}년 ${m}월 가계부 성적표 ${emoji}]\n${title}${sub ? "\n" + sub : ""}${shareLine ? "\n" + shareLine : ""}\n- 태형이와 경은이의 부자 되기 프로젝트`;
  return { emoji, title, sub, rows, shareText };
}
