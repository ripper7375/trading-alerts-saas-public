'use client';

import { useEffect, useState } from 'react';

import type { UpcomingEconomicEvent } from '@/lib/economic-events/queries';

/** Events shift on the order of minutes; re-asking every second is pointless. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * The next high-impact economic event, or `null`.
 *
 * Fetches the event's TIME, not a countdown — the caller ticks the clock
 * locally, so one request every few minutes yields a countdown that stays
 * accurate to the second without a socket or a per-second poll.
 *
 * `null` covers every "nothing to show" case alike: the lane is not deployed
 * yet, the table is empty, the caller lacks PRO, or the request failed. All of
 * them should render as no news row rather than an error or a placeholder
 * countdown to an event that does not exist.
 */
export function useUpcomingEvent(): UpcomingEconomicEvent | null {
  const [event, setEvent] = useState<UpcomingEconomicEvent | null>(null);

  useEffect(() => {
    // Aborted on unmount so an in-flight request cannot resolve into a
    // torn-down tree — a floating fetch outliving its test surfaced as a
    // failure in an unrelated suite once already (LESSONS-LEARNED.md L40).
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch('/api/market/economic-events', {
          signal: controller.signal,
        });
        if (!res.ok) {
          setEvent(null);
          return;
        }
        const data: { events?: UpcomingEconomicEvent[] } = await res.json();
        setEvent(data.events?.[0] ?? null);
      } catch {
        // Includes the AbortError from unmount. Nothing to report: the absence
        // of a news row is the correct rendering of "we do not know".
        setEvent(null);
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return event;
}
