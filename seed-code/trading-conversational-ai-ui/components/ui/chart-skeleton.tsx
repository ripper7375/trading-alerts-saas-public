'use client';

export function ChartSkeleton() {
  return (
    <div className="relative flex h-full animate-pulse flex-col overflow-hidden border-x border-slate-800/80 bg-[#06070b] select-none">
      {/* C2: Top Header Toolbar Skeleton */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/90 bg-[#11141e] px-3.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-md border border-amber-500/30 bg-amber-500/20" />
          <div className="h-7 w-56 rounded-lg bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-32 rounded-lg bg-slate-800/60" />
          <div className="h-7 w-28 rounded-lg bg-slate-800/60" />
        </div>
      </div>

      {/* C4: Dual Stacked Terminal Canvas Skeleton */}
      <div className="flex flex-1 flex-col gap-1 p-1">
        {/* Upper M5 Chart Canvas Skeleton */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-blue-900/40 bg-[#080b12] p-3">
          {/* Top Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded border border-blue-500/40 bg-blue-500/20" />
              <div className="h-4 w-36 rounded bg-slate-800/60" />
            </div>
            <div className="h-6 w-28 rounded bg-slate-800/60" />
          </div>

          {/* Left Vertical Drawing Toolbar Strip */}
          <div className="absolute top-12 left-2 flex flex-col gap-1 rounded-lg border border-slate-800/80 bg-[#090c14] p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-6 rounded bg-slate-800/60" />
            ))}
          </div>

          {/* Candlestick & SSA Wave Outlines */}
          <div className="absolute inset-x-12 top-14 bottom-4 flex items-center justify-between gap-1.5 opacity-30">
            {Array.from({ length: 32 }).map((_, i) => {
              const heightPct = 35 + Math.sin(i / 2) * 25;
              const isUp = i % 2 === 0;
              return (
                <div
                  key={i}
                  className="flex w-full flex-col items-center"
                  style={{ height: `${heightPct}%` }}
                >
                  <div className="w-[1px] flex-1 bg-slate-400/40" />
                  <div
                    className={`h-full w-1.5 rounded-xs ${isUp ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                  />
                  <div className="w-[1px] flex-1 bg-slate-400/40" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Lower M15 Chart Canvas Skeleton */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-purple-900/40 bg-[#0f0a17] p-3">
          {/* Top Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded border border-purple-500/40 bg-purple-500/20" />
              <div className="h-4 w-36 rounded bg-slate-800/60" />
            </div>
            <div className="h-6 w-28 rounded bg-slate-800/60" />
          </div>

          {/* Left Vertical Drawing Toolbar Strip */}
          <div className="absolute top-12 left-2 flex flex-col gap-1 rounded-lg border border-slate-800/80 bg-[#0f0a17] p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-6 rounded bg-slate-800/60" />
            ))}
          </div>

          {/* Candlestick & SSA Wave Outlines */}
          <div className="absolute inset-x-12 top-14 bottom-4 flex items-center justify-between gap-1.5 opacity-30">
            {Array.from({ length: 32 }).map((_, i) => {
              const heightPct = 40 + Math.cos(i / 2) * 25;
              const isUp = i % 3 !== 0;
              return (
                <div
                  key={i}
                  className="flex w-full flex-col items-center"
                  style={{ height: `${heightPct}%` }}
                >
                  <div className="w-[1px] flex-1 bg-slate-400/40" />
                  <div
                    className={`h-full w-1.5 rounded-xs ${isUp ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                  />
                  <div className="w-[1px] flex-1 bg-slate-400/40" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
