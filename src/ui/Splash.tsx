import { useEffect, useState } from "react";

/**
 * 🌱 첫 로딩 화면 (모양 · 스타일은 index.html에 있어요: React가 뜨기 전부터 같은 화면이 보이게)
 * done이 되면 스르륵 사라지고, 다 사라지면 화면에서 빠져요
 */
export function Splash({ done = false }: { done?: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!done) { setGone(false); return; }
    const t = window.setTimeout(() => setGone(true), 400);
    return () => window.clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return (
    <div className={`splash${done ? " is-done" : ""}`} role="status" aria-label="불러오는 중" aria-hidden={done}>
      <img className="splash-icon" src="./icon-192.png" alt="" />
      <div className="splash-title">부자 가계부</div>
      <div className="splash-sub">태형이와 경은이의 부자 되기 프로젝트</div>
      <div className="splash-dots" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
