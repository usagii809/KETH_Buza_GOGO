import { prizeText } from "./ticket";
import type { LotteryTicket } from "../../lib/types";

/** 쿠폰에 적을 이름 */
export function couponLabel(t: LotteryTicket): string {
  if (t.tier === "jackpot") return "🍗🍺 치맥 쿠폰";
  if (t.tier === "love") return "💋 뽀뽀 쿠폰";
  return prizeText(t);
}

export interface CouponGroups {
  /** 내가 가진, 아직 안 쓴 쿠폰 (최근에 받은 순) */
  mine: LotteryTicket[];
  /** 상대가 가진, 아직 안 쓴 쿠폰 = 내가 해줘야 할 것 */
  partner: LotteryTicket[];
  /** 쓴 쿠폰 (최근에 쓴 순) */
  used: LotteryTicket[];
}

export function groupCoupons(coupons: LotteryTicket[], uid: string): CouponGroups {
  const fresh = coupons.filter((t) => t.revealed && !t.usedAt).sort((a, b) => b.date.localeCompare(a.date));
  return {
    mine: fresh.filter((t) => t.uid === uid),
    partner: fresh.filter((t) => t.uid !== uid),
    used: coupons.filter((t) => t.usedAt).sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0))
  };
}
