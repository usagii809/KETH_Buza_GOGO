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
    if (p.startsWith(q.path + "/") && !rest.includes("/") && (q.conds || []).every((c) => pass(d, c))) docs.push({ id: rest, data: () => clone(d), metadata: { hasPendingWrites: false, fromCache: false } });
  });
  return { docs, forEach: (f) => docs.forEach(f) };
};
const dsnap = (r) => { const d = store.get(r.path); return { exists: () => !!d, data: () => d && clone(d) }; };
const fire = (l) => setTimeout(() => l.cb(l.ref.col ? qsnap(l.ref) : dsnap(l.ref)), 5);
// onSnapshot(ref, cb) 와 onSnapshot(ref, 옵션, cb) 둘 다 받아요
export const onSnapshot = (ref, a, b) => { const cb = typeof a === "function" ? a : b; const l = { ref, cb }; listeners.add(l); fire(l); return () => listeners.delete(l); };
export const getDocs = async (q) => qsnap(q);
const apply = (path, data, merge) => {
  const cur = merge ? { ...(store.get(path) || {}) } : {};
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__del) delete cur[k];
    else if (v && v.__inc !== undefined) cur[k] = (cur[k] || 0) + v.__inc;
    else if (v && v.__union) cur[k] = (cur[k] || []).concat(v.__union);
    else cur[k] = v;
  }
  store.set(path, cur);
  listeners.forEach(fire);
};
export const setDoc = async (r, d, o) => apply(r.path, d, o && o.merge);
export const updateDoc = async (r, d) => apply(r.path, d, true);
export const addDoc = async (c, d) => apply(c.path + "/n" + (++auto), d, false);
export const deleteDoc = async (r) => { store.delete(r.path); listeners.forEach(fire); };
export const writeBatch = () => { const ops = []; return { set(r, d, o) { ops.push([r, d, o]); }, commit: async () => ops.forEach(([r, d, o]) => apply(r.path, d, o && o.merge)) }; };
// 앱이 새로 쓰기 시작한 함수들 (오프라인 캐시 · 정렬 · 한 문서 읽기)
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});
export const getDoc = async (r) => dsnap(r);
