import { describe, expect, it } from "vitest";
import { buildRefundIndex, refundableOf, refundCandidates, refundStatus } from "../features/expenses/refunds";
import type { Transaction } from "./types";

const tx = (id: string, date: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, date, yearMonth: date.slice(0, 7), category: "foodIngredients", amount, memo: "쿠팡 원두", spender: "태형", ...extra });

// 쿠팡 원두를 여러 번 사고, 그중 두 건을 환불
const list = [
  tx("a", "2026-11-24", 10000),
  tx("b", "2026-11-17", 10000),
  tx("c", "2026-11-10", 10000),
  tx("r1", "2026-11-20", -10000, { refundOf: "b" }),
  tx("r2", "2026-11-12", -4000, { refundOf: "c" }),
  tx("x", "2026-11-05", 3000, { memo: "쿠팡 휴지" }),
  tx("free", "2026-11-06", -2000) // 연결 안 한 환불
];

describe("환불 연결", () => {
  const index = buildRefundIndex(list, [list[0]]); // 같은 기록이 두 번 들어와도 한 번만
  it("결제별 환불 합계와 상태", () => {
    expect(index.totals.get("b")).toBe(10000);
    expect(index.totals.get("c")).toBe(4000);
    expect(refundStatus(list[1], index)).toEqual({ refunded: 10000, remaining: 0, full: true });
    expect(refundStatus(list[2], index)).toEqual({ refunded: 4000, remaining: 6000, full: false });
    expect(refundStatus(list[0], index)).toBeNull();
    expect(refundStatus(list[3], index)).toBeNull(); // 환불 자체엔 표시 안 해요
  });
  it("더 환불할 수 있는 금액 (고치고 있는 환불은 빼고)", () => {
    expect(refundableOf(list[2], index)).toBe(6000);
    expect(refundableOf(list[2], index, "r2")).toBe(10000);
    expect(refundableOf(list[1], index)).toBe(0);
  });
  it("후보: 같은 사용처 결제만, 최신순, 남은 금액과 함께", () => {
    const c = refundCandidates(" 쿠팡원두 ", index.byId.values(), index);
    expect(c.map((x) => [x.tx.id, x.remaining])).toEqual([["a", 10000], ["b", 0], ["c", 6000]]);
    expect(refundCandidates("", index.byId.values(), index)).toEqual([]);
    expect(refundCandidates("쿠팡 원두", index.byId.values(), index, 2)).toHaveLength(2);
  });
});
