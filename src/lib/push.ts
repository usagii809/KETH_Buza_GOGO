// 🔔 알림(웹 푸시): 이 기기를 알림 받을 기기로 등록하고, 상대에게 알림을 보내요
import { deleteDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { refs } from "../data/db";
import { auth } from "./firebase";
import { PUSH_WORKER_URL, VAPID_PUBLIC_KEY } from "./pushConfig";
import { getPrefs } from "./prefs";

/** 알림 종류 (설정에서 종류별로 끌 수 있어요) */
export const PUSH_KINDS = [
  ["record", "기록"],
  ["reaction", "반응"],
  ["lottery", "복권"],
  ["coupon", "쿠폰"],
  ["goal", "저축"]
] as const;
export type PushKind = (typeof PUSH_KINDS)[number][0];

export interface PushMessage {
  kind: PushKind;
  title: string;
  body?: string;
  /** 같은 tag 알림은 하나로 합쳐져요 */
  tag?: string;
}

const SUB_ID_KEY = "pushSubId";
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 괜찮아요 */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* 무시 */ } }
};

/**
 * 이 기기에서 알림을 받을 수 있는지
 * - ok: 가능
 * - install: 아이폰 Safari → 홈 화면에 추가한 앱에서만 돼요
 * - unsupported: 이 브라우저는 안 돼요
 */
export type PushSupport = "ok" | "install" | "unsupported";
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

export const pushReady = () => !!PUSH_WORKER_URL;

/** 이 기기가 지금 알림을 받고 있는지 */
export async function isPushOn(): Promise<boolean> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted" || !store.get(SUB_ID_KEY)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

function keyBytes(b64u: string) {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function subId(endpoint: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac/.test(ua)) return "Mac";
  return "기기";
}

/**
 * 알림 켜기 (버튼을 누른 순간에 불러야 해요 · 아이폰은 그래야 허락 창이 떠요)
 * 반환: on = 켜짐 / denied = 허락 안 함 / error = 실패
 */
export async function enablePush(uid: string, mute: PushKind[] = (getPrefs().pushMute || []) as PushKind[]): Promise<"on" | "denied" | "error"> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    // 서비스 워커가 아직 안 깔렸으면 기다리되, 10초 넘으면 포기 (버튼이 계속 '처리 중'에 머물지 않게)
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("서비스 워커 준비 시간 초과")), 10000))
    ]);
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const j = sub.toJSON();
    const id = await subId(sub.endpoint);
    await setDoc(refs.pushSub(id), { uid, endpoint: sub.endpoint, p256dh: j.keys?.p256dh || "", auth: j.keys?.auth || "", device: deviceName(), mute, createdAt: Date.now() });
    store.set(SUB_ID_KEY, id);
    return "on";
  } catch (err) {
    console.error("알림 켜기 오류:", err);
    return "error";
  }
}

/** 알림 끄기 (이 기기만) */
export async function disablePush() {
  const id = store.get(SUB_ID_KEY);
  store.del(SUB_ID_KEY);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch (err) { console.warn("알림 끄기 참고:", err); }
  if (id) await deleteDoc(refs.pushSub(id)).catch((err) => console.warn("알림 기기 지우기 참고:", err));
}

/** 안 받을 알림 종류를 내 모든 기기(폰 · 웹)에 똑같이 적용 */
export async function setPushMute(uid: string, mute: PushKind[]) {
  const snap = await getDocs(query(refs.pushSubs(), where("uid", "==", uid)));
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { mute })));
}

// ── 보내기 ──
let senderName = "";
/** 알림 문구에 들어갈 내 이름 (App에서 프로필을 받으면 넣어요) */
export const setPushSender = (name?: string) => { senderName = name || ""; };
export const pushSender = () => senderName || "상대";

/**
 * 상대 기기들에 알림 보내기 (실패해도 앱 사용엔 영향 없게 조용히)
 * 내 다른 기기에는 안 가요 · 상대가 그 종류를 꺼뒀으면 안 가요
 */
export async function notifyPartner(msg: PushMessage) {
  if (!PUSH_WORKER_URL || !navigator.onLine) return;
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${PUSH_WORKER_URL.replace(/\/$/, "")}/notify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(msg)
    });
  } catch (err) {
    console.warn("알림 보내기 참고:", err);
  }
}
