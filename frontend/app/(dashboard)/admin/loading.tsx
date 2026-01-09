export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-gray-700 rounded" />
        <div className="h-4 w-64 bg-gray-800 rounded" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-2">
            <div className="h-4 w-20 bg-gray-700 rounded" />
            <div className="h-6 w-16 bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="h-64 bg-gray-800 rounded-lg border border-gray-700" />
    </div>
  );
}
