import { Skeleton } from '@/components/ui/skeleton';

/**
 * The placeholder shown while a chart's code loads (`next/dynamic`,
 * `ssr: false`). It is the chart's own card (same border, padding and radius)
 * around a block of the chart's own height, so when the chart arrives nothing
 * below it moves.
 */
export function ChartSkeleton({
  height,
}: {
  /** The chart's plot height in pixels: the `height` prop it is rendered with. */
  height: number;
}): React.ReactElement {
  return (
    <div
      aria-busy="true"
      data-slot="chart-skeleton"
      className="w-full rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}
