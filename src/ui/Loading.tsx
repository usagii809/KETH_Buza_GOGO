// ⏳ 잠깐 기다릴 때 보여주는 것들 (동작 줄이기면 움직임 없이)
import type { ReactNode } from "react";

/** 반짝이며 차오르는 회색 자리 (내용이 들어올 모양 그대로) */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

/** 기록 목록 자리: 줄 n개 */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div role="status" aria-label="불러오는 중" className="space-y-3 py-2">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** 통통 튀는 점 세 개 + 문구 */
export function LoadingDots({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-2 text-sm text-toss-sub ${className}`}>
      <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
      {children}
    </div>
  );
}

/** 화면 맨 위 얇은 막대가 왔다 갔다 (달을 넘겨서 그 달 기록을 받는 중) */
export function TopProgress({ show }: { show: boolean }) {
  if (!show) return null;
  return <div role="progressbar" aria-label="불러오는 중" className="top-progress"><span /></div>;
}

/** 달을 넘겨서 그 달 기록을 받는 동안: 카드 모양 자리 (0원 같은 틀린 숫자가 잠깐 보이지 않게) */
export function MonthSkeleton() {
  const card = "bg-white rounded-3xl p-5 shadow-sm mb-4";
  return (
    <div role="status" aria-label="이 달 기록을 불러오는 중" className="month-skeleton">
      <div className={card}>
        <div className="flex items-center gap-4">
          <Skeleton className="w-24 h-24 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2 rounded-md" />
            <Skeleton className="h-7 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-2/3 rounded-md" />
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          <Skeleton className="h-3.5 rounded-md" /><Skeleton className="h-3.5 rounded-md" /><Skeleton className="h-3.5 w-5/6 rounded-md" />
        </div>
      </div>
      <div className={card}>
        <Skeleton className="h-4 w-1/3 rounded-md mb-4" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
      </div>
      <LoadingDots className="py-2">이 달 기록을 불러오는 중이에요</LoadingDots>
    </div>
  );
}
