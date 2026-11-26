import { useEffect, useMemo, useState } from "react";
import { loadAllTransactions } from "../../data/db";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { formatDateHeader } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import { isRefund, type Transaction } from "../../lib/types";
import { Sheet } from "../../ui/Sheet";
import { searchTxs, summarizeSearch, yearsOf, type SearchKind, type SearchOptions, type SearchSpender } from "./calc";

export interface SearchState extends SearchOptions {
  query: string;
}

interface Props {
  initial: SearchState;
  now: Date;
  /** 기록을 누르면 수정 화면으로 (지금 검색 상태를 같이 넘겨서 닫으면 돌아와요) */
  onEdit: (tx: Transaction, state: SearchState) => void;
  onClose: () => void;
}

const SPENDERS: [SearchSpender, string][] = [["ALL", "모두"], ["태형", "태형"], ["경은", "경은"], ["공동", "공동"]];
const KINDS: [SearchKind, string][] = [["ALL", "전체"], ["HOUSEHOLD", "가계부"], ["COMPANY", "🏢 회사 돈"], ["REFUND", "↩️ 환불"]];
const PAGE = 40;

export function SearchSheet({ initial, now, onEdit, onClose }: Props) {
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<SearchState>(initial);
  const [limit, setLimit] = useState(PAGE);
  const set = <K extends keyof SearchState>(k: K, v: SearchState[K]) => { setState((s) => ({ ...s, [k]: v })); setLimit(PAGE); };

  useEffect(() => {
    let alive = true;
    loadAllTransactions()
      .then((list) => { if (alive) setAll(list); })
      .catch((err) => { console.warn("전체 검색 조회 참고:", err); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const years = useMemo(() => yearsOf(all || []), [all]);
  const hasFilter = state.query.trim() || state.year !== "ALL" || state.spender !== "ALL" || state.kind !== "ALL";
  const results = useMemo(() => (all && hasFilter ? searchTxs(all, state.query, state) : []), [all, state, hasFilter]);
  const sum = useMemo(() => summarizeSearch(results), [results]);

  // 달 묶음이 중간에 잘리지 않게
  const visible: typeof sum.months = [];
  let shown = 0;
  for (const m of sum.months) {
    if (visible.length && shown >= limit) break;
    visible.push(m);
    shown += m.items.length;
  }

  const chip = (on: boolean) => `shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${on ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`;
  const fmtDate = (d: string | null) => (d ? d.replace(/-/g, ".") : "");

  return (
    <Sheet title="🔎 전체 기간 검색" subtitle={all ? `전체 기록 ${all.length.toLocaleString("ko-KR")}건에서 찾아요` : "기록을 불러오는 중..."} onClose={onClose}>
      <div className="space-y-3">
        <input id="searchAllInput" autoFocus value={state.query} onChange={(e) => set("query", e.target.value)} enterKeyHint="search"
          placeholder="쿠팡, ㅋㅍ, 휴지, 12000, 1.2만…"
          className="w-full bg-toss-bg text-toss-text text-base rounded-xl px-3.5 py-3 outline-none focus:ring-2 focus:ring-toss-blue" />
        <p className="text-xs text-toss-sub -mt-1">사용처 · 품목 · 카테고리 · 금액으로 찾아요. 띄어 쓰면 모두 맞는 것만 (예: <b>이마트 휴지</b>)</p>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <button type="button" onClick={() => set("year", "ALL")} className={chip(state.year === "ALL")}>전체 기간</button>
          {years.map((y) => <button key={y} type="button" onClick={() => set("year", y)} className={chip(state.year === y)}>{y}년</button>)}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {SPENDERS.map(([k, l]) => <button key={k} type="button" onClick={() => set("spender", k)} className={chip(state.spender === k)}>{l}</button>)}
          <span className="w-px shrink-0 bg-toss-border mx-0.5" />
          {KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => set("kind", k)} className={chip(state.kind === k)}>{l}</button>)}
        </div>

        {failed && <div className="p-3.5 rounded-2xl bg-red-50 text-toss-red text-sm font-medium">기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>}

        {!all && !failed && <div className="py-10 text-center text-sm text-toss-sub">기록을 불러오는 중...</div>}

        {all && !hasFilter && (
          <div className="py-8 text-center">
            <p className="text-base font-bold text-toss-text">무엇을 찾아볼까요?</p>
            <p className="text-sm text-toss-sub mt-1">"작년에 에어컨 청소 얼마였지?" 같은 걸 찾을 때 좋아요</p>
          </div>
        )}

        {all && hasFilter && sum.count === 0 && (
          <div className="py-8 text-center">
            <p className="text-base font-bold text-toss-text">맞는 기록이 없어요</p>
            <p className="text-sm text-toss-sub mt-1">다른 낱말이나 초성으로 찾아보세요</p>
          </div>
        )}

        {sum.count > 0 && (
          <div id="searchSummary" className="p-4 rounded-2xl bg-toss-blueLight/70 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-toss-text">{sum.count.toLocaleString("ko-KR")}건</span>
              <span className="text-lg font-bold num text-toss-blue">{formatKRW(sum.household)}</span>
            </div>
            <div className="text-xs text-toss-sub num space-y-0.5">
              {sum.average > 0 && <p>한 번에 평균 {formatShort(sum.average)}{sum.months.length > 1 ? ` · 달마다 평균 ${formatShort(Math.round(sum.household / sum.months.length))}` : ""}</p>}
              {sum.refund > 0 && <p className="text-toss-green">환불 {formatShort(sum.refund)} 빼고 계산했어요</p>}
              {sum.company !== 0 && <p className="text-indigo-600">🏢 회사 돈 {formatShort(sum.company)} 별도</p>}
              {sum.first && <p>{sum.first === sum.last ? fmtDate(sum.first) : `${fmtDate(sum.first)} ~ ${fmtDate(sum.last)}`}</p>}
            </div>
          </div>
        )}

        {visible.map((m) => (
          <div key={m.ym} className="pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-toss-sub pb-1 border-b border-toss-border">
              <span>{m.ym.slice(0, 4)}년 {Number(m.ym.slice(5))}월 · {m.count}건</span>
              <span className="num">{formatKRW(m.total)}</span>
            </div>
            <div className="divide-y divide-toss-border/70">
              {m.items.map((tx) => {
                const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
                const refund = isRefund(tx);
                return (
                  <button key={tx.id} type="button" onClick={() => onEdit(tx, state)}
                    className="search-row w-full text-left py-2.5 px-2 -mx-2 flex items-center justify-between gap-3 rounded-xl hover:bg-toss-bg active:bg-toss-bg transition">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-toss-text truncate">{tx.memo || tx.items || cat.label}</p>
                      <p className="text-xs text-toss-sub truncate">
                        {formatDateHeader(tx.date, now)} · {normalizeSpender(tx.spender)} · {cat.short}
                        {tx.memo && tx.items ? ` · ${tx.items}` : ""}
                        {tx.company ? " · 🏢 회사" : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-bold num shrink-0 ${refund ? "text-toss-green" : tx.company ? "text-indigo-500" : "text-toss-text"}`}>
                      {refund ? "+" : "-"}{formatKRW(Math.abs(Number(tx.amount) || 0))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {shown < sum.count && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)}
            className="w-full py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub active:scale-[0.99] transition">
            {/* 누르면 보여줄 만큼만 숫자로 */}이전 기록 <span className="num">{Math.min(sum.count - shown, PAGE)}건</span> 더 보기
          </button>
        )}
      </div>
    </Sheet>
  );
}
