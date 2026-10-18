/**
 * startVisiblePolling — the one loop behind the client hooks that re-ask an
 * API on a fixed interval (`useCurrencyIndexChart`, `useCurrencyIndexScreener`,
 * `useEventMarkers`, `useUpcomingEvents`, `useContainmentRates`).
 *
 * It does what `lib/fx/use-display-usd-rates.ts` does for the FX rates, once,
 * instead of five hand-copied variants:
 *
 * - **Pause while hidden.** A tick that fires while `document.visibilityState`
 *   is `'hidden'` sends nothing, and the first moment the tab is visible again
 *   the poll runs at once, so a returning visitor never waits a full interval
 *   for fresh data. A tab that was hidden for less than one interval (no tick
 *   was skipped) is not refreshed on return.
 * - **No overlap.** A tick (or a return to the tab) while a request is still
 *   in flight is dropped; two requests of one hook are never open together.
 * - **A stuck request cannot stall the loop.** Every request is aborted after
 *   `requestTimeoutMs`, so the overlap guard cannot hold the loop forever on
 *   a call that never answers.
 * - **Stopping is final.** The returned function aborts the request in
 *   flight and removes the timer and the listener; `isStopped()` tells the
 *   poll function that its effect is gone (unmount, a dependency changed), so
 *   a late answer must not write state that now belongs to the next effect.
 *
 * `poll` owns its own error handling (the hooks degrade to "no data" and never
 * throw); a rejection is swallowed here only so that one bad tick cannot end
 * the loop or surface as an unhandled rejection.
 *
 * @module lib/utils/visible-polling
 */

/** An unanswered request is abandoned after this long (as in `use-display-usd-rates.ts`). */
export const POLL_REQUEST_TIMEOUT_MS = 10_000;

export interface PollRequest {
  /** Aborts when the request times out, or when the poller is stopped. */
  signal: AbortSignal;
  /**
   * `true` once the poller was stopped (unmount, changed dependencies).
   * Unlike `signal.aborted` it is NOT set by a request timeout, so a poll
   * function can tell "my effect is gone, stay silent" from "the request
   * failed, degrade".
   */
  isStopped: () => boolean;
}

/**
 * Starts polling: one request now (if the tab is visible), then one per
 * `intervalMs`. Returns the stop function for the effect's cleanup.
 */
export function startVisiblePolling(
  poll: (request: PollRequest) => Promise<void>,
  intervalMs: number,
  requestTimeoutMs: number = POLL_REQUEST_TIMEOUT_MS
): () => void {
  let stopped = false;
  let activeRequest: AbortController | null = null;
  let activeTimeout: ReturnType<typeof setTimeout> | undefined;
  let skippedWhileHidden = false;

  const isStopped = (): boolean => stopped;

  const run = async (): Promise<void> => {
    if (stopped || activeRequest) return;
    const request = new AbortController();
    activeRequest = request;
    const timeout = setTimeout(() => request.abort(), requestTimeoutMs);
    activeTimeout = timeout;
    try {
      await poll({ signal: request.signal, isStopped });
    } catch {
      // `poll` handles its own failures; this only keeps the loop alive.
    } finally {
      clearTimeout(timeout);
      if (activeRequest === request) {
        activeRequest = null;
        activeTimeout = undefined;
      }
    }
  };

  const tick = (): void => {
    if (document.visibilityState === 'hidden') {
      skippedWhileHidden = true;
      return;
    }
    void run();
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden' || !skippedWhileHidden) return;
    skippedWhileHidden = false;
    void run();
  };

  const timer = setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', onVisibilityChange);
  tick();

  return (): void => {
    stopped = true;
    clearInterval(timer);
    clearTimeout(activeTimeout);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    activeRequest?.abort();
  };
}
