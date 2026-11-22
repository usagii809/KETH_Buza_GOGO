export type Spender = "태형" | "경은" | "공동";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  category: string;
  spender?: string;
  amount: number;
  /** 어디서 (사용처: 쿠팡, 이마트 …) */
  memo?: string;
  /** 무엇을 (품목: 휴지, 우유 …) */
  items?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  /** 매달 자동 기록으로 생긴 내역 */
  auto?: boolean;
  /** 회사 돈(영업활동비)으로 쓴 내역: 기록만 하고 가계부 계산에서는 빠져요 */
  company?: boolean;
  recurringId?: string;
}

/** 가계부 계산에 들어가는 지출인지 (회사 돈은 제외) */
export const isHousehold = (t: Transaction) => !t.company;

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

/** 계정별 프로필 (사진은 작게 줄여서 문서에 바로 저장) */
export interface Profile {
  uid: string;
  name?: "태형" | "경은";
  /** data:image/jpeg;base64,… (192px) */
  photo?: string;
}

export type LotteryTier = "jackpot" | "prize" | "love" | "bomb" | "almost" | "lose";

/** 하루 한 장 복권. 여는 순간 결과가 서버에 고정돼서 다시 뽑을 수 없어요 */
export interface LotteryTicket {
  id: string;
  uid: string;
  name?: string;
  date: string;
  /** 세 칸 그림 ("7", "💎", "🐷" …) */
  symbols: string[];
  /** 예전 숫자 복권 호환 */
  digits?: number[];
  tier: LotteryTier;
  /** 2~6등 */
  rank?: number;
  prize: string;
  revealed: boolean;
  createdAt?: number;
}
