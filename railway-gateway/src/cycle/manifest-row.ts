import { CycleManifest } from './cycle-manifest.contract';
import { cycleAttempts } from './manifest-decision';

/**
 * A manifest as the market_cycles row it starts as (the PENDING row of the
 * part 2 migration). Pure, so the mapping from contract fields to columns, the
 * only place the two vocabularies meet, is tested on its own.
 *
 * Deliberately not set here: `state` moves on, `ready_at`, `data_status`,
 * `closed_bars_digest` and `check_detail` belong to the decision, and `retuning`
 * belongs to the promote logic (retuning.ts); it starts at its default, false.
 */
export interface PendingCycleRow {
  symbol: string;
  slot: number;
  state: 'PENDING';
  attempts: number;
  manifest_received_at: number;
  collector_started_at: number;
  collector_validated_at: number;
  m5_collection_cycle_id: number;
  m15_collection_cycle_id: number | null;
  m5_bar_count: number;
  m15_bar_count: number | null;
  m5_newest_bar_ts: number;
  m15_newest_bar_ts: number | null;
  m5_export_at: number;
  m15_export_at: number | null;
  terminal_id: string;
  config_hashes: Record<string, Record<string, string>>;
  source_modes: Record<string, Record<string, string>>;
  backlog_rows: number;
  repush_rows_unsent: number | null;
}

/**
 * Which terminal and tuning a manifest was produced under (ADR-015), in the shape
 * market_cycles and cycle_events both store it: keyed by timeframe first, because
 * the same source can be configured differently on the M5 and the M15 chart.
 * One function for both tables, so the cycle row and a PROMOTE event can never
 * disagree about what the manifest said.
 */
export interface ManifestTuning {
  terminal_id: string;
  config_hashes: Record<string, Record<string, string>>;
  source_modes: Record<string, Record<string, string>>;
}

export function manifestTuning(manifest: CycleManifest): ManifestTuning {
  const { M5: m5, M15: m15 } = manifest.timeframes;
  const byTimeframe = <T>(pick: (s: typeof m5) => T): Record<string, T> => ({
    M5: pick(m5),
    ...(m15 ? { M15: pick(m15) } : {}),
  });
  return {
    terminal_id: manifest.mt5_terminal,
    config_hashes: byTimeframe((s) => s.config_hashes),
    source_modes: byTimeframe((s) => s.source_modes),
  };
}

export function pendingCycleRow(
  manifest: CycleManifest,
  receivedAt: number
): PendingCycleRow {
  const { M5: m5, M15: m15 } = manifest.timeframes;
  const tuning = manifestTuning(manifest);

  return {
    symbol: manifest.symbol,
    slot: manifest.slot,
    state: 'PENDING',
    attempts: cycleAttempts(manifest),
    manifest_received_at: receivedAt,
    // The cycle's own timings are the M5 cycle's: M5 is collected on every slot
    // and M15 starts right after it.
    collector_started_at: m5.started_at,
    collector_validated_at: m5.validated_at,
    m5_collection_cycle_id: m5.collection_cycle_id,
    m15_collection_cycle_id: m15?.collection_cycle_id ?? null,
    m5_bar_count: m5.bar_count,
    m15_bar_count: m15?.bar_count ?? null,
    m5_newest_bar_ts: m5.newest_bar_ts,
    m15_newest_bar_ts: m15?.newest_bar_ts ?? null,
    m5_export_at: m5.export_mtime,
    m15_export_at: m15?.export_mtime ?? null,
    terminal_id: tuning.terminal_id,
    config_hashes: tuning.config_hashes,
    source_modes: tuning.source_modes,
    backlog_rows: manifest.backlog_rows,
    // Absent in the manifest means "not measured": stored as NULL, never zero.
    repush_rows_unsent: manifest.repush_rows_unsent ?? null,
  };
}
