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

interface BurstOpts {
  count: number;
  /** 처음 속도 (px/프레임, 60fps 기준) */
  speed: [number, number];
  /** 공기 저항 (1에 가까울수록 오래 미끄러져요) */
  drag: number;
  /** 중력 (+면 아래로, -면 위로 둥실) */
  gravity: number;
  /** 사는 시간 (초) */
  life: [number, number];
  size: [number, number];
  /** 좌우로 살랑이는 폭 (px) */
  sway?: number;
  /** 위쪽으로 더 튀게 (px/프레임) */
  lift?: number;
  spin?: number;
  /** 나오는 시간을 흩뿌리기 (초) */
  stagger?: number;
}

/** 이모지 입자를 물리 계산으로 움직여요: 쭉 뻗어 퍼졌다가 → 느려지며 둥실 → 천천히 사라져요 */
function burst(emojis: string[], x: number, y: number, o: BurstOpts) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div");
  box.className = "emoji-fx";
  box.setAttribute("aria-hidden", "true");
  // 화면 크기에 맞춰 퍼지는 거리 (폰 390px 기준 1)
  const reach = Math.min(window.innerWidth, 600) / 390;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const parts = Array.from({ length: o.count }, (_, i) => {
    const el = document.createElement("span");
    el.textContent = emojis[i % emojis.length];
    el.className = "emoji-burst";
    el.style.cssText = `left:${x}px;top:${y}px;font-size:${rnd(o.size[0], o.size[1])}px;opacity:0`;
    box.appendChild(el);
    // 방향도 거리도 제각각 → 동그란 고리가 아니라 가까이 · 멀리 고루 흩어져요
    const angle = Math.random() * Math.PI * 2;
    const sp = (o.speed[0] + (o.speed[1] - o.speed[0]) * Math.pow(Math.random(), 0.7)) * reach;
    return {
      el, x: 0, y: 0,
      vx: Math.cos(angle) * sp,
      vy: Math.sin(angle) * sp - (o.lift ?? 0) * reach * rnd(0.6, 1.4),
      rot: rnd(-20, 20), vr: rnd(-1, 1) * (o.spin ?? 8),
      life: rnd(o.life[0], o.life[1]),
      delay: Math.random() * (o.stagger ?? 0.06),
      phase: Math.random() * Math.PI * 2,
      // 입자마다 공기 저항도 조금씩 달라요
      drag: o.drag + rnd(-0.006, 0.004)
    };
  });
  document.body.appendChild(box);
  const start = performance.now();
  let last = start;
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    const k = Math.min(3, (now - last) / 16.67);
    last = now;
    let alive = 0;
    for (const p of parts) {
      const drag = Math.pow(p.drag, k);
      const age = t - p.delay;
      if (age < 0) { alive++; continue; }
      if (age > p.life) { p.el.style.opacity = "0"; continue; }
      alive++;
      p.vx *= drag;
      p.vy = p.vy * drag + o.gravity * k * reach;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.rot += p.vr * k;
      p.vr *= drag;
      const sway = o.sway ? Math.sin(age * 3 + p.phase) * o.sway * Math.min(1, age) : 0;
      const grow = Math.min(1, age / 0.15);
      const fade = age > p.life - 0.8 ? Math.max(0, (p.life - age) / 0.8) : 1;
      p.el.style.transform = `translate(-50%, -50%) translate(${p.x + sway}px, ${p.y}px) rotate(${p.rot}deg) scale(${0.3 + 0.7 * grow})`;
      p.el.style.opacity = String(Math.min(grow * 1.5, fade));
    }
    if (alive > 0) requestAnimationFrame(tick);
    else box.remove();
  };
  requestAnimationFrame(tick);
  setTimeout(() => box.remove(), 7000); // 혹시 멈춰도 정리
}

/** 🍗🍺 · 💍 · 🎂🥳 · 🎄🎅 누른 자리에서 가까이 · 멀리 제각각 튀어올랐다가 포물선을 그리며 떨어져요 */
export function emojiPop(emojis: string[], x: number, y: number) {
  burst(emojis, x, y, { count: 40, speed: [2, 12], drag: 0.985, gravity: 0.11, life: [2.6, 3.6], size: [24, 44], lift: 3, spin: 7 });
}

/** ❤️ 누른 자리에서 하트가 몽글몽글 사방으로 천천히 퍼지며 둥실 떠올라요 */
export function emojiFloat(emojis: string[], x: number, y: number) {
  burst(emojis, x, y, { count: 26, speed: [2.5, 6.5], drag: 0.975, gravity: -0.035, life: [3, 4.4], size: [20, 46], spin: 2, sway: 14, stagger: 0.9 });
}

/** 💣😭 하늘에서 이모지가 비처럼 쏟아져요 */
export function emojiRain(emojis: string[], count = 42) {
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
      `animation-delay:${Math.random() * 1.1}s`,
      `animation-duration:${1.6 + Math.random() * 1.2}s`,
      `--r:${Math.random() * 120 - 60}deg`
    ].join(";");
    box.appendChild(e);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

