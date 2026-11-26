// ↩️ 환불이 어느 결제의 것인지 연결하고, 두 번 빠지는 일을 막는 계산들
import type { Transaction } from "../../lib/types";

const amt = (t: Pick<Transaction, "amount">) => Number(t.amount) || 0;

export interface RefundIndex {
  /** 원래 결제 id → 연결된 환불 합계 (양수) */
  totals: Map<string, number>;
  /** 원래 결제 id → 연결된 환불 기록들 */
  refunds: Map<string, Transaction[]>;
  /** id → 기록 (원래 결제 날짜를 보여주려고) */
  byId: Map<string, Transaction>;
}

/** 여러 곳에서 불러온 기록을 합쳐 (같은 id는 한 번) 환불 연결을 정리해요 */
export function buildRefundIndex(...lists: Transaction[][]): RefundIndex {
  const byId = new Map<string, Transaction>();
  for (const list of lists) for (const t of list) byId.set(t.id, t);
  const totals = new Map<string, number>();
  const refunds = new Map<string, Transaction[]>();
  for (const t of byId.values()) {
    if (!t.refundOf || amt(t) >= 0) continue;
    totals.set(t.refundOf, (totals.get(t.refundOf) || 0) - amt(t));
    refunds.set(t.refundOf, [...(refunds.get(t.refundOf) || []), t]);
  }
  return { totals, refunds, byId };
}

/** 결제에 대한 환불 상태 (환불이 없으면 null) */
export function refundStatus(tx: Transaction, index: RefundIndex | undefined) {
  const refunded = index?.totals.get(tx.id) || 0;
  if (!refunded || amt(tx) <= 0) return null;
  const remaining = amt(tx) - refunded;
  return { refunded, remaining, full: remaining <= 0 };
}

/** 이 결제에 더 환불할 수 있는 금액 (지금 고치고 있는 환불은 빼고 계산) */
export function refundableOf(original: Transaction, index: RefundIndex | undefined, editingId?: string): number {
  const others = (index?.refunds.get(original.id) || []).filter((r) => r.id !== editingId);
  return amt(original) - others.reduce((s, r) => s - amt(r), 0);
}

const norm = (s?: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, "");

export interface RefundCandidate {
  tx: Transaction;
  remaining: number;
}

/** 환불을 연결할 후보: 같은 사용처의 결제 (최신순, 회사 돈·환불·자동 기록 제외) */
export function refundCandidates(memo: string, all: Iterable<Transaction>, index: RefundIndex | undefined, max = 5, editingId?: string): RefundCandidate[] {
  const key = norm(memo);
  if (!key) return [];
  return [...all]
    .filter((t) => amt(t) > 0 && !t.auto && norm(t.memo) === key)
    .sort((a, b) => `${b.date}${b.createdAt ?? 0}`.localeCompare(`${a.date}${a.createdAt ?? 0}`))
    .slice(0, max)
    .map((tx) => ({ tx, remaining: refundableOf(tx, index, editingId) }));
}
