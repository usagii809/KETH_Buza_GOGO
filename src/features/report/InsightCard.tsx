import { useState } from "react";
import { formatShort } from "../../lib/format";
import type { Insights } from "./insights";

const TONE = { good: "bg-green-50 text-toss-green", bad: "bg-red-50 text-toss-red", info: "bg-toss-bg text-toss-sub" };
const ICON = { good: "👏", bad: "👀", info: "💡" };

/**
 * 📊 카테고리 비교: 최근 몇 달 평균과 이번 달을 나란히
 * embedded: 성적표 카드 안에 들어갈 때 (카드 모양 없이)
 */
export function InsightCard({ data, embedded }: { data: Insights; embedded?: boolean }) {
  const [open, setOpen] = useState(!embedded);
  const base = data.months === 1 ? "지난달" : `최근 ${data.months}개월 평균`;
  const max = Math.max(1, ...data.rows.map((r) => Math.max(r.cur, r.avg)));
  const totalPct = data.avgTotal > 0 ? Math.round(((data.curTotal - data.avgTotal) / data.avgTotal) * 100) : null;

  const body = (
    <>
      <div className="space-y-1.5">
        {data.lines.map((l) => (
          <p key={l.text} className={`insight-line px-3 py-2 rounded-xl text-sm font-semibold leading-snug ${TONE[l.tone]}`}>{ICON[l.tone]} {l.text}</p>
        ))}
      </div>

      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-3 text-xs font-bold text-toss-sub">
        카테고리별로 자세히 {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <div className="flex items-center gap-3 text-[11px] text-toss-sub">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-toss-blue" />{data.cutoffDay ? "이번 달" : "이 달"}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-300" />{base}</span>
          </div>
          {data.rows.map((r) => (
            <div key={r.cat.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-toss-text truncate">{r.cat.short}</span>
                <span className="num shrink-0 ml-2">
                  <b className="text-toss-text">{formatShort(r.cur)}</b>
                  <span className="text-toss-sub"> / {formatShort(r.avg)}</span>
                  {r.pct !== null && r.pct !== 0 && (
                    <b className={`ml-1.5 ${r.pct > 0 ? "text-toss-red" : "text-toss-green"}`}>{r.pct > 0 ? "▲" : "▼"}{Math.abs(r.pct)}%</b>
                  )}
                  {r.pct === null && r.cur > 0 && <b className="ml-1.5 text-toss-sub">NEW</b>}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="h-1.5 rounded-full bg-toss-blue" style={{ width: `${(r.cur / max) * 100}%` }} />
                <div className="h-1.5 rounded-full bg-gray-300" style={{ width: `${(r.avg / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const header = (
    <div className="flex items-end justify-between mb-2.5 gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-toss-text">📊 카테고리 비교</h2>
        <p className="text-xs text-toss-sub">{base}과 비교{data.cutoffDay ? ` · 매달 ${data.cutoffDay}일까지 쓴 돈끼리` : ""}</p>
      </div>
      {totalPct !== null && (
        <span className={`shrink-0 text-sm font-bold num ${totalPct > 0 ? "text-toss-red" : "text-toss-green"}`}>
          전체 {totalPct > 0 ? "▲" : "▼"}{Math.abs(totalPct)}%
        </span>
      )}
    </div>
  );

  if (embedded) return <div className="mt-4 pt-3 border-t border-toss-border">{header}{body}</div>;
  return <section className="insight-card bg-white rounded-3xl p-5 shadow-sm mb-4">{header}{body}</section>;
}
