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

/** 🍗🍺 누른 자리에서 이모지가 사방으로 팡팡 튀어요 */
export function emojiPop(emojis: string[], x: number, y: number, count = 14) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "emoji-fx";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const e = document.createElement("span");
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = 70 + Math.random() * 90;
    e.textContent = emojis[i % emojis.length];
    e.className = "emoji-pop";
    e.style.cssText = [
      `left:${x}px`, `top:${y}px`,
      `font-size:${22 + Math.random() * 14}px`,
      `--dx:${Math.cos(angle) * dist}px`,
      // 위로 튀었다가 아래로 떨어지게 (중력 느낌)
      `--dy:${Math.sin(angle) * dist - 40}px`,
      `--fall:${120 + Math.random() * 80}px`,
      `--r:${Math.random() * 540 - 270}deg`,
      `animation-delay:${Math.random() * 0.06}s`
    ].join(";");
    box.appendChild(e);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1400);
}

/** 💣😭 하늘에서 이모지가 비처럼 쏟아져요 */
export function emojiRain(emojis: string[], count = 26) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "emoji-fx";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const e = document.createElement("span");
    e.textContent = emojis[i % emojis.length];
    e.className = "emoji-rain";
    e.style.cssText = [
      `left:${Math.random() * 96}%`,
      `font-size:${22 + Math.random() * 16}px`,
      `animation-delay:${Math.random() * 0.7}s`,
      `animation-duration:${1.3 + Math.random() * 0.9}s`,
      `--r:${Math.random() * 120 - 60}deg`
    ].join(";");
    box.appendChild(e);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

/** ❤️ 누른 자리에서 하트가 몽글몽글 피어올라 퍼져요 */
export function emojiFloat(emojis: string[], x: number, y: number, count = 12) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "emoji-fx";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const e = document.createElement("span");
    e.textContent = emojis[i % emojis.length];
    e.className = "emoji-float";
    e.style.cssText = [
      `left:${x + (Math.random() - 0.5) * 40}px`, `top:${y}px`,
      `font-size:${18 + Math.random() * 18}px`,
      `--dx:${(Math.random() - 0.5) * 180}px`,
      `--rise:${160 + Math.random() * 180}px`,
      `--sway:${(Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18)}px`,
      `animation-delay:${Math.random() * 0.45}s`,
      `animation-duration:${1.8 + Math.random() * 0.9}s`
    ].join(";");
    box.appendChild(e);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}
