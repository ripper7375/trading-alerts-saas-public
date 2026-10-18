'use client';

import { useEffect, useState } from 'react';

import type { LatestContainmentRate } from '@/lib/indicator-statistics/queries';
import {
  startVisiblePolling,
  type PollRequest,
} from '@/lib/utils/visible-polling';

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
    // torn-down tree, paused while the tab is hidden, one request at a time
    // -- same shape as useUpcomingEvents.
    const load = async ({ signal, isStopped }: PollRequest) => {
      try {
        const res = await fetch('/api/market/indicator-statistics', { signal });
        const data: { rates?: LatestContainmentRate[] } = res.ok
          ? await res.json()
          : {};
        if (!isStopped()) setRates(data.rates ?? []);
      } catch {
        // Nothing to report: an empty panel is the correct rendering of
        // "we do not know". (Unmount: nothing to write at all.)
        if (!isStopped()) setRates([]);
      }
    };

    return startVisiblePolling(load, REFRESH_MS);
  }, []);

  return rates;
}
