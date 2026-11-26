import { useMemo, useState } from "react";
import type { PeriodInfo } from "../../lib/dates";
import { compactKRW, formatKRW, formatShort } from "../../lib/format";
import { store } from "../../lib/storage";
import type { Transaction } from "../../lib/types";
import { Card, Segmented } from "../../ui/controls";
import { sumByCategory, sumUsage } from "../budget/calc";
import { averageOf, buildDayBars, buildMonthBars, buildWeekBars, monthToBar, type Bar } from "./calc";

interface Props {
  period: PeriodInfo;
  spentSoFar: number;
  prevTxs: Transaction[];
  /** 보고 있는 달 (YYYY-MM) */
  ym: string;
  /** 보고 있는 달 기록 (회사 돈 뺀 것) */
  txs: Transaction[];
  /** 보고 있는 달 이전 최대 11개월 기록 (회사 돈 뺀 것) */
  recentTxs: Transaction[];
  /** 오늘 (YYYY-MM-DD) */
  today: string;
}

/** 지난달 오늘과 비교 + 일별 · 주별 · 월별 지출 막대 */
export function TrendCard({ period, spentSoFar, prevTxs, ym, txs, recentTxs, today }: Props) {
  if (period.state === "future") return null;
  const isCurrent = period.state === "current";
  const prevSoFar = sumUsage(sumByCategory(prevTxs, isCurrent ? period.day : null));
  const diff = spentSoFar - prevSoFar;
  const hasPrev = prevTxs.length > 0;
  const scope = isCurrent ? "지난달 오늘" : "지난달";

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

      {/* 2) 일별 · 주별 · 월별 막대 */}
      <SpendChart ym={ym} txs={txs} recentTxs={recentTxs} today={today} />
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

type Mode = "day" | "week" | "month";
const MODE_KEY = "trendMode";
const MONTHS_KEY = "trendMonths";

/** 막대 그래프: 일별(그달 날짜) · 주별(그달 주) · 월별(3 · 6 · 12개월). 막대를 누르면 자세히 */
function SpendChart({ ym, txs, recentTxs, today }: { ym: string; txs: Transaction[]; recentTxs: Transaction[]; today: string }) {
  const [mode, setModeState] = useState<Mode>(() => (["day", "week", "month"].includes(store.get(MODE_KEY, "month")) ? store.get(MODE_KEY, "month") as Mode : "month"));
  const [months, setMonthsState] = useState(() => [3, 6, 12].includes(Number(store.get(MONTHS_KEY, "6"))) ? Number(store.get(MONTHS_KEY, "6")) : 6);
  const [picked, setPicked] = useState<string | null>(null);
  const setMode = (m: Mode) => { setModeState(m); store.set(MODE_KEY, m); setPicked(null); };
  const setMonths = (n: number) => { setMonthsState(n); store.set(MONTHS_KEY, String(n)); setPicked(null); };

  const bars: Bar[] = useMemo(() => {
    if (mode === "day") return buildDayBars(ym, txs, today);
    if (mode === "week") return buildWeekBars(ym, txs, today);
    return buildMonthBars(ym, months, recentTxs, txs, today.slice(0, 7)).map(monthToBar);
  }, [mode, months, ym, txs, recentTxs, today]);

  // 평균: 끝난 날 · 주 · 달만 (월별은 기록이 있는 달만)
  const avg = useMemo(() => {
    if (mode === "month") return averageOf(bars.map((b) => ({ ym: b.key, m: 0, total: b.total, inProgress: b.inProgress, hasData: b.count > 0 })));
    const done = bars.filter((b) => !b.future && !b.inProgress);
    return done.length ? Math.round(done.reduce((s, b) => s + b.total, 0) / done.length) : null;
  }, [bars, mode]);
  const max = Math.max(1, avg || 0, ...bars.map((b) => b.total));

  // 기본으로 고른 막대: 월별 = 보고 있는 달, 일별·주별 = 오늘(이 달이 아니면 마지막)
  const fallback = mode === "month" ? bars[bars.length - 1] : bars.find((b) => b.inProgress) || [...bars].reverse().find((b) => !b.future) || bars[bars.length - 1];
  const sel = bars.find((b) => b.key === picked) || fallback;
  const dense = bars.length > 7; // 막대가 많으면 금액은 고른 막대만
  const unit = mode === "day" ? "하루" : mode === "week" ? "주" : "월";
  const showLabel = (i: number) => mode !== "day" || i === 0 || (i + 1) % 5 === 0 || i === bars.length - 1;

  return (
    <div className="mt-5 pt-4 border-t border-toss-border">
      <div className="flex items-center justify-between gap-2 mb-3">
        <Segmented options={[["day", "일별"], ["week", "주별"], ["month", "월별"]]} value={mode} onChange={setMode} />
        {mode === "month" && (
          <Segmented options={[["3", "3개월"], ["6", "6개월"], ["12", "1년"]]} value={String(months)} onChange={(v) => setMonths(Number(v))} />
        )}
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-bold text-toss-text">{mode === "month" ? `최근 ${months === 12 ? "1년" : `${months}개월`}` : `${Number(ym.slice(5))}월 ${mode === "day" ? "날짜별" : "주별"}`}</span>
        {avg !== null && <span className="text-xs text-toss-sub num">{unit} 평균 <b className="text-toss-text">{formatShort(avg)}</b></span>}
      </div>
      <div className="relative h-36">
        {avg !== null && avg > 0 && (
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-toss-amber/70 z-10 pointer-events-none" style={{ bottom: `calc((100% - 20px) * ${((avg / max) * 0.78).toFixed(4)} + 20px)` }}>
            <span className="absolute -top-2.5 -left-1 text-[11px] font-bold text-toss-amber bg-white px-1 rounded leading-5">평균</span>
          </div>
        )}
        <div className={`absolute inset-0 flex items-end ${mode === "day" ? "gap-[2px]" : "gap-2"}`}>
          {bars.map((b, i) => {
            const on = b.key === sel.key;
            const has = b.count > 0;
            return (
              <button key={b.key} type="button" onClick={() => setPicked(b.key)} disabled={b.future}
                aria-label={`${b.title} ${formatKRW(b.total)}`}
                className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                {!dense && (
                  <span className={`text-[11px] num mb-1 leading-none ${on ? "font-bold text-toss-blue" : "text-toss-sub"}`}>{has ? compactKRW(b.total) : "-"}</span>
                )}
                <div className={`w-full ${mode === "day" ? "max-w-3 rounded-t" : "max-w-9 rounded-t-lg"} progress-fill ${on ? "bg-toss-blue" : b.future ? "bg-toss-border/60" : "bg-toss-blue/25"} ${b.inProgress && on ? "opacity-70" : ""}`}
                  style={{ height: `calc((100% - 20px) * ${((Math.max(0, b.total) / max) * 0.78).toFixed(4)})`, minHeight: has ? 4 : 2 }} />
                <span className={`block h-5 pt-1.5 text-[11px] leading-none whitespace-nowrap ${on ? "font-bold text-toss-text" : "text-toss-sub"}`}>{showLabel(i) ? b.label : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-toss-sub mt-3 num">
        <b className="text-toss-text">{sel.title}</b>{" "}
        {sel.future ? "아직이에요" : sel.count > 0
          ? <>{formatKRW(sel.total)}{mode !== "month" && ` · ${sel.count}건`}
              {avg ? (sel.inProgress ? ` · 지금까지 평균의 ${Math.round((sel.total / avg) * 100)}%`
                : sel.total <= avg ? ` · 평균보다 ${formatShort(avg - sel.total)} 적게 👏` : ` · 평균보다 ${formatShort(sel.total - avg)} 많이`) : ""}</>
          : mode === "month" ? "기록이 없어요" : "무지출 🌱"}
      </p>
      <p className="text-xs text-toss-muted mt-1">막대를 누르면 자세히 볼 수 있어요 · 자동 기록을 포함한 변동지출 기준이에요</p>
    </div>
  );
}
