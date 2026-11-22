import { CATEGORIES, normalizeCategory, type Category, type CategoryKey } from "../../lib/categories";
import { shiftMonth } from "../../lib/dates";
import { formatShort } from "../../lib/format";
import { josa } from "../../lib/josa";
import type { Transaction } from "../../lib/types";

export interface InsightRow {
  cat: Category;
  cur: number;
  avg: number;
  /** 평균 대비 % (평균이 0이면 null) */
  pct: number | null;
}

export interface Insights {
  /** 비교한 지난 달 수 (1~3) */
  months: number;
  /** 진행 중인 달이면 '같은 날짜까지'로 비교 */
  cutoffDay: number | null;
  rows: InsightRow[];
  lines: { text: string; tone: "good" | "bad" | "info" }[];
  curTotal: number;
  avgTotal: number;
}

const sumBy = (txs: Transaction[]) => {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CategoryKey, number>;
  txs.forEach((t) => { out[normalizeCategory(t.category)] += Number(t.amount) || 0; });
  return out;
};

/**
 * 이번 달(ym) 카테고리별 지출을 최근 최대 3개월 평균과 비교해요.
 * cutoffDay를 주면 지난 달들도 그 날짜까지만 더해서 공정하게 비교해요.
 * 기록이 하나도 없는 달은 평균에서 빼요 (앱을 쓰기 전 달).
 */
export function buildInsights(ym: string, cur: Transaction[], history: Transaction[], cutoffDay: number | null, maxMonths = 3): Insights | null {
  const months: Transaction[][] = [];
  for (let i = 1; i <= maxMonths; i++) {
    const key = shiftMonth(ym, -i);
    const all = history.filter((t) => t.date && t.date.startsWith(key));
    if (!all.length) continue;
    months.push(cutoffDay ? all.filter((t) => Number(t.date.slice(8, 10)) <= cutoffDay) : all);
  }
  if (!months.length) return null;

  const curSum = sumBy(cur);
  const avgSum = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CategoryKey, number>;
  months.forEach((list) => { const s = sumBy(list); CATEGORIES.forEach((c) => { avgSum[c.key] += s[c.key] / months.length; }); });

  const rows: InsightRow[] = CATEGORIES
    .map((cat) => {
      const c = curSum[cat.key];
      const a = Math.round(avgSum[cat.key]);
      return { cat, cur: c, avg: a, pct: a > 0 ? Math.round(((c - a) / a) * 100) : null };
    })
    .filter((r) => r.cur > 0 || r.avg > 0)
    .sort((a, b) => Math.max(b.cur, b.avg) - Math.max(a.cur, a.avg));

  const n = months.length;
  const base = n === 1 ? "지난달" : `${n}개월 평균`;
  const lines: Insights["lines"] = [];
  // 의미 있는 변화만: 20% 이상 + 1만원 이상 차이
  const ups = rows.filter((r) => r.pct !== null && r.pct >= 20 && r.cur - r.avg >= 10000).sort((a, b) => (b.cur - b.avg) - (a.cur - a.avg));
  const downs = rows.filter((r) => r.pct !== null && r.pct <= -20 && r.avg - r.cur >= 10000).sort((a, b) => (b.avg - b.cur) - (a.avg - a.cur));
  const fresh = rows.filter((r) => r.avg === 0 && r.cur >= 10000).sort((a, b) => b.cur - a.cur);
  ups.slice(0, 2).forEach((r) => lines.push({ tone: "bad", text: `${r.cat.short}에 ${base}보다 ${r.pct}% 더 썼어요 (+${formatShort(r.cur - r.avg)})` }));
  downs.slice(0, 2).forEach((r) => lines.push({ tone: "good", text: `${josa(r.cat.short, "은", "는")} ${base}보다 ${Math.abs(r.pct!)}% 아꼈어요 (−${formatShort(r.avg - r.cur)})` }));
  fresh.slice(0, 1).forEach((r) => lines.push({ tone: "info", text: `${josa(r.cat.short, "은", "는")} 평소엔 거의 안 쓰던 곳이에요 (${formatShort(r.cur)})` }));

  const curTotal = rows.reduce((t, r) => t + r.cur, 0);
  const avgTotal = rows.reduce((t, r) => t + r.avg, 0);
  if (!lines.length) lines.push({ tone: "info", text: `${base}과 비슷하게 쓰고 있어요. 안정적이에요 👌` });
  return { months: n, cutoffDay, rows, lines, curTotal, avgTotal };
}
