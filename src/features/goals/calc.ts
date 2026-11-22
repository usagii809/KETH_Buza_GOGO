import { formatShort } from "../../lib/format";
import type { Goal } from "../../lib/types";

const DAY_MS = 86400000;

export const goalPct = (g: Goal) => (g.target > 0 ? Math.min(100, Math.floor(((Number(g.saved) || 0) / g.target) * 100)) : 0);
export const goalRemain = (g: Goal) => (Number(g.target) || 0) - (Number(g.saved) || 0);

function monthsLaterLabel(n: number, now: Date) {
  const d = new Date(now);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/**
 * 달성 예상:
 * 1) 한 달(25일) 이상 모은 기록이 있으면 그 속도로
 * 2) 아니면 이번 달 계획 저축액을 매달 넣는다고 가정
 */
export function goalEta(g: Goal, plannedSavings: number, now = new Date()): string {
  const remain = goalRemain(g);
  if (!g.target || remain <= 0) return "";
  const hist = (g.history || []).filter((h) => h && h.at);
  if (hist.length) {
    const first = Math.min(...hist.map((h) => h.at));
    const span = now.getTime() - first;
    if (span >= 25 * DAY_MS) {
      const net = hist.reduce((s, h) => s + (Number(h.amount) || 0), 0);
      const perMonth = net / (span / (30.44 * DAY_MS));
      if (perMonth > 0) return `지금 속도면 ${monthsLaterLabel(Math.ceil(remain / perMonth), now)}에 달성해요`;
    }
  }
  if (plannedSavings > 0) {
    return `매달 ${formatShort(plannedSavings)}씩 모으면 ${Math.ceil(remain / plannedSavings)}개월 걸려요`;
  }
  return "";
}

export const GOAL_EMOJIS = ["🏝️", "🏠", "🚗", "💍", "👶", "💰", "📈", "🎁"];
