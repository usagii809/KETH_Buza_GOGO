import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { auth } from "../../lib/firebase";
import { useFeedback } from "../../ui/feedback";

export function LoginView() {
  const { toast } = useFeedback();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast("어서 오세요! 오늘도 부자 되러 가볼까요? 💰");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === "auth/too-many-requests" ? "시도가 너무 많았어요. 잠깐 쉬었다가 다시 해주세요." : "이메일이나 비밀번호가 맞지 않아요.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-toss-bg text-toss-text text-base font-medium rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-toss-blue transition";
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl p-7 shadow-sm border border-toss-border/60">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-toss-text">태형이와 경은이의 부자되기 프로젝트!</h1>
          <p className="text-sm text-toss-sub mt-1.5 leading-relaxed">로그인하면 둘이 쓴 돈이 실시간으로 같이 보여요.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="loginEmail" className="block text-xs font-semibold text-toss-sub mb-1.5">이메일 아이디</label>
            <input id="loginEmail" type="email" required autoComplete="username" placeholder="example@gmail.com"
              value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="loginPassword" className="block text-xs font-semibold text-toss-sub mb-1.5">비밀번호</label>
            <input id="loginPassword" type="password" required autoComplete="current-password" placeholder="비밀번호 입력"
              value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </div>
          {error && <div className="p-3.5 rounded-2xl bg-red-50 text-toss-red text-sm font-medium leading-relaxed">{error}</div>}
          <button type="submit" disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-toss-blue hover:bg-toss-blueDark text-white text-base font-bold shadow-sm active:scale-[0.99] transition disabled:opacity-60">
            {busy ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
