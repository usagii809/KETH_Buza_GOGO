import { shiftMonth, toDateStr, type PeriodInfo } from "../../lib/dates";
import type { Transaction } from "../../lib/types";

/** 날짜별 지출 합계 (자동 기록은 무지출 판정에서 제외) */
export function spentByDate(txs: Transaction[]): Record<string, number> {
  const m: Record<string, number> = {};
  txs.forEach((tx) => {
    if (tx.auto) return;
    m[tx.date] = (m[tx.date] || 0) + (Number(tx.amount) || 0);
  });
  return m;
}

export function countNoSpendDays(period: PeriodInfo, map: Record<string, number>, today: string): number {
  let c = 0;
  for (let d = 1; d <= period.dim; d++) {
    const ds = `${period.key}-${String(d).padStart(2, "0")}`;
    if (ds > today) break;
    if (!map[ds]) c++;
  }
  return c;
}

/** 오늘부터 거꾸로 연속 무지출 일수 (지난달 1일까지 확인). 오늘 지출이 있으면 0 */
export function noSpendStreak(map: Record<string, number>, now: Date, periodKey: string): number {
  const limit = `${shiftMonth(periodKey, -1)}-01`;
  let streak = 0;
  const cur = new Date(now);
  for (;;) {
    const ds = toDateStr(cur);
    if (ds < limit || map[ds] > 0) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
