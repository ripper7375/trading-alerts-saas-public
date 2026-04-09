// app/dashboard/chart/loading.tsx
// Suspense loading skeleton — shown while server component fetches data.

export default function ChartLoadingSkeleton() {
  return (
    <div className="flex h-screen w-full animate-pulse flex-col bg-gray-950">
      {/* Toolbar skeleton */}
      <div className="h-12 flex-none border-b border-gray-800 bg-gray-900/50" />

      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        {/* Left panel skeleton */}
        <div className="flex flex-[3] items-center justify-center rounded-lg border border-blue-500/10 bg-gray-900/60">
          <span className="text-sm text-gray-600">Loading chart…</span>
        </div>

        {/* Right panel skeleton */}
        <div className="flex flex-[2] flex-col gap-2">
          <div className="flex flex-[55] items-center justify-center rounded-lg border border-green-500/10 bg-gray-900/60">
            <span className="text-sm text-gray-600">Loading heatmap…</span>
          </div>
          <div className="flex flex-[45] gap-2">
            {['HMI', 'RPI', 'BPI'].map((g) => (
              <div
                key={g}
                className="flex flex-1 items-center justify-center rounded-lg border border-green-500/10 bg-gray-900/60"
              >
                <span className="text-xs text-gray-600">{g}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { ChartLoadingSkeleton };
