import { useEffect, useMemo, useState } from "react";
import { loadYearData } from "../../data/db";
import { CATEGORY_MAP, GROUPS, normalizeCategory, type Budget } from "../../lib/categories";
import { compactKRW, formatKRW, formatShort } from "../../lib/format";
import type { LotteryTicket, Transaction } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { buildYearReport, type YearReport } from "./calc";

interface Props {
  initialYear: number;
  now: Date;
  defaultBudget: Budget;
  noSpendStart: string | null;
  /** 기록이 있는 가장 이른 해 (이전 버튼 한계) */
  firstYear: number | null;
  onOpenMonth: (ym: string) => void;
  onClose: () => void;
}

type Loaded = { year: number; txs: Transaction[]; months: Record<string, Budget>; tickets: LotteryTicket[] };

export function YearSheet({ initialYear, now, defaultBudget, noSpendStart, firstYear, onOpenMonth, onClose }: Props) {
  const { toast } = useFeedback();
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const thisYear = now.getFullYear();

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadYearData(year)
      .then((d) => { if (alive) setData({ year, ...d }); })
      .catch((err) => { console.warn("연간 결산 조회 참고:", err); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [year]);

  const report = useMemo(() => {
    if (!data || data.year !== year) return null;
    // 월 예산이 따로 없으면 기본 예산 (앱 화면과 같은 규칙)
    const budgetOf = (ym: string) => (data.months[ym] ? { ...defaultBudget, ...data.months[ym] } : defaultBudget);
    return buildYearReport(year, data.txs, budgetOf, now, noSpendStart, data.tickets);
  }, [data, year, defaultBudget, now, noSpendStart]);

  const share = async () => {
    if (!report) return;
    const text = shareText(report);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast("결산을 복사했어요. 카톡에 붙여 넣어보세요 📋");
    } catch { /* 공유 취소 */ }
  };

  const nav = (label: string, d: string, onClick: () => void, disabled: boolean) => (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-full bg-toss-bg flex items-center justify-center text-toss-sub disabled:opacity-30 active:scale-95 transition">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
    </button>
  );

  return (
    <Sheet title={
      <span className="flex items-center gap-2">
        {nav("이전 해", "M15 19l-7-7 7-7", () => setYear((y) => y - 1), firstYear !== null && year <= firstYear)}
        <span className="num">{year}년 결산</span>
        {nav("다음 해", "M9 5l7 7-7 7", () => setYear((y) => y + 1), year >= thisYear)}
      </span>
    } subtitle={year === thisYear ? `${now.getMonth() + 1}월 ${now.getDate()}일까지 기준이에요` : undefined} onClose={onClose}
      footer={report && report.recordCount > 0 ? <button type="button" onClick={share} className="flex-1 py-3 rounded-2xl bg-toss-bg text-sm font-bold text-toss-sub active:scale-[0.99] transition">결산 공유하기</button> : undefined}>
      {failed && <div className="p-3.5 rounded-2xl bg-red-50 text-toss-red text-sm font-medium">불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>}
      {!report && !failed && <div className="py-16 text-center text-sm text-toss-sub">{year}년 기록을 모으는 중...</div>}
      {report && report.recordCount === 0 && (
        <div className="py-14 text-center">
          <p className="text-4xl">📭</p>
          <p className="text-base font-bold text-toss-text mt-2">{year}년에는 기록이 없어요</p>
        </div>
      )}
      {report && report.recordCount > 0 && <ReportBody r={report} onOpenMonth={onOpenMonth} />}
    </Sheet>
  );
}

function ReportBody({ r, onOpenMonth }: { r: YearReport; onOpenMonth: (ym: string) => void }) {
  // 예산선은 기록이 있는 달만 (앱을 쓰기 전 달까지 기본 예산이 깔리지 않게)
  const max = Math.max(1, ...r.months.map((m) => Math.max(m.spent, m.hasData ? m.budget : 0)));
  return (
    <div id="yearReport" className="space-y-5">
      {/* 머리말 */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-toss-blue to-indigo-500 text-white">
        <p className="text-sm font-bold opacity-90">{r.headline}</p>
        {r.savings && r.savings.saved > 0 ? (
          <>
            <p className="text-3xl font-bold num mt-2">{formatKRW(r.savings.saved)}</p>
            <p className="text-sm opacity-90 mt-1">끝난 {r.savings.months}개월 동안 모았어요 · 계획 {formatShort(r.savings.planned)}</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold num mt-2">{formatKRW(r.total)}</p>
            <p className="text-sm opacity-90 mt-1">올해 쓴 변동지출이에요</p>
          </>
        )}
        <p className="text-xs opacity-80 mt-3 num">기록 {r.recordCount.toLocaleString("ko-KR")}건 · 변동지출 {formatShort(r.total)}</p>
      </div>

      {/* 숫자 4개 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="월 평균 지출" value={r.monthlyAverage !== null ? formatShort(r.monthlyAverage) : "-"} sub={r.monthlyAverage !== null ? "끝난 달 기준" : "아직 끝난 달이 없어요"} />
        <Tile label="예산 지킨 달" value={r.budgetKept.of ? `${r.budgetKept.kept} / ${r.budgetKept.of}달` : "-"} sub={r.budgetKept.of ? (r.budgetKept.kept === r.budgetKept.of ? "전부 지켰어요 🏅" : "변동지출 예산 기준") : "예산을 정한 달이 없어요"} />
        <Tile label="무지출" value={r.noSpendOf ? `${r.noSpendDays}일 🌱` : "-"} sub={r.noSpendOf ? `${r.noSpendOf}일 중 ${Math.round((r.noSpendDays / r.noSpendOf) * 100)}%` : ""} />
        <Tile label="오늘의 복권" value={r.lottery.total ? `1등 ${r.lottery.jackpot}번` : "-"} sub={r.lottery.total ? `${r.lottery.total}장 긁음 · 💣 ${r.lottery.bomb}번 · 💗 ${r.lottery.love}번` : "긁은 복권이 없어요"} />
      </div>

      {/* 달별 막대 */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-base font-bold text-toss-text">달마다 쓴 돈</h4>
          <span className="text-xs text-toss-sub">막대를 누르면 그 달로 가요</span>
        </div>
        <div className="relative h-40 flex items-end gap-1">
          {r.months.map((m) => {
            const isMax = r.maxMonth?.ym === m.ym, isMin = r.minMonth?.ym === m.ym;
            const over = m.budget > 0 && m.spent > m.budget && !m.open;
            return (
              <button key={m.ym} type="button" onClick={() => m.hasData && onOpenMonth(m.ym)} disabled={!m.hasData}
                className="year-bar relative flex-1 flex flex-col items-center justify-end h-full">
                <span className={`text-[10px] num mb-1 leading-none ${isMax ? "font-bold text-toss-red" : isMin ? "font-bold text-toss-green" : "text-toss-sub"}`}>
                  {m.hasData ? compactKRW(Math.max(0, m.spent)) : ""}
                </span>
                <div className="relative w-full flex justify-center" style={{ height: `calc((100% - 30px) * ${(Math.max(0, m.spent) / max).toFixed(4)})`, minHeight: m.hasData ? 4 : 2 }}>
                  <div className={`w-full max-w-7 h-full rounded-t-md ${over ? "bg-toss-red/80" : m.open ? "bg-toss-blue/40" : "bg-toss-blue"}`} />
                </div>
                {m.hasData && m.budget > 0 && (
                  <span className="absolute left-0.5 right-0.5 border-t-2 border-dashed border-toss-amber/70 pointer-events-none"
                    style={{ bottom: `calc((100% - 30px) * ${(m.budget / max).toFixed(4)} + 20px)` }} />
                )}
                <span className="block h-5 pt-1.5 text-[11px] leading-none text-toss-sub">{m.m}월</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-toss-sub mt-2">
          {r.maxMonth && <>가장 많이 쓴 달 <b className="text-toss-red">{r.maxMonth.m}월 {formatShort(r.maxMonth.spent)}</b></>}
          {r.minMonth && <> · 가장 적게 쓴 달 <b className="text-toss-green">{r.minMonth.m}월 {formatShort(r.minMonth.spent)}</b></>}
        </p>
        <p className="text-[11px] text-toss-muted mt-0.5"><span className="inline-block w-3 border-t-2 border-dashed border-toss-amber/70 align-middle" /> 그 달 예산 · 빨간 막대 = 예산 초과</p>
      </section>

      {/* 카테고리 */}
      {r.categories.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-toss-text mb-2.5">어디에 썼나요</h4>
          <div className="space-y-2.5">
            {r.categories.map(({ cat, total, share }, i) => {
              const g = GROUPS.find((x) => x.key === cat.group);
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="font-semibold text-toss-text truncate min-w-0">
                      <span className="text-toss-sub num mr-1.5">{i + 1}</span>{cat.label}
                      {g && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle ${g.badge}`}>{g.shortLabel}</span>}
                    </span>
                    <span className="font-bold num shrink-0 text-toss-text">{formatShort(total)} <span className="text-xs text-toss-sub font-medium">{share.toFixed(0)}%</span></span>
                  </div>
                  <div className="h-2 bg-toss-bg rounded-full overflow-hidden"><div className="h-full bg-toss-blue rounded-full" style={{ width: `${Math.min(100, share)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 누가 */}
      {r.spenders.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-toss-text mb-2.5">누가 얼마나</h4>
          <div className="flex h-3 rounded-full overflow-hidden bg-toss-bg">
            {r.spenders.map((s) => <div key={s.name} className={SP_COLOR[s.name] || "bg-gray-300"} style={{ width: `${s.share}%` }} />)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {r.spenders.map((s) => (
              <span key={s.name} className="text-sm text-toss-sub flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${SP_COLOR[s.name] || "bg-gray-300"}`} />{s.name} <b className="text-toss-text num">{formatShort(s.total)}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 단골 */}
      {r.places.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-toss-text mb-2">올해의 단골</h4>
          <div className="divide-y divide-toss-border/70">
            {r.places.map((p, i) => (
              <div key={p.memo} className="flex items-center justify-between py-2 gap-2">
                <span className="text-sm font-semibold text-toss-text truncate">{["🥇", "🥈", "🥉", "4", "5"][i]} {p.memo}</span>
                <span className="text-sm num text-toss-sub shrink-0"><b className="text-toss-text">{p.count}번</b> · {formatShort(p.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 큰 지출 */}
      {r.biggest.length > 0 && (
        <section>
          <h4 className="text-base font-bold text-toss-text mb-2">가장 큰 지출</h4>
          <div className="divide-y divide-toss-border/70">
            {r.biggest.map((t) => (
              <button key={t.id} type="button" onClick={() => onOpenMonth(t.date.slice(0, 7))} className="w-full flex items-center justify-between py-2 gap-2 text-left">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-toss-text truncate">{t.memo || t.items || CATEGORY_MAP[normalizeCategory(t.category)].label}</span>
                  <span className="block text-xs text-toss-sub">{Number(t.date.slice(5, 7))}월 {Number(t.date.slice(8))}일 · {CATEGORY_MAP[normalizeCategory(t.category)].short}</span>
                </span>
                <span className="text-sm font-bold num text-toss-text shrink-0">{formatKRW(t.amount)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 그 밖에 */}
      {(r.refund.count > 0 || r.company.count > 0) && (
        <section className="p-4 rounded-2xl bg-toss-bg space-y-1.5 text-sm">
          {r.refund.count > 0 && <p className="flex justify-between"><span className="text-toss-sub">↩️ 환불 · 취소로 돌려받은 돈</span><b className="num text-toss-green">{formatShort(r.refund.total)} · {r.refund.count}건</b></p>}
          {r.company.count > 0 && <p className="flex justify-between"><span className="text-toss-sub">🏢 회사 돈 (가계부 제외)</span><b className="num text-indigo-600">{formatShort(r.company.total)} · {r.company.count}건</b></p>}
        </section>
      )}
    </div>
  );
}

const SP_COLOR: Record<string, string> = { 태형: "bg-toss-blue", 경은: "bg-rose-400", 공동: "bg-gray-400" };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-3.5 rounded-2xl bg-toss-bg">
      <p className="text-xs font-semibold text-toss-sub">{label}</p>
      <p className="text-lg font-bold num text-toss-text mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-toss-sub mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

export function shareText(r: YearReport): string {
  const lines = [`[${r.year}년 우리 가계부 결산 ${r.headline.split(" ")[0]}]`];
  if (r.savings && r.savings.saved > 0) lines.push(`함께 모은 돈 ${formatShort(r.savings.saved)} (계획 ${formatShort(r.savings.planned)})`);
  lines.push(`변동지출 ${formatShort(r.total)}${r.monthlyAverage !== null ? ` · 월 평균 ${formatShort(r.monthlyAverage)}` : ""}`);
  if (r.categories[0]) lines.push(`제일 많이 쓴 곳: ${r.categories[0].cat.label}`);
  if (r.places[0]) lines.push(`올해의 단골: ${r.places[0].memo} (${r.places[0].count}번)`);
  if (r.noSpendOf) lines.push(`무지출 ${r.noSpendDays}일 🌱`);
  if (r.lottery.jackpot) lines.push(`복권 1등 ${r.lottery.jackpot}번 🍗`);
  lines.push("- 태형이와 경은이의 부자 되기 프로젝트");
  return lines.join("\n");
}
