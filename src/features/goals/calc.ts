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
  // 매달 모을 돈을 정해뒀으면 그 계획대로
  const monthly = Number(g.monthly) || 0;
  if (monthly > 0) return `매달 ${formatShort(monthly)}씩 모으면 ${monthsLaterLabel(Math.ceil(remain / monthly), now)}에 달성해요`;
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

export interface MonthlyPlan {
  /** 목표들의 '매달 모을 돈' 합계 (다 모은 목표는 빼요) */
  monthlyTotal: number;
  /** 수입 − 고정지출 − 매달 모을 돈 = 이번 달 쓸 수 있는 돈 */
  canSpend: number;
  spent: number;
  /** 쓸 수 있는 돈 − 지금까지 쓴 돈 */
  left: number;
  /** 쓸 수 있는 돈 − 변동지출 예산 (음수면 예산을 줄여야 목표를 지켜요) */
  vsBudget: number;
  /** 남은 날 하루에 쓸 수 있는 돈 (이번 달만) */
  perDay: number | null;
}

export function monthlyPlan(goals: Goal[], income: number, fixedTotal: number, variableBudget: number, spent: number, daysLeft: number | null): MonthlyPlan | null {
  const monthlyTotal = goals.filter((g) => goalRemain(g) > 0).reduce((t, g) => t + (Number(g.monthly) || 0), 0);
  if (monthlyTotal <= 0 || income <= 0) return null;
  const canSpend = income - fixedTotal - monthlyTotal;
  const left = canSpend - spent;
  return {
    monthlyTotal, canSpend, spent, left,
    vsBudget: canSpend - variableBudget,
    perDay: daysLeft && daysLeft > 0 ? Math.floor(Math.max(0, left) / daysLeft / 100) * 100 : null
  };
}
