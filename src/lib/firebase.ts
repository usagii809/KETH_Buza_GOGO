import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);

// 아이폰 홈 화면 앱을 다시 열어도 로그인 유지
setPersistence(auth, browserLocalPersistence).catch((err) => console.warn("인증 지속성 설정 참고:", err));
