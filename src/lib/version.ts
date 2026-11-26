// 지금 보고 있는 앱 버전 · 서버에 올라간 최신 버전 확인
declare const __APP_VERSION__: string;
declare const __APP_SHA__: string;
declare const __APP_BUILT_AT__: number;

/** 예) v2.1.57 (큰 변화 · 기능 추가 · 배포 번호) */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
/** 커밋 앞 7자리 (GitHub 커밋 목록과 맞춰볼 때) */
export const APP_SHA: string = typeof __APP_SHA__ === "string" ? __APP_SHA__ : "";
export const APP_BUILT_AT: number = typeof __APP_BUILT_AT__ === "number" ? __APP_BUILT_AT__ : 0;

export interface ServerVersion { version: string; builtAt: number }

/** 서버에 올라간 최신 버전 (캐시 없이). 못 가져오면 null */
export async function fetchServerVersion(): Promise<ServerVersion | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const v = await res.json();
    return typeof v?.version === "string" ? { version: v.version, builtAt: Number(v.builtAt) || 0 } : null;
  } catch {
    return null;
  }
}

/** 서버 버전이 지금 것보다 새로운지 */
export const isNewer = (server: ServerVersion | null) => !!server && server.version !== APP_VERSION && server.builtAt > APP_BUILT_AT;

/** 새 버전으로 바꾸기: 서비스 워커를 새로 받고 새로고침 */
export async function updateToLatest() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      // 새 서비스 워커가 설치·활성화될 때까지 잠깐 기다려요 (최대 8초)
      const sw = reg.installing || reg.waiting;
      if (sw && sw.state !== "activated") {
        await new Promise<void>((done) => {
          const timer = setTimeout(done, 8000);
          sw.addEventListener("statechange", () => { if (sw.state === "activated" || sw.state === "redundant") { clearTimeout(timer); done(); } });
          if (reg.waiting === sw) sw.postMessage({ type: "SKIP_WAITING" });
        });
      }
    }
  } catch {
    // 서비스 워커가 없어도 새로고침은 해요
  }
  location.reload();
}

/** 배포 시각을 "11/26 22:16"처럼 (한국 시간) */
export function builtAtLabel(at: number): string {
  if (!at) return "";
  const k = new Date(at + 9 * 3600000).toISOString();
  return `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))} ${k.slice(11, 16)}`;
}
