// 🔄 내 설정은 계정(내 프로필 prefs)에 저장해서 폰 · 웹 · 다른 기기 어디서 열어도 똑같이 보여요
// - 바꾸면 바로 화면에 반영 + 계정에 저장
// - 계정에서 바뀐 값(다른 기기에서 바꾼 것)은 실시간으로 받아와요
// - 기기 안의 값은 '계정 값을 받기 전 첫 화면'을 위한 임시 사본일 뿐이에요
import { useSyncExternalStore } from "react";

export interface Prefs {
  /** 🌙 화면 모드 */
  theme?: "auto" | "light" | "dark";
  /** 가용 예산: 하루 · 이번 주 · 이번 달 */
  periodMode?: "day" | "week" | "month";
  /** 지출 흐름 그래프: 일별 · 주별 · 월별 / 몇 개월 */
  trendMode?: "day" | "week" | "month";
  trendMonths?: number;
  /** 지출 기록 창의 기본 카테고리 · 누가 썼나 (마지막으로 고른 것) */
  lastCategory?: string;
  lastSpender?: string;
  /** 🔔 안 받을 알림 종류 (내 모든 기기에 똑같이) */
  pushMute?: string[];
  /** 📬 이미 열어본 월말 성적표 (YYYY-MM) */
  reportSeen?: string[];
  /** 🤫 기념일 꽃가루를 본 날 (YYYY-MM-DD) */
  ourDaySeen?: string;
}

const CACHE = "prefsCache";
let pendingMigration: Prefs | null = null;
// 사본은 누구 것인지(uid)도 같이 적어둬요 (한 기기에서 다른 계정으로 바꿔 들어와도 섞이지 않게)
let cacheUid: string | null = null;
let current: Prefs = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE) || "{}");
    if (raw && typeof raw === "object" && "prefs" in raw) { cacheUid = raw.uid || null; return raw.prefs as Prefs; }
    return raw as Prefs;
  } catch { return {}; }
})();
// 예전 버전에서 기기에만 저장하던 값은 처음 한 번 옮겨와요
(() => {
  try {
    const old = (k: string) => localStorage.getItem(k);
    const moved: Prefs = {};
    if (!current.theme && old("themePref")) moved.theme = old("themePref") as Prefs["theme"];
    if (!current.periodMode && old("periodMode")) moved.periodMode = old("periodMode") as Prefs["periodMode"];
    if (!current.trendMode && old("trendMode")) moved.trendMode = old("trendMode") as Prefs["trendMode"];
    if (!current.trendMonths && old("trendMonths")) moved.trendMonths = Number(old("trendMonths"));
    if (!current.lastCategory && old("lastCategory")) moved.lastCategory = old("lastCategory")!;
    if (!current.lastSpender && old("lastSpender")) moved.lastSpender = old("lastSpender")!;
    if (!current.pushMute && old("pushMute")) moved.pushMute = JSON.parse(old("pushMute")!);
    const seen = Object.keys(localStorage).filter((k) => /^reportSeen_\d{4}-\d{2}$/.test(k)).map((k) => k.slice(11));
    if (!current.reportSeen && seen.length) moved.reportSeen = seen;
    if (Object.keys(moved).length) { current = { ...moved, ...current }; pendingMigration = moved; }
  } catch { /* 무시 */ }
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const saveCache = () => { try { localStorage.setItem(CACHE, JSON.stringify({ uid: cacheUid, prefs: current })); } catch { /* 무시 */ } };

let saver: ((patch: Prefs) => Promise<unknown>) | null = null;
let remoteLoaded = false;

/**
 * App이 내 프로필을 받을 때마다 불러요
 * - save: 계정에 저장하는 함수 (saveProfile)
 * - remote: 계정에 저장된 prefs (없으면 undefined)
 */
export function syncPrefs(uid: string, save: (patch: Prefs) => Promise<unknown>, remote: Prefs | undefined) {
  saver = save;
  const first = !remoteLoaded;
  remoteLoaded = true;
  // 이 기기 사본이 다른 계정 것이면 버리고 계정 값만 써요
  if (first && cacheUid && cacheUid !== uid) { current = {}; pendingMigration = null; }
  cacheUid = uid;
  // 계정에 아직 없는 값인데 이 기기에 있던 값(예전 버전에서 쓰던 것)은 계정으로 올려요
  if (first) {
    const up: Prefs = {};
    const local = { ...current, ...(pendingMigration || {}) };
    (Object.keys(local) as (keyof Prefs)[]).forEach((k) => {
      if (remote?.[k] === undefined && local[k] !== undefined) (up as Record<string, unknown>)[k] = local[k];
    });
    pendingMigration = null;
    if (Object.keys(up).length) save(up).catch((err) => console.warn("설정 옮기기 참고:", err));
  }
  const next = { ...current, ...(remote || {}) };
  if (JSON.stringify(next) === JSON.stringify(current)) { if (first) saveCache(); return; }
  current = next;
  saveCache();
  emit();
}

export const getPrefs = () => current;

/** 설정 바꾸기: 화면에 바로 + 계정에 저장 */
export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  if (JSON.stringify(current[key]) === JSON.stringify(value)) return;
  current = { ...current, [key]: value };
  saveCache();
  emit();
  saver?.({ [key]: value } as Prefs).catch((err) => console.warn("설정 저장 참고:", err));
}

export const subscribePrefs = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

/** 화면에서 쓰는 설정 값 (다른 기기에서 바꿔도 바로 따라와요) */
export function usePref<K extends keyof Prefs>(key: K): Prefs[K] {
  return useSyncExternalStore(subscribePrefs, () => current[key], () => current[key]);
}
