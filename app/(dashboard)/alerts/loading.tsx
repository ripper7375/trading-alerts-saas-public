export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-gray-700" />
        <div className="h-10 w-32 rounded bg-gray-800" />
      </div>

      {/* Alerts list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-gray-700 bg-gray-800"
          />
        ))}
      </div>
    </div>
  );
}
