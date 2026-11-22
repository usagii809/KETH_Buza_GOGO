import { describe, expect, it } from "vitest";
import { computeSummary } from "../features/budget/calc";
import { buildFeed, countUnseen, timeAgo } from "../features/feed/calc";
import { couponLabel, groupCoupons } from "../features/lottery/coupons";
import { buildInsights } from "../features/report/insights";
import { canSettle, settleOptions } from "../features/settle/calc";
import { normalizeBudget } from "./categories";
import { getPeriodInfo } from "./dates";
import { josa } from "./josa";
import type { LotteryTicket, Profile, Transaction } from "./types";

let seq = 0;
const tx = (date: string, category: string, amount: number, extra: Partial<Transaction> = {}): Transaction =>
  ({ id: `f${seq++}`, date, yearMonth: date.slice(0, 7), category, amount, ...extra });
const profiles: Profile[] = [{ uid: "me", name: "태형" }, { uid: "you", name: "경은" }];

describe("같이 보기 피드", () => {
  it("상대 기록과 내 기록에 달린 반응만, 최신순", () => {
    const txs = [
      tx("2026-11-20", "foodCafe", 5000, { createdBy: "you", createdAt: 100 }),
      tx("2026-11-20", "livingTelecom", 55000, { createdBy: "you", createdAt: 300, auto: true }),
      tx("2026-11-21", "foodIngredients", 30000, { createdBy: "me", createdAt: 200, reactions: { you: { e: "👍", at: 400 }, me: { e: "❤️", at: 500 } } }),
      tx("2026-11-21", "foodDining", 20000, { createdBy: "me", createdAt: 250 })
    ];
    const feed = buildFeed(txs, "me", profiles);
    expect(feed.map((f) => f.kind)).toEqual(["reaction", "record"]);
    expect(feed[0]).toMatchObject({ who: "경은", emoji: "👍", at: 400 });
    expect(feed[1]).toMatchObject({ who: "경은", at: 100 });
    expect(countUnseen(feed, 150)).toBe(1);
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
