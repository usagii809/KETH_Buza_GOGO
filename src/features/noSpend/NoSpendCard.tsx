import { todayStr, type PeriodInfo } from "../../lib/dates";
import { compactKRW } from "../../lib/format";
import type { Transaction } from "../../lib/types";
import { Card } from "../../ui/controls";
import { countNoSpendDays, noSpendStreak, spentByDate } from "./calc";

export function NoSpendCard({ period, txs, prevTxs, now }: { period: PeriodInfo; txs: Transaction[]; prevTxs: Transaction[]; now: Date }) {
  if (period.state === "future") return null;
  const map = spentByDate(txs.concat(prevTxs));
  const today = todayStr(now);
  const count = countNoSpendDays(period, map, today);

  let msg: string;
  if (period.state === "past") msg = count > 0 ? `${period.m}월엔 무지출 ${count}일을 달성했어요 👏` : "이 달엔 무지출 날이 없었어요";
  else if (map[today] > 0) msg = "오늘은 지출이 있었어요. 내일 다시 도전해봐요 💪";
  else {
    const streak = noSpendStreak(map, now, period.key);
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
      <p className="text-sm text-toss-sub mt-0.5 mb-3">{msg}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-toss-sub mb-1">
        <span className="text-toss-red">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-toss-blue">토</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const ds = `${period.key}-${String(d).padStart(2, "0")}`;
          const future = ds > today;
          const spent = map[ds] || 0;
          return (
            <div key={d}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${!future && !spent ? "bg-green-50" : "bg-toss-bg/70"} ${ds === today ? "ring-2 ring-toss-blue" : ""}`}>
              <span className={`text-[11px] num leading-none ${future ? "text-toss-muted" : "text-toss-sub"}`}>{d}</span>
              {!future && (spent > 0
                ? <span className="text-[11px] font-semibold text-toss-sub num leading-none">{compactKRW(spent)}</span>
                : <span className="text-base leading-none">🌱</span>)}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-toss-sub mt-2">자동 기록(통신비 등)은 무지출 계산에서 빼요</p>
    </Card>
  );
}
