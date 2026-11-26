import type { Goal, LotteryTicket, Profile, Transaction } from "../../lib/types";

export const REACTIONS = ["👍", "❤️", "😱", "🥲"] as const;

export type FeedItem =
  | { kind: "record"; id: string; at: number; who: string; tx: Transaction }
  | { kind: "reaction"; id: string; at: number; who: string; tx: Transaction; emoji: string }
  | { kind: "lottery"; id: string; at: number; who: string; ticket: LotteryTicket }
  | { kind: "coupon"; id: string; at: number; who: string; ticket: LotteryTicket }
  | { kind: "goalMoney"; id: string; at: number; who: string; goal: Goal; amount: number; settle?: string }
  | { kind: "goalNew"; id: string; at: number; who: string; goal: Goal };

/** 기록 말고 같이 보여줄 활동들 */
export interface FeedExtras {
  /** 복권 (긁은 것) */
  tickets?: LotteryTicket[];
  /** 쿠폰 (쓴 것 포함) */
  coupons?: LotteryTicket[];
  goals?: Goal[];
  /** 이 시각 이후 활동만 (기본 30일) */
  since?: number;
}

export const FEED_EXTRA_DAYS = 30;

/**
 * 같이 보기 피드 (상대가 한 일만)
 * - 상대가 직접 남긴 기록 (자동 기록은 빼요)
 * - 내 기록에 상대가 남긴 반응
 * - 상대의 복권 결과 · 쿠폰 사용 · 저축 목표에 넣고 뺀 돈 · 월말 정산 · 새 저축 목표
 */
export function buildFeed(txs: Transaction[], uid: string, profiles: Profile[], max = 40, extras: FeedExtras = {}): FeedItem[] {
  const nameOf = (id?: string) => profiles.find((p) => p.uid === id)?.name || "상대";
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const tx of txs) {
    if (seen.has(tx.id)) continue;
    seen.add(tx.id);
    if (tx.createdBy && tx.createdBy !== uid && !tx.auto) {
      items.push({ kind: "record", id: `r_${tx.id}`, at: Number(tx.createdAt) || 0, who: nameOf(tx.createdBy), tx });
    }
    if (tx.createdBy === uid && tx.reactions) {
      for (const [rid, r] of Object.entries(tx.reactions)) {
        if (rid === uid || !r || !r.e) continue;
        items.push({ kind: "reaction", id: `x_${tx.id}_${rid}`, at: Number(r.at) || 0, who: nameOf(rid), tx, emoji: r.e });
      }
    }
  }
  const since = extras.since ?? Date.now() - FEED_EXTRA_DAYS * 86400000;
  const isPartner = (id?: string) => !!id && id !== uid;

  // 복권: 오늘의 복권은 날마다 있어서 한 사람당 하루 한 장
  const tickets = new Map<string, LotteryTicket>();
  for (const t of [...(extras.tickets || []), ...(extras.coupons || [])]) tickets.set(t.id, t);
  for (const t of tickets.values()) {
    if (!isPartner(t.uid)) continue;
    const revealedAt = Number(t.revealedAt || t.createdAt) || 0;
    if (t.revealed && revealedAt >= since) items.push({ kind: "lottery", id: `l_${t.id}`, at: revealedAt, who: nameOf(t.uid), ticket: t });
    const usedAt = Number(t.usedAt) || 0;
    if (usedAt >= since) items.push({ kind: "coupon", id: `c_${t.id}`, at: usedAt, who: nameOf(t.uid), ticket: t });
  }

  for (const g of extras.goals || []) {
    const createdAt = Number(g.createdAt) || 0;
    if (isPartner(g.createdBy) && createdAt >= since) items.push({ kind: "goalNew", id: `gn_${g.id}`, at: createdAt, who: nameOf(g.createdBy), goal: g });
    (g.history || []).forEach((h, i) => {
      const at = Number(h.at) || 0;
      const amount = Number(h.amount) || 0;
      if (!isPartner(h.by) || at < since || !amount) return;
      items.push({ kind: "goalMoney", id: `gm_${g.id}_${at}_${i}`, at, who: nameOf(h.by), goal: g, amount, ...(h.settle ? { settle: h.settle } : {}) });
    });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, max);
}

export const countUnseen = (items: FeedItem[], lastSeen: number) => items.filter((i) => i.at > lastSeen).length;

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
