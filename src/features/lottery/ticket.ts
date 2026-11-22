import { nextDay } from "../../lib/dates";
import type { LotteryTicket, LotteryTier, Profile } from "../../lib/types";

/** 1등 그림 */
export const JACKPOT_SYMBOL = "🎰";
/** 특별상 그림: 꽝 복권에는 절대 안 섞이고, 나올 땐 무조건 세 개로만 나와요 */
export const LOVE_SYMBOL = "❤️";

/** 꽝 복권을 채우는 그림들 (하트는 일부러 뺐어요) */
export const LOSE_POOL = [JACKPOT_SYMBOL, "💎", "🐷", "🍀", "🍒", "💣"] as const;

export interface PrizeRow {
  symbol: string;
  tier: LotteryTier;
  /** 등수 (특별상·폭탄은 0) */
  rank: number;
  /** 확률 (0~1) */
  chance: number;
  prize: string;
}

/**
 * 당첨표. 확률을 바꾸고 싶으면 chance만 고치면 돼요.
 * 🤫 ❤️❤️❤️은 숨겨진 이스터 에그라서 화면의 당첨표(?)에는 안 보여요.
 * 합계 약 22%가 당첨/폭탄, 나머지는 꽝(대부분 셋 다 다른 그림)
 */
export const PRIZE_TABLE: PrizeRow[] = [
  { symbol: JACKPOT_SYMBOL, tier: "jackpot", rank: 1, chance: 0.02, prize: "🍗🍺 치맥 당첨! 오늘은 묻지도 따지지도 않고 치맥 GO!" },
  { symbol: "💎", tier: "prize", rank: 2, chance: 0.02, prize: "💆 어깨 안마 10분 이용권" },
  { symbol: "🐷", tier: "prize", rank: 3, chance: 0.03, prize: "🧽 설거지 면제권" },
  { symbol: "🍀", tier: "prize", rank: 4, chance: 0.04, prize: "🎫 로또 한 장 사주기" },
  { symbol: "🍒", tier: "prize", rank: 5, chance: 0.05, prize: "🏃 심부름 1회 이용권" },
  { symbol: LOVE_SYMBOL, tier: "love", rank: 0, chance: 0.03, prize: "💋 뽀뽀 해주기" },
  { symbol: "💣", tier: "bomb", rank: 0, chance: 0.03, prize: "내일은 강제 무지출 데이! 둘 다 하루 동안 지갑 봉인 🔒" }
];

/** 화면에 보여줄 당첨표 (숨겨진 하트는 빼고) */
export const VISIBLE_PRIZES = PRIZE_TABLE.filter((r) => r.tier !== "love");

/** 꽝일 때 오늘의 운세 */
export const FORTUNES = [
  "오늘의 운세: 지갑을 닫으면 행운이 열려요 🔒",
  "오늘의 운세: 편의점 앞을 지나치면 금전운 상승 📈",
  "오늘의 운세: 집밥이 행운을 불러와요 🍚",
  "오늘의 운세: 장바구니는 비울수록 마음이 채워져요 🛒",
  "오늘의 운세: 내일의 복권이 더 반짝일 예정이에요 ✨",
  "오늘의 운세: 무지출하면 새싹이 웃어요 🌱",
  "오늘의 운세: 서로 칭찬 한마디가 최고의 재테크 💬"
];

export interface DrawResult {
  symbols: string[];
  tier: LotteryTier;
  rank: number;
  prize: string;
}

const pick = <T,>(list: readonly T[], rand: () => number) => list[Math.floor(rand() * list.length) % list.length];

/** 복권 한 장 뽑기 */
export function drawTicket(rand: () => number = Math.random): DrawResult {
  const r = rand();
  let acc = 0;
  for (const row of PRIZE_TABLE) {
    acc += row.chance;
    if (r < acc) return { symbols: [row.symbol, row.symbol, row.symbol], tier: row.tier, rank: row.rank, prize: row.prize };
  }
  // 꽝: 무작위 세 칸 (셋 다 같은 그림은 나오지 않게, 하트는 안 나오게)
  const s: string[] = [pick(LOSE_POOL, rand), pick(LOSE_POOL, rand), pick(LOSE_POOL, rand)];
  if (s[0] === s[1] && s[1] === s[2]) s[2] = LOSE_POOL[(LOSE_POOL.indexOf(s[2] as (typeof LOSE_POOL)[number]) + 1) % LOSE_POOL.length];
  if (s.filter((x) => x === JACKPOT_SYMBOL).length === 2) {
    return { symbols: s, tier: "almost", rank: 0, prize: "아깝다! 🎰이 두 개… 치맥이 코앞이었어요 🍺" };
  }
  return { symbols: s, tier: "lose", rank: 0, prize: pick(FORTUNES, rand) };
}

export function tierTitle(tier: LotteryTier, rank = 0): string {
  switch (tier) {
    case "jackpot": return "👑 1등! 🎰🎰🎰 치맥 당첨";
    case "prize": return `🎁 ${rank}등 당첨!`;
    case "love": return "💕 숨겨진 하트 당첨!";
    case "bomb": return "💣 폭탄 세 개!";
    case "almost": return "😮 아깝다!";
    default: return "꽝";
  }
}

/** 1등 그림인지 (예전 777 복권도 1등으로) */
export const isJackpotSymbol = (s: string) => s === JACKPOT_SYMBOL || s === "7";

/** 예전 숫자 복권(digits)도 읽을 수 있게 */
export const symbolsOf = (t: { symbols?: string[]; digits?: number[] }) => t.symbols ?? (t.digits || []).map(String);

/** 💣💣💣이 나온 다음 날 = 강제 무지출 데이. 날짜 → 폭탄 긁은 사람 이름 */
export function forcedNoSpendDays(tickets: LotteryTicket[], profiles: Profile[] = []): Record<string, string> {
  const days: Record<string, string> = {};
  tickets.forEach((t) => {
    if (t.tier !== "bomb" || !t.revealed) return;
    const name = profiles.find((p) => p.uid === t.uid)?.name || t.name || "누군가";
    const d = nextDay(t.date);
    days[d] = days[d] ? `${days[d]}·${name}` : name;
  });
  return days;
}
