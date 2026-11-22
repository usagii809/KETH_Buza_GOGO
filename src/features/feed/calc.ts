import type { Profile, Transaction } from "../../lib/types";

export const REACTIONS = ["👍", "❤️", "😱", "🥲"] as const;

export type FeedItem =
  | { kind: "record"; id: string; at: number; who: string; tx: Transaction }
  | { kind: "reaction"; id: string; at: number; who: string; tx: Transaction; emoji: string };

/**
 * 같이 보기 피드
 * - 상대가 직접 남긴 기록 (자동 기록은 빼요)
 * - 내 기록에 상대가 남긴 반응
 */
export function buildFeed(txs: Transaction[], uid: string, profiles: Profile[], max = 40): FeedItem[] {
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
