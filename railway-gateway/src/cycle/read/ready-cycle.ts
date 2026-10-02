import type { Timeframe } from '../slot';
import type { ReaderCycle } from './read-types';

/**
 * From a `market_cycles` row to the facts a reader reports about its cycle.
 *
 * Pure. The query that fetches the row filters on `state = 'READY'` (see
 * CycleReaderService); this module is the second wall: a READY row that cannot be
 * trusted is refused rather than half-used, as Part 1's data status refuses an
 * invalid row ("a bad row fails closed, never open").
 */

/** The columns of a market_cycles row that the readers select. */
export interface CycleRow {
  slot: number;
  data_status: string | null;
  ready_at: number | null;
  attempts: number;
  retuning: boolean;
  closed_bars_digest: string | null;
  check_detail: unknown;
  m5_export_at: number | null;
  m15_export_at: number | null;
  m5_collection_cycle_id: number | null;
  manifest_received_at: number;
  collector_started_at: number | null;
  collector_validated_at: number | null;
}

/** Why a READY row cannot be trusted, or null when it can. */
export function invalidCycleRow(row: CycleRow): string | null {
  if (row.ready_at === null || !Number.isInteger(row.ready_at)) {
    return `ready_at is ${String(row.ready_at)}`;
  }
  if (row.ready_at < row.slot) {
    return `ready_at ${row.ready_at} is before the slot ${row.slot}`;
  }
  if (row.data_status !== 'FRESH' && row.data_status !== 'DELAYED') {
    return `data_status is ${String(row.data_status)}, expected FRESH or DELAYED`;
  }
  if (!Number.isInteger(row.attempts) || row.attempts < 1) {
    return `attempts is ${String(row.attempts)}`;
  }
  return null;
}

/** The reader's view of a READY row, or null when the row is not usable (see invalidCycleRow). */
export function toReaderCycle(row: CycleRow): ReaderCycle | null {
  if (invalidCycleRow(row) !== null) return null;
  return {
    slot: row.slot,
    dataStatus: row.data_status as 'FRESH' | 'DELAYED',
    readyAt: row.ready_at as number,
    attempts: row.attempts,
    retuning: row.retuning,
    closedBarsDigest: row.closed_bars_digest,
    checkReason: checkReasonOf(row.check_detail),
    m5ExportAt: row.m5_export_at,
    m15ExportAt: row.m15_export_at,
    m5CollectionCycleId: row.m5_collection_cycle_id,
    manifestReceivedAt: row.manifest_received_at,
    collectorStartedAt: row.collector_started_at,
    collectorValidatedAt: row.collector_validated_at,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** `check_detail.reason`, when the column holds what the gateway writes. */
export function checkReasonOf(checkDetail: unknown): string | null {
  const detail = asRecord(checkDetail);
  return detail && typeof detail['reason'] === 'string'
    ? detail['reason']
    : null;
}

/**
 * True when the cycle went READY recording that statistics were short for this
 * timeframe. `check_detail` is a free JSON column, so it is read defensively:
 *
 *   - the reason must be STATISTICS_SHORTFALL;
 *   - the gateway lists every timeframe of the manifest with its counts, so when
 *     the timeframe is listed it is short exactly when fewer landed than expected,
 *     and when the map is there but the timeframe is not, nothing was short for it;
 *   - a detail that says STATISTICS_SHORTFALL but has no readable timeframe map
 *     (or a listed timeframe without readable counts) cannot say where, and counts
 *     for every timeframe: the safe reading of a record that cannot be read.
 */
export function statisticsShortfallFor(
  checkDetail: unknown,
  timeframe: Timeframe
): boolean {
  const detail = asRecord(checkDetail);
  if (!detail || detail['reason'] !== 'STATISTICS_SHORTFALL') return false;
  const timeframes = asRecord(detail['timeframes']);
  if (!timeframes) return true;
  if (!(timeframe in timeframes)) return false;
  const statistics = asRecord(asRecord(timeframes[timeframe])?.['statistics']);
  if (
    statistics &&
    typeof statistics['expected'] === 'number' &&
    typeof statistics['landed'] === 'number'
  ) {
    return statistics['landed'] < statistics['expected'];
  }
  return true;
}
