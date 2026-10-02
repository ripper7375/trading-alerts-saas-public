import { DataStatusResult, computeDataStatus } from '../data-status';
import type { ReaderCycle } from '../read/read-types';
import { Timeframe, slotOf } from '../slot';
import type { ActiveIndicator } from './active-indicator.service';

/**
 * The body of `GET /api/v1/cycles/current` (STACK-D-ARCHITECTURE.md rules 6 and 7):
 * the newest READY cycle with its status and timings, and the active indicators
 * in force AT THAT CYCLE'S SLOT. One call gives a consumer a consistent picture:
 * the status and the setting it reads are the ones of the same cycle.
 *
 * The monolith and the VPS renderer call this endpoint; the sensor worker calls
 * the same functions in process. A change to this shape is a contract change: the
 * monolith's client validates it and its tests read the fixture this module's
 * spec writes the expected body of (test/fixtures/cycles-current-*.json).
 */

export const CURRENT_CYCLE_CONTRACT = 'cycles-current/1';

/**
 * Which slot the settings were resolved at:
 *   CYCLE           the newest READY cycle's slot (the default; what the monolith asks);
 *   WALL_CLOCK      the wall-clock slot, because there is no READY cycle;
 *   REQUESTED_SLOT  the slot the caller named with `?slot=` (the VPS renderer: it renders
 *                   slot S about a minute before the gateway has S READY, and must get the
 *                   setting AT S, the one the sensors use for the same cycle).
 */
export type ResolutionBasis = 'CYCLE' | 'WALL_CLOCK' | 'REQUESTED_SLOT';

export interface CurrentCycleBody {
  readonly contract: typeof CURRENT_CYCLE_CONTRACT;
  /** The gateway's clock when it answered, unix UTC seconds. */
  readonly now: number;
  /** The newest READY cycle, or null when there is none (an empty database, or nothing usable). */
  readonly cycle: {
    readonly slot: number;
    /** The cycle's own status when it was declared ready: FRESH or DELAYED. */
    readonly status: 'FRESH' | 'DELAYED';
    readonly attempts: number;
    readonly retuning: boolean;
    readonly closedBarsDigest: string | null;
    /** What the cycle's check recorded, for example STATISTICS_SHORTFALL; null for a clean cycle. */
    readonly checkReason: string | null;
    readonly timings: {
      /** Gateway clock. */
      readonly readyAt: number;
      readonly manifestReceivedAt: number;
      /** `readyAt - slot`: the slot-to-ready time section 1.8 asks to be measured. */
      readonly slotToReadySec: number;
      /** `readyAt - manifestReceivedAt`: the gateway's share of it. */
      readonly gatewaySec: number;
      /** VPS clock. */
      readonly collectorStartedAt: number | null;
      readonly collectorValidatedAt: number | null;
      /** When each MT5 export was written (file mtime). */
      readonly m5ExportAt: number | null;
      readonly m15ExportAt: number | null;
    };
  } | null;
  /** Rule 7: what a reader may trust NOW (FRESH, DELAYED, STALE, MARKET_CLOSED) and why. */
  readonly dataStatus: DataStatusResult;
  readonly activeIndicators: {
    /** The slot the settings were resolved at (see ResolutionBasis). */
    readonly resolvedAtSlot: number;
    readonly basis: ResolutionBasis;
    /** Null for a timeframe that has no setting at all: unknown, never guessed. */
    readonly byTimeframe: Record<Timeframe, ActiveIndicator | null>;
  };
}

/**
 * The slot every consumer resolves the setting at: the one the caller named, else
 * the newest READY cycle's own, else the wall-clock slot.
 */
export function resolutionSlot(
  now: number,
  cycle: ReaderCycle | null,
  requestedSlot: number | null = null
): { slot: number; basis: ResolutionBasis } {
  if (requestedSlot !== null) {
    return { slot: requestedSlot, basis: 'REQUESTED_SLOT' };
  }
  return cycle
    ? { slot: cycle.slot, basis: 'CYCLE' }
    : { slot: slotOf(now), basis: 'WALL_CLOCK' };
}

export function buildCurrentCycleBody(input: {
  now: number;
  cycle: ReaderCycle | null;
  /** The settings, already resolved at `resolutionSlot(now, cycle, requestedSlot).slot`. */
  indicators: Record<Timeframe, ActiveIndicator | null>;
  requestedSlot?: number | null;
}): CurrentCycleBody {
  const { now, cycle, indicators, requestedSlot = null } = input;
  const resolved = resolutionSlot(now, cycle, requestedSlot);
  return {
    contract: CURRENT_CYCLE_CONTRACT,
    now,
    cycle: cycle
      ? {
          slot: cycle.slot,
          status: cycle.dataStatus,
          attempts: cycle.attempts,
          retuning: cycle.retuning,
          closedBarsDigest: cycle.closedBarsDigest,
          checkReason: cycle.checkReason,
          timings: {
            readyAt: cycle.readyAt,
            manifestReceivedAt: cycle.manifestReceivedAt,
            slotToReadySec: cycle.readyAt - cycle.slot,
            gatewaySec: cycle.readyAt - cycle.manifestReceivedAt,
            collectorStartedAt: cycle.collectorStartedAt,
            collectorValidatedAt: cycle.collectorValidatedAt,
            m5ExportAt: cycle.m5ExportAt,
            m15ExportAt: cycle.m15ExportAt,
          },
        }
      : null,
    dataStatus: computeDataStatus({
      now,
      latestReadyCycle: cycle
        ? { slot: cycle.slot, readyAt: cycle.readyAt, attempts: cycle.attempts }
        : null,
    }),
    activeIndicators: {
      resolvedAtSlot: resolved.slot,
      basis: resolved.basis,
      byTimeframe: indicators,
    },
  };
}
