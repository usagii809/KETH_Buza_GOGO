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

// ── 세분화 보기: 일별 · 주별 ──
export interface Bar {
  key: string;
  /** 막대 아래 글자 */
  label: string;
  /** 눌렀을 때 자세히 */
  title: string;
  total: number;
  count: number;
  /** 아직 진행 중 (오늘 · 이번 주) */
  inProgress: boolean;
  /** 아직 오지 않은 날 */
  future: boolean;
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

function totalsByDate(txs: Transaction[]) {
  const m = new Map<string, { total: number; count: number }>();
  for (const tx of txs) {
    const t = m.get(tx.date) || { total: 0, count: 0 };
    t.total += Number(tx.amount) || 0;
    t.count += 1;
    m.set(tx.date, t);
  }
  return m;
}

/** 보고 있는 달의 날짜별 막대 */
export function buildDayBars(ym: string, txs: Transaction[], today: string): Bar[] {
  const [y, mo] = ym.split("-").map(Number);
  const dim = new Date(y, mo, 0).getDate();
  const totals = totalsByDate(txs);
  return Array.from({ length: dim }, (_, i) => {
    const key = `${ym}-${pad(i + 1)}`;
    const t = totals.get(key);
    const wd = WD[new Date(y, mo - 1, i + 1).getDay()];
    return { key, label: String(i + 1), title: `${mo}월 ${i + 1}일 (${wd})`, total: t?.total || 0, count: t?.count || 0, inProgress: key === today, future: key > today };
  });
}

/** 보고 있는 달의 주별 막대 (월요일 시작, 달 밖의 날은 빼요) */
export function buildWeekBars(ym: string, txs: Transaction[], today: string): Bar[] {
  const days = buildDayBars(ym, txs, today);
  const [y, mo] = ym.split("-").map(Number);
  const weeks: Bar[] = [];
  let cur: Bar[] = [];
  const flush = () => {
    if (!cur.length) return;
    const first = cur[0], last = cur[cur.length - 1];
    const n = weeks.length + 1;
    weeks.push({
      key: `${ym}-w${n}`,
      label: `${n}주`,
      title: `${mo}월 ${n}주차 (${first.label}~${last.label}일)`,
      total: cur.reduce((s, d) => s + d.total, 0),
      count: cur.reduce((s, d) => s + d.count, 0),
      inProgress: cur.some((d) => d.inProgress) || (cur.some((d) => d.future) && !cur.every((d) => d.future)),
      future: cur.every((d) => d.future)
    });
    cur = [];
  };
  days.forEach((d, i) => {
    if (i > 0 && new Date(y, mo - 1, i + 1).getDay() === 1) flush(); // 월요일마다 새 주
    cur.push(d);
  });
  flush();
  return weeks;
}

/** 월별 막대를 같은 모양으로 */
export const monthToBar = (b: MonthBar): Bar => ({
  key: b.ym,
  label: `${b.m}월`,
  title: `${Number(b.ym.slice(0, 4))}년 ${b.m}월`,
  total: b.total,
  count: b.hasData ? 1 : 0,
  inProgress: b.inProgress,
  future: false
});
