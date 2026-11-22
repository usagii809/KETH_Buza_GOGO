import { useState } from "react";
import { settleMonth, skipSettlement } from "../../data/db";
import { formatKRW, formatShort } from "../../lib/format";
import { josa } from "../../lib/josa";
import type { Goal, Settlement } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import { confetti } from "../fun/confetti";
import type { SettleOptions } from "./calc";

interface Props {
  ym: string;
  options: SettleOptions;
  settlement: Settlement | null;
  goals: Goal[];
  myName?: string;
  /** 배너로 쓸 때(이번 달 화면) true: 테두리 있는 카드 모양 */
  standalone?: boolean;
  onNewGoal: () => void;
}

/** 💰 월말 정산: 그 달에 남은 돈을 저축 목표로 옮겨요 */
export function SettlePanel({ ym, options, settlement, goals, myName, standalone, onNewGoal }: Props) {
  const { toast, confirm } = useFeedback();
  const m = Number(ym.slice(5));
  const [which, setWhich] = useState<"leftover" | "actual">(options.leftover > 0 ? "leftover" : "actual");
  const [goalId, setGoalId] = useState<string | null>(goals[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const amount = options[which];
  const goal = goals.find((g) => g.id === goalId) || goals[0] || null;
  const wrap = standalone ? "mb-4 p-4 rounded-3xl bg-white shadow-sm border-2 border-green-100" : "mt-4 p-3.5 rounded-2xl bg-green-50/70";

  if (settlement) {
    return (
      <div className={`settle-done ${standalone ? "mb-4 p-4 rounded-3xl bg-white shadow-sm" : "mt-4 p-3.5 rounded-2xl bg-toss-bg"} text-sm`}>
        {settlement.skipped
          ? <p className="text-toss-sub">{m}월 정산은 넘어갔어요{settlement.by ? ` (${settlement.by})` : ""}</p>
          : <p className="text-toss-text"><b>✅ {m}월 정산 완료</b> · {settlement.goalName}에 <b className="num">{formatKRW(settlement.amount || 0)}</b> 넣었어요{settlement.by ? <span className="text-toss-sub"> ({settlement.by})</span> : null}</p>}
      </div>
    );
  }

  const settle = async () => {
    if (!goal || amount <= 0 || busy) return;
    const ok = await confirm({ title: `${josa(goal.name, "으로", "로")} ${formatShort(amount)} 옮길까요?`, message: `${goal.emoji} ${goal.name} 목표에 넣고 ${m}월 정산을 끝내요. 실제 통장 이체도 잊지 마세요!`, okText: "옮기기" });
    if (!ok) return;
    setBusy(true);
    try {
      await settleMonth(ym, goal, amount, myName);
      confetti();
      toast(`💰 ${goal.name}에 ${formatShort(amount)} 넣었어요! ${m}월 정산 끝`);
    } catch (err) {
      console.error("정산 오류:", err);
      toast("정산하지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };
  const skip = async () => {
    const ok = await confirm({ title: `${m}월 정산을 넘어갈까요?`, message: "저축 목표에 넣지 않고 정산을 끝내요.", okText: "넘어가기" });
    if (ok) skipSettlement(ym, myName).catch(() => toast("저장하지 못했어요"));
  };

  const chip = (k: "leftover" | "actual", label: string) => (
    <button type="button" onClick={() => setWhich(k)} disabled={options[k] <= 0}
      className={`settle-amount flex-1 p-2.5 rounded-xl text-left transition disabled:opacity-40 ${which === k ? "bg-white ring-2 ring-toss-green" : "bg-white/60"}`}>
      <span className="block text-[11px] text-toss-sub">{label}</span>
      <span className="block text-sm font-bold num text-toss-text">{formatKRW(options[k])}</span>
    </button>
  );

  return (
    <div className={`settle ${wrap}`}>
      <p className="text-base font-bold text-toss-text">💰 {m}월 정산</p>
      <p className="text-sm text-toss-sub mt-0.5">
        {options.leftover > 0 ? <>변동지출 예산에서 <b className="text-toss-green num">{formatShort(options.leftover)}</b> 아꼈어요. 저축 목표로 옮겨볼까요?</> : "남은 돈을 저축 목표로 옮겨볼까요?"}
      </p>

      <div className="flex gap-2 mt-3">
        {chip("leftover", "아낀 돈 (남은 변동 예산)")}
        {chip("actual", "이 달에 남은 돈 전부")}
      </div>

      {goals.length === 0 ? (
        <button type="button" onClick={onNewGoal} className="mt-3 w-full py-3 rounded-xl bg-white text-sm font-bold text-toss-blue">🏝️ 저축 목표 먼저 만들기</button>
      ) : (
        <>
          {goals.length > 1 && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
              {goals.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoalId(g.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition ${goal?.id === g.id ? "bg-toss-green text-white" : "bg-white text-toss-sub"}`}>
                  {g.emoji} {g.name}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={settle} disabled={busy || amount <= 0}
            className="settle-go mt-3 w-full py-3 rounded-xl bg-toss-green text-white text-base font-bold active:scale-[0.99] transition disabled:opacity-50">
            {goal ? `${goal.emoji} ${goal.name}에 ${formatShort(amount)} 넣기` : "넣기"}
          </button>
        </>
      )}
      <button type="button" onClick={skip} className="mt-1.5 w-full py-1.5 text-xs font-semibold text-toss-sub">이번엔 넘어가기</button>
    </div>
  );
}
