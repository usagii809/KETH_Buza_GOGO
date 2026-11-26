import { useState } from "react";
import { CATEGORIES, CATEGORY_MAP, GROUPS, budgetOf, isHiddenCategory, normalizeCategory, type Budget } from "../../lib/categories";
import type { PeriodInfo } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import { store } from "../../lib/storage";
import type { Transaction } from "../../lib/types";
import { Card, ProgressBar, Segmented } from "../../ui/controls";
import { compareWithPrev, computeAllowance, getStatus, pctChange, STATUS, type Allowance, type AvailableMode, type Summary } from "./calc";

const TITLES: Record<AvailableMode, string> = { day: "하루 가용 예산", week: "이번 주 가용 예산", month: "이번 달 가용 예산" };

export function BudgetCard({ budget, s, period, txs, prevTxs }: { budget: Budget; s: Summary; period: PeriodInfo; txs: Transaction[]; prevTxs: Transaction[] }) {
  const [mode, setMode] = useState<AvailableMode>(() => {
    const v = store.get("periodMode", "day");
    return v === "week" || v === "month" ? v : "day";
  });
  const changeMode = (m: AvailableMode) => { setMode(m); store.set("periodMode", m); };
  const [help, setHelp] = useState<"variable" | "food" | null>(null);
  const toggleHelp = (k: "variable" | "food") => setHelp((h) => (h === k ? null : k));

  const isPast = period.state === "past";
  const effective: AvailableMode = isPast ? "month" : mode;
  const foodBudget = CATEGORIES.filter((c) => c.group === "FOOD").reduce((t, c) => t + budgetOf(budget, c.key), 0);
  const isFood = (t: Transaction) => CATEGORY_MAP[normalizeCategory(t.category)].group === "FOOD";
  const all = computeAllowance(s.totalVariableBudget, txs, period, effective);
  const food = computeAllowance(foodBudget, txs, period, effective, isFood);
  const marker = period.state === "current" ? period.elapsedPct : null;

  const mom = compareWithPrev(s.usage, prevTxs, period);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-toss-text">{isPast ? "이 달은 마감됐어요" : TITLES[mode]}</h2>
        {!isPast && <Segmented<AvailableMode> options={[["day", "하루"], ["week", "이번 주"], ["month", "이번 달"]]} value={mode} onChange={changeMode} />}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <AllowanceBox title="변동지출" a={all} mode={effective} period={period} help={help === "variable"} onHelp={() => toggleHelp("variable")} />
        <AllowanceBox title="🍽️ 식비" a={food} mode={effective} period={period} help={help === "food"} onHelp={() => toggleHelp("food")} blue />
      </div>

      {help && <CalcHelp kind={help} a={help === "food" ? food : all} mode={effective} period={period} onClose={() => setHelp(null)} />}

      <div className="pt-4 border-t border-toss-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-base font-bold text-toss-text">항목별 예산</span>
          {marker !== null && <span className="text-xs text-toss-sub flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-toss-text/50" />오늘 위치</span>}
        </div>
        <div className="mb-3" />

        <div className="space-y-5">
          {GROUPS.map((g) => {
            // 숨긴 항목은 예산이나 지출이 있을 때만
            const cats = CATEGORIES.filter((c) => c.group === g.key && (!isHiddenCategory(c.key) || budgetOf(budget, c.key) > 0 || s.usage[c.key] !== 0));
            if (!cats.length) return null;
            const gBudget = cats.reduce((t, c) => t + budgetOf(budget, c.key), 0);
            const gSpent = cats.reduce((t, c) => t + s.usage[c.key], 0);
            return (
              <div key={g.key}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${g.badge}`}>{g.label}</span>
                  <span className="text-xs text-toss-sub num">{gBudget > 0 ? `${formatKRW(gSpent)} / ${formatKRW(gBudget)}` : `${formatKRW(gSpent)} 썼어요`}</span>
                </div>
                <div className="space-y-3.5">
                  {cats.map((cat) => {
                    const b = budgetOf(budget, cat.key);
                    const spent = s.usage[cat.key];
                    const remain = b - spent;
                    const pct = Math.max(0, b > 0 ? Math.round((spent / b) * 100) : spent > 0 ? 100 : 0);
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

const PERIOD_WORD: Record<AvailableMode, string> = { day: "하루", week: "이번 주", month: "이번 달" };

/** 위쪽 두 칸: 기준 금액 · 쓴 돈 · 더/덜 썼는지 */
function AllowanceBox({ title, a, mode, period, help, onHelp, blue }: {
  title: string; a: Allowance; mode: AvailableMode; period: PeriodInfo; help: boolean; onHelp: () => void; blue?: boolean;
}) {
  const past = period.state !== "current";
  const big = mode === "month" ? a.monthBudget : a.limit;
  const barBase = mode === "month" ? a.monthBudget : a.limit;
  const pct = barBase > 0 ? Math.round((a.spent / barBase) * 100) : a.spent > 0 ? 100 : 0;
  const over = a.diff < 0;
  const spentLabel = mode === "day" ? "오늘" : mode === "week" ? `이번 주 (${a.from}~${a.to}일)` : past ? "이 달" : "지금까지";
  const basis = mode === "month" ? (past ? "예산보다" : `오늘까지 기준 ${formatShort(a.limit)}보다`) : "";
  return (
    <div className={`allowance rounded-2xl p-3.5 ${blue ? "bg-toss-blueLight/80" : "bg-toss-bg"}`}>
      <span className={`text-sm block ${blue ? "font-semibold text-toss-blue" : "font-medium text-toss-sub"}`}>
        {title}
        <button type="button" aria-label="계산 방법" onClick={onHelp}
          className={`ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full text-[10px] font-bold align-middle ${help ? "bg-toss-blue text-white" : "bg-white text-toss-sub"}`}>?</button>
      </span>
      <span className="text-[11px] text-toss-sub block mt-0.5">{PERIOD_WORD[mode]} {mode === "month" ? "예산" : "기준"}</span>
      <span className="text-lg font-bold num block text-toss-text leading-tight">{formatKRW(big)}</span>
      <div className="mt-2">
        <ProgressBar pct={pct} barClass={pct > 100 ? "bg-toss-red" : blue ? "bg-toss-blue" : "bg-gray-500"}
          marker={mode === "month" && !past ? period.elapsedPct : null} track={blue ? "bg-white/70" : "bg-white"} />
      </div>
      <span className="text-xs text-toss-sub num mt-1.5 block leading-snug">{spentLabel} {formatKRW(a.spent)} 썼어요</span>
      <span className={`allowance-diff text-sm font-bold num block mt-0.5 leading-snug ${over ? "text-toss-red" : "text-toss-green"}`}>
        {mode === "month" && <span className="block text-[11px] font-medium text-toss-sub">{basis}</span>}
        {a.diff === 0 ? "딱 맞게 썼어요 👌" : over ? `${formatKRW(-a.diff)} 더 썼어요` : `${formatKRW(a.diff)} 덜 썼어요 👍`}
      </span>
    </div>
  );
}

/** ? 를 누르면 나오는 계산식 */
function CalcHelp({ kind, a, mode, period, onClose }: { kind: "variable" | "food"; a: Allowance; mode: AvailableMode; period: PeriodInfo; onClose: () => void }) {
  const past = period.state !== "current";
  const name = kind === "food" ? "식비" : "변동지출";
  const line = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-2 ${strong ? "font-bold text-toss-text" : "text-toss-sub"}`}><span>{label}</span><span className="num shrink-0">{value}</span></div>
  );
  const diffText = a.diff >= 0 ? `${formatKRW(a.diff)} 덜 씀` : `${formatKRW(-a.diff)} 더 씀`;
  return (
    <div className="mb-5 -mt-2 p-3.5 rounded-2xl bg-toss-bg text-sm space-y-1 animate-sheet-up">
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-toss-text">{kind === "food" ? "🍽️ 식비는" : "변동지출은"} 이렇게 계산해요</p>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-toss-sub px-1">✕</button>
      </div>
      {line(`이번 달 ${name} 예산`, formatKRW(a.monthBudget))}
      {line(`÷ ${period.m}월 일수`, `${period.dim}일`)}
      {line("= 하루 기준 (한 달 내내 같아요)", formatKRW(a.daily), true)}
      <div className="pt-1.5 mt-1 border-t border-toss-border space-y-1">
        {mode === "day" && <>{line("오늘 기준", formatKRW(a.limit))}{line("− 오늘 쓴 돈", formatKRW(a.spent))}</>}
        {mode === "week" && <>{line(`× 이번 주 ${a.from}~${a.to}일`, `${a.days}일`)}{line("= 이번 주 기준", formatKRW(a.limit))}{line("− 이번 주 쓴 돈", formatKRW(a.spent))}</>}
        {mode === "month" && !past && <>{line(`× 오늘까지 (1~${a.to}일)`, `${a.days}일`)}{line("= 오늘까지 기준", formatKRW(a.limit))}{line("− 지금까지 쓴 돈", formatKRW(a.spent))}</>}
        {mode === "month" && past && <>{line("이 달 예산", formatKRW(a.limit))}{line("− 이 달에 쓴 돈", formatKRW(a.spent))}</>}
        {line("= 차이", diffText, true)}
      </div>
      <p className="text-xs text-toss-sub pt-1.5 leading-relaxed">
        {kind === "food" ? "식재료 + 외식·배달 + 카페·디저트를 합쳐서 계산해요. " : "통신비·생필품처럼 한 번에 나가는 돈도 그날 쓴 돈으로 쳐요. "}
        {mode === "month" && !past ? `이번 달 예산은 ${formatKRW(a.monthBudget - a.monthSpent)} 남았어요.` : "덜 쓴 날이 있어도 하루 기준은 바뀌지 않아요."}
      </p>
    </div>
  );
}
