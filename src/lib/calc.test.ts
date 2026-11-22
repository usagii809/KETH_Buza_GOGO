import { describe, expect, it } from "vitest";
import { computeAvailable, computeSummary, compareWithPrev } from "../features/budget/calc";
import { goalEta } from "../features/goals/calc";
import { buildMemoIndex, suggestMemos } from "../features/expenses/memo";
import { challengeDay, countNoSpendDays, noSpendStreak, spentByDate } from "../features/noSpend/calc";
import { buildReport } from "../features/report/calc";
import { normalizeBudget, normalizeCategory, normalizeSpender, ZERO_BUDGET } from "./categories";
import { dueDateInMonth, getPeriodInfo } from "./dates";
import { formatShort } from "./format";
import type { Transaction } from "./types";

// 스크린샷과 같은 예산 (수입 450만, 고정 202만, 변동 115만)
const budget = normalizeBudget({
  income: 4500000, fixedLoan: 1500000, fixedMaintenance: 300000, fixedEvents: 220000,
  foodIngredients: 650000, foodDining: 150000, foodCafe: 0,
  livingTelecom: 150000, livingTransport: 100000, livingOther: 100000,
  essentialConsumables: 0, essentialReserve: 0
});
const NOW = new Date(2026, 10, 22, 20, 0); // 2026-11-22 (일)
const nov = getPeriodInfo("2026-11", NOW);
let seq = 0;
const tx = (date: string, category: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${seq++}`, date, yearMonth: date.slice(0, 7), category, amount, ...extra });

describe("예상 저축액", () => {
  it("지출이 없으면 계획 저축액(133만)과 같다", () => {
    const s = computeSummary(budget, [], nov);
    expect(s.plannedSavings).toBe(1330000);
    expect(s.projectedSavings).toBe(1330000);
    expect(s.savingsRate.toFixed(1)).toBe("29.6");
    // 도넛 세 조각 합 = 월수입
    expect(s.projectedSavings + s.projectedVariable + s.fixedTotal).toBe(4500000);
  });

  it("예산을 넘긴 만큼만 줄어든다", () => {
    const s = computeSummary(budget, [tx("2026-11-22", "foodDining", 200000), tx("2026-11-21", "foodIngredients", 300000)], nov);
    expect(s.projectedSavings).toBe(1280000);
    expect(s.gap).toBe(-50000);
  });

  it("끝난 달은 실제 지출로 계산한다", () => {
    const oct = getPeriodInfo("2026-10", NOW);
    const s = computeSummary(budget, [tx("2026-10-05", "foodDining", 100000)], oct);
    expect(s.projectedSavings).toBe(4500000 - 2020000 - 100000);
  });
});

describe("가용 예산", () => {
  const s = computeSummary(budget, [tx("2026-11-22", "foodDining", 200000), tx("2026-11-21", "foodIngredients", 300000)], nov);
  it("하루: 매일 쓰는 항목 잔액 ÷ 남은 9일 (100원 단위 내림)", () => {
    const a = computeAvailable(budget, s, nov, "day");
    expect(nov.daysLeft).toBe(9);
    expect(a.variable).toBe(55500);
    expect(a.food).toBe(33300);
  });
  it("이번 주: 일요일이면 하루치와 같다", () => {
    expect(computeAvailable(budget, s, nov, "week").variable).toBe(55500);
  });
  it("이번 달: 전체 잔액", () => {
    expect(computeAvailable(budget, s, nov, "month").variable).toBe(650000);
  });
});

describe("지난달 비교", () => {
  it("이번 달은 같은 날짜까지만 비교", () => {
    const prev = [tx("2026-10-05", "foodDining", 100000), tx("2026-10-30", "foodDining", 999999)];
    const c = compareWithPrev(computeSummary(budget, [tx("2026-11-03", "foodDining", 50000)], nov).usage, prev, nov);
    expect(c?.diff).toBe(-50000);
    expect(c?.scope).toBe("지난달 이맘때");
  });
});

describe("무지출 챌린지", () => {
  const txs = [tx("2026-11-03", "foodCafe", 4500), tx("2026-11-15", "livingTelecom", 55000, { auto: true }), tx("2026-11-20", "foodCafe", 3000)];
  const map = spentByDate(txs);
  it("시작 전에는 0일 (기록이 없던 날을 무지출로 세지 않아요)", () => {
    expect(countNoSpendDays(nov, {}, "2026-11-22", null)).toBe(0);
    expect(noSpendStreak({}, NOW, "2026-11", null)).toBe(0);
  });
  it("시작일 이전 날짜는 세지 않아요", () => {
    expect(noSpendStreak({}, NOW, "2026-11", "2026-11-22")).toBe(1);
    expect(countNoSpendDays(nov, map, "2026-11-22", "2026-11-18")).toBe(4); // 18,19,21,22
  });
  it("자동 기록은 지출로 보지 않아요", () => {
    expect(countNoSpendDays(nov, map, "2026-11-22", "2026-11-01")).toBe(20);
  });
  it("연속 기록은 마지막 지출 다음 날부터", () => {
    expect(noSpendStreak(map, NOW, "2026-11", "2026-11-01")).toBe(2);
  });
  it("며칠째인지", () => {
    expect(challengeDay("2026-11-22", "2026-11-22")).toBe(1);
    expect(challengeDay("2026-11-01", "2026-11-22")).toBe(22);
  });
});

describe("성적표", () => {
  it("계획 이상 모으면 금메달", () => {
    const oct = getPeriodInfo("2026-10", NOW);
    const txs = [tx("2026-10-12", "foodIngredients", 250000, { spender: "남편" })];
    const r = buildReport(oct, computeSummary(budget, txs, oct), txs, [], NOW);
    expect(r.emoji).toBe("🥇");
    expect(r.rows.find((x) => x.label === "누가 얼마나")?.value).toBe("태형 25만원");
  });
});

describe("저축 목표", () => {
  it("기록이 짧으면 계획 저축액 기준", () => {
    expect(goalEta({ id: "g", name: "여행", emoji: "🏝️", target: 5000000, saved: 1000000 }, 1000000, NOW)).toBe("매달 100만원씩 모으면 4개월 걸려요");
  });
  it("달성하면 문구 없음", () => {
    expect(goalEta({ id: "g", name: "여행", emoji: "🏝️", target: 100, saved: 100 }, 1, NOW)).toBe("");
  });
});

describe("자동완성", () => {
  it("앞부분 일치를 먼저, 가장 많이 쓴 카테고리로", () => {
    const idx = buildMemoIndex([
      tx("2026-10-01", "foodIngredients", 1, { memo: "이마트" }),
      tx("2026-10-02", "foodIngredients", 1, { memo: "이마트" }),
      tx("2026-10-03", "livingOther", 1, { memo: "이마트" }),
      tx("2026-10-04", "foodIngredients", 1, { memo: "홈플러스 이마" })
    ]);
    const s = suggestMemos(idx, "이마");
    expect(s[0]).toMatchObject({ memo: "이마트", category: "foodIngredients" });
    expect(s).toHaveLength(2);
  });
});

describe("기타", () => {
  it("예전 데이터 키 호환", () => {
    expect(normalizeCategory("essentialReserve")).toBe("essentialClothing");
    expect(normalizeCategory("miscLiving")).toBe("livingOther");
    expect(normalizeSpender("아내")).toBe("경은");
    expect(normalizeBudget({ essentialReserve: 30000 }).essentialClothing).toBe(30000);
    expect(normalizeBudget(null)).toEqual(ZERO_BUDGET);
  });
  it("말일 처리", () => {
    expect(dueDateInMonth(31, "2026-02")).toBe("2026-02-28");
  });
  it("짧은 금액 표기", () => {
    expect(formatShort(12300)).toBe("1만 2,300원");
    expect(formatShort(500000)).toBe("50만원");
    expect(formatShort(-50000)).toBe("-5만원");
  });
});

import { averageOf, buildMonthBars } from "../features/trend/calc";
import { getSpendTier, pickQuip, TIERS } from "../features/quips/quips";

describe("월별 지출 그래프", () => {
  it("보고 있는 달까지 6개월, 진행 중인 달은 평균에서 빼요", () => {
    const past = [tx("2026-09-10", "foodDining", 300000), tx("2026-10-05", "foodDining", 100000)];
    const bars = buildMonthBars("2026-11", 6, past, [tx("2026-11-03", "foodCafe", 5000)], "2026-11");
    expect(bars.map((b) => b.m)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(bars[5]).toMatchObject({ total: 5000, inProgress: true });
    expect(averageOf(bars)).toBe(200000);
  });
});

describe("오늘의 한마디", () => {
  // 한 달 변동지출 예산 115만 원 기준
  const tier = (spent: number, p = nov) => getSpendTier(computeSummary(budget, spent ? [tx("2026-11-01", "foodDining", spent)] : [], p), p);
  it("예산 사용률 10% 단위로 단계를 정해요", () => {
    expect(tier(0)).toBe(0);            // 재벌
    expect(tier(114999)).toBe(0);       // 10% 미만
    expect(tier(115000)).toBe(1);       // 10% → 건물주
    expect(tier(575000)).toBe(5);       // 50% → 평화
    expect(tier(1034999)).toBe(8);      // 90% 미만 → 비상
    expect(tier(1035000)).toBe(9);      // 90% → 텅장 (최악)
    expect(tier(2000000)).toBe(9);      // 예산 초과도 텅장
  });
  it("10단계, 단계마다 문구 1개 이상 (문구 개수는 자유롭게)", () => {
    expect(TIERS).toHaveLength(10);
    TIERS.forEach((t) => expect(t.quips.length).toBeGreaterThanOrEqual(1));
  });
  it("예산이 없으면 보여주지 않아요", () => {
    expect(getSpendTier(computeSummary(ZERO_BUDGET, [], nov), nov)).toBeNull();
  });
  it("같은 날엔 같은 문구, 탭하면 다른 문구", () => {
    const a = pickQuip(0, "2026-11|2026-11-22");
    expect(pickQuip(0, "2026-11|2026-11-22")).toBe(a);
    expect(pickQuip(0, "2026-11|2026-11-22", 1)).not.toBe(a);
    expect(TIERS[0].quips).toContain(a);
  });
});
