// 🔔 같이 보기 소식 → 상대 폰 알림 문구
// 받는 사람 입장에서 써요: "경은 님이 내 기록에 🔥 반응했어요"
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { formatKRW } from "../../lib/format";
import type { PushMessage } from "../../lib/push";
import type { Goal, LotteryTicket, Transaction } from "../../lib/types";
import { couponLabel } from "../lottery/coupons";
import { tierTitle } from "../lottery/ticket";
import type { ActivityItem, FeedItem } from "./calc";

type TxLike = Pick<Transaction, "amount" | "category" | "memo" | "spender"> & Partial<Pick<Transaction, "company">>;
type GoalLike = Pick<Goal, "name" | "emoji"> & Partial<Pick<Goal, "target">>;

const placeOf = (tx: TxLike) => tx.memo || CATEGORY_MAP[normalizeCategory(tx.category)].label;
const nim = (who: string) => `${who} 님`;

/** 새 기록: "경은 님이 동해식당에서 12,000원 썼어요" / "경은 님이 내 지출을 기록했어요" */
export function recordMsg(who: string, tx: TxLike): PushMessage {
  const place = placeOf(tx);
  const amount = Number(tx.amount) || 0;
  const cat = CATEGORY_MAP[normalizeCategory(tx.category)].short;
  const body = [`${place} ${formatKRW(Math.abs(amount))}`, cat, tx.company ? "🏢 회사 돈" : ""].filter(Boolean).join(" · ");
  if (amount < 0) return { kind: "record", title: `↩️ ${nim(who)}이 ${place}에서 ${formatKRW(-amount)} 환불받았어요`, body: cat };
  const spender = normalizeSpender(tx.spender);
  if (spender === who) return { kind: "record", title: `💳 ${nim(who)}이 ${place}에서 ${formatKRW(amount)} 썼어요`, body: [cat, tx.company ? "🏢 회사 돈" : ""].filter(Boolean).join(" · ") };
  if (spender === "공동") return { kind: "record", title: `💳 ${nim(who)}이 공동 지출을 기록했어요`, body };
  return { kind: "record", title: `💳 ${nim(who)}이 내 지출을 기록했어요`, body };
}

/** 내 기록에 반응 */
export function reactionMsg(who: string, emoji: string, tx: TxLike): PushMessage {
  return { kind: "reaction", title: `${nim(who)}이 내 기록에 ${emoji} 반응했어요`, body: `${placeOf(tx)} · ${formatKRW(Math.abs(Number(tx.amount) || 0))}`, tag: "reaction" };
}

/** 반응 소식에서 부르는 이름: "복권" · "쿠폰" · "저축" · "저축 목표" · "정산" */
export function targetLabel(t: ActivityItem) {
  if (t.kind === "lottery") return "복권";
  if (t.kind === "coupon") return "쿠폰";
  if (t.kind === "goalNew") return "저축 목표";
  return t.settle ? "정산" : "저축";
}

/** 무엇에 반응했는지 짧게 */
export function targetSummary(t: ActivityItem) {
  if (t.kind === "lottery") return tierTitle(t.ticket.tier, t.ticket.rank);
  if (t.kind === "coupon") return couponLabel(t.ticket);
  const name = `${t.goal.emoji} ${t.goal.name}`;
  if (t.kind === "goalNew") return name;
  return `${name} ${t.amount > 0 ? "+" : "−"}${formatKRW(Math.abs(t.amount))}`;
}

/** 내 복권 · 쿠폰 · 저축 소식에 반응 */
export function activityReactionMsg(who: string, emoji: string, t: ActivityItem): PushMessage {
  return { kind: "reaction", title: `${nim(who)}이 내 ${targetLabel(t)}에 ${emoji} 반응했어요`, body: targetSummary(t), tag: "reaction" };
}

/** 복권 긁기 */
export function lotteryMsg(who: string, t: Pick<LotteryTicket, "tier" | "rank" | "prize">): PushMessage {
  if (t.tier === "bomb") return { kind: "lottery", title: `💣 ${nim(who)} 복권에서 폭탄이 나왔어요!`, body: "다음 주 일주일간 외식·배달 금지예요", tag: "lottery" };
  const big = t.tier === "jackpot" || t.tier === "prize" || t.tier === "love";
  if (big) return { kind: "lottery", title: `🎉 ${nim(who)}이 복권에 당첨됐어요!`, body: [tierTitle(t.tier, t.rank), t.prize].filter(Boolean).join(" · "), tag: "lottery" };
  return { kind: "lottery", title: `🎟️ ${nim(who)}이 오늘의 복권을 긁었어요`, body: tierTitle(t.tier, t.rank), tag: "lottery" };
}

/** 쿠폰 쓰기 → 받는 사람 차례 */
export function couponMsg(who: string, t: LotteryTicket): PushMessage {
  return { kind: "coupon", title: `🎫 ${nim(who)}이 쿠폰을 썼어요`, body: `${couponLabel(t)} · 내 차례예요 😇`, tag: "coupon" };
}

export function goalNewMsg(who: string, g: GoalLike): PushMessage {
  return { kind: "goal", title: `🎯 ${nim(who)}이 새 저축 목표를 만들었어요`, body: `${g.emoji} ${g.name}${g.target ? ` · 목표 ${formatKRW(g.target)}` : ""}` };
}

export function goalMoneyMsg(who: string, g: GoalLike, amount: number): PushMessage {
  return amount > 0
    ? { kind: "goal", title: `🐷 ${nim(who)}이 ${g.emoji} ${g.name}에 ${formatKRW(amount)} 모았어요` }
    : { kind: "goal", title: `💸 ${nim(who)}이 ${g.emoji} ${g.name}에서 ${formatKRW(-amount)} 꺼냈어요` };
}

export function settleMsg(who: string, ym: string, g: GoalLike, amount: number): PushMessage {
  return { kind: "goal", title: `🧾 ${nim(who)}이 ${Number(ym.slice(5))}월 정산을 했어요`, body: `남은 돈 ${formatKRW(amount)} → ${g.emoji} ${g.name}` };
}

/** 같이 보기 소식 하나 → 받는 사람 입장 한 줄 (앱 안 알림 · 폰 알림 같은 문구) */
export function feedItemMsg(it: FeedItem): PushMessage {
  switch (it.kind) {
    case "record": return recordMsg(it.who, it.tx);
    case "reaction": return reactionMsg(it.who, it.emoji, it.tx);
    case "actReaction": return activityReactionMsg(it.who, it.emoji, it.target);
    case "lottery": return lotteryMsg(it.who, it.ticket);
    case "coupon": return couponMsg(it.who, it.ticket);
    case "goalNew": return goalNewMsg(it.who, it.goal);
    case "goalMoney": return it.settle ? settleMsg(it.who, it.settle, it.goal, it.amount) : goalMoneyMsg(it.who, it.goal, it.amount);
  }
}
