import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Profile } from "../lib/types";

const BG: Record<string, string> = { 태형: "bg-blue-100 text-toss-blue", 경은: "bg-rose-100 text-rose-600" };

/**
 * 동그란 프로필 사진. 사진이 없으면 이름 첫 글자.
 * zoomable이면 사진을 눌러 크게 볼 수 있어요 (같이 보기 · 복권 카드)
 */
export function Avatar({ profile, size = 40, className = "", zoomable = false }: { profile?: Profile | null; size?: number; className?: string; zoomable?: boolean }) {
  const [open, setOpen] = useState(false);
  const style = { width: size, height: size };
  if (profile?.photo) {
    const img = <img src={profile.photo} alt={profile.name || "프로필"} style={style} className={`rounded-full object-cover bg-toss-bg ${className}`} />;
    if (!zoomable) return img;
    return (
      <>
        {/* 다른 버튼 안에 들어갈 수 있어서 button 대신 span */}
        <span role="button" tabIndex={0} aria-label={`${profile.name || "프로필"} 사진 크게 보기`} className="avatar-zoom inline-flex shrink-0 cursor-zoom-in rounded-full"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}>
          {img}
        </span>
        {open && <PhotoViewer profile={profile} onClose={() => setOpen(false)} />}
      </>
    );
  }
  const name = profile?.name;
  return (
    <span style={{ ...style, fontSize: size * 0.42 }}
      className={`rounded-full inline-flex items-center justify-center font-bold ${name ? BG[name] : "bg-toss-bg text-toss-sub"} ${className}`}>
      {name ? name[0] : "🙂"}
    </span>
  );
}

/** 사진 크게 보기: 화면 아무 데나 누르거나 ESC로 닫아요 */
function PhotoViewer({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  // 창(시트) 안에서 열려도 화면 전체를 덮도록 body에 붙여요
  return createPortal(
    <div role="dialog" aria-label={`${profile.name || "프로필"} 사진`} className="photo-viewer fixed inset-0 z-[80] bg-black/85 flex flex-col items-center justify-center p-6 animate-sheet-up"
      onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <img src={profile.photo} alt={profile.name || "프로필"} className="w-full max-w-sm aspect-square rounded-3xl object-cover shadow-2xl" />
      {profile.name && <p className="mt-4 text-lg font-bold text-white">{profile.name}</p>}
      <p className="mt-1 text-xs text-white/60">아무 데나 누르면 닫혀요</p>
    </div>,
    document.body
  );
}
