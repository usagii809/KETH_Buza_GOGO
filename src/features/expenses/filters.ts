import { CATEGORY_MAP, normalizeCategory, normalizeSpender, type GroupKey } from "../../lib/categories";
import type { Transaction } from "../../lib/types";

export type FilterKey = "ALL" | "태형" | "경은" | "공동" | "COMPANY" | GroupKey | "AUTO";

export const FILTERS: [FilterKey, string][] = [
  ["ALL", "전체"],
  ["태형", "태형"],
  ["경은", "경은"],
  ["공동", "공동"],
  ["COMPANY", "🏢 회사 돈"],
  ["FOOD", "🍽️ 식비"],
  ["LIVING", "🚌 생활"],
  ["ESSENTIALS", "🧻 생필품·의류"],
  ["AUTO", "🔁 자동 기록"]
];

/** 필터 + 검색어(사용처·품목·카테고리)로 거르기 */
export function matchTx(tx: Transaction, key: FilterKey, query = ""): boolean {
  const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
  let ok: boolean;
  switch (key) {
    case "ALL": ok = true; break;
    case "태형": case "경은": case "공동": ok = normalizeSpender(tx.spender) === key; break;
    case "COMPANY": ok = !!tx.company; break;
    case "AUTO": ok = !!tx.auto; break;
    // 카테고리 묶음은 가계부 지출만 (회사 돈 점심은 식비에 안 섞이게)
    default: ok = !tx.company && cat.group === key;
  }
  if (!ok) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${tx.memo || ""} ${tx.items || ""} ${cat.label}`.toLowerCase().includes(q);
}
