// 🌙 화면 모드: 자동(아이폰 설정 따라) · 밝게 · 어둡게. 기기마다 따로 기억해요
import { store } from "./storage";
import { getPrefs, setPref, subscribePrefs } from "./prefs";

export type ThemePref = "auto" | "light" | "dark";
const KEY = "themePref";
const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

// 계정에 저장된 값(prefs.theme)을 따르고, 기기의 themePref는 첫 화면용 사본 (index.html이 그려지기 전에 읽어요)
export const getThemePref = (): ThemePref => {
  const v = getPrefs().theme ?? store.get(KEY, "auto");
  return v === "light" || v === "dark" ? v : "auto";
};

/** 지금 어둡게 보여야 하는지 */
export const isDark = (pref: ThemePref = getThemePref()) => pref === "dark" || (pref === "auto" && !!media()?.matches);

/** <html class="dark">와 상태바 색을 맞춰요 */
export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = isDark(pref);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101014" : "#F2F4F6");
}

export function setThemePref(pref: ThemePref) {
  store.set(KEY, pref);
  setPref("theme", pref);
  applyTheme(pref);
}

/** 앱을 열 때 한 번: 지금 모드를 입히고, '자동'이면 아이폰 설정이 바뀔 때 따라가요 */
export function initTheme() {
  applyTheme();
  media()?.addEventListener?.("change", () => { if (getThemePref() === "auto") applyTheme("auto"); });
  // 다른 기기에서 화면 모드를 바꾸면 여기도 따라가요
  subscribePrefs(() => { const p = getThemePref(); store.set(KEY, p); applyTheme(p); });
}
