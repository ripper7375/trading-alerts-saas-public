'use client';

export function ChartSkeleton() {
  return (
    <div className="relative flex h-full animate-pulse flex-col overflow-hidden border-x border-slate-800/80 bg-[#06070b] select-none">
      {/* Header Bar Skeleton */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/90 bg-[#11141e] px-3.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded bg-slate-800" />
          <div className="h-7 w-48 rounded-lg bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-lg bg-slate-800/60" />
          <div className="h-8 w-24 rounded-lg bg-slate-800/60" />
        </div>
      </div>

      {/* Chart Canvas Skeleton */}
      <div className="flex flex-1 flex-col gap-1 p-1">
        <div className="relative flex-1 overflow-hidden rounded-lg border border-blue-900/30 bg-[#080b12] p-4">
          <div className="mb-4 h-5 w-32 rounded bg-slate-800/80" />
          <div className="absolute inset-x-4 top-14 bottom-4 flex items-end justify-between gap-1 opacity-20">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-full rounded-t bg-blue-500"
                style={{ height: `${Math.sin(i) * 30 + 50}%` }}
              />
            ))}
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden rounded-lg border border-purple-900/30 bg-[#0f0a17] p-4">
          <div className="mb-4 h-5 w-32 rounded bg-slate-800/80" />
          <div className="absolute inset-x-4 top-14 bottom-4 flex items-end justify-between gap-1 opacity-20">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-full rounded-t bg-purple-500"
                style={{ height: `${Math.cos(i) * 30 + 50}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
