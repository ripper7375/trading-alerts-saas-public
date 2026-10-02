import { isMarketOpenXauusd } from './market-hours';
import { SLOT_SECONDS, isSlot, slotOf } from './slot';
import { FRESHNESS_THRESHOLDS, FreshnessThresholds } from './thresholds';

/**
 * Data status (STACK-D-ARCHITECTURE.md section 1.3 rule 7, section 1.4 item 7,
 * ADR-012).
 *
 * Two questions, kept apart because they have different inputs:
 *
 *   cycleStatus()        "was this cycle ready in time?" Asked once, when the
 *                        cycle is written. Answer: FRESH or DELAYED. Stored on
 *                        the market_cycles row.
 *   computeDataStatus()  "what may a reader trust right now?" Asked on every
 *                        read. Answer: FRESH, DELAYED, STALE or MARKET_CLOSED,
 *                        with the reason and the slot the data is as of.
 *
 * RETUNING (rule 9, ADR-015) is not a fifth value here. It overlays a status
 * rather than replacing one (sensors report CAUTIONARY, the cycle still has a
 * freshness), and it arrives with the promote work in part 9.
 *
 * Downstream sections decide what each status ALLOWS (sections 5.3 and 6.4);
 * this file only decides which status holds.
 */

export const DATA_STATUSES = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

/** A cycle's own status: it was either ready in time or it was not. */
export type CycleDataStatus = Extract<DataStatus, 'FRESH' | 'DELAYED'>;

/** The facts about a ready cycle that the status depends on (a market_cycles row). */
export interface ReadyCycle {
  /** The cycle's slot, unix UTC seconds, on a 5-minute boundary. */
  readonly slot: number;
  /** When the gateway declared the cycle ready, unix UTC seconds. */
  readonly readyAt: number;
  /** Collector attempts the cycle needed; 1 is first try. More earns the longer deadline. */
  readonly attempts: number;
}

export type DataStatusReason =
  | 'MARKET_CLOSED'
  | 'CYCLE_READY_IN_TIME'
  | 'CYCLE_READY_LATE'
  | 'AWAITING_CURRENT_CYCLE'
  | 'CURRENT_CYCLE_OVERDUE'
  | 'CYCLE_MISSED'
  | 'NO_READY_CYCLE_WITHIN_STALE_WINDOW'
  | 'NO_READY_CYCLE'
  | 'INVALID_CYCLE_ROW';

export interface DataStatusResult {
  readonly status: DataStatus;
  readonly reason: DataStatusReason;
  /**
   * The slot of the newest ready cycle ("data as of hh:mm UTC", section 5.3), or
   * null when there is none or its row is unusable. Present for MARKET_CLOSED
   * too: that is the "last session's picture" a reader labels.
   */
  readonly dataAsOfSlot: number | null;
  /** Seconds since that cycle was declared ready (never negative), or null. */
  readonly secondsSinceReady: number | null;
}

/** Why a row cannot be trusted, or null when it is usable. */
function invalidReason(cycle: ReadyCycle): string | null {
  if (!isSlot(cycle.slot))
    return `slot ${cycle.slot} is not on a slot boundary`;
  if (!Number.isFinite(cycle.readyAt) || cycle.readyAt < cycle.slot) {
    return `readyAt ${cycle.readyAt} is not at or after slot ${cycle.slot}`;
  }
  if (!Number.isInteger(cycle.attempts) || cycle.attempts < 1) {
    return `attempts ${cycle.attempts} is not a positive integer`;
  }
  return null;
}

/**
 * FRESH when the cycle was ready within its deadline, otherwise DELAYED. The
 * deadline is 2 minutes after the slot, or 4 when the collector had to retry.
 * The boundary is inclusive: ready exactly on the deadline is still in time.
 */
export function cycleStatus(
  cycle: ReadyCycle,
  thresholds: FreshnessThresholds = FRESHNESS_THRESHOLDS
): CycleDataStatus {
  const problem = invalidReason(cycle);
  if (problem) throw new RangeError(`invalid cycle: ${problem}`);

  const deadline =
    cycle.attempts > 1
      ? thresholds.readyDeadlineWithRetriesSec
      : thresholds.readyDeadlineSec;
  return cycle.readyAt - cycle.slot <= deadline ? 'FRESH' : 'DELAYED';
}

/**
 * What a reader may trust at `now`, given the newest ready cycle (or null).
 *
 * In order:
 *   1. The market-hours gate is closed -> MARKET_CLOSED, whatever the cycles say.
 *   2. No usable ready cycle -> STALE (a bad row fails closed, never open).
 *   3. The newest cycle is for the current slot -> its own status.
 *   4. The current slot has no ready cycle yet:
 *        - no ready cycle for staleAfterSec or more -> STALE;
 *        - the previous slot's cycle is the newest and the current one is still
 *          inside its ready deadline -> FRESH (nothing has gone wrong yet);
 *        - otherwise -> DELAYED.
 *
 * Two behaviours worth knowing before relying on this:
 *   - The live check uses the normal 2-minute deadline, because retries are not
 *     visible until a cycle completes. A cycle the collector retries can show
 *     DELAYED for up to two minutes and then be written FRESH (4-minute
 *     deadline). The conservative direction is deliberate; confirm on the first
 *     real cycles (ADR-012).
 *   - Just after the market reopens, the newest cycle is the previous session's,
 *     so this reports STALE until the first cycle of the new session is ready
 *     (about 6 minutes). That is literal rule 7 ("no ready cycle for 10
 *     minutes"), not a judgement that the feed is broken.
 */
export function computeDataStatus(
  input: { now: number; latestReadyCycle: ReadyCycle | null },
  thresholds: FreshnessThresholds = FRESHNESS_THRESHOLDS
): DataStatusResult {
  const { now, latestReadyCycle } = input;
  if (!Number.isFinite(now)) {
    throw new RangeError(`now must be a finite unix time, got ${String(now)}`);
  }

  const usable =
    latestReadyCycle !== null && invalidReason(latestReadyCycle) === null
      ? latestReadyCycle
      : null;
  const dataAsOfSlot = usable ? usable.slot : null;
  const secondsSinceReady = usable ? Math.max(0, now - usable.readyAt) : null;
  const result = (
    status: DataStatus,
    reason: DataStatusReason
  ): DataStatusResult => ({
    status,
    reason,
    dataAsOfSlot,
    secondsSinceReady,
  });

  if (!isMarketOpenXauusd(now)) return result('MARKET_CLOSED', 'MARKET_CLOSED');
  if (latestReadyCycle === null) return result('STALE', 'NO_READY_CYCLE');
  if (usable === null) return result('STALE', 'INVALID_CYCLE_ROW');

  const currentSlot = slotOf(now);
  if (usable.slot >= currentSlot) {
    return cycleStatus(usable, thresholds) === 'FRESH'
      ? result('FRESH', 'CYCLE_READY_IN_TIME')
      : result('DELAYED', 'CYCLE_READY_LATE');
  }

  if ((secondsSinceReady as number) >= thresholds.staleAfterSec) {
    return result('STALE', 'NO_READY_CYCLE_WITHIN_STALE_WINDOW');
  }

  const previousSlotIsNewest = usable.slot === currentSlot - SLOT_SECONDS;
  if (previousSlotIsNewest) {
    // Inclusive, like cycleStatus: a cycle ready exactly on the deadline is
    // in time, so up to and including it nothing has gone wrong yet.
    return now - currentSlot <= thresholds.readyDeadlineSec
      ? result('FRESH', 'AWAITING_CURRENT_CYCLE')
      : result('DELAYED', 'CURRENT_CYCLE_OVERDUE');
  }
  return result('DELAYED', 'CYCLE_MISSED');
}
