'use client';

import { useEffect, useState } from 'react';

import type { LatestContainmentRate } from '@/lib/indicator-statistics/queries';

/** Statistics update on the order of minutes; re-asking every second is pointless. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Latest containment-rate reading per (symbol, timeframe, source), or `[]`.
 *
 * `[]` covers every "nothing to show" case alike: the table is not migrated
 * yet, the VPS indicators have not emitted a capture with the containment
 * fields populated, the caller lacks PRO, or the request failed. All of
 * them should render as no panel content rather than an error or a
 * fabricated figure.
 */
export function useContainmentRates(): LatestContainmentRate[] {
  const [rates, setRates] = useState<LatestContainmentRate[]>([]);

  useEffect(() => {
    // Aborted on unmount so an in-flight request cannot resolve into a
    // torn-down tree -- same shape as useUpcomingEvents.
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch('/api/market/indicator-statistics', {
          signal: controller.signal,
        });
        if (!res.ok) {
          setRates([]);
          return;
        }
        const data: { rates?: LatestContainmentRate[] } = await res.json();
        setRates(data.rates ?? []);
      } catch {
        // Includes the AbortError from unmount. Nothing to report: an empty
        // panel is the correct rendering of "we do not know".
        setRates([]);
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return rates;
}
