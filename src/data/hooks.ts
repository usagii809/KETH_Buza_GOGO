import { onAuthStateChanged, type User } from "firebase/auth";
import { onSnapshot, type FirestoreError } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth } from "../lib/firebase";
import { applyCategoryConfig, getCategoryVersion, normalizeBudget, ZERO_BUDGET, type Budget } from "../lib/categories";
import { shiftMonth } from "../lib/dates";
import type { Goal, LotteryTicket, Profile, Reaction, RecurringRule, Settlement, Transaction } from "../lib/types";
import type { StreakRecord } from "../features/noSpend/calc";
import { couponQuery, FEED_DAYS, feedQuery, loadFirstRecordDate, loadMonthTransactions, loadRangeTransactions, lotteryQuery, loadRecentTransactions, monthQuery, refs, withId } from "./db";

/** undefined = 확인 중, null = 로그아웃 */
export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

const errorMessage = (err: FirestoreError) =>
  err.code === "permission-denied"
    ? "데이터를 불러올 권한이 없어요. Firebase의 Firestore 규칙에 지금 계정(UID)이 등록돼 있는지 확인해 주세요."
    : "동기화가 잠깐 끊겼어요. 인터넷 연결을 확인해 주세요.";

const byDateDesc = (a: Transaction, b: Transaction) =>
  a.date !== b.date ? b.date.localeCompare(a.date) : (b.createdAt || 0) - (a.createdAt || 0);

/** 보고 있는 달의 예산 · 내역 · 지난달 내역 (실시간) */
export function useMonthData(ym: string) {
  const [defaultBudget, setDefaultBudget] = useState<Budget>(ZERO_BUDGET);
  const [override, setOverride] = useState<Budget | null>(null);
  const [overrideLoaded, setOverrideLoaded] = useState(false);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [prevTxs, setPrevTxs] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 이 달 기록을 한 번이라도 받았는지 (첫 로딩 화면을 언제 걷을지)
  const [txsLoaded, setTxsLoaded] = useState(false);

  useEffect(() => onSnapshot(refs.defaultBudget(), (snap) => {
    setError(null);
    setDefaultBudget(snap.exists() ? normalizeBudget(snap.data()) : ZERO_BUDGET);
  }, (err) => setError(errorMessage(err))), []);

  useEffect(() => {
    // 달을 바꾸는 순간 이전 달 데이터가 잠깐 보이지 않도록 비움
    setOverride(null);
    setOverrideLoaded(false);
    setTxs([]);
    setPrevTxs([]);
    setTxsLoaded(false);
    let alive = true;

    const unsubMonth = onSnapshot(refs.month(ym), (snap) => {
      setError(null);
      setOverride(snap.exists() ? normalizeBudget(snap.data()) : null);
      setOverrideLoaded(true);
    }, (err) => setError(errorMessage(err)));

    // includeMetadataChanges: 오프라인 기록이 서버에 올라가면 '올리는 중' 표시를 지우려고
    const unsubTx = onSnapshot(monthQuery(ym), { includeMetadataChanges: true }, (snap) => {
      setError(null);
      setTxs(snap.docs.map((d) => ({ ...withId<Transaction>(d.id, d.data()), ...(d.metadata.hasPendingWrites ? { pending: true } : {}) })).sort(byDateDesc));
      setTxsLoaded(true);
    }, (err) => { setError(errorMessage(err)); setTxsLoaded(true); });

    loadMonthTransactions(shiftMonth(ym, -1))
      .then((list) => { if (alive) setPrevTxs(list); })
      .catch((err) => console.warn("지난달 내역 조회 참고:", err));

    return () => { alive = false; unsubMonth(); unsubTx(); };
  }, [ym]);

  const budget = useMemo(() => (override ? { ...defaultBudget, ...override } : defaultBudget), [defaultBudget, override]);
  return { defaultBudget, override, overrideLoaded, budget, txs, prevTxs, error, txsLoaded };
}

/** 보고 있는 달 이전 (n-1)개월 기록 (월별 그래프용, 1회 조회) */
export function useRecentMonths(ym: string, n = 6) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  useEffect(() => {
    let alive = true;
    setTxs([]);
    loadRangeTransactions(shiftMonth(ym, -(n - 1)), shiftMonth(ym, -1))
      .then((list) => { if (alive) setTxs(list); })
      .catch((err) => console.warn("월별 기록 조회 참고:", err));
    return () => { alive = false; };
  }, [ym, n]);
  return txs;
}

/** 달과 상관없는 공유 데이터: 자동 기록 규칙, 저축 목표, 최근 기록(자동완성) */
export function useSharedData() {
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [firstRecord, setFirstRecord] = useState<string | null>(null);
  const [firstRecordLoaded, setFirstRecordLoaded] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [noSpendBest, setNoSpendBest] = useState<StreakRecord | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categoryConfig, setCategoryConfig] = useState<{ raw: unknown; version: number } | null>(null);

  useEffect(() => {
    const unsubRec = onSnapshot(refs.recurring(), (snap) => {
      setRecurring(snap.docs.map((d) => withId<RecurringRule>(d.id, d.data())).sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0)));
      setRecurringLoaded(true);
    }, (err) => console.warn("자동 기록 구독 참고:", err));
    const unsubGoals = onSnapshot(refs.goals(), (snap) => {
      setGoals(snap.docs.map((d) => withId<Goal>(d.id, d.data())).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
    }, (err) => console.warn("저축 목표 구독 참고:", err));
    loadFirstRecordDate()
      .then((d) => { setFirstRecord(d); setFirstRecordLoaded(true); })
      .catch((err) => console.warn("첫 기록 조회 참고:", err));
    const unsubBest = onSnapshot(refs.noSpendBest(), (snap) => {
      const d = snap.exists() ? snap.data() : null;
      setNoSpendBest(d && Number(d.days) > 0 && typeof d.from === "string" && typeof d.to === "string" ? { days: Number(d.days), from: d.from, to: d.to } : null);
    }, (err) => console.warn("무지출 최장 기록 구독 참고:", err));
    const unsubProfiles = onSnapshot(refs.profiles(), (snap) => {
      setProfiles(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Profile));
    }, (err) => console.warn("프로필 구독 참고:", err));
    // 직접 추가한 항목: 받으면 바로 적용하고, 화면이 다시 계산되게 version을 올려요
    const unsubCats = onSnapshot(refs.categories(), (snap) => {
      const raw = snap.exists() ? snap.data() : {};
      applyCategoryConfig(raw);
      setCategoryConfig({ raw, version: getCategoryVersion() });
    }, (err) => { console.warn("카테고리 구독 참고:", err); setCategoryConfig((c) => c ?? { raw: {}, version: getCategoryVersion() }); });
    loadRecentTransactions().then((list) => { setHistory(list); setHistoryLoaded(true); }).catch((err) => console.warn("최근 기록 조회 참고:", err));
    return () => { unsubRec(); unsubGoals(); unsubBest(); unsubProfiles(); unsubCats(); };
  }, []);

  return {
    recurring, recurringLoaded, goals, history, historyLoaded, firstRecord, firstRecordLoaded, noSpendBest, profiles,
    categoryConfig: categoryConfig?.raw ?? null, categoriesLoaded: !!categoryConfig, categoryVersion: categoryConfig?.version ?? 0
  };
}

/** 이번 달 복권 기록 (오늘 결과 · 이달 치맥 횟수) */
export function useLottery(monthStart: string) {
  const [tickets, setTickets] = useState<LotteryTicket[]>([]);
  useEffect(() => onSnapshot(lotteryQuery(monthStart), (snap) => {
    setTickets(snap.docs.map((d) => withId<LotteryTicket>(d.id, d.data())));
  }, (err) => console.warn("복권 구독 참고:", err)), [monthStart]);
  return tickets;
}

/** 앱으로 돌아올 때마다 '오늘' 기준을 다시 잡기 위한 시계 */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") setNow(new Date()); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return now;
}

/** 복권 쿠폰 (1등 · 2~5등 · 하트) 전부 */
export function useCoupons() {
  const [coupons, setCoupons] = useState<LotteryTicket[]>([]);
  useEffect(() => onSnapshot(couponQuery(), (snap) => {
    setCoupons(snap.docs.map((d) => withId<LotteryTicket>(d.id, d.data())).filter((t) => t.revealed));
  }, (err) => console.warn("쿠폰 구독 참고:", err)), []);
  return coupons;
}

/** 새 소식 피드용: 최근 30일 안에 남긴 기록 (실시간) */
export function useFeedTxs() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  useEffect(() => {
    const since = Date.now() - FEED_DAYS * 86400000;
    return onSnapshot(feedQuery(since), (snap) => {
      setTxs(snap.docs.map((d) => withId<Transaction>(d.id, d.data())));
    }, (err) => console.warn("새 소식 구독 참고:", err));
  }, []);
  return txs;
}

/** 같이 보기: 복권 · 쿠폰 · 저축 소식에 달린 반응 (소식 id → uid → 반응) */
export function useFeedReactions() {
  const [map, setMap] = useState<Record<string, Record<string, Reaction>>>({});
  useEffect(() => onSnapshot(refs.feedReactions(), (snap) => {
    const next: Record<string, Record<string, Reaction>> = {};
    snap.docs.forEach((d) => { next[d.id] = d.data() as Record<string, Reaction>; });
    setMap(next);
  }, (err) => console.warn("반응 구독 참고:", err)), []);
  return map;
}

/** 어떤 달의 정산 기록과 그 달 예산 (월말 정산용) */
export function useSettlement(ym: string) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [override, setOverride] = useState<Budget | null>(null);
  useEffect(() => {
    setLoaded(false);
    setSettlement(null);
    setOverride(null);
    const u1 = onSnapshot(refs.settlement(ym), (snap) => {
      setSettlement(snap.exists() ? (snap.data() as Settlement) : null);
      setLoaded(true);
    }, (err) => { console.warn("정산 구독 참고:", err); setLoaded(true); });
    const u2 = onSnapshot(refs.month(ym), (snap) => setOverride(snap.exists() ? normalizeBudget(snap.data()) : null),
      (err) => console.warn("지난달 예산 구독 참고:", err));
    return () => { u1(); u2(); };
  }, [ym]);
  return { settlement, loaded, override };
}
