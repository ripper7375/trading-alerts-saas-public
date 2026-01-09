export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Symbol/timeframe selector skeleton */}
      <div className="flex gap-4">
        <div className="h-10 w-40 bg-gray-800 rounded" />
        <div className="h-10 w-40 bg-gray-800 rounded" />
      </div>

      {/* Chart skeleton */}
      <div className="h-[500px] bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-gray-700 border-t-gray-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading chart...</p>
        </div>
      </div>

      {/* Indicators skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-800 rounded border border-gray-700" />
        ))}
      </div>
    </div>
  );
}
