import { setReaction } from "../../data/db";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { formatKRW } from "../../lib/format";
import { couponLabel } from "../lottery/coupons";
import { symbolsOf, tierTitle } from "../lottery/ticket";
import type { Profile } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";
import { useState } from "react";
import { Segmented } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { REACTIONS, timeAgo, type FeedItem } from "./calc";

type ActivityItem = Extract<FeedItem, { kind: "lottery" | "coupon" | "goalMoney" | "goalNew" }>;

interface Props {
  uid: string;
  items: FeedItem[];
  profiles: Profile[];
  /** 시트를 열기 전 마지막으로 본 시각 (그 뒤 소식에 NEW 표시) */
  lastSeen: number;
  onClose: () => void;
}

type Tab = "all" | "me" | "partner";

/** 💌 같이 보기: 둘이 한 일을 전체 · 나 · 상대로 나눠 보고, 상대 기록에 반응해요 */
export function FeedSheet({ uid, items, profiles, lastSeen, onClose }: Props) {
  const { toast } = useFeedback();
  const partner = profiles.find((p) => p.uid !== uid) || null;
  const partnerName = partner?.name || "상대";
  const me = profiles.find((p) => p.uid === uid) || null;
  const [tab, setTab] = useState<Tab>("all");
  const shown = items.filter((it) => tab === "all" || (tab === "me") === it.mine);
  const newCount = (mine: boolean) => items.filter((it) => it.mine === mine && !mine && it.at > lastSeen).length;

  const react = async (txId: string, current: string | undefined, emoji: string) => {
    try {
      await setReaction(txId, uid, current === emoji ? null : emoji);
    } catch (err) {
      console.error("반응 저장 오류:", err);
      toast("반응을 남기지 못했어요");
    }
  };

  return (
    <Sheet title="💌 같이 보기" subtitle={`${me?.name || "나"} · ${partnerName}의 기록 · 반응 · 복권 · 쿠폰 · 저축 소식이에요`} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <Segmented options={[["all", "전체"], ["me", "나"], ["partner", partnerName + (newCount(false) ? ` ${newCount(false)}` : "")]]} value={tab} onChange={setTab} />
      </div>
      {shown.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-base font-bold text-toss-text">아직 소식이 없어요</p>
          <p className="text-sm text-toss-sub mt-1">{tab === "me" ? "기록하거나 복권을 긁으면 여기에 남아요" : `${partnerName} 님이 기록하거나 복권을 긁으면 여기에 보여요`}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((it) => {
            const who = it.mine ? me : partner;
            const isNew = !it.mine && it.at > lastSeen;
            if (it.kind !== "record" && it.kind !== "reaction") {
              return <ActivityRow key={it.id} it={it} profile={who} myName={me?.name} partnerName={partnerName} isNew={isNew} />;
            }
            const tx = it.tx;
            const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
            const place = tx.memo || cat.label;
            if (it.kind === "reaction") {
              return (
                <div key={it.id} className={`feed-item flex items-center gap-3 p-3 rounded-2xl ${it.mine ? "bg-toss-bg" : "bg-rose-50/70"}`}>
                  <span className="relative shrink-0">
                    <Avatar profile={who} size={36} zoomable />
                    <span className="absolute -right-1 -bottom-1 text-base leading-none">{it.emoji}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-toss-text leading-snug">
                      {it.mine ? <><b>내가</b> {partnerName} 님 기록에 {it.emoji} 반응했어요</> : <><b>{it.who}</b> 님이 내 기록에 {it.emoji} 반응했어요</>}
                    </p>
                    <p className="text-xs text-toss-sub truncate num">{place} · {formatKRW(tx.amount)} · {timeAgo(it.at)}</p>
                  </div>
                  {isNew && <NewDot />}
                </div>
              );
            }
            const mine = tx.reactions?.[uid]?.e;
            const theirs = partner ? tx.reactions?.[partner.uid]?.e : undefined;
            return (
              <div key={it.id} className={`feed-item p-3 rounded-2xl border border-toss-border ${it.mine ? "bg-toss-bg/60" : ""}`}>
                <div className="flex items-start gap-3">
                  <Avatar profile={who} size={36} className="shrink-0" zoomable />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-toss-text leading-snug">
                      {it.mine ? myRecordLine(normalizeSpender(tx.spender), me?.name, partnerName, place, tx.amount) : recordLine(it.who, normalizeSpender(tx.spender), me?.name, place, tx.amount)}
                    </p>
                    <p className="text-xs text-toss-sub truncate">
                      {tx.items ? `${tx.items} · ` : ""}{cat.short}{tx.company ? " · 🏢 회사 돈" : ""} · {timeAgo(it.at)}
                    </p>
                  </div>
                  {isNew && <NewDot />}
                </div>
                {it.mine ? (
                  // 내 기록: 반응 버튼 대신 상대가 남긴 반응
                  theirs && <p className="mt-1.5 pl-12 text-xs text-toss-sub flex items-center gap-1"><Avatar profile={partner} size={16} />{partnerName} 님이 {theirs} 반응했어요</p>
                ) : (
                <div className="flex items-center gap-1.5 mt-2 pl-12">
                  {REACTIONS.map((e) => (
                    <button key={e} type="button" aria-label={`${e} 반응`} aria-pressed={mine === e} onClick={() => react(tx.id, mine, e)}
                      className={`reaction w-9 h-8 rounded-full text-base leading-none flex items-center justify-center transition active:scale-90 ${mine === e ? "bg-toss-blueLight ring-2 ring-toss-blue" : "bg-toss-bg"}`}>
                      {e}
                    </button>
                  ))}
                  {mine && <span className="ml-1 flex items-center gap-1 text-xs text-toss-sub"><Avatar profile={me} size={16} />반응했어요</span>}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/**
 * 누가 기록했고, 누구 돈인지
 * - 경은이 경은 지출 기록 → "경은 님이 이마트에서 52,000원 썼어요"
 * - 경은이 태형 지출 기록 → "경은 님이 내 지출을 기록했어요 · 이마트 52,000원" (태형 화면)
 * - 경은이 공동 지출 기록 → "경은 님이 공동 지출을 기록했어요 · 이마트 52,000원"
 */
function recordLine(recorder: string, spender: string, myName: string | undefined, place: string, amount: number) {
  if (amount < 0) return <><b>{recorder}</b> 님이 <b>{place}</b>에서 <b className="num text-toss-green">{formatKRW(-amount)}</b> 환불받았어요 ↩️</>;
  const money = <><b>{place}</b> <b className="num">{formatKRW(amount)}</b></>;
  if (spender === recorder) return <><b>{recorder}</b> 님이 <b>{place}</b>에서 <b className="num">{formatKRW(amount)}</b> 썼어요</>;
  const whose = spender === "공동" ? <><span className="px-1 rounded bg-gray-100 font-bold">공동</span> 지출</>
    : spender === myName ? <><b>내</b> 지출</> : <><b>{spender}</b> 님 지출</>;
  return <><b>{recorder}</b> 님이 {whose}을 기록했어요 · {money}</>;
}

/** 내가 남긴 기록 한 줄: "내가 이마트에서 5만원 썼어요" / "내가 경은 님 지출을 기록했어요" */
function myRecordLine(spender: string, myName: string | undefined, partnerName: string, place: string, amount: number) {
  if (amount < 0) return <><b>내가</b> <b>{place}</b>에서 <b className="num text-toss-green">{formatKRW(-amount)}</b> 환불받았어요 ↩️</>;
  const money = <><b>{place}</b> <b className="num">{formatKRW(amount)}</b></>;
  if (spender === myName) return <><b>내가</b> <b>{place}</b>에서 <b className="num">{formatKRW(amount)}</b> 썼어요</>;
  const whose = spender === "공동" ? <><span className="px-1 rounded bg-gray-100 font-bold">공동</span> 지출</> : <><b>{spender === partnerName ? partnerName : spender}</b> 님 지출</>;
  return <><b>내가</b> {whose}을 기록했어요 · {money}</>;
}

/** 복권 · 쿠폰 · 저축 목표 소식 한 줄 */
function ActivityRow({ it, profile, myName, partnerName, isNew }: { it: ActivityItem; profile: Profile | null; myName?: string; partnerName: string; isNew: boolean }) {
  const { icon, line, sub, tone } = describeActivity(it, myName, partnerName);
  return (
    <div className={`feed-item flex items-center gap-3 p-3 rounded-2xl ${it.mine ? "bg-toss-bg" : tone}`}>
      <span className="relative shrink-0">
        <Avatar profile={profile} size={36} zoomable />
        <span className="absolute -right-1 -bottom-1 text-base leading-none">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-toss-text leading-snug">{line}</p>
        <p className="text-xs text-toss-sub truncate">{sub ? `${sub} · ` : ""}{timeAgo(it.at)}</p>
      </div>
      {isNew && <NewDot />}
    </div>
  );
}

function describeActivity(it: ActivityItem, myName: string | undefined, partnerName: string) {
  // 주어: 상대면 "경은 님이 / 경은 님", 나면 "내가 / 내"
  const subj = it.mine ? <b>내가</b> : <><b>{it.who}</b> 님이</>;
  const owner = it.mine ? <b>내</b> : <><b>{it.who}</b> 님</>;
  if (it.kind === "lottery") {
    const t = it.ticket;
    const big = t.tier === "jackpot" || t.tier === "prize" || t.tier === "love";
    const line = t.tier === "bomb"
      ? <>{owner} 복권에서 💣 폭탄이 나왔어요! 다음 주는 외식 금지</>
      : big ? <>{subj} 복권에 당첨됐어요! <b>{tierTitle(t.tier, t.rank)}</b></>
      : <>{subj} 오늘의 복권을 긁었어요 · {tierTitle(t.tier, t.rank)}</>;
    return {
      icon: t.tier === "bomb" ? "💣" : big ? "🎉" : "🎟️",
      line,
      sub: [symbolsOf(t).join(" "), big ? t.prize : ""].filter(Boolean).join(" · "),
      tone: t.tier === "bomb" ? "bg-gray-100" : big ? "bg-amber-50" : "bg-toss-bg"
    };
  }
  if (it.kind === "coupon") {
    return {
      icon: "🎫",
      line: <>{subj} 쿠폰을 썼어요 · <b>{couponLabel(it.ticket)}</b></>,
      sub: it.mine ? `${partnerName} 님 차례예요 😇` : `${myName ? `${myName} 님` : "내"} 차례예요 😇`,
      tone: "bg-violet-50"
    };
  }
  const g = it.goal;
  const goalName = <b>{g.emoji} {g.name}</b>;
  if (it.kind === "goalNew") {
    return { icon: "🎯", line: <>{subj} 새 저축 목표를 만들었어요 · {goalName}</>, sub: `목표 ${formatKRW(g.target)}`, tone: "bg-emerald-50" };
  }
  const pct = g.target > 0 ? Math.min(100, Math.floor((g.saved / g.target) * 100)) : 0;
  if (it.settle) {
    return {
      icon: "🧾",
      line: <>{subj} {Number(it.settle.slice(5))}월 정산을 했어요 · 남은 돈 <b className="num">{formatKRW(it.amount)}</b> → {goalName}</>,
      sub: `지금 ${pct}%`,
      tone: "bg-emerald-50"
    };
  }
  return it.amount > 0
    ? { icon: "🐷", line: <>{subj} {goalName}에 <b className="num text-toss-green">{formatKRW(it.amount)}</b> 모았어요</>, sub: `지금 ${pct}%`, tone: "bg-emerald-50" }
    : { icon: "💸", line: <>{subj} {goalName}에서 <b className="num">{formatKRW(-it.amount)}</b> 꺼냈어요</>, sub: `지금 ${pct}%`, tone: "bg-toss-bg" };
}

function NewDot() {
  return <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-toss-red text-white text-[10px] font-bold">NEW</span>;
}
