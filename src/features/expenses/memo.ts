import { normalizeCategory, type CategoryKey } from "../../lib/categories";
import type { Transaction } from "../../lib/types";

export interface MemoSuggestion {
  memo: string;
  category: CategoryKey;
  total: number;
  last: number;
}

/** 사용처별 최빈 카테고리·횟수 */
export function buildMemoIndex(txs: Iterable<Transaction>): MemoSuggestion[] {
  const idx = new Map<string, { memo: string; counts: Partial<Record<CategoryKey, number>>; total: number; last: number }>();
  for (const t of txs) {
    const memo = String(t.memo || "").trim();
    if (!memo) continue;
    const k = memo.toLowerCase();
    const e = idx.get(k) || { memo, counts: {}, total: 0, last: 0 };
    e.total += 1;
    const c = normalizeCategory(t.category);
    e.counts[c] = (e.counts[c] || 0) + 1;
    const at = Number(t.createdAt) || 0;
    if (at >= e.last) { e.last = at; e.memo = memo; }
    idx.set(k, e);
  }
  return [...idx.values()].map((e) => ({
    memo: e.memo,
    total: e.total,
    last: e.last,
    category: (Object.entries(e.counts) as [CategoryKey, number][]).sort((a, b) => b[1] - a[1])[0][0]
  }));
}

/** 입력이 비었으면 자주 쓴 곳, 있으면 포함하는 곳(앞부분 일치 우선) */
export function suggestMemos(index: MemoSuggestion[], query: string, limit = 6): MemoSuggestion[] {
  const q = query.trim().toLowerCase();
  let list = [...index];
  if (q) {
    list = list.filter((e) => e.memo.toLowerCase().includes(q) && e.memo.toLowerCase() !== q);
    list.sort((a, b) =>
      Number(b.memo.toLowerCase().startsWith(q)) - Number(a.memo.toLowerCase().startsWith(q)) ||
      b.total - a.total || b.last - a.last);
  } else {
    list.sort((a, b) => b.total - a.total || b.last - a.last);
  }
  return list.slice(0, limit);
}
