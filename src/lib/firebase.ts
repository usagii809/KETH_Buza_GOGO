import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

// apiKey가 코드에 보이는 것 자체는 정상이에요. 데이터 보호는 Firestore 규칙이 담당해요.
const firebaseConfig = {
  apiKey: "AIzaSyAL_8BaNFTt41TYh2Y7xJyRTKMBjteP3Vo",
  authDomain: "keth-buza-gogo.firebaseapp.com",
  projectId: "keth-buza-gogo",
  storageBucket: "keth-buza-gogo.firebasestorage.app",
  messagingSenderId: "999218881600",
  appId: "1:999218881600:web:e28445e9166dced39eeba5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// 오프라인에서 남긴 기록도 폰 안(IndexedDB)에 저장해 뒀다가 연결되면 올려요.
// 앱을 닫았다 다시 열어도 아직 못 올린 기록이 사라지지 않아요.
// (사파리 사생활 보호 모드처럼 IndexedDB를 못 쓰는 곳에서는 기본 메모리 캐시로)
function createDb(): Firestore {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (err) {
    console.warn("오프라인 저장소 설정 참고:", err);
    return getFirestore(app);
  }
}
export const db = createDb();

// 아이폰 홈 화면 앱을 다시 열어도 로그인 유지
setPersistence(auth, browserLocalPersistence).catch((err) => console.warn("인증 지속성 설정 참고:", err));
