// 🤫 숨겨진 재미 요소들. 화면 어디에도 설명이 없어요.

export interface Egg {
  text: string;
  /** 꽃가루 효과 */
  confetti?: boolean;
}

/** 경은이 최애, 태형이는 끌려가는 그곳 🍗 */
const GAMMI_CHICKEN = [
  "🍗 감미치킨 출동! 오늘도 태형이는 끌려갔다고 합니다",
  "🍗 경은이 최애 감미치킨 🫶 태형이는 호치킨이 먹고 싶었대요",
  "🍗 감미치킨 기록 완료. 태형이 동의율: 12% (추정)",
  "🍗 감미치킨 단골 적립 +1. 태형이 인내심 적립도 +1",
  "🍗 '이번이 마지막이야' 라던 경은이, 하지만 오늘도 역시나 감미치킨 🫠"
];

/** 지출을 새로 기록했을 때 사용처·품목·금액에 숨은 반응 */
export function expenseEgg(amount: number, memo = "", items = "", rand: () => number = Math.random): Egg | null {
  const text = `${memo} ${items}`.replace(/\s+/g, "");
  if (/감미치킨/.test(text)) return { text: GAMMI_CHICKEN[Math.floor(rand() * GAMMI_CHICKEN.length)] };
  if (/로또|복권/.test(text)) return { text: "🍀 당첨되면 반띵이에요! 약속~", confetti: true };
  if ([777, 7777, 77777, 777777].includes(amount)) return { text: "🎰 잭팟 숫자! 오늘은 운이 좋은 날이에요", confetti: true };
  if (amount >= 1000000) return { text: "💸 백만 원 돌파… 지갑이 잠깐 기절했어요" };
  if (/치킨/.test(text)) return { text: "🍗 치킨은 0칼로리래요. 대신 통장이 다이어트해요" };
  return null;
}

interface DateEgg {
  text: string;
  /** 우리만의 날: 그날 처음 앱을 열면 꽃가루 */
  ours?: boolean;
}

const DATE_EGGS: Record<string, DateEgg> = {
  "01-01": { text: "새해 복 많이 받으세요! 올해는 진짜 부자 되는 해 🧧" },
  "02-12": { text: "경은이 생일 축하해 🎂 오늘의 주인공은 통장 말고 경은이!", ours: true },
  "02-14": { text: "초콜릿은 사랑, 영수증은 현실이에요 🍫" },
  "03-14": { text: "사탕은 달고, 저축은 더 달아요 🍬" },
  "06-28": { text: "결혼기념일 축하해요 💍 우리 둘이 같이라서 부자 되는 중", ours: true },
  "08-09": { text: "태형이 생일 축하해 🎂 오늘만큼은 태형이가 재벌 모드!", ours: true },
  "11-11": { text: "빼빼로는 1+1으로 사는 게 국룰이에요 🍫" },
  "12-12": { text: "오늘은 우리가 사귄 날 💑 사랑도 통장도 복리로 불어나는 중", ours: true },
  "12-24": { text: "산타 할아버지도 오늘은 가계부 쓰는 중이래요 🎅" },
  "12-25": { text: "메리 크리스마스! 선물은 통장 잔고로 받을게요 🎄" },
  "12-31": { text: "올해도 수고했어요. 내년엔 한강뷰에서 만나요 🎆" }
};

/** 기념일에는 오늘의 한마디가 특별 문구로 바뀌어요 */
export const dateEgg = (date: string): string | null => DATE_EGGS[date.slice(5)]?.text ?? null;
/** 생일·기념일 같은 우리만의 날인지 */
export const isOurDay = (date: string): boolean => !!DATE_EGGS[date.slice(5)]?.ours;

/** 무지출 연속 일수마다 한 단계씩 자라서, 8일째에 한강뷰 도착 🌉 */
export const STAGES = [
  { emoji: "🌱", name: "새싹" },
  { emoji: "🌿", name: "풀잎" },
  { emoji: "🌷", name: "꽃" },
  { emoji: "🌳", name: "나무" },
  { emoji: "🍎", name: "열매" },
  { emoji: "🏠", name: "내 집" },
  { emoji: "🏢", name: "빌딩" },
  { emoji: "🌉", name: "한강뷰" }
];
export const stageOf = (run: number) => STAGES[Math.min(Math.max(run, 1), STAGES.length) - 1];
export const sproutEmoji = (run: number) => stageOf(run).emoji;

/** 저축액을 누를 때마다 바뀌는 단위 */
export const UNITS = [
  { label: "치킨", price: 20000, emoji: "🍗", counter: "마리" },
  { label: "아메리카노", price: 4500, emoji: "☕", counter: "잔" },
  { label: "국밥", price: 10000, emoji: "🍲", counter: "그릇" },
  { label: "삼겹살", price: 16000, emoji: "🥓", counter: "인분" }
];

export function inUnits(amount: number, unitIndex: number): string {
  const u = UNITS[unitIndex % UNITS.length];
  const n = Math.floor(Math.max(0, amount) / u.price);
  return `${u.emoji} ${u.label} ${n.toLocaleString("ko-KR")}${u.counter}`;
}
