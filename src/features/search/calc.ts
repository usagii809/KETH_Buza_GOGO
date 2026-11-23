import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import type { Transaction } from "../../lib/types";
import { matchScore } from "../expenses/memo";

export type SearchSpender = "ALL" | "태형" | "경은" | "공동";
export type SearchKind = "ALL" | "HOUSEHOLD" | "COMPANY" | "REFUND";

export interface SearchOptions {
  /** "ALL" 또는 "2026" */
  year: string;
  spender: SearchSpender;
  kind: SearchKind;
}

export const DEFAULT_SEARCH: SearchOptions = { year: "ALL", spender: "ALL", kind: "ALL" };

/**
 * 금액 검색어를 숫자로: "12000" "12,000원" "1.2만" "5천" → 12000 / 12000 / 12000 / 5000
 * 금액처럼 생기지 않았으면 null
 */
export function parseAmountQuery(token: string): number | null {
  const t = token.replace(/[,원\s]/g, "");
  const m = /^(\d+(?:\.\d+)?)(만|천)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "만" ? 10000 : m[2] === "천" ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** 검색어 한 낱말이 기록에 맞는지 (사용처 · 품목 · 카테고리 · 사람 · 금액, 초성 ㅋㅍ도 돼요) */
export function tokenMatches(tx: Transaction, token: string): boolean {
  const amount = parseAmountQuery(token);
  if (amount !== null && Math.abs(Number(tx.amount) || 0) === amount) return true;
  const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
  const fields = [tx.memo || "", tx.items || "", cat.label, cat.short, normalizeSpender(tx.spender)];
  if (tx.company) fields.push("회사 돈", "영업활동비");
  if ((Number(tx.amount) || 0) < 0) fields.push("환불", "취소");
  if (tx.auto) fields.push("자동");
  return fields.some((f) => f && matchScore(f, token) > 0);
}

/** 전체 기간 검색: 낱말이 여러 개면 모두 맞는 기록만 (최신순) */
export function searchTxs(txs: Transaction[], query: string, opts: SearchOptions = DEFAULT_SEARCH): Transaction[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return txs
    .filter((tx) => {
      if (!tx.date) return false;
      if (opts.year !== "ALL" && !tx.date.startsWith(opts.year)) return false;
      if (opts.spender !== "ALL" && normalizeSpender(tx.spender) !== opts.spender) return false;
      const refund = (Number(tx.amount) || 0) < 0;
      if (opts.kind === "HOUSEHOLD" && tx.company) return false;
      if (opts.kind === "COMPANY" && !tx.company) return false;
      if (opts.kind === "REFUND" && !refund) return false;
      return tokens.every((t) => tokenMatches(tx, t));
    })
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : (b.createdAt || 0) - (a.createdAt || 0)));
}

export interface SearchSummary {
  count: number;
  /** 가계부 지출 합계 (환불은 빼고, 회사 돈은 제외) */
  household: number;
  company: number;
  refund: number;
  /** 결제 1건 평균 (환불·회사 돈 제외) */
  average: number;
  first: string | null;
  last: string | null;
  /** 달별 묶음 (최신순) */
  months: { ym: string; count: number; total: number; items: Transaction[] }[];
  /** 기록이 있는 해 (최신순) */
  years: string[];
}

export function summarizeSearch(results: Transaction[]): SearchSummary {
  let household = 0, company = 0, refund = 0, payCount = 0, paySum = 0;
  const byMonth = new Map<string, { ym: string; count: number; total: number; items: Transaction[] }>();
  for (const tx of results) {
    const a = Number(tx.amount) || 0;
    if (tx.company) company += a;
    else {
      household += a;
      if (a < 0) refund += -a;
      else { payCount++; paySum += a; }
    }
    const ym = tx.date.slice(0, 7);
    const m = byMonth.get(ym) || { ym, count: 0, total: 0, items: [] };
    m.count++;
    if (!tx.company) m.total += a;
    m.items.push(tx);
    byMonth.set(ym, m);
  }
  const months = [...byMonth.values()].sort((a, b) => b.ym.localeCompare(a.ym));
  const dates = results.map((t) => t.date).sort();
  return {
    count: results.length,
    household,
    company,
    refund,
    average: payCount ? Math.round(paySum / payCount) : 0,
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    months,
    years: [...new Set(months.map((m) => m.ym.slice(0, 4)))]
  };
}

/** 검색 칩에 쓸 해 목록 (전체 기록 기준, 최신순) */
export const yearsOf = (txs: Transaction[]) => [...new Set(txs.map((t) => String(t.date || "").slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort().reverse();
