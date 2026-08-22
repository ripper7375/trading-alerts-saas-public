export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Welcome header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-gray-700" />
        <div className="h-4 w-48 rounded bg-gray-800" />
      </div>

      {/* Quick stats skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-gray-700 bg-gray-800"
          />
        ))}
      </div>

      {/* Recent alerts skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 rounded bg-gray-700" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded border border-gray-700 bg-gray-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
