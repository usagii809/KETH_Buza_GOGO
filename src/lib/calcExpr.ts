// 금액 칸 계산: "12000+3500", "48,000/2", "3*4500-1000" (곱셈·나눗셈 먼저)
const OPS = /[+\-*/×÷]/;

/** 식이 들어 있는지 (숫자만이면 false) */
export const hasOperator = (text: string) => OPS.test(text.replace(/^-/, ""));

/** 계산 결과 (원 단위로 반올림). 식이 아직 덜 됐거나 틀리면 null */
export function evalAmount(text: string): number | null {
  const src = text.replace(/[,\s원]/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  if (!src || !/^[\d+\-*/.]+$/.test(src)) return null;
  const tokens = src.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join("") !== src) return null;
  // 숫자 · 연산자 · 숫자 … 순서여야 해요
  const nums: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 0) {
      if (!/^\d/.test(t)) return null;
      nums.push(Number(t));
    } else {
      if (!/^[+\-*/]$/.test(t)) return null;
      ops.push(t);
    }
  }
  if (nums.length !== ops.length + 1) return null;
  // 곱셈·나눗셈 먼저
  const n2 = [nums[0]];
  const o2: string[] = [];
  ops.forEach((op, i) => {
    const b = nums[i + 1];
    if (op === "*") n2[n2.length - 1] *= b;
    else if (op === "/") n2[n2.length - 1] = b === 0 ? NaN : n2[n2.length - 1] / b;
    else { o2.push(op); n2.push(b); }
  });
  let total = n2[0];
  o2.forEach((op, i) => { total = op === "+" ? total + n2[i + 1] : total - n2[i + 1]; });
  return Number.isFinite(total) ? Math.round(total) : null;
}

/** 입력한 식을 보기 좋게: 숫자마다 천 단위 콤마, 연산자는 + − × ÷ */
export function formatExpr(text: string): string {
  return text
    .replace(/[,\s]/g, "")
    .replace(/\*/g, "×").replace(/\//g, "÷")
    .replace(/\d+/g, (n) => Number(n).toLocaleString("ko-KR"))
    .replace(/-/g, "−");
}
