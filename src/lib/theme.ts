// 🌙 화면 모드: 자동(아이폰 설정 따라) · 밝게 · 어둡게. 기기마다 따로 기억해요
import { store } from "./storage";

export type ThemePref = "auto" | "light" | "dark";
const KEY = "themePref";
const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export const getThemePref = (): ThemePref => {
  const v = store.get(KEY, "auto");
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
  applyTheme(pref);
}

/** 앱을 열 때 한 번: 지금 모드를 입히고, '자동'이면 아이폰 설정이 바뀔 때 따라가요 */
export function initTheme() {
  applyTheme();
  media()?.addEventListener?.("change", () => { if (getThemePref() === "auto") applyTheme("auto"); });
}
