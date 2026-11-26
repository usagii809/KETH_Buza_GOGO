// 테스트용 메모리 Firestore (실제 Firebase에 연결하지 않음)
const store = new Map(); const listeners = new Set();
const NOW = Date.now(), D = 86400000;
const B = "ledgers/shared_household/";
const seed = (p, d) => store.set(B + p, d);
seed("config/defaultBudget", {income:4500000,fixedLoan:1500000,fixedMaintenance:300000,fixedEvents:220000,foodIngredients:650000,foodDining:150000,foodCafe:0,livingTelecom:150000,livingTransport:100000,livingOther:100000,essentialConsumables:0,essentialReserve:0});
const T = (id, date, category, amount, memo, spender="공동") => seed("transactions/"+id, {date, yearMonth: date.slice(0,7), category, amount, memo, spender, createdAt: new Date(date).getTime()});
T("a","2026-11-22","foodDining",200000,"회식","남편");
T("b","2026-11-21","foodIngredients",300000,"이마트","경은");
T("c","2026-11-03","foodCafe",4500,"스타벅스","태형");
T("o1","2026-10-05","foodDining",100000,"배민");
T("o2","2026-10-12","foodIngredients",250000,"이마트");
T("o3","2026-10-19","foodIngredients",180000,"이마트 트레이더스");
T("o4","2026-10-20","livingTransport",60000,"티머니","태형");
T("o5","2026-10-25","foodCafe",12000,"이디야","경은");
T("s1","2026-09-10","foodDining",300000,"오마카세");
seed("recurring/r1", {memo:"휴대폰 요금", amount:55000, day:15, category:"livingTelecom", spender:"공동", postedMonths:[]});
seed("goals/g1", {name:"신혼여행", emoji:"🏝️", target:5000000, saved:1200000, history:[{at:NOW-60*D,amount:600000},{at:NOW-30*D,amount:600000}], createdAt:1});
// 📊 읽기 양 시험용: ?bulk=150 이면 지난 18개월 동안 한 달 150건씩 넣어요
(() => {
  const n = Number(new URLSearchParams(location.search).get("bulk") || 0);
  if (!n) return;
  const cats = ["foodIngredients","foodDining","foodCafe","livingTransport","livingOther"];
  const who = ["태형","경은","공동"];
  const now = new Date(NOW);
  for (let m = 0; m < 18; m++) {
    const d0 = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const days = m === 0 ? now.getDate() : new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
    const per = m === 0 ? Math.round(n * now.getDate() / 30) : n;
    for (let i = 0; i < per; i++) {
      const day = 1 + (i * 7) % days;
      const ds = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      seed(`transactions/bulk_${m}_${i}`, { date: ds, yearMonth: ds.slice(0, 7), category: cats[i % 5], amount: 1000 * (1 + (i * 13) % 40), memo: "가게" + (i % 12), spender: who[i % 3], createdBy: i % 2 ? "u1" : "u2", createdAt: new Date(ds).getTime() + i });
    }
  }
})();
window.__store = store;
// 테스트에서 __store를 직접 바꾼 뒤 화면에 알릴 때
window.__fire = () => listeners.forEach(fire);

export const getFirestore = () => ({});
export const collection = (db, path) => ({ path, col: true });
let auto = 0;
export const doc = (a, path) => (a && a.col ? { path: a.path + "/auto" + (++auto) } : { path });
export const where = (f, o, v) => ({ f, o, v });
export const query = (c, ...conds) => ({ path: c.path, col: true, conds });
export const increment = (n) => ({ __inc: n });
export const arrayUnion = (...v) => ({ __union: v });
export const deleteField = () => ({ __del: true });
const pass = (d, c) => c.o === "==" ? d[c.f] === c.v : c.o === ">=" ? d[c.f] >= c.v : c.o === "<=" ? d[c.f] <= c.v : true;
const clone = (d) => JSON.parse(JSON.stringify(d));
const qsnap = (q) => {
  const docs = [];
  store.forEach((d, p) => {
    const rest = p.slice(q.path.length + 1);
    if (p.startsWith(q.path + "/") && !rest.includes("/") && (q.conds || []).every((c) => !c.o || pass(d, c))) docs.push({ id: rest, data: () => clone(d), metadata: { hasPendingWrites: false, fromCache: false } });
  });
  const ob = (q.conds || []).find((c) => c.orderBy), lim = (q.conds || []).find((c) => c.limit);
  if (ob) docs.sort((a, b) => String(a.data()[ob.orderBy]).localeCompare(String(b.data()[ob.orderBy])));
  if (lim) docs.splice(lim.limit);
  return { docs, forEach: (f) => docs.forEach(f), metadata: { fromCache: !!window.__offline, hasPendingWrites: false } };
};
const dsnap = (r) => { const d = store.get(r.path); return { exists: () => !!d, data: () => d && clone(d), metadata: { fromCache: !!window.__offline, hasPendingWrites: false } }; };
// 📊 읽은 문서 수 세기 (진짜 Firestore처럼: 처음 받을 때 전부, 그 뒤엔 바뀐 문서만 — 여기선 처음 받을 때만 세요)
window.__reads = { total: 0, by: {} };
const countRead = (label, n) => { window.__reads.total += n; window.__reads.by[label] = (window.__reads.by[label] || 0) + n; };
const labelOf = (ref) => (ref.path || "").replace(/^ledgers\/shared_household\//, "").split("/")[0] + (ref.conds && ref.conds.length ? "?" + ref.conds.map((c) => c.f || c.orderBy || "limit").join(",") : "");
const fire = (l) => setTimeout(() => {
  const snap = l.ref.col ? qsnap(l.ref) : dsnap(l.ref);
  if (!l.counted) { l.counted = true; countRead("listen:" + labelOf(l.ref), l.ref.col ? snap.docs.length : 1); }
  l.cb(snap);
}, 5);
// onSnapshot(ref, cb) 와 onSnapshot(ref, 옵션, cb) 둘 다 받아요
export const onSnapshot = (ref, a, b) => { const cb = typeof a === "function" ? a : b; const l = { ref, cb }; listeners.add(l); fire(l); return () => listeners.delete(l); };
export const getDocs = async (q) => { const s = qsnap(q); countRead("get:" + labelOf(q), s.docs.length || 1); return s; };
const apply = (path, data, merge) => {
  const cur = merge ? { ...(store.get(path) || {}) } : {};
  for (let [k, v] of Object.entries(data)) {
    // updateDoc의 "reactions.u1" 같은 점 경로
    if (k.includes(".")) {
      const parts = k.split(".");
      let o = cur;
      for (const part of parts.slice(0, -1)) { o[part] = { ...(o[part] || {}) }; o = o[part]; }
      if (v && v.__del) delete o[parts.at(-1)]; else o[parts.at(-1)] = v;
      continue;
    }
    if (v && v.__del) delete cur[k];
    else if (v && v.__inc !== undefined) cur[k] = (cur[k] || 0) + v.__inc;
    else if (v && v.__union) cur[k] = (cur[k] || []).concat(v.__union);
    // setDoc(..., {merge:true})는 진짜 Firestore처럼 안쪽 객체도 합쳐요
    else if (merge && v && typeof v === "object" && !Array.isArray(v) && cur[k] && typeof cur[k] === "object" && !Array.isArray(cur[k])) cur[k] = { ...cur[k], ...v };
    else cur[k] = v;
  }
  store.set(path, cur);
  listeners.forEach(fire);
};
export const setDoc = async (r, d, o) => apply(r.path, d, o && o.merge);
export const updateDoc = async (r, d) => apply(r.path, d, true);
export const addDoc = async (c, d) => apply(c.path + "/n" + (++auto), d, false);
export const deleteDoc = async (r) => { store.delete(r.path); listeners.forEach(fire); };
export const writeBatch = () => {
  const ops = [];
  return {
    set(r, d, o) { ops.push(() => apply(r.path, d, o && o.merge)); },
    update(r, d) { ops.push(() => updateDoc(r, d)); },
    delete(r) { ops.push(() => deleteDoc(r)); },
    commit: async () => { for (const op of ops) await op(); }
  };
};
// 앱이 새로 쓰기 시작한 함수들 (오프라인 캐시 · 정렬 · 한 문서 읽기)
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const orderBy = (f) => ({ orderBy: f });
export const limit = (n) => ({ limit: n });
export const getDoc = async (r) => { countRead("get:" + labelOf(r), 1); return dsnap(r); };
