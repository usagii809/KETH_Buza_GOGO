import { forwardRef, type InputHTMLAttributes } from "react";
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
  return (
    <div className="flex items-center gap-1 bg-toss-bg p-1 rounded-xl">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${v === value ? "bg-white text-toss-text shadow-sm" : "text-toss-sub"}`}>
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
