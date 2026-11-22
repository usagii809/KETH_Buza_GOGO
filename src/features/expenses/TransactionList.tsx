import { useState } from "react";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { downloadCsv } from "../../lib/csv";
import { formatDateHeader } from "../../lib/dates";
import { formatKRW, formatShort } from "../../lib/format";
import type { Spender, Transaction } from "../../lib/types";
import { Card } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { FILTERS, matchTx, type FilterKey } from "./filters";

const SPENDER_BADGE: Record<Spender, string> = {
  태형: "bg-blue-50 text-toss-blue",
  경은: "bg-rose-50 text-rose-600",
  공동: "bg-gray-100 text-toss-sub"
};
const sum = (list: Transaction[]) => list.reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

export function TransactionList({ txs, ym, now, onEdit }: { txs: Transaction[]; ym: string; now: Date; onEdit: (tx: Transaction) => void }) {
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = txs.filter((tx) => matchTx(tx, filter, query));
  const household = filtered.filter((tx) => !tx.company);
  const company = filtered.filter((tx) => tx.company);

  // 날짜별 묶음 (이미 최신순 정렬)
  const groups: { date: string; items: Transaction[] }[] = [];
  filtered.forEach((tx) => {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  });

  const exportCompany = () => {
    const rows = [...company].sort((a, b) => a.date.localeCompare(b.date)).map((tx) => [
      tx.date, tx.memo || "", tx.items || "", CATEGORY_MAP[normalizeCategory(tx.category)].label, Number(tx.amount) || 0
    ]);
    rows.push(["합계", "", "", "", sum(company)]);
    downloadCsv(`영업활동비_${ym}.csv`, ["날짜", "사용처", "내용", "카테고리", "금액"], rows);
    toast("영업활동비 파일을 저장했어요");
  };

  let summary: string;
  if (filter === "COMPANY") summary = `${company.length}건 · 영업활동비 ${formatKRW(sum(company))}`;
  else {
    summary = `${filtered.length}건 · ${formatKRW(sum(household))}`;
    if (company.length) summary += ` · 회사 돈 ${formatShort(sum(company))} 별도`;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-toss-text">지출 내역</h2>
          <p className="text-xs text-toss-sub mt-0.5 num truncate">{summary}</p>
        </div>
        <button type="button" onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(""); }} aria-label="검색"
          className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition ${searchOpen ? "bg-toss-blueLight text-toss-blue" : "bg-toss-bg text-toss-sub"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M20 20l-3.5-3.5" /></svg>
        </button>
      </div>

      {searchOpen && (
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="쿠팡, 휴지처럼 사용처·품목으로 찾기"
          className="w-full mb-2 bg-toss-bg text-toss-text text-base rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue" />
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-1">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)}
            className={`filter-chip shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${filter === key ? (key === "COMPANY" ? "bg-indigo-500 text-white" : "bg-toss-blue text-white") : "bg-toss-bg text-toss-sub"}`}>
            {label}
          </button>
        ))}
      </div>

      {filter === "COMPANY" && company.length > 0 && (
        <button type="button" onClick={exportCompany}
          className="w-full mb-2 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold active:scale-[0.99] transition">
          📄 이번 달 영업활동비 엑셀로 받기
        </button>
      )}

      {groups.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-base font-bold text-toss-text">{txs.length ? "조건에 맞는 기록이 없어요" : "아직 기록이 없어요"}</p>
          <p className="text-sm text-toss-sub mt-1">{txs.length ? "다른 필터나 검색어로 찾아보세요" : "아래 버튼으로 첫 지출을 남겨보세요"}</p>
        </div>
      ) : groups.map((g) => {
        const dayHousehold = sum(g.items.filter((tx) => !tx.company));
        const dayCompany = sum(g.items.filter((tx) => tx.company));
        return (
          <div key={g.date} className="pt-4 first:pt-0">
            <div className="flex items-center justify-between text-xs font-semibold text-toss-sub pb-1 border-b border-toss-border">
              <span>{formatDateHeader(g.date, now)}</span>
              <span className="num">
                {dayHousehold > 0 && `-${formatKRW(dayHousehold)}`}
                {dayHousehold > 0 && dayCompany > 0 && " · "}
                {dayCompany > 0 && <span className="text-indigo-600">🏢 {formatKRW(dayCompany)}</span>}
              </span>
            </div>
            <div className="divide-y divide-toss-border/70">
              {g.items.map((tx) => {
                const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
                const sp = normalizeSpender(tx.spender);
                return (
                  <button key={tx.id} type="button" onClick={() => onEdit(tx)}
                    className="tx-row w-full text-left py-3 px-2 -mx-2 flex items-center justify-between gap-3 rounded-xl hover:bg-toss-bg active:bg-toss-bg transition">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-toss-text truncate">{tx.memo || tx.items || cat.label}</p>
                      {tx.memo && tx.items && <p className="text-sm text-toss-sub truncate">{tx.items}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${SPENDER_BADGE[sp]}`}>{sp}</span>
                        {tx.company && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-600">🏢 회사</span>}
                        <span className="text-xs font-medium text-toss-sub truncate">{cat.label}</span>
                        {tx.auto && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-50 text-toss-green">🔁 자동</span>}
                        {tx.reactions && Object.values(tx.reactions).some((r) => r?.e) && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs bg-rose-50 leading-none">{Object.values(tx.reactions).map((r) => r?.e).filter(Boolean).join("")}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-base font-bold num shrink-0 ${tx.company ? "text-indigo-500" : "text-toss-text"}`}>-{formatKRW(tx.amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
