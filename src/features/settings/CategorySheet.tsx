import { useState } from "react";
import { categoryInUse, removeCategory, saveCategoryConfig } from "../../data/db";
import {
  builtinOriginal, CATEGORIES, CATEGORY_MAP, FALLBACK_CATEGORY, GROUPS, isBuiltinKey, isHiddenCategory, newCategoryKey,
  type Category, type CategoryConfig, type GroupKey
} from "../../lib/categories";
import { inputClass, primaryButton } from "../../ui/controls";
import { useFeedback } from "../../ui/feedback";
import { Sheet } from "../../ui/Sheet";
import { offlineBlocked } from "../../lib/online";

interface Props {
  /** 서버에 저장된 그대로의 설정 (없으면 null) */
  config: unknown;
  onClose: () => void;
}

type Draft = { key: string | null; label: string; emoji: string; group: GroupKey; paced: boolean };
const EMPTY: Draft = { key: null, label: "", emoji: "", group: "LIVING", paced: true };
const EMOJI_IDEAS = ["🐶", "🏥", "💊", "🎁", "✈️", "📚", "🎮", "💇", "🚗", "👶", "🏋️", "🍼"];

function current(config: unknown): Required<CategoryConfig> {
  const c = (config && typeof config === "object" ? config : {}) as CategoryConfig;
  return {
    custom: Array.isArray(c.custom) ? c.custom : [],
    hidden: Array.isArray(c.hidden) ? c.hidden : [],
    overrides: c.overrides && typeof c.overrides === "object" ? c.overrides : {}
  };
}

export function CategorySheet({ config, onClose }: Props) {
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<{ cat: Category; txs: number; rules: number } | null>(null);
  const [moveTo, setMoveTo] = useState(FALLBACK_CATEGORY);
  const [busy, setBusy] = useState(false);
  const cfg = current(config);

  const save = async (next: Required<CategoryConfig>, msg: string) => {
    if (offlineBlocked()) return;
    setBusy(true);
    try { await saveCategoryConfig(next); toast(msg); return true; }
    catch (err) { console.error("카테고리 저장 오류:", err); toast("저장하지 못했어요. 다시 시도해 주세요"); return false; }
    finally { setBusy(false); }
  };

  const toggleHidden = (c: Category) => {
    if (c.key === FALLBACK_CATEGORY) { toast("기타 생활비는 다른 항목이 모이는 곳이라 숨길 수 없어요"); return; }
    const hidden = isHiddenCategory(c.key) ? cfg.hidden.filter((k) => k !== c.key) : [...cfg.hidden, c.key];
    save({ ...cfg, hidden }, isHiddenCategory(c.key) ? `${c.short} 다시 보여요` : `${c.short} 숨겼어요 (지난 기록은 그대로예요)`);
  };

  const submitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (offlineBlocked()) return;
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) { toast("이름을 적어주세요"); return; }
    if (CATEGORIES.some((c) => c.key !== draft.key && c.short.toLowerCase() === label.toLowerCase())) { toast("같은 이름이 이미 있어요"); return; }
    // 기본 항목: 원래와 다른 부분만 overrides에 저장 (전부 원래대로면 지워요)
    if (draft.key && isBuiltinKey(draft.key)) {
      const orig = builtinOriginal(draft.key)!;
      const o = stripUndefined({
        label: label !== orig.short ? label : undefined,
        emoji: draft.emoji.trim() || undefined,
        group: draft.group !== orig.group ? draft.group : undefined,
        paced: draft.paced !== orig.paced ? draft.paced : undefined
      });
      const overrides = { ...cfg.overrides };
      if (Object.keys(o).length) overrides[draft.key] = o;
      else delete overrides[draft.key];
      if (await save({ ...cfg, overrides }, Object.keys(o).length ? "바꿨어요. 지난 기록에도 새 이름으로 보여요" : "원래대로 돌렸어요")) setDraft(null);
      return;
    }
    const item = { key: draft.key || newCategoryKey(), label, group: draft.group, paced: draft.paced, ...(draft.emoji.trim() ? { emoji: draft.emoji.trim() } : {}) };
    const exists = cfg.custom.some((c) => c.key === item.key);
    const custom = exists
      ? cfg.custom.map((c) => (c.key === item.key ? { ...c, ...item, ...(draft.emoji.trim() ? {} : { emoji: undefined }) } : c)).map(stripUndefined)
      : [...cfg.custom, { ...item, createdAt: Date.now() }];
    if (await save({ ...cfg, custom }, exists ? "바꿨어요" : `'${label}' 항목을 만들었어요 🎉 예산 설정에서 예산도 정할 수 있어요`)) setDraft(null);
  };

  const startRemove = async (c: Category) => {
    if (offlineBlocked()) return;
    setBusy(true);
    try {
      const use = await categoryInUse(c.key);
      if (!use.txs && !use.rules) {
        setBusy(false);
        if (!(await confirm({ title: `'${c.short}' 항목을 지울까요?`, message: "아직 이 항목으로 남긴 기록이 없어요.", okText: "지우기" }))) return;
        await removeCategory(c.key, FALLBACK_CATEGORY, { ...cfg, custom: cfg.custom.filter((x) => x.key !== c.key), hidden: cfg.hidden.filter((k) => k !== c.key) });
        toast("지웠어요");
        return;
      }
      setMoveTo(FALLBACK_CATEGORY);
      setRemoving({ cat: c, ...use });
    } catch (err) {
      console.error("카테고리 확인 오류:", err);
      toast("확인하지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const key = removing.cat.key;
      const r = await removeCategory(key, moveTo, { ...cfg, custom: cfg.custom.filter((x) => x.key !== key), hidden: cfg.hidden.filter((k) => k !== key) });
      toast(`기록 ${r.txs}건을 ${CATEGORY_MAP[moveTo]?.short || "다른 항목"}(으)로 옮기고 지웠어요`);
      setRemoving(null);
    } catch (err) {
      console.error("카테고리 삭제 오류:", err);
      toast("지우지 못했어요. 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  };

  // ── 지우기: 옮길 곳 고르기 ──
  if (removing) {
    const { cat, txs, rules } = removing;
    return (
      <Sheet title={`'${cat.short}' 지우기`} onClose={() => setRemoving(null)}
        footer={<>
          <button type="button" onClick={() => setRemoving(null)} className="px-4 py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub">취소</button>
          <button type="button" onClick={confirmRemove} disabled={busy} className="flex-1 py-3.5 rounded-2xl bg-toss-red text-white text-base font-bold disabled:opacity-60">{busy ? "옮기는 중..." : "옮기고 지우기"}</button>
        </>}>
        <p className="text-sm text-toss-text leading-relaxed">
          이 항목으로 남긴 기록 <b className="num">{txs}건</b>{rules ? <>, 매달 자동 기록 <b className="num">{rules}개</b></> : null}이 있어요.
          <br />어느 항목으로 옮길까요? 예산도 같이 옮겨져요.
        </p>
        <p className="text-xs text-toss-sub mt-1.5">지우기 싫으면 목록에서 <b>숨기기</b>만 해도 돼요. 숨기면 지난 기록은 그대로 남아요.</p>
        <div className="grid grid-cols-2 gap-1.5 mt-4">
          {CATEGORIES.filter((c) => c.key !== cat.key).map((c) => (
            <button key={c.key} type="button" onClick={() => setMoveTo(c.key)}
              className={`py-2.5 px-3 rounded-xl text-sm font-semibold text-left truncate transition ${moveTo === c.key ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`}>{c.short}</button>
          ))}
        </div>
      </Sheet>
    );
  }

  // ── 추가 · 고치기 ──
  if (draft) {
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
    // 기본 항목을 고칠 때: 원래 모습과 다른지
    const orig = draft.key ? builtinOriginal(draft.key) : undefined;
    const changed = !!orig && (draft.label.trim() !== orig.short || !!draft.emoji.trim() || draft.group !== orig.group || draft.paced !== orig.paced);
    return (
      <Sheet title={draft.key ? "항목 고치기" : "새 항목 만들기"} onClose={() => setDraft(null)}
        footer={<>
          {orig && changed ? (
            <button type="button" onClick={() => setDraft({ key: orig.key, label: orig.short, emoji: "", group: orig.group, paced: orig.paced })}
              className="px-4 py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub">원래대로</button>
          ) : (
            <button type="button" onClick={() => setDraft(null)} className="px-4 py-3 rounded-xl bg-toss-bg text-sm font-bold text-toss-sub">취소</button>
          )}
          <button type="submit" form="categoryForm" disabled={busy} className={primaryButton}>{busy ? "저장하는 중..." : draft.key ? "저장하기" : "만들기"}</button>
        </>}>
        <form id="categoryForm" onSubmit={submitDraft} className="space-y-5">
          {orig && (
            <p className="text-xs text-toss-sub leading-relaxed -mb-2">
              기본 항목이에요 (원래 이름: <b>{orig.label}</b>). 이름을 바꿔도 지난 기록 · 예산은 그대로 이어지고, 새 이름으로 보여요.
            </p>
          )}
          <div>
            <label htmlFor="catLabel" className="block text-sm font-medium text-toss-sub mb-1.5">이름</label>
            <div className="flex gap-2">
              <input id="catEmoji" aria-label="이모지" value={draft.emoji} onChange={(e) => set("emoji", [...e.target.value].slice(-2).join(""))} placeholder="🙂"
                className={`${inputClass} !w-14 text-center`} />
              <input id="catLabel" autoFocus maxLength={12} value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="예: 반려동물, 병원비" className={inputClass} />
            </div>
            <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
              {EMOJI_IDEAS.map((e) => (
                <button key={e} type="button" onClick={() => set("emoji", e)} className={`w-9 h-9 shrink-0 rounded-xl text-lg ${draft.emoji === e ? "bg-toss-blueLight ring-2 ring-toss-blue" : "bg-toss-bg"}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-toss-sub mb-1.5">어느 묶음에 넣을까요?</span>
            <div className="grid grid-cols-3 gap-1.5">
              {GROUPS.map((g) => (
                <button key={g.key} type="button" onClick={() => set("group", g.key)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition ${draft.group === g.key ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`}>{g.shortLabel}</button>
              ))}
            </div>
            <p className="text-xs text-toss-sub mt-1.5">식비에 넣으면 '🍽️ 식비' 가용 예산에도 같이 잡혀요</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-toss-sub mb-1.5">어떻게 쓰는 돈인가요?</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => set("paced", true)} className={`py-2.5 px-3 rounded-xl text-left transition ${draft.paced ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`}>
                <span className="block text-sm font-bold">조금씩 자주</span><span className="block text-[11px] opacity-80">오늘 위치와 비교해요</span>
              </button>
              <button type="button" onClick={() => set("paced", false)} className={`py-2.5 px-3 rounded-xl text-left transition ${!draft.paced ? "bg-toss-blue text-white" : "bg-toss-bg text-toss-sub"}`}>
                <span className="block text-sm font-bold">가끔 한 번에</span><span className="block text-[11px] opacity-80">병원비 · 선물처럼</span>
              </button>
            </div>
          </div>
        </form>
      </Sheet>
    );
  }

  // ── 목록 ──
  return (
    <Sheet title="카테고리 관리" subtitle="항목을 추가하거나, 안 쓰는 항목을 숨겨요" onClose={onClose}
      footer={<button type="button" id="addCategoryBtn" onClick={() => setDraft({ ...EMPTY })} className={primaryButton}>+ 새 항목 만들기</button>}>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${g.badge}`}>{g.label}</span>
            <div className="mt-2 divide-y divide-toss-border/70">
              {CATEGORIES.filter((c) => c.group === g.key).map((c) => {
                const hidden = isHiddenCategory(c.key);
                return (
                  <div key={c.key} className={`category-row flex items-center justify-between gap-2 py-2.5 ${hidden ? "opacity-50" : ""}`}>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-toss-text">{c.label}</span>
                      {c.custom && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-toss-blueLight text-toss-blue align-middle">직접 추가</span>}
                      {!c.custom && cfg.overrides[c.key] && <span className="block text-[11px] text-toss-sub">원래: {builtinOriginal(c.key)?.label}</span>}
                      {hidden && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-toss-sub align-middle">숨김</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" disabled={busy} onClick={() => setDraft({ key: c.key, label: c.short, emoji: c.emoji || "", group: c.group, paced: c.paced })}
                        className="cat-edit px-2.5 py-1.5 rounded-lg bg-toss-bg text-xs font-bold text-toss-sub">고치기</button>
                      {c.custom && (
                        <button type="button" disabled={busy} onClick={() => startRemove(c)} className="px-2.5 py-1.5 rounded-lg bg-red-50 text-xs font-bold text-toss-red">지우기</button>
                      )}
                      {c.key !== FALLBACK_CATEGORY && (
                        <button type="button" disabled={busy} onClick={() => toggleHidden(c)}
                          className="px-2.5 py-1.5 rounded-lg bg-toss-bg text-xs font-bold text-toss-sub">{hidden ? "보이기" : "숨기기"}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-toss-sub leading-relaxed">
          숨긴 항목은 지출 기록 화면에서만 빠지고, 지난 기록과 예산 계산에는 그대로 남아요.
          기본 항목도 이름 · 묶음은 고칠 수 있지만, 지우지는 못하고 숨기기만 돼요.
        </p>
      </div>
    </Sheet>
  );
}

const stripUndefined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
