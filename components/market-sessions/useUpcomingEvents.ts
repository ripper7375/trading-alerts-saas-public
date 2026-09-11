'use client';

import { useEffect, useState } from 'react';

import type { UpcomingEconomicEvent } from '@/lib/economic-events/queries';

/** Events shift on the order of minutes; re-asking every second is pointless. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Upcoming high-impact economic events, soonest first, or `[]`.
 *
 * Fetches events' TIMEs, not countdowns — the caller ticks the clock
 * locally, so one request every few minutes yields countdowns that stay
 * accurate to the second without a socket or a per-second poll. The route
 * already returns up to 10 events (`getUpcomingHighImpactEvents()`'s own
 * default `limit`), so no separate "give me more" request is needed for a
 * caller that wants the full list rather than just the next one.
 *
 * `[]` covers every "nothing to show" case alike: the lane is not deployed
 * yet, the table is empty, the caller lacks PRO, or the request failed. All
 * of them should render as no news row rather than an error or a placeholder
 * countdown to an event that does not exist.
 */
export function useUpcomingEvents(): UpcomingEconomicEvent[] {
  const [events, setEvents] = useState<UpcomingEconomicEvent[]>([]);

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
          setEvents([]);
          return;
        }
        const data: { events?: UpcomingEconomicEvent[] } = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // Includes the AbortError from unmount. Nothing to report: the absence
        // of a news row is the correct rendering of "we do not know".
        setEvents([]);
      }
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return events;
}
