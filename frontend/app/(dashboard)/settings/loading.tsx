export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div className="h-8 w-32 bg-gray-700 rounded" />

      {/* Settings form skeleton */}
      <div className="max-w-2xl space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-gray-700 rounded" />
            <div className="h-10 bg-gray-800 rounded border border-gray-700" />
          </div>
        ))}

        {/* Save button skeleton */}
        <div className="h-10 w-32 bg-gray-800 rounded" />
      </div>
    </div>
  );
}
