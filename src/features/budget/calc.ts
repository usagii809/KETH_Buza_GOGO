import { CATEGORIES, budgetOf, type Budget, type CategoryKey, fixedTotalOf, normalizeCategory, variableBudgetOf } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import type { Transaction } from "../../lib/types";

export type Usage = Record<CategoryKey, number>;

/** 카테고리별 사용액. cutoffDay를 주면 그 날짜(일)까지만 */
export function sumByCategory(txs: Transaction[], cutoffDay: number | null = null): Usage {
  const map = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Usage;
  txs.forEach((tx) => {
    if (cutoffDay !== null && Number(String(tx.date || "").slice(8, 10)) > cutoffDay) return;
    map[normalizeCategory(tx.category)] += Number(tx.amount) || 0;
  });
  return map;
}

export const sumUsage = (u: Usage) => Object.values(u).reduce((s, v) => s + v, 0);

// 상태 색: 초과 = 빨강, 오늘 위치보다 10%p 이상 빠르게 씀 = 주황, 그 외 정상
export const STATUS = {
  over: { key: "over", bar: "bg-toss-red", text: "text-toss-red", hex: "#F04452" },
  fast: { key: "fast", bar: "bg-toss-amber", text: "text-toss-amber", hex: "#FF9F00" },
  ok: { key: "ok", bar: "bg-toss-blue", text: "text-toss-blue", hex: "#3182F6" }
} as const;
export type Status = (typeof STATUS)[keyof typeof STATUS];

export function getStatus(spent: number, budget: number, period: PeriodInfo, paced: boolean): Status {
  if (budget <= 0) return spent > 0 ? STATUS.over : STATUS.ok;
  const pct = (spent / budget) * 100;
  if (pct > 100) return STATUS.over;
  if (paced && period.state !== "past" && pct > period.elapsedPct + 10) return STATUS.fast;
  return STATUS.ok;
}

export interface Summary {
  income: number;
  fixedTotal: number;
  usage: Usage;
  totalVariableBudget: number;
  totalVariableSpent: number;
  /** 진행 중인 달: 항목마다 max(예산, 실제) / 끝난 달: 실제 지출 */
  projectedVariable: number;
  plannedSavings: number;
  /** 진행 중인 달: 예상 저축액 / 끝난 달: 실제 모은 돈 */
  projectedSavings: number;
  /** projectedSavings - plannedSavings (음수 = 초과 지출) */
  gap: number;
  savingsRate: number;
  pacedBudget: number;
  pacedSpent: number;
  /** 도넛·범례의 변동지출 색 */
  livingHex: string;
}

export function computeSummary(budget: Budget, txs: Transaction[], period: PeriodInfo): Summary {
  const usage = sumByCategory(txs);
  const income = budget.income;
  const fixedTotal = fixedTotalOf(budget);
  const totalVariableBudget = variableBudgetOf(budget);
  const totalVariableSpent = sumUsage(usage);

  const projectedVariable = CATEGORIES.reduce((s, c) => {
    const spent = usage[c.key];
    return s + (period.state === "past" ? spent : Math.max(budgetOf(budget, c.key), spent));
  }, 0);
  const plannedSavings = income - fixedTotal - totalVariableBudget;
  const projectedSavings = income - fixedTotal - projectedVariable;

  const paced = CATEGORIES.filter((c) => c.paced);
  const pacedBudget = paced.reduce((s, c) => s + budgetOf(budget, c.key), 0);
  const pacedSpent = paced.reduce((s, c) => s + usage[c.key], 0);

  let livingHex = "#00B37E";
  if (totalVariableBudget > 0 && totalVariableSpent > totalVariableBudget) livingHex = STATUS.over.hex;
  else if (getStatus(pacedSpent, pacedBudget, period, true) === STATUS.fast) livingHex = STATUS.fast.hex;

  return {
    income,
    fixedTotal,
    usage,
    totalVariableBudget,
    totalVariableSpent,
    projectedVariable,
    plannedSavings,
    projectedSavings,
    gap: projectedSavings - plannedSavings,
    savingsRate: income > 0 ? (projectedSavings / income) * 100 : 0,
    pacedBudget,
    pacedSpent,
    livingHex
  };
}

export type AvailableMode = "day" | "week" | "month";

/**
 * 가용 예산: 이번 달 예산 ÷ 이번 달 일수 = 하루 기준 (한 달 내내 고정)
 * - 하루: 하루 기준 vs 오늘 쓴 돈
 * - 이번 주: 하루 기준 × 이번 주(월~일, 이번 달 안) 일수 vs 이번 주 쓴 돈
 * - 이번 달: 하루 기준 × 오늘까지 일수 vs 이번 달 쓴 돈 (끝난 달은 예산 전체 vs 쓴 돈)
 */
export interface Allowance {
  monthBudget: number;
  monthSpent: number;
  /** 하루 기준 (100원 단위 내림) */
  daily: number;
  /** 기준에 들어간 날 수 */
  days: number;
  /** 기준 금액 */
  limit: number;
  /** 그 기간에 쓴 돈 */
  spent: number;
  /** 기준 − 쓴 돈 (+ 덜 씀 / − 더 씀) */
  diff: number;
  /** 이번 주 범위 (일) */
  from: number;
  to: number;
}

export function computeAllowance(monthBudget: number, txs: Transaction[], period: PeriodInfo, mode: AvailableMode, pick: (t: Transaction) => boolean = () => true): Allowance {
  const daily = period.dim > 0 ? Math.floor(monthBudget / period.dim / 100) * 100 : 0;
  const list = txs.filter(pick);
  const dayOf = (t: Transaction) => Number(String(t.date).slice(8, 10)) || 0;
  const spentIn = (from: number, to: number) => list.reduce((s, t) => { const d = dayOf(t); return d >= from && d <= to ? s + (Number(t.amount) || 0) : s; }, 0);
  const monthSpent = spentIn(1, 31);
  const base = { monthBudget, monthSpent, daily };

  if (period.state !== "current" || mode === "month") {
    if (period.state !== "current") {
      return { ...base, days: period.dim, limit: monthBudget, spent: monthSpent, diff: monthBudget - monthSpent, from: 1, to: period.dim };
    }
    const limit = daily * period.day;
    return { ...base, days: period.day, limit, spent: monthSpent, diff: limit - monthSpent, from: 1, to: period.day };
  }
  if (mode === "day") {
    const spent = spentIn(period.day, period.day);
    return { ...base, days: 1, limit: daily, spent, diff: daily - spent, from: period.day, to: period.day };
  }
  // 이번 주: 월요일 ~ 일요일, 이번 달 안쪽만
  const dow = new Date(period.y, period.m - 1, period.day).getDay();
  const monday = period.day - ((dow + 6) % 7);
  const from = Math.max(1, monday);
  const to = Math.min(period.dim, monday + 6);
  const days = to - from + 1;
  const spent = spentIn(from, to);
  const limit = daily * days;
  return { ...base, days, limit, spent, diff: limit - spent, from, to };
}

/** 지난달 비교: 진행 중인 달은 '같은 날짜까지', 끝난 달은 전체 */
export function compareWithPrev(usage: Usage, prevTxs: Transaction[], period: PeriodInfo) {
  if (period.state === "future" || prevTxs.length === 0) return null;
  const prev = sumByCategory(prevTxs, period.state === "current" ? period.day : null);
  return { prev, diff: sumUsage(usage) - sumUsage(prev), scope: period.state === "current" ? "지난달 이맘때" : "지난달" };
}

/** 카테고리별 지난달 대비 % (지난달 0원이면 null) */
export const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
