const pad = (n: number) => String(n).padStart(2, "0");

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = (now = new Date()) => toDateStr(now);

/** 다음 날 (YYYY-MM-DD) */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}
export const todayYm = (now = new Date()) => toDateStr(now).slice(0, 7);

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const dateInMonth = (ym: string, day: number) => `${ym}-${pad(Math.min(Math.max(1, day), daysInMonth(ym)))}`;

/** 매달 N일(31 = 말일)이 이 달에 해당하는 날짜 */
export const dueDateInMonth = (day: number, ym: string) => dateInMonth(ym, Number(day) || 1);

export interface PeriodInfo {
  key: string; // YYYY-MM
  y: number;
  m: number;
  dim: number;
  state: "past" | "current" | "future";
  /** 이번 달이면 오늘 날짜, 지난 달이면 말일, 다음 달이면 0 */
  day: number;
  /** 오늘 포함 남은 일수 */
  daysLeft: number;
  /** 이번 주 일요일까지 남은 일수 (오늘 포함) */
  weekLeft: number;
  /** 이번 달 경과율 (오늘 위치) */
  elapsedPct: number;
}

export function getPeriodInfo(ym: string, now = new Date()): PeriodInfo {
  const [y, m] = ym.split("-").map(Number);
  const dim = daysInMonth(ym);
  const curYm = todayYm(now);
  let state: PeriodInfo["state"];
  let day: number;
  if (ym < curYm) { state = "past"; day = dim; }
  else if (ym > curYm) { state = "future"; day = 0; }
  else { state = "current"; day = now.getDate(); }

  const daysLeft = state === "past" ? 0 : state === "future" ? dim : dim - day + 1;
  let weekLeft = 0;
  if (state === "current") {
    const dow = now.getDay();
    weekLeft = Math.min(dow === 0 ? 1 : 8 - dow, daysLeft);
  } else if (state === "future") {
    const firstDow = new Date(y, m - 1, 1).getDay();
    weekLeft = Math.min(firstDow === 0 ? 1 : 8 - firstDow, dim);
  }
  const elapsedPct = state === "past" ? 100 : state === "future" ? 0 : Math.round((day / dim) * 100);
  return { key: ym, y, m, dim, state, day, daysLeft, weekLeft, elapsedPct };
}

/** 보고 있는 달이 이번 달이 아니면 그 달의 같은 날짜(말일로 보정)를 기본값으로 */
export function defaultDateForMonth(ym: string, now = new Date()): string {
  if (ym === todayYm(now)) return todayStr(now);
  return dateInMonth(ym, now.getDate());
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
export function formatDateHeader(dateStr: string, now = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(`${dateStr}T00:00:00`);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
  if (dateStr === todayStr(now)) return `오늘 · ${base}`;
  if (dateStr === toDateStr(yesterday)) return `어제 · ${base}`;
  return base;
}
