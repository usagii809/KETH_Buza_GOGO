import type { LotteryTicket, Profile } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";
import { prizeText, symbolsOf, type DiningBan } from "./ticket";

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const isBombPair = (t: LotteryTicket) => symbolsOf(t).filter((x) => x === "💣").length === 2;

interface Props {
  uid: string;
  today: string;
  /** 지난달 말일 ~ 이번 달 복권 기록 (두 사람 모두) */
  tickets: LotteryTicket[];
  profiles: Profile[];
  /** 💣 오늘 걸려 있는 외식 금지 */
  ban: DiningBan | null;
  /** 💣 다음 주에 시작하는 외식 금지 (예고) */
  nextBan: DiningBan | null;
  /** 외식 금지 중에 한 외식 횟수 */
  banBroken: number;
  /** 내가 가진, 아직 안 쓴 쿠폰 수 */
  couponCount: number;
  onOpen: () => void;
  onOpenCoupons: () => void;
}

/** 대시보드의 '오늘의 복권' 카드: 아직이면 긁으러 가기, 긁었으면 둘의 결과 */
export function LotteryCard({ uid, today, tickets, profiles, ban, nextBan, banBroken, couponCount, onOpen, onOpenCoupons }: Props) {
  const mine = tickets.find((t) => t.uid === uid && t.date === today);
  const partnerTicket = tickets.find((t) => t.uid !== uid && t.date === today);
  const partnerProfile = profiles.find((p) => p.uid !== uid) || null;
  const me = profiles.find((p) => p.uid === uid) || null;
  const monthStart = `${today.slice(0, 7)}-01`;
  const jackpots = tickets.filter((t) => t.date >= monthStart && t.tier === "jackpot" && t.revealed).length;
  const played = !!mine?.revealed;

  const line = (t: LotteryTicket | undefined, who: Profile | null, fallback: string) => {
    const name = who?.name || t?.name || fallback;
    const sym = t ? symbolsOf(t).join("") : "";
    let text: string;
    if (!t || !t.revealed) text = "아직 안 긁었어요";
    else if (t.tier === "jackpot") text = "👑 1등 🎰🎰🎰 치맥!";
    else if (t.tier === "love") text = "💕 숨겨진 하트! 뽀뽀 해주기";
    else if (t.tier === "prize") text = `${t.rank}등 ${prizeText(t)}`;
    else if (t.tier === "bomb") text = "💣💣💣 폭탄! 다음 주 외식 금지";
    else if (t.tier === "almost") text = isBombPair(t) ? `휴, 폭탄 피했다! ${sym}` : `아깝다! ${sym}`;
    else text = `꽝 ${sym}`;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar profile={who} size={22} zoomable />
        <span className="text-sm font-semibold text-toss-text shrink-0">{name}</span>
        <span className={`text-sm truncate ${t?.tier === "jackpot" ? "font-bold text-amber-600" : t?.tier === "love" ? "font-bold text-rose-500" : t?.tier === "bomb" ? "font-bold text-gray-800" : "text-toss-sub"}`}>{text}</span>
      </div>
    );
  };

  return (
    <section onClick={onOpen} role="button" aria-label="오늘의 복권 열기" className="bg-white rounded-3xl p-4 shadow-sm mb-4 cursor-pointer active:scale-[0.99] transition">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-toss-text">🎟️ 오늘의 복권</h2>
        <span className="flex items-center gap-2">
          {jackpots > 0 && <span className="text-xs font-bold text-toss-red">이번 달 치맥 {jackpots}번 🍗</span>}
          <button type="button" aria-label="쿠폰함 열기" onClick={(e) => { e.stopPropagation(); onOpenCoupons(); }}
            className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold active:scale-95 transition">
            🎫 쿠폰 {couponCount}
          </button>
          <span className="text-xl leading-none text-toss-muted">›</span>
        </span>
      </div>

      {ban && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          💣 이번 주 외식·배달 금지 <span className="font-normal text-white/70">~{md(ban.to)}(일) · {ban.by}의 폭탄</span>
          {banBroken > 0 && <span className="block text-xs font-normal text-amber-300 mt-0.5">😅 그런데 벌써 외식 {banBroken}번… 남은 날은 꼭 집밥!</span>}
        </div>
      )}
      {!ban && nextBan && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-800 text-sm font-semibold">
          💣 다음 주 외식·배달 금지 예고 <span className="font-normal text-toss-sub">{md(nextBan.from)}(월)~{md(nextBan.to)}(일) · {nextBan.by}의 폭탄</span>
        </div>
      )}

      {!played && (
        <button type="button" onClick={onOpen}
          className="mt-3 w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 border border-amber-200 active:scale-[0.99] transition">
          <span className="text-left">
            <span className="block text-sm font-bold text-toss-text">{mine ? "긁다 만 복권이 있어요!" : "오늘의 복권이 도착했어요"}</span>
            <span className="block text-xs text-toss-sub mt-0.5">🎰🎰🎰이 나오면 묻지도 따지지도 않고 치맥 GO 🍗🍺</span>
          </span>
          <span className="shrink-0 px-3 py-1.5 rounded-full bg-toss-amber text-white text-sm font-bold">긁기</span>
        </button>
      )}
      {!played && partnerTicket?.revealed && <div className="mt-2">{line(partnerTicket, partnerProfile, "상대방")}</div>}

      {played && mine && (
        <div className="mt-2 w-full text-left space-y-1.5">
          {line(mine, me, "나")}
          {line(partnerTicket, partnerProfile, "상대방")}
          {(mine.tier === "lose" || mine.tier === "almost") && <p className="text-xs text-toss-sub pt-0.5">아쉽지만 내일 또 도전해봐요! 🍀</p>}
        </div>
      )}
    </section>
  );
}
