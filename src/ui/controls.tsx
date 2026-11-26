import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { evalAmount, formatExpr, hasOperator } from "../lib/calcExpr";
import { formatAmountInput, parseAmount } from "../lib/format";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
};

/** 천 단위 콤마가 실시간으로 붙는 금액 입력 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput({ value, onChange, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
      value={formatAmountInput(value)}
      onChange={(e) => onChange(parseAmount(e.target.value))}
      {...rest}
    />
  );
});

/** 금액 + "원" 꼬리표가 붙은 큰 입력칸 */
export const BigMoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function BigMoneyInput(props, ref) {
  return (
    <div className="relative">
      <MoneyInput ref={ref} {...props}
        className="w-full bg-toss-bg text-toss-text text-2xl font-bold num rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-toss-blue" />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-toss-sub">원</span>
    </div>
  );
});

export function QuickAddChips({ amounts, onAdd }: { amounts: [number, string][]; onAdd: (n: number) => void }) {
  return (
    <div className="flex gap-1.5 mt-2">
      {amounts.map(([n, label]) => (
        <button key={n} type="button" onClick={() => onAdd(n)}
          className="flex-1 py-2 rounded-xl bg-toss-bg hover:bg-gray-200 text-xs font-semibold text-toss-sub num active:scale-95 transition">
          {label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  // 고른 칸 뒤의 하얀 배경이 옆으로 미끄러져 가요
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number; animate: boolean } | null>(null);
  const idx = options.findIndex(([v]) => v === value);
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const btn = wrap.current?.querySelectorAll<HTMLButtonElement>("button[data-seg]")[idx];
      if (btn) setPill((p) => ({ x: btn.offsetLeft, w: btn.offsetWidth, animate: animate && !!p }));
    };
    measure(true);
    // 글자가 바뀌거나(예: "경은 2") 화면 크기가 바뀌면 다시 재요
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure(false)) : null;
    if (ro && wrap.current) ro.observe(wrap.current);
    return () => ro?.disconnect();
  }, [idx, options.map(([, l]) => l).join("|")]);
  return (
    <div ref={wrap} className="relative flex items-center gap-1 bg-toss-bg p-1 rounded-xl">
      {pill && (
        <span aria-hidden="true" className={`absolute top-1 bottom-1 left-0 rounded-lg bg-white shadow-sm ${pill.animate ? "seg-pill" : ""}`}
          style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />
      )}
      {options.map(([v, label]) => (
        <button key={v} type="button" data-seg onClick={() => onChange(v)} aria-pressed={v === value}
          className={`relative px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${v === value ? `text-toss-text ${pill ? "" : "bg-white shadow-sm"}` : "text-toss-sub"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** 진행 막대. marker = 이번 달 '오늘 위치'(%) */
export function ProgressBar({ pct, barClass, marker, className = "h-2", track = "bg-toss-bg" }:
  { pct: number; barClass: string; marker?: number | null; className?: string; track?: string }) {
  return (
    <div className={`relative w-full ${className} ${track} rounded-full overflow-hidden`}>
      <div className={`h-full ${barClass} rounded-full progress-fill`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      {marker != null && <div className="absolute top-0 bottom-0 w-0.5 bg-toss-text/50" style={{ left: `calc(${marker}% - 1px)` }} />}
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`bg-white rounded-3xl p-5 shadow-sm mb-4 ${className}`}>{children}</section>
);

export const inputClass = "w-full bg-toss-bg text-toss-text text-base font-medium rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-toss-blue";
export const primaryButton = "flex-1 py-3.5 rounded-2xl bg-toss-blue hover:bg-toss-blueDark text-white text-base font-bold shadow-sm active:scale-[0.99] transition disabled:opacity-60";

/**
 * 계산되는 큰 금액 칸: 12000+3500, 48000÷2 처럼 식을 넣으면 계산해서 금액으로 써요.
 * 숫자 키패드엔 + 가 없어서 아래 ＋ − × ÷ 버튼으로 넣어요.
 */
export function CalcMoneyInput({ id, value, onChange }: { id?: string; value: number; onChange: (v: number) => void }) {
  const [expr, setExpr] = useState(value ? String(value) : "");
  const emitted = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // 콤마가 붙으며 글자 수가 바뀌어도 커서는 항상 맨 끝 (식을 이어서 쓰기 좋게)
  const toEnd = () => requestAnimationFrame(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  });
  // 바깥에서 금액이 바뀌면(빠른 금액 버튼 · 자주 쓰는 지출) 식을 그 금액으로
  useEffect(() => {
    if (value !== emitted.current) { setExpr(value ? String(value) : ""); emitted.current = value; }
  }, [value]);
  const update = (next: string) => {
    const clean = next.replace(/[,\s원]/g, "").replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/").replace(/[^\d+\-*/]/g, "")
      .replace(/([+\-*/])[+\-*/]+/g, "$1").replace(/^[+*/]/, "");
    setExpr(clean);
    toEnd();
    // 식이 덜 끝났으면(12000+) 끝난 데까지 계산
    const v = evalAmount(clean) ?? evalAmount(clean.replace(/[+\-*/]$/, "")) ?? 0;
    emitted.current = Math.max(0, v);
    onChange(emitted.current);
  };
  const isExpr = hasOperator(expr);
  const result = evalAmount(expr);
  const op = (o: string, label: string) => (
    <button key={o} type="button" onMouseDown={(e) => e.preventDefault()}
      onClick={() => { inputRef.current?.focus(); update(expr ? expr.replace(/[+\-*/]$/, "") + o : ""); }}
      className="calc-op flex-1 py-1.5 rounded-lg bg-toss-bg text-base font-bold text-toss-sub active:scale-95 transition">{label}</button>
  );
  return (
    <div>
      <div className="relative">
        <input ref={inputRef} id={id} type="text" inputMode="numeric" autoComplete="off" placeholder="0"
          onFocus={toEnd} onClick={toEnd}
          value={isExpr ? formatExpr(expr) : formatAmountInput(value)}
          onChange={(e) => update(e.target.value)}
          className="w-full bg-toss-bg text-toss-text text-2xl font-bold num rounded-xl pl-4 pr-10 py-3 outline-none focus:ring-2 focus:ring-toss-blue" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-toss-sub">원</span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {op("+", "＋")}{op("-", "−")}{op("*", "×")}{op("/", "÷")}
        <button type="button" disabled={!isExpr || result === null} onClick={() => { if (result !== null) { setExpr(String(result)); emitted.current = result; onChange(result); } }}
          className="calc-eq flex-1 py-1.5 rounded-lg bg-toss-blueLight text-base font-bold text-toss-blue disabled:opacity-40 active:scale-95 transition">=</button>
      </div>
      {isExpr && <p className="mt-1.5 text-sm text-toss-sub num">= <b className="text-toss-text">{(result ?? emitted.current).toLocaleString("ko-KR")}원</b>{result === null && " (계산 중)"}</p>}
    </div>
  );
}
