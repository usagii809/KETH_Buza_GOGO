import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 하단 고정 영역 (저장 버튼 등) */
  footer?: ReactNode;
}

/** 아래에서 올라오는 시트. 바깥 탭 · ESC · 손잡이를 아래로 끌어서 닫기 */
export function Sheet({ title, subtitle, onClose, children, footer }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", onKey);
    };
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
    if (drag.current.dy > 90) onClose();
    else el.style.transform = "";
    drag.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={sheetRef} role="dialog" aria-modal="true"
        className="sheet animate-sheet-up w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        <div className="shrink-0 bg-white border-b border-toss-border" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="flex justify-center pt-2.5 sm:hidden"><span className="w-10 h-1.5 rounded-full bg-toss-border" /></div>
          <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3.5">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-toss-text truncate">{title}</h3>
              {subtitle && <p className="text-xs text-toss-sub mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="닫기"
              className="w-8 h-8 shrink-0 rounded-full bg-toss-bg flex items-center justify-center text-toss-sub hover:bg-gray-200 transition">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 flex gap-2 px-5 py-3.5 border-t border-toss-border bg-white">{footer}</div>}
      </div>
    </div>
  );
}
