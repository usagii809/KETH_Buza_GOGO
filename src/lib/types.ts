export type Spender = "태형" | "경은" | "공동";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  yearMonth: string; // YYYY-MM
  category: string;
  spender?: string;
  /** 0보다 작으면 환불·취소 (그날 지출에서 빠져요) */
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
  /** 환불·부분취소: 원래 결제 기록 id */
  refundOf?: string;
  /** 아직 서버에 못 올린 기록 (화면 표시용, 저장하지 않아요) */
  pending?: boolean;
  /** 같이 보기 반응: uid → 이모지 */
  reactions?: Record<string, Reaction>;
}

export interface Reaction {
  e: string;
  at: number;
}

/** 가계부 계산에 들어가는 지출인지 (회사 돈은 제외) */
export const isHousehold = (t: Transaction) => !t.company;

/** 환불·취소 기록인지 */
export const isRefund = (t: Pick<Transaction, "amount">) => (Number(t.amount) || 0) < 0;

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
  /** 누가 넣었/뺐는지 (uid, 같이 보기용 · 예전 기록엔 없어요) */
  by?: string;
  /** 월말 정산으로 들어온 돈이면 그 달 (YYYY-MM) */
  settle?: string;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  /** 매달 모을 돈 (선택) */
  monthly?: number;
  history?: GoalHistory[];
  createdAt?: number;
  /** 만든 사람 uid (같이 보기용) */
  createdBy?: string;
}

/** 계정별 프로필 (사진은 작게 줄여서 문서에 바로 저장) */
export interface Profile {
  uid: string;
  name?: "태형" | "경은";
  /** data:image/jpeg;base64,… (192px) */
  photo?: string;
  /** '같이 보기'를 마지막으로 연 시각 (기기가 달라도 같은 계정이면 읽음으로) */
  feedSeenAt?: number;
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
  /** 복권을 긁은 시각 */
  revealedAt?: number;
  /** 쿠폰을 쓴 시각 */
  usedAt?: number;
}

/** 월말 정산 기록 (months/{ym}.settlement) */
export interface Settlement {
  at: number;
  by?: string;
  /** 넘어가기를 눌렀으면 true */
  skipped?: boolean;
  goalId?: string;
  goalName?: string;
  amount?: number;
}
