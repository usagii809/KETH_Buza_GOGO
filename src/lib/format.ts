/** 1,330,000원 */
export function formatKRW(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  return `${num.toLocaleString("ko-KR")}원`;
}

/** 문장 속 금액은 짧게: 12,300 → "1만 2,300원", 500,000 → "50만원" */
export function formatShort(amount: number): string {
  const n = Math.round(Math.abs(Number(amount) || 0));
  const sign = Number(amount) < 0 ? "-" : "";
  if (n < 10000) return `${sign}${n.toLocaleString("ko-KR")}원`;
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  return `${sign}${man.toLocaleString("ko-KR")}만${rest ? " " + rest.toLocaleString("ko-KR") : ""}원`;
}

/** 달력 칸처럼 좁은 곳: 4,500 → "4,500", 32,000 → "3.2만", 200,000 → "20만" */
export function compactKRW(n: number): string {
  if (n < 10000) return n.toLocaleString("ko-KR");
  const v = n / 10000;
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}만`;
}

/** "1,234원" 같은 입력에서 숫자만 */
export function parseAmount(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const digits = String(val).replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** 입력칸 표시용: 0이면 빈칸 */
export function formatAmountInput(num: number): string {
  const n = Number(num) || 0;
  return n > 0 ? n.toLocaleString("ko-KR") : "";
}

export const floor100 = (n: number) => Math.floor(Math.max(0, n) / 100) * 100;
