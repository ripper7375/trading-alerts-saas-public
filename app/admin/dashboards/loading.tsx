import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown inside `dashboards/layout.tsx` (header and tab bar stay) while a BI
 * dashboard's analytics queries run: a row of metric cards and two panels.
 */
export default function Loading(): React.ReactElement {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
