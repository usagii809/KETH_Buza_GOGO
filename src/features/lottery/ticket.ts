import { toDateStr } from "../../lib/dates";
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
 * 합계 43%가 당첨/폭탄, 나머지 57%는 꽝 (그중 70%는 두 개가 같은 '아깝다')
 */
export const PRIZE_TABLE: PrizeRow[] = [
  { symbol: JACKPOT_SYMBOL, tier: "jackpot", rank: 1, chance: 0.05, prize: "🍗🍺 치맥 당첨! 오늘은 묻지도 따지지도 않고 치맥 GO!" },
  { symbol: "💎", tier: "prize", rank: 2, chance: 0.05, prize: "💆 어깨 안마 10분 이용권" },
  { symbol: "🐷", tier: "prize", rank: 3, chance: 0.06, prize: "🧽 설거지 면제권" },
  { symbol: "🍀", tier: "prize", rank: 4, chance: 0.07, prize: "🎫 로또 한 장 사주기" },
  { symbol: "🍒", tier: "prize", rank: 5, chance: 0.08, prize: "🏃 심부름 1회 이용권" },
  { symbol: LOVE_SYMBOL, tier: "love", rank: 0, chance: 0.06, prize: "💋 뽀뽀 해주기" },
  { symbol: "💣", tier: "bomb", rank: 0, chance: 0.06, prize: "다음 주 일주일간 외식·배달 봉인 🔒" }
];

/**
 * 화면에 보여줄 상품 문구: 지금 당첨표 문구를 써요
 * (복권 문서에는 뽑을 때의 문구가 저장돼 있어서, 문구를 고쳐도 예전 복권에 옛 문구가 남지 않게)
 */
export function prizeText(t: Pick<LotteryTicket, "tier" | "rank" | "prize">): string {
  const row = PRIZE_TABLE.find((r) => r.tier === t.tier && (t.tier !== "prize" || r.rank === t.rank));
  return row?.prize ?? t.prize ?? "";
}

/** 화면에 보여줄 당첨표 (숨겨진 하트는 빼고) */
export const VISIBLE_PRIZES = PRIZE_TABLE.filter((r) => r.tier !== "love");

/** 꽝일 때 멘트 */
export const LOSE_MESSAGE = "아쉽지만 내일 또 도전해봐요! 🍀";

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
  // 꽝: 70%는 두 칸이 같은 그림(아깝다!), 30%는 셋 다 다른 그림. 하트는 안 나와요
  if (rand() < PAIR_RATE) {
    const a = pick(LOSE_POOL, rand);
    const b = pick(LOSE_POOL.filter((x) => x !== a), rand);
    const s: string[] = [a, a, a];
    s[Math.floor(rand() * 3) % 3] = b; // 다른 그림이 어느 칸에 올지도 무작위
    return { symbols: s, tier: "almost", rank: 0, prize: ALMOST_TEXT[a] };
  }
  const first = pick(LOSE_POOL, rand);
  const second = pick(LOSE_POOL.filter((x) => x !== first), rand);
  const third = pick(LOSE_POOL.filter((x) => x !== first && x !== second), rand);
  return { symbols: [first, second, third], tier: "lose", rank: 0, prize: LOSE_MESSAGE };
}

/** 꽝 중에서 두 칸이 같은 그림으로 나오는 비율 */
export const PAIR_RATE = 0.7;

/** 두 개 같을 때 한마디 */
export const ALMOST_TEXT: Record<(typeof LOSE_POOL)[number], string> = {
  "🎰": "🎰이 두 개… 치맥이 코앞이었어요 🍺",
  "💎": "💎이 두 개… 어깨 안마가 코앞이었어요 💆",
  "🐷": "🐷이 두 개… 설거지 면제가 코앞이었어요 🧽",
  "🍀": "🍀가 두 개… 로또가 코앞이었어요 🎫",
  "🍒": "🍒가 두 개… 심부름권이 코앞이었어요 🏃",
  "💣": "💣이 두 개… 휴, 폭탄은 아슬아슬하게 피했어요 😮‍💨"
};

export function tierTitle(tier: LotteryTier, rank = 0): string {
  switch (tier) {
    case "jackpot": return "👑 1등! 🎰🎰🎰 치맥 당첨";
    case "prize": return `🎁 ${rank}등 당첨!`;
    case "love": return "💕 숨겨진 하트 당첨!";
    case "bomb": return "💣 폭탄 발견!";
    case "almost": return "😮 아깝다!";
    default: return "꽝";
  }
}

/** 1등 그림인지 (예전 777 복권도 1등으로) */
export const isJackpotSymbol = (s: string) => s === JACKPOT_SYMBOL || s === "7";

/** 예전 숫자 복권(digits)도 읽을 수 있게 */
export const symbolsOf = (t: { symbols?: string[]; digits?: number[] }) => t.symbols ?? (t.digits || []).map(String);

/** 💣 외식 금지 기간 */
export interface DiningBan {
  /** 금지 시작 (폭탄 다음 주 월요일) */
  from: string;
  /** 금지 끝 (그 주 일요일) */
  to: string;
  /** 폭탄 긁은 사람 (둘 다면 "태형·경은") */
  by: string;
}

/** 그 날짜가 든 주의 일요일 (월요일 시작) */
export function sundayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return toDateStr(new Date(y, m - 1, d + ((7 - day) % 7)));
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
};

/**
 * 💣💣💣이 나오면 다음 주 월요일 ~ 일요일 동안 둘 다 외식·배달 금지.
 * 날짜 → 그날 걸린 금지
 */
export function diningBanDays(tickets: LotteryTicket[], profiles: Profile[] = []): Record<string, DiningBan> {
  const days: Record<string, DiningBan> = {};
  tickets
    .filter((t) => t.tier === "bomb" && t.revealed && t.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((t) => {
      const name = profiles.find((p) => p.uid === t.uid)?.name || t.name || "누군가";
      const from = addDays(sundayOf(t.date), 1);
      const to = addDays(from, 6);
      for (let i = 0; i < 7; i++) {
        const ds = addDays(from, i);
        const prev = days[ds];
        days[ds] = prev
          ? { ...prev, by: prev.by.split("·").includes(name) ? prev.by : `${prev.by}·${name}` }
          : { from, to, by: name };
      }
    });
  return days;
}

/** 오늘 이후 처음 시작하는 외식 금지 (예고용, 없으면 null) */
export function upcomingDiningBan(bans: Record<string, DiningBan>, today: string): DiningBan | null {
  const next = Object.values(bans).filter((b) => b.from > today).sort((a, b) => a.from.localeCompare(b.from))[0];
  return next || null;
}

/** 외식 금지 주간에 한 외식·배달인지 (회사 돈 · 환불 · 자동 기록은 빼요) */
export function breaksDiningBan(tx: { date: string; category?: string; amount?: number; company?: boolean; auto?: boolean }, bans: Record<string, DiningBan>): boolean {
  return !!bans[tx.date] && tx.category === "foodDining" && !tx.company && !tx.auto && (Number(tx.amount) || 0) > 0;
}
