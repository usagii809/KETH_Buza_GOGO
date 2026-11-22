import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pinMonthBudget, runRecurring } from "./data/db";
import { useAuthUser, useMonthData, useNow, useRecentMonths, useSharedData } from "./data/hooks";
import { LoginView } from "./features/auth/LoginView";
import { BudgetCard } from "./features/budget/BudgetCard";
import { BudgetSheet } from "./features/budget/BudgetSheet";
import { computeSummary } from "./features/budget/calc";
import { SavingsCard } from "./features/budget/SavingsCard";
import { ExpenseSheet } from "./features/expenses/ExpenseSheet";
import { TransactionList } from "./features/expenses/TransactionList";
import { GoalSheet } from "./features/goals/GoalSheet";
import { GoalsCard } from "./features/goals/GoalsCard";
import { NoSpendCard } from "./features/noSpend/NoSpendCard";
import { RecurringSheet } from "./features/recurring/RecurringSheet";
import { QuipBubble } from "./features/quips/QuipBubble";
import { ReportSection } from "./features/report/ReportSection";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { buildMonthBars } from "./features/trend/calc";
import { TrendCard } from "./features/trend/TrendCard";
import { plannedSavingsOf } from "./lib/categories";
import { getPeriodInfo, shiftMonth, todayYm } from "./lib/dates";
import type { Goal, Transaction } from "./lib/types";
import { useFeedback } from "./ui/feedback";

type OpenSheet =
  | { type: "expense"; tx?: Transaction }
  | { type: "budget" }
  | { type: "settings" }
  | { type: "recurring" }
  | { type: "goal"; goalId: string | null; mode: "deposit" | "edit"; prefill?: number }
  | null;

export default function App() {
  const user = useAuthUser();
  if (user === undefined) return <div className="min-h-screen" />;
  if (!user) return <LoginView />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: User }) {
  const { toast } = useFeedback();
  const now = useNow();
  const [ym, setYm] = useState(() => todayYm());
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  const month = useMonthData(ym);
  const shared = useSharedData();
  const recentTxs = useRecentMonths(ym);

  const period = useMemo(() => getPeriodInfo(ym, now), [ym, now]);
  const summary = useMemo(() => computeSummary(month.budget, month.txs, period), [month.budget, month.txs, period]);
  const bars = useMemo(() => buildMonthBars(ym, 6, recentTxs, month.txs, todayYm(now)), [ym, recentTxs, month.txs, now]);
  // 저축 목표 예상에 쓰는 '이번 달 계획 저축액'
  const planned = period.state === "current" ? summary.plannedSavings : plannedSavingsOf(month.defaultBudget);
  // 자동완성: 최근 120일 + 지금 보는 달 (id 중복 제거)
  const history = useMemo(() => [...new Map([...shared.history, ...month.txs].map((t) => [t.id, t])).values()], [shared.history, month.txs]);

  /** 첫 지출이 생기는 달은 그때 예산을 그 달에 고정 */
  const pinIfNeeded = useCallback(async (targetYm: string) => {
    if (targetYm !== ym || !month.overrideLoaded || month.override) return;
    await pinMonthBudget(targetYm, month.budget);
  }, [ym, month.overrideLoaded, month.override, month.budget]);

  // 매달 자동 기록: 규칙이 바뀌거나 앱으로 돌아올 때 확인
  useEffect(() => {
    if (!shared.recurringLoaded) return;
    runRecurring(shared.recurring, user.uid, pinIfNeeded).then((n) => { if (n) toast(`매달 자동 기록 ${n}건을 남겼어요 🔁`); });
    // pinIfNeeded는 일부러 빼요: 예산이 바뀔 때마다 다시 돌 필요는 없어서
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.recurringLoaded, shared.recurring, now, user.uid, toast]);

  const goal = sheet?.type === "goal" && sheet.goalId ? shared.goals.find((g) => g.id === sheet.goalId) ?? null : null;
  const openGoal = (g: Goal, prefill = 0) => setSheet({ type: "goal", goalId: g.id, mode: "deposit", prefill });

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-10">
      <header className="flex items-center justify-between py-2 mb-3">
        <div>
          <span className="text-xs font-bold text-toss-blue tracking-tight">태형이와 경은이의 부자 되기 프로젝트!!</span>
          <div className="flex items-center gap-2 mt-1.5">
            <NavButton label="이전 달" d="M15 19l-7-7 7-7" onClick={() => setYm(shiftMonth(ym, -1))} />
            <h1 className="text-xl font-bold text-toss-text tracking-tight num px-1">{period.y}년 {period.m}월</h1>
            <NavButton label="다음 달" d="M9 5l7 7-7 7" onClick={() => setYm(shiftMonth(ym, 1))} />
            {period.state !== "current" && (
              <button type="button" onClick={() => setYm(todayYm())}
                className="ml-1 px-2.5 py-1 rounded-full bg-toss-blueLight text-toss-blue text-xs font-bold active:scale-95 transition">이번 달로</button>
            )}
          </div>
        </div>
        <button type="button" aria-label="설정" onClick={() => setSheet({ type: "settings" })}
          className="w-10 h-10 rounded-2xl bg-white border border-toss-border flex items-center justify-center text-toss-sub hover:bg-gray-100 active:scale-95 transition shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {month.error && <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-toss-red font-medium leading-relaxed">{month.error}</div>}

      <QuipBubble s={summary} period={period} now={now} />
      <ReportSection period={period} s={summary} txs={month.txs} prevTxs={month.prevTxs} goals={shared.goals} now={now}
        onOpenLastMonth={() => setYm(shiftMonth(todayYm(now), -1))} onDepositToGoal={openGoal} />
      <SavingsCard s={summary} period={period} onEditBudget={() => setSheet({ type: "budget" })} />
      <GoalsCard goals={shared.goals} planned={planned} now={now} onOpen={(g) => openGoal(g)}
        onNew={() => setSheet({ type: "goal", goalId: null, mode: "edit" })} />
      <BudgetCard budget={month.budget} s={summary} period={period} prevTxs={month.prevTxs} />
      <TrendCard period={period} spentSoFar={summary.totalVariableSpent} prevTxs={month.prevTxs} bars={bars} />
      <NoSpendCard period={period} txs={month.txs} prevTxs={month.prevTxs} now={now} />
      <TransactionList txs={month.txs} now={now} onEdit={(tx) => setSheet({ type: "expense", tx })} />

      <div className="fixed bottom-5 left-0 right-0 z-30 flex justify-center pointer-events-none px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button type="button" onClick={() => setSheet({ type: "expense" })}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3.5 rounded-full bg-toss-blue hover:bg-toss-blueDark text-white text-base font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span>지출 기록</span>
        </button>
      </div>

      {sheet?.type === "expense" && (
        <ExpenseSheet tx={sheet.tx} viewedYm={ym} uid={user.uid} history={history} beforeAdd={pinIfNeeded} onMovedMonth={setYm} onClose={closeSheet} />
      )}
      {sheet?.type === "budget" && <BudgetSheet period={period} budget={month.budget} onClose={closeSheet} />}
      {sheet?.type === "settings" && (
        <SettingsSheet email={user.email} ym={ym} txs={month.txs} defaultBudget={month.defaultBudget} rules={shared.recurring}
          onOpenRecurring={() => setSheet({ type: "recurring" })} onClose={closeSheet} />
      )}
      {sheet?.type === "recurring" && <RecurringSheet rules={shared.recurring} onClose={closeSheet} />}
      {sheet?.type === "goal" && (
        <GoalSheet key={sheet.goalId ?? "new"} goal={goal} mode={sheet.mode} prefill={sheet.prefill} planned={planned} now={now} onClose={closeSheet} />
      )}
    </div>
  );
}

function NavButton({ label, d, onClick }: { label: string; d: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="w-8 h-8 rounded-full bg-white border border-toss-border flex items-center justify-center text-toss-sub hover:bg-gray-100 active:scale-95 transition">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
    </button>
  );
}
