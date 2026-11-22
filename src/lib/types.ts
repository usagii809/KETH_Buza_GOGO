export type Spender = "태형" | "경은" | "공동";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  category: string;
  spender?: string;
  amount: number;
  memo?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  /** 매달 자동 기록으로 생긴 내역 */
  auto?: boolean;
  recurringId?: string;
}

export interface RecurringRule {
  id: string;
  memo: string;
  amount: number;
  /** 1~31 (31 = 말일) */
  day: number;
  category: string;
  spender: string;
  /** 이미 기록한 달 (YYYY-MM) */
  postedMonths?: string[];
  createdAt?: number;
}

export interface GoalHistory {
  at: number;
  amount: number;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  history?: GoalHistory[];
  createdAt?: number;
}
