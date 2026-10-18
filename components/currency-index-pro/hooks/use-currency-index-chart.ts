'use client';

/**
 * useCurrencyIndexChart — polls GET /api/market/currency-index-pro/chart.
 *
 * Plain fetch+useEffect polling through `startVisiblePolling` (paused while
 * the tab is hidden, never two requests at once, aborted on unmount),
 * mirroring `useUpcomingEvents.ts`/`useContainmentRates.ts` -- this route is
 * session+PRO-gated, not the genuinely public/cacheable shape SWR is
 * reserved for elsewhere in this codebase (`useCurrencyGoldIndices.ts`).
 *
 * @module components/currency-index-pro/hooks/use-currency-index-chart
 */

import { useEffect, useState } from 'react';

import {
  startVisiblePolling,
  type PollRequest,
} from '@/lib/utils/visible-polling';

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
    const load = async ({ signal, isStopped }: PollRequest): Promise<void> => {
      try {
        const res = await fetch(
          `/api/market/currency-index-pro/chart?timeframe=${timeframe}`,
          { signal }
        );
        const next = res.ok
          ? ((await res.json()) as CurrencyIndexChartData)
          : EMPTY_DATA;
        if (!isStopped()) setData(next);
      } catch {
        // An unmount or a timeframe change aborts the request and the next
        // effect owns `data` from then on: the aborted call must not wipe it
        // (it used to blank the chart between the switch and the new answer).
        // A timeout or a network failure still degrades to EMPTY_DATA.
        if (!isStopped()) setData(EMPTY_DATA);
      }
    };

    return startVisiblePolling(load, REFRESH_MS);
  }, [timeframe]);

  return data;
}
