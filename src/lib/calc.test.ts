import { describe, expect, it } from "vitest";
import { computeAvailable, computeSummary, compareWithPrev } from "../features/budget/calc";
import { goalEta } from "../features/goals/calc";
import { buildMemoIndex, suggestItems, suggestMemos } from "../features/expenses/memo";
import { challengeDay, countNoSpendDays, longestStreak, noSpendStreak, pickBest, spentByDate, sproutRuns } from "../features/noSpend/calc";
import { dateEgg, expenseEgg, inUnits, isOurDay, sproutEmoji, STAGES } from "../features/fun/eggs";
import { buildReport } from "../features/report/calc";
import { normalizeBudget, normalizeCategory, normalizeSpender, ZERO_BUDGET } from "./categories";
import { dueDateInMonth, getPeriodInfo } from "./dates";
import { formatShort } from "./format";
import { isHousehold, type Transaction } from "./types";
import { matchTx } from "../features/expenses/filters";
import { drawTicket, forcedNoSpendDays, LOSE_MESSAGE, LOVE_SYMBOL, PRIZE_TABLE, VISIBLE_PRIZES } from "../features/lottery/ticket";
import { nameForEmail, sha256Hex } from "./people";
import type { LotteryTicket } from "./types";

// 스크린샷과 같은 예산 (수입 450만, 고정 202만, 변동 115만)
const budget = normalizeBudget({
  income: 4500000, fixedLoan: 1500000, fixedMaintenance: 300000, fixedEvents: 220000,
  foodIngredients: 650000, foodDining: 150000, foodCafe: 0,
  livingTelecom: 150000, livingTransport: 100000, livingOther: 100000,
  essentialConsumables: 0, essentialReserve: 0
});
const NOW = new Date(2026, 10, 22, 20, 0); // 2026-11-22 (일)
const nov = getPeriodInfo("2026-11", NOW);
let seq = 0;
const tx = (date: string, category: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `t${seq++}`, date, yearMonth: date.slice(0, 7), category, amount, ...extra });

describe("예상 저축액", () => {
  it("지출이 없으면 계획 저축액(133만)과 같다", () => {
    const s = computeSummary(budget, [], nov);
    expect(s.plannedSavings).toBe(1330000);
    expect(s.projectedSavings).toBe(1330000);
    expect(s.savingsRate.toFixed(1)).toBe("29.6");
    // 도넛 세 조각 합 = 월수입
    expect(s.projectedSavings + s.projectedVariable + s.fixedTotal).toBe(4500000);
  });

  it("예산을 넘긴 만큼만 줄어든다", () => {
    const s = computeSummary(budget, [tx("2026-11-22", "foodDining", 200000), tx("2026-11-21", "foodIngredients", 300000)], nov);
    expect(s.projectedSavings).toBe(1280000);
    expect(s.gap).toBe(-50000);
  });

  it("끝난 달은 실제 지출로 계산한다", () => {
    const oct = getPeriodInfo("2026-10", NOW);
    const s = computeSummary(budget, [tx("2026-10-05", "foodDining", 100000)], oct);
    expect(s.projectedSavings).toBe(4500000 - 2020000 - 100000);
  });
});

describe("가용 예산", () => {
  const s = computeSummary(budget, [tx("2026-11-22", "foodDining", 200000), tx("2026-11-21", "foodIngredients", 300000)], nov);
  it("하루: 매일 쓰는 항목 잔액 ÷ 남은 9일 (100원 단위 내림)", () => {
    const a = computeAvailable(budget, s, nov, "day");
    expect(nov.daysLeft).toBe(9);
    expect(a.variable).toBe(55500);
    expect(a.food).toBe(33300);
  });
  it("이번 주: 일요일이면 하루치와 같다", () => {
    expect(computeAvailable(budget, s, nov, "week").variable).toBe(55500);
  });
  it("이번 달: 전체 잔액", () => {
    expect(computeAvailable(budget, s, nov, "month").variable).toBe(650000);
  });
});

describe("지난달 비교", () => {
  it("이번 달은 같은 날짜까지만 비교", () => {
    const prev = [tx("2026-10-05", "foodDining", 100000), tx("2026-10-30", "foodDining", 999999)];
    const c = compareWithPrev(computeSummary(budget, [tx("2026-11-03", "foodDining", 50000)], nov).usage, prev, nov);
    expect(c?.diff).toBe(-50000);
    expect(c?.scope).toBe("지난달 이맘때");
  });
});

describe("무지출 챌린지", () => {
  const txs = [tx("2026-11-03", "foodCafe", 4500), tx("2026-11-15", "livingTelecom", 55000, { auto: true }), tx("2026-11-20", "foodCafe", 3000)];
  const map = spentByDate(txs);
  it("새싹이 연속 일수만큼 자라요", () => {
    const runs = sproutRuns(nov, map, "2026-11-22", "2026-11-01");
    expect(runs["2026-11-01"]).toBe(1);
    expect(runs["2026-11-02"]).toBe(2);
    expect(runs["2026-11-03"]).toBeUndefined(); // 지출한 날
    expect(runs["2026-11-19"]).toBe(16);        // 4일~19일 (15일 자동 기록은 무지출)
    expect(sproutEmoji(1)).toBe("🌱");
    expect(STAGES.map((x) => x.emoji).join("")).toBe("🌱🌿🌷🌳🍎🏠🏢🌉");
    expect(sproutEmoji(2)).toBe("🌿");
    expect(sproutEmoji(7)).toBe("🏢");
    expect(sproutEmoji(8)).toBe("🌉");   // 8일째 한강뷰
    expect(sproutEmoji(40)).toBe("🌉");  // 그 뒤로도 한강뷰
  });
  it("지난달 끝에서 이어진 연속도 이어서 세요", () => {
    const runs = sproutRuns(nov, {}, "2026-11-02", "2026-10-29");
    expect(runs["2026-11-01"]).toBe(4); // 10/29, 30, 31, 11/1
  });
  it("시작 전에는 0일 (기록이 없던 날을 무지출로 세지 않아요)", () => {
    expect(countNoSpendDays(nov, {}, "2026-11-22", null)).toBe(0);
    expect(noSpendStreak({}, NOW, "2026-11", null)).toBe(0);
  });
  it("시작일 이전 날짜는 세지 않아요", () => {
    expect(noSpendStreak({}, NOW, "2026-11", "2026-11-22")).toBe(1);
    expect(countNoSpendDays(nov, map, "2026-11-22", "2026-11-18")).toBe(4); // 18,19,21,22
  });
  it("자동 기록은 지출로 보지 않아요", () => {
    expect(countNoSpendDays(nov, map, "2026-11-22", "2026-11-01")).toBe(20);
  });
  it("연속 기록은 마지막 지출 다음 날부터", () => {
    expect(noSpendStreak(map, NOW, "2026-11", "2026-11-01")).toBe(2);
  });
  it("며칠째인지", () => {
    expect(challengeDay("2026-11-22", "2026-11-22")).toBe(1);
    expect(challengeDay("2026-11-01", "2026-11-22")).toBe(22);
  });
});

describe("성적표", () => {
  it("계획 이상 모으면 금메달", () => {
    const oct = getPeriodInfo("2026-10", NOW);
    const txs = [tx("2026-10-12", "foodIngredients", 250000, { spender: "남편" })];
    const r = buildReport(oct, computeSummary(budget, txs, oct), txs, [], NOW);
    expect(r.emoji).toBe("🥇");
    expect(r.rows.find((x) => x.label === "누가 얼마나")?.value).toBe("태형 25만원");
  });
});

describe("저축 목표", () => {
  it("기록이 짧으면 계획 저축액 기준", () => {
    expect(goalEta({ id: "g", name: "여행", emoji: "🏝️", target: 5000000, saved: 1000000 }, 1000000, NOW)).toBe("매달 100만원씩 모으면 4개월 걸려요");
  });
  it("달성하면 문구 없음", () => {
    expect(goalEta({ id: "g", name: "여행", emoji: "🏝️", target: 100, saved: 100 }, 1, NOW)).toBe("");
  });
});

describe("자동완성", () => {
  it("앞부분 일치를 먼저, 가장 많이 쓴 카테고리로", () => {
    const idx = buildMemoIndex([
      tx("2026-10-01", "foodIngredients", 1, { memo: "이마트" }),
      tx("2026-10-02", "foodIngredients", 1, { memo: "이마트" }),
      tx("2026-10-03", "livingOther", 1, { memo: "이마트" }),
      tx("2026-10-04", "foodIngredients", 1, { memo: "홈플러스 이마" })
    ]);
    const s = suggestMemos(idx, "이마");
    expect(s[0]).toMatchObject({ memo: "이마트", category: "foodIngredients" });
    expect(s).toHaveLength(1); // 한 번만 쓴 "홈플러스 이마"는 빼요
  });
  it("두 번 이상 쓴 곳만, 쿠·쿺·ㅋㅍ로도 쿠팡을 찾아요", () => {
    const idx = buildMemoIndex([
      tx("2026-10-01", "foodIngredients", 1, { memo: "쿠팡" }),
      tx("2026-10-02", "foodIngredients", 1, { memo: "쿠팡" }),
      tx("2026-10-03", "foodCafe", 1, { memo: "스타벅스" }),
      tx("2026-10-04", "foodCafe", 1, { memo: "스타벅스" }),
      tx("2026-10-05", "livingOther", 1, { memo: "쿠키가게" })
    ]);
    expect(suggestMemos(idx, "").map((e) => e.memo).sort()).toEqual(["스타벅스", "쿠팡"]);
    for (const q of ["ㅋ", "쿠", "쿺", "쿠파", "ㅋㅍ"]) expect(suggestMemos(idx, q).map((e) => e.memo)).toEqual(["쿠팡"]);
    expect(suggestMemos(idx, "벅스").map((e) => e.memo)).toEqual(["스타벅스"]);
    expect(suggestMemos(idx, "쿠팡")).toEqual([]);
  });
});

describe("기타", () => {
  it("예전 데이터 키 호환", () => {
    expect(normalizeCategory("essentialReserve")).toBe("essentialClothing");
    expect(normalizeCategory("miscLiving")).toBe("livingOther");
    expect(normalizeSpender("아내")).toBe("경은");
    expect(normalizeBudget({ essentialReserve: 30000 }).essentialClothing).toBe(30000);
    expect(normalizeBudget(null)).toEqual(ZERO_BUDGET);
  });
  it("말일 처리", () => {
    expect(dueDateInMonth(31, "2026-02")).toBe("2026-02-28");
  });
  it("짧은 금액 표기", () => {
    expect(formatShort(12300)).toBe("1만 2,300원");
    expect(formatShort(500000)).toBe("50만원");
    expect(formatShort(-50000)).toBe("-5만원");
  });
});

import { averageOf, buildMonthBars } from "../features/trend/calc";
import { getSpendTier, pickQuip, TIERS } from "../features/quips/quips";

describe("월별 지출 그래프", () => {
  it("보고 있는 달까지 6개월, 진행 중인 달은 평균에서 빼요", () => {
    const past = [tx("2026-09-10", "foodDining", 300000), tx("2026-10-05", "foodDining", 100000)];
    const bars = buildMonthBars("2026-11", 6, past, [tx("2026-11-03", "foodCafe", 5000)], "2026-11");
    expect(bars.map((b) => b.m)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(bars[5]).toMatchObject({ total: 5000, inProgress: true });
    expect(averageOf(bars)).toBe(200000);
  });
});

describe("오늘의 한마디", () => {
  // 한 달 변동지출 예산 115만 원 기준
  const tier = (spent: number, p = nov) => getSpendTier(computeSummary(budget, spent ? [tx("2026-11-01", "foodDining", spent)] : [], p), p);
  it("예산 사용률 10% 단위로 단계를 정해요", () => {
    expect(tier(0)).toBe(0);            // 재벌
    expect(tier(114999)).toBe(0);       // 10% 미만
    expect(tier(115000)).toBe(1);       // 10% → 건물주
    expect(tier(575000)).toBe(5);       // 50% → 평화
    expect(tier(1034999)).toBe(8);      // 90% 미만 → 비상
    expect(tier(1035000)).toBe(9);      // 90% → 텅장 (최악)
    expect(tier(2000000)).toBe(9);      // 예산 초과도 텅장
  });
  it("10단계, 단계마다 문구 1개 이상 (문구 개수는 자유롭게)", () => {
    expect(TIERS).toHaveLength(10);
    TIERS.forEach((t) => expect(t.quips.length).toBeGreaterThanOrEqual(1));
  });
  it("예산이 없으면 보여주지 않아요", () => {
    expect(getSpendTier(computeSummary(ZERO_BUDGET, [], nov), nov)).toBeNull();
  });
  it("같은 날엔 같은 문구, 탭하면 다른 문구", () => {
    const a = pickQuip(0, "2026-11|2026-11-22");
    expect(pickQuip(0, "2026-11|2026-11-22")).toBe(a);
    expect(pickQuip(0, "2026-11|2026-11-22", 1)).not.toBe(a);
    expect(TIERS[0].quips).toContain(a);
  });
});

describe("품목 추천", () => {
  const h = [
    tx("2026-11-01", "essentialConsumables", 29800, { memo: "쿠팡", items: "휴지 30롤", createdAt: 1 }),
    tx("2026-11-05", "foodIngredients", 19100, { memo: "쿠팡", items: "우유, 계란", createdAt: 2 }),
    tx("2026-11-07", "foodIngredients", 45000, { memo: "이마트", items: "삼겹살", createdAt: 3 })
  ];
  it("같은 가게에서 샀던 품목을 최근순으로", () => {
    expect(suggestItems(h, "쿠팡", "")).toEqual(["우유, 계란", "휴지 30롤"]);
  });
  it("입력 중인 글자로 거르기", () => {
    expect(suggestItems(h, "쿠팡", "휴지")).toEqual(["휴지 30롤"]);
  });
  it("가게를 안 적으면 전체에서", () => {
    expect(suggestItems(h, "", "")).toHaveLength(3);
  });
});

describe("이스터 에그", () => {
  it("숨은 사용처·금액", () => {
    expect(expenseEgg(777)?.confetti).toBe(true);
    expect(expenseEgg(12000, "편의점", "로또")?.text).toContain("반띵");
    expect(expenseEgg(1500000)?.text).toContain("백만");
    expect(expenseEgg(1004)).toBeNull();
    expect(expenseEgg(486)).toBeNull();
    expect(expenseEgg(12345, "이마트", "우유")).toBeNull();
  });
  it("감미치킨은 일반 치킨보다 먼저, 띄어 써도 알아봐요", () => {
    expect(expenseEgg(25000, "감미 치킨", "", () => 0)?.text).toContain("태형이는 끌려갔다");
    expect(expenseEgg(25000, "BBQ", "치킨")?.text).toContain("0칼로리");
  });
  it("기념일 문구", () => {
    expect(dateEgg("2026-12-25")).toContain("크리스마스");
    expect(dateEgg("2027-02-12")).toContain("경은이 생일");
    expect(dateEgg("2027-08-09")).toContain("태형이 생일");
    expect(dateEgg("2027-06-28")).toContain("결혼기념일");
    expect(dateEgg("2026-12-12")).toContain("사귄 날");
    expect(isOurDay("2026-12-12")).toBe(true);
    expect(isOurDay("2026-12-25")).toBe(false);
    expect(dateEgg("2026-11-22")).toBeNull();
  });
  it("저축액 단위 바꾸기", () => {
    expect(inUnits(1330000, 0)).toBe("🍗 치킨 66마리");
    expect(inUnits(1330000, 1)).toBe("☕ 아메리카노 295잔");
  });
});

describe("회사 돈 (영업활동비)", () => {
  const lunch = tx("2026-11-20", "foodDining", 15000, { spender: "태형", company: true, memo: "김밥천국" });
  const mart = tx("2026-11-21", "foodIngredients", 300000, { memo: "이마트", items: "삼겹살" });
  const tissue = tx("2026-11-21", "essentialConsumables", 29800, { memo: "쿠팡", items: "휴지 30롤" });
  const phone = tx("2026-11-15", "livingTelecom", 55000, { auto: true });
  const all = [lunch, mart, tissue, phone];
  it("가계부 계산에서 빠져요", () => {
    const s = computeSummary(budget, all.filter(isHousehold), nov);
    expect(s.totalVariableSpent).toBe(300000 + 29800 + 55000);
    expect(s.usage.foodDining).toBe(0);
  });
  it("필터: 회사 돈만 / 식비는 회사 돈 빼고 / 생필품 / 자동 / 사람", () => {
    expect(all.filter((t) => matchTx(t, "COMPANY"))).toEqual([lunch]);
    expect(all.filter((t) => matchTx(t, "FOOD"))).toEqual([mart]);
    expect(all.filter((t) => matchTx(t, "ESSENTIALS"))).toEqual([tissue]);
    expect(all.filter((t) => matchTx(t, "AUTO"))).toEqual([phone]);
    expect(all.filter((t) => matchTx(t, "태형"))).toEqual([lunch]);
  });
  it("검색: 사용처·품목·카테고리", () => {
    expect(all.filter((t) => matchTx(t, "ALL", "휴지"))).toEqual([tissue]);
    expect(all.filter((t) => matchTx(t, "ALL", "쿠팡"))).toEqual([tissue]);
    expect(all.filter((t) => matchTx(t, "ALL", "통신"))).toEqual([phone]);
  });
});

describe("무지출 최장 기록", () => {
  // 11/1부터 기록, 3일·21일·22일에 지출 → 4일~20일 17일 연속이 최장
  const map = spentByDate([tx("2026-11-03", "foodCafe", 4500), tx("2026-11-21", "foodCafe", 3000), tx("2026-11-22", "foodCafe", 1000)]);
  it("가장 긴 연속 구간", () => {
    expect(longestStreak(map, "2026-11-01", "2026-07-25", "2026-11-22")).toEqual({ days: 17, from: "2026-11-04", to: "2026-11-20" });
  });
  it("오늘 지출이 없으면 오늘까지 포함", () => {
    expect(longestStreak({}, "2026-11-20", "2026-07-25", "2026-11-22")).toEqual({ days: 3, from: "2026-11-20", to: "2026-11-22" });
  });
  it("시작 전이면 없음", () => {
    expect(longestStreak(map, null, "2026-07-25", "2026-11-22")).toBeNull();
  });
  it("오래된 저장 기록은 유지, 범위 안 기록은 다시 계산한 값으로 바로잡기", () => {
    const local = { days: 5, from: "2026-11-01", to: "2026-11-05" };
    const old = { days: 30, from: "2026-03-01", to: "2026-03-30" };
    const stale = { days: 17, from: "2026-11-04", to: "2026-11-20" };
    expect(pickBest(old, local, "2026-07-25")).toEqual(old);
    expect(pickBest(stale, local, "2026-07-25")).toEqual(local); // 나중에 빠뜨린 지출을 적은 경우
    expect(pickBest(null, local, "2026-07-25")).toEqual(local);
  });
});

describe("오늘의 복권", () => {
  const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
  const at = (symbol: string) => {
    let acc = 0;
    for (const r of PRIZE_TABLE) { if (r.symbol === symbol) return acc + 0.0001; acc += r.chance; }
    throw new Error(symbol);
  };
  it("당첨표: 1등 🎰🎰🎰 4%, 2~5등, 그림이 다 달라요", () => {
    expect(PRIZE_TABLE[0]).toMatchObject({ symbol: "🎰", rank: 1, chance: 0.04 });
    expect(PRIZE_TABLE.filter((r) => r.tier === "prize").map((r) => r.rank)).toEqual([2, 3, 4, 5]);
    expect(PRIZE_TABLE.find((r) => r.symbol === "🍒")?.prize).toContain("심부름 1회");
    expect(PRIZE_TABLE.find((r) => r.symbol === "🍀")?.prize).toContain("로또 한 장");
    expect(new Set(PRIZE_TABLE.map((r) => r.symbol)).size).toBe(PRIZE_TABLE.length);
  });
  it("1등: 🎰🎰🎰 치맥", () => {
    expect(drawTicket(seq(at("🎰")))).toMatchObject({ symbols: ["🎰", "🎰", "🎰"], tier: "jackpot", rank: 1 });
  });
  it("2등: 💎💎💎 어깨 안마", () => {
    const t = drawTicket(seq(at("💎")));
    expect(t).toMatchObject({ symbols: ["💎", "💎", "💎"], tier: "prize", rank: 2 });
    expect(t.prize).toContain("어깨 안마");
  });
  it("🤫 숨겨진 하트: 5% · 뽀뽀 해주기 · 당첨표에는 안 보여요", () => {
    const row = PRIZE_TABLE.find((r) => r.symbol === LOVE_SYMBOL);
    expect(row).toMatchObject({ tier: "love", chance: 0.05, prize: "💋 뽀뽀 해주기" });
    expect(VISIBLE_PRIZES.some((r) => r.symbol === LOVE_SYMBOL)).toBe(false);
    expect(drawTicket(seq(at(LOVE_SYMBOL)))).toMatchObject({ symbols: ["❤️", "❤️", "❤️"], tier: "love" });
  });
  it("💣💣💣 폭탄", () => {
    expect(drawTicket(seq(at("💣"))).tier).toBe("bomb");
  });
  it("아깝다: 🎰이 두 개", () => {
    expect(drawTicket(seq(0.9, 0.0, 0.0, 0.2))).toMatchObject({ symbols: ["🎰", "🎰", "💎"], tier: "almost" });
  });
  it("꽝이면 내일 또 도전 멘트, 셋 다 같은 그림은 안 나와요", () => {
    const t = drawTicket(seq(0.9, 0.3, 0.3, 0.3, 0));
    expect(t.tier).toBe("lose");
    expect(new Set(t.symbols).size).toBeGreaterThan(1);
    expect(t.prize).toBe(LOSE_MESSAGE);
  });
  it("확률: 1등 약 4%, 하트 약 5%, 하트는 꼭 세 개로만 나와요", () => {
    let jackpot = 0, love = 0, lose = 0, loseAllDiff = 0;
    for (let i = 0; i < 30000; i++) {
      const t = drawTicket();
      if (t.tier === "jackpot") jackpot++;
      if (t.tier === "love") { love++; expect(t.symbols).toEqual(["❤️", "❤️", "❤️"]); }
      else expect(t.symbols).not.toContain(LOVE_SYMBOL);
      if (t.tier === "lose") { lose++; if (new Set(t.symbols).size === 3) loseAllDiff++; }
    }
    expect(jackpot / 30000).toBeGreaterThan(0.031);
    expect(jackpot / 30000).toBeLessThan(0.049);
    expect(love / 30000).toBeGreaterThan(0.04);
    expect(love / 30000).toBeLessThan(0.06);
    expect(loseAllDiff / lose).toBeGreaterThan(0.5);
  });
  it("폭탄 다음 날은 강제 무지출 데이 (말일 → 다음 달 1일)", () => {
    const t = (date: string, tier: LotteryTicket["tier"], revealed = true): LotteryTicket =>
      ({ id: date, uid: "u2", name: "경은", date, symbols: [], tier, prize: "", revealed });
    const days = forcedNoSpendDays([t("2026-11-30", "bomb"), t("2026-11-10", "lose"), t("2026-11-12", "bomb", false)]);
    expect(days).toEqual({ "2026-12-01": "경은" });
  });
});

describe("로그인 계정 → 이름", () => {
  it("이메일은 해시로만 비교해요 (대소문자·공백 무시)", async () => {
    const table = { [await sha256Hex("someone@example.com")]: "태형" as const };
    expect(await nameForEmail(" SomeOne@Example.com ", table)).toBe("태형");
    expect(await nameForEmail("other@example.com", table)).toBeNull();
    expect(await nameForEmail(null, table)).toBeNull();
  });
});
