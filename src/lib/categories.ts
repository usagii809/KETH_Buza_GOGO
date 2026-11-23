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
/** 기본 항목 + 직접 추가한 항목(c_로 시작하는 키)의 예산 */
export type Budget = typeof ZERO_BUDGET & { [key: string]: number };
export type BudgetKey = keyof typeof ZERO_BUDGET;
export const BUDGET_KEYS = Object.keys(ZERO_BUDGET) as BudgetKey[];

export type GroupKey = "FOOD" | "LIVING" | "ESSENTIALS";
/** 기본 항목 8개 */
export type BuiltinCategoryKey =
  | "foodIngredients" | "foodDining" | "foodCafe"
  | "livingTelecom" | "livingTransport" | "livingOther"
  | "essentialConsumables" | "essentialClothing";
/** 기본 항목 키 또는 직접 추가한 항목 키 (c_xxxx) */
export type CategoryKey = string;

export interface Category {
  key: CategoryKey;
  label: string;
  short: string;
  group: GroupKey;
  /** true: 매일 조금씩 쓰는 항목(오늘 위치와 비교) / false: 한 번에 나가는 항목 */
  paced: boolean;
  /** 직접 추가한 항목 */
  custom?: boolean;
  emoji?: string;
}

export const BUILTIN_CATEGORIES: readonly Category[] = [
  { key: "foodIngredients", label: "식재료비", short: "식재료", group: "FOOD", paced: true },
  { key: "foodDining", label: "외식 · 배달", short: "외식·배달", group: "FOOD", paced: true },
  { key: "foodCafe", label: "카페 · 디저트", short: "카페·디저트", group: "FOOD", paced: true },
  { key: "livingTelecom", label: "통신비", short: "통신비", group: "LIVING", paced: false },
  { key: "livingTransport", label: "교통비", short: "교통비", group: "LIVING", paced: true },
  { key: "livingOther", label: "기타 생활비", short: "기타 생활", group: "LIVING", paced: true },
  { key: "essentialConsumables", label: "정기 소모품 (세제·휴지·물 등)", short: "정기 소모품", group: "ESSENTIALS", paced: false },
  { key: "essentialClothing", label: "의류비", short: "의류", group: "ESSENTIALS", paced: false }
];

/**
 * 지금 쓰는 전체 항목 (기본 + 직접 추가, 숨긴 항목 포함).
 * 서버의 config/categories를 받으면 applyCategoryConfig가 이 배열을 그 자리에서 바꿔요.
 * 계산은 숨긴 항목도 포함해서 해요 (예전 기록이 사라지지 않게).
 */
export const CATEGORIES: Category[] = [...BUILTIN_CATEGORIES];

export const GROUPS: { key: GroupKey; label: string; shortLabel: string; badge: string; text: string }[] = [
  { key: "FOOD", label: "식비", shortLabel: "식비", badge: "bg-blue-50 text-toss-blue", text: "text-toss-blue" },
  { key: "LIVING", label: "생활", shortLabel: "생활", badge: "bg-gray-100 text-toss-sub", text: "text-toss-sub" },
  { key: "ESSENTIALS", label: "생필품 · 의류", shortLabel: "생필품", badge: "bg-amber-50 text-amber-700", text: "text-amber-700" }
];

export const CATEGORY_MAP: Record<CategoryKey, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

// ── 직접 추가한 항목 ──
/** 서버 config/categories 문서 모양 */
export interface CategoryConfig {
  custom?: { key: string; label: string; group: GroupKey; paced?: boolean; emoji?: string; createdAt?: number }[];
  /** 입력 화면에서 숨긴 항목 키 (기본 항목도 숨길 수 있어요) */
  hidden?: string[];
  /** 기본 항목을 고친 내용 (이름 · 이모지 · 묶음 · 쓰는 방식). 기록은 키로 이어져서 그대로예요 */
  overrides?: Record<string, CategoryOverride>;
}

export interface CategoryOverride {
  label?: string;
  emoji?: string;
  group?: GroupKey;
  paced?: boolean;
}

const BUILTIN_MAP: Record<string, Category> = Object.fromEntries(BUILTIN_CATEGORIES.map((c) => [c.key, c]));
/** 기본 항목의 원래 모습 (되돌리기 · '원래 이름' 표시용) */
export const builtinOriginal = (key: string): Category | undefined => BUILTIN_MAP[key];
export const isBuiltinKey = (key: string) => key in BUILTIN_MAP;

/** 기본 항목에 고친 내용을 입혀요 */
function withOverride(c: Category, o: CategoryOverride | undefined): Category {
  if (!o || typeof o !== "object") return c;
  const label = String(o.label || "").trim().slice(0, 20);
  const emoji = o.emoji ? String(o.emoji).slice(0, 4) : "";
  const short = label || c.short;
  return {
    ...c,
    // 이름만 바꾸면 이름 그대로, 이름을 안 바꾸고 이모지만 붙이면 원래 긴 이름 앞에
    label: emoji ? `${emoji} ${label || c.label}` : label || c.label,
    short,
    group: GROUP_KEYS.includes(o.group as GroupKey) ? (o.group as GroupKey) : c.group,
    paced: typeof o.paced === "boolean" ? o.paced : c.paced,
    ...(emoji ? { emoji } : {})
  };
}

const hiddenKeys = new Set<string>();
let categoryVersion = 0;
/** 항목 구성이 바뀔 때마다 1씩 올라가요 (화면 계산을 다시 하는 신호) */
export const getCategoryVersion = () => categoryVersion;

const GROUP_KEYS: GroupKey[] = ["FOOD", "LIVING", "ESSENTIALS"];
export const isCustomKey = (k: string) => /^c_[a-z0-9]{3,20}$/.test(k);

/** 서버에서 받은 항목 구성을 적용해요. 잘못된 값은 조용히 건너뛰어요 */
export function applyCategoryConfig(raw: unknown) {
  const cfg = (raw && typeof raw === "object" ? raw : {}) as CategoryConfig;
  const customs: Category[] = [];
  const seen = new Set<string>();
  (Array.isArray(cfg.custom) ? cfg.custom : []).forEach((c) => {
    if (!c || !isCustomKey(String(c.key)) || seen.has(c.key)) return;
    const label = String(c.label || "").trim().slice(0, 20);
    if (!label) return;
    seen.add(c.key);
    const emoji = c.emoji ? String(c.emoji).slice(0, 4) : undefined;
    customs.push({
      key: c.key,
      label: emoji ? `${emoji} ${label}` : label,
      short: label,
      group: GROUP_KEYS.includes(c.group) ? c.group : "LIVING",
      paced: c.paced !== false,
      custom: true,
      ...(emoji ? { emoji } : {})
    });
  });
  const overrides = cfg.overrides && typeof cfg.overrides === "object" ? cfg.overrides : {};
  CATEGORIES.splice(0, CATEGORIES.length, ...BUILTIN_CATEGORIES.map((c) => withOverride(c, overrides[c.key])), ...customs);
  Object.keys(CATEGORY_MAP).forEach((k) => delete CATEGORY_MAP[k]);
  CATEGORIES.forEach((c) => { CATEGORY_MAP[c.key] = c; });
  hiddenKeys.clear();
  (Array.isArray(cfg.hidden) ? cfg.hidden : []).forEach((k) => { if (k in CATEGORY_MAP && k !== FALLBACK_CATEGORY) hiddenKeys.add(k); });
  categoryVersion++;
}

/** 모르는 항목은 여기로 모여요 (숨길 수 없어요) */
export const FALLBACK_CATEGORY = "livingOther";
export const isHiddenCategory = (k: string) => hiddenKeys.has(k);
/** 입력 화면에 보여줄 항목 (숨긴 항목 제외) */
export const visibleCategories = () => CATEGORIES.filter((c) => !hiddenKeys.has(c.key));
/** 예산 값 읽기 (직접 추가한 항목은 값이 없을 수 있어요) */
export const budgetOf = (b: Budget, key: string) => Number(b[key]) || 0;
/** 새 항목 키 */
export const newCategoryKey = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const FIXED_FIELDS: [BudgetKey, string][] = [
  ["fixedLoan", "대출금"],
  ["fixedMaintenance", "관리비"],
  ["fixedEvents", "경조사비"]
];

// 예전 키 하위 호환
const LEGACY_CATEGORY: Record<string, BuiltinCategoryKey> = {
  miscLiving: "livingOther",
  misc_living: "livingOther",
  essentialReserve: "essentialClothing"
};

export function normalizeCategory(key: string | undefined): CategoryKey {
  const k = (key && LEGACY_CATEGORY[key]) || key || "";
  return k in CATEGORY_MAP ? k : FALLBACK_CATEGORY;
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
  // 직접 추가한 항목 예산 (항목 목록을 받기 전이어도 값은 지켜요)
  Object.keys(r).forEach((k) => { if (isCustomKey(k)) normalized[k] = Number(r[k]) || 0; });
  const legacyMisc = Number(r.miscLiving ?? r.misc_living) || 0;
  if (r.livingOther === undefined && legacyMisc > 0) normalized.livingOther = legacyMisc;
  if (r.essentialClothing === undefined && r.essentialReserve !== undefined) {
    normalized.essentialClothing = Number(r.essentialReserve) || 0;
  }
  return normalized;
}

export const fixedTotalOf = (b: Budget) => b.fixedLoan + b.fixedMaintenance + b.fixedEvents;
export const variableBudgetOf = (b: Budget) => CATEGORIES.reduce((s, c) => s + budgetOf(b, c.key), 0);
export const plannedSavingsOf = (b: Budget) => b.income - fixedTotalOf(b) - variableBudgetOf(b);
