import { CycleManifest, TimeframeCycle } from './cycle-manifest.contract';
import { MANIFEST_THRESHOLDS, ManifestThresholds } from './manifest-thresholds';
import { Timeframe } from './slot';

/**
 * What to do with a manifest whose rows may or may not have landed yet (ADR-009).
 *
 * Pure: counts and clocks in, a decision out. The service does the reading and
 * the writing; keeping the decision here is what lets every boundary be tested
 * to the second.
 *
 * Why waiting is part of the design and not a nicety. The sender acknowledges
 * every row before it sends the manifest, but an acknowledgement means "queued",
 * not "stored". The manifest job sits in the same single-concurrency queue
 * behind those row jobs, so normally everything has landed by the time it runs.
 * Not always: a row job that failed is retried later with a backoff, and
 * statistics are on a different queue altogether. So "not all here yet" is
 * ordinary, and the answer is to look again in a few seconds, up to a limit.
 */

export interface LandedCount {
  /** market_data_v6 rows of the timeframe from oldest_bar_ts to newest_bar_ts. */
  bars: number;
  /** indicator_statistics rows of the timeframe captured at the slot. */
  statistics: number;
  /**
   * `cycle_id` of the market_data_v6 row at the manifest's newest_bar_ts, or null
   * when there is no such row. Every promoted row carries the collection cycle
   * that promoted it, and each cycle re-queues its whole window, so this says
   * whether THIS cycle's version of the newest row has landed.
   */
  newestCycleId: number | null;
}

export interface CountPair {
  expected: number;
  landed: number;
}

export type CheckReason =
  | 'LANDED_ROWS_MISSING'
  | 'NEWEST_ROW_NOT_CURRENT'
  | 'STATISTICS_SHORTFALL'
  | 'STALE_MANIFEST';

/** Stored in market_cycles.check_detail whenever the check found anything to say. */
export interface CheckDetail {
  reason: CheckReason;
  ageSec: number;
  slotAgeSec: number;
  timeframes: Partial<
    Record<
      Timeframe,
      {
        bars: CountPair;
        statistics: CountPair;
        /** The newest row must come from a collection cycle at or above `minCycleId`. */
        newest: { minCycleId: number; cycleId: number | null };
      }
    >
  >;
}

export type ManifestDecision =
  | { action: 'ready'; detail: CheckDetail | null }
  | { action: 'wait'; detail: CheckDetail }
  | {
      action: 'incomplete';
      reason:
        | 'LANDED_ROWS_MISSING'
        | 'NEWEST_ROW_NOT_CURRENT'
        | 'STALE_MANIFEST';
      detail: CheckDetail;
    };

export interface DecisionInput {
  manifest: CycleManifest;
  /** What was found, per timeframe in the manifest. Not needed for a stale manifest. */
  counts: Partial<Record<Timeframe, LandedCount>>;
  /** Seconds since the manifest arrived at the gateway. */
  ageSec: number;
  /** Seconds since the slot itself. */
  slotAgeSec: number;
}

/**
 * Rows the gateway should find: the bars the sender pushed first, less the ones
 * the gateway itself rejected with a 400 (they were quarantined, so they are
 * not in the table and never will be).
 */
export function expectedBars(section: TimeframeCycle): number {
  return Math.max(0, section.bar_count - section.quarantined_rows);
}

/**
 * True when the newest row in the table is this cycle's version of it (or a later
 * cycle's), not an older copy left by an earlier cycle. Counting rows cannot tell
 * the two apart, because consecutive slots overlap by almost the whole window;
 * the newest row is the one that changes every cycle, so it is the one checked.
 */
export function newestRowIsCurrent(
  section: TimeframeCycle,
  found: LandedCount | undefined
): boolean {
  return (
    found?.newestCycleId != null &&
    found.newestCycleId >= section.collection_cycle_id
  );
}

export function listTimeframes(manifest: CycleManifest): Timeframe[] {
  return (['M5', 'M15'] as const).filter((tf) => manifest.timeframes[tf]);
}

/** The cycle's attempts: the larger of its timeframes' (ADR-012 deadline input). */
export function cycleAttempts(manifest: CycleManifest): number {
  return Math.max(
    ...listTimeframes(manifest).map((tf) => manifest.timeframes[tf]!.attempts)
  );
}

function detailOf(reason: CheckReason, input: DecisionInput): CheckDetail {
  const timeframes: CheckDetail['timeframes'] = {};
  for (const tf of listTimeframes(input.manifest)) {
    const section = input.manifest.timeframes[tf]!;
    const found = input.counts[tf] ?? {
      bars: 0,
      statistics: 0,
      newestCycleId: null,
    };
    timeframes[tf] = {
      bars: { expected: expectedBars(section), landed: found.bars },
      statistics: {
        expected: section.statistics_count,
        landed: found.statistics,
      },
      newest: {
        minCycleId: section.collection_cycle_id,
        cycleId: found.newestCycleId,
      },
    };
  }
  return {
    reason,
    ageSec: input.ageSec,
    slotAgeSec: input.slotAgeSec,
    timeframes,
  };
}

export function decideManifest(
  input: DecisionInput,
  thresholds: ManifestThresholds = MANIFEST_THRESHOLDS
): ManifestDecision {
  if (input.slotAgeSec > thresholds.staleManifestAfterSec) {
    return {
      action: 'incomplete',
      reason: 'STALE_MANIFEST',
      detail: detailOf('STALE_MANIFEST', input),
    };
  }

  const timeframes = listTimeframes(input.manifest);
  const barsLanded = timeframes.every(
    (tf) =>
      (input.counts[tf]?.bars ?? 0) >=
      expectedBars(input.manifest.timeframes[tf]!)
  );
  const newestCurrent = timeframes.every((tf) =>
    newestRowIsCurrent(input.manifest.timeframes[tf]!, input.counts[tf])
  );
  const statisticsLanded = timeframes.every(
    (tf) =>
      (input.counts[tf]?.statistics ?? 0) >=
      input.manifest.timeframes[tf]!.statistics_count
  );

  const rowsLanded = barsLanded && newestCurrent;
  if (rowsLanded && statisticsLanded) return { action: 'ready', detail: null };

  if (rowsLanded) {
    // Bars are all here and statistics are not: keep looking for a short grace,
    // then go ahead without them and say so.
    const detail = detailOf('STATISTICS_SHORTFALL', input);
    return input.ageSec < thresholds.statisticsGraceSec
      ? { action: 'wait', detail }
      : { action: 'ready', detail };
  }

  // Rows missing outranks "the newest row is an older copy": both are waited
  // for the same time, but the reason says which one the cycle died of.
  const reason = barsLanded ? 'NEWEST_ROW_NOT_CURRENT' : 'LANDED_ROWS_MISSING';
  const detail = detailOf(reason, input);
  return input.ageSec < thresholds.landedGiveUpAfterSec
    ? { action: 'wait', detail }
    : { action: 'incomplete', reason, detail };
}
