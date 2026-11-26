import { describe, expect, it } from "vitest";
import { evalAmount, formatExpr, hasOperator } from "./calcExpr";
import { budgetAlert } from "../features/budget/calc";
import { findDuplicate, frequentExpenses } from "../features/expenses/memo";
import type { Transaction } from "./types";

describe("금액 칸 계산", () => {
  it("더하기 · 빼기 · 곱하기 · 나누기 (곱셈·나눗셈 먼저)", () => {
    expect(evalAmount("12000+3500")).toBe(15500);
    expect(evalAmount("48,000/2")).toBe(24000);
    expect(evalAmount("3*4500-1000")).toBe(12500);
    expect(evalAmount("1000+2×3000")).toBe(7000);
    expect(evalAmount("10000÷3")).toBe(3333);
    expect(evalAmount("12,000")).toBe(12000);
  });
  it("덜 쓴 식 · 이상한 식은 null", () => {
    expect(evalAmount("12000+")).toBeNull();
    expect(evalAmount("+12000")).toBeNull();
    expect(evalAmount("12000/0")).toBeNull();
    expect(evalAmount("abc")).toBeNull();
    expect(evalAmount("")).toBeNull();
  });
  it("보기 좋게", () => {
    expect(formatExpr("12000+3500")).toBe("12,000+3,500");
    expect(formatExpr("48000/2*3-1")).toBe("48,000÷2×3−1");
    expect(hasOperator("12000")).toBe(false);
    expect(hasOperator("12000+")).toBe(true);
  });
});


const t = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, date, yearMonth: date.slice(0, 7), category: "foodCafe", amount, memo: "스타벅스", spender: "태형", createdAt: 1, ...extra });

describe("편의 기능", () => {
  it("자주 쓰는 지출: 똑같은 기록이 두 번 이상", () => {
    const list = [t("a", "2026-11-01", 4500), t("b", "2026-11-02", 4500, { createdAt: 5 }), t("c", "2026-11-03", 5000),
      t("d", "2026-11-03", 30000, { memo: "이마트", category: "foodIngredients", spender: "공동" }), t("e", "2026-11-09", 30000, { memo: "이마트", category: "foodIngredients", spender: "공동" }),
      t("f", "2026-11-04", 30000, { memo: "이마트", category: "foodIngredients", spender: "공동" }),
      t("g", "2026-11-05", 4500, { company: true }), t("h", "2026-11-06", 4500, { company: true }), t("i", "2026-11-07", -4500)];
    expect(frequentExpenses(list)).toEqual([
      { memo: "이마트", amount: 30000, category: "foodIngredients", spender: "공동", count: 3 },
      { memo: "스타벅스", amount: 4500, category: "foodCafe", spender: "태형", count: 2 }
    ]);
  });
  it("같은 날 · 같은 금액 기록 찾기 (가장 최근 것)", () => {
    const list = [t("a", "2026-11-01", 50000, { createdAt: 1 }), t("b", "2026-11-01", 50000, { createdAt: 9 }), t("c", "2026-11-02", 50000)];
    expect(findDuplicate(list, "2026-11-01", 50000)?.id).toBe("b");
    expect(findDuplicate(list, "2026-11-01", 50000, "b")?.id).toBe("a");
    expect(findDuplicate(list, "2026-11-01", 40000)).toBeNull();
  });
  it("예산 알림: 80% · 100%를 처음 넘을 때만", () => {
    expect(budgetAlert("외식·배달", 100000, 70000, 12000)).toBe("⚠️ 외식·배달 예산 82% 썼어요 (남은 돈 18,000원)");
    expect(budgetAlert("외식·배달", 100000, 85000, 5000)).toBeNull();
    expect(budgetAlert("외식·배달", 100000, 95000, 10000)).toBe("🚨 외식·배달 예산을 넘었어요 (105% · 5,000원 초과)");
    expect(budgetAlert("외식·배달", 100000, 110000, 1000)).toBeNull();
    expect(budgetAlert("외식·배달", 0, 0, 1000)).toBeNull();
  });
});
