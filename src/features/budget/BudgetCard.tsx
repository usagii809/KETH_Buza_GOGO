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
  const [help, setHelp] = useState<"variable" | "food" | null>(null);
  const toggleHelp = (k: "variable" | "food") => setHelp((h) => (h === k ? null : k));

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
          <span className="text-sm font-medium text-toss-sub block">변동지출 전체<button type="button" aria-label="계산 방법" onClick={() => toggleHelp("variable")}
            className={`ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] font-bold align-middle ${help === "variable" ? "bg-toss-blue text-white" : "bg-white text-toss-sub"}`}>?</button></span>
          <span className={`text-lg font-bold num mt-1 block ${a.variableExhausted || a.variable < 0 ? "text-toss-red" : "text-toss-text"}`}>{formatKRW(a.variable)}</span>
          <span className="text-xs text-toss-sub num mt-1 block leading-snug">
            {effective === "month"
              ? `${formatShort(s.totalVariableBudget)} 중 ${formatShort(s.totalVariableSpent)} 썼어요`
              : a.variableExhausted ? "이번 달 예산을 다 썼어요 🥲" : `${daysNote} (통신비·생필품·의류 빼고)`}
          </span>
        </div>
        <div className="bg-toss-blueLight/80 rounded-2xl p-3.5">
          <span className="text-sm font-semibold text-toss-blue block">🍽️ 식비<button type="button" aria-label="계산 방법" onClick={() => toggleHelp("food")}
            className={`ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] font-bold align-middle ${help === "food" ? "bg-toss-blue text-white" : "bg-white text-toss-sub"}`}>?</button></span>
          <span className={`text-lg font-bold num mt-1 block ${a.foodExhausted ? "text-toss-red" : "text-toss-text"}`}>{formatKRW(a.food)}</span>
          <div className="mt-2"><ProgressBar pct={foodPct} barClass={foodStatus.bar} marker={marker} track="bg-white/70" /></div>
          <span className="text-xs text-toss-sub num mt-1 block leading-snug">{foodHint} · <b className={foodStatus.text}>{foodPct}%</b></span>
        </div>
      </div>

      {help && (
        <CalcHelp kind={help} mode={effective} daysLeft={period.daysLeft} weekLeft={period.weekLeft}
          budget={help === "food" ? a.foodBudget : effective === "month" ? s.totalVariableBudget : s.pacedBudget}
          spent={help === "food" ? a.foodSpent : effective === "month" ? s.totalVariableSpent : s.pacedSpent}
          result={help === "food" ? a.food : a.variable} onClose={() => setHelp(null)} />
      )}

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
                  <span className="text-xs text-toss-sub num">{gBudget > 0 ? `${formatKRW(gSpent)} / ${formatKRW(gBudget)}` : `${formatKRW(gSpent)} 썼어요`}</span>
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
                    const prevNote = mom && (prev > 0 ? `지난달 ${formatKRW(prev)}` : spent > 0 ? "지난달엔 안 썼어요" : "");
                    // 예산을 안 정한 항목(통신비·교통비 등): 막대 없이 쓴 돈만
                    if (b <= 0) return (
                      <div key={cat.key} className="flex items-center justify-between gap-2 py-1 px-3 -mx-1 rounded-xl bg-toss-bg/70">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-toss-text">{cat.label}</span>
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-toss-sub align-middle">기록만</span>
                          {prevNote && <span className="block text-xs text-toss-sub num">{prevNote}</span>}
                        </div>
                        <span className="text-sm font-bold num shrink-0 text-toss-text">{spent > 0 ? `${formatKRW(spent)} 썼어요` : "아직 없어요"}</span>
                      </div>
                    );
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

/** ? 를 누르면 나오는 계산식 */
function CalcHelp({ kind, mode, daysLeft, weekLeft, budget, spent, result, onClose }: {
  kind: "variable" | "food"; mode: AvailableMode; daysLeft: number; weekLeft: number; budget: number; spent: number; result: number; onClose: () => void;
}) {
  const remain = budget - spent;
  const name = kind === "food" ? "식비" : mode === "month" ? "변동지출" : "매일 쓰는 변동지출";
  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-2 ${strong ? "font-bold text-toss-text" : "text-toss-sub"}`}><span>{label}</span><span className="num shrink-0">{value}</span></div>
  );
  return (
    <div className="mb-5 -mt-2 p-3.5 rounded-2xl bg-toss-bg text-sm space-y-1 animate-sheet-up">
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-toss-text">{kind === "food" ? "🍽️ 식비" : "변동지출 전체"}는 이렇게 계산해요</p>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-toss-sub px-1">✕</button>
      </div>
      {line(`이번 달 ${name} 예산`, formatKRW(budget))}
      {line("− 지금까지 쓴 돈", formatKRW(spent))}
      {line("= 남은 돈", formatKRW(remain), mode === "month")}
      {mode !== "month" && <>
        {line(`÷ 남은 날 (오늘 포함)`, `${daysLeft}일`)}
        {mode === "week" && line("× 일요일까지 남은 날", `${weekLeft}일`)}
        {line(mode === "day" ? "= 오늘 쓸 수 있는 돈" : "= 이번 주 쓸 수 있는 돈", formatKRW(result), true)}
      </>}
      <p className="text-xs text-toss-sub pt-1.5 leading-relaxed">
        {kind === "food" ? "식재료 + 외식·배달 + 카페·디저트를 합쳐서 계산해요." : mode === "month" ? "변동지출 예산 전체에서 이번 달에 쓴 돈을 빼요." : "통신비·생필품·의류처럼 한 번에 나가는 항목은 빼고 계산해요."}
        {mode !== "month" && " 100원 단위 밑은 버려요. 덜 쓴 날이 있으면 다음 날부터 조금씩 늘어나요."}
      </p>
    </div>
  );
}
