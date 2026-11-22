import type { LotteryTicket, Profile } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";
import { symbolsOf, tierTitle } from "./ticket";

interface Props {
  uid: string;
  today: string;
  /** 지난달 말일 ~ 이번 달 복권 기록 (두 사람 모두) */
  tickets: LotteryTicket[];
  profiles: Profile[];
  /** 오늘이 강제 무지출 데이면 폭탄을 긁은 사람 이름 */
  bombBy: string | null;
  onOpen: () => void;
}

/** 대시보드의 '오늘의 복권' 카드: 아직이면 긁으러 가기, 긁었으면 둘의 결과 */
export function LotteryCard({ uid, today, tickets, profiles, bombBy, onOpen }: Props) {
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
    else if (t.tier === "prize") text = `${t.rank}등 ${t.prize}`;
    else if (t.tier === "bomb") text = "💣💣💣 폭탄! 내일 강제 무지출";
    else if (t.tier === "almost") text = `아깝다! ${sym}`;
    else text = `꽝 ${sym}`;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Avatar profile={who} size={22} />
        <span className="text-sm font-semibold text-toss-text shrink-0">{name}</span>
        <span className={`text-sm truncate ${t?.tier === "jackpot" ? "font-bold text-amber-600" : t?.tier === "love" ? "font-bold text-rose-500" : t?.tier === "bomb" ? "font-bold text-gray-800" : "text-toss-sub"}`}>{text}</span>
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-toss-text">🎟️ 오늘의 복권</h2>
        {jackpots > 0 && <span className="text-xs font-bold text-toss-red">이번 달 치맥 {jackpots}번 🍗</span>}
      </div>

      {bombBy && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          💣 오늘은 강제 무지출 데이! <span className="font-normal text-white/70">어제 {bombBy}의 폭탄</span>
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
        <button type="button" onClick={onOpen} className="mt-2 w-full text-left space-y-1.5">
          <p className={`text-sm font-bold ${mine.tier === "jackpot" ? "text-amber-600" : "text-toss-text"}`}>{tierTitle(mine.tier, mine.rank)}</p>
          {line(mine, me, "나")}
          {line(partnerTicket, partnerProfile, "상대방")}
        </button>
      )}
    </section>
  );
}
