export const getAuth = () => ({});
export const setPersistence = async () => {};
export const browserLocalPersistence = {};
export const signInWithEmailAndPassword = async () => {};
export const signOut = async () => {};
export const onAuthStateChanged = (a, cb) => { const t = setTimeout(() => cb({ email: "t@x.com", uid: "u1" }), 10); return () => clearTimeout(t); };
