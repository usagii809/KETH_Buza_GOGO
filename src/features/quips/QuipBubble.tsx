import { useState } from "react";
import type { PeriodInfo } from "../../lib/dates";
import { todayStr } from "../../lib/dates";
import type { Summary } from "../budget/calc";
import { dateEgg, dateEggFx, type QuipFx } from "../fun/eggs";
import { emojiFloat, emojiPop, emojiRain } from "../fun/confetti";
import { getSpendTier, pickQuip, TIERS } from "./quips";

/** 한 달 예산 사용률에 따라 바뀌는 한마디. 앱에 들어올 때마다 무작위로 골라요 */
/** 특별한 날의 문구 + 누르면 터지는 효과 */
export interface QuipOverride {
  text: string;
  /** 누를 때마다 터지는 효과 (예: 🍗🍺 팡팡 · 💣😭 와르르) */
  fx?: QuipFx;
}

/** 💣 외식 금지 주간: 이름표로 붙고, 한마디는 평소대로 */
export interface QuipBan {
  /** 금지 마지막 날 (일요일, YYYY-MM-DD) */
  to: string;
  /** 폭탄 맞은 사람 */
  by: string;
}

/** 이름표 문구: "외식 금지 · 3일 남음" / 마지막 날엔 "외식 금지 · 오늘까지" (오늘 포함해서 세요) */
export function banChipText(today: string, to: string): string {
  const days = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000) + 1;
  return days <= 1 ? "외식 금지 · 오늘까지" : `외식 금지 · ${days}일 남음`;
}

/**
 * override: 오늘 복권 1등 같은 특별한 날의 문구
 * ban: 외식 금지 주간이면 모드 이름표 옆에 💣 이름표 (한마디는 평소 · 기념일 문구 그대로)
 */
export function QuipBubble({ s, period, now, override, ban }: { s: Summary; period: PeriodInfo; now: Date; override?: QuipOverride | null; ban?: QuipBan | null }) {
  // 앱을 열 때 한 번 뽑아두고, 화면이 다시 그려져도 그대로 유지
  const [roll] = useState(() => Math.floor(Math.random() * 1000));
  const tier = getSpendTier(s, period);
  if (tier === null) return null;
  const t = TIERS[tier];
  const pct = Math.round((s.totalVariableSpent / s.totalVariableBudget) * 100);
  // 특별한 날(복권 1등 · 외식 금지 주) 문구가 먼저, 없으면 기념일 문구 · 효과 (이번 달 화면에서만)
  const today = todayStr(now);
  const egg = period.state === "current" ? dateEgg(today) : null;
  const special: QuipOverride | null = period.state === "current" ? (override || (egg ? { text: egg, fx: dateEggFx(today) ?? undefined } : null)) : null;
  const banNow = period.state === "current" ? ban : null;
  // 누르면: 특별한 날 효과가 먼저, 없으면 폭탄 주간엔 💣😭 와르르
  const fx: QuipFx | undefined = special?.fx ?? (banNow ? { kind: "rain", emojis: ["💣", "😭"] } : undefined);
  const banLabel = banNow ? banChipText(today, banNow.to) : "";
  const onTap = (e: React.MouseEvent) => {
    if (!fx) return;
    // 키보드로 누르면 clientX가 0이라 말풍선 가운데에서 터지게
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top + r.height / 2;
    if (fx.kind === "pop") emojiPop(fx.emojis, x, y);
    else if (fx.kind === "float") emojiFloat(fx.emojis, x, y);
    else emojiRain(fx.emojis);
  };
  const Tag = fx ? "button" : "div";
  return (
    <Tag {...(fx ? { type: "button" as const, onClick: onTap, "aria-label": `${special?.text || "오늘의 한마디"}${banNow ? `, ${banLabel} (${banNow.by}의 폭탄)` : ""} (누르면 ${fx.emojis.join("")})` } : {})}
      className={`quip-bubble block w-full text-left mb-4 px-4 py-3 rounded-2xl border ${t.bg} ${fx ? "active:scale-[0.98] transition select-none" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 min-w-0">
          <span className={`inline-block shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${t.chip}`}>{t.label}</span>
          {banNow && (
            <span className="ban-chip inline-flex items-center gap-0.5 shrink-0 px-2 py-0.5 rounded-full bg-gray-900 text-amber-300 text-[11px] font-bold whitespace-nowrap" title={`${banNow.by}의 폭탄`}>
              💣 {banLabel}
            </span>
          )}
        </span>
        <span className="text-[11px] font-semibold text-toss-sub num whitespace-nowrap">예산 {pct}% 사용</span>
      </div>
      <p className="text-sm font-semibold text-toss-text mt-1.5 leading-snug">{special?.text || pickQuip(tier, `${period.key}|${today}`, roll)}</p>
    </Tag>
  );
}
