/**
 * Freshness thresholds for a cycle's data status
 * (STACK-D-ARCHITECTURE.md section 1.4 item 7, ADR-012).
 *
 * STARTING VALUES, to be confirmed on the first real, measured cycles
 * (section 1.8 and Appendix D). They live in this one file on purpose: confirming
 * or changing one is a one-line edit here plus a new decision entry, never a
 * hunt through the readers. Nothing else in the gateway may restate them.
 *
 *   readyDeadlineSec            a cycle should be ready within 2 minutes of its
 *                               slot when the collector needed no retry.
 *   readyDeadlineWithRetriesSec the deadline when the collector retried
 *                               (3 attempts, 65 s apart: about 200 s at worst).
 *   staleAfterSec               STALE once no ready cycle has existed for 10
 *                               minutes. Matches the VPS stale-export guard
 *                               (MAX_BAR_LAG_MULTIPLIER 2 x 300 s = 600 s).
 */
export interface FreshnessThresholds {
  readonly readyDeadlineSec: number;
  readonly readyDeadlineWithRetriesSec: number;
  readonly staleAfterSec: number;
}

export const FRESHNESS_THRESHOLDS: FreshnessThresholds = Object.freeze({
  readyDeadlineSec: 2 * 60,
  readyDeadlineWithRetriesSec: 4 * 60,
  staleAfterSec: 10 * 60,
});
