import { CATEGORIES, normalizeCategory, normalizeSpender, type Budget, type Category } from "../../lib/categories";
import { getPeriodInfo, nextDay, todayStr } from "../../lib/dates";
import { isHousehold, type LotteryTicket, type Transaction } from "../../lib/types";
import { computeSummary } from "../budget/calc";
import { spentByDate } from "../noSpend/calc";

export interface YearMonth {
  ym: string;
  m: number;
  /** 가계부 변동지출 (환불 반영, 회사 돈 제외) */
  spent: number;
  /** 그 달 변동지출 예산 */
  budget: number;
  /** 끝난 달: 실제 모은 돈 (수입을 적은 달만) */
  saved: number | null;
  planned: number | null;
  hasData: boolean;
  /** 아직 진행 중이거나 오지 않은 달 */
  open: boolean;
}

export interface YearReport {
  year: number;
  months: YearMonth[];
  total: number;
  recordCount: number;
  /** 기록이 있는 끝난 달 평균 */
  monthlyAverage: number | null;
  maxMonth: YearMonth | null;
  minMonth: YearMonth | null;
  categories: { cat: Category; total: number; share: number }[];
  spenders: { name: string; total: number; share: number }[];
  places: { memo: string; count: number; total: number }[];
  biggest: Transaction[];
  refund: { count: number; total: number };
  company: { count: number; total: number };
  noSpendDays: number;
  /** 무지출을 센 날 수 (분모) */
  noSpendOf: number;
  savings: { saved: number; planned: number; months: number } | null;
  lottery: { jackpot: number; bomb: number; love: number; total: number };
  /** 올해 예산을 지킨 달 수 / 예산이 있던 끝난 달 수 */
  budgetKept: { kept: number; of: number };
  headline: string;
}

/**
 * 연간 결산.
 * @param txs 그 해 기록 전체 (회사 돈 포함)
 * @param budgetOfMonth 달 → 그 달 예산 (월 예산이 없으면 기본 예산)
 * @param noSpendStart 무지출 챌린지 시작일 (처음 기록한 날)
 */
export function buildYearReport(
  year: number,
  txs: Transaction[],
  budgetOfMonth: (ym: string) => Budget,
  now = new Date(),
  noSpendStart: string | null = null,
  tickets: LotteryTicket[] = []
): YearReport {
  const y = String(year);
  const inYear = txs.filter((t) => String(t.date || "").startsWith(y + "-"));
  const household = inYear.filter(isHousehold);
  const today = todayStr(now);

  // 달별
  const months: YearMonth[] = Array.from({ length: 12 }, (_, i) => {
    const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
    const list = household.filter((t) => t.date.startsWith(ym));
    const period = getPeriodInfo(ym, now);
    const s = computeSummary(budgetOfMonth(ym), list, period);
    const done = period.state === "past";
    return {
      ym,
      m: i + 1,
      spent: s.totalVariableSpent,
      budget: s.totalVariableBudget,
      saved: done && s.income > 0 && list.length > 0 ? s.projectedSavings : null,
      planned: done && s.income > 0 && list.length > 0 ? s.plannedSavings : null,
      hasData: list.length > 0,
      open: !done
    };
  });
  const total = months.reduce((s, m) => s + m.spent, 0);
  const finished = months.filter((m) => m.hasData && !m.open);
  const monthlyAverage = finished.length ? Math.round(finished.reduce((s, m) => s + m.spent, 0) / finished.length) : null;
  const maxMonth = finished.length ? finished.reduce((a, b) => (b.spent > a.spent ? b : a)) : null;
  const minMonth = finished.length > 1 ? finished.reduce((a, b) => (b.spent < a.spent ? b : a)) : null;

  // 카테고리
  const byCat = new Map<string, number>();
  household.forEach((t) => { const k = normalizeCategory(t.category); byCat.set(k, (byCat.get(k) || 0) + (Number(t.amount) || 0)); });
  const catTotalPos = [...byCat.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0) || 1;
  const categories = CATEGORIES
    .map((cat) => ({ cat, total: byCat.get(cat.key) || 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ ...c, share: (c.total / catTotalPos) * 100 }));

  // 누가
  const bySp: Record<string, number> = { 태형: 0, 경은: 0, 공동: 0 };
  household.forEach((t) => { bySp[normalizeSpender(t.spender)] += Number(t.amount) || 0; });
  const spTotal = Object.values(bySp).filter((v) => v > 0).reduce((s, v) => s + v, 0) || 1;
  const spenders = Object.entries(bySp).filter(([, v]) => v > 0).map(([name, v]) => ({ name, total: v, share: (v / spTotal) * 100 }));

  // 단골 사용처 (결제만, 자동 기록 제외)
  const byPlace = new Map<string, { memo: string; count: number; total: number }>();
  household.forEach((t) => {
    const memo = String(t.memo || "").trim();
    const a = Number(t.amount) || 0;
    if (!memo || t.auto) return;
    const k = memo.toLowerCase();
    const e = byPlace.get(k) || { memo, count: 0, total: 0 };
    if (a > 0) e.count++;
    e.total += a;
    byPlace.set(k, e);
  });
  const places = [...byPlace.values()].filter((p) => p.count >= 2).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 5);

  const biggest = household.filter((t) => (Number(t.amount) || 0) > 0 && !t.auto).sort((a, b) => b.amount - a.amount).slice(0, 3);

  const refunds = household.filter((t) => (Number(t.amount) || 0) < 0);
  const companyTxs = inYear.filter((t) => t.company);

  // 무지출: 올해 1월 1일(또는 챌린지 시작일) ~ 오늘(또는 12월 31일)
  const map = spentByDate(household);
  let from = `${y}-01-01`;
  if (noSpendStart && noSpendStart > from) from = noSpendStart;
  const to = `${y}-12-31` < today ? `${y}-12-31` : today;
  let noSpendDays = 0, noSpendOf = 0;
  if (noSpendStart) {
    for (let d = from; d <= to; d = nextDay(d)) {
      noSpendOf++;
      if (!(map[d] > 0)) noSpendDays++;
    }
  }

  const savedMonths = months.filter((m) => m.saved !== null);
  const savings = savedMonths.length
    ? { saved: savedMonths.reduce((s, m) => s + (m.saved || 0), 0), planned: savedMonths.reduce((s, m) => s + (m.planned || 0), 0), months: savedMonths.length }
    : null;

  const budgeted = finished.filter((m) => m.budget > 0);
  const budgetKept = { kept: budgeted.filter((m) => m.spent <= m.budget).length, of: budgeted.length };

  const yt = tickets.filter((t) => t.revealed && String(t.date || "").startsWith(y + "-"));
  const lottery = {
    jackpot: yt.filter((t) => t.tier === "jackpot").length,
    bomb: yt.filter((t) => t.tier === "bomb").length,
    love: yt.filter((t) => t.tier === "love").length,
    total: yt.length
  };

  let headline: string;
  if (!household.length) headline = `${year}년에는 아직 기록이 없어요`;
  else if (savings && savings.saved >= savings.planned && savings.saved > 0) headline = `🥇 ${year}년, 계획보다 더 모았어요!`;
  else if (savings && savings.saved > 0) headline = `💰 ${year}년에 함께 모은 돈`;
  else if (budgetKept.of && budgetKept.kept * 2 >= budgetKept.of) headline = `👏 ${year}년, 예산을 잘 지켰어요`;
  else headline = `📒 ${year}년 우리 가계부`;

  return {
    year,
    months,
    total,
    recordCount: inYear.length,
    monthlyAverage,
    maxMonth,
    minMonth,
    categories,
    spenders,
    places,
    biggest,
    refund: { count: refunds.length, total: -refunds.reduce((s, t) => s + (Number(t.amount) || 0), 0) },
    company: { count: companyTxs.length, total: companyTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0) },
    noSpendDays,
    noSpendOf,
    savings,
    lottery,
    budgetKept,
    headline
  };
}
