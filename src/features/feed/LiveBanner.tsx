import { useEffect, useRef, useState } from "react";
import type { Profile } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";

export interface LiveNote {
  id: string;
  title: string;
  body?: string;
  profile: Profile | null;
}

/** 이만큼(px) 밀면 넘겨서 치워요 */
const SWIPE_AWAY = 70;
/** 손가락이 이만큼 안 움직였으면 '누르기'로 봐요 */
const TAP_SLOP = 6;

/**
 * 💌 앱을 보고 있을 때 상대 소식이 오면 화면 아래에 살짝 떴다가 사라져요 (3초)
 * - 누르면 같이 보기가 열려요
 * - 옆으로 슥 밀면 바로 치워요 (미는 동안은 안 사라져요)
 */
export function LiveBanner({ note, onOpen, onDone }: { note: LiveNote | null; onOpen: () => void; onDone: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"fade" | "left" | "right" | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const timer = useRef<number>();
  // 밀고 손을 뗄 때 따라오는 click은 '누르기'가 아니에요
  const suppressClick = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const leave = (how: "fade" | "left" | "right") => {
    window.clearTimeout(timer.current);
    setLeaving(how);
    timer.current = window.setTimeout(() => doneRef.current(), 220);
  };
  const autoHide = (ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => leave("fade"), ms);
  };

  // 새 소식마다 처음 상태로 + 3초 뒤 사라지기
  useEffect(() => {
    if (!note) return;
    setDx(0); setDragging(false); setLeaving(null); start.current = null;
    autoHide(3000);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  if (!note) return null;

  const onDown = (e: React.PointerEvent) => {
    if (leaving) return;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    window.clearTimeout(timer.current); // 잡고 있는 동안은 안 사라져요
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || leaving) return;
    const mx = e.clientX - s.x;
    if (!s.moved) {
      if (Math.abs(mx) < TAP_SLOP) return;
      // 세로로 더 움직이면 화면 스크롤로 넘겨요
      if (Math.abs(e.clientY - s.y) > Math.abs(mx)) { start.current = null; autoHide(2000); return; }
      s.moved = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setDx(mx);
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s || leaving) return;
    if (!s.moved) { autoHide(2000); return; }
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 50);
    if (Math.abs(dx) > SWIPE_AWAY) leave(dx > 0 ? "right" : "left");
    else { setDx(0); autoHide(2000); }
  };
  const onClick = () => {
    if (suppressClick.current || dragging || Math.abs(dx) > TAP_SLOP || leaving) return;
    window.clearTimeout(timer.current);
    onDone();
    onOpen();
  };

  const x = leaving === "right" ? "110%" : leaving === "left" ? "-110%" : `${dx}px`;
  const fade = leaving ? 0 : Math.max(0.35, 1 - Math.abs(dx) / 260);
  return (
    <div className="fixed left-0 right-0 bottom-[9.25rem] z-[65] flex justify-center px-4 pointer-events-none" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <div key={note.id} className="animate-live-in w-full max-w-sm">
        <button type="button" aria-live="polite" aria-label={`${note.title}. 누르면 같이 보기, 옆으로 밀면 닫기`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={onClick}
          style={{ transform: `translateX(${x})`, opacity: leaving === "fade" ? 0 : fade, touchAction: "pan-y",
            transition: dragging ? "none" : "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s" }}
          className="live-banner pointer-events-auto select-none w-full flex items-center gap-2.5 pl-2 pr-4 py-2 rounded-full bg-white/95 dark:bg-toss-card/95 backdrop-blur shadow-lg shadow-black/10 border border-toss-border text-left">
          <Avatar profile={note.profile} size={32} className="shrink-0 pointer-events-none" />
          <span className="min-w-0 flex-1 pointer-events-none">
            <span className="block text-[13px] font-bold text-toss-text truncate">{note.title}</span>
            {note.body && <span className="block text-[11px] text-toss-sub truncate">{note.body}</span>}
          </span>
        </button>
      </div>
    </div>
  );
}
