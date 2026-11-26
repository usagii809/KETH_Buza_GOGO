import type { User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HISTORY_DAYS, pinMonthBudget, runRecurring, saveNoSpendBest, saveProfile } from "./data/db";
import { useAuthUser, useCoupons, useFeedReactions, useFeedTxs, useLottery, useMonthData, useNow, useRecentMonths, useSettlement, useSharedData } from "./data/hooks";
import { buildFeed, countUnseen } from "./features/feed/calc";
import { FeedSheet } from "./features/feed/FeedSheet";
import { setPushSender } from "./lib/push";
import { offlineBlocked, reportFromCache, setOfflineToaster, useOffline } from "./lib/online";
import { getPrefs, setPref, syncPrefs } from "./lib/prefs";
import { Splash } from "./ui/Splash";
import { LiveBanner, type LiveNote } from "./features/feed/LiveBanner";
import { feedItemMsg } from "./features/feed/notifyText";
import { CouponSheet } from "./features/lottery/CouponSheet";
import { groupCoupons } from "./features/lottery/coupons";
import { InsightCard } from "./features/report/InsightCard";
import { buildInsights } from "./features/report/insights";
import { canSettle, settleOptions } from "./features/settle/calc";
import { SettlePanel } from "./features/settle/SettlePanel";
import { LoginView } from "./features/auth/LoginView";
import { BudgetCard } from "./features/budget/BudgetCard";
import { BudgetSheet } from "./features/budget/BudgetSheet";
import { budgetAlert, computeSummary } from "./features/budget/calc";
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
import { breaksDiningBan, diningBanDays, upcomingDiningBan } from "./features/lottery/ticket";
import { buildRefundIndex } from "./features/expenses/refunds";
import { LotterySheet } from "./features/lottery/LotterySheet";
import { QuipBubble } from "./features/quips/QuipBubble";
import { Avatar } from "./ui/Avatar";
import { ReportSection } from "./features/report/ReportSection";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { CategorySheet } from "./features/settings/CategorySheet";
import { SearchSheet, type SearchState } from "./features/search/SearchSheet";
import { DEFAULT_SEARCH } from "./features/search/calc";
import { YearSheet } from "./features/yearly/YearSheet";
import { TrendCard } from "./features/trend/TrendCard";
import { budgetOf, CATEGORY_MAP, plannedSavingsOf, type CategoryKey } from "./lib/categories";
import { getPeriodInfo, shiftMonth, toDateStr, todayStr, todayYm } from "./lib/dates";
import { isHousehold, type Goal, type Transaction } from "./lib/types";
import { nameForEmail } from "./lib/people";
import { confetti } from "./features/fun/confetti";
import { isOurDay } from "./features/fun/eggs";
import { useFeedback } from "./ui/feedback";
import { SHEET_EXIT_MS, SheetExitContext, SheetNavContext } from "./ui/Sheet";
import { MonthSkeleton, TopProgress } from "./ui/Loading";

type SheetKind =
  | { type: "expense"; tx?: Transaction; refundFor?: Transaction; copyFrom?: Transaction }
  | { type: "search"; state: SearchState }
  | { type: "year"; year: number }
  | { type: "categories" }
  | { type: "budget" }
  | { type: "settings" }
  | { type: "recurring" }
  | { type: "lottery" }
  | { type: "coupons" }
  | { type: "feed"; lastSeen: number }
  | { type: "goal"; goalId: string | null; mode: "deposit" | "edit"; prefill?: number };
/** back: 닫으면(‹ 뒤로) 돌아갈 창 (예: 설정 → 카테고리 관리, 검색 → 기록) */
type OpenSheet = (SheetKind & { back?: OpenSheet }) | null;
const sheetDepth = (s: OpenSheet): number => (s ? 1 + sheetDepth(s.back ?? null) : 0);

export default function App() {
  const user = useAuthUser();
  // 로그인 확인 중에는 index.html과 같은 로딩 화면을 그대로 이어서 보여줘요
  if (user === undefined) return <Splash />;
  if (!user) return <LoginView />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: User }) {
  const { toast } = useFeedback();
  const now = useNow();
  const [ym, setYm] = useState(() => todayYm());
  const [sheet, setSheet] = useState<OpenSheet>(null);
  /** 한 단계 뒤로 (이전 창이 없으면 닫기) */
  const closeSheet = useCallback(() => setSheet((s) => s?.back ?? null), []);
  // 시트가 닫히면 0.22초 더 그려두고(아래로 스르륵) 빼요. 그리는 도중에 바로 바꿔서 시트가 깜빡이지 않게
  const [prevSheet, setPrevSheet] = useState<OpenSheet>(sheet);
  const [exitingSheet, setExitingSheet] = useState<OpenSheet>(null);
  if (sheet !== prevSheet) {
    setPrevSheet(sheet);
    setExitingSheet(sheet ? null : prevSheet);
  }
  useEffect(() => {
    if (!exitingSheet) return;
    const t = window.setTimeout(() => setExitingSheet(null), SHEET_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [exitingSheet]);
  /** 화면에 그릴 시트 (닫히는 중이면 방금 닫은 시트) */
  const view = sheet ?? exitingSheet;
  const closeAllSheets = useCallback(() => setSheet(null), []);
  /** 지금 창 위에 새 창 열기 (‹ 뒤로 누르면 지금 창으로 돌아와요) */
  const openOver = useCallback((next: SheetKind) => setSheet((cur) => ({ ...next, ...(cur ? { back: cur } : {}) })), []);

  const sheetNav = useMemo(() => ({ canGoBack: !!sheet?.back, closeAll: closeAllSheets }), [sheet, closeAllSheets]);

  // 📱 휴대폰 · 브라우저 '뒤로가기'로 창을 한 단계씩 닫아요 (앱을 나가지 않게).
  // 창이 열릴 때마다 방문 기록을 하나씩 쌓고, 버튼으로 닫으면 쌓은 만큼 되돌려요.
  const historyDepth = useRef(0);
  const ignorePops = useRef(0);
  useEffect(() => {
    const depth = sheetDepth(sheet);
    if (depth > historyDepth.current) {
      for (let i = historyDepth.current; i < depth; i++) window.history.pushState({ sheet: i + 1 }, "");
    } else if (depth < historyDepth.current) {
      ignorePops.current++;
      window.history.go(depth - historyDepth.current);
    }
    historyDepth.current = depth;
  }, [sheet]);
  useEffect(() => {
    const onPop = () => {
      if (ignorePops.current > 0) { ignorePops.current--; return; }
      if (historyDepth.current === 0) return;
      historyDepth.current--;
      setSheet((s) => s?.back ?? null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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


  const shared = useSharedData();
  // 📦 최근 기록 (실시간 하나): 이번 달 · 지난달 · 무지출 · 자동완성 · 같이 보기 · 비교가 나눠 써요
  // 📴 오프라인 모드: 폰 연결 상태 + 서버 답을 받았는지 같이 봐요
  const offline = useOffline();
  useEffect(() => { reportFromCache(shared.historyFromCache); }, [shared.historyFromCache]);
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) wasOffline.current = true;
    else if (wasOffline.current) { wasOffline.current = false; toast("✅ 다시 연결됐어요. 최신 내용으로 맞췄어요"); }
  }, [offline, toast]);
  useEffect(() => { setOfflineToaster(toast); }, [toast]);
  const hist = useMemo(() => ({ txs: shared.history, start: shared.historyStart, loaded: shared.historyLoaded }),
    [shared.history, shared.historyStart, shared.historyLoaded]);
  const month = useMonthData(ym, hist);
  // ↔ 달을 넘기면 다음 달은 오른쪽에서, 이전 달은 왼쪽에서 밀려 들어와요 (끝나면 transform이 남지 않게 Web Animations로)
  const monthRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownYm = useRef(ym);
  useEffect(() => {
    const prev = shownYm.current;
    shownYm.current = ym;
    if (prev === ym || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const dir = ym > prev ? 1 : -1;
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
    monthRef.current?.animate?.([{ transform: `translateX(${dir * 36}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: ease });
    titleRef.current?.animate?.([{ transform: `translateX(${dir * 14}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: ease });
  }, [ym]);
  // 🌱 첫 로딩: 이 달 기록 · 예산을 받으면 로딩 화면을 걷어요 (인터넷이 느려도 4초면 걷어요 · 달을 넘길 땐 다시 안 띄워요)
  const [booted, setBooted] = useState(false);
  useEffect(() => { if (!booted && month.txsLoaded && month.overrideLoaded) setBooted(true); }, [booted, month.txsLoaded, month.overrideLoaded]);
  useEffect(() => { const t = window.setTimeout(() => setBooted(true), 4000); return () => window.clearTimeout(t); }, []);
  // 👯 같은 지출 경고에 쓸 이름 (uid → 태형/경은)
  const nameOf = useCallback((uid?: string) => shared.profiles.find((p) => p.uid === uid)?.name, [shared.profiles]);
  // 지출 흐름 그래프의 '1년' 보기까지 11개월 전부터 (최근 몇 달은 실시간 기록에서, 그 전은 달 요약에서)
  // ④ 오래된 달 요약은 그래프가 화면에 보이거나, 카테고리 비교에 필요할 때만 읽어요
  const [trendSeen, setTrendSeen] = useState(false);
  const needOlderForInsights = shiftMonth(ym, -3) < shared.historyStart.slice(0, 7);
  const { txs: recentTxs, pendingBefore: olderPending } = useRecentMonths(ym, 12, hist, trendSeen || needOlderForInsights);
  // 그래프 카드가 화면 근처에 오면 그때 오래된 달 요약을 읽어요 (한 번 보면 계속 유지)
  const trendObserver = useRef<IntersectionObserver | null>(null);
  const trendRef = useCallback((el: HTMLDivElement | null) => {
    trendObserver.current?.disconnect();
    if (!el || trendSeen) return;
    if (typeof IntersectionObserver === "undefined") { setTrendSeen(true); return; }
    trendObserver.current = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setTrendSeen(true); trendObserver.current?.disconnect(); }
    }, { rootMargin: "300px 0px" });
    trendObserver.current.observe(el);
  }, [trendSeen]);

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
  // 지난달 마지막 두 주 것까지 불러와요 (지난달 말에 터진 폭탄 → 이번 달 첫 주 외식 금지)
  const lotteryFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), -13));
  const tickets = useLottery(lotteryFrom);
  const jackpotToday = tickets.some((t) => t.date === today && t.tier === "jackpot" && t.revealed);
  // 💣 폭탄 → 다음 주 월~일 외식·배달 금지
  const bans = useMemo(() => diningBanDays(tickets, shared.profiles), [tickets, shared.profiles]);
  const todayBan = bans[today] ?? null;
  const nextBan = useMemo(() => upcomingDiningBan(bans, today), [bans, today]);

  // 🎫 쿠폰함
  const coupons = useCoupons();
  const myCoupons = useMemo(() => groupCoupons(coupons, user.uid).mine.length, [coupons, user.uid]);

  // 💌 같이 보기: 상대 기록 + 내 기록에 달린 반응
  const { txs: feedTxs, loaded: feedLoaded } = useFeedTxs(hist);
  const feedReactions = useFeedReactions();
  const feed = useMemo(() => buildFeed(feedTxs, user.uid, shared.profiles, 60, { tickets, coupons, goals: shared.goals, reactions: feedReactions }),
    [feedTxs, user.uid, shared.profiles, tickets, coupons, shared.goals, feedReactions]);
  // 읽은 시각은 계정(내 프로필 feedSeenAt) 하나만 기준 → 폰 · 웹 어디서 봐도 NEW · 새 소식 수가 같아요
  // (방금 연 시각은 계정에 저장되기 전까지 잠깐 이 화면에서만 들고 있어요)
  const [openedFeedAt, setOpenedFeedAt] = useState(0);
  // 처음 쓰는 계정이면 지난 소식이 한꺼번에 NEW로 뜨지 않게 하루 전부터 세요
  const [firstUseSeen] = useState(() => Date.now() - 86400000);
  const feedSeen = Math.max(openedFeedAt, Number(me?.feedSeenAt) || 0) || firstUseSeen;
  // 계정에 읽은 시각이 아직 없으면 지금 기준을 저장해서 다른 기기도 같은 기준으로 세게 해요
  useEffect(() => {
    if (me && !me.feedSeenAt) saveProfile(user.uid, { feedSeenAt: firstUseSeen }).catch((err) => console.warn("읽은 시각 저장 참고:", err));
  }, [me, user.uid, firstUseSeen]);
  const unseen = countUnseen(feed, feedSeen);
  // 💌 앱 안 알림이 이미 알고 있는 소식 id (처음 불러온 소식은 안 띄우려고)
  const liveKnown = useRef<Set<string> | null>(null);
  const feedToasted = useRef(false);
  useEffect(() => {
    // 내 프로필(계정에 저장된 읽은 시각)을 받은 뒤에만 알려줘요
    // 앱을 연 뒤에 온 소식은 아래 💌 앱 안 알림이 보여줘요
    // (기록 소식을 처음 받기 전엔 판단하지 않아요 · 안 그러면 0건으로 보고 넘어가요)
    if (!feedLoaded || feedToasted.current) return;
    if (liveKnown.current) { feedToasted.current = true; return; }
    if (!me || unseen === 0) return;
    feedToasted.current = true;
    const partnerName = shared.profiles.find((p) => p.uid !== user.uid)?.name || "상대";
    toast(`💌 ${partnerName} 님 새 소식 ${unseen}건이 있어요`);
  }, [unseen, me, feedLoaded, shared.profiles, user.uid, toast]);
  const openFeed = () => {
    setSheet({ type: "feed", lastSeen: feedSeen });
    const t = Date.now();
    setOpenedFeedAt(t);
    saveProfile(user.uid, { feedSeenAt: t }).catch((err) => console.warn("읽은 시각 저장 참고:", err));
  };

  // 🔔 알림을 눌러서 들어오면 같이 보기를 바로 열어요 (?feed=1 · 이미 열린 앱이면 서비스 워커가 메시지로 알려줘요)
  const [wantFeed, setWantFeed] = useState(() => new URLSearchParams(window.location.search).get("feed") === "1");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("feed")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("feed");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "buja-open-feed") setWantFeed(true); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    // 읽은 시각이 정확하도록 내 프로필을 받은 뒤에 열어요
    if (!wantFeed || !me) return;
    setWantFeed(false);
    feedToasted.current = true;
    if (sheet?.type !== "feed") openFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantFeed, me]);
  // 💌 앱을 보고 있을 때 상대 소식이 새로 오면 아래에 살짝 띄워요
  // (처음 불러온 소식은 빼고 · 같이 보기를 보고 있으면 안 띄워요 · 설정에서 끈 알림 종류도 빼요)
  const [liveQueue, setLiveQueue] = useState<LiveNote[]>([]);
  useEffect(() => {
    if (!me || !feedLoaded) return;
    if (!liveKnown.current) { liveKnown.current = new Set(feed.map((f) => f.id)); return; }
    const known = liveKnown.current;
    const fresh = feed.filter((f) => !known.has(f.id));
    fresh.forEach((f) => known.add(f.id));
    if (sheet?.type === "feed" || document.visibilityState !== "visible") return;
    let mute: string[] = [];
    mute = getPrefs().pushMute || [];
    const notes = fresh
      .filter((f) => !f.mine && f.at > Date.now() - 5 * 60000)
      .map((f) => ({ f, msg: feedItemMsg(f) }))
      .filter(({ msg }) => !mute.includes(msg.kind))
      .sort((a, b) => a.f.at - b.f.at);
    if (!notes.length) return;
    const partnerProfile = shared.profiles.find((p) => p.uid !== user.uid) || null;
    // 한꺼번에 많이 오면(오프라인 뒤 등) 한 줄로 묶어요
    const add: LiveNote[] = notes.length > 3
      ? [{ id: `many_${Date.now()}`, title: `💌 ${notes[0].f.who} 님 새 소식 ${notes.length}건`, body: "눌러서 같이 보기", profile: partnerProfile }]
      : notes.map(({ f, msg }) => ({ id: f.id, title: msg.title, body: msg.body, profile: partnerProfile }));
    setLiveQueue((q) => [...q, ...add].slice(-5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, me, feedLoaded]);

  // 같이 보기를 열면 쌓여 있던 앱 안 알림은 버려요
  useEffect(() => { if (sheet?.type === "feed") setLiveQueue([]); }, [sheet?.type]);

  // 🤫 생일·기념일에는 그날 처음 앱을 열 때 꽃가루 (계정에 기억 → 폰에서 봤으면 웹에선 다시 안 터져요)
  const prefsReady = !!me;
  useEffect(() => {
    const today = todayStr(now);
    if (!prefsReady || !isOurDay(today) || getPrefs().ourDaySeen === today) return;
    setPref("ourDaySeen", today);
    setTimeout(confetti, 600);
  }, [now, prefsReady]);

  // 🔄 내 설정(화면 모드 · 탭 · 알림 종류 등)은 계정과 맞춰요 → 폰 · 웹 어디서 열어도 같게
  useEffect(() => {
    if (me) syncPrefs(user.uid, (patch) => saveProfile(user.uid, { prefs: patch }), me.prefs);
  }, [me, user.uid]);

  // 알림 문구에 들어갈 내 이름
  useEffect(() => { setPushSender(me?.name); }, [me?.name]);

  // 🏢 회사 돈은 기록만 하고, 예산·저축·무지출·그래프·성적표 계산에서는 전부 빼요
  const txs = useMemo(() => month.txs.filter(isHousehold), [month.txs]);
  const prevTxs = useMemo(() => month.prevTxs.filter(isHousehold), [month.prevTxs]);
  // 이번 주 외식 금지 중에 한 외식 횟수 (이번 달 화면에서만 셀 수 있어요: 지난달 말~이번 달 기록)
  const banBroken = useMemo(() => {
    if (!todayBan || ym !== todayYm(now)) return 0;
    return [...month.prevTxs, ...month.txs].filter((tx) => tx.date >= todayBan.from && tx.date <= todayBan.to && breaksDiningBan(tx, bans)).length;
  }, [todayBan, bans, month.prevTxs, month.txs, ym, now]);
  const recentHousehold = useMemo(() => recentTxs.filter(isHousehold), [recentTxs]);

  const period = useMemo(() => getPeriodInfo(ym, now), [ym, now]);
  // 카테고리를 추가·숨기면 계산을 다시 해요
  const cv = shared.categoryVersion;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => computeSummary(month.budget, txs, period), [month.budget, txs, period, cv]);
  /** 보고 있는 달에 기록하면: 이 금액으로 항목 예산 80% · 100%를 처음 넘는지 */
  const budgetAlertFor = useCallback((category: CategoryKey, date: string, added: number) => {
    if (date.slice(0, 7) !== ym) return null;
    const label = CATEGORY_MAP[category]?.label ?? category;
    return budgetAlert(label, budgetOf(month.budget, category), summary.usage[category] || 0, added);
  }, [ym, month.budget, summary]);
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
  // ↩️ 결제 ↔ 환불 연결 (불러온 기록 전부에서: 최근 120일 · 이번 달 · 지난 12개월 · 새 소식)
  // (요약에서 만든 '합계 기록'은 환불 연결이 없어서 빼요)
  const refundIndex = useMemo(() => buildRefundIndex(shared.history, month.prevTxs, month.txs),
    [shared.history, month.prevTxs, month.txs]);

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
    // feedTxs(최근 30일 실시간)도 넣어요: 다른 달을 보고 있으면 month.txs에 이번 달 새 지출이 없어서
    // 무지출이 길어진 것처럼 잘못 계산 → '최장 기록 경신'이 엉뚱하게 터지는 걸 막아요
    const all = [...new Map([...shared.history, ...feedTxs, ...month.prevTxs, ...month.txs].map((t) => [t.id, t])).values()].filter(isHousehold);
    return longestStreak(spentByDate(all), noSpendStart, windowStart, todayStr(now));
  }, [shared.historyLoaded, shared.firstRecordLoaded, shared.history, feedTxs, month.prevTxs, month.txs, noSpendStart, windowStart, now]);
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
    // 오프라인일 땐 자동 기록도 안 남겨요 (연결되면 그때)
    if (offline) return;
    runRecurring(shared.recurring, user.uid, pinIfNeeded).then((n) => { if (n) toast(`매달 자동 기록 ${n}건을 남겼어요 🔁`); });
    // pinIfNeeded는 일부러 빼요: 예산이 바뀔 때마다 다시 돌 필요는 없어서
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.recurringLoaded, shared.categoriesLoaded, shared.recurring, now, user.uid, toast, offline]);

  const goal = view?.type === "goal" && view.goalId ? shared.goals.find((g) => g.id === view.goalId) ?? null : null;
  const openGoal = (g: Goal, prefill = 0) => setSheet({ type: "goal", goalId: g.id, mode: "deposit", prefill });


  // 홈 카드들 (이번 달 / 지난달 화면에서 순서만 달라요)
  const reportEl = (
    <ReportSection period={period} s={summary} txs={txs} prevTxs={prevTxs} now={now} noSpendStart={noSpendStart}
      onOpenLastMonth={() => setYm(shiftMonth(todayYm(now), -1))}
      insights={insights && period.state === "past" ? <InsightCard data={insights} embedded /> : null}
      settle={period.state === "past" && viewedSettle.loaded && (viewedSettle.settlement || canSettle(settleOptions(summary), txs.length > 0))
        ? <SettlePanel key={ym} ym={ym} options={settleOptions(summary)} settlement={viewedSettle.settlement} goals={shared.goals} myName={me?.name} onNewGoal={newGoal} />
        : null} />
  );
  const prevSettleEl = showPrevSettle && (
    <SettlePanel key={`prev_${prevYm}`} ym={prevYm} options={prevOptions} settlement={null} goals={shared.goals} myName={me?.name} standalone onNewGoal={newGoal} />
  );
  const savingsEl = <SavingsCard s={summary} period={period} onEditBudget={() => setSheet({ type: "budget" })} />;
  const goalsEl = (
    <GoalsCard goals={shared.goals} planned={planned} now={now}
      plan={period.state === "future" ? null : monthlyPlan(shared.goals, summary.income, summary.fixedTotal, summary.totalVariableBudget, summary.totalVariableSpent, period.state === "current" ? period.daysLeft : null)} onOpen={(g) => openGoal(g)}
      onNew={() => setSheet({ type: "goal", goalId: null, mode: "edit" })} />
  );
  const budgetEl = <BudgetCard budget={month.budget} s={summary} period={period} txs={txs} prevTxs={prevTxs} />;
  const trendEl = <div ref={trendRef}><TrendCard period={period} spentSoFar={summary.totalVariableSpent} prevTxs={prevTxs} ym={ym} txs={txs} recentTxs={recentHousehold} pendingBefore={olderPending} today={toDateStr(now)} /></div>;
  const yearEl = (
    <button type="button" id="openYearBtn" onClick={() => setSheet({ type: "year", year: period.y })}
      className="w-full mb-4 px-5 py-4 rounded-3xl bg-white shadow-sm border border-toss-border/60 flex items-center justify-between active:scale-[0.99] transition">
      <span className="text-left">
        <span className="block text-base font-bold text-toss-text">📅 {period.y}년 결산</span>
        <span className="block text-xs text-toss-sub mt-0.5">올해 모은 돈 · 카테고리 순위 · 단골 · 무지출을 한눈에</span>
      </span>
      <span className="text-sm font-bold text-toss-blue">보기 →</span>
    </button>
  );
  const noSpendEl = <NoSpendCard period={period} txs={txs} prevTxs={prevTxs} now={now} start={noSpendStart} best={best} />;
  return (
    <>
    {/* 🌱 이 달 기록 · 예산을 처음 받을 때까지 로딩 화면, 받으면 스르륵 걷혀요 */}
    <Splash done={booted} />
    {/* ⏳ 오래된 달로 넘겨서 그 달 기록을 받는 중이면 맨 위에 얇은 막대가 왔다 갔다 */}
    <TopProgress show={booted && !month.txsLoaded} />
    <div className={`max-w-lg mx-auto px-4 pt-3 pb-10 ${booted ? "animate-app-in" : "opacity-0"}`}>
      {offline && (
        <div role="status" className="offline-banner sticky top-0 z-40 -mx-4 mb-2 px-4 py-2 bg-gray-900 text-white text-xs font-bold text-center" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          📴 오프라인 모드 · 보기만 할 수 있어요
        </div>
      )}
      <header className="flex items-center justify-between py-2 mb-3">
        <div>
          <span onClick={onTitleTap} className="text-sm font-bold text-toss-blue tracking-tight select-none">태형이와 경은이의 부자 되기 프로젝트!!</span>
          <div className="flex items-center gap-2 mt-1.5">
            <NavButton label="이전 달" d="M15 19l-7-7 7-7" onClick={() => setYm(shiftMonth(ym, -1))} />
            <h1 ref={titleRef} className="text-xl font-bold text-toss-text tracking-tight num px-1 whitespace-nowrap">{period.y}년 {period.m}월</h1>
            <NavButton label="다음 달" d="M9 5l7 7-7 7" onClick={() => setYm(shiftMonth(ym, 1))} />
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

      <div ref={monthRef}>
      {offline && month.txsLoaded && txs.length === 0 && (
        <div className="offline-empty mb-4 p-3.5 rounded-2xl bg-toss-bg border border-toss-border text-sm text-toss-sub leading-relaxed">
          📴 이 달 기록은 이 폰에 저장돼 있지 않아요. 인터넷에 연결되면 볼 수 있어요
        </div>
      )}
      {month.error && <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-toss-red font-medium leading-relaxed">{month.error}</div>}

      {booted && !month.txsLoaded ? <MonthSkeleton /> : <>
      <QuipBubble s={summary} period={period} now={now}
        override={jackpotToday ? { text: "🍗🍺 오늘은 복권 1등! 묻지도 따지지도 않고 치맥 GO GO!", fx: { kind: "pop", emojis: ["🍗", "🍺"] } } : null}
        ban={todayBan ? { to: todayBan.to, by: todayBan.by } : null} />
      {/* 이번 달: 날마다 바뀌는 정보(예산 · 무지출 · 복권 · 흐름)를 위로, 예산을 안 바꾸면 그대로인 저축 계획은 아래로.
          지난달: 결과(성적표 · 정산 · 모은 돈)가 먼저 */}
      {period.state === "current" ? (
        <>
          <LotteryCard uid={user.uid} today={today} tickets={tickets} profiles={shared.profiles} ban={todayBan} nextBan={nextBan} banBroken={banBroken} couponCount={myCoupons}
            onOpen={() => setSheet({ type: "lottery" })} onOpenCoupons={() => setSheet({ type: "coupons" })} />
          {reportEl /* 이번 달엔 '지난달 성적표 나왔어요' 알림만 (안 본 경우) */}
          {prevSettleEl}
          {budgetEl}
          {noSpendEl}
          {trendEl}
          {insights && <InsightCard data={insights} />}
          {savingsEl}
          {goalsEl}
          {yearEl}
        </>
      ) : (
        <>
          {reportEl}
          {prevSettleEl}
          {savingsEl}
          {goalsEl}
          {budgetEl}
          {trendEl}
          {yearEl}
          {noSpendEl}
        </>
      )}
      </>}
      <TransactionList loading={!month.txsLoaded} txs={month.txs} ym={ym} now={now} refundIndex={refundIndex} onEdit={(tx) => setSheet({ type: "expense", tx })}
        onSearchAll={(query) => setSheet({ type: "search", state: { ...DEFAULT_SEARCH, query } })} />
      </div>

      <div className="fixed bottom-5 left-0 right-0 z-30 flex justify-center pointer-events-none px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button type="button" aria-disabled={offline || undefined} onClick={() => { if (offlineBlocked()) return; setSheet({ type: "expense" }); }}
          className={`pointer-events-auto flex items-center gap-2 px-6 py-3.5 rounded-full text-white text-base font-bold shadow-lg active:scale-95 transition ${offline ? "bg-gray-400 shadow-black/10" : "bg-toss-blue hover:bg-toss-blueDark shadow-blue-500/30"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span>지출 기록</span>
        </button>
      </div>

      <LiveBanner note={sheet?.type === "feed" ? null : liveQueue[0] || null} onOpen={() => { setLiveQueue([]); openFeed(); }}
        onDone={() => setLiveQueue((q) => q.slice(1))} />

      <SheetNavContext.Provider value={sheetNav}>
      <SheetExitContext.Provider value={!sheet && !!view}>
      {view?.type === "expense" && (
        <ExpenseSheet key={view.tx?.id ?? (view.refundFor ? `refund_${view.refundFor.id}` : view.copyFrom ? `copy_${view.copyFrom.id}` : "new")} tx={view.tx} refundFor={view.refundFor} copyFrom={view.copyFrom}
          onDuplicate={(orig) => setSheet({ type: "expense", copyFrom: orig })} nameOf={nameOf} budgetAlertFor={budgetAlertFor}
          onRefund={(orig) => setSheet({ type: "expense", refundFor: orig, back: view.back })} viewedYm={ym} uid={user.uid} history={history} beforeAdd={pinIfNeeded} myName={me?.name} bans={bans}
          refundIndex={refundIndex} onEditOriginal={(orig) => setSheet({ type: "expense", tx: orig })} onMovedMonth={setYm} onClose={closeSheet} />
      )}
      {view?.type === "budget" && <BudgetSheet period={period} budget={month.budget} onClose={closeSheet} />}
      {view?.type === "settings" && (
        <SettingsSheet uid={user.uid} me={me} nameLocked={!!emailName} email={user.email} ym={ym} txs={month.txs} defaultBudget={month.defaultBudget} rules={shared.recurring}
          onOpenRecurring={() => openOver({ type: "recurring" })} onOpenCategories={() => openOver({ type: "categories" })} onClose={closeSheet} />
      )}
      {view?.type === "categories" && <CategorySheet config={shared.categoryConfig} onClose={closeSheet} />}
      {view?.type === "search" && (
        <SearchSheet initial={view.state} now={now} onClose={closeSheet}
          onEdit={(tx, state) => setSheet({ type: "expense", tx, back: { type: "search", state } })} />
      )}
      {view?.type === "year" && (
        <YearSheet initialYear={view.year} now={now} defaultBudget={month.defaultBudget} noSpendStart={noSpendStart}
          firstYear={noSpendStart ? Number(noSpendStart.slice(0, 4)) : null}
          onOpenMonth={(target) => { setYm(target); setSheet(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} onClose={closeSheet} />
      )}
      {view?.type === "recurring" && <RecurringSheet rules={shared.recurring} onClose={closeSheet} />}
      {view?.type === "lottery" && <LotterySheet uid={user.uid} myName={me?.name} today={today} onClose={closeSheet} onOpenCoupons={() => openOver({ type: "coupons" })} />}
      {view?.type === "coupons" && <CouponSheet uid={user.uid} coupons={coupons} profiles={shared.profiles} onClose={closeSheet} />}
      {view?.type === "feed" && <FeedSheet loading={!feedLoaded} uid={user.uid} items={feed} profiles={shared.profiles} lastSeen={view.lastSeen} onClose={closeSheet} />}
      {view?.type === "goal" && (
        <GoalSheet key={view.goalId ?? "new"} goal={goal} mode={view.mode} prefill={view.prefill} planned={planned} now={now} onClose={closeSheet} />
      )}
            </SheetExitContext.Provider>
      </SheetNavContext.Provider>
    </div>
    </>
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
