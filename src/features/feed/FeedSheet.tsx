import { setReaction } from "../../data/db";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { formatKRW } from "../../lib/format";
import type { Profile } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { REACTIONS, timeAgo, type FeedItem } from "./calc";

interface Props {
  uid: string;
  items: FeedItem[];
  profiles: Profile[];
  /** 시트를 열기 전 마지막으로 본 시각 (그 뒤 소식에 NEW 표시) */
  lastSeen: number;
  onClose: () => void;
}

/** 💌 같이 보기: 상대가 남긴 기록에 반응하고, 내 기록에 달린 반응을 봐요 */
export function FeedSheet({ uid, items, profiles, lastSeen, onClose }: Props) {
  const { toast } = useFeedback();
  const partner = profiles.find((p) => p.uid !== uid) || null;
  const partnerName = partner?.name || "상대";
  const me = profiles.find((p) => p.uid === uid) || null;

  const react = async (txId: string, current: string | undefined, emoji: string) => {
    try {
      await setReaction(txId, uid, current === emoji ? null : emoji);
    } catch (err) {
      console.error("반응 저장 오류:", err);
      toast("반응을 남기지 못했어요");
    }
  };

  return (
    <Sheet title="💌 같이 보기" subtitle={`${partnerName} 님이 남긴 기록과 내 기록에 달린 반응이에요`} onClose={onClose}>
      {items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-base font-bold text-toss-text">아직 새 소식이 없어요</p>
          <p className="text-sm text-toss-sub mt-1">{partnerName} 님이 기록하면 여기에 보여요</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const tx = it.tx;
            const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
            const place = tx.memo || cat.label;
            const isNew = it.at > lastSeen;
            if (it.kind === "reaction") {
              return (
                <div key={it.id} className="feed-item flex items-center gap-3 p-3 rounded-2xl bg-rose-50/70">
                  <span className="relative shrink-0">
                    <Avatar profile={partner} size={36} />
                    <span className="absolute -right-1 -bottom-1 text-base leading-none">{it.emoji}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-toss-text leading-snug">
                      <b>{it.who}</b> 님이 내 기록에 {it.emoji} 반응했어요
                    </p>
                    <p className="text-xs text-toss-sub truncate num">{place} · {formatKRW(tx.amount)} · {timeAgo(it.at)}</p>
                  </div>
                  {isNew && <NewDot />}
                </div>
              );
            }
            const mine = tx.reactions?.[uid]?.e;
            return (
              <div key={it.id} className="feed-item p-3 rounded-2xl border border-toss-border">
                <div className="flex items-start gap-3">
                  <Avatar profile={partner} size={36} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-toss-text leading-snug">{recordLine(it.who, normalizeSpender(tx.spender), me?.name, place, tx.amount)}</p>
                    <p className="text-xs text-toss-sub truncate">
                      {tx.items ? `${tx.items} · ` : ""}{cat.short}{tx.company ? " · 🏢 회사 돈" : ""} · {timeAgo(it.at)}
                    </p>
                  </div>
                  {isNew && <NewDot />}
                </div>
                <div className="flex items-center gap-1.5 mt-2 pl-12">
                  {REACTIONS.map((e) => (
                    <button key={e} type="button" aria-label={`${e} 반응`} aria-pressed={mine === e} onClick={() => react(tx.id, mine, e)}
                      className={`reaction w-9 h-8 rounded-full text-base leading-none flex items-center justify-center transition active:scale-90 ${mine === e ? "bg-toss-blueLight ring-2 ring-toss-blue" : "bg-toss-bg"}`}>
                      {e}
                    </button>
                  ))}
                  {mine && <span className="ml-1 flex items-center gap-1 text-xs text-toss-sub"><Avatar profile={me} size={16} />반응했어요</span>}
                </div>
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

function NewDot() {
  return <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-toss-red text-white text-[10px] font-bold">NEW</span>;
}
