export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page title skeleton */}
      <div className="h-8 w-32 rounded bg-muted" />

      {/* Settings form skeleton */}
      <div className="max-w-2xl space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="bg-muted/60 h-10 rounded border border-border" />
          </div>
        ))}

        {/* Save button skeleton */}
        <div className="h-10 w-32 rounded bg-muted" />
      </div>
    </div>
  );
}
