import { describe, expect, it, vi } from "vitest";
vi.mock("./firebase", () => ({ db: {}, auth: {}, app: {} }));
import { historyStart, summarizeMonth, summaryToTxs } from "../data/db";
import { buildMonthBars } from "../features/trend/calc";
import { buildInsights } from "../features/report/insights";
import { shiftMonth } from "./dates";
import { isHousehold, type Transaction } from "./types";

// 진짜 같은 기록 만들기: 환불 · 자동 기록 · 회사 돈 · 같은 날 여러 건 섞어서
function fakeMonths(endYm: string, months: number, seed = 7): Transaction[] {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const cats = ["foodIngredients", "foodDining", "foodCafe", "livingTransport", "livingOther", "livingTelecom"];
  const who = ["태형", "경은", "공동"];
  const out: Transaction[] = [];
  for (let m = 0; m < months; m++) {
    const ym = shiftMonth(endYm, -m);
    const n = 20 + Math.floor(rnd() * 40);
    for (let i = 0; i < n; i++) {
      const day = String(1 + Math.floor(rnd() * 28)).padStart(2, "0");
      const amount = Math.round(rnd() * 80000) * (rnd() < 0.08 ? -1 : 1);
      out.push({
        id: `${ym}_${i}`, date: `${ym}-${day}`, yearMonth: ym, category: cats[Math.floor(rnd() * cats.length)],
        spender: who[Math.floor(rnd() * 3)], amount, memo: `가게${i % 9}`,
        ...(rnd() < 0.1 ? { auto: true } : {}), ...(rnd() < 0.07 ? { company: true } : {}),
        createdBy: "u1", createdAt: i
      } as Transaction);
    }
  }
  return out;
}
const bySummary = (txs: Transaction[]) => {
  const yms = [...new Set(txs.map((t) => t.yearMonth))];
  return yms.flatMap((ym) => summaryToTxs(ym, summarizeMonth(txs.filter((t) => t.yearMonth === ym))));
};

describe("📦 달 요약으로 계산해도 결과가 똑같아요", () => {
  const ym = "2026-11";
  const all = fakeMonths(ym, 13);
  const cur = all.filter((t) => t.yearMonth === ym && isHousehold(t));
  const past = all.filter((t) => t.yearMonth !== ym).filter(isHousehold);
  const pastSum = bySummary(all.filter((t) => t.yearMonth !== ym));

  it("지출 흐름 그래프 (12개월 막대)", () => {
    const strip = (bars: ReturnType<typeof buildMonthBars>) => bars.map((b) => [b.ym, b.total, b.hasData]);
    expect(strip(buildMonthBars(ym, 12, pastSum, cur, ym))).toEqual(strip(buildMonthBars(ym, 12, past, cur, ym)));
  });
  it("카테고리 비교 (진행 중인 달: 같은 날짜까지 · 끝난 달: 전체)", () => {
    expect(buildInsights(ym, cur, pastSum, 17)).toEqual(buildInsights(ym, cur, past, 17));
    const pastYm = "2026-08";
    const curOld = all.filter((t) => t.yearMonth === pastYm && isHousehold(t));
    expect(buildInsights(pastYm, curOld, pastSum, null)).toEqual(buildInsights(pastYm, curOld, past, null));
  });
  it("회사 돈은 요약에 안 들어가요 · 금액 합계가 같아요", () => {
    const sum = (l: Transaction[]) => l.reduce((a, t) => a + (Number(t.amount) || 0), 0);
    expect(sum(pastSum)).toBe(sum(past));
    expect(pastSum.some((t) => (t as Transaction & { company?: boolean }).company)).toBe(false);
  });
});

describe("최근 기록 범위", () => {
  it("오늘로부터 120일 전이 속한 달의 1일부터 (달 단위로 딱 맞게)", () => {
    expect(historyStart(new Date("2026-11-27T10:00:00"))).toBe("2026-07-01");
    expect(historyStart(new Date("2026-12-01T10:00:00"))).toBe("2026-08-01");
    expect(historyStart(new Date("2027-01-15T10:00:00"))).toBe("2026-09-01");
  });
});
