import type { PeriodInfo } from "../../lib/dates";
import type { Summary } from "../budget/calc";

export interface Tier {
  /** 한 달 변동지출 예산 중 이만큼(%) 썼을 때부터 */
  from: number;
  label: string;
  /** 카드 배경 */
  bg: string;
  /** 단계 이름표 색 */
  chip: string;
  /** 문구를 늘리고 싶으면 여기에 한 줄씩 추가하면 돼요 */
  quips: string[];
}

/** 한 달 예산 사용률 10% 단위 10단계. 90% 이상이 최악 단계 */
export const TIERS: Tier[] = [
  {
    from: 0, label: "재벌 모드", bg: "bg-gradient-to-r from-amber-50 to-yellow-100 border-amber-300", chip: "bg-amber-500 text-white",
    quips: [
      "통장이 너무 배불러서 소화제가 필요하대요 💊",
      "지갑이 열리는 법을 잊어버렸대요. 아주 좋아요 🔒",
      "이 정도면 재벌 3세 드라마 주인공 각이에요 🎬",
      "카드가 지갑 속에서 겨울잠 자는 중이에요. 깨우지 마세요 🐻",
      "돈 쌓이는 소리가 ASMR처럼 들려요 🎧",
      "이번 달 우리 집 경제 성장률: 측정 불가 📈"
    ]
  },
  {
    from: 10, label: "건물주 모드", bg: "bg-amber-50 border-amber-200", chip: "bg-amber-400 text-white",
    quips: [
      "이대로면 곧 '건물주님'이라고 불러야 할지도 몰라요 🏢",
      "월세 내는 쪽 말고 받는 쪽에 서는 날이 머지않았어요 🗝️",
      "통장 잔고가 헬스장 다니나 봐요. 쑥쑥 크는 중 💪",
      "건물 이름은 '태경빌딩'으로 할까요? 🏗️",
      "은행에서 VIP 라운지 초대장 보낼 기세예요 💳",
      "엘리베이터 있는 건물로 알아봐도 되겠어요 🛗",
      "부자 되기 프로젝트 진척도: 순항 중 🚢"
    ]
  },
  {
    from: 20, label: "청담동 모드", bg: "bg-yellow-50 border-yellow-200", chip: "bg-yellow-500 text-white",
    quips: [
      "청담동 사장님 소리 듣는 날이 머지않았어요 💅",
      "청담동 브런치 예약해도 되는 통장 상태예요 🥞",
      "명품관 앞을 지나가도 꿀리지 않는 지갑사정이에요 👜",
      "백화점 VIP 대신 통장 VIP가 됐어요 💎"
    ]
  },
  {
    from: 30, label: "한강뷰 모드", bg: "bg-sky-50 border-sky-200", chip: "bg-sky-500 text-white",
    quips: [
      "이 페이스면 한강뷰 아파트 창문 정도는 이미 우리 거예요 🌉",
      "한강뷰 집들이 메뉴부터 미리 정해둘까요? 🥂",
      "한강뷰 거실에 소파 놓을 자리 고민해도 돼요 🛋️",
      "노을 지는 한강뷰가 점점 가까워지고 있어요 🌇",
      "커피 한 잔 아낀 게 모여서 한강뷰 벽돌 한 장 됐어요 🧱",
      "통장이 살짝 웃고 있어요. 들리시나요? 😊"
    ]
  },
  {
    from: 40, label: "알뜰 모드", bg: "bg-green-50 border-green-200", chip: "bg-toss-green text-white",
    quips: [
      "알뜰살뜰 모드 ON. 부자 DNA가 깨어나는 중 🧬",
      "이 정도면 칭찬 스티커 한 장 드릴게요 ⭐",
      "한강뷰까진 아니어도 한강공원 돗자리뷰는 확보했어요 🧺",
      "청담동 입성 준비 중… 일단 청담역까지는 왔어요 🚇",
      "알뜰함이 몸에 뱄어요. 이제 이건 습관이에요 🌱"
    ]
  },
  {
    from: 50, label: "평화 모드", bg: "bg-white border-toss-border", chip: "bg-toss-blue text-white",
    quips: [
      "딱 반 왔어요! 통장이랑 밀당 중이에요 ⚖️",
      "한강뷰도 텅장도 아닌, 아주 평화로운 하루 ☕",
      "현상 유지도 실력이에요. 이대로만 가요 👌",
      "부자까지 남은 거리: 꾸준함 하나 🛣️",
      "오늘도 무난하게 클리어. 내일은 한 단계 위로 🎮"
    ]
  },
  {
    from: 60, label: "주의 모드", bg: "bg-yellow-50 border-yellow-300", chip: "bg-yellow-600 text-white",
    quips: [
      "예산 절반을 넘겼어요. 지갑 끈 살짝 조여볼까요? 🎒",
      "청담동 가는 길에 잠깐 길을 잃었어요. 유턴하세요 🔄",
      "지금부터 아끼면 돼요. 한강뷰 아직 살아 있어요 🌉",
      "배달앱 아이콘을 폴더 깊숙이 숨겨둘 타이밍이에요 📱",
      "이번 주는 집밥이 우리를 구해줄 거예요 🍚"
    ]
  },
  {
    from: 70, label: "비상 모드", bg: "bg-orange-50 border-orange-200", chip: "bg-toss-amber text-white",
    quips: [
      "한강뷰가 점점 옆 건물 벽뷰로 바뀌는 중… 👀",
      "카드가 뜨거워요. 잠깐 냉장고에 넣어둘까요? 🧊",
      "배달앱이 우리를 VIP로 모시기 시작했어요… 😅",
      "부자 되기 프로젝트, 잠시 '버퍼링' 중 ⏳",
      "냉장고 파먹기 챌린지를 시작할 시간이에요 🥫"
    ]
  },
  {
    from: 80, label: "텅장 모드", bg: "bg-orange-100 border-orange-300", chip: "bg-orange-600 text-white",
    quips: [
      "통장이 '저 아직 살아 있어요…'라고 속삭여요 📉",
      "이번 달 남은 날은 '숨만 쉬기' 연습 기간이에요 🧘",
      "카드사에서 감사 선물 보내줄 기세예요 🎁",
      "청담동은 다음 달에 가요. 오늘은 집 앞 편의점까지만 🏪",
      "지갑이 사직서를 쓰기 시작했어요. 아직 제출은 안 했어요 ✍️",
      "남은 예산이 손가락 사이로 빠져나가는 중이에요 🫳",
      "편의점 1+1 앞에서 진지하게 고민하는 우리 🏪",
      "카드 결제 알림이 이번 달 제일 자주 연락 온 친구예요 📲",
      "포인트 적립금이 우리의 마지막 희망이에요 🪙"
    ]
  },
  {
    from: 90, label: "거지 모드", bg: "bg-red-50 border-red-200", chip: "bg-toss-red text-white",
    quips: [
      "거지 예약 완료. 라면 박스 미리 사둘까요? 🍜",
      "한강뷰는커녕 고시원 창문뷰 각이에요 🪟",
      "오늘부터 우리 집 가훈: 숨만 쉬고 살자 🫁",
      "지갑이 사직서를 냈어요. 사유: 과로 💼",
      "거지도 이렇게는 안 써요… 아, 거지는 돈이 없지 참 🤔",
      "이번 달 저축 계획이 '실종 신고' 접수됐어요 🚨",
      "다음 달의 우리가 지금의 우리를 째려보고 있어요 👀",
      "이번 달 외식 메뉴: 김밥 한 줄 반씩 나눠 먹기 🍙",
      "돼지 저금통 배를 가를지 진지하게 고민 중이에요 🐷"
    ]
  }
];

/** 한 달 변동지출 예산 중 몇 % 썼는지로 단계(0~9)를 정해요. 예산이 없거나 다음 달이면 null */
export function getSpendTier(s: Summary, period: PeriodInfo): number | null {
  if (period.state === "future" || s.totalVariableBudget <= 0) return null;
  const pct = (s.totalVariableSpent / s.totalVariableBudget) * 100;
  let tier = 0;
  TIERS.forEach((t, i) => { if (pct >= t.from) tier = i; });
  return tier;
}

/** 같은 날엔 같은 문구 (seed로 고정), 탭하면 shuffle을 올려서 다른 문구 */
export function pickQuip(tier: number, seed: string, shuffle = 0): string {
  const list = TIERS[tier].quips;
  let h = 0;
  for (const ch of `${seed}|${tier}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(h + shuffle) % list.length];
}
