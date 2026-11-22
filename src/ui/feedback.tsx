import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  okText?: string;
  /** 빨간 버튼 (지우기 등) */
  danger?: boolean;
}

interface FeedbackApi {
  toast: (message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const timer = useRef<number>();
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    setToastVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastVisible(false), 2400);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  const close = useCallback((ok: boolean) => {
    setPending((p) => { p?.resolve(ok); return null; });
  }, []);

  // 확인창이 떠 있으면 ESC는 확인창만 닫음 (뒤의 시트는 그대로)
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      close(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending, close]);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div role="alertdialog" className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-xl text-center">
            <h4 className="text-lg font-bold text-toss-text">{pending.title}</h4>
            {pending.message && <p className="text-sm text-toss-sub mt-2 leading-relaxed whitespace-pre-line">{pending.message}</p>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={() => close(false)} className="py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub">취소</button>
              <button type="button" onClick={() => close(true)}
                className={`py-3 rounded-xl text-sm font-bold text-white ${pending.danger === false ? "bg-toss-blue" : "bg-toss-red"}`}>
                {pending.okText || "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div aria-live="polite"
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-opacity duration-200 ${toastVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="px-4 py-2.5 rounded-2xl bg-gray-900/90 text-white text-sm font-semibold shadow-lg whitespace-nowrap">{toastMsg}</div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("FeedbackProvider가 필요해요");
  return ctx;
}
