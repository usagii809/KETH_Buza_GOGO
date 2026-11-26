import type { Goal, LotteryTicket, Profile, Reaction, Transaction } from "../../lib/types";

/** 반응 이모지: ➕ 눌러서 골라요 (8개씩 5줄) */
export const REACTIONS = [
  "👍", "❤️", "😱", "🥲", "😂", "😆", "🥹", "🥰",
  "😍", "😘", "🤗", "😎", "🤩", "🥳", "😮", "🤔",
  "🙄", "😭", "😤", "😡", "🫠", "😴", "💔", "👌",
  "👏", "🙏", "💪", "🫶", "👀", "🔥", "💯", "✨",
  "💸", "💰", "🤑", "🍗", "🍺", "☕", "🎉", "💩"
];

/** mine: 내가 한 일 (NEW · 새 소식 숫자엔 안 세요) */
type Base = { id: string; at: number; who: string; mine: boolean };
/** 복권 · 쿠폰 · 저축 소식 (반응을 달 수 있어요) */
export type ActivityItem = Base & { reactions?: Record<string, Reaction> } & (
  | { kind: "lottery"; ticket: LotteryTicket }
  | { kind: "coupon"; ticket: LotteryTicket }
  | { kind: "goalMoney"; goal: Goal; amount: number; settle?: string }
  | { kind: "goalNew"; goal: Goal }
);
export type FeedItem =
  | (Base & { kind: "record"; tx: Transaction })
  | (Base & { kind: "reaction"; tx: Transaction; emoji: string })
  | ActivityItem
  /** 복권 · 쿠폰 · 저축 소식에 단 반응 */
  | (Base & { kind: "actReaction"; target: ActivityItem; emoji: string });

/** 기록 말고 같이 보여줄 활동들 */
export interface FeedExtras {
  /** 복권 (긁은 것) */
  tickets?: LotteryTicket[];
  /** 쿠폰 (쓴 것 포함) */
  coupons?: LotteryTicket[];
  goals?: Goal[];
  /** 복권 · 쿠폰 · 저축 소식에 달린 반응 (소식 id → uid → 반응) */
  reactions?: Record<string, Record<string, Reaction>>;
  /** 이 시각 이후 활동만 (기본 30일) */
  since?: number;
}

export const FEED_EXTRA_DAYS = 30;

/**
 * 같이 보기 피드 (둘이 한 일 전부, 탭에서 전체 · 나 · 상대로 나눠 봐요)
 * - 직접 남긴 기록 (자동 기록은 빼요)
 * - 상대 기록에 남긴 반응 (내 기록에 상대가 · 상대 기록에 내가)
 * - 복권 결과 · 쿠폰 사용 · 저축 목표에 넣고 뺀 돈 · 월말 정산 · 새 저축 목표
 */
export function buildFeed(txs: Transaction[], uid: string, profiles: Profile[], max = 60, extras: FeedExtras = {}): FeedItem[] {
  const nameOf = (id?: string) => profiles.find((p) => p.uid === id)?.name || (id === uid ? "나" : "상대");
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const tx of txs) {
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    if (tx.createdBy && !tx.auto) {
      items.push({ kind: "record", id: `r_${tx.id}`, at: Number(tx.createdAt) || 0, who: nameOf(tx.createdBy), mine: tx.createdBy === uid, tx });
    }
    if (tx.createdBy && tx.reactions) {
      for (const [rid, r] of Object.entries(tx.reactions)) {
        // 자기 기록에 자기가 단 반응은 소식이 아니에요
        if (rid === tx.createdBy || !r || !r.e) continue;
        items.push({ kind: "reaction", id: `x_${tx.id}_${rid}`, at: Number(r.at) || 0, who: nameOf(rid), mine: rid === uid, tx, emoji: r.e });
      }
    }
  }
  const since = extras.since ?? Date.now() - FEED_EXTRA_DAYS * 86400000;
  const known = (id?: string) => !!id;
  // 활동 소식 + 거기 달린 반응 (자기 소식에 자기가 단 반응은 빼요)
  const pushActivity = (a: ActivityItem, ownerUid: string) => {
    const rs = extras.reactions?.[a.id];
    if (rs) a.reactions = rs;
    items.push(a);
    for (const [rid, r] of Object.entries(rs || {})) {
      if (rid === ownerUid || !r || !r.e) continue;
      items.push({ kind: "actReaction", id: `xa_${a.id}_${rid}`, at: Number(r.at) || 0, who: nameOf(rid), mine: rid === uid, target: a, emoji: r.e });
    }
  };

  // 복권: 오늘의 복권은 날마다 있어서 한 사람당 하루 한 장
  const tickets = new Map<string, LotteryTicket>();
  for (const t of [...(extras.tickets || []), ...(extras.coupons || [])]) tickets.set(t.id, t);
  for (const t of tickets.values()) {
    if (!known(t.uid)) continue;
    const mine = t.uid === uid;
    const revealedAt = Number(t.revealedAt || t.createdAt) || 0;
    if (t.revealed && revealedAt >= since) pushActivity({ kind: "lottery", id: `l_${t.id}`, at: revealedAt, who: nameOf(t.uid), mine, ticket: t }, t.uid);
    const usedAt = Number(t.usedAt) || 0;
    if (usedAt >= since) pushActivity({ kind: "coupon", id: `c_${t.id}`, at: usedAt, who: nameOf(t.uid), mine, ticket: t }, t.uid);
  }

  for (const g of extras.goals || []) {
    const createdAt = Number(g.createdAt) || 0;
    if (known(g.createdBy) && createdAt >= since) pushActivity({ kind: "goalNew", id: `gn_${g.id}`, at: createdAt, who: nameOf(g.createdBy), mine: g.createdBy === uid, goal: g }, g.createdBy!);
    (g.history || []).forEach((h, i) => {
      const at = Number(h.at) || 0;
      const amount = Number(h.amount) || 0;
      if (!known(h.by) || at < since || !amount) return;
      pushActivity({ kind: "goalMoney", id: `gm_${g.id}_${at}_${i}`, at, who: nameOf(h.by), mine: h.by === uid, goal: g, amount, ...(h.settle ? { settle: h.settle } : {}) }, h.by!);
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, max);
}

/** 새 소식 = 내가 마지막으로 본 뒤에 상대가 한 일 (내가 한 일은 안 세요) */
export const countUnseen = (items: FeedItem[], lastSeen: number) => items.filter((i) => !i.mine && i.at > lastSeen).length;

/** 방금 · 5분 전 · 3시간 전 · 어제 · 11월 3일 */
export function timeAgo(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = new Date(at);
  const today = new Date(now);
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
