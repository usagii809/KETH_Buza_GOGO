/**
 * 부자 가계부 알림 서버 (Cloudflare Workers, 무료)
 *
 * 앱이 "상대에게 알림 보내줘"라고 부르면, 상대 폰들에 웹 푸시를 보내요.
 * - 누가 부르는지는 Firebase 로그인 토큰으로 확인해요.
 *   토큰으로 Firestore에서 알림 받을 기기 목록을 읽어서, Firestore 보안 규칙을 통과한 사람만 보낼 수 있어요.
 * - 보낸 사람 본인 기기와, 그 종류 알림을 꺼둔 기기는 빼요.
 * - 더 이상 없는 기기(앱 삭제 · 알림 끔)는 목록에서 지워요.
 *
 * Cloudflare 대시보드 → 이 Worker → Settings → Variables and Secrets 에 넣을 값
 *   FIREBASE_PROJECT_ID  (Text)   keth-buza-gogo
 *   VAPID_PUBLIC         (Text)   앱의 src/lib/pushConfig.ts 에 있는 공개키와 같은 값
 *   VAPID_PRIVATE        (Secret) 비밀키 (절대 앱 코드나 GitHub에 올리지 마세요)
 *   VAPID_SUBJECT        (Text)   mailto:내이메일@example.com
 *   ALLOWED_ORIGINS      (Text)   https://usagii809.github.io
 *
 * 외부 라이브러리 없이 이 파일 하나로 동작해요 (대시보드에 그대로 붙여넣기).
 */

const LEDGER = "ledgers/shared_household";
const KINDS = ["record", "reaction", "lottery", "coupon", "goal"];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return json({ ok: true, service: "buja-push" }, 200, cors);
    if (request.method !== "POST" || url.pathname !== "/notify") return json({ error: "not found" }, 404, cors);
    if (!cors["Access-Control-Allow-Origin"]) return json({ error: "origin not allowed" }, 403, cors);

    const missing = ["FIREBASE_PROJECT_ID", "VAPID_PUBLIC", "VAPID_PRIVATE", "VAPID_SUBJECT"].filter((k) => !env[k]);
    if (missing.length) return json({ error: `Worker 설정이 빠졌어요: ${missing.join(", ")}` }, 500, cors);

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "login required" }, 401, cors);

    let msg;
    try { msg = await request.json(); } catch { return json({ error: "bad json" }, 400, cors); }
    const kind = KINDS.includes(msg.kind) ? msg.kind : "record";
    const title = String(msg.title || "").slice(0, 120);
    const body = String(msg.body || "").slice(0, 240);
    if (!title) return json({ error: "title required" }, 400, cors);

    // 1) 내 토큰으로 기기 목록 읽기 → Firestore가 토큰과 보안 규칙을 확인해줘요
    const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
    const list = await fetch(`${base}/${LEDGER}/pushSubs?pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (list.status === 401 || list.status === 403) return json({ error: "not allowed" }, 403, cors);
    if (!list.ok) return json({ error: `firestore ${list.status}` }, 502, cors);
    const docs = ((await list.json()).documents || []).map(readSub).filter(Boolean);

    // 2) Firestore가 받아준 토큰이라 안의 uid를 믿을 수 있어요 → 보낸 사람 기기는 빼요
    const sender = jwtPayload(token).user_id || jwtPayload(token).sub;
    const targets = docs.filter((d) => d.uid !== sender && !d.mute.includes(kind));

    const payload = JSON.stringify({ title, body, tag: String(msg.tag || kind).slice(0, 60), url: "./?feed=1", kind });
    const vapid = { publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE, subject: env.VAPID_SUBJECT };
    let sent = 0, removed = 0;
    const errors = [];
    await Promise.all(targets.map(async (d) => {
      try {
        const res = await sendPush(d, payload, vapid);
        if (res.status === 404 || res.status === 410) {
          // 없어진 기기 → 목록에서 지우기
          await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          removed++;
        } else if (res.ok) sent++;
        else errors.push(`${res.status} ${(await res.text()).slice(0, 120)}`);
      } catch (err) {
        errors.push(String(err && err.message || err));
      }
    }));
    return json({ sent, removed, skipped: docs.length - targets.length, errors }, 200, cors);
  }
};

// ── 도우미 ──

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "https://usagii809.github.io").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  } : { Vary: "Origin" };
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

/** Firestore REST 문서 → { name, uid, endpoint, p256dh, auth, mute } */
function readSub(doc) {
  const f = doc.fields || {};
  const s = (k) => (f[k] && f[k].stringValue) || "";
  const mute = ((f.mute && f.mute.arrayValue && f.mute.arrayValue.values) || []).map((v) => v.stringValue);
  const d = { name: doc.name, uid: s("uid"), endpoint: s("endpoint"), p256dh: s("p256dh"), auth: s("auth"), mute };
  return d.endpoint && d.p256dh && d.auth ? d : null;
}

function jwtPayload(token) {
  try { return JSON.parse(new TextDecoder().decode(b64uDecode(token.split(".")[1]))); } catch { return {}; }
}

function b64uDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64uEncode(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const utf8 = (s) => new TextEncoder().encode(s);

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** 웹 푸시 한 건 보내기 (RFC 8291 aes128gcm 암호화 + RFC 8292 VAPID 서명) */
async function sendPush(sub, payload, vapid) {
  const uaPublic = b64uDecode(sub.p256dh);
  const authSecret = b64uDecode(sub.auth);

  // 이번 한 번만 쓰는 키로 상대 기기와 비밀값을 나눠 가져요
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(utf8("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(utf8("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(utf8("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = concat(utf8(payload), new Uint8Array([2])); // 2 = 마지막 조각
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));

  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  const body = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);

  const jwt = await vapidJwt(new URL(sub.endpoint).origin, vapid);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high"
    },
    body
  });
}

async function vapidJwt(audience, vapid) {
  const pub = b64uDecode(vapid.publicKey); // 0x04 || x(32) || y(32)
  const jwk = { kty: "EC", crv: "P-256", x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), d: vapid.privateKey, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64uEncode(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64uEncode(utf8(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(`${head}.${claims}`));
  return `${head}.${claims}.${b64uEncode(sig)}`;
}
