import { shiftMonth } from "../../lib/dates";
import type { Transaction } from "../../lib/types";

export interface MonthBar {
  ym: string;
  m: number;
  total: number;
  /** 아직 진행 중인 달 (평균에서 제외) */
  inProgress: boolean;
  hasData: boolean;
}

/** 보고 있는 달까지 최근 n개월 막대. 보고 있는 달은 실시간 내역(currentTxs)을 씀 */
export function buildMonthBars(ym: string, n: number, pastTxs: Transaction[], currentTxs: Transaction[], todayYm: string): MonthBar[] {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(ym, i - (n - 1)));
  const totals = new Map<string, { total: number; count: number }>();
  const add = (tx: Transaction) => {
    const key = String(tx.date || "").slice(0, 7);
    const t = totals.get(key) || { total: 0, count: 0 };
    t.total += Number(tx.amount) || 0;
    t.count += 1;
    totals.set(key, t);
  };
  pastTxs.filter((tx) => !String(tx.date).startsWith(ym)).forEach(add);
  currentTxs.forEach(add);
  return months.map((key) => {
    const t = totals.get(key);
    return { ym: key, m: Number(key.slice(5)), total: t?.total || 0, inProgress: key >= todayYm, hasData: !!t?.count };
  });
}

/** 끝난 달 중 기록이 있는 달의 평균 (없으면 null) */
export function averageOf(bars: MonthBar[]): number | null {
  const done = bars.filter((b) => b.hasData && !b.inProgress);
  if (!done.length) return null;
  return Math.round(done.reduce((s, b) => s + b.total, 0) / done.length);
}
