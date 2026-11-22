import { signOut } from "firebase/auth";
import { useRef } from "react";
import { exportBackup, importBackup, parseBackup } from "../../data/db";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender, type Budget } from "../../lib/categories";
import { todayStr } from "../../lib/dates";
import { auth } from "../../lib/firebase";
import { formatShort } from "../../lib/format";
import type { RecurringRule, Transaction } from "../../lib/types";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  email: string | null;
  ym: string;
  txs: Transaction[];
  defaultBudget: Budget;
  rules: RecurringRule[];
  onOpenRecurring: () => void;
  onClose: () => void;
}

export function SettingsSheet({ email, ym, txs, defaultBudget, rules, onOpenRecurring, onClose }: Props) {
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const rows = txs.map((tx) => [
      tx.date || "",
      normalizeSpender(tx.spender),
      CATEGORY_MAP[normalizeCategory(tx.category)].label,
      Number(tx.amount) || 0,
      `"${String(tx.memo || "").replace(/"/g, '""')}"`
    ].join(","));
    const csv = "﻿" + [["날짜", "지출주체", "카테고리", "금액", "메모"].join(","), ...rows].join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `태형경은가계부_${ym}.csv`);
    toast("파일을 저장했어요");
  };

  const exportJson = async () => {
    try {
      const backup = await exportBackup(defaultBudget);
      download(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `태형경은가계부_전체백업_${todayStr()}.json`);
      toast("백업을 저장했어요");
    } catch (err) {
      console.error("백업 오류:", err);
      toast("백업하지 못했어요. 다시 시도해 주세요");
    }
  };

  const importJson = async (file: File) => {
    let parsed;
    try { parsed = parseBackup(JSON.parse(await file.text())); }
    catch { toast("이 앱에서 만든 백업 파일인지 확인해 주세요"); return; }
    const ok = await confirm({
      title: "백업을 불러올까요?",
      message: `기록 ${parsed.transactions.length}건, 월별 예산 ${parsed.months.length}개, 자동 기록 ${parsed.recurring.length}개, 저축 목표 ${parsed.goals.length}개${parsed.defaultBudget ? ", 기본 예산" : ""}을 불러와요.\n이미 있는 기록은 덮어써서 중복되지 않아요.`,
      okText: "불러오기",
      danger: false
    });
    if (!ok) return;
    try {
      await importBackup(parsed);
      onClose();
      toast("백업을 불러왔어요");
    } catch (err) {
      console.error("복원 오류:", err);
      toast("불러오지 못했어요. 다시 시도해 주세요");
    }
  };

  const logout = async () => {
    try { await signOut(auth); toast("로그아웃했어요. 또 만나요 👋"); } catch { toast("로그아웃하지 못했어요"); }
  };

  const recurringSub = rules.length
    ? `${rules.length}개 등록됨 · 매달 ${formatShort(rules.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`
    : "통신비·구독료처럼 매달 나가는 돈을 알아서 기록해요";

  const item = "w-full py-3 px-4 rounded-2xl bg-toss-bg hover:bg-gray-200/70 text-left flex items-center justify-between transition";
  return (
    <Sheet title="설정" subtitle={email || "로그인됨"} onClose={onClose}
      footer={<button type="button" onClick={logout} className="w-full py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-toss-red text-sm font-bold transition">로그아웃</button>}>
      <div className="space-y-2.5">
        <button type="button" id="openRecurringBtn" onClick={onOpenRecurring} className={`${item} !bg-toss-blueLight`}>
          <div>
            <p className="text-sm font-bold text-toss-text">🔁 매달 자동 기록</p>
            <p className="text-xs text-toss-sub">{recurringSub}</p>
          </div>
          <span className="text-sm font-bold text-toss-blue">→</span>
        </button>
        <button type="button" onClick={exportCsv} className={item}>
          <div>
            <p className="text-sm font-bold text-toss-text">이번 달 내역 엑셀로 받기</p>
            <p className="text-xs text-toss-sub">CSV 파일이라 엑셀·구글 시트에서 바로 열려요</p>
          </div>
          <span className="text-sm font-bold text-toss-blue">CSV</span>
        </button>
        <button type="button" onClick={exportJson} className={item}>
          <div>
            <p className="text-sm font-bold text-toss-text">전체 백업하기</p>
            <p className="text-xs text-toss-sub">예산과 모든 기록을 파일 하나로 저장해요</p>
          </div>
          <span className="text-sm font-bold text-toss-blue">백업</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={item}>
          <div>
            <p className="text-sm font-bold text-toss-text">백업 불러오기</p>
            <p className="text-xs text-toss-sub">여러 번 불러와도 기록이 중복되지 않아요</p>
          </div>
          <span className="text-sm font-bold text-toss-green">복원</span>
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importJson(f); }} />
      </div>
    </Sheet>
  );
}
