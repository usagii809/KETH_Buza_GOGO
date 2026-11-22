import type { Spender } from "./types";

export const ZERO_BUDGET = {
  income: 0,
  fixedLoan: 0,
  fixedMaintenance: 0,
  fixedEvents: 0,
  foodIngredients: 0,
  foodDining: 0,
  foodCafe: 0,
  livingTelecom: 0,
  livingTransport: 0,
  livingOther: 0,
  essentialConsumables: 0,
  essentialClothing: 0
};
export type Budget = typeof ZERO_BUDGET;
export type BudgetKey = keyof Budget;
export const BUDGET_KEYS = Object.keys(ZERO_BUDGET) as BudgetKey[];

export type GroupKey = "FOOD" | "LIVING" | "ESSENTIALS";
export type CategoryKey =
  | "foodIngredients" | "foodDining" | "foodCafe"
  | "livingTelecom" | "livingTransport" | "livingOther"
  | "essentialConsumables" | "essentialClothing";

export interface Category {
  key: CategoryKey;
  label: string;
  short: string;
  group: GroupKey;
  /** true: 매일 조금씩 쓰는 항목(오늘 위치와 비교) / false: 한 번에 나가는 항목 */
  paced: boolean;
}

export const CATEGORIES: Category[] = [
  { key: "foodIngredients", label: "식재료비", short: "식재료", group: "FOOD", paced: true },
  { key: "foodDining", label: "외식 · 배달", short: "외식·배달", group: "FOOD", paced: true },
  { key: "foodCafe", label: "카페 · 디저트", short: "카페·디저트", group: "FOOD", paced: true },
  { key: "livingTelecom", label: "통신비", short: "통신비", group: "LIVING", paced: false },
  { key: "livingTransport", label: "교통비", short: "교통비", group: "LIVING", paced: true },
  { key: "livingOther", label: "기타 생활비", short: "기타 생활", group: "LIVING", paced: true },
  { key: "essentialConsumables", label: "정기 소모품 (세제·휴지·물 등)", short: "정기 소모품", group: "ESSENTIALS", paced: false },
  { key: "essentialClothing", label: "의류비", short: "의류", group: "ESSENTIALS", paced: false }
];

export const GROUPS: { key: GroupKey; label: string; shortLabel: string; badge: string; text: string }[] = [
  { key: "FOOD", label: "식비", shortLabel: "식비", badge: "bg-blue-50 text-toss-blue", text: "text-toss-blue" },
  { key: "LIVING", label: "생활", shortLabel: "생활", badge: "bg-gray-100 text-toss-sub", text: "text-toss-sub" },
  { key: "ESSENTIALS", label: "생필품 · 의류", shortLabel: "생필품", badge: "bg-amber-50 text-amber-700", text: "text-amber-700" }
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<CategoryKey, Category>;

export const FIXED_FIELDS: [BudgetKey, string][] = [
  ["fixedLoan", "대출금"],
  ["fixedMaintenance", "관리비"],
  ["fixedEvents", "경조사비"]
];

// 예전 키 하위 호환
const LEGACY_CATEGORY: Record<string, CategoryKey> = {
  miscLiving: "livingOther",
  misc_living: "livingOther",
  essentialReserve: "essentialClothing"
};

export function normalizeCategory(key: string | undefined): CategoryKey {
  const k = (key && LEGACY_CATEGORY[key]) || key || "";
  return k in CATEGORY_MAP ? (k as CategoryKey) : "livingOther";
}

export function normalizeSpender(s: string | undefined): Spender {
  if (s === "남편" || s === "태형") return "태형";
  if (s === "아내" || s === "경은") return "경은";
  return "공동";
}

export const SPENDERS: Spender[] = ["태형", "경은", "공동"];

export function normalizeBudget(raw: unknown): Budget {
  const normalized: Budget = { ...ZERO_BUDGET };
  if (!raw || typeof raw !== "object") return normalized;
  const r = raw as Record<string, unknown>;
  BUDGET_KEYS.forEach((k) => {
    if (r[k] !== undefined) normalized[k] = Number(r[k]) || 0;
  });
  const legacyMisc = Number(r.miscLiving ?? r.misc_living) || 0;
  if (r.livingOther === undefined && legacyMisc > 0) normalized.livingOther = legacyMisc;
  if (r.essentialClothing === undefined && r.essentialReserve !== undefined) {
    normalized.essentialClothing = Number(r.essentialReserve) || 0;
  }
  return normalized;
}

export const fixedTotalOf = (b: Budget) => b.fixedLoan + b.fixedMaintenance + b.fixedEvents;
export const variableBudgetOf = (b: Budget) => CATEGORIES.reduce((s, c) => s + b[c.key], 0);
export const plannedSavingsOf = (b: Budget) => b.income - fixedTotalOf(b) - variableBudgetOf(b);
