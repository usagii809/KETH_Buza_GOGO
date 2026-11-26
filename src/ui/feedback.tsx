import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  okText?: string;
  /** 빨간 버튼 (지우기 등) */
  danger?: boolean;
}

export interface Choice {
  key: string;
  label: string;
  /** primary = 파란 버튼, danger = 빨간 버튼, 없으면 회색 */
  tone?: "primary" | "danger";
}

interface ChooseOptions {
  title: string;
  message?: string;
  /** 위에서부터 차례로 보여요. 맨 아래 '취소'는 자동으로 붙어요 */
  choices: Choice[];
}

/** 알림 옆 버튼 (예: 되돌리기) */
export interface ToastAction { label: string; onClick: () => void }

interface FeedbackApi {
  /** action이 있으면 버튼이 붙고 조금 더 오래(5초) 보여요 */
  toast: (message: string, action?: ToastAction) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** 여러 개 중 하나 고르기. 취소하면 null */
  choose: (opts: ChooseOptions) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState("");
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const timer = useRef<number>();
  const [pending, setPending] = useState<(ConfirmOptions & { choices?: Choice[]; resolve: (v: boolean | string | null) => void }) | null>(null);

  const toast = useCallback((message: string, action?: ToastAction) => {
    setToastMsg(message);
    setToastAction(action ?? null);
    setToastVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setToastVisible(false); setToastAction(null); }, action ? 5000 : 2400);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve: (v) => resolve(v === true) })), []);
  const choose = useCallback((opts: ChooseOptions) =>
    new Promise<string | null>((resolve) => setPending({ ...opts, resolve: (v) => resolve(typeof v === "string" ? v : null) })), []);

  /** 확인창 닫기: true/false (확인창) 또는 고른 key (선택창) */
  const close = useCallback((v: boolean | string) => {
    setPending((p) => { p?.resolve(v); return null; });
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
    <FeedbackContext.Provider value={{ toast, confirm, choose }}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div role="alertdialog" className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-xl text-center">
            <h4 className="text-lg font-bold text-toss-text">{pending.title}</h4>
            {pending.message && <p className="text-sm text-toss-sub mt-2 leading-relaxed whitespace-pre-line">{pending.message}</p>}
            {pending.choices ? (
              <div className="flex flex-col gap-2 mt-5">
                {pending.choices.map((c) => (
                  <button key={c.key} type="button" onClick={() => close(c.key)}
                    className={`py-3 rounded-xl text-sm font-bold ${c.tone === "primary" ? "bg-toss-blue text-white" : c.tone === "danger" ? "bg-toss-red text-white" : "bg-toss-bg text-toss-text"}`}>
                    {c.label}
                  </button>
                ))}
                <button type="button" onClick={() => close(false)} className="py-2.5 text-sm font-bold text-toss-sub">취소</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button type="button" onClick={() => close(false)} className="py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub">취소</button>
                <button type="button" onClick={() => close(true)}
                  className={`py-3 rounded-xl text-sm font-bold text-white ${pending.danger === false ? "bg-toss-blue" : "bg-toss-red"}`}>
                  {pending.okText || "확인"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div aria-live="polite"
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-opacity duration-200 ${toastVisible ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-900/90 text-white text-sm font-semibold shadow-lg whitespace-nowrap">
          {toastMsg}
          {toastAction && (
            <button type="button" onClick={() => { const a = toastAction; setToastVisible(false); setToastAction(null); a.onClick(); }}
              className="toast-action pointer-events-auto -my-1 px-2.5 py-1 rounded-lg bg-white/15 text-amber-300 font-bold active:scale-95 transition">
              {toastAction.label}
            </button>
          )}
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("FeedbackProvider가 필요해요");
  return ctx;
}
