import { todayStr, type PeriodInfo } from "../../lib/dates";
import { compactKRW } from "../../lib/format";
import type { Transaction } from "../../lib/types";
import { Card } from "../../ui/controls";
import { STAGES, sproutEmoji, stageOf } from "../fun/eggs";
import { countNoSpendDays, noSpendStreak, spentByDate, sproutRuns, type StreakRecord } from "./calc";

interface Props {
  period: PeriodInfo;
  txs: Transaction[];
  prevTxs: Transaction[];
  now: Date;
  /** 가계부에 처음 기록을 남긴 날. 이 날부터 무지출을 세요 (null = 아직 기록 없음) */
  start: string | null;
  /** 지금까지 최장 연속 무지출 */
  best: StreakRecord | null;
  /** 💣 강제 무지출 데이 (날짜 → 폭탄 긁은 사람) */
  forcedDays?: Record<string, string>;
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

/**
 * 무지출 챌린지: 기록이 없는 날 = 무지출, 쓴 날 = 금액.
 * 연속 무지출 하루마다 한 단계씩 자라서 8일째에 한강뷰 🌉
 */
export function NoSpendCard({ period, txs, prevTxs, now, start, best, forcedDays = {} }: Props) {
  if (period.state === "future") return null;
  const monthEnd = `${period.key}-${String(period.dim).padStart(2, "0")}`;
  if (period.state === "past" && (!start || start > monthEnd)) return null; // 가계부를 쓰기 전의 달

  const today = todayStr(now);
  const map = spentByDate(txs.concat(prevTxs));
  const count = countNoSpendDays(period, map, today, start);
  const runs = sproutRuns(period, map, today, start);
  const isCurrent = period.state === "current";
  const streak = isCurrent && start && !(map[today] > 0) ? noSpendStreak(map, now, period.key, start) : 0;
  const goal = STAGES.length;

  let msg: string;
  if (!start) msg = "첫 지출을 기록한 날부터 무지출을 세기 시작해요 🌱";
  else if (!isCurrent) msg = count > 0 ? `${period.m}월엔 무지출 ${count}일을 달성했어요 👏` : "이 달엔 무지출 날이 없었어요";
  else if (forcedDays[today] && map[today] > 0) msg = "💣 강제 무지출 데이였는데… 다음 폭탄 땐 꼭 버텨봐요";
  else if (forcedDays[today]) msg = "💣 오늘은 강제 무지출 데이! 오늘만 버티면 돼요";
  else if (map[today] > 0) msg = "오늘은 지출이 있었어요. 내일 새싹부터 다시 키워봐요 💪";
  else if (streak >= goal) msg = `${streak}일 연속 무지출! 드디어 한강뷰 입성 🌉`;
  else {
    const st = stageOf(streak);
    msg = streak >= 2 ? `${streak}일 연속 무지출! 지금은 ${st.emoji} ${st.name} 단계` : "오늘 하루 무지출 도전 중이에요 🌱";
  }
  const breakingRecord = isCurrent && best && streak > 0 && streak >= best.days && best.to === today;

  const firstDow = new Date(period.y, period.m - 1, 1).getDay();
  const days = Array.from({ length: period.dim }, (_, i) => i + 1);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-toss-text">무지출 챌린지 🌱</h2>
        {start && <span className="text-sm font-bold text-toss-green num">{period.m}월 무지출 {count}일</span>}
      </div>
      <p className="text-sm font-semibold text-toss-text mt-0.5">{msg}</p>

      {/* 최장 기록 */}
      {best && (
        <p className={`text-xs mt-1 num ${breakingRecord ? "font-bold text-toss-amber" : "text-toss-sub"}`}>
          {breakingRecord
            ? `🔥 지금 최장 기록 경신 중! (${best.days}일)`
            : `🏆 최장 기록 ${best.days}일 · ${md(best.from)}${best.from !== best.to ? `~${md(best.to)}` : ""}`}
        </p>
      )}

      {/* 한강뷰까지 15단계 */}
      {isCurrent && start && (
        <div className="mt-3 px-2 py-2 rounded-2xl bg-toss-bg/70">
          <div className="flex items-center justify-between">
            {STAGES.map((s, i) => (
              <span key={s.emoji} title={s.name}
                className={`text-xl leading-none transition ${i < streak ? "" : "opacity-25 grayscale"} ${i === Math.min(streak, goal) - 1 ? "scale-125" : ""}`}>
                {s.emoji}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-toss-sub text-center mt-1.5 num">
            {streak >= goal ? "한강뷰 도착! 이대로 쭉 가봐요" : `한강뷰까지 ${goal - streak}일 남았어요`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-toss-sub mb-1 mt-3">
        <span className="text-toss-red">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-toss-blue">토</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const ds = `${period.key}-${String(d).padStart(2, "0")}`;
          const future = ds > today;
          const before = !start || ds < start; // 가계부 쓰기 전
          const spent = map[ds] || 0;
          const run = runs[ds];
          return (
            <div key={d}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${run ? "bg-green-50" : before ? "bg-transparent" : "bg-toss-bg/70"} ${ds === today ? "ring-2 ring-toss-blue" : ""}`}>
              <span className={`text-[11px] num leading-none ${forcedDays[ds] ? "font-bold text-gray-800" : future || before ? "text-toss-muted" : "text-toss-sub"}`}>{forcedDays[ds] ? `💣${d}` : d}</span>
              {spent > 0 && !future
                ? <span className="text-[11px] font-semibold text-toss-sub num leading-none">{compactKRW(spent)}</span>
                : run ? <span className="text-base leading-none">{sproutEmoji(run)}</span> : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-toss-sub mt-3 leading-relaxed">
        기록이 없는 날은 무지출로 쳐요{start ? ` · ${md(start)}부터 세는 중` : ""}
        <br />자동 기록·회사 돈은 무지출 계산에서 빼요
      </p>
    </Card>
  );
}
