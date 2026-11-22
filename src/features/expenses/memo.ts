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

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
// 겹받침·겹모음은 낱자로 풀어서 비교 (쿺 → ㅋㅜㅍ, 닭 → ㄷㅏㄹㄱ)
const SPLIT: Record<string, string> = { "ㄳ":"ㄱㅅ","ㄵ":"ㄴㅈ","ㄶ":"ㄴㅎ","ㄺ":"ㄹㄱ","ㄻ":"ㄹㅁ","ㄼ":"ㄹㅂ","ㄽ":"ㄹㅅ","ㄾ":"ㄹㅌ","ㄿ":"ㄹㅍ","ㅀ":"ㄹㅎ","ㅄ":"ㅂㅅ",
  "ㅘ":"ㅗㅏ","ㅙ":"ㅗㅐ","ㅚ":"ㅗㅣ","ㅝ":"ㅜㅓ","ㅞ":"ㅜㅔ","ㅟ":"ㅜㅣ","ㅢ":"ㅡㅣ" };

/** 한글을 낱자로 풀어요. 쿠팡 → ㅋㅜㅍㅏㅇ */
export function toJamo(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase().replace(/\s+/g, "")) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
    } else out += ch;
  }
  return [...out].map((j) => SPLIT[j] || j).join("");
}
const choseong = (text: string) => [...text.replace(/\s+/g, "")].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch.toLowerCase(); }).join("");

/** 0: 안 맞음, 3: 앞부분 일치, 2: 초성 일치(ㅋㅍ), 1: 중간 포함 */
export function matchScore(target: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = target.toLowerCase();
  const tj = toJamo(t), qj = toJamo(q);
  if (tj.startsWith(qj)) return 3;
  if (/^[ㄱ-ㅎ\s]+$/.test(q) && choseong(t).startsWith(q.replace(/\s+/g, ""))) return 2;
  if (tj.includes(qj)) return 1;
  return 0;
}

/** 두 번 이상 쓴 곳만 추천해요. 입력이 비었으면 자주 쓴 곳, 있으면 글자가 맞는 곳(쿠 → 쿠팡, ㅋㅍ → 쿠팡) */
export function suggestMemos(index: MemoSuggestion[], query: string, limit = 6): MemoSuggestion[] {
  const q = query.trim().toLowerCase();
  const repeat = index.filter((e) => e.total >= 2);
  if (!q) return [...repeat].sort((a, b) => b.total - a.total || b.last - a.last).slice(0, limit);
  return repeat
    .filter((e) => e.memo.toLowerCase() !== q)
    .map((e) => ({ e, score: matchScore(e.memo, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.total - a.e.total || b.e.last - a.e.last)
    .map((x) => x.e)
    .slice(0, limit);
}

/**
 * 품목 추천: 같은 가게에서 샀던 품목을 최근순으로 (가게를 안 적었으면 전체에서 자주 산 순)
 * 입력 중이면 그 글자가 들어간 것만
 */
export function suggestItems(txs: Iterable<Transaction>, store: string, query: string, limit = 5): string[] {
  const s = store.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  const stats = new Map<string, { text: string; count: number; last: number }>();
  for (const t of txs) {
    const items = String(t.items || "").trim();
    if (!items) continue;
    if (s && String(t.memo || "").trim().toLowerCase() !== s) continue;
    const k = items.toLowerCase();
    if (q && (!k.includes(q) || k === q)) continue;
    const e = stats.get(k) || { text: items, count: 0, last: 0 };
    e.count += 1;
    const at = Number(t.createdAt) || 0;
    if (at >= e.last) { e.last = at; e.text = items; }
    stats.set(k, e);
  }
  const list = [...stats.values()];
  list.sort(s ? (a, b) => b.last - a.last || b.count - a.count : (a, b) => b.count - a.count || b.last - a.last);
  return list.slice(0, limit).map((e) => e.text);
}
