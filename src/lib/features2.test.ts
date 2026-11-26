import { describe, expect, it } from "vitest";
import { goalThisMonth } from "../features/goals/calc";
import { computeSummary } from "../features/budget/calc";
import { buildFeed, countUnseen, timeAgo } from "../features/feed/calc";
import { couponLabel, groupCoupons } from "../features/lottery/coupons";
import { buildInsights } from "../features/report/insights";
import { canSettle, settleOptions } from "../features/settle/calc";
import { normalizeBudget } from "./categories";
import { getPeriodInfo } from "./dates";
import { josa } from "./josa";
import type { Goal, LotteryTicket, Profile, Transaction } from "./types";

let seq = 0;
const tx = (date: string, category: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `f${seq++}`, date, yearMonth: date.slice(0, 7), category, amount, ...extra });
const profiles: Profile[] = [{ uid: "me", name: "태형" }, { uid: "you", name: "경은" }];

describe("같이 보기 피드", () => {
  it("둘의 기록 · 서로 남긴 반응을 최신순으로, 새 소식은 상대 것만 세요", () => {
    const txs = [
      tx("2026-11-20", "foodCafe", 5000, { createdBy: "you", createdAt: 100, reactions: { me: { e: "❤️", at: 600 } } }),
      tx("2026-11-20", "livingTelecom", 55000, { createdBy: "you", createdAt: 300, auto: true }),
      tx("2026-11-21", "foodIngredients", 30000, { createdBy: "me", createdAt: 200, reactions: { you: { e: "👍", at: 400 }, me: { e: "❤️", at: 500 } } }),
      tx("2026-11-21", "foodDining", 20000, { createdBy: "me", createdAt: 250 })
    ];
    const feed = buildFeed(txs, "me", profiles);
    expect(feed.map((f) => [f.kind, f.who, f.mine, f.at])).toEqual([
      ["reaction", "태형", true, 600], // 내가 경은 기록에
      ["reaction", "경은", false, 400], // 경은이 내 기록에 (내 기록에 내가 단 ❤️는 빼요)
      ["record", "태형", true, 250],
      ["record", "태형", true, 200],
      ["record", "경은", false, 100] // 자동 기록은 빼요
    ]);
    expect(countUnseen(feed, 150)).toBe(1); // 내 활동(600 · 250 · 200)은 안 세요
  });
  it("복권 · 쿠폰 사용 · 저축 목표 · 정산도 둘 다 보여요 (오래된 건 빼요)", () => {
    const tk = (id: string, uid: string, extra: Partial<LotteryTicket>): LotteryTicket =>
      ({ id, uid, date: "2026-11-25", symbols: ["💎", "💎", "💎"], tier: "prize", rank: 2, prize: "💆 어깨 안마 10분 이용권", revealed: true, ...extra });
    const goal = {
      id: "g1", name: "여행", emoji: "✈️", target: 1000000, saved: 300000, createdAt: 1000, createdBy: "you",
      history: [
        { at: 2000, amount: 100000, by: "you" },
        { at: 2100, amount: -20000, by: "you" },
        { at: 2200, amount: 50000, by: "you", settle: "2026-10" },
        { at: 2300, amount: 70000, by: "me" },
        { at: 2400, amount: 10000 } // 예전 기록: 누가 넣었는지 몰라서 빼요
      ]
    };
    const feed = buildFeed([], "me", profiles, 40, {
      since: 500,
      tickets: [tk("t1", "you", { revealedAt: 3000 }), tk("t2", "me", { revealedAt: 3100 }), tk("t3", "you", { revealedAt: 100 }), tk("t4", "you", { revealed: false, createdAt: 3200 })],
      coupons: [tk("t1", "you", { revealedAt: 3000, usedAt: 3500 })],
      goals: [goal]
    });
    expect(feed.map((f) => [f.kind, f.at, f.who])).toEqual([
      ["coupon", 3500, "경은"], ["lottery", 3100, "태형"], ["lottery", 3000, "경은"], ["goalMoney", 2300, "태형"],
      ["goalMoney", 2200, "경은"], ["goalMoney", 2100, "경은"], ["goalMoney", 2000, "경은"], ["goalNew", 1000, "경은"]
    ]);
    expect(feed.filter((f) => f.mine).map((f) => f.at)).toEqual([3100, 2300]);
    expect(feed[4]).toMatchObject({ settle: "2026-10", amount: 50000 });
    expect(countUnseen(feed, 2150)).toBe(3); // 3500 · 3000 · 2200 (내 3100 · 2300은 빼요)
  });
  it("몇 분 전 / 어제", () => {
    const now = new Date(2026, 10, 23, 10, 0).getTime();
    expect(timeAgo(now - 30000, now)).toBe("방금");
    expect(timeAgo(now - 5 * 60000, now)).toBe("5분 전");
    expect(timeAgo(new Date(2026, 10, 22, 9, 0).getTime(), now)).toBe("어제");
    expect(timeAgo(new Date(2026, 10, 3, 9, 0).getTime(), now)).toBe("11월 3일");
  });
});

describe("쿠폰함", () => {
  const t = (id: string, uid: string, tier: LotteryTicket["tier"], extra: Partial<LotteryTicket> = {}): LotteryTicket =>
    ({ id, uid, date: `2026-11-${id.padStart(2, "0")}`, symbols: [], tier, prize: "💆 어깨 안마 10분 이용권", revealed: true, ...extra });
  it("내 쿠폰 / 상대 쿠폰 / 쓴 쿠폰", () => {
    const g = groupCoupons([t("1", "me", "prize"), t("5", "me", "love"), t("3", "you", "prize"), t("2", "me", "prize", { usedAt: 9 }), t("4", "me", "prize", { revealed: false })], "me");
    expect(g.mine.map((x) => x.id)).toEqual(["5", "1"]);
    expect(g.partner.map((x) => x.id)).toEqual(["3"]);
    expect(g.used.map((x) => x.id)).toEqual(["2"]);
    expect(couponLabel(t("9", "me", "jackpot"))).toBe("🍗🍺 치맥 쿠폰");
  });
});

describe("월말 정산", () => {
  const budget = normalizeBudget({ income: 4500000, fixedLoan: 1500000, fixedMaintenance: 300000, fixedEvents: 220000, foodIngredients: 650000, foodDining: 150000, livingTransport: 100000, livingOther: 100000 });
  const oct = getPeriodInfo("2026-10", new Date(2026, 10, 23));
  it("아낀 돈 = 남은 변동 예산, 남은 돈 전부 = 수입 − 고정 − 실제 지출", () => {
    const o = settleOptions(computeSummary(budget, [tx("2026-10-03", "foodIngredients", 600000)], oct));
    expect(o).toEqual({ leftover: 400000, actual: 4500000 - 2020000 - 600000 });
    expect(canSettle(o, true)).toBe(true);
    expect(canSettle(o, false)).toBe(false);
  });
  it("예산을 넘기면 아낀 돈은 0", () => {
    const o = settleOptions(computeSummary(budget, [tx("2026-10-03", "foodIngredients", 1200000)], oct));
    expect(o.leftover).toBe(0);
    expect(o.actual).toBe(1280000);
  });
});

describe("카테고리 비교", () => {
  const hist = [
    tx("2026-10-05", "foodDining", 100000), tx("2026-10-25", "foodDining", 100000),
    tx("2026-09-05", "foodDining", 100000), tx("2026-09-10", "foodIngredients", 300000),
    tx("2026-08-05", "foodDining", 100000), tx("2026-08-10", "foodIngredients", 300000)
  ];
  it("끝난 달: 3개월 평균과 비교", () => {
    const r = buildInsights("2026-11", [tx("2026-11-02", "foodDining", 300000), tx("2026-11-03", "foodCafe", 20000)], hist, null)!;
    expect(r.months).toBe(3);
    const dining = r.rows.find((x) => x.cat.key === "foodDining")!;
    expect(dining.avg).toBe(133333);
    expect(dining.pct).toBe(125);
    expect(r.lines[0]).toMatchObject({ tone: "bad" });
    expect(r.lines.some((l) => l.text.includes("식재료는") && l.tone === "good")).toBe(true);
    expect(r.lines.some((l) => l.text.startsWith("카페·디저트는 평소엔"))).toBe(true);
  });
  it("진행 중인 달: 같은 날짜까지만", () => {
    const r = buildInsights("2026-11", [tx("2026-11-06", "foodDining", 100000)], hist, 6)!;
    expect(r.rows.find((x) => x.cat.key === "foodDining")!.avg).toBe(100000);
  });
  it("지난 기록이 없으면 null", () => {
    expect(buildInsights("2026-11", [], [], null)).toBeNull();
  });
});

describe("조사", () => {
  it("받침에 맞게", () => {
    expect(josa("어깨 안마 10분 이용권", "을", "를")).toBe("어깨 안마 10분 이용권을");
    expect(josa("🎫 로또 한 장 사주기", "을", "를")).toBe("🎫 로또 한 장 사주기를");
    expect(josa("신혼여행", "으로", "로")).toBe("신혼여행으로");
    expect(josa("내 집 마련", "으로", "로")).toBe("내 집 마련으로");
    expect(josa("제주도 여행비", "으로", "로")).toBe("제주도 여행비로");
    expect(josa("서울", "으로", "로")).toBe("서울로");
  });
});

describe("매달 모을 돈", () => {
  it("수입 − 고정 − 매달 모을 돈 = 쓸 수 있는 돈", async () => {
    const { monthlyPlan, goalEta } = await import("../features/goals/calc");
    const goals = [
      { id: "a", name: "여행", emoji: "🏝️", target: 5000000, saved: 1200000, monthly: 300000 },
      { id: "b", name: "차", emoji: "🚗", target: 1000000, saved: 1000000, monthly: 500000 } // 다 모은 목표는 빼요
    ];
    const p = monthlyPlan(goals, 4500000, 2020000, 1030000, 315000, 8)!;
    expect(p.monthlyTotal).toBe(300000);
    expect(p.canSpend).toBe(2180000);
    expect(p.left).toBe(1865000);
    expect(p.vsBudget).toBe(1150000);
    expect(p.perDay).toBe(233100);
    expect(monthlyPlan([{ ...goals[0], monthly: 0 }], 4500000, 2020000, 1030000, 0, 8)).toBeNull();
    expect(goalEta(goals[0], 0, new Date(2026, 10, 23))).toBe("매달 30만원씩 모으면 2027년 12월에 달성해요");
  });
});

describe("이번 달 저축 체크", () => {
  const now = new Date(2026, 10, 26, 12);
  const at = (m: number, d: number) => new Date(2026, m - 1, d, 9).getTime();
  const g = (extra: Partial<Goal>): Goal => ({ id: "g", name: "비트코인", emoji: "📈", target: 10000000, saved: 0, monthly: 500000, ...extra });

  it("이번 달에 넣은 돈만 더하고, 뺀 돈은 빼요", () => {
    expect(goalThisMonth(g({ createdAt: at(9, 1), saved: 900000, history: [
      { at: at(10, 5), amount: 500000 }, { at: at(11, 3), amount: 300000 }, { at: at(11, 20), amount: -100000 }, { at: at(12, 1), amount: 999 }
    ] }), now)).toBe(200000);
  });
  it("이번 달에 만든 목표는 처음 적은 모은 돈도 이번 달로 쳐요", () => {
    expect(goalThisMonth(g({ createdAt: at(11, 20), saved: 500000, history: [] }), now)).toBe(500000);
    expect(goalThisMonth(g({ createdAt: at(11, 20), saved: 700000, history: [{ at: at(11, 25), amount: 200000 }] }), now)).toBe(700000);
  });
  it("지난달에 만든 목표의 처음 금액은 안 쳐요", () => {
    expect(goalThisMonth(g({ createdAt: at(10, 20), saved: 500000, history: [] }), now)).toBe(0);
  });
});
