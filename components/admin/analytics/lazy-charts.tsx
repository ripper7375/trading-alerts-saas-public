'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * The BI dashboards' recharts charts, loaded on demand.
 *
 * The dashboards are Server Components, and `next/dynamic(..., { ssr: false })`
 * is not allowed in one, so the two calls live here in a Client Component the
 * pages import instead of the charts. recharts then stays out of every admin
 * page's first bundle, and the chart is drawn in the browser anyway (its
 * `ResponsiveContainer` measures the DOM and renders nothing on the server).
 * Each placeholder is the box the chart fills, so nothing moves when it lands.
 */

/** `HistoricalTrendChart` fills a `h-64 w-full` box. */
export const LazyHistoricalTrendChart = dynamic(
  () =>
    import('@/components/admin/analytics/historical-trend-chart').then(
      (mod) => mod.HistoricalTrendChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton aria-busy="true" className="h-64 w-full" />,
  }
);

/** `DonutMarketShare` is a `h-52 w-52` ring beside its legend. */
export const LazyDonutMarketShare = dynamic(
  () =>
    import('@/components/admin/analytics/donut-market-share').then(
      (mod) => mod.DonutMarketShare
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Skeleton
          aria-busy="true"
          className="h-52 w-52 shrink-0 rounded-full"
        />
      </div>
    ),
  }
);
