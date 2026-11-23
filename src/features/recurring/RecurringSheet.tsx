import { useState } from "react";
import { addRecurring, deleteRecurring, updateRecurring, type RecurringInput } from "../../data/db";
import { CATEGORY_MAP, SPENDERS, normalizeCategory, normalizeSpender, visibleCategories } from "../../lib/categories";
import { formatKRW } from "../../lib/format";
import type { RecurringRule } from "../../lib/types";
import { MoneyInput } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";

export const dayLabel = (day: number) => (Number(day) >= 31 ? "말일" : `${day}일`);

const emptyForm = (): RecurringInput => ({ memo: "", amount: 0, day: new Date().getDate(), category: "livingTelecom", spender: "공동" });

export function RecurringSheet({ rules, onClose }: { rules: RecurringRule[]; onClose: () => void }) {
  const { toast, confirm } = useFeedback();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringInput>(emptyForm);
  const set = <K extends keyof RecurringInput>(k: K, v: RecurringInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => { setEditingId(null); setForm(emptyForm()); };

  const startEdit = (r: RecurringRule) => {
    setEditingId(r.id);
    setForm({ memo: r.memo || "", amount: Number(r.amount) || 0, day: Math.min(31, Number(r.day) || 1), category: normalizeCategory(r.category), spender: normalizeSpender(r.spender) });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.amount <= 0) { toast("금액을 입력해 주세요"); return; }
    const data = { ...form, memo: form.memo.trim() };
    try {
      if (editingId) {
        await updateRecurring(editingId, data);
        toast("자동 기록을 수정했어요");
      } else {
        const { startsNextMonth } = await addRecurring(data);
        toast(startsNextMonth ? `다음 달 ${dayLabel(data.day)}부터 자동으로 기록돼요` : `이번 달 ${dayLabel(data.day)}부터 자동으로 기록돼요`);
      }
      reset();
    } catch (err) {
      console.error("자동 기록 저장 오류:", err);
      toast("저장하지 못했어요. 다시 시도해 주세요");
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "자동 기록을 그만할까요?", message: "이미 기록된 내역은 그대로 남아요.", okText: "그만하기" }))) return;
    try {
      await deleteRecurring(id);
      if (editingId === id) reset();
      toast("자동 기록을 껐어요");
    } catch { toast("지우지 못했어요"); }
  };

  const select = "bg-white text-toss-text text-base font-medium rounded-xl px-2 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue";
  return (
    <Sheet title="매달 자동 기록 🔁" subtitle="정해진 날이 되면 앱을 열 때 알아서 기록돼요" onClose={onClose}>
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-base font-bold text-toss-text">아직 자동 기록이 없어요</p>
            <p className="text-sm text-toss-sub mt-1">휴대폰 요금, OTT 구독료를 등록해 보세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const cat = CATEGORY_MAP[normalizeCategory(r.category)];
              return (
                <div key={r.id} className={`flex items-center gap-2 p-3 rounded-2xl border border-toss-border ${editingId === r.id ? "ring-2 ring-toss-blue" : ""}`}>
                  <button type="button" onClick={() => startEdit(r)} className="flex-1 min-w-0 text-left">
                    <p className="text-base font-bold text-toss-text truncate">{r.memo || cat.label}</p>
                    <p className="text-xs text-toss-sub mt-0.5">매달 {dayLabel(r.day)} · {cat.short} · {normalizeSpender(r.spender)}</p>
                  </button>
                  <span className="text-base font-bold text-toss-text num shrink-0">{formatKRW(r.amount)}</span>
                  <button type="button" onClick={() => remove(r.id)} aria-label="삭제"
                    className="w-8 h-8 shrink-0 rounded-lg bg-toss-bg text-toss-sub hover:text-toss-red flex items-center justify-center">✕</button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={submit} className="p-4 rounded-2xl bg-toss-bg space-y-3">
          <p className="text-sm font-bold text-toss-text">{editingId ? "자동 기록 수정" : "새 자동 기록 추가"}</p>
          <input id="recMemo" maxLength={30} placeholder="이름 (예: 휴대폰 요금)" autoComplete="off" value={form.memo} onChange={(e) => set("memo", e.target.value)}
            className="w-full bg-white text-toss-text text-base font-medium rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue" />
          <div className="relative">
            <MoneyInput id="recAmount" placeholder="금액" value={form.amount} onChange={(v) => set("amount", v)}
              className="w-full bg-white text-toss-text text-base font-bold num rounded-xl pl-3.5 pr-9 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-toss-sub">원</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select id="recDay" value={form.day} onChange={(e) => set("day", Number(e.target.value))} className={select}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 31 ? "매달 말일" : `매달 ${d}일`}</option>)}
            </select>
            <select id="recCategory" value={form.category} onChange={(e) => set("category", e.target.value)} className={select}>
              {[...visibleCategories(), ...(CATEGORY_MAP[form.category] && !visibleCategories().some((c) => c.key === form.category) ? [CATEGORY_MAP[form.category]] : [])].map((c) => <option key={c.key} value={c.key}>{c.short}</option>)}
            </select>
            <select id="recSpender" value={form.spender} onChange={(e) => set("spender", e.target.value)} className={select}>
              {SPENDERS.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={reset} className="px-4 py-3 rounded-xl bg-white text-sm font-bold text-toss-sub">취소</button>}
            <button type="submit" id="recSubmitBtn" className="flex-1 py-3 rounded-xl bg-toss-blue hover:bg-toss-blueDark text-white text-base font-bold transition">
              {editingId ? "수정하기" : "추가하기"}
            </button>
          </div>
        </form>
      </div>
    </Sheet>
  );
}
