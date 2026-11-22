import { useState } from "react";
import { addGoal, deleteGoal, moveGoalMoney, updateGoal } from "../../data/db";
import { formatKRW, formatShort } from "../../lib/format";
import type { Goal } from "../../lib/types";
import { BigMoneyInput, MoneyInput, ProgressBar, inputClass, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { GOAL_EMOJIS, goalEta, goalPct } from "./calc";

interface Props {
  /** null = 새 목표 */
  goal: Goal | null;
  mode: "deposit" | "edit";
  prefill?: number;
  planned: number;
  now: Date;
  onClose: () => void;
}

export function GoalSheet({ goal, mode: initialMode, prefill = 0, planned, now, onClose }: Props) {
  const [mode, setMode] = useState(goal ? initialMode : "edit");
  return mode === "deposit" && goal
    ? <DepositView goal={goal} prefill={prefill} planned={planned} now={now} onEdit={() => setMode("edit")} onClose={onClose} />
    : <EditView goal={goal} onClose={onClose} />;
}

function DepositView({ goal, prefill, planned, now, onEdit, onClose }:
  { goal: Goal; prefill: number; planned: number; now: Date; onEdit: () => void; onClose: () => void }) {
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(prefill);
  const pct = goalPct(goal);
  const eta = goalEta(goal, planned, now);
  const history = (goal.history || []).filter((h) => h && h.at).sort((a, b) => b.at - a.at).slice(0, 5);

  const move = async (sign: 1 | -1) => {
    if (amount <= 0) { toast("금액을 입력해 주세요"); return; }
    const saved = Number(goal.saved) || 0;
    if (sign < 0 && amount > saved) { toast("모은 돈보다 많이 꺼낼 수 없어요"); return; }
    try {
      await moveGoalMoney(goal.id, sign * amount);
      onClose();
      const after = saved + sign * amount;
      if (sign > 0 && goal.target > 0 && after >= goal.target && saved < goal.target) toast(`🎉 ${goal.name} 목표 달성! 축하해요`);
      else if (sign > 0) toast(`${formatShort(amount)} 모았어요! 목표까지 ${Math.min(100, Math.floor((after / goal.target) * 100))}%`);
      else toast(`${formatShort(amount)} 꺼냈어요`);
    } catch (err) {
      console.error("목표 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    }
  };

  return (
    <Sheet title={`${goal.emoji || "💰"} ${goal.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-toss-blueLight/70">
          <p className="text-sm text-toss-sub">지금까지 모은 돈</p>
          <p className="text-2xl font-bold text-toss-text num mt-0.5">{formatKRW(goal.saved || 0)}</p>
          <div className="mt-2"><ProgressBar pct={pct} barClass="bg-toss-blue" className="h-2.5" track="bg-white" /></div>
          <div className="flex justify-between text-xs text-toss-sub mt-1.5 num"><span>목표 {formatShort(goal.target || 0)}</span><span className="font-bold text-toss-blue">{pct}%</span></div>
          {eta && <p className="text-xs font-semibold text-toss-blue mt-1">{eta}</p>}
        </div>

        <div>
          <label htmlFor="goalAmount" className="block text-sm font-medium text-toss-sub mb-1.5">얼마를 넣을까요?</label>
          <BigMoneyInput id="goalAmount" value={amount} onChange={setAmount} />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[[100000, "+10만"], [500000, "+50만"], [1000000, "+100만"]].map(([n, label]) => (
              <button key={n} type="button" onClick={() => setAmount((a) => a + Number(n))}
                className="px-3 py-2 rounded-xl bg-toss-bg hover:bg-gray-200 text-xs font-semibold text-toss-sub active:scale-95 transition">{label}</button>
            ))}
            {planned > 0 && (
              <button type="button" onClick={() => setAmount(planned)} className="px-3 py-2 rounded-xl bg-toss-blueLight text-xs font-bold text-toss-blue active:scale-95 transition">
                이번 달 계획 저축액 {formatShort(planned)}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => move(-1)} className="py-3.5 rounded-2xl bg-toss-bg text-sm font-bold text-toss-sub active:scale-[0.99] transition">꺼내기</button>
          <button type="button" id="goalDepositBtn" onClick={() => move(1)} className={`${primaryButton} col-span-2`}>모으기</button>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-sm font-bold text-toss-text mb-1">최근 기록</p>
            <div className="divide-y divide-toss-border">
              {history.map((h) => {
                const d = new Date(h.at);
                return (
                  <div key={h.at} className="flex justify-between py-2 text-sm">
                    <span className="text-toss-sub num">{d.getFullYear()}.{d.getMonth() + 1}.{d.getDate()}</span>
                    <span className={`font-bold num ${h.amount >= 0 ? "text-toss-blue" : "text-toss-red"}`}>{h.amount >= 0 ? "+" : "-"}{formatKRW(Math.abs(h.amount))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button type="button" onClick={onEdit} className="w-full py-2 text-sm font-semibold text-toss-sub">목표 수정하기</button>
      </div>
    </Sheet>
  );
}

function EditView({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(goal?.name || "");
  const [emoji, setEmoji] = useState(goal?.emoji || GOAL_EMOJIS[0]);
  const [target, setTarget] = useState(goal?.target || 0);
  const [saved, setSaved] = useState(goal?.saved || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast("목표 이름을 적어주세요"); return; }
    if (target <= 0) { toast("목표 금액을 입력해 주세요"); return; }
    try {
      if (goal) { await updateGoal(goal.id, { name: n, emoji, target, saved }); toast("목표를 수정했어요"); }
      else { await addGoal({ name: n, emoji, target, saved }); toast(`${emoji} ${n} 목표를 만들었어요. 같이 모아봐요!`); }
      onClose();
    } catch (err) {
      console.error("목표 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    }
  };

  const remove = async () => {
    if (!goal) return;
    if (!(await confirm({ title: "이 목표를 지울까요?", message: "모은 기록도 함께 사라져요.", okText: "지우기" }))) return;
    try { await deleteGoal(goal.id); onClose(); toast("목표를 지웠어요"); } catch { toast("지우지 못했어요"); }
  };

  const money = "w-full bg-toss-bg text-toss-text text-lg font-bold num rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue";
  return (
    <Sheet title={goal ? "목표 수정" : "새 저축 목표"} onClose={onClose}
      footer={<>
        {goal && <button type="button" onClick={remove} className="px-4 py-3.5 rounded-2xl bg-red-50 text-toss-red text-sm font-bold">지우기</button>}
        <button type="submit" form="goalForm" className={primaryButton}>{goal ? "저장하기" : "목표 만들기"}</button>
      </>}>
      <form id="goalForm" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="goalName" className="block text-sm font-medium text-toss-sub mb-1.5">어떤 목표인가요?</label>
          <input id="goalName" maxLength={20} placeholder="예: 신혼여행" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <span className="block text-sm font-medium text-toss-sub mb-1.5">아이콘</span>
          <div className="grid grid-cols-8 gap-1.5">
            {GOAL_EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)}
                className={`aspect-square rounded-xl text-xl flex items-center justify-center transition active:scale-95 ${e === emoji ? "bg-toss-blueLight ring-2 ring-toss-blue" : "bg-toss-bg"}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="goalTarget" className="block text-sm font-medium text-toss-sub mb-1.5">목표 금액</label>
          <MoneyInput id="goalTarget" value={target} onChange={setTarget} className={money} />
        </div>
        <div>
          <label htmlFor="goalSaved" className="block text-sm font-medium text-toss-sub mb-1.5">지금까지 모은 돈 <span className="font-normal">(선택)</span></label>
          <MoneyInput id="goalSaved" value={saved} onChange={setSaved} className={money} />
        </div>
      </form>
    </Sheet>
  );
}
