import { useState } from "react";
import { CATEGORIES, GROUPS, type Budget } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import { store } from "../../lib/storage";
import type { Transaction } from "../../lib/types";
import { Card, ProgressBar, Segmented } from "../../ui/controls";
import { compareWithPrev, computeAvailable, getStatus, pctChange, STATUS, type AvailableMode, type Summary } from "./calc";

const TITLES: Record<AvailableMode, string> = { day: "하루 가용 예산", week: "이번 주 가용 예산", month: "이번 달 가용 예산" };

export function BudgetCard({ budget, s, period, prevTxs }: { budget: Budget; s: Summary; period: PeriodInfo; prevTxs: Transaction[] }) {
  const [mode, setMode] = useState<AvailableMode>(() => {
    const v = store.get("periodMode", "day");
    return v === "week" || v === "month" ? v : "day";
  });
  const changeMode = (m: AvailableMode) => { setMode(m); store.set("periodMode", m); };

  const isPast = period.state === "past";
  const effective: AvailableMode = isPast ? "month" : mode;
  const a = computeAvailable(budget, s, period, effective);
  const daysNote = effective === "day" ? `남은 ${period.daysLeft}일 동안 나눠 쓰면 돼요` : `일요일까지 ${period.weekLeft}일 남았어요`;

  const foodPct = a.foodBudget > 0 ? Math.round((a.foodSpent / a.foodBudget) * 100) : 0;
  const foodStatus = getStatus(a.foodSpent, a.foodBudget, period, true);
  const foodHint = foodStatus === STATUS.over ? "식비 예산을 넘었어요" : foodStatus === STATUS.fast ? "평소보다 빨리 쓰고 있어요" : `${formatShort(a.foodSpent)} / ${formatShort(a.foodBudget)}`;
  const marker = period.state === "current" ? period.elapsedPct : null;

  const mom = compareWithPrev(s.usage, prevTxs, period);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-toss-text">{isPast ? "이 달은 마감됐어요" : TITLES[mode]}</h2>
        {!isPast && <Segmented<AvailableMode> options={[["day", "하루"], ["week", "이번 주"], ["month", "이번 달"]]} value={mode} onChange={changeMode} />}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-toss-bg rounded-2xl p-3.5">
          <span className="text-sm font-medium text-toss-sub block">변동지출 전체</span>
          <span className={`text-lg font-bold num mt-1 block ${a.variableExhausted || a.variable < 0 ? "text-toss-red" : "text-toss-text"}`}>{formatKRW(a.variable)}</span>
          <span className="text-xs text-toss-sub num mt-1 block leading-snug">
            {effective === "month"
              ? `${formatShort(s.totalVariableBudget)} 중 ${formatShort(s.totalVariableSpent)} 썼어요`
              : a.variableExhausted ? "이번 달 예산을 다 썼어요 🥲" : `${daysNote} (통신비·생필품·의류 빼고)`}
          </span>
        </div>
        <div className="bg-toss-blueLight/80 rounded-2xl p-3.5">
          <span className="text-sm font-semibold text-toss-blue block">🍽️ 식비</span>
          <span className={`text-lg font-bold num mt-1 block ${a.foodExhausted ? "text-toss-red" : "text-toss-text"}`}>{formatKRW(a.food)}</span>
          <div className="mt-2"><ProgressBar pct={foodPct} barClass={foodStatus.bar} marker={marker} track="bg-white/70" /></div>
          <span className="text-xs text-toss-sub num mt-1 block leading-snug">{foodHint} · <b className={foodStatus.text}>{foodPct}%</b></span>
        </div>
      </div>

      <div className="pt-4 border-t border-toss-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-base font-bold text-toss-text">항목별 예산</span>
          {marker !== null && <span className="text-xs text-toss-sub flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-toss-text/50" />오늘 위치</span>}
        </div>
        <div className="mb-3" />

        <div className="space-y-5">
          {GROUPS.map((g) => {
            const cats = CATEGORIES.filter((c) => c.group === g.key);
            const gBudget = cats.reduce((t, c) => t + budget[c.key], 0);
            const gSpent = cats.reduce((t, c) => t + s.usage[c.key], 0);
            return (
              <div key={g.key}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${g.badge}`}>{g.label}</span>
                  <span className="text-xs text-toss-sub num">{formatKRW(gSpent)} / {formatKRW(gBudget)}</span>
                </div>
                <div className="space-y-3.5">
                  {cats.map((cat) => {
                    const b = budget[cat.key];
                    const spent = s.usage[cat.key];
                    const remain = b - spent;
                    const pct = b > 0 ? Math.round((spent / b) * 100) : spent > 0 ? 100 : 0;
                    const st = getStatus(spent, b, period, cat.paced);
                    const prev = mom?.prev[cat.key] ?? 0;
                    const change = mom ? pctChange(spent, prev) : null;
                    return (
                      <div key={cat.key}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-semibold text-toss-text truncate min-w-0">{cat.label}</span>
                          <span className={`font-bold num shrink-0 ml-2 ${remain < 0 ? "text-toss-red" : "text-toss-text"}`}>
                            {remain < 0 ? `${formatKRW(-remain)} 넘었어요` : `${formatKRW(remain)} 남음`}
                          </span>
                        </div>
                        <ProgressBar pct={pct} barClass={st.bar} marker={cat.paced ? marker : null} />
                        <div className="flex justify-between items-center text-xs text-toss-sub num mt-1 gap-2">
                          <span className="truncate">
                            {formatKRW(spent)} / {formatKRW(b)}
                            {change !== null && change !== 0 && <> · <span className={change > 0 ? "text-toss-red" : "text-toss-green"}>지난달 {change > 0 ? "▲" : "▼"}{Math.abs(change)}%</span></>}
                            {mom && prev === 0 && spent > 0 && <> · 지난달엔 안 썼어요</>}
                          </span>
                          <span className={`font-bold shrink-0 ${st.text}`}>{st === STATUS.fast ? "빨라요 · " : ""}{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
