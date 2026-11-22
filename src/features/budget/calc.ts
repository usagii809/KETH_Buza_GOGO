import { CATEGORIES, type Budget, type CategoryKey, fixedTotalOf, normalizeCategory, variableBudgetOf } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import { floor100 } from "../../lib/format";
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
    return s + (period.state === "past" ? spent : Math.max(budget[c.key], spent));
  }, 0);
  const plannedSavings = income - fixedTotal - totalVariableBudget;
  const projectedSavings = income - fixedTotal - projectedVariable;

  const paced = CATEGORIES.filter((c) => c.paced);
  const pacedBudget = paced.reduce((s, c) => s + budget[c.key], 0);
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

export interface Available {
  /** 변동지출 전체 (하루/주: 통신비·생필품·의류 제외) */
  variable: number;
  variableExhausted: boolean;
  food: number;
  foodExhausted: boolean;
  foodBudget: number;
  foodSpent: number;
}

export function computeAvailable(budget: Budget, s: Summary, period: PeriodInfo, mode: AvailableMode): Available {
  const food = CATEGORIES.filter((c) => c.group === "FOOD");
  const foodBudget = food.reduce((t, c) => t + budget[c.key], 0);
  const foodSpent = food.reduce((t, c) => t + s.usage[c.key], 0);
  const foodRemain = foodBudget - foodSpent;
  const pacedRemain = s.pacedBudget - s.pacedSpent;

  if (mode === "month" || period.state === "past") {
    return {
      variable: s.totalVariableBudget - s.totalVariableSpent,
      variableExhausted: s.totalVariableSpent > s.totalVariableBudget,
      food: foodRemain,
      foodExhausted: foodRemain < 0,
      foodBudget,
      foodSpent
    };
  }
  const days = mode === "day" ? 1 : period.weekLeft;
  const perPeriod = (remain: number) => (period.daysLeft > 0 ? floor100((remain / period.daysLeft) * days) : 0);
  return {
    variable: perPeriod(pacedRemain),
    variableExhausted: pacedRemain <= 0 && s.pacedBudget > 0,
    food: perPeriod(foodRemain),
    foodExhausted: foodRemain <= 0 && foodBudget > 0,
    foodBudget,
    foodSpent
  };
}

/** 지난달 비교: 진행 중인 달은 '같은 날짜까지', 끝난 달은 전체 */
export function compareWithPrev(usage: Usage, prevTxs: Transaction[], period: PeriodInfo) {
  if (period.state === "future" || prevTxs.length === 0) return null;
  const prev = sumByCategory(prevTxs, period.state === "current" ? period.day : null);
  return { prev, diff: sumUsage(usage) - sumUsage(prev), scope: period.state === "current" ? "지난달 이맘때" : "지난달" };
}

/** 카테고리별 지난달 대비 % (지난달 0원이면 null) */
export const pctChange = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
