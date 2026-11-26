// Firestore 읽기/쓰기는 전부 이 파일에서. 화면 코드는 여기 함수만 불러요.
import {
  addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, limit,
  orderBy, query, setDoc, updateDoc, where, writeBatch, type DocumentData
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { applyCategoryConfig, BUDGET_KEYS, normalizeBudget, normalizeCategory, normalizeSpender, type Budget, type CategoryConfig } from "../lib/categories";
import { dueDateInMonth, todayStr, todayYm } from "../lib/dates";
import type { Goal, LotteryTicket, Profile, RecurringRule, Settlement, Transaction } from "../lib/types";

const BASE = "ledgers/shared_household";
export const refs = {
  transactions: () => collection(db, `${BASE}/transactions`),
  transaction: (id: string) => doc(db, `${BASE}/transactions/${id}`),
  months: () => collection(db, `${BASE}/months`),
  month: (ym: string) => doc(db, `${BASE}/months/${ym}`),
  defaultBudget: () => doc(db, `${BASE}/config/defaultBudget`),
  recurring: () => collection(db, `${BASE}/recurring`),
  recurringRule: (id: string) => doc(db, `${BASE}/recurring/${id}`),
  goals: () => collection(db, `${BASE}/goals`),
  goal: (id: string) => doc(db, `${BASE}/goals/${id}`),
  noSpendBest: () => doc(db, `${BASE}/config/noSpendBest`),
  categories: () => doc(db, `${BASE}/config/categories`),
  settlements: () => collection(db, `${BASE}/settlements`),
  profiles: () => collection(db, `${BASE}/profiles`),
  profile: (uid: string) => doc(db, `${BASE}/profiles/${uid}`),
  lotteries: () => collection(db, `${BASE}/lottery`),
  lottery: (id: string) => doc(db, `${BASE}/lottery/${id}`),
  // 같이 보기: 복권 · 쿠폰 · 저축 소식에 단 반응 (문서 id = 소식 id)
  feedReactions: () => collection(db, `${BASE}/feedReactions`),
  feedReaction: (id: string) => doc(db, `${BASE}/feedReactions/${id}`),
  // 🔔 알림 받을 기기 (문서 id = 기기 구독 주소의 해시)
  pushSub: (id: string) => doc(db, `${BASE}/pushSubs/${id}`),
  // 예산 문서(months)와 섞이지 않게 따로 둬요
  settlement: (ym: string) => doc(db, `${BASE}/settlements/${ym}`)
};

export const monthQuery = (ym: string) => query(refs.transactions(), where("yearMonth", "==", ym));

export const withId = <T>(id: string, data: DocumentData) => ({ id, ...data }) as T;

// ── 지출 ──
export type ExpenseInput = Pick<Transaction, "date" | "category" | "spender" | "amount" | "memo" | "items" | "company" | "refundOf">;

/** Firestore는 undefined 값을 못 받아서 빼고 보내요 */
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/**
 * 오프라인이면 서버 확인을 기다리지 않아요.
 * 기록은 이미 폰 안에 저장돼서 화면에 바로 보이고, 연결되면 알아서 올라가요.
 * 반환값: "synced" = 서버까지 저장됨 / "queued" = 폰에 저장, 연결되면 올라감
 */
export async function localFirst(write: Promise<unknown>, waitMs = 2500): Promise<"synced" | "queued"> {
  write.catch((err) => console.error("서버 저장 오류:", err));
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "queued";
  const timer = new Promise<"queued">((r) => setTimeout(() => r("queued"), waitMs));
  return Promise.race([write.then(() => "synced" as const), timer]);
}

export function addExpense(input: ExpenseInput, uid: string) {
  // 문서 id를 먼저 만들고 저장해요 (오프라인에서도 바로 화면에 나와요)
  return setDoc(doc(refs.transactions()), {
    ...clean(input),
    yearMonth: input.date.slice(0, 7),
    createdBy: uid,
    createdAt: Date.now()
  });
}
/** 고치기. refundOf가 빈 문자열이면 원래 결제와의 연결을 끊어요 */
export function updateExpense(id: string, input: ExpenseInput) {
  const { refundOf, ...rest } = input;
  const link = refundOf ? { refundOf } : refundOf === "" ? { refundOf: deleteField() } : {};
  return updateDoc(refs.transaction(id), { ...clean(rest), ...link, yearMonth: input.date.slice(0, 7), updatedAt: Date.now() });
}
export const deleteExpense = (id: string) => deleteDoc(refs.transaction(id));
/** 지운 기록 되살리기 (같은 id · 같은 내용으로 다시 저장) */
export function restoreExpenses(txs: Transaction[]) {
  const batch = writeBatch(db);
  txs.forEach(({ id, pending: _pending, ...data }) => batch.set(refs.transaction(id), clean(data as Record<string, unknown>)));
  return batch.commit();
}
/** 결제와 연결된 환불까지 한 번에 지워요 (따로 지우면 중간에 한쪽만 남을 수 있어서) */
export function deleteExpenses(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(refs.transaction(id)));
  return batch.commit();
}

// ── 같이 보기: 반응 ──
/** 최근 30일 안에 남긴 기록 (새 소식 피드) */
export const FEED_DAYS = 30;
export const feedQuery = (since: number) => query(refs.transactions(), where("createdAt", ">=", since));
/** emoji가 null이면 반응 지우기 */
export const setReaction = (txId: string, uid: string, emoji: string | null) =>
  updateDoc(refs.transaction(txId), { [`reactions.${uid}`]: emoji ? { e: emoji, at: Date.now() } : deleteField() });

/** 복권 · 쿠폰 · 저축 소식에 반응 (emoji가 null이면 지우기) */
export const setActivityReaction = (itemId: string, uid: string, emoji: string | null) =>
  setDoc(refs.feedReaction(itemId), { [uid]: emoji ? { e: emoji, at: Date.now() } : deleteField() }, { merge: true });

export const HISTORY_DAYS = 120;

/** 최근 120일 기록 (자동완성 · 무지출 최장 기록용) */
export async function loadRecentTransactions(days = HISTORY_DAYS): Promise<Transaction[]> {
  const since = todayStr(new Date(Date.now() - days * 86400000));
  const snap = await getDocs(query(refs.transactions(), where("date", ">=", since)));
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
}

/** fromYm 1일 ~ toYm 말일 기록 (월별 그래프용) */
export async function loadRangeTransactions(fromYm: string, toYm: string): Promise<Transaction[]> {
  const snap = await getDocs(query(refs.transactions(), where("date", ">=", `${fromYm}-01`), where("date", "<=", `${toYm}-31`)));
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
}

/** 가장 처음 남긴 기록의 날짜 (무지출 챌린지는 이 날부터 세요) */
export async function loadFirstRecordDate(): Promise<string | null> {
  const snap = await getDocs(query(refs.transactions(), orderBy("date"), limit(1)));
  const d = snap.docs[0]?.data().date;
  return typeof d === "string" ? d : null;
}

/** 모든 기록 (전체 기간 검색용). 둘이 쓰는 가계부라 수천 건 수준이고, 한 번 받으면 폰에 캐시돼요 */
export async function loadAllTransactions(): Promise<Transaction[]> {
  const snap = await getDocs(refs.transactions());
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
}

/** 연간 결산용: 그 해 기록 · 달별 예산 · 복권 */
export async function loadYearData(year: number) {
  const y = String(year);
  const [txSnap, monthSnap, lotterySnap] = await Promise.all([
    getDocs(query(refs.transactions(), where("date", ">=", `${y}-01-01`), where("date", "<=", `${y}-12-31`))),
    getDocs(refs.months()),
    getDocs(query(refs.lotteries(), where("date", ">=", `${y}-01-01`), where("date", "<=", `${y}-12-31`)))
  ]);
  const months: Record<string, Budget> = {};
  monthSnap.docs.forEach((d) => { if (d.id.startsWith(y)) months[d.id] = normalizeBudget(d.data()); });
  return {
    txs: txSnap.docs.map((d) => withId<Transaction>(d.id, d.data())),
    months,
    tickets: lotterySnap.docs.map((d) => withId<LotteryTicket>(d.id, d.data()))
  };
}

export async function loadMonthTransactions(ym: string): Promise<Transaction[]> {
  const snap = await getDocs(monthQuery(ym));
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
}

// ── 예산 ──
export async function saveBudget(ym: string, budget: Budget, alsoDefault: boolean) {
  const payload = {
    ...budget,
    updatedAt: Date.now(),
    // 예전 키 정리
    essentialReserve: deleteField(),
    miscLiving: deleteField(),
    misc_living: deleteField()
  };
  if (alsoDefault) await setDoc(refs.defaultBudget(), payload, { merge: true });
  await setDoc(refs.month(ym), payload, { merge: true });
}

/** 첫 지출이 생기는 달은 그 시점 예산을 고정 → 나중에 기본 예산을 바꿔도 지난달 결과가 변하지 않음 */
export async function pinMonthBudget(ym: string, budget: Budget) {
  if (!BUDGET_KEYS.some((k) => budget[k] > 0)) return;
  await setDoc(refs.month(ym), { ...budget, pinnedAt: Date.now() }, { merge: true });
}

// ── 카테고리 직접 추가 · 숨기기 ──
export const saveCategoryConfig = (cfg: CategoryConfig) => setDoc(refs.categories(), { custom: cfg.custom || [], hidden: cfg.hidden || [], overrides: cfg.overrides || {}, updatedAt: Date.now() });

/** 이 카테고리를 쓰는 기록 · 자동 기록 규칙이 있는지 */
export async function categoryInUse(key: string): Promise<{ txs: number; rules: number }> {
  const [t, r] = await Promise.all([
    getDocs(query(refs.transactions(), where("category", "==", key))),
    getDocs(query(refs.recurring(), where("category", "==", key)))
  ]);
  return { txs: t.size ?? t.docs.length, rules: r.size ?? r.docs.length };
}

/** 카테고리 지우기: 쓰던 기록 · 자동 기록 · 예산을 다른 카테고리(to)로 옮기고 목록에서 빼요 */
export async function removeCategory(key: string, to: string, next: CategoryConfig) {
  const [t, r, m, d] = await Promise.all([
    getDocs(query(refs.transactions(), where("category", "==", key))),
    getDocs(query(refs.recurring(), where("category", "==", key))),
    getDocs(refs.months()),
    getDoc(refs.defaultBudget())
  ]);
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  t.docs.forEach((x) => ops.push((b) => b.update(x.ref, { category: to, updatedAt: Date.now() })));
  r.docs.forEach((x) => ops.push((b) => b.update(x.ref, { category: to })));
  // 예산은 옮길 카테고리에 더해요
  const moveBudget = (ref: ReturnType<typeof refs.month>, data: DocumentData | undefined) => {
    const v = Number(data?.[key]) || 0;
    if (data && key in data) ops.push((b) => b.set(ref, { [key]: deleteField(), ...(v ? { [to]: (Number(data[to]) || 0) + v } : {}) }, { merge: true }));
  };
  m.docs.forEach((x) => moveBudget(x.ref, x.data()));
  if (d.exists()) moveBudget(refs.defaultBudget(), d.data());
  ops.push((b) => b.set(refs.categories(), { custom: next.custom || [], hidden: next.hidden || [], overrides: next.overrides || {}, updatedAt: Date.now() }));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((fn) => fn(batch));
    await batch.commit();
  }
  return { txs: t.docs.length, rules: r.docs.length };
}

// ── 매달 자동 기록 ──
export type RecurringInput = Pick<RecurringRule, "memo" | "amount" | "day" | "category" | "spender">;

/** 이번 달 날짜가 이미 지났으면 이번 달은 건너뜀 (이미 직접 기록했을 가능성이 커서) */
export async function addRecurring(input: RecurringInput) {
  const ym = todayYm();
  const passed = dueDateInMonth(input.day, ym) < todayStr();
  await addDoc(refs.recurring(), { ...input, postedMonths: passed ? [ym] : [], createdAt: Date.now() });
  return { startsNextMonth: passed };
}
export const updateRecurring = (id: string, input: RecurringInput) => updateDoc(refs.recurringRule(id), { ...input });
export const deleteRecurring = (id: string) => deleteDoc(refs.recurringRule(id));

let autoPosting = false;
/**
 * 날짜가 된 자동 기록을 이번 달 내역으로 남겨요. 앱을 열 때마다 확인해요.
 * 문서 id를 고정해서 두 폰이 동시에 열어도 한 건만 생겨요.
 */
export async function runRecurring(rules: RecurringRule[], uid: string, beforeFirstPost?: (ym: string) => Promise<void>) {
  if (autoPosting) return 0;
  autoPosting = true;
  let posted = 0;
  try {
    const ym = todayYm();
    const today = todayStr();
    for (const r of rules) {
      if ((r.postedMonths || []).includes(ym)) continue;
      const due = dueDateInMonth(r.day, ym);
      if (due > today) continue;
      if (posted === 0 && beforeFirstPost) await beforeFirstPost(ym).catch(() => undefined);
      await setDoc(refs.transaction(`rec_${r.id}_${ym}`), {
        date: due,
        yearMonth: ym,
        category: normalizeCategory(r.category),
        spender: normalizeSpender(r.spender),
        amount: Number(r.amount) || 0,
        memo: r.memo || "",
        auto: true,
        recurringId: r.id,
        createdBy: uid,
        createdAt: Date.now()
      });
      await updateDoc(refs.recurringRule(r.id), { postedMonths: arrayUnion(ym) });
      posted++;
    }
  } catch (err) {
    console.warn("자동 기록 참고:", err);
  } finally {
    autoPosting = false;
  }
  return posted;
}

// ── 저축 목표 ──
export type GoalInput = Pick<Goal, "name" | "emoji" | "target" | "saved" | "monthly">;
/** 지금 로그인한 계정 (같이 보기에 '누가 했는지' 남기려고) */
const myUid = () => auth.currentUser?.uid;
const withBy = <T extends object>(o: T) => { const by = myUid(); return by ? { ...o, by } : o; };

export const addGoal = (input: GoalInput) =>
  addDoc(refs.goals(), { ...input, history: [], createdAt: Date.now(), ...(myUid() ? { createdBy: myUid() } : {}) });
export const updateGoal = (id: string, input: GoalInput) => updateDoc(refs.goal(id), { ...input });
export const deleteGoal = (id: string) => deleteDoc(refs.goal(id));
/** amount > 0 모으기, < 0 꺼내기 */
export const moveGoalMoney = (id: string, amount: number) =>
  updateDoc(refs.goal(id), { saved: increment(amount), history: arrayUnion(withBy({ at: Date.now(), amount })) });

// ── 무지출 최장 기록 (두 사람이 같이 봐요) ──
export const saveNoSpendBest = (best: { days: number; from: string; to: string }) =>
  setDoc(refs.noSpendBest(), { ...best, updatedAt: Date.now() });

// ── 프로필 ──
export const saveProfile = (uid: string, data: Partial<Omit<Profile, "uid">>) =>
  setDoc(refs.profile(uid), { ...data, updatedAt: Date.now() }, { merge: true });
export const removeProfilePhoto = (uid: string) => setDoc(refs.profile(uid), { photo: deleteField() }, { merge: true });

// ── 오늘의 복권 ──
export const lotteryQuery = (fromDate: string) => query(refs.lotteries(), where("date", ">=", fromDate));

/** 오늘 복권이 이미 있으면 그대로, 없으면 새로 뽑아 저장 (다시 뽑기 방지) */
export async function getOrCreateTicket(uid: string, date: string, draw: () => Omit<LotteryTicket, "id" | "uid" | "date" | "revealed">, name?: string): Promise<LotteryTicket> {
  const id = `${date}_${uid}`;
  const snap = await getDoc(refs.lottery(id));
  if (snap.exists()) return withId<LotteryTicket>(id, snap.data());
  const ticket = { ...draw(), uid, date, revealed: false, createdAt: Date.now(), ...(name ? { name } : {}) };
  await setDoc(refs.lottery(id), ticket);
  return { id, ...ticket };
}
export const revealTicket = (id: string) => updateDoc(refs.lottery(id), { revealed: true, revealedAt: Date.now() });

// ── 복권 쿠폰함 ──
export const COUPON_TIERS = ["jackpot", "prize", "love"] as const;
export const couponQuery = () => query(refs.lotteries(), where("tier", "in", [...COUPON_TIERS]));
export const markCouponUsed = (id: string) => updateDoc(refs.lottery(id), { usedAt: Date.now() });

// ── 월말 정산 ──
/** 남은 돈을 저축 목표에 넣고, 그 달에 '정산 완료'를 남겨요 (한 번에 저장) */
export async function settleMonth(ym: string, goal: Pick<Goal, "id" | "name">, amount: number, by?: string) {
  const at = Date.now();
  const batch = writeBatch(db);
  batch.update(refs.goal(goal.id), { saved: increment(amount), history: arrayUnion(withBy({ at, amount, settle: ym })) });
  const settlement: Settlement = { at, goalId: goal.id, goalName: goal.name, amount, ...(by ? { by } : {}) };
  batch.set(refs.settlement(ym), settlement);
  await batch.commit();
}
export const skipSettlement = (ym: string, by?: string) =>
  setDoc(refs.settlement(ym), { at: Date.now(), skipped: true, ...(by ? { by } : {}) });

// ── 백업 / 복원 ──
const docsOf = (snap: { docs: { id: string; data: () => DocumentData }[] }) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** 전체 백업 (v4): 앱이 쓰는 데이터를 전부 담아요 */
export async function exportBackup(defaultBudget: Budget) {
  const [txSnap, monthSnap, recSnap, goalSnap, settleSnap, lotterySnap, profileSnap, bestSnap, catSnap] = await Promise.all([
    getDocs(refs.transactions()), getDocs(refs.months()), getDocs(refs.recurring()), getDocs(refs.goals()),
    getDocs(refs.settlements()), getDocs(refs.lotteries()), getDocs(refs.profiles()), getDoc(refs.noSpendBest()), getDoc(refs.categories())
  ]);
  const months: Record<string, Budget> = {};
  monthSnap.forEach((d) => { months[d.id] = normalizeBudget(d.data()); });
  const settlements: Record<string, DocumentData> = {};
  settleSnap.docs.forEach((d) => { settlements[d.id] = d.data(); });
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    defaultBudget,
    months,
    transactions: docsOf(txSnap),
    recurring: docsOf(recSnap),
    goals: docsOf(goalSnap),
    /** 월말 정산 기록 (없으면 복원 후 정산을 또 해서 목표에 두 번 들어갈 수 있어요) */
    settlements,
    /** 복권 · 쿠폰 */
    lottery: docsOf(lotterySnap),
    /** 프로필 (이름 · 사진) */
    profiles: docsOf(profileSnap),
    noSpendBest: bestSnap.exists() ? bestSnap.data() : null,
    /** 직접 추가한 카테고리 · 숨긴 카테고리 */
    categories: catSnap.exists() ? catSnap.data() : null
  };
}

export interface ParsedBackup {
  defaultBudget: Budget | null;
  months: [string, Budget][];
  transactions: Record<string, unknown>[];
  recurring: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  settlements: [string, Record<string, unknown>][];
  lottery: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  noSpendBest: Record<string, unknown> | null;
  categories: CategoryConfig | null;
}

export function parseBackup(raw: unknown): ParsedBackup {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  return {
    defaultBudget: p.defaultBudget && typeof p.defaultBudget === "object" ? normalizeBudget(p.defaultBudget) : null,
    months: p.months && typeof p.months === "object"
      ? Object.entries(p.months as Record<string, unknown>).filter(([ym]) => /^\d{4}-\d{2}$/.test(ym)).map(([ym, b]) => [ym, normalizeBudget(b)])
      : [],
    // 0원이 아닌 기록 (음수 = 환불)
    transactions: arr(p.transactions).filter((t) => t && t.date && Number(t.amount) && Number.isFinite(Number(t.amount))),
    recurring: arr(p.recurring).filter((r) => r && r.id),
    goals: arr(p.goals).filter((g) => g && g.id),
    settlements: Object.entries(obj(p.settlements) || {})
      .filter(([ym, v]) => /^\d{4}-\d{2}$/.test(ym) && obj(v)).map(([ym, v]) => [ym, v as Record<string, unknown>]),
    lottery: arr(p.lottery).filter((t) => t && t.id && t.uid && t.date),
    profiles: arr(p.profiles).filter((x) => x && x.id),
    noSpendBest: obj(p.noSpendBest) && Number((p.noSpendBest as Record<string, unknown>).days) > 0 ? (p.noSpendBest as Record<string, unknown>) : null,
    categories: obj(p.categories) as CategoryConfig | null
  };
}

/** 같은 id는 덮어써서 여러 번 불러와도 중복되지 않음 */
export async function importBackup(b: ParsedBackup) {
  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  // 직접 추가한 카테고리를 먼저 적용해야 기록의 카테고리가 '기타 생활비'로 바뀌지 않아요
  if (b.categories) {
    const cats = b.categories;
    applyCategoryConfig(cats);
    ops.push((x) => x.set(refs.categories(), cats));
  }
  b.settlements.forEach(([ym, s]) => ops.push((x) => x.set(refs.settlement(ym), s)));
  b.lottery.forEach(({ id, ...rest }) => ops.push((x) => x.set(refs.lottery(String(id)), rest)));
  b.profiles.forEach(({ id, ...rest }) => ops.push((x) => x.set(refs.profile(String(id)), rest, { merge: true })));
  if (b.noSpendBest) { const best = b.noSpendBest; ops.push((x) => x.set(refs.noSpendBest(), best)); }
  if (b.defaultBudget) { const d = b.defaultBudget; ops.push((x) => x.set(refs.defaultBudget(), d, { merge: true })); }
  b.months.forEach(([ym, budget]) => ops.push((x) => x.set(refs.month(ym), budget, { merge: true })));
  b.recurring.forEach(({ id, ...rest }) => ops.push((x) => x.set(refs.recurringRule(String(id)), rest)));
  b.goals.forEach(({ id, ...rest }) => ops.push((x) => x.set(refs.goal(String(id)), rest)));
  b.transactions.forEach((item) => {
    const ref = item.id ? refs.transaction(String(item.id)) : doc(refs.transactions());
    const date = String(item.date);
    ops.push((x) => x.set(ref, {
      date,
      yearMonth: date.slice(0, 7),
      category: normalizeCategory(item.category as string),
      spender: normalizeSpender(item.spender as string),
      amount: Number(item.amount) || 0,
      memo: String(item.memo || ""),
      items: String(item.items || ""),
      ...(item.company ? { company: true } : {}),
      ...(item.auto ? { auto: true, recurringId: String(item.recurringId || "") } : {}),
      ...(item.refundOf ? { refundOf: String(item.refundOf) } : {}),
      ...(item.reactions && typeof item.reactions === "object" ? { reactions: item.reactions } : {}),
      ...(item.createdBy ? { createdBy: String(item.createdBy) } : {}),
      createdAt: Number(item.createdAt) || Date.now()
    }));
  });
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((fn) => fn(batch));
    await batch.commit();
  }
}
