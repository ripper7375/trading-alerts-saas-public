'use client';

/**
 * useSessionCountdown — live seconds-remaining until `targetUnixSeconds`,
 * ticking once per second.
 *
 * Generalized from `session-status-banner.tsx`'s own inline
 * `useState`+`useEffect(setInterval(tick, 1000))` pattern (that component
 * ticks a `Date` directly since it needs several derived countdowns at
 * once; this hook is the single-target version needed here). Computed only
 * client-side post-mount, same reason as that component: a countdown
 * depends on the current instant, so rendering it during SSR guarantees a
 * hydration mismatch.
 *
 * @module components/currency-index-pro/hooks/use-session-countdown
 */

import { useEffect, useState } from 'react';

/** `null` while `targetUnixSeconds` is `null` (no session boundary known
 * yet, e.g. Lane 4 hasn't pushed today's first bar), or before the first
 * client-side tick has run. */
export function useSessionCountdown(
  targetUnixSeconds: number | null
): number | null {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (targetUnixSeconds === null) {
      setSecondsRemaining(null);
      return;
    }

    const tick = (): void => {
      setSecondsRemaining(
        Math.max(0, targetUnixSeconds - Math.floor(Date.now() / 1000))
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return (): void => clearInterval(timer);
  }, [targetUnixSeconds]);

  return secondsRemaining;
}
