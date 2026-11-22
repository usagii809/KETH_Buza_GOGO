import { useEffect, useRef, useState } from "react";
import { getOrCreateTicket, revealTicket } from "../../data/db";
import type { LotteryTicket } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { confetti } from "../fun/confetti";
import { drawTicket, isJackpotSymbol, JACKPOT_SYMBOL, LOVE_SYMBOL, symbolsOf, tierTitle, VISIBLE_PRIZES } from "./ticket";

interface Props {
  uid: string;
  myName?: string;
  today: string;
  onClose: () => void;
}

/** 하루 한 장 긁는 복권. 열자마자 결과가 서버에 고정돼서 다시 뽑을 수 없어요 */
export function LotterySheet({ uid, myName, today, onClose }: Props) {
  const { toast } = useFeedback();
  const [ticket, setTicket] = useState<LotteryTicket | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let alive = true;
    getOrCreateTicket(uid, today, () => drawTicket(), myName)
      .then((t) => { if (alive) { setTicket(t); setRevealed(t.revealed); } })
      .catch((err) => {
        console.error("복권 오류:", err);
        toast("복권을 불러오지 못했어요. 잠시 후 다시 해주세요");
        onClose();
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, today]);

  const onReveal = () => {
    if (!ticket || revealed) return;
    setRevealed(true);
    revealTicket(ticket.id).catch((err) => console.warn("복권 저장 참고:", err));
    if (ticket.tier === "jackpot") { confetti(); setTimeout(confetti, 900); toast("🎰🎰🎰 잭팟! 오늘은 치맥 GO!"); }
    else if (ticket.tier === "love") { confetti(); setTimeout(confetti, 700); toast("💕 숨겨진 하트 세 개! 뽀뽀 해주기 당첨"); }
    else if (ticket.tier === "prize") { confetti(); toast(`🎁 ${ticket.rank}등 당첨! 쿠폰을 보여주세요`); }
    else if (ticket.tier === "bomb") toast("💣 펑! 내일은 둘 다 강제 무지출 데이예요");
  };

  const resultBg = ticket?.tier === "jackpot" ? "ruby-panel gold-shine text-amber-50"
    : ticket?.tier === "love" ? "bg-gradient-to-br from-rose-100 via-pink-50 to-rose-100 border border-rose-200"
    : ticket?.tier === "prize" ? "bg-indigo-50" : ticket?.tier === "bomb" ? "bg-gray-900 text-white" : "bg-toss-bg";

  return (
    <Sheet title="🎟️ 오늘의 복권" subtitle="하루 한 장! 🎰🎰🎰 나오면 바로 치맥 GO" onClose={onClose}>
      {!ticket ? (
        <div className="h-40 flex items-center justify-center text-sm text-toss-sub">복권을 꺼내는 중…</div>
      ) : (
        <div className="space-y-4">
          {/* ? 를 누르면 당첨표 */}
          <div className="flex justify-end -mb-2">
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-label="당첨표 보기" aria-expanded={showTable}
              className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-bold transition ${showTable ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`}>
              당첨표
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${showTable ? "bg-white text-toss-blue" : "bg-white text-toss-sub"}`}>?</span>
            </button>
          </div>
          {showTable && <PrizeTable />}
          <ScratchCard symbols={symbolsOf(ticket)} revealed={revealed} onReveal={onReveal} />
          {!revealed && (
            <div className="flex items-center justify-between text-xs text-toss-sub">
              <span>손가락으로 그림 세 칸을 긁어보세요</span>
              <button type="button" onClick={onReveal} className="underline">한 번에 열기</button>
            </div>
          )}
          {revealed && (
            <div className={`p-4 rounded-2xl text-center ${resultBg}`}>
              {ticket.tier === "jackpot" ? (
                // 금색 글씨 + 🎰은 원래 색 그대로
                <p className="text-xl font-bold"><span className="gold-text">👑 1등!</span> 🎰🎰🎰 <span className="gold-text">치맥 당첨</span></p>
              ) : (
                <p className={`font-bold ${ticket.tier === "love" ? "text-xl text-rose-500" : "text-lg"}`}>{tierTitle(ticket.tier, ticket.rank)}</p>
              )}
              <p className="text-base font-semibold mt-1">{ticket.prize}</p>
              {(ticket.tier === "prize" || ticket.tier === "love") && <p className="text-xs text-toss-sub mt-1">상대에게 이 화면을 보여주고 오늘 써요</p>}
              <p className={`text-xs mt-2 ${ticket.tier === "bomb" || ticket.tier === "jackpot" ? "text-white/60" : "text-toss-sub"}`}>내일 또 한 장이 도착해요</p>
            </div>
          )}

        </div>
      )}
    </Sheet>
  );
}

/** 등수별 그림과 상품 */
function PrizeTable() {
  return (
    <div className="rounded-2xl bg-toss-bg p-3.5 animate-sheet-up">
      <div className="space-y-2">
        {VISIBLE_PRIZES.map((row) => (
          <div key={row.symbol} className="flex items-center gap-3">
            <span className={`w-11 shrink-0 text-center text-xs font-bold rounded-full py-0.5 ${row.tier === "jackpot" ? "bg-gradient-to-b from-amber-200 to-amber-500 text-zinc-900" : row.tier === "bomb" ? "bg-gray-800 text-white" : "bg-white text-toss-sub"}`}>
              {row.rank ? `${row.rank}등` : "폭탄"}
            </span>
            <span className="w-[72px] shrink-0 text-lg leading-none tracking-tight">
              {row.tier === "jackpot"
                ? <span className="inline-block px-1.5 py-1 rounded-lg lux-cell text-base leading-none tracking-tight">{JACKPOT_SYMBOL.repeat(3)}</span>
                : row.symbol.repeat(3)}
            </span>
            <span className="text-sm text-toss-text leading-snug">
              {row.tier === "jackpot" ? "🍗🍺 치맥 GO! (묻지도 따지지도 않기)" : row.tier === "bomb" ? "🔒 내일 둘 다 강제 무지출" : row.prize}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1.5 border-t border-toss-border">
          <span className="w-11 shrink-0 text-center text-xs font-bold rounded-full py-0.5 bg-white text-toss-sub">꽝</span>
          <span className="text-sm text-toss-sub leading-snug">그 외 · 대신 오늘의 운세 한 줄 🔮</span>
        </div>
      </div>
    </div>
  );
}

const Symbol = ({ s }: { s: string }) =>
  s === "7" ? <span className="text-[56px] leading-none lux-seven ruby-text">7</span> : <span className="text-[42px] leading-none">{s}</span>;

const cellClass = (s: string) =>
  isJackpotSymbol(s) ? "lux-cell" : s === LOVE_SYMBOL ? "bg-rose-50 ring-2 ring-rose-200" : "bg-white shadow-sm";

/**
 * 은박을 손가락으로 긁어내는 카드.
 * 그림 세 칸이 각각 60% 넘게 드러나야 열려요 (겉만 긁어서는 안 열려요)
 */
function ScratchCard({ symbols, revealed, onReveal }: { symbols: string[]; revealed: boolean; onReveal: () => void }) {
  const jackpot = revealed && symbols.length === 3 && symbols.every(isJackpotSymbol);
  const love = revealed && symbols.length === 3 && symbols.every((s) => s === LOVE_SYMBOL);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const drawing = useRef(false);
  const moves = useRef(0);

  useEffect(() => {
    if (revealed) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = wrap.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#BFC5CE");
    g.addColorStop(0.5, "#EEF1F5");
    g.addColorStop(1, "#AEB5BF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    ctx.fillStyle = "#6B7684";
    ctx.font = "bold 17px Pretendard, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🪙 여기를 긁어보세요", width / 2, height / 2);
  }, [revealed]);

  /** 그림 칸마다 얼마나 드러났는지 확인 */
  const checkProgress = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cr = canvas.getBoundingClientRect();
    const scale = canvas.width / cr.width;
    const allOpen = boxRefs.current.every((box) => {
      if (!box) return false;
      const b = box.getBoundingClientRect();
      const x = Math.max(0, Math.floor((b.left - cr.left) * scale));
      const y = Math.max(0, Math.floor((b.top - cr.top) * scale));
      const w = Math.max(1, Math.floor(b.width * scale));
      const h = Math.max(1, Math.floor(b.height * scale));
      const data = ctx.getImageData(x, y, w, h).data;
      let clear = 0;
      let total = 0;
      for (let i = 3; i < data.length; i += 4 * 8) { total++; if (data[i] === 0) clear++; }
      return total > 0 && clear / total >= 0.6;
    });
    if (allOpen) onReveal();
  };

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const r = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - r.left, e.clientY - r.top, 22, 0, Math.PI * 2);
    ctx.fill();
    if (++moves.current % 8 === 0) checkProgress();
  };

  return (
    <div ref={wrapRef} className={`relative h-36 rounded-2xl overflow-hidden border-2 select-none ${jackpot ? "ruby-panel gold-shine border-amber-300" : love ? "border-rose-300 bg-gradient-to-br from-rose-100 to-pink-50" : "border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-100"}`}>
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        {symbols.map((s, i) => (
          <span key={i} ref={(el) => { boxRefs.current[i] = el; }}
            className={`w-16 h-20 rounded-xl flex items-center justify-center ${cellClass(s)}`}>
            <Symbol s={s} />
          </span>
        ))}
      </div>
      {!revealed && (
        <canvas ref={canvasRef} className="absolute inset-0 cursor-pointer" style={{ touchAction: "none" }}
          onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }}
          onPointerMove={(e) => { if (drawing.current) scratch(e); }}
          onPointerUp={() => { drawing.current = false; checkProgress(); }}
          onPointerCancel={() => { drawing.current = false; }} />
      )}
    </div>
  );
}
