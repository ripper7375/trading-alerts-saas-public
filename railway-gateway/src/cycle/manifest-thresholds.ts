/**
 * Starting values for how the gateway treats a cycle manifest while it waits for
 * the rows and statistics it describes to land (ADR-009).
 *
 * Starting values to confirm on the first real cycles, like the ADR-012
 * freshness thresholds in thresholds.ts, and kept in one place for the same
 * reason. None of them is a freshness rule: they decide how long the gateway
 * keeps checking, not whether a cycle was on time (cycleStatus() does that).
 */
export interface ManifestThresholds {
  /** Wait between two landed-row checks of the same manifest. */
  readonly recheckDelayMs: number;
  /**
   * The bars a manifest describes must have landed within this many seconds of
   * the manifest arriving, or the cycle is recorded INCOMPLETE. The sender
   * acknowledges every row before it sends the manifest, so the rows are
   * normally already queued ahead of it; this covers a queue backlog and a row
   * job that failed and is waiting to be retried.
   */
  readonly landedGiveUpAfterSec: number;
  /**
   * Statistics travel on their own queue and may land a moment after the bars.
   * Past this many seconds the cycle is declared ready WITHOUT them, with the
   * shortfall recorded: a sensor then finds no statistics at the slot and
   * reports STALE (rule 5), which is the honest answer and no reason to hold
   * back every reading that does not need them.
   */
  readonly statisticsGraceSec: number;
  /**
   * A manifest for a slot older than this is recorded INCOMPLETE and never
   * announced. Equals the sender's MANIFEST_MAX_AGE_SEC (a test reads it from
   * the push worker's source), so a manifest the sender would no longer send is
   * not one the gateway would act on either.
   */
  readonly staleManifestAfterSec: number;
  /**
   * A slot this far ahead of the gateway's clock is not a clock difference, it
   * is a wrong manifest: refused with 400.
   */
  readonly futureSlotToleranceSec: number;
}

export const MANIFEST_THRESHOLDS: ManifestThresholds = Object.freeze({
  recheckDelayMs: 5_000,
  landedGiveUpAfterSec: 120,
  statisticsGraceSec: 30,
  staleManifestAfterSec: 3600,
  futureSlotToleranceSec: 600,
});
