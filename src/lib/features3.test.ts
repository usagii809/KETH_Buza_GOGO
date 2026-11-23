import { afterEach, describe, expect, it, vi } from "vitest";

// db.ts를 불러올 때 진짜 Firebase에 연결하지 않게
vi.mock("./firebase", () => ({ db: {}, auth: {}, app: {} }));

import { localFirst, parseBackup } from "../data/db";
import { computeSummary } from "../features/budget/calc";
import { buildMemoIndex } from "../features/expenses/memo";
import { countNoSpendDays, spentByDate } from "../features/noSpend/calc";
import { parseAmountQuery, searchTxs, summarizeSearch, yearsOf } from "../features/search/calc";
import { buildYearReport } from "../features/yearly/calc";
import {
  applyCategoryConfig, budgetOf, CATEGORIES, CATEGORY_MAP, getCategoryVersion, isHiddenCategory, normalizeBudget,
  normalizeCategory, variableBudgetOf, visibleCategories, ZERO_BUDGET
} from "./categories";
import { getPeriodInfo } from "./dates";
import { isRefund, type LotteryTicket, type Transaction } from "./types";

let seq = 0;
const tx = (date: string, category: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `g${seq++}`, date, yearMonth: date.slice(0, 7), category, amount, ...extra });

afterEach(() => applyCategoryConfig({}));

describe("환불 · 부분취소", () => {
  it("환불은 그 달 지출과 카테고리에서 빠져요", () => {
    const nov = getPeriodInfo("2026-11", new Date(2026, 10, 30));
    const list = [tx("2026-11-03", "essentialClothing", 100000), tx("2026-11-10", "essentialClothing", -30000, { refundOf: "x" })];
    const s = computeSummary({ ...ZERO_BUDGET, essentialClothing: 200000 }, list, nov);
    expect(s.usage.essentialClothing).toBe(70000);
    expect(s.totalVariableSpent).toBe(70000);
    expect(isRefund(list[1])).toBe(true);
    expect(isRefund(list[0])).toBe(false);
  });

  it("환불만 있는 날은 무지출, 결제가 있는 날은 환불이 있어도 지출한 날", () => {
    const list = [
      tx("2026-11-02", "foodDining", -20000),
      tx("2026-11-03", "foodDining", 10000), tx("2026-11-03", "foodDining", -50000)
    ];
    const map = spentByDate(list);
    expect(map["2026-11-02"]).toBeUndefined();
    expect(map["2026-11-03"]).toBe(10000);
    const nov = getPeriodInfo("2026-11", new Date(2026, 10, 3));
    expect(countNoSpendDays(nov, map, "2026-11-03", "2026-11-01")).toBe(2);
  });

  it("환불은 사용처 추천 횟수에 안 들어가요", () => {
    const idx = buildMemoIndex([tx("2026-11-01", "foodDining", 1000, { memo: "쿠팡" }), tx("2026-11-02", "foodDining", -1000, { memo: "쿠팡" })]);
    expect(idx[0].total).toBe(1);
  });
});

describe("카테고리 직접 추가", () => {
  it("추가한 항목이 계산 · 예산에 들어가고, 숨긴 항목은 입력 화면에서만 빠져요", () => {
    const v = getCategoryVersion();
    applyCategoryConfig({ custom: [{ key: "c_pet01", label: "반려동물", group: "LIVING", emoji: "🐶" }], hidden: ["essentialClothing"] });
    expect(getCategoryVersion()).toBe(v + 1);
    expect(CATEGORY_MAP.c_pet01).toMatchObject({ label: "🐶 반려동물", short: "반려동물", group: "LIVING", paced: true, custom: true });
    expect(normalizeCategory("c_pet01")).toBe("c_pet01");
    expect(isHiddenCategory("essentialClothing")).toBe(true);
    expect(visibleCategories().some((c) => c.key === "essentialClothing")).toBe(false);
    expect(CATEGORIES.some((c) => c.key === "essentialClothing")).toBe(true);

    const budget = normalizeBudget({ foodIngredients: 100000, c_pet01: 50000 });
    expect(budgetOf(budget, "c_pet01")).toBe(50000);
    expect(variableBudgetOf(budget)).toBe(150000);
    const nov = getPeriodInfo("2026-11", new Date(2026, 10, 30));
    const s = computeSummary(budget, [tx("2026-11-05", "c_pet01", 30000)], nov);
    expect(s.usage.c_pet01).toBe(30000);
  });

  it("잘못된 키 · 빈 이름 · 중복은 건너뛰고, 기타 생활비는 숨길 수 없어요", () => {
    applyCategoryConfig({
      custom: [
        { key: "bad key", label: "x", group: "FOOD" },
        { key: "c_aaa1", label: "  ", group: "FOOD" },
        { key: "c_bbb1", label: "선물", group: "NOPE" as never },
        { key: "c_bbb1", label: "선물2", group: "FOOD" }
      ],
      hidden: ["livingOther", "없는키"]
    });
    expect(CATEGORIES.filter((c) => c.custom).map((c) => c.key)).toEqual(["c_bbb1"]);
    expect(CATEGORY_MAP.c_bbb1.group).toBe("LIVING");
    expect(isHiddenCategory("livingOther")).toBe(false);
  });

  it("목록을 받기 전이어도 직접 추가한 항목 예산 값은 지켜요", () => {
    expect(normalizeBudget({ c_zzz9: 7000 }).c_zzz9).toBe(7000);
    expect(normalizeBudget(null)).toEqual(ZERO_BUDGET);
  });

  it("기본 항목도 이름 · 이모지 · 묶음을 바꿀 수 있고, 기록 키는 그대로예요", () => {
    applyCategoryConfig({ overrides: { foodCafe: { label: "커피", emoji: "☕" }, essentialClothing: { group: "LIVING", paced: true } } });
    expect(CATEGORY_MAP.foodCafe).toMatchObject({ key: "foodCafe", label: "☕ 커피", short: "커피", group: "FOOD" });
    expect(CATEGORY_MAP.essentialClothing).toMatchObject({ label: "의류비", group: "LIVING", paced: true });
    expect(normalizeCategory("foodCafe")).toBe("foodCafe");
    const nov = getPeriodInfo("2026-11", new Date(2026, 10, 30));
    expect(computeSummary(ZERO_BUDGET, [tx("2026-11-01", "foodCafe", 5000)], nov).usage.foodCafe).toBe(5000);
    // 설정을 비우면 원래대로
    applyCategoryConfig({});
    expect(CATEGORY_MAP.foodCafe).toMatchObject({ label: "카페 · 디저트", short: "카페·디저트" });
  });

  it("지운 항목의 기록은 기타 생활비로 보여요", () => {
    expect(normalizeCategory("c_gone1")).toBe("livingOther");
  });
});

describe("전체 기간 검색", () => {
  const all = [
    tx("2025-07-10", "livingOther", 120000, { memo: "에어컨 청소", spender: "태형" }),
    tx("2026-07-12", "livingOther", 130000, { memo: "에어컨 청소", spender: "경은" }),
    tx("2026-03-01", "essentialConsumables", 23900, { memo: "이마트", items: "휴지 30롤" }),
    tx("2026-03-05", "essentialConsumables", -23900, { memo: "이마트", items: "휴지 30롤" }),
    tx("2026-04-01", "foodDining", 12000, { memo: "쿠팡이츠", company: true, spender: "태형" })
  ];

  it("금액 검색어", () => {
    expect(parseAmountQuery("12,000원")).toBe(12000);
    expect(parseAmountQuery("1.2만")).toBe(12000);
    expect(parseAmountQuery("5천")).toBe(5000);
    expect(parseAmountQuery("쿠팡")).toBeNull();
  });

  it("사용처 · 초성 · 품목 · 금액 · 여러 낱말", () => {
    expect(searchTxs(all, "에어컨").map((t) => t.date)).toEqual(["2026-07-12", "2025-07-10"]);
    expect(searchTxs(all, "ㅇㅇㅋ")).toHaveLength(2);
    expect(searchTxs(all, "이마트 휴지")).toHaveLength(2);
    expect(searchTxs(all, "1.2만")).toHaveLength(1);
    expect(searchTxs(all, "에어컨", { year: "2025", spender: "ALL", kind: "ALL" })).toHaveLength(1);
    expect(searchTxs(all, "", { year: "ALL", spender: "ALL", kind: "REFUND" })).toHaveLength(1);
    expect(searchTxs(all, "", { year: "ALL", spender: "태형", kind: "COMPANY" })).toHaveLength(1);
  });

  it("합계는 환불을 빼고, 회사 돈은 따로", () => {
    const s = summarizeSearch(searchTxs(all, "이마트"));
    expect(s).toMatchObject({ count: 2, household: 0, refund: 23900, average: 23900 });
    const c = summarizeSearch(searchTxs(all, "쿠팡"));
    expect(c).toMatchObject({ household: 0, company: 12000 });
    expect(yearsOf(all)).toEqual(["2026", "2025"]);
  });
});

describe("연간 결산", () => {
  it("달별 · 카테고리 · 단골 · 저축 · 무지출 · 복권", () => {
    const budget = { ...ZERO_BUDGET, income: 3000000, fixedLoan: 1000000, foodIngredients: 500000 };
    const txs = [
      tx("2026-01-05", "foodIngredients", 400000, { memo: "이마트", spender: "경은" }),
      tx("2026-01-20", "foodIngredients", 50000, { memo: "이마트", spender: "경은" }),
      tx("2026-02-03", "foodIngredients", 700000, { memo: "코스트코", spender: "태형" }),
      tx("2026-02-10", "foodIngredients", -100000, { memo: "코스트코", spender: "태형" }),
      tx("2026-03-02", "foodDining", 30000, { memo: "회사 점심", company: true }),
      tx("2025-12-31", "foodDining", 99999)
    ];
    const tickets = [
      { id: "1", uid: "u", date: "2026-01-02", symbols: [], tier: "jackpot", prize: "", revealed: true },
      { id: "2", uid: "u", date: "2026-01-03", symbols: [], tier: "bomb", prize: "", revealed: true },
      { id: "3", uid: "u", date: "2026-01-04", symbols: [], tier: "jackpot", prize: "", revealed: false }
    ] as LotteryTicket[];
    const r = buildYearReport(2026, txs, () => budget, new Date(2026, 2, 10), "2026-01-01", tickets);
    expect(r.recordCount).toBe(5);
    expect(r.months[0].spent).toBe(450000);
    expect(r.months[1].spent).toBe(600000);
    expect(r.months[2].open).toBe(true);
    expect(r.total).toBe(1050000);
    expect(r.monthlyAverage).toBe(525000);
    expect(r.maxMonth?.m).toBe(2);
    expect(r.minMonth?.m).toBe(1);
    expect(r.budgetKept).toEqual({ kept: 1, of: 2 });
    // 1월: 300만 - 100만 - 45만 = 155만, 2월: 300만 - 100만 - 60만 = 140만
    expect(r.savings).toEqual({ saved: 2950000, planned: 3000000, months: 2 });
    expect(r.categories[0]).toMatchObject({ total: 1050000 });
    expect(r.places.map((p) => p.memo)).toEqual(["이마트"]);
    expect(r.biggest[0].amount).toBe(700000);
    expect(r.refund).toEqual({ count: 1, total: 100000 });
    expect(r.company).toEqual({ count: 1, total: 30000 });
    expect(r.lottery).toMatchObject({ jackpot: 1, bomb: 1, total: 2 });
    // 1/1 ~ 3/10 = 69일, 지출한 날 4일 (환불만 있는 날은 무지출)
    expect(r.noSpendOf).toBe(69);
    expect(r.noSpendDays).toBe(66);
  });

  it("기록이 없는 해", () => {
    const r = buildYearReport(2024, [], () => ZERO_BUDGET, new Date(2026, 0, 1));
    expect(r.recordCount).toBe(0);
    expect(r.monthlyAverage).toBeNull();
  });
});

describe("전체 백업 v4", () => {
  it("정산 · 복권 · 프로필 · 카테고리 · 무지출 기록과 환불까지 읽어요", () => {
    const p = parseBackup({
      version: 4,
      transactions: [{ id: "a", date: "2026-11-01", amount: 1000 }, { id: "b", date: "2026-11-02", amount: -500, refundOf: "a" }, { id: "c", date: "2026-11-02", amount: 0 }],
      settlements: { "2026-10": { at: 1, amount: 50000, goalId: "g" }, nope: { at: 1 } },
      lottery: [{ id: "2026-11-01_u", uid: "u", date: "2026-11-01", tier: "love" }, { id: "x" }],
      profiles: [{ id: "u", name: "태형" }],
      noSpendBest: { days: 5, from: "2026-11-01", to: "2026-11-05" },
      categories: { custom: [{ key: "c_pet01", label: "반려동물", group: "LIVING" }], hidden: [] }
    });
    expect(p.transactions.map((t) => t.id)).toEqual(["a", "b"]);
    expect(p.settlements).toEqual([["2026-10", { at: 1, amount: 50000, goalId: "g" }]]);
    expect(p.lottery).toHaveLength(1);
    expect(p.profiles).toHaveLength(1);
    expect(p.noSpendBest).toMatchObject({ days: 5 });
    expect(p.categories?.custom?.[0].key).toBe("c_pet01");
  });

  it("예전 백업(v3)도 그대로 읽어요", () => {
    const p = parseBackup({ version: 3, transactions: [{ id: "a", date: "2026-11-01", amount: 1000 }] });
    expect(p).toMatchObject({ settlements: [], lottery: [], profiles: [], noSpendBest: null, categories: null });
  });
});

describe("오프라인 저장", () => {
  it("서버 확인이 늦으면 폰에 저장된 것으로 보고 넘어가요", async () => {
    expect(await localFirst(Promise.resolve(), 50)).toBe("synced");
    expect(await localFirst(new Promise(() => {}), 20)).toBe("queued");
  });
});
