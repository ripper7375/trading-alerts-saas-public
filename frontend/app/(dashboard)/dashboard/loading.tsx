export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Welcome header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-gray-700 rounded" />
        <div className="h-4 w-48 bg-gray-800 rounded" />
      </div>

      {/* Quick stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-lg border border-gray-700" />
        ))}
      </div>

      {/* Recent alerts skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-gray-700 rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded border border-gray-700" />
          ))}
        </div>
      </div>
    </div>
  );
}
