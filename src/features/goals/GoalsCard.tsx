import { formatShort } from "../../lib/format";
import type { Goal } from "../../lib/types";
import { Card, ProgressBar } from "../../ui/controls";
import { goalEta, goalPct, goalRemain } from "./calc";

export function GoalsCard({ goals, planned, now, onOpen, onNew }:
  { goals: Goal[]; planned: number; now: Date; onOpen: (g: Goal) => void; onNew: () => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-toss-text">저축 목표</h2>
        <button type="button" onClick={onNew} className="text-sm font-bold text-toss-blue px-2 py-1 -mr-2 rounded-lg active:bg-toss-blueLight">+ 추가</button>
      </div>
      {goals.length === 0 ? (
        <button type="button" onClick={onNew} className="w-full text-left p-4 rounded-2xl bg-toss-bg active:scale-[0.99] transition">
          <p className="text-base font-bold text-toss-text">🏝️ 모으고 싶은 목표를 만들어보세요</p>
          <p className="text-sm text-toss-sub mt-0.5">신혼여행, 내 집 마련처럼 정해두면 얼마나 왔는지 보여드려요</p>
        </button>
      ) : (
        <div className="space-y-2.5">
          {goals.map((g) => {
            const pct = goalPct(g);
            const remain = goalRemain(g);
            const eta = goalEta(g, planned, now);
            return (
              <button key={g.id} type="button" onClick={() => onOpen(g)} className="w-full text-left p-4 rounded-2xl bg-toss-bg active:scale-[0.99] transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-toss-text truncate">{g.emoji || "💰"} {g.name}</span>
                  <span className="text-base font-bold text-toss-blue num shrink-0">{pct}%</span>
                </div>
                <div className="mt-2"><ProgressBar pct={pct} barClass={pct >= 100 ? "bg-toss-green" : "bg-toss-blue"} track="bg-white" /></div>
                <div className="flex justify-between text-xs text-toss-sub mt-1.5 num gap-2">
                  <span>{formatShort(g.saved || 0)} / {formatShort(g.target || 0)}</span>
                  <span className="font-semibold">{remain > 0 ? `목표까지 ${formatShort(remain)}` : "달성 완료 🎉"}</span>
                </div>
                {eta && <p className="text-xs font-semibold text-toss-blue mt-1">{eta}</p>}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
