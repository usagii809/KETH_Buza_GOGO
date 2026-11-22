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

/**
 * 날짜별 '연속 무지출 며칠째'인지 (새싹 성장용). 지난달 끝에서 이어진 연속도 이어서 세요.
 */
export function sproutRuns(period: PeriodInfo, map: Record<string, number>, today: string, start: string | null): Record<string, number> {
  const runs: Record<string, number> = {};
  if (!start) return runs;
  let run = 0;
  const prevFirst = `${shiftMonth(period.key, -1)}-01`;
  const cur = new Date(period.y, period.m - 1, 0); // 지난달 말일
  for (;;) {
    const ds = toDateStr(cur);
    if (ds < start || ds < prevFirst || map[ds] > 0) break;
    run++;
    cur.setDate(cur.getDate() - 1);
  }
  for (let d = 1; d <= period.dim; d++) {
    const ds = `${period.key}-${String(d).padStart(2, "0")}`;
    if (ds > today) break;
    if (ds < start || map[ds] > 0) { run = 0; continue; }
    run++;
    runs[ds] = run;
  }
  return runs;
}

export interface StreakRecord {
  days: number;
  from: string;
  to: string;
}

/**
 * 무지출 최장 연속 기록. windowStart(불러온 기록의 시작) 이후만 계산할 수 있어요.
 * 오늘 지출이 없으면 오늘까지 포함해요.
 */
export function longestStreak(map: Record<string, number>, start: string | null, windowStart: string, today: string): StreakRecord | null {
  if (!start) return null;
  const from0 = start > windowStart ? start : windowStart;
  let best: StreakRecord | null = null;
  let run = 0;
  let runFrom = "";
  const cur = new Date(`${from0}T00:00:00`);
  for (;;) {
    const ds = toDateStr(cur);
    if (ds > today) break;
    if (map[ds] > 0) run = 0;
    else {
      if (run === 0) runFrom = ds;
      run++;
      if (!best || run > best.days) best = { days: run, from: runFrom, to: ds };
    }
    cur.setDate(cur.getDate() + 1);
  }
  return best;
}

/** 저장된 최장 기록과 지금 계산한 기록 중 무엇을 믿을지 */
export function pickBest(stored: StreakRecord | null, local: StreakRecord | null, windowStart: string): StreakRecord | null {
  if (!local) return stored;
  // 저장된 기록이 불러온 범위보다 오래된 거면 지금은 다시 계산할 수 없으니 더 긴 쪽을 믿어요.
  // 범위 안이면 지금 계산이 정확해요 (나중에 빠뜨린 지출을 적은 경우도 바로잡혀요).
  if (stored && stored.from < windowStart && stored.days > local.days) return stored;
  return local;
}

/** 시작일부터 오늘까지 며칠째인지 (시작일 = 1일째) */
export function challengeDay(start: string, today: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000)) + 1;
}
