import { useEffect } from "react";
import { shiftMonth, todayYm, type PeriodInfo } from "../../lib/dates";
import { store } from "../../lib/storage";
import type { Goal, Transaction } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import type { Summary } from "../budget/calc";
import { buildReport } from "./calc";

interface Props {
  period: PeriodInfo;
  s: Summary;
  txs: Transaction[];
  prevTxs: Transaction[];
  goals: Goal[];
  now: Date;
  onOpenLastMonth: () => void;
  onDepositToGoal: (goal: Goal, amount: number) => void;
}

/** 이번 달 화면: "성적표 도착" 배너 / 지난 달 화면: 결산 카드 */
export function ReportSection({ period, s, txs, prevTxs, goals, now, onOpenLastMonth, onDepositToGoal }: Props) {
  const { toast } = useFeedback();
  const lastMonth = shiftMonth(todayYm(now), -1);
  const showCard = period.state === "past" && txs.length > 0;

  useEffect(() => {
    if (showCard) store.set(`reportSeen_${period.key}`, "1");
  }, [showCard, period.key]);

  if (period.state === "current") {
    const unseen = prevTxs.length > 0 && !store.get(`reportSeen_${lastMonth}`, "");
    if (!unseen) return null;
    return (
      <button type="button" onClick={onOpenLastMonth}
        className="w-full text-left mb-4 p-4 rounded-3xl bg-toss-blue text-white shadow-sm active:scale-[0.99] transition">
        <p className="text-base font-bold">📬 {Number(lastMonth.slice(5))}월 성적표가 도착했어요</p>
        <p className="text-sm text-white/80 mt-0.5">얼마나 모았는지 같이 확인해볼까요? →</p>
      </button>
    );
  }
  if (!showCard) return null;

  const r = buildReport(period, s, txs, prevTxs, now);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ text: r.shareText }); return; }
      await navigator.clipboard.writeText(r.shareText);
      toast("성적표를 복사했어요. 카톡에 붙여넣어 보세요");
    } catch { /* 공유 취소 */ }
  };

  return (
    <section className="bg-white rounded-3xl p-5 shadow-sm mb-4 border-2 border-toss-blueLight">
      <div className="flex items-start gap-3">
        <span className="text-4xl leading-none">{r.emoji}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-toss-blue">{period.m}월 성적표</p>
          <p className="text-lg font-bold text-toss-text leading-snug mt-0.5">{r.title}</p>
          {r.sub && <p className="text-sm text-toss-sub mt-0.5">{r.sub}</p>}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-toss-border space-y-2">
        {r.rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3 text-sm">
            <span className="text-toss-sub shrink-0">{row.label}</span>
            <span className={`font-bold text-right num ${row.tone === "good" ? "text-toss-green" : row.tone === "bad" ? "text-toss-red" : "text-toss-text"}`}>{row.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {s.projectedSavings > 0 && goals.slice(0, 3).map((g) => (
          <button key={g.id} type="button" onClick={() => onDepositToGoal(g, s.projectedSavings)}
            className="px-3 py-2 rounded-xl bg-toss-blueLight text-sm font-bold text-toss-blue active:scale-95 transition">
            {g.emoji} {g.name}에 넣기
          </button>
        ))}
        <button type="button" onClick={share} className="px-3 py-2 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub active:scale-95 transition">공유하기</button>
      </div>
    </section>
  );
}
