import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { RELATIVE_STRENGTH_CHART_HEIGHT } from '@/components/currency-index-pro/chart/relative-strength-config';

/**
 * Shown while the cockpit's page (session and tier check) runs: the page
 * navigation row, the chart at its own height and the two tables below it,
 * so the cockpit appears in place. The `compare` page below this segment
 * shows it too.
 */
export default function Loading(): React.ReactElement {
  return (
    <div aria-busy="true" className="space-y-4 p-4">
      <Skeleton className="h-10 w-full max-w-md" />
      <ChartSkeleton height={RELATIVE_STRENGTH_CHART_HEIGHT} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
