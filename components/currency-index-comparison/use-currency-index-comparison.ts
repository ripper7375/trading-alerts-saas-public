'use client';

import useSWR from 'swr';

import type {
  ComparisonIndexName,
  ComparisonSeries,
  ComparisonTimeframe,
} from '@/lib/currency-index-comparison/series';

interface ComparisonResponse {
  timeframe: ComparisonTimeframe;
  series: ComparisonSeries[];
}

const fetcher = (url: string): Promise<ComparisonResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<ComparisonResponse>;
  });

/**
 * Data hook for /pro/currency-index/compare. Same SWR shape and 60s refresh as
 * the public page's useCurrencyGoldIndexHistory (Lane 4 writes one bar every 5
 * minutes, so polling faster buys nothing), keyed by the selected indices and
 * timeframe so each combination is fetched and cached client-side on its own.
 *
 * HRMA/SMMA periods, plot type and rebase are NOT part of the key: all of them
 * are computed from these candles in the browser.
 */
export function useCurrencyIndexComparison(
  indices: readonly ComparisonIndexName[],
  timeframe: ComparisonTimeframe
): {
  series: ComparisonSeries[];
  isLoading: boolean;
  error: unknown;
} {
  const key =
    indices.length > 0
      ? `/api/market/currency-index-pro/comparison?indices=${indices.join(',')}&timeframe=${timeframe}`
      : null;

  const { data, error, isLoading } = useSWR<ComparisonResponse>(key, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    // Swapping one index keeps the other on screen instead of blanking both.
    keepPreviousData: true,
  });

  return { series: data?.series ?? [], isLoading, error };
}
