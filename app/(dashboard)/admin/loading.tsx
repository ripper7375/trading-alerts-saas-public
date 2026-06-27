export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-gray-700" />
        <div className="h-4 w-64 rounded bg-gray-800" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 space-y-2 rounded-lg border border-gray-700 bg-gray-800 p-4"
          >
            <div className="h-4 w-20 rounded bg-gray-700" />
            <div className="h-6 w-16 rounded bg-gray-700" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="h-64 rounded-lg border border-gray-700 bg-gray-800" />
    </div>
  );
}
