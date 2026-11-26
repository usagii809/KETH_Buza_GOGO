import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 하단 고정 영역 (저장 버튼 등) */
  footer?: ReactNode;
}

// ── 뒤 화면 스크롤 잠금 ──
// 아이폰 사파리는 body의 overflow: hidden을 무시하고 뒤 화면을 같이 끌어요.
// 그래서 body를 지금 스크롤 위치에 '고정'해 두고, 닫을 때 그 위치로 되돌려요.
// (시트가 바로 다른 시트로 바뀌어도 꼬이지 않게 몇 개가 열려 있는지 세요)
let locks = 0;
let savedY = 0;
function lockScroll() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${savedY}px`;
  b.left = "0";
  b.right = "0";
  b.width = "100%";
  b.overflow = "hidden";
}
function unlockScroll() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = b.overflow = "";
  window.scrollTo(0, savedY);
}

/** 시트가 닫히는 중인지 (App이 닫힌 시트를 0.22초 더 그려두면서 알려줘요 → 아래로 스르륵) */
export const SheetExitContext = createContext(false);
/** 닫히는 애니메이션 길이 (App과 맞춰요) */
export const SHEET_EXIT_MS = 220;

/** 창 안에서 다른 창을 열었을 때: ‹ 뒤로 = 한 단계, ✕ = 전부 닫기 */
export const SheetNavContext = createContext<{ canGoBack: boolean; closeAll: () => void } | null>(null);

/** 아래에서 올라오는 시트. 바깥 탭 · ESC · 손잡이를 아래로 끌어서 닫기 (모두 한 단계 뒤로) */
export function Sheet({ title, subtitle, onClose, children, footer }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const nav = useContext(SheetNavContext);
  const canGoBack = !!nav?.canGoBack;
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  const exiting = useContext(SheetExitContext);

  // 뒤 화면 잠금은 열릴 때 한 번만 (onClose가 바뀔 때마다 풀었다 잠그면 화면이 튀어요)
  useEffect(() => {
    lockScroll();
    return unlockScroll;
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { startY: e.touches[0].clientY, dy: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !sheetRef.current) return;
    drag.current.dy = Math.max(0, e.touches[0].clientY - drag.current.startY);
    sheetRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onTouchEnd = () => {
    const el = sheetRef.current;
    if (!el || !drag.current) return;
    el.style.transition = "";
    if (drag.current.dy > 90) {
      // 끌어내린 자리에서 이어서 내려가요
      el.style.setProperty("--drag-y", `${drag.current.dy}px`);
      onClose();
    } else el.style.transform = "";
    drag.current = null;
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-none ${exiting ? "animate-backdrop-out pointer-events-none" : "animate-backdrop-in"}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-hidden={exiting || undefined}
        className={`sheet ${exiting ? "animate-sheet-down" : "animate-sheet-up"} w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl`}>
        <div className="shrink-0 bg-white border-b border-toss-border" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="flex justify-center pt-2.5 sm:hidden"><span className="w-10 h-1.5 rounded-full bg-toss-border" /></div>
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3.5">
            {canGoBack && (
              <button type="button" onClick={onClose} aria-label="뒤로"
                className="sheet-back w-8 h-8 shrink-0 -ml-1 rounded-full flex items-center justify-center text-xl text-toss-sub hover:bg-toss-bg transition">‹</button>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-toss-text truncate">{title}</h3>
              {subtitle && <p className="text-xs text-toss-sub mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" onClick={canGoBack ? nav!.closeAll : onClose} aria-label={canGoBack ? "모두 닫기" : "닫기"}
              className="w-8 h-8 shrink-0 rounded-full bg-toss-bg flex items-center justify-center text-toss-sub hover:bg-gray-200 transition">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 flex gap-2 px-5 py-3.5 border-t border-toss-border bg-white">{footer}</div>}
      </div>
    </div>
  );
}
