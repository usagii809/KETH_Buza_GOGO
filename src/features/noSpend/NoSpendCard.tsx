import { useState } from "react";
import { startNoSpendChallenge, stopNoSpendChallenge } from "../../data/db";
import { todayStr, type PeriodInfo } from "../../lib/dates";
import { compactKRW } from "../../lib/format";
import type { Transaction } from "../../lib/types";
import { Card } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { challengeDay, countNoSpendDays, noSpendStreak, spentByDate } from "./calc";

interface Props {
  period: PeriodInfo;
  txs: Transaction[];
  prevTxs: Transaction[];
  now: Date;
  /** 챌린지 시작일 (YYYY-MM-DD). null이면 아직 시작 전 */
  start: string | null;
  uid: string;
}

export function NoSpendCard({ period, txs, prevTxs, now, start, uid }: Props) {
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const today = todayStr(now);
  if (period.state === "future") return null;

  const begin = async () => {
    setBusy(true);
    try {
      await startNoSpendChallenge(today, uid);
      toast("무지출 챌린지 시작! 오늘부터 🌱를 모아봐요");
    } catch { toast("시작하지 못했어요. 다시 시도해 주세요"); }
    finally { setBusy(false); }
  };
  const restart = async () => {
    if (!(await confirm({ title: "처음부터 다시 할까요?", message: "오늘을 1일째로 새로 시작해요.\n두 사람 화면 모두에 적용돼요.", okText: "다시 시작", danger: false }))) return;
    await begin();
  };
  const stop = async () => {
    if (!(await confirm({ title: "챌린지를 그만할까요?", message: "언제든 다시 시작할 수 있어요.", okText: "그만하기" }))) return;
    try { await stopNoSpendChallenge(); toast("챌린지를 멈췄어요"); } catch { toast("저장하지 못했어요"); }
  };

  // 시작 전
  if (!start) {
    if (period.state === "past") return null;
    return (
      <Card>
        <h2 className="text-base font-bold text-toss-text">무지출 챌린지 🌱</h2>
        <p className="text-sm text-toss-sub mt-1 leading-relaxed">
          지출 없는 날마다 달력에 🌱가 하나씩 쌓여요.<br />연속 기록을 세면서 둘이 같이 도전해봐요!
        </p>
        <button type="button" onClick={begin} disabled={busy}
          className="mt-4 w-full py-3.5 rounded-2xl bg-toss-green hover:brightness-95 text-white text-base font-bold shadow-sm active:scale-[0.99] transition disabled:opacity-60">
          오늘부터 시작! 🌱
        </button>
      </Card>
    );
  }

  const monthEnd = `${period.key}-${String(period.dim).padStart(2, "0")}`;
  if (period.state === "past" && start > monthEnd) return null; // 챌린지 시작 전의 달

  const map = spentByDate(txs.concat(prevTxs));
  const count = countNoSpendDays(period, map, today, start);
  const [, sm, sd] = start.split("-").map(Number);

  let msg: string;
  if (period.state === "past") msg = count > 0 ? `${period.m}월엔 무지출 ${count}일을 달성했어요 👏` : "이 달엔 무지출 날이 없었어요";
  else if (map[today] > 0) msg = "오늘은 지출이 있었어요. 내일 다시 도전해봐요 💪";
  else {
    const streak = noSpendStreak(map, now, period.key, start);
    msg = streak >= 2 ? `${streak}일 연속 무지출 중이에요 🔥` : "오늘 하루 무지출 도전 중이에요 🌱";
  }

  const firstDow = new Date(period.y, period.m - 1, 1).getDay();
  const days = Array.from({ length: period.dim }, (_, i) => i + 1);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-toss-text">무지출 챌린지 🌱</h2>
        <span className="text-sm font-bold text-toss-green num">무지출 {count}일</span>
      </div>
      <p className="text-sm font-semibold text-toss-text mt-0.5">{msg}</p>
      <p className="text-xs text-toss-sub mt-0.5 mb-3 num">
        {sm}월 {sd}일부터 도전 중{period.state === "current" ? ` · ${challengeDay(start, today)}일째` : ""}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-toss-sub mb-1">
        <span className="text-toss-red">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-toss-blue">토</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const ds = `${period.key}-${String(d).padStart(2, "0")}`;
          const future = ds > today;
          const before = ds < start; // 챌린지 시작 전
          const spent = map[ds] || 0;
          const sprout = !future && !before && !spent;
          return (
            <div key={d}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${sprout ? "bg-green-50" : before ? "bg-transparent" : "bg-toss-bg/70"} ${ds === today ? "ring-2 ring-toss-blue" : ""} ${ds === start ? "ring-2 ring-toss-green" : ""}`}>
              <span className={`text-[11px] num leading-none ${future || before ? "text-toss-muted" : "text-toss-sub"}`}>{d}</span>
              {!future && (spent > 0
                ? <span className={`text-[11px] font-semibold num leading-none ${before ? "text-toss-muted" : "text-toss-sub"}`}>{compactKRW(spent)}</span>
                : sprout ? <span className="text-base leading-none">🌱</span> : null)}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-toss-sub">자동 기록은 무지출 계산에서 빼요</p>
        {period.state === "current" && (
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={restart} className="px-2 py-1 rounded-lg text-xs font-semibold text-toss-sub hover:bg-toss-bg">다시 시작</button>
            <button type="button" onClick={stop} className="px-2 py-1 rounded-lg text-xs font-semibold text-toss-sub hover:bg-toss-bg">그만하기</button>
          </div>
        )}
      </div>
    </Card>
  );
}
