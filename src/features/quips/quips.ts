import type { PeriodInfo } from "../../lib/dates";
import type { Summary } from "../budget/calc";

export type SpendLevel = "rich" | "good" | "normal" | "warning" | "broke";

export const LEVEL_LABEL: Record<SpendLevel, string> = {
  rich: "청담동 모드",
  good: "알뜰 모드",
  normal: "평화 모드",
  warning: "주의 모드",
  broke: "텅장 모드"
};

/** 문구를 늘리고 싶으면 여기에 한 줄씩 추가하면 돼요 */
export const QUIPS: Record<SpendLevel, string[]> = {
  rich: [
    "이 페이스면 한강뷰 아파트 창문 정도는 이미 우리 거예요 🌉",
    "청담동 사장님 소리 듣는 날이 머지않았어요 💅",
    "통장이 너무 배불러서 소화제가 필요하대요 💊",
    "지갑이 열리는 법을 잊어버렸대요. 아주 좋아요 🔒",
    "이대로면 곧 '건물주님'이라고 불러야 할지도 몰라요 🏢",
    "부자는 원래 조용히 안 써요. 지금 딱 그 느낌 🤫",
    "한강뷰 집들이 메뉴부터 미리 정해둘까요? 🥂",
    "통장 잔고가 헬스장 다니나 봐요. 쑥쑥 크는 중 💪"
  ],
  good: [
    "한강뷰까진 아니어도 한강공원 돗자리뷰는 확보했어요 🧺",
    "청담동 입성 준비 중… 일단 청담역까지는 왔어요 🚇",
    "이 정도면 칭찬 스티커 한 장 드릴게요 ⭐",
    "통장이 살짝 웃고 있어요. 들리시나요? 😊",
    "알뜰살뜰 모드 ON. 부자 DNA가 깨어나는 중 🧬",
    "커피 한 잔 아낀 게 모여서 한강뷰 벽돌 한 장 됐어요 🧱",
    "이 기세면 내년엔 '부자' 소리 들어요 📈"
  ],
  normal: [
    "딱 계획대로! 통장이랑 밀당 중이에요 ⚖️",
    "한강뷰도 텅장도 아닌, 아주 평화로운 하루 ☕",
    "지갑과 통장이 사이좋게 지내는 중이에요 🤝",
    "현상 유지도 실력이에요. 이대로만 가요 👌",
    "부자까지 남은 거리: 꾸준함 하나 🛣️",
    "오늘도 무난하게 클리어. 내일은 한 단계 위로 🎮"
  ],
  warning: [
    "지갑에서 '나 좀 쉬게 해줘' 소리가 들려요 😮‍💨",
    "청담동 가는 길에 잠깐 길을 잃었어요. 유턴하세요 🔄",
    "한강뷰가 점점 옆 건물 벽뷰로 바뀌는 중… 👀",
    "카드가 뜨거워요. 잠깐 냉장고에 넣어둘까요? 🧊",
    "이번 주는 집밥이 우리를 구해줄 거예요 🍚",
    "배달앱이 우리를 VIP로 모시기 시작했어요… 😅",
    "부자 되기 프로젝트, 잠시 '버퍼링' 중 ⏳"
  ],
  broke: [
    "거지 예약 완료. 라면 박스 미리 사둘까요? 🍜",
    "통장이 텅장이 됐어요. 메아리가 들려요 ~텅~ 📢",
    "한강뷰는커녕 고시원 창문뷰 각이에요 🪟",
    "카드사에서 감사 선물 보내줄 기세예요 🎁",
    "오늘부터 우리 집 가훈: 숨만 쉬고 살자 🫁",
    "지갑이 사직서를 냈어요. 사유: 과로 💼",
    "거지도 이렇게는 안 써요… 아, 거지는 돈이 없지 참 🤔",
    "이번 달 저축 계획이 '실종 신고' 접수됐어요 🚨"
  ]
};

/**
 * 진행 중인 달: 오늘까지 '써도 되는 만큼'(예산 × 경과율) 대비 실제 지출 비율
 * 끝난 달: 예산 대비 실제 지출 비율
 */
export function getSpendLevel(s: Summary, period: PeriodInfo): SpendLevel | null {
  if (period.state === "future" || s.totalVariableBudget <= 0) return null;
  if (s.totalVariableSpent > s.totalVariableBudget) return "broke";
  const allowed = period.state === "past" ? s.totalVariableBudget : s.totalVariableBudget * (period.elapsedPct / 100);
  const ratio = allowed > 0 ? s.totalVariableSpent / allowed : 0;
  if (ratio < 0.6) return "rich";
  if (ratio < 0.9) return "good";
  if (ratio <= 1.1) return "normal";
  if (ratio <= 1.3) return "warning";
  return "broke";
}

/** 같은 날엔 같은 문구 (seed로 고정), 탭하면 shuffle을 올려서 다른 문구 */
export function pickQuip(level: SpendLevel, seed: string, shuffle = 0): string {
  const list = QUIPS[level];
  let h = 0;
  for (const ch of `${seed}|${level}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(h + shuffle) % list.length];
}
