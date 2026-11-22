import type { PeriodInfo } from "../../lib/dates";
import { compactKRW, formatKRW, formatShort } from "../../lib/format";
import type { Transaction } from "../../lib/types";
import { Card } from "../../ui/controls";
import { sumByCategory, sumUsage } from "../budget/calc";
import { averageOf, type MonthBar } from "./calc";

interface Props {
  period: PeriodInfo;
  spentSoFar: number;
  prevTxs: Transaction[];
  bars: MonthBar[];
}

/** 지난달 오늘과 비교 + 최근 6개월 지출 막대 */
export function TrendCard({ period, spentSoFar, prevTxs, bars }: Props) {
  if (period.state === "future") return null;
  const isCurrent = period.state === "current";
  const prevSoFar = sumUsage(sumByCategory(prevTxs, isCurrent ? period.day : null));
  const diff = spentSoFar - prevSoFar;
  const hasPrev = prevTxs.length > 0;
  const scope = isCurrent ? "지난달 오늘" : "지난달";

  const avg = averageOf(bars);
  const max = Math.max(1, avg || 0, ...bars.map((b) => b.total));
  const viewed = bars[bars.length - 1];

  return (
    <Card>
      <h2 className="text-base font-bold text-toss-text">지출 흐름</h2>

      {/* 1) 지난달 오늘과 비교 */}
      {hasPrev ? (
        <>
          <p className={`text-lg font-bold mt-1 leading-snug ${diff < 0 ? "text-toss-green" : diff > 0 ? "text-toss-red" : "text-toss-text"}`}>
            {diff < 0 ? `${scope}보다 ${formatShort(-diff)} 적게 썼어요 👍` : diff > 0 ? `${scope}보다 ${formatShort(diff)} 많이 썼어요 💸` : `${scope}랑 똑같이 썼어요`}
          </p>
          <div className="mt-3 space-y-2">
            <CompareRow label={isCurrent ? `${period.m}월 오늘까지` : `${period.m}월`} value={spentSoFar} max={Math.max(spentSoFar, prevSoFar, 1)} cls="bg-toss-blue" />
            <CompareRow label={isCurrent ? `지난달 ${period.day}일까지` : "지난달"} value={prevSoFar} max={Math.max(spentSoFar, prevSoFar, 1)} cls="bg-toss-muted/60" />
          </div>
        </>
      ) : (
        <p className="text-sm text-toss-sub mt-1">지난달 기록이 쌓이면 오늘까지 쓴 돈을 비교해 드려요</p>
      )}

      {/* 2) 월별 막대 */}
      <div className="mt-5 pt-4 border-t border-toss-border">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm font-bold text-toss-text">최근 6개월</span>
          {avg !== null && <span className="text-xs text-toss-sub num">월 평균 <b className="text-toss-text">{formatShort(avg)}</b></span>}
        </div>
        <div className="relative h-36">
          {avg !== null && (
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-toss-amber/70 z-10 pointer-events-none" style={{ bottom: `calc((100% - 20px) * ${((avg / max) * 0.78).toFixed(4)} + 20px)` }}>
              <span className="absolute -top-2.5 -left-1 text-[11px] font-bold text-toss-amber bg-white px-1 rounded leading-5">평균</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-end gap-2">
            {bars.map((b) => {
              const isViewed = b.ym === viewed.ym;
              return (
                <div key={b.ym} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className={`text-[11px] num mb-1 leading-none ${isViewed ? "font-bold text-toss-blue" : "text-toss-sub"}`}>
                    {b.hasData ? compactKRW(b.total) : "-"}
                  </span>
                  <div className={`w-full max-w-9 rounded-t-lg progress-fill ${isViewed ? "bg-toss-blue" : "bg-toss-blue/25"} ${b.inProgress && isViewed ? "opacity-70" : ""}`}
                    style={{ height: `calc((100% - 20px) * ${((b.total / max) * 0.78).toFixed(4)})`, minHeight: b.hasData ? 4 : 2 }} />
                  <span className={`block h-5 pt-1.5 text-xs leading-none ${isViewed ? "font-bold text-toss-text" : "text-toss-sub"}`}>{b.m}월</span>
                </div>
              );
            })}
          </div>
        </div>
        {avg !== null && viewed.hasData && (
          <p className="text-xs text-toss-sub mt-3">
            {viewed.inProgress
              ? `이번 달은 지금까지 ${formatShort(viewed.total)} 썼어요 (평균의 ${Math.round((viewed.total / avg) * 100)}%)`
              : viewed.total <= avg
                ? `${viewed.m}월은 평균보다 ${formatShort(avg - viewed.total)} 적게 썼어요 👏`
                : `${viewed.m}월은 평균보다 ${formatShort(viewed.total - avg)} 많이 썼어요`}
          </p>
        )}
        <p className="text-xs text-toss-muted mt-1">자동 기록을 포함한 변동지출 기준이에요</p>
      </div>
    </Card>
  );
}

function CompareRow({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-toss-sub">{label}</span>
      <div className="flex-1 h-3 bg-toss-bg rounded-full overflow-hidden">
        <div className={`h-full rounded-full progress-fill ${cls}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-sm font-bold num text-toss-text">{formatKRW(value)}</span>
    </div>
  );
}
