import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HISTORY_DAYS, pinMonthBudget, runRecurring, saveNoSpendBest, saveProfile } from "./data/db";
import { useAuthUser, useCoupons, useFeedTxs, useLottery, useMonthData, useNow, useRecentMonths, useSettlement, useSharedData } from "./data/hooks";
import { buildFeed, countUnseen } from "./features/feed/calc";
import { FeedSheet } from "./features/feed/FeedSheet";
import { CouponSheet } from "./features/lottery/CouponSheet";
import { groupCoupons } from "./features/lottery/coupons";
import { InsightCard } from "./features/report/InsightCard";
import { buildInsights } from "./features/report/insights";
import { canSettle, settleOptions } from "./features/settle/calc";
import { SettlePanel } from "./features/settle/SettlePanel";
import { LoginView } from "./features/auth/LoginView";
import { BudgetCard } from "./features/budget/BudgetCard";
import { BudgetSheet } from "./features/budget/BudgetSheet";
import { computeSummary } from "./features/budget/calc";
import { SavingsCard } from "./features/budget/SavingsCard";
import { ExpenseSheet } from "./features/expenses/ExpenseSheet";
import { TransactionList } from "./features/expenses/TransactionList";
import { GoalSheet } from "./features/goals/GoalSheet";
import { GoalsCard } from "./features/goals/GoalsCard";
import { monthlyPlan } from "./features/goals/calc";
import { longestStreak, pickBest, spentByDate } from "./features/noSpend/calc";
import { NoSpendCard } from "./features/noSpend/NoSpendCard";
import { RecurringSheet } from "./features/recurring/RecurringSheet";
import { LotteryCard } from "./features/lottery/LotteryCard";
import { forcedNoSpendDays } from "./features/lottery/ticket";
import { LotterySheet } from "./features/lottery/LotterySheet";
import { QuipBubble } from "./features/quips/QuipBubble";
import { Avatar } from "./ui/Avatar";
import { ReportSection } from "./features/report/ReportSection";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { CategorySheet } from "./features/settings/CategorySheet";
import { SearchSheet, type SearchState } from "./features/search/SearchSheet";
import { DEFAULT_SEARCH } from "./features/search/calc";
import { YearSheet } from "./features/yearly/YearSheet";
import { buildMonthBars } from "./features/trend/calc";
import { TrendCard } from "./features/trend/TrendCard";
import { plannedSavingsOf } from "./lib/categories";
import { getPeriodInfo, shiftMonth, toDateStr, todayStr, todayYm } from "./lib/dates";
import { isHousehold, type Goal, type Transaction } from "./lib/types";
import { nameForEmail } from "./lib/people";
import { confetti } from "./features/fun/confetti";
import { isOurDay } from "./features/fun/eggs";
import { store } from "./lib/storage";
import { useFeedback } from "./ui/feedback";

type OpenSheet =
  /** back: 닫으면 돌아갈 시트 (검색에서 기록을 열었을 때) */
  | { type: "expense"; tx?: Transaction; refundFor?: Transaction; back?: OpenSheet }
  | { type: "search"; state: SearchState }
  | { type: "year"; year: number }
  | { type: "categories" }
  | { type: "budget" }
  | { type: "settings" }
  | { type: "recurring" }
  | { type: "lottery" }
  | { type: "coupons" }
  | { type: "feed"; lastSeen: number }
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
  const closeSheet = useCallback(() => setSheet((s) => (s?.type === "expense" && s.back ? s.back : null)), []);

  // 🤫 프로젝트 이름을 빠르게 7번 누르면…
  const titleTaps = useRef<number[]>([]);
  const onTitleTap = () => {
    const t = Date.now();
    titleTaps.current = [...titleTaps.current.filter((x) => t - x < 3000), t];
    if (titleTaps.current.length >= 7) {
      titleTaps.current = [];
      confetti();
      toast("🔓 비밀 발견! 태형♥경은 부자 클럽 회원 인증 완료");
    }
  };

  // 🤫 생일·기념일에는 그날 처음 앱을 열 때 꽃가루
  useEffect(() => {
    const today = todayStr(now);
    if (!isOurDay(today) || store.get(`ourDay_${today}`, "")) return;
    store.set(`ourDay_${today}`, "1");
    setTimeout(confetti, 600);
  }, [now]);

  const month = useMonthData(ym);
  const shared = useSharedData();
  const recentTxs = useRecentMonths(ym);

  // 프로필 (내 사진·이름, 상대 사진)
  const me = shared.profiles.find((p) => p.uid === user.uid) || null;
  // 로그인 계정으로 태형/경은을 알아내서 내 프로필에 저장 (상대 폰에서도 이름이 보이게)
  const [emailName, setEmailName] = useState<"태형" | "경은" | null>(null);
  useEffect(() => { nameForEmail(user.email).then(setEmailName).catch(() => setEmailName(null)); }, [user.email]);
  useEffect(() => {
    if (emailName && me?.name !== emailName) saveProfile(user.uid, { name: emailName }).catch((err) => console.warn("프로필 이름 저장 참고:", err));
  }, [emailName, me?.name, user.uid]);

  // 🎟️ 오늘의 복권
  const today = todayStr(now);
  // 지난달 말일 것까지 불러와요 (말일에 터진 폭탄 → 1일 강제 무지출)
  const lotteryFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 0));
  const tickets = useLottery(lotteryFrom);
  const jackpotToday = tickets.some((t) => t.date === today && t.tier === "jackpot" && t.revealed);
  // 💣 폭탄 다음 날은 강제 무지출 데이
  const forcedDays = useMemo(() => forcedNoSpendDays(tickets, shared.profiles), [tickets, shared.profiles]);
  const bombBy = forcedDays[today] ?? null;

  // 🎫 쿠폰함
  const coupons = useCoupons();
  const myCoupons = useMemo(() => groupCoupons(coupons, user.uid).mine.length, [coupons, user.uid]);

  // 💌 같이 보기: 상대 기록 + 내 기록에 달린 반응
  const feedTxs = useFeedTxs();
  const feed = useMemo(() => buildFeed(feedTxs, user.uid, shared.profiles), [feedTxs, user.uid, shared.profiles]);
  const seenKey = `feedSeen_${user.uid}`;
  // 처음 쓰는 날엔 지난 소식이 한꺼번에 NEW로 뜨지 않게 지금부터 세요
  const [feedSeen, setFeedSeen] = useState(() => {
    const v = Number(store.get(seenKey, "0"));
    if (v) return v;
    const t = Date.now() - 86400000;
    store.set(seenKey, String(t));
    return t;
  });
  const unseen = countUnseen(feed, feedSeen);
  const feedToasted = useRef(false);
  useEffect(() => {
    if (feedToasted.current || unseen === 0) return;
    feedToasted.current = true;
    const partnerName = shared.profiles.find((p) => p.uid !== user.uid)?.name || "상대";
    toast(`💌 ${partnerName} 님 새 소식 ${unseen}건이 있어요`);
  }, [unseen, shared.profiles, user.uid, toast]);
  const openFeed = () => {
    setSheet({ type: "feed", lastSeen: feedSeen });
    const t = Date.now();
    store.set(seenKey, String(t));
    setFeedSeen(t);
  };

  // 🏢 회사 돈은 기록만 하고, 예산·저축·무지출·그래프·성적표 계산에서는 전부 빼요
  const txs = useMemo(() => month.txs.filter(isHousehold), [month.txs]);
  const prevTxs = useMemo(() => month.prevTxs.filter(isHousehold), [month.prevTxs]);
  const recentHousehold = useMemo(() => recentTxs.filter(isHousehold), [recentTxs]);

  const period = useMemo(() => getPeriodInfo(ym, now), [ym, now]);
  // 카테고리를 추가·숨기면 계산을 다시 해요
  const cv = shared.categoryVersion;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => computeSummary(month.budget, txs, period), [month.budget, txs, period, cv]);
  const bars = useMemo(() => buildMonthBars(ym, 6, recentHousehold, txs, todayYm(now)), [ym, recentHousehold, txs, now]);
  // 저축 목표 예상에 쓰는 '이번 달 계획 저축액'
  const planned = period.state === "current" ? summary.plannedSavings : plannedSavingsOf(month.defaultBudget);
  // 💰 월말 정산: 보고 있는 달(지난 달 화면) + 이번 달 화면에서는 지난달
  const viewedSettle = useSettlement(ym);
  const prevYm = shiftMonth(ym, -1);
  const prevSettle = useSettlement(prevYm);
  const prevSummary = useMemo(() => computeSummary({ ...month.defaultBudget, ...(prevSettle.override || {}) }, prevTxs, getPeriodInfo(prevYm, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month.defaultBudget, prevSettle.override, prevTxs, prevYm, now, cv]);
  const prevOptions = settleOptions(prevSummary);
  const showPrevSettle = period.state === "current" && prevSettle.loaded && !prevSettle.settlement && canSettle(prevOptions, prevTxs.length > 0);
  const newGoal = () => setSheet({ type: "goal", goalId: null, mode: "edit" });

  // 📊 카테고리 비교 (진행 중인 달은 같은 날짜까지)
  const insights = useMemo(() => period.state === "future" ? null : buildInsights(ym, txs, recentHousehold, period.state === "current" ? period.day : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ym, txs, recentHousehold, period.state, period.day, cv]);

  // 자동완성: 최근 120일 + 지금 보는 달 (id 중복 제거)
  const history = useMemo(() => [...new Map([...shared.history, ...month.txs].map((t) => [t.id, t])).values()], [shared.history, month.txs]);

  // 무지출 챌린지는 '처음 기록을 남긴 날'부터 세요 (그 전엔 앱을 안 썼으니까)
  const noSpendStart = useMemo(() => {
    const dates = [...shared.history, ...month.txs].map((t) => t.date).filter(Boolean);
    if (shared.firstRecord) dates.push(shared.firstRecord);
    return dates.length ? dates.sort()[0] : null;
  }, [shared.firstRecord, shared.history, month.txs]);

  // 🏆 무지출 최장 기록: 최근 120일로 계산하고, 더 긴 기록이 나오면 서버에 저장 (두 사람 공유)
  const windowStart = useMemo(() => todayStr(new Date(now.getTime() - HISTORY_DAYS * 86400000)), [now]);
  const localBest = useMemo(() => {
    if (!shared.historyLoaded || !shared.firstRecordLoaded) return null;
    const all = [...new Map([...shared.history, ...month.prevTxs, ...month.txs].map((t) => [t.id, t])).values()].filter(isHousehold);
    return longestStreak(spentByDate(all), noSpendStart, windowStart, todayStr(now));
  }, [shared.historyLoaded, shared.firstRecordLoaded, shared.history, month.prevTxs, month.txs, noSpendStart, windowStart, now]);
  const best = pickBest(shared.noSpendBest, localBest, windowStart);
  useEffect(() => {
    if (!localBest || !best) return;
    const stored = shared.noSpendBest;
    if (stored && stored.days === best.days && stored.from === best.from && stored.to === best.to) return;
    const isNewRecord = !!stored && best.days > stored.days;
    saveNoSpendBest(best)
      .then(() => { if (isNewRecord) { confetti(); toast(`🏆 무지출 최장 기록 경신! ${best.days}일 연속`); } })
      .catch((err) => console.warn("최장 기록 저장 참고:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBest?.days, localBest?.from, localBest?.to, best?.days, best?.from, best?.to, shared.noSpendBest]);

  /** 첫 지출이 생기는 달은 그때 예산을 그 달에 고정 */
  const pinIfNeeded = useCallback(async (targetYm: string) => {
    if (targetYm !== ym || !month.overrideLoaded || month.override) return;
    await pinMonthBudget(targetYm, month.budget);
  }, [ym, month.overrideLoaded, month.override, month.budget]);

  // 매달 자동 기록: 규칙이 바뀌거나 앱으로 돌아올 때 확인
  useEffect(() => {
    // 직접 추가한 카테고리를 받기 전에 기록하면 '기타 생활비'로 들어가니까 기다려요
    if (!shared.recurringLoaded || !shared.categoriesLoaded) return;
    runRecurring(shared.recurring, user.uid, pinIfNeeded).then((n) => { if (n) toast(`매달 자동 기록 ${n}건을 남겼어요 🔁`); });
    // pinIfNeeded는 일부러 빼요: 예산이 바뀔 때마다 다시 돌 필요는 없어서
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.recurringLoaded, shared.categoriesLoaded, shared.recurring, now, user.uid, toast]);

  const goal = sheet?.type === "goal" && sheet.goalId ? shared.goals.find((g) => g.id === sheet.goalId) ?? null : null;
  const openGoal = (g: Goal, prefill = 0) => setSheet({ type: "goal", goalId: g.id, mode: "deposit", prefill });

  return (
    <div className="max-w-lg mx-auto px-4 pt-3 pb-10">
      <header className="flex items-center justify-between py-2 mb-3">
        <div>
          <span onClick={onTitleTap} className="text-sm font-bold text-toss-blue tracking-tight select-none">태형이와 경은이의 부자 되기 프로젝트!!</span>
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
        <div className="flex items-center gap-2">
        <button type="button" aria-label="전체 기간 검색" id="openSearchBtn" onClick={() => setSheet({ type: "search", state: { ...DEFAULT_SEARCH, query: "" } })}
          className="w-11 h-11 shrink-0 rounded-full bg-white border border-toss-border flex items-center justify-center text-toss-sub active:scale-95 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
        </button>
        <button type="button" aria-label="같이 보기" onClick={openFeed}
          className="relative w-11 h-11 shrink-0 rounded-full bg-white border border-toss-border flex items-center justify-center text-xl active:scale-95 transition">
          💌
          {unseen > 0 && <span className="feed-badge absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-toss-red text-white text-[11px] font-bold flex items-center justify-center num">{unseen > 9 ? "9+" : unseen}</span>}
        </button>
        <button type="button" aria-label="내 프로필과 설정" onClick={() => setSheet({ type: "settings" })}
          className="relative w-12 h-12 shrink-0 rounded-full active:scale-95 transition">
          <Avatar profile={me} size={48} className="ring-2 ring-white shadow-sm" />
        </button>
        </div>

      </header>

      {month.error && <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-toss-red font-medium leading-relaxed">{month.error}</div>}

      <QuipBubble s={summary} period={period} now={now} override={jackpotToday ? "🍗🍺 오늘은 복권 1등! 묻지도 따지지도 않고 치맥 GO!" : bombBy ? `💣 오늘은 강제 무지출 데이! (어제 ${bombBy}의 폭탄) 지갑 봉인 🔒` : null} />
      {period.state === "current" && (
        <LotteryCard uid={user.uid} today={today} tickets={tickets} profiles={shared.profiles} bombBy={bombBy} couponCount={myCoupons}
          onOpen={() => setSheet({ type: "lottery" })} onOpenCoupons={() => setSheet({ type: "coupons" })} />
      )}
      <ReportSection period={period} s={summary} txs={txs} prevTxs={prevTxs} now={now} noSpendStart={noSpendStart}
        onOpenLastMonth={() => setYm(shiftMonth(todayYm(now), -1))}
        insights={insights && period.state === "past" ? <InsightCard data={insights} embedded /> : null}
        settle={period.state === "past" && viewedSettle.loaded && (viewedSettle.settlement || canSettle(settleOptions(summary), txs.length > 0))
          ? <SettlePanel key={ym} ym={ym} options={settleOptions(summary)} settlement={viewedSettle.settlement} goals={shared.goals} myName={me?.name} onNewGoal={newGoal} />
          : null} />
      {showPrevSettle && (
        <SettlePanel key={`prev_${prevYm}`} ym={prevYm} options={prevOptions} settlement={null} goals={shared.goals} myName={me?.name} standalone onNewGoal={newGoal} />
      )}
      <SavingsCard s={summary} period={period} onEditBudget={() => setSheet({ type: "budget" })} />
      <GoalsCard goals={shared.goals} planned={planned} now={now}
        plan={period.state === "future" ? null : monthlyPlan(shared.goals, summary.income, summary.fixedTotal, summary.totalVariableBudget, summary.totalVariableSpent, period.state === "current" ? period.daysLeft : null)} onOpen={(g) => openGoal(g)}
        onNew={() => setSheet({ type: "goal", goalId: null, mode: "edit" })} />
      <BudgetCard budget={month.budget} s={summary} period={period} txs={txs} prevTxs={prevTxs} />
      <TrendCard period={period} spentSoFar={summary.totalVariableSpent} prevTxs={prevTxs} bars={bars} />
      <button type="button" id="openYearBtn" onClick={() => setSheet({ type: "year", year: period.y })}
        className="w-full mb-4 px-5 py-4 rounded-3xl bg-white shadow-sm border border-toss-border/60 flex items-center justify-between active:scale-[0.99] transition">
        <span className="text-left">
          <span className="block text-base font-bold text-toss-text">📅 {period.y}년 결산</span>
          <span className="block text-xs text-toss-sub mt-0.5">올해 모은 돈 · 카테고리 순위 · 단골 · 무지출을 한눈에</span>
        </span>
        <span className="text-sm font-bold text-toss-blue">보기 →</span>
      </button>
      {insights && period.state === "current" && <InsightCard data={insights} />}
      <NoSpendCard period={period} txs={txs} prevTxs={prevTxs} now={now} start={noSpendStart} best={best} forcedDays={forcedDays} />
      <TransactionList txs={month.txs} ym={ym} now={now} onEdit={(tx) => setSheet({ type: "expense", tx })}
        onSearchAll={(query) => setSheet({ type: "search", state: { ...DEFAULT_SEARCH, query } })} />

      <div className="fixed bottom-5 left-0 right-0 z-30 flex justify-center pointer-events-none px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button type="button" onClick={() => setSheet({ type: "expense" })}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3.5 rounded-full bg-toss-blue hover:bg-toss-blueDark text-white text-base font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span>지출 기록</span>
        </button>
      </div>

      {sheet?.type === "expense" && (
        <ExpenseSheet key={sheet.tx?.id ?? (sheet.refundFor ? `refund_${sheet.refundFor.id}` : "new")} tx={sheet.tx} refundFor={sheet.refundFor}
          onRefund={(orig) => setSheet({ type: "expense", refundFor: orig, back: sheet.back })} viewedYm={ym} uid={user.uid} history={history} beforeAdd={pinIfNeeded} myName={me?.name} forcedDays={forcedDays} onMovedMonth={setYm} onClose={closeSheet} />
      )}
      {sheet?.type === "budget" && <BudgetSheet period={period} budget={month.budget} onClose={closeSheet} />}
      {sheet?.type === "settings" && (
        <SettingsSheet uid={user.uid} me={me} nameLocked={!!emailName} email={user.email} ym={ym} txs={month.txs} defaultBudget={month.defaultBudget} rules={shared.recurring}
          onOpenRecurring={() => setSheet({ type: "recurring" })} onOpenCategories={() => setSheet({ type: "categories" })} onClose={closeSheet} />
      )}
      {sheet?.type === "categories" && <CategorySheet config={shared.categoryConfig} onClose={closeSheet} />}
      {sheet?.type === "search" && (
        <SearchSheet initial={sheet.state} now={now} onClose={closeSheet}
          onEdit={(tx, state) => setSheet({ type: "expense", tx, back: { type: "search", state } })} />
      )}
      {sheet?.type === "year" && (
        <YearSheet initialYear={sheet.year} now={now} defaultBudget={month.defaultBudget} noSpendStart={noSpendStart}
          firstYear={noSpendStart ? Number(noSpendStart.slice(0, 4)) : null}
          onOpenMonth={(target) => { setYm(target); setSheet(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} onClose={closeSheet} />
      )}
      {sheet?.type === "recurring" && <RecurringSheet rules={shared.recurring} onClose={closeSheet} />}
      {sheet?.type === "lottery" && <LotterySheet uid={user.uid} myName={me?.name} today={today} onClose={closeSheet} onOpenCoupons={() => setSheet({ type: "coupons" })} />}
      {sheet?.type === "coupons" && <CouponSheet uid={user.uid} coupons={coupons} profiles={shared.profiles} onClose={closeSheet} />}
      {sheet?.type === "feed" && <FeedSheet uid={user.uid} items={feed} profiles={shared.profiles} lastSeen={sheet.lastSeen} onClose={closeSheet} />}
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
