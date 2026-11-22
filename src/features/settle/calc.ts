import type { Summary } from "../budget/calc";

export interface SettleOptions {
  /** 변동지출 예산에서 쓰지 않고 남긴 돈 */
  leftover: number;
  /** 수입 − 고정지출 − 실제 변동지출 = 그 달에 실제로 남은 돈 전부 */
  actual: number;
}

export function settleOptions(s: Summary): SettleOptions {
  return {
    leftover: Math.max(0, s.totalVariableBudget - s.totalVariableSpent),
    actual: Math.max(0, s.income - s.fixedTotal - s.totalVariableSpent)
  };
}

/** 정산할 돈이 있는 달인지 (기록이 있고, 남은 돈이 있어야) */
export const canSettle = (o: SettleOptions, hasRecords: boolean) => hasRecords && (o.leftover > 0 || o.actual > 0);
