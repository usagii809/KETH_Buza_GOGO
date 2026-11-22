import type { PeriodInfo } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import { Card } from "../../ui/controls";
import type { Summary } from "./calc";

const CIRC = 2 * Math.PI * 38;

/** 도넛: 저축 + 변동지출 + 고정지출 = 월수입 */
function Donut({ s }: { s: Summary }) {
  const sav = Math.max(0, s.projectedSavings);
  const liv = Math.max(0, s.projectedVariable);
  const fix = Math.max(0, s.fixedTotal);
  const base = Math.max(s.income, sav + liv + fix);
  const len = (v: number) => (base > 0 ? (v / base) * CIRC : 0);
  const segs = [
    { color: "#3182F6", len: len(sav), offset: 0 },
    { color: s.livingHex, len: len(liv), offset: -len(sav) },
    { color: "#8B95A1", len: len(fix), offset: -(len(sav) + len(liv)) }
  ];
  return (
    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-label="월수입 배분 원형 그래프">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#F2F4F6" strokeWidth="11" />
        {segs.map((g, i) => (
          <circle key={i} cx="50" cy="50" r="38" fill="none" stroke={g.color} strokeWidth="11"
            strokeDasharray={`${g.len} ${CIRC}`} strokeDashoffset={g.offset} className="donut-segment" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xs font-medium text-toss-sub leading-none">저축률</span>
        <span className={`text-base font-bold num mt-1 ${s.projectedSavings >= 0 ? "text-toss-text" : "text-toss-red"}`}>{s.savingsRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function gapMessage(s: Summary, period: PeriodInfo): { text: string; cls: string } {
  if (s.income === 0) return { text: "", cls: "" };
  if (s.gap < 0) {
    return {
      text: period.state === "past" ? `계획보다 ${formatShort(-s.gap)} 덜 모았어요` : `예산을 넘겨서 계획보다 ${formatShort(-s.gap)} 덜 모일 것 같아요`,
      cls: "font-semibold text-toss-red"
    };
  }
  if (s.gap > 0) return { text: `계획보다 ${formatShort(s.gap)} 더 모았어요 🎉`, cls: "font-semibold text-toss-green" };
  return { text: period.state === "past" ? "계획한 만큼 딱 모았어요 👏" : "계획대로 가는 중 · 아낀 만큼 더 쌓여요", cls: "font-medium text-toss-sub" };
}

export function SavingsCard({ s, period, onEditBudget }: { s: Summary; period: PeriodInfo; onEditBudget: () => void }) {
  const empty = s.income === 0 && s.fixedTotal === 0 && s.totalVariableBudget === 0;
  const gap = gapMessage(s, period);
  return (
    <Card>
      {empty && (
        <button type="button" onClick={onEditBudget} className="w-full text-left mb-4 p-4 rounded-2xl bg-toss-blueLight active:scale-[0.99] transition">
          <p className="text-base font-bold text-toss-text">먼저 이번 달 예산부터 정해볼까요?</p>
          <p className="text-sm text-toss-sub mt-0.5">수입과 예산만 알려주면 저축 계획을 세워드려요 <span className="text-toss-blue font-bold">→</span></p>
        </button>
      )}

      <div className="flex items-center gap-4">
        <Donut s={s} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-toss-sub">{period.state === "past" ? `${period.m}월에 모은 돈` : `${period.m}월 예상 저축액`}</p>
            <button type="button" onClick={onEditBudget}
              className="text-xs font-semibold text-toss-sub bg-toss-bg hover:bg-gray-200/70 px-2.5 py-1.5 rounded-xl active:scale-95 transition shrink-0 -mt-1">
              예산 설정
            </button>
          </div>
          <p className={`text-2xl font-bold num mt-0.5 truncate ${s.projectedSavings >= 0 ? "text-toss-blue" : "text-toss-red"}`}>{formatKRW(s.projectedSavings)}</p>
          {gap.text && <p className={`text-xs mt-1 leading-snug ${gap.cls}`}>{gap.text}</p>}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-toss-border space-y-1.5">
        <LegendRow color="#3182F6" label="저축" value={s.projectedSavings} />
        <LegendRow color={s.livingHex} label="변동지출" value={s.projectedVariable}
          extra={period.state === "past" ? "" : `${formatShort(s.totalVariableSpent)} 씀`} />
        <LegendRow color="#8B95A1" label="고정지출" value={s.fixedTotal} />
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-toss-border">
          <span className="text-toss-sub font-medium">월수입 (세후)</span>
          <span className="font-semibold text-toss-sub num">{formatKRW(s.income)}</span>
        </div>
      </div>
    </Card>
  );
}

function LegendRow({ color, label, value, extra }: { color: string; label: string; value: number; extra?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-toss-sub font-medium">
        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
        {label}
        {extra && <span className="text-xs text-toss-sub font-normal num">{extra}</span>}
      </span>
      <span className="font-bold text-toss-text num">{formatKRW(value)}</span>
    </div>
  );
}
