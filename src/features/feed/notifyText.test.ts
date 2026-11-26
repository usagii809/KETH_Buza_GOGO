import { describe, expect, it } from "vitest";
import type { LotteryTicket } from "../../lib/types";
import { activityReactionMsg, couponMsg, goalMoneyMsg, goalNewMsg, lotteryMsg, reactionMsg, recordMsg, settleMsg } from "./notifyText";

const tx = (o: Partial<{ amount: number; memo: string; spender: string; company: boolean }> = {}) =>
  ({ amount: 12000, category: "foodDining", memo: "동해식당", spender: "경은", ...o });
const ticket = (o: Partial<LotteryTicket> = {}): LotteryTicket =>
  ({ id: "t1", uid: "u2", date: "2026-11-26", symbols: ["💎", "💎", "💎"], tier: "prize", rank: 2, prize: "💆 어깨 안마 10분 이용권", revealed: true, ...o });

describe("🔔 알림 문구 (받는 사람 입장)", () => {
  it("기록: 누가 · 누구 돈인지", () => {
    expect(recordMsg("경은", tx()).title).toBe("💳 경은 님이 동해식당에서 12,000원 썼어요");
    expect(recordMsg("경은", tx({ spender: "태형" }))).toMatchObject({ kind: "record", title: "💳 경은 님이 내 지출을 기록했어요" });
    expect(recordMsg("경은", tx({ spender: "공동" })).title).toBe("💳 경은 님이 공동 지출을 기록했어요");
    expect(recordMsg("경은", tx({ amount: -5000 })).title).toBe("↩️ 경은 님이 동해식당에서 5,000원 환불받았어요");
    expect(recordMsg("경은", tx({ company: true })).body).toContain("🏢 회사 돈");
  });
  it("반응", () => {
    expect(reactionMsg("경은", "🔥", tx({ spender: "태형" }))).toMatchObject({ kind: "reaction", title: "경은 님이 내 기록에 🔥 반응했어요", body: "동해식당 · 12,000원" });
    const target = { kind: "lottery" as const, id: "l_t1", at: 1, who: "태형", mine: false, ticket: ticket({ tier: "bomb", rank: 0, prize: "" }) };
    expect(activityReactionMsg("경은", "🥲", target).title).toBe("경은 님이 내 복권에 🥲 반응했어요");
  });
  it("복권 · 쿠폰", () => {
    expect(lotteryMsg("경은", ticket({ tier: "bomb", prize: "" })).title).toBe("💣 경은 님 복권에서 폭탄이 나왔어요!");
    expect(lotteryMsg("경은", ticket()).title).toBe("🎉 경은 님이 복권에 당첨됐어요!");
    expect(lotteryMsg("경은", ticket()).body).toContain("어깨 안마");
    expect(couponMsg("경은", ticket()).body).toBe("💆 어깨 안마 10분 이용권 · 내 차례예요 😇");
  });
  it("저축", () => {
    const g = { name: "여행", emoji: "✈️", target: 1000000 };
    expect(goalNewMsg("경은", g)).toMatchObject({ kind: "goal", body: "✈️ 여행 · 목표 1,000,000원" });
    expect(goalMoneyMsg("경은", g, 50000).title).toBe("🐷 경은 님이 ✈️ 여행에 50,000원 모았어요");
    expect(goalMoneyMsg("경은", g, -20000).title).toBe("💸 경은 님이 ✈️ 여행에서 20,000원 꺼냈어요");
    expect(settleMsg("경은", "2026-11", g, 300000)).toMatchObject({ title: "🧾 경은 님이 11월 정산을 했어요", body: "남은 돈 300,000원 → ✈️ 여행" });
  });
});

describe("앱 안 알림 문구", () => {
  it("같이 보기 소식을 받는 사람 입장 한 줄로", async () => {
    const { feedItemMsg } = await import("./notifyText");
    const base = { at: 1, who: "경은", mine: false };
    expect(feedItemMsg({ ...base, kind: "record", id: "r1", tx: { id: "x", date: "2026-11-27", yearMonth: "2026-11", ...tx() } as never }).title).toBe("💳 경은 님이 동해식당에서 12,000원 썼어요");
    expect(feedItemMsg({ ...base, kind: "goalMoney", id: "g", goal: { id: "g1", name: "여행", emoji: "✈️", target: 1, saved: 0 } as never, amount: 30000, settle: "2026-11" }).title).toBe("🧾 경은 님이 11월 정산을 했어요");
  });
});
