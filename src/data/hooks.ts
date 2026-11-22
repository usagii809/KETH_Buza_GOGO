import { onAuthStateChanged, type User } from "firebase/auth";
import { onSnapshot, type FirestoreError } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth } from "../lib/firebase";
import { normalizeBudget, ZERO_BUDGET, type Budget } from "../lib/categories";
import { shiftMonth } from "../lib/dates";
import type { Goal, LotteryTicket, Profile, RecurringRule, Transaction } from "../lib/types";
import type { StreakRecord } from "../features/noSpend/calc";
import { loadFirstRecordDate, loadMonthTransactions, loadRangeTransactions, lotteryQuery, loadRecentTransactions, monthQuery, refs, withId } from "./db";

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
    let alive = true;

    const unsubMonth = onSnapshot(refs.month(ym), (snap) => {
      setError(null);
      setOverride(snap.exists() ? normalizeBudget(snap.data()) : null);
      setOverrideLoaded(true);
    }, (err) => setError(errorMessage(err)));

    const unsubTx = onSnapshot(monthQuery(ym), (snap) => {
      setError(null);
      setTxs(snap.docs.map((d) => withId<Transaction>(d.id, d.data())).sort(byDateDesc));
    }, (err) => setError(errorMessage(err)));

    loadMonthTransactions(shiftMonth(ym, -1))
      .then((list) => { if (alive) setPrevTxs(list); })
      .catch((err) => console.warn("지난달 내역 조회 참고:", err));

    return () => { alive = false; unsubMonth(); unsubTx(); };
  }, [ym]);

  const budget = useMemo(() => (override ? { ...defaultBudget, ...override } : defaultBudget), [defaultBudget, override]);
  return { defaultBudget, override, overrideLoaded, budget, txs, prevTxs, error };
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
    loadRecentTransactions().then((list) => { setHistory(list); setHistoryLoaded(true); }).catch((err) => console.warn("최근 기록 조회 참고:", err));
    return () => { unsubRec(); unsubGoals(); unsubBest(); unsubProfiles(); };
  }, []);

  return { recurring, recurringLoaded, goals, history, historyLoaded, firstRecord, firstRecordLoaded, noSpendBest, profiles };
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
