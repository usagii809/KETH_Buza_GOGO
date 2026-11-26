// 📴 오프라인 모드: 인터넷이 끊기면 보기만 할 수 있어요 (저장은 막아요)
// - 폰의 연결 상태(navigator.onLine) + Firebase가 서버에서 답을 받았는지(fromCache)를 같이 봐요
//   (아이폰은 신호가 약하면 '연결됨'인데 실제론 안 될 때가 있어서)
import { useSyncExternalStore } from "react";

let deviceOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
let serverStale = false; // 서버 답 없이 폰 사본만 보고 있는지
let staleTimer: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isOffline = () => !deviceOnline || serverStale;

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { deviceOnline = true; emit(); });
  window.addEventListener("offline", () => { deviceOnline = false; emit(); });
}

/**
 * Firebase 실시간 구독이 지금 폰 사본(fromCache)만 주고 있는지 알려줘요
 * 4초 넘게 서버 답이 없으면 오프라인으로 봐요 (잠깐 늦는 건 봐줘요)
 */
export function reportFromCache(fromCache: boolean) {
  window.clearTimeout(staleTimer);
  if (!fromCache) {
    if (serverStale) { serverStale = false; emit(); }
    return;
  }
  staleTimer = window.setTimeout(() => { if (!serverStale) { serverStale = true; emit(); } }, 4000);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
/** 화면에서: 지금 오프라인인지 (바뀌면 다시 그려져요) */
export const useOffline = () => useSyncExternalStore(subscribe, isOffline, () => false);

export const OFFLINE_MSG = "📴 오프라인이라 저장할 수 없어요";
let toaster: ((msg: string) => void) | null = null;
/** App이 알림(toast) 함수를 넣어둬요 */
export const setOfflineToaster = (fn: (msg: string) => void) => { toaster = fn; };

/** 저장하기 전에: 오프라인이면 알려주고 true (→ 그 자리에서 멈춰요) */
export function offlineBlocked(): boolean {
  if (!isOffline()) return false;
  toaster?.(OFFLINE_MSG);
  return true;
}
