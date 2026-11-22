import { useState } from "react";
import { markCouponUsed } from "../../data/db";
import { josa } from "../../lib/josa";
import type { LotteryTicket, Profile } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { confetti } from "../fun/confetti";
import { couponLabel, groupCoupons } from "./coupons";
import { symbolsOf } from "./ticket";

interface Props {
  uid: string;
  coupons: LotteryTicket[];
  profiles: Profile[];
  onClose: () => void;
}

const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;

/** 🎫 복권에서 받은 쿠폰을 모아두고, 쓰고 싶을 때 꺼내 써요 */
export function CouponSheet({ uid, coupons, profiles, onClose }: Props) {
  const { toast, confirm } = useFeedback();
  const [showUsed, setShowUsed] = useState(false);
  const { mine, partner, used } = groupCoupons(coupons, uid);
  const partnerName = profiles.find((p) => p.uid !== uid)?.name || partner[0]?.name || "상대";
  const nameOf = (t: LotteryTicket) => profiles.find((p) => p.uid === t.uid)?.name || t.name || "";

  const use = async (t: LotteryTicket) => {
    const ok = await confirm({ title: `${josa(couponLabel(t), "을", "를")} 쓸까요?`, message: `${partnerName} 님에게 이 화면을 보여주세요. 쓰고 나면 되돌릴 수 없어요.`, okText: "지금 쓰기" });
    if (!ok) return;
    try {
      await markCouponUsed(t.id);
      confetti();
      toast(`🎫 ${couponLabel(t)} 사용 완료! ${partnerName} 님, 부탁해요 🙏`);
    } catch (err) {
      console.error("쿠폰 사용 오류:", err);
      toast("쿠폰을 쓰지 못했어요. 다시 시도해 주세요");
    }
  };

  return (
    <Sheet title="🎫 쿠폰함" subtitle="복권에서 받은 쿠폰은 여기 모여요. 쓰고 싶을 때 꺼내 써요" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <p className="text-sm font-bold text-toss-text mb-2">내 쿠폰 <span className="text-toss-blue num">{mine.length}</span></p>
          {mine.length === 0 ? (
            <p className="py-6 text-center text-sm text-toss-sub rounded-2xl bg-toss-bg">아직 쿠폰이 없어요. 오늘의 복권을 긁어봐요 🍀</p>
          ) : (
            <div className="space-y-2">
              {mine.map((t) => <CouponTicket key={t.id} t={t} action={<button type="button" onClick={() => use(t)} className="coupon-use shrink-0 px-3.5 py-2 rounded-xl bg-toss-blue text-white text-sm font-bold active:scale-95 transition">쓰기</button>} />)}
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-bold text-toss-text mb-0.5">{partnerName}의 쿠폰 <span className="text-rose-500 num">{partner.length}</span></p>
          <p className="text-xs text-toss-sub mb-2">{partnerName} 님이 쓰면 내가 해줘야 해요 😇</p>
          {partner.length === 0 ? (
            <p className="py-4 text-center text-sm text-toss-sub rounded-2xl bg-toss-bg">지금은 해줘야 할 게 없어요</p>
          ) : (
            <div className="space-y-2">{partner.map((t) => <CouponTicket key={t.id} t={t} dim />)}</div>
          )}
        </section>

        {used.length > 0 && (
          <section>
            <button type="button" onClick={() => setShowUsed((v) => !v)} className="text-sm font-bold text-toss-sub">
              다 쓴 쿠폰 {used.length}장 {showUsed ? "▲" : "▼"}
            </button>
            {showUsed && (
              <div className="mt-2 divide-y divide-toss-border">
                {used.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex justify-between gap-2 py-2 text-sm">
                    <span className="text-toss-sub truncate">{nameOf(t)} · {couponLabel(t)}</span>
                    <span className="text-xs text-toss-muted num shrink-0">{t.usedAt ? `${new Date(t.usedAt).getMonth() + 1}/${new Date(t.usedAt).getDate()} 사용` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}

function CouponTicket({ t, action, dim }: { t: LotteryTicket; action?: React.ReactNode; dim?: boolean }) {
  const style = t.tier === "jackpot" ? "bg-gradient-to-r from-amber-100 to-yellow-50 border-amber-300"
    : t.tier === "love" ? "bg-gradient-to-r from-rose-100 to-pink-50 border-rose-200"
    : "bg-indigo-50 border-indigo-100";
  return (
    <div className={`coupon relative flex items-center gap-3 p-3.5 rounded-2xl border border-dashed ${style} ${dim ? "opacity-80" : ""}`}>
      <span className="text-lg leading-none tracking-tight shrink-0">{symbolsOf(t).join("")}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-toss-text truncate">{couponLabel(t)}</p>
        <p className="text-xs text-toss-sub">{md(t.date)}에 받았어요</p>
      </div>
      {action}
    </div>
  );
}
