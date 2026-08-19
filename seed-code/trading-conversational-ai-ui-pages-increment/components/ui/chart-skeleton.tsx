/**
 * Server-rendered placeholder for the lazily-loaded `TradingChart`.
 *
 * The outer frame (borders, header height, body padding and background) is kept
 * byte-identical to `TradingChart`'s own root element so swapping one for the
 * other cannot shift layout. Only the inner placeholder blocks animate — the
 * container itself used to carry `animate-pulse`, which made the whole panel
 * oscillate in brightness and then snap to a static chart.
 */
export function ChartSkeleton() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border-x border-slate-200 bg-slate-50 shadow-2xl select-none dark:border-slate-800/80 dark:bg-[#06070b]">
      {/* C2: Top Header Toolbar Skeleton — mirrors the real toolbar's h-14 box */}
      <div className="flex h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3.5 shadow-xs dark:border-slate-800/90 dark:bg-[#11141e]">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-md border border-amber-500/30 bg-amber-500/20" />
          <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800/60" />
          <div className="h-7 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800/60" />
        </div>
      </div>

      {/* C4: Dual Stacked Terminal Canvas Skeleton — matches the chart's
          ResizablePanelGroup wrapper (bg-black/80 p-1) exactly. */}
      <div className="flex flex-1 flex-col gap-1 overflow-hidden bg-slate-100 p-1 dark:bg-black/80">
        {/* Upper M5 Chart Canvas Skeleton */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-blue-200 bg-white p-3 shadow-lg shadow-blue-500/5 dark:border-blue-900/40 dark:bg-[#080b12] dark:shadow-blue-950/20">
          {/* Top Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded border border-blue-500/40 bg-blue-500/20" />
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
            </div>
            <div className="h-6 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
          </div>

          {/* Left Vertical Drawing Toolbar Strip */}
          <div className="absolute top-12 left-2 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800/80 dark:bg-[#090c14]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-800/60"
              />
            ))}
          </div>

          {/* Candlestick & SSA Wave Outlines */}
          <div className="absolute inset-x-12 top-14 bottom-4 flex animate-pulse items-center justify-between gap-1.5 opacity-30">
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
        <div className="relative flex-1 overflow-hidden rounded-lg border border-purple-200 bg-white p-3 shadow-lg shadow-purple-500/5 dark:border-purple-900/40 dark:bg-[#0f0a17] dark:shadow-purple-950/20">
          {/* Top Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded border border-purple-500/40 bg-purple-500/20" />
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
            </div>
            <div className="h-6 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800/60" />
          </div>

          {/* Left Vertical Drawing Toolbar Strip */}
          <div className="absolute top-12 left-2 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800/80 dark:bg-[#0f0a17]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-800/60"
              />
            ))}
          </div>

          {/* Candlestick & SSA Wave Outlines */}
          <div className="absolute inset-x-12 top-14 bottom-4 flex animate-pulse items-center justify-between gap-1.5 opacity-30">
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
