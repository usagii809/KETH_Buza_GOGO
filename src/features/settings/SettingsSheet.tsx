import { signOut } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { exportBackup, importBackup, parseBackup, removeProfilePhoto, saveProfile } from "../../data/db";
import { CATEGORY_MAP, normalizeCategory, normalizeSpender, type Budget } from "../../lib/categories";
import { downloadCsv } from "../../lib/csv";
import { todayStr } from "../../lib/dates";
import { auth } from "../../lib/firebase";
import { formatShort } from "../../lib/format";
import { toAvatarDataUrl } from "../../lib/image";
import type { Profile, RecurringRule, Transaction } from "../../lib/types";
import { Avatar } from "../../ui/Avatar";
import { useFeedback } from "../../ui/feedback";
import { APP_BUILT_AT, APP_SHA, APP_VERSION, builtAtLabel, fetchServerVersion, isNewer, updateToLatest, type ServerVersion } from "../../lib/version";
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
  uid: string;
  me: Profile | null;
  /** 로그인 계정으로 이름이 정해졌으면 고르는 버튼을 숨겨요 */
  nameLocked: boolean;
  email: string | null;
  ym: string;
  txs: Transaction[];
  defaultBudget: Budget;
  rules: RecurringRule[];
  onOpenRecurring: () => void;
  onOpenCategories: () => void;
  onClose: () => void;
}

export function SettingsSheet({ uid, me, nameLocked, email, ym, txs, defaultBudget, rules, onOpenRecurring, onOpenCategories, onClose }: Props) {
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const changePhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      await saveProfile(uid, { photo: await toAvatarDataUrl(file) });
      toast("프로필 사진을 바꿨어요 📸");
    } catch (err) {
      console.error("프로필 사진 오류:", err);
      toast("사진을 저장하지 못했어요. 다른 사진으로 해볼까요?");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = async () => {
    try { await removeProfilePhoto(uid); toast("사진을 지웠어요"); } catch { toast("지우지 못했어요"); }
  };
  const setName = async (name: "태형" | "경은") => {
    try { await saveProfile(uid, { name }); toast(`반가워요, ${name}! 👋`); } catch { toast("저장하지 못했어요"); }
  };

  const exportCsv = () => {
    const rows = txs.map((tx) => [
      tx.date || "",
      normalizeSpender(tx.spender),
      CATEGORY_MAP[normalizeCategory(tx.category)].label,
      Number(tx.amount) || 0,
      tx.memo || "",
      tx.items || "",
      [tx.company ? "회사 돈" : "", (Number(tx.amount) || 0) < 0 ? "환불" : ""].filter(Boolean).join(" · ")
    ]);
    downloadCsv(`태형경은가계부_${ym}.csv`, ["날짜", "지출주체", "카테고리", "금액", "사용처", "품목", "구분"], rows);
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
      message: [
        `기록 ${parsed.transactions.length}건, 월별 예산 ${parsed.months.length}개, 자동 기록 ${parsed.recurring.length}개, 저축 목표 ${parsed.goals.length}개${parsed.defaultBudget ? ", 기본 예산" : ""}`,
        [parsed.settlements.length && `정산 ${parsed.settlements.length}개`, parsed.lottery.length && `복권 ${parsed.lottery.length}장`,
          parsed.profiles.length && `프로필 ${parsed.profiles.length}개`, parsed.categories && "카테고리 설정", parsed.noSpendBest && "무지출 최장 기록"].filter(Boolean).join(", "),
      ].filter(Boolean).join("\n") + "을 불러와요.\n이미 있는 기록은 덮어써서 중복되지 않아요.",
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
        {/* 내 프로필 */}
        <div className="p-4 rounded-2xl bg-toss-bg flex items-center gap-4">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={photoBusy} aria-label="프로필 사진 바꾸기" className="relative shrink-0">
            <Avatar profile={me} size={64} className={photoBusy ? "opacity-50" : ""} />
            <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-xs">📷</span>
          </button>
          <div className="min-w-0 flex-1">
            {nameLocked && me?.name ? (
              <>
                <p className="text-lg font-bold text-toss-text">{me.name}</p>
                <p className="text-xs text-toss-sub">사진을 눌러서 프로필 사진을 바꿔요</p>
              </>
            ) : (
              <>
                <p className="text-xs text-toss-sub">나는 누구?</p>
                <div className="flex gap-1.5 mt-1">
                  {(["태형", "경은"] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setName(n)}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${me?.name === n ? "bg-toss-blue text-white" : "bg-white text-toss-sub"}`}>{n}</button>
                  ))}
                </div>
              </>
            )}
            {me?.photo && <button type="button" onClick={removePhoto} className="mt-1.5 text-xs text-toss-sub underline">사진 지우기</button>}
          </div>
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) changePhoto(f); }} />
        </div>

        <button type="button" id="openRecurringBtn" onClick={onOpenRecurring} className={`${item} !bg-toss-blueLight`}>
          <div>
            <p className="text-sm font-bold text-toss-text">🔁 매달 자동 기록</p>
            <p className="text-xs text-toss-sub">{recurringSub}</p>
          </div>
          <span className="text-sm font-bold text-toss-blue">→</span>
        </button>
        <button type="button" id="openCategoriesBtn" onClick={onOpenCategories} className={item}>
          <div>
            <p className="text-sm font-bold text-toss-text">🏷️ 카테고리 관리</p>
            <p className="text-xs text-toss-sub">반려동물 · 병원비처럼 항목을 추가하거나 숨겨요</p>
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
            <p className="text-xs text-toss-sub">예산·기록·목표·정산·복권·프로필·카테고리까지 파일 하나로</p>
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
        <VersionRow />
      </div>
    </Sheet>
  );
}

/** 지금 보고 있는 버전 + 새 버전이 있으면 업데이트 버튼 */
function VersionRow() {
  const [server, setServer] = useState<ServerVersion | null | "checking">("checking");
  useEffect(() => { fetchServerVersion().then(setServer); }, []);
  const newer = server !== "checking" && isNewer(server);
  return (
    <div id="appVersion" className="pt-3 mt-1 border-t border-toss-border text-center">
      <p className="text-sm font-bold text-toss-sub num">{APP_VERSION}</p>
      <p className="text-[11px] text-toss-muted num">{[APP_BUILT_AT ? `${builtAtLabel(APP_BUILT_AT)} 배포` : "", APP_SHA].filter(Boolean).join(" · ")}</p>
      {server === "checking" ? (
        <p className="text-xs text-toss-muted mt-0.5">최신 버전 확인 중…</p>
      ) : newer && server ? (
        <button type="button" onClick={updateToLatest}
          className="mt-2 w-full py-2.5 rounded-xl bg-toss-blueLight text-sm font-bold text-toss-blue active:scale-[0.99] transition">
          새 버전({server.version})이 있어요 · 지금 업데이트
        </button>
      ) : (
        <p className="text-xs text-toss-green mt-0.5">{server ? "최신 버전이에요 ✓" : "최신 버전을 확인하지 못했어요 (오프라인?)"}</p>
      )}
    </div>
  );
}
