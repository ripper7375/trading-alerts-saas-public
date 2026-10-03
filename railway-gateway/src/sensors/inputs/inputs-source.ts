import type { Timeframe } from '../../cycle/slot';
import type { CycleInputsBundle } from './bundle-types';

/**
 * Where the sensor worker gets the inputs of a cycle (STACK-D-ARCHITECTURE.md
 * section 2.2, "load inputs"): ONE interface, two sources.
 *
 *   - `DatabaseInputsSource` reads PostgreSQL by the rules: closed bars only
 *     (rule 2), statistics at the slot (rule 5), the setting at the slot (rule 6),
 *     the tuning and RETUNING from the READY cycle row (rule 9);
 *   - `FixtureInputsSource` reads a stored bundle from `mcd_worker/fixtures/`, for
 *     tests and for replay of a known slot.
 *
 * What a source returns is a bundle plus facts ABOUT it. The worker (part 4) hands
 * the bundle to the Python runner and logs the facts; it never edits a bundle.
 */

/**
 * Why a cycle cannot be loaded yet. Data conditions come back as a result, not a
 * thrown error; what throws is a caller bug (a slot that is not on a slot boundary,
 * a symbol this pipeline does not carry).
 *
 *   - `CYCLE_NOT_READY`: there is no READY `market_cycles` row at the slot. The
 *     cycle-ready job is announced just before the row commits, so this is expected
 *     once in a while: retry with a back-off, and write STALE readings after the
 *     retries (part 5 of the read side, `CycleReaderService`).
 *   - `INVALID_CYCLE_ROW`: a READY row that cannot be trusted (no ready time, a data
 *     status that is not FRESH or DELAYED, unreadable tuning). It will not mend by
 *     waiting.
 */
export type NotReadyReason = 'CYCLE_NOT_READY' | 'INVALID_CYCLE_ROW';

/** The loader refused to build the cycle faithfully; the bundle is marked (REFUSED_DATA_STATUS) and every reading will be INVALID + SANITY_FAILED. */
export interface Refusal {
  code: 'SOURCE_COLLISION';
  /** The statistics source two timeframes use under different tunings. */
  source: string;
  field: 'config_hash' | 'channel_mode';
  /** What each timeframe recorded for it. */
  values: Partial<Record<Timeframe, string>>;
  detail: string;
}

export interface InputsProvenance {
  origin: 'database' | 'fixture';
  /** The cycle's slot, unix UTC. */
  slot: number;
  /** The cycle's own data status as `market_cycles` says it (FRESH or DELAYED), even when the bundle was refused. */
  dataStatus: string;
  /** RETUNING as the READY row records it (rule 9). The worker compares it with the job's value and logs a mismatch. */
  retuning: boolean;
  /** Per timeframe, the slot its statistics were captured at (rule 5). */
  statsSlot: Record<Timeframe, number>;
  /** Per timeframe, how many closed bars the bundle holds and how many the loader asked for (fewer is handed over as it is, never padded). */
  barCounts: Record<Timeframe, number>;
  barsRequested: Record<Timeframe, number>;
  /** Per timeframe, whether a usable READY cycle collected it. false: the timeframe's bars and statistics are left out and its readers answer STALE. */
  collected: Record<Timeframe, boolean>;
  refusals: Refusal[];
  /** Things worth a log line that are not refusals (a source dropped as ambiguous, a non-finite value made null). */
  notes: string[];
}

export type LoadedInputs =
  | {
      status: 'OK';
      bundle: CycleInputsBundle;
      provenance: InputsProvenance;
    }
  | {
      status: 'NOT_READY';
      reason: NotReadyReason;
      slot: number;
      detail: string;
    };

export interface InputsSource {
  loadCycleInputs(symbol: string, slot: number): Promise<LoadedInputs>;
}
