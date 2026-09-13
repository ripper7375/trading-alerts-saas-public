'use client';

import useSWR from 'swr';

import type { CurrencyGoldIndexHistorySeries } from '@/lib/currency-gold-indices/queries';
import type { ComparisonTimeframe } from '@/lib/currency-gold-indices/history';

interface CurrencyGoldIndexHistoryResponse {
  timeframe: ComparisonTimeframe;
  series: CurrencyGoldIndexHistorySeries[];
}

const fetcher = (url: string): Promise<CurrencyGoldIndexHistoryResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<CurrencyGoldIndexHistoryResponse>;
  });

/**
 * Data hook for the public XAUX vs USDX comparison chart page. Same SWR
 * shape as useCurrencyGoldIndices.ts (this route is public and cached, same
 * reasoning as that hook's own doc comment) -- keyed by timeframe so
 * switching the M5/M15 toggle fetches (and independently caches, client-side)
 * its own series rather than reusing the other timeframe's data.
 */
export function useCurrencyGoldIndexHistory(timeframe: ComparisonTimeframe): {
  series: CurrencyGoldIndexHistorySeries[];
  isLoading: boolean;
  error: unknown;
} {
  const { data, error, isLoading } = useSWR<CurrencyGoldIndexHistoryResponse>(
    `/api/market/currency-gold-indices/history?timeframe=${timeframe}`,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  return {
    series: data?.series ?? [],
    isLoading,
    error,
  };
}
