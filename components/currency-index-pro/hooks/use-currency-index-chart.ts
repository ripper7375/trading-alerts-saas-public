'use client';

/**
 * useCurrencyIndexChart — polls GET /api/market/currency-index-pro/chart.
 *
 * Plain fetch+useEffect+setInterval+AbortController, mirroring
 * `useUpcomingEvents.ts`/`useContainmentRates.ts` exactly -- this route is
 * session+PRO-gated, not the genuinely public/cacheable shape SWR is
 * reserved for elsewhere in this codebase (`useCurrencyGoldIndices.ts`).
 *
 * @module components/currency-index-pro/hooks/use-currency-index-chart
 */

import { useEffect, useState } from 'react';

const REFRESH_MS = 30 * 1000;

export interface CurrencyIndexBarPoint {
  barTime: number;
  changePct: number;
}

export interface CurrencyIndexCorridor {
  date: number;
  lookbackDays: number;
  strikeZonePct: number;
  extremeZonePct: number;
  meanExcursion: number;
  stdDev: number;
}

export interface CurrencyIndexNewsEvent {
  valueId: string;
  eventId: string;
  eventName: string;
  eventTime: number;
  currency: string;
  countryCode: string;
  importance: string;
  forecastValue: number | null;
  previousValue: number | null;
  digits: number | null;
  timeMode: number | null;
  sourceUrl: string | null;
}

export interface CurrencyIndexChartData {
  timeframe: 'M5' | 'M15';
  serverTime: number;
  todaySessionOpen: number | null;
  corridor: CurrencyIndexCorridor | null;
  highImpactNews: CurrencyIndexNewsEvent[];
  series: Record<string, CurrencyIndexBarPoint[]>;
}

const EMPTY_DATA: CurrencyIndexChartData = {
  timeframe: 'M15',
  serverTime: 0,
  todaySessionOpen: null,
  corridor: null,
  highImpactNews: [],
  series: {},
};

/** `null` while the very first request is in flight; degrades to
 * `EMPTY_DATA` (never a thrown error) on any failure, matching this app's
 * "an absent panel is honest, a broken one is not" convention. */
export function useCurrencyIndexChart(
  timeframe: 'M5' | 'M15'
): CurrencyIndexChartData | null {
  const [data, setData] = useState<CurrencyIndexChartData | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/market/currency-index-pro/chart?timeframe=${timeframe}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setData(EMPTY_DATA);
          return;
        }
        setData((await res.json()) as CurrencyIndexChartData);
      } catch {
        // Includes the AbortError from unmount/timeframe change.
        setData(EMPTY_DATA);
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return (): void => {
      controller.abort();
      clearInterval(timer);
    };
  }, [timeframe]);

  return data;
}
