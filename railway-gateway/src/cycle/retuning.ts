import { CycleManifest, MANIFEST_TIMEFRAMES } from './cycle-manifest.contract';
import { manifestTuning } from './manifest-row';
import { TIMEFRAME_SECONDS, Timeframe } from './slot';

/**
 * Promote detection and the RETUNING state machine (STACK-D-ARCHITECTURE.md
 * section 1.6, rule 9, ADR-015 settled 1 October 2026; the completion rule is
 * Option A, chosen by Davin on 2 October 2026, see "WINDOW COMPLETE" below).
 *
 * Pure: the previous cycle, this manifest and what the gateway counted in the
 * window in, a verdict out. The service reads and writes; keeping the rules here
 * is what lets each boundary be tested.
 *
 * THE RULES
 *
 *   1. A PROMOTE is a change, against the previous cycle, in the terminal the
 *      manifest was read from, in any source's `config_hash`, or in any source's
 *      projection mode. The first cycle ever has nothing to change from.
 *   2. A promote starts RETUNING. RETUNING continues for as long as the previous
 *      cycle was RETUNING and the window still holds bars from before the promote.
 *   3. When the previous cycle was RETUNING and the gateway counts 0 pre-promote
 *      bars in the window, this manifest, once VERIFIED, ends it: that cycle is
 *      not RETUNING and a RETUNE_COMPLETE event is written. "Verified" is the
 *      landed-row check having passed (market_cycles state READY).
 *   4. Not counted is not zero. A count that could not be made (no promote to
 *      measure against) never ends a RETUNING.
 *
 * WINDOW COMPLETE (Option A). The sender used to report how many window rows it
 * still had unsent (`repush_rows_unsent`). That can never reach 0 on the real
 * collector, which re-queues the whole window every cycle (build step 2 part 9
 * hand-off), so the gateway measures instead: the M5 rows of the 3,000-bar window
 * whose `cycle_id` is older than the promote cycle's `m5_collection_cycle_id` still
 * hold pre-promote values. Every cycle rewrites its whole window under its own
 * cycle id, so a row's id says which cycle's tuning it was last pushed under.
 * 0 of them left means the window is re-pushed. The sender's field stays in the
 * manifest and on the row, as a diagnostic only: nothing here reads it.
 *
 * The window is measured in time, `slot - 3000 * 300` to the slot, not as "the
 * newest 3,000 rows". The collector's 3,000 BARS reach further back than 250 hours
 * whenever a weekend lies inside, so a time bound never counts a row the
 * collector no longer re-pushes (such a row would keep RETUNING on for ever),
 * while the oldest bars of a window with a gap go unchecked, and they are the
 * first the worker re-pushes. It is one bar wider than the window when the newest
 * row is the new-bar stub, so a row that has just scrolled out of the window can
 * hold RETUNING for one more cycle and no longer. M15 rows are not counted.
 *
 * What is compared, and what is not. Only what BOTH cycles state: a source that
 * has a hash in one cycle and none in the other (a statistic missing from one
 * export, a new indicator rolled out) is not a promote, because nothing is known
 * to have changed.
 *
 * Consequence for M15, deliberately accepted. M15 is collected only on :00 :15
 * :30 :45, so the cycle before a refresh slot never carries it and M15 is, in
 * practice, never compared. A promote does not need it: every promote switches
 * the terminal and retunes M5. Comparing M15 with the last cycle that carried it
 * would be wrong in the other direction: it would fire a second PROMOTE at the
 * next refresh slot for the same physical promote (the M15 hashes only show up
 * there) and start the RETUNING over. A reconfiguration of the M15 indicators
 * alone, with the terminal and M5 untouched, is therefore NOT detected.
 */

export const PROMOTE_EVENT = 'PROMOTE';
export const RETUNE_COMPLETE_EVENT = 'RETUNE_COMPLETE';

export function promoteDedupeKey(symbol: string, slot: number): string {
  return `${symbol}_PROMOTE_${slot}`;
}

export function retuneCompleteDedupeKey(symbol: string, slot: number): string {
  return `${symbol}_RETUNE_COMPLETE_${slot}`;
}

/** The collector exports 3,000 bars per timeframe (`InpBars=3000` of the OHLCV exporter, blueprint 5.1). */
export const RETUNE_WINDOW_M5_BARS = 3000;

/** First open time, unix UTC seconds, the window of a slot is measured from (see WINDOW COMPLETE). */
export function retuneWindowStart(slot: number): number {
  return slot - RETUNE_WINDOW_M5_BARS * TIMEFRAME_SECONDS.M5;
}

/**
 * The market_data_v6 rows that still hold pre-promote values at `slot`: M5 rows
 * of the window whose cycle_id is below the promote cycle's. A Prisma `where`
 * for `marketDataV6.count`; plain data, so the boundaries can be pinned in tests.
 */
export function preTuningBarsWhere(
  symbol: string,
  slot: number,
  promoteCycleId: number
): {
  symbol: string;
  timeframe: 'M5';
  timestamp: { gte: number; lte: number };
  cycle_id: { lt: number };
} {
  return {
    symbol,
    timeframe: 'M5',
    timestamp: { gte: retuneWindowStart(slot), lte: slot },
    cycle_id: { lt: promoteCycleId },
  };
}

/** What the gateway counted in the window of a manifest's slot (Option A). */
export interface WindowCount {
  /** Effective slot of the PROMOTE the window is measured against. */
  promoteSlot: number;
  /** `m5_collection_cycle_id` of that promote's cycle: rows below it are pre-promote. */
  promoteCycleId: number;
  /** M5 rows of the window whose cycle_id is below `promoteCycleId`. */
  oldRows: number;
}

/** The columns of the previous market_cycles row that the rules read. */
export interface PreviousCycle {
  slot: number;
  terminal_id: string | null;
  /** { "<timeframe>": { "<source>": "<config_hash>" } }, as stored; read defensively. */
  config_hashes: unknown;
  /** { "<timeframe>": { "<source>": "DYNAMIC" | "FROZEN" } }, as stored; read defensively. */
  source_modes: unknown;
  retuning: boolean;
}

/** What changed, in the words of the event's `detail`. Empty parts are left empty. */
export interface PromoteChange {
  terminal: { previous: string; current: string } | null;
  /** Per timeframe, the sources whose config_hash differs, sorted. */
  config_hashes: Partial<Record<Timeframe, string[]>>;
  /** Per timeframe, the sources whose projection mode differs, sorted. */
  source_modes: Partial<Record<Timeframe, string[]>>;
}

export interface RetuneStep {
  /** Set when this manifest is a promote. */
  promote: PromoteChange | null;
  /** The flag this cycle carries until it is verified (PENDING and INCOMPLETE rows). */
  retuning: boolean;
  /** True when verifying this cycle ends the RETUNING it continues. */
  completesWhenVerified: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** One timeframe's { source: value } object from a stored column, or null if it is not there. */
function perSource(
  column: unknown,
  timeframe: Timeframe
): Record<string, unknown> | null {
  return asRecord(asRecord(column)?.[timeframe]);
}

/** Sources stated on both sides whose value differs. */
function changedSources(
  before: Record<string, unknown>,
  after: Record<string, string>
): string[] {
  return Object.keys(after)
    .filter(
      (source) =>
        Object.prototype.hasOwnProperty.call(before, source) &&
        before[source] !== after[source]
    )
    .sort();
}

/** Rule 1: what changed against the previous cycle, or null when nothing did. */
export function detectPromote(
  manifest: CycleManifest,
  previous: PreviousCycle | null
): PromoteChange | null {
  if (!previous) return null;

  const change: PromoteChange = {
    terminal: null,
    config_hashes: {},
    source_modes: {},
  };
  let changed = false;

  if (
    typeof previous.terminal_id === 'string' &&
    previous.terminal_id !== manifest.mt5_terminal
  ) {
    change.terminal = {
      previous: previous.terminal_id,
      current: manifest.mt5_terminal,
    };
    changed = true;
  }

  for (const timeframe of MANIFEST_TIMEFRAMES) {
    const section = manifest.timeframes[timeframe];
    if (!section) continue;

    const hashesBefore = perSource(previous.config_hashes, timeframe);
    if (hashesBefore) {
      const sources = changedSources(hashesBefore, section.config_hashes);
      if (sources.length > 0) {
        change.config_hashes[timeframe] = sources;
        changed = true;
      }
    }
    const modesBefore = perSource(previous.source_modes, timeframe);
    if (modesBefore) {
      const sources = changedSources(modesBefore, section.source_modes);
      if (sources.length > 0) {
        change.source_modes[timeframe] = sources;
        changed = true;
      }
    }
  }
  return changed ? change : null;
}

/**
 * True when the step is a RETUNING that carries on from the cycle before (not a
 * promote itself): the one case in which the window has to be counted.
 */
export function continuesRetuning(step: RetuneStep): boolean {
  return step.retuning && step.promote === null;
}

/**
 * Rules 1 to 4 for one manifest. `window` is what the gateway counted for it, and
 * is only consulted for a RETUNING that continues (see `continuesRetuning`);
 * null means it was not counted.
 */
export function retuneStep(
  manifest: CycleManifest,
  previous: PreviousCycle | null,
  window: WindowCount | null = null
): RetuneStep {
  const calm: RetuneStep = {
    promote: null,
    retuning: false,
    completesWhenVerified: false,
  };
  if (!previous) return calm;

  const promote = detectPromote(manifest, previous);
  if (promote) {
    // A promote wins over everything else, including a RETUNING that was about
    // to end: the window is mixed again.
    return { promote, retuning: true, completesWhenVerified: false };
  }
  if (!previous.retuning) return calm;

  return {
    promote: null,
    retuning: true,
    // Rule 4: only a count of exactly 0. No count and any positive count keep it going.
    completesWhenVerified: window !== null && window.oldRows === 0,
  };
}

/** The flag a cycle carries once it has been verified (declared READY). */
export function retuningOnceVerified(step: RetuneStep): boolean {
  return step.retuning && !step.completesWhenVerified;
}

/** A row for the cycle_events table (part 2 migration). Plain JSON-safe values. */
export interface CycleEventRow {
  symbol: string;
  event_type: typeof PROMOTE_EVENT | typeof RETUNE_COMPLETE_EVENT;
  effective_slot: number;
  dedupe_key: string;
  terminal_id: string;
  config_hashes: Record<string, Record<string, string>>;
  source_modes: Record<string, Record<string, string>>;
  detail: Record<string, unknown>;
}

/** What the previous cycle said about the timeframes this manifest carries. */
function previousValues(
  previous: PreviousCycle,
  column: 'config_hashes' | 'source_modes',
  manifest: CycleManifest
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const timeframe of MANIFEST_TIMEFRAMES) {
    if (!manifest.timeframes[timeframe]) continue;
    const values = perSource(previous[column], timeframe);
    if (values) out[timeframe] = values;
  }
  return out;
}

/** The PROMOTE event of a manifest that `detectPromote` found a change in. */
export function promoteEvent(
  manifest: CycleManifest,
  change: PromoteChange,
  previous: PreviousCycle
): CycleEventRow {
  const tuning = manifestTuning(manifest);
  return {
    symbol: manifest.symbol,
    event_type: PROMOTE_EVENT,
    effective_slot: manifest.slot,
    dedupe_key: promoteDedupeKey(manifest.symbol, manifest.slot),
    terminal_id: tuning.terminal_id,
    config_hashes: tuning.config_hashes,
    source_modes: tuning.source_modes,
    detail: {
      previous: {
        slot: previous.slot,
        terminal_id: previous.terminal_id,
        config_hashes: previousValues(previous, 'config_hashes', manifest),
        source_modes: previousValues(previous, 'source_modes', manifest),
      },
      new: {
        slot: manifest.slot,
        terminal_id: tuning.terminal_id,
        config_hashes: tuning.config_hashes,
        source_modes: tuning.source_modes,
      },
      changed: change,
    },
  };
}

/**
 * The RETUNE_COMPLETE event of the manifest that ended a RETUNING. `window` is
 * the count that found the window re-pushed (`oldRows` is 0); this manifest is
 * the verified one.
 */
export function retuneCompleteEvent(
  manifest: CycleManifest,
  window: WindowCount
): CycleEventRow {
  const tuning = manifestTuning(manifest);
  return {
    symbol: manifest.symbol,
    event_type: RETUNE_COMPLETE_EVENT,
    effective_slot: manifest.slot,
    dedupe_key: retuneCompleteDedupeKey(manifest.symbol, manifest.slot),
    terminal_id: tuning.terminal_id,
    config_hashes: tuning.config_hashes,
    source_modes: tuning.source_modes,
    detail: {
      promote_slot: window.promoteSlot,
      promote_m5_collection_cycle_id: window.promoteCycleId,
      window_old_rows: window.oldRows,
      window_from: retuneWindowStart(manifest.slot),
      window_to: manifest.slot,
      verified_at_slot: manifest.slot,
    },
  };
}
