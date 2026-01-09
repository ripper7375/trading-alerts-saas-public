export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-700 rounded" />
        <div className="h-10 w-32 bg-gray-800 rounded" />
      </div>

      {/* Alerts list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-gray-800 rounded-lg border border-gray-700" />
        ))}
      </div>
    </div>
  );
}
