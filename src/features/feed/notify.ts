// 🔔 화면에서 바로 부르는 알림 보내기 (문구는 notifyText.ts, 내 이름은 App이 넣어둬요)
import { notifyPartner, pushSender } from "../../lib/push";
import { activityReactionMsg, couponMsg, goalMoneyMsg, goalNewMsg, lotteryMsg, reactionMsg, recordMsg, settleMsg } from "./notifyText";

type Args<F> = F extends (who: string, ...rest: infer R) => unknown ? R : never;

/** 화면에서 바로 부르는 버전 (내 이름은 App이 넣어둬요) */
export const notify = {
  record: (...a: Args<typeof recordMsg>) => notifyPartner(recordMsg(pushSender(), ...a)),
  reaction: (...a: Args<typeof reactionMsg>) => notifyPartner(reactionMsg(pushSender(), ...a)),
  activityReaction: (...a: Args<typeof activityReactionMsg>) => notifyPartner(activityReactionMsg(pushSender(), ...a)),
  lottery: (...a: Args<typeof lotteryMsg>) => notifyPartner(lotteryMsg(pushSender(), ...a)),
  coupon: (...a: Args<typeof couponMsg>) => notifyPartner(couponMsg(pushSender(), ...a)),
  goalNew: (...a: Args<typeof goalNewMsg>) => notifyPartner(goalNewMsg(pushSender(), ...a)),
  goalMoney: (...a: Args<typeof goalMoneyMsg>) => notifyPartner(goalMoneyMsg(pushSender(), ...a)),
  settle: (...a: Args<typeof settleMsg>) => notifyPartner(settleMsg(pushSender(), ...a))
};
