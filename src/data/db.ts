// Firestore 읽기/쓰기는 전부 이 파일에서. 화면 코드는 여기 함수만 불러요.
import {
  addDoc, arrayUnion, collection, deleteDoc, deleteField, doc, getDocs, increment,
  query, setDoc, updateDoc, where, writeBatch, type DocumentData
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { BUDGET_KEYS, normalizeBudget, normalizeCategory, normalizeSpender, type Budget } from "../lib/categories";
import { dueDateInMonth, todayStr, todayYm } from "../lib/dates";
import type { Goal, RecurringRule, Transaction } from "../lib/types";

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
  goal: (id: string) => doc(db, `${BASE}/goals/${id}`)
};

export const monthQuery = (ym: string) => query(refs.transactions(), where("yearMonth", "==", ym));

export const withId = <T>(id: string, data: DocumentData) => ({ id, ...data }) as T;

// ── 지출 ──
export type ExpenseInput = Pick<Transaction, "date" | "category" | "spender" | "amount" | "memo">;

export function addExpense(input: ExpenseInput, uid: string) {
  return addDoc(refs.transactions(), {
    ...input,
    yearMonth: input.date.slice(0, 7),
    createdBy: uid,
    createdAt: Date.now()
  });
}
export function updateExpense(id: string, input: ExpenseInput) {
  return updateDoc(refs.transaction(id), { ...input, yearMonth: input.date.slice(0, 7), updatedAt: Date.now() });
}
export const deleteExpense = (id: string) => deleteDoc(refs.transaction(id));

/** 최근 120일 기록 (자동완성용) */
export async function loadRecentTransactions(days = 120): Promise<Transaction[]> {
  const since = todayStr(new Date(Date.now() - days * 86400000));
  const snap = await getDocs(query(refs.transactions(), where("date", ">=", since)));
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
}

/** fromYm 1일 ~ toYm 말일 기록 (월별 그래프용) */
export async function loadRangeTransactions(fromYm: string, toYm: string): Promise<Transaction[]> {
  const snap = await getDocs(query(refs.transactions(), where("date", ">=", `${fromYm}-01`), where("date", "<=", `${toYm}-31`)));
  return snap.docs.map((d) => withId<Transaction>(d.id, d.data()));
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
export type GoalInput = Pick<Goal, "name" | "emoji" | "target" | "saved">;
export const addGoal = (input: GoalInput) => addDoc(refs.goals(), { ...input, history: [], createdAt: Date.now() });
export const updateGoal = (id: string, input: GoalInput) => updateDoc(refs.goal(id), { ...input });
export const deleteGoal = (id: string) => deleteDoc(refs.goal(id));
/** amount > 0 모으기, < 0 꺼내기 */
export const moveGoalMoney = (id: string, amount: number) =>
  updateDoc(refs.goal(id), { saved: increment(amount), history: arrayUnion({ at: Date.now(), amount }) });

// ── 백업 / 복원 ──
export async function exportBackup(defaultBudget: Budget) {
  const [txSnap, monthSnap, recSnap, goalSnap] = await Promise.all([
    getDocs(refs.transactions()), getDocs(refs.months()), getDocs(refs.recurring()), getDocs(refs.goals())
  ]);
  const months: Record<string, Budget> = {};
  monthSnap.forEach((d) => { months[d.id] = normalizeBudget(d.data()); });
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    defaultBudget,
    months,
    transactions: txSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    recurring: recSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    goals: goalSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  };
}

export interface ParsedBackup {
  defaultBudget: Budget | null;
  months: [string, Budget][];
  transactions: Record<string, unknown>[];
  recurring: Record<string, unknown>[];
  goals: Record<string, unknown>[];
}

export function parseBackup(raw: unknown): ParsedBackup {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    defaultBudget: p.defaultBudget && typeof p.defaultBudget === "object" ? normalizeBudget(p.defaultBudget) : null,
    months: p.months && typeof p.months === "object"
      ? Object.entries(p.months as Record<string, unknown>).filter(([ym]) => /^\d{4}-\d{2}$/.test(ym)).map(([ym, b]) => [ym, normalizeBudget(b)])
      : [],
    transactions: arr(p.transactions).filter((t) => t && t.date && Number(t.amount) > 0),
    recurring: arr(p.recurring).filter((r) => r && r.id),
    goals: arr(p.goals).filter((g) => g && g.id)
  };
}

/** 같은 id는 덮어써서 여러 번 불러와도 중복되지 않음 */
export async function importBackup(b: ParsedBackup) {
  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
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
      ...(item.auto ? { auto: true, recurringId: String(item.recurringId || "") } : {}),
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
