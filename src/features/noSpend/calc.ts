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

/** 이 달의 무지출 일수. 챌린지 시작일(start) 이전 날짜는 세지 않아요 */
export function countNoSpendDays(period: PeriodInfo, map: Record<string, number>, today: string, start: string | null): number {
  if (!start) return 0;
  let c = 0;
  for (let d = 1; d <= period.dim; d++) {
    const ds = `${period.key}-${String(d).padStart(2, "0")}`;
    if (ds > today) break;
    if (ds < start) continue;
    if (!map[ds]) c++;
  }
  return c;
}

/**
 * 오늘부터 거꾸로 연속 무지출 일수. 오늘 지출이 있으면 0.
 * 챌린지 시작일과 '지난달 1일'(불러온 기록의 범위) 중 늦은 날까지만 확인해요.
 */
export function noSpendStreak(map: Record<string, number>, now: Date, periodKey: string, start: string | null): number {
  if (!start) return 0;
  const loaded = `${shiftMonth(periodKey, -1)}-01`;
  const limit = start > loaded ? start : loaded;
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

/** 시작일부터 오늘까지 며칠째인지 (시작일 = 1일째) */
export function challengeDay(start: string, today: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000)) + 1;
}
