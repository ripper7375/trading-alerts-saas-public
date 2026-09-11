'use client';

import useSWR from 'swr';

import type { CurrencyGoldIndexSnapshot } from '@/lib/currency-gold-indices/queries';

interface CurrencyGoldIndicesResponse {
  indices: CurrencyGoldIndexSnapshot[];
}

const fetcher = (url: string): Promise<CurrencyGoldIndicesResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<CurrencyGoldIndicesResponse>;
  });

/**
 * Data hook for the public Lane 4 landing-page widget.
 *
 * SWR, not the plain fetch+useEffect+setInterval pattern
 * components/market-sessions/useContainmentRates.ts and
 * useUpcomingEvents.ts use: this route is genuinely public and cacheable
 * (no per-user variation, a real Redis cache in front of it -- see
 * app/api/market/currency-gold-indices/route.ts), so SWR's
 * revalidate-on-focus/dedup semantics are a real fit here in a way they
 * aren't for those two per-session, PRO-gated panels. A 60s poll matches the
 * route's own cache TTL, so polling faster would only ever re-fetch the same
 * cached response.
 */
export function useCurrencyGoldIndices(): {
  indices: CurrencyGoldIndexSnapshot[];
  isLoading: boolean;
  error: unknown;
} {
  const { data, error, isLoading } = useSWR<CurrencyGoldIndicesResponse>(
    '/api/market/currency-gold-indices',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  return {
    indices: data?.indices ?? [],
    isLoading,
    error,
  };
}
