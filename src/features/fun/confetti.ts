/** 화면 위에서 꽃가루가 쏟아져요 (라이브러리 없이, 3초 뒤 자동 정리) */
export function confetti() {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3182F6", "#00B37E", "#FFC83D", "#F04452", "#FF9F00", "#A78BFA"];
  const box = document.createElement("div");
  box.className = "confetti-box";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 6;
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size * 0.45}px`,
      `background:${colors[i % colors.length]}`,
      `animation-delay:${Math.random() * 0.3}s`,
      `animation-duration:${1.8 + Math.random() * 1.2}s`,
      `--x:${(Math.random() - 0.5) * 160}px`,
      `--r:${Math.random() * 720 - 360}deg`
    ].join(";");
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}
