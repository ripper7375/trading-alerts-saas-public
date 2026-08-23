export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Symbol/timeframe selector skeleton */}
      <div className="flex gap-4">
        <div className="h-10 w-40 rounded bg-gray-800" />
        <div className="h-10 w-40 rounded bg-gray-800" />
      </div>

      {/* Chart skeleton */}
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-700 bg-gray-800">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-700 border-t-gray-500" />
          <p className="text-sm text-gray-400">Loading chart...</p>
        </div>
      </div>

      {/* Indicators skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded border border-gray-700 bg-gray-800"
          />
        ))}
      </div>
    </div>
  );
}
