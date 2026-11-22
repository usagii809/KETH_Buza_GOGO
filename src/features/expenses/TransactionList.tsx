import { useState } from "react";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender } from "../../lib/categories";
import { formatDateHeader } from "../../lib/dates";
import { formatKRW } from "../../lib/format";
import type { Spender, Transaction } from "../../lib/types";
import { Card, Segmented } from "../../ui/controls";

type Filter = "ALL" | Spender;
const SPENDER_BADGE: Record<Spender, string> = {
  태형: "bg-blue-50 text-toss-blue",
  경은: "bg-rose-50 text-rose-600",
  공동: "bg-gray-100 text-toss-sub"
};

export function TransactionList({ txs, now, onEdit }: { txs: Transaction[]; now: Date; onEdit: (tx: Transaction) => void }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const filtered = txs.filter((tx) => filter === "ALL" || normalizeSpender(tx.spender) === filter);
  const total = filtered.reduce((s, tx) => s + (Number(tx.amount) || 0), 0);

  // 날짜별 묶음 (이미 최신순 정렬)
  const groups: { date: string; items: Transaction[] }[] = [];
  filtered.forEach((tx) => {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-toss-text">지출 내역</h2>
          <p className="text-xs text-toss-sub mt-0.5 num">{filtered.length}건 · {formatKRW(total)}</p>
        </div>
        <Segmented<Filter> options={[["ALL", "전체"], ["태형", "태형"], ["경은", "경은"], ["공동", "공동"]]} value={filter} onChange={setFilter} />
      </div>

      {groups.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-base font-bold text-toss-text">아직 기록이 없어요</p>
          <p className="text-sm text-toss-sub mt-1">아래 버튼으로 첫 지출을 남겨보세요</p>
        </div>
      ) : groups.map((g) => (
        <div key={g.date} className="pt-4 first:pt-0">
          <div className="flex items-center justify-between text-xs font-semibold text-toss-sub pb-1 border-b border-toss-border">
            <span>{formatDateHeader(g.date, now)}</span>
            <span className="num">-{formatKRW(g.items.reduce((s, tx) => s + (Number(tx.amount) || 0), 0))}</span>
          </div>
          <div className="divide-y divide-toss-border/70">
            {g.items.map((tx) => {
              const cat = CATEGORY_MAP[normalizeCategory(tx.category)];
              const sp = normalizeSpender(tx.spender);
              return (
                <button key={tx.id} type="button" onClick={() => onEdit(tx)}
                  className="tx-row w-full text-left py-3 px-2 -mx-2 flex items-center justify-between gap-3 rounded-xl hover:bg-toss-bg active:bg-toss-bg transition">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-toss-text truncate">{tx.memo || cat.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${SPENDER_BADGE[sp]}`}>{sp}</span>
                      <span className="text-xs font-medium text-toss-sub truncate">{cat.label}</span>
                      {tx.auto && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-50 text-toss-green">🔁 자동</span>}
                    </div>
                  </div>
                  <span className="text-base font-bold text-toss-text num shrink-0">-{formatKRW(tx.amount)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}
