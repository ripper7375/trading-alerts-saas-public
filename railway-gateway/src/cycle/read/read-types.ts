import type { IndicatorStatistic } from '@prisma/client';
import type { SpineBar } from '../closed-bars-digest';
import type { CycleDataStatus } from '../data-status';
import type { Timeframe } from '../slot';

/**
 * Result types of the read side (STACK-D-ARCHITECTURE.md section 1.3, rules 2 to 5).
 *
 * Every reader answers with a discriminated union and never throws for a data
 * condition: either `status: 'OK'` with the data, or `status: 'STALE'` with a
 * reason code. A STALE answer is the contract of rules 4 and 5, not an error: a
 * sensor given STALE writes a STALE reading instead of falling back to whatever
 * is newest. What the readers DO throw on is a caller bug (a `slot` that is not on
 * a slot boundary, an unknown timeframe or source, a window size out of range),
 * because passing "now" where a slot belongs is silent otherwise (see slot.ts).
 */

/** The single instrument of this pipeline. */
export const READER_SYMBOL = 'XAUUSD';

/** Most bars one read can ask for: the length of the export window each timeframe carries. */
export const MAX_CLOSED_BARS_PER_READ = 3000;

/**
 * The indicator sources a statistics row can belong to. A copy of the list in
 * `gateway/dto/indicator-statistic.dto.ts` (`@IsIn`), pinned to it by
 * test/cycle-readers.spec.ts: a source that is not in it is a typo, and a typo
 * would otherwise read as "no row at the slot" forever.
 */
export const STATISTIC_SOURCES = [
  'best_fit_a',
  'best_fit_b',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
  'fractal_edt',
  'resistance',
  'support',
  'sr_levels',
  'sr2_levels',
] as const;
export type StatisticSource = (typeof STATISTIC_SOURCES)[number];

export function isStatisticSource(value: unknown): value is StatisticSource {
  return (
    typeof value === 'string' &&
    (STATISTIC_SOURCES as readonly string[]).includes(value)
  );
}

export type StaleReason =
  /** No READY `market_cycles` row at the slot the timeframe was collected at. */
  | 'CYCLE_NOT_READY'
  /** A READY row that cannot be trusted (no ready time, a status that is not FRESH or DELAYED, bad attempts). */
  | 'INVALID_CYCLE_ROW'
  /** Fewer closed bars exist than were asked for. Never padded, never shortened silently. */
  | 'INSUFFICIENT_CLOSED_BARS'
  /** No statistics row at the slot, and the cycle did not record a shortfall for the timeframe. */
  | 'NO_STATISTICS_AT_SLOT'
  /** No statistics row at the slot, and the cycle went READY recording that statistics were short. */
  | 'STATISTICS_SHORTFALL';

export interface StaleResult {
  readonly status: 'STALE';
  readonly reason: StaleReason;
  /** The slot the caller asked about. */
  readonly slot: number;
  /** The slot the timeframe was last collected at (rule 5), when the question has one timeframe. */
  readonly collectedSlot?: number;
  readonly timeframe?: Timeframe;
  /** For logs and traces; not user-facing text. */
  readonly detail: string;
}

/** What a reader reports about the READY cycle that vouches for its data. */
export interface ReaderCycle {
  readonly slot: number;
  /** The cycle's own status, from the gateway: FRESH or DELAYED. Never STALE or MARKET_CLOSED. */
  readonly dataStatus: CycleDataStatus;
  readonly readyAt: number;
  readonly attempts: number;
  readonly retuning: boolean;
  /** SHA-256 of the closed-bar OHLC spine the cycle was declared ready on. */
  readonly closedBarsDigest: string | null;
  /** The reason the cycle's check recorded (for example STATISTICS_SHORTFALL), or null for a clean cycle. */
  readonly checkReason: string | null;
  /** When the MT5 export of each timeframe was written (file mtime), unix UTC; null when not carried. */
  readonly m5ExportAt: number | null;
  readonly m15ExportAt: number | null;
  /** The collection cycle that produced the M5 rows of this slot (provenance, ADR-008). */
  readonly m5CollectionCycleId: number | null;
  /** Gateway clock: when the manifest arrived. With `readyAt` it gives the gateway's share of the slot-to-ready time. */
  readonly manifestReceivedAt: number;
  /** VPS clock: when the collector first tried this slot, and when the M5 cycle passed validation. */
  readonly collectorStartedAt: number | null;
  readonly collectorValidatedAt: number | null;
}

export interface ClosedBarsOk {
  readonly status: 'OK';
  readonly timeframe: Timeframe;
  readonly slot: number;
  readonly collectedSlot: number;
  /** Exactly the number asked for, oldest first. Every bar is closed at the slot (rule 2). */
  readonly bars: readonly SpineBar[];
  /** Open time of the newest bar returned. */
  readonly newestOpenTime: number;
  readonly cycle: ReaderCycle;
}
export type ClosedBarsResult = ClosedBarsOk | StaleResult;

/**
 * The still-open M5 bar, exposed ONCE as a labelled last price (rule 3): its
 * close and nothing else. No open, high, low or volume of a forming bar ever
 * leaves the reader.
 */
export type LastPrice =
  | {
      readonly status: 'OK';
      readonly price: number;
      /** Open time of the forming bar the price belongs to. */
      readonly barOpenTime: number;
      /** When the export it came from was written (file mtime), unix UTC; null when unknown. */
      readonly asOf: number | null;
    }
  | {
      readonly status: 'UNAVAILABLE';
      /**
       * FORMING_BAR_NOT_IN_TABLE: no row for the forming bar (the export ended
       * before it opened). NOT_THIS_CYCLES_PRICE: the row is not, or cannot be
       * shown to be, the version this cycle wrote (a later cycle has rewritten it
       * since, so it is now a closed bar's final values, not a last price).
       */
      readonly reason: 'FORMING_BAR_NOT_IN_TABLE' | 'NOT_THIS_CYCLES_PRICE';
    };

export interface OneDayOhlcOk {
  readonly status: 'OK';
  readonly slot: number;
  /** 288 closed M5 bars and 96 closed M15 bars, oldest first (rule 4). */
  readonly bars: {
    readonly M5: readonly SpineBar[];
    readonly M15: readonly SpineBar[];
  };
  readonly lastPrice: LastPrice;
  /** Digest of the spine just read, and the one stored when the cycle was declared ready. */
  readonly replay: {
    readonly digest: string;
    readonly cycleDigest: string | null;
    /** True when they are equal, false when a closed bar changed since, null when the cycle stored none. */
    readonly matches: boolean | null;
  };
  /** The cycle at the slot (M5), and the cycle M15 was last collected at (the same one on a refresh slot). */
  readonly cycle: ReaderCycle;
  readonly m15Cycle: ReaderCycle;
}
export type OneDayOhlcResult = OneDayOhlcOk | StaleResult;

export interface StatisticsOk {
  readonly status: 'OK';
  readonly source: StatisticSource;
  readonly timeframe: Timeframe;
  readonly slot: number;
  /** The slot the row was captured at: always the one the timeframe was last collected at. */
  readonly collectedSlot: number;
  readonly row: IndicatorStatistic;
  readonly cycle: ReaderCycle;
}
export type StatisticsAtSlotResult = StatisticsOk | StaleResult;
