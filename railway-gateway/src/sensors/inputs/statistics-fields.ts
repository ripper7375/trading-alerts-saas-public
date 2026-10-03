import type { StatisticsRecord, StatisticsValue } from './bundle-types';

/**
 * The fields of an `indicator_statistics` row that never reach a bundle.
 *
 * The first two blocks describe the still-open bar or are measured from the last
 * price, so rule 2 (no still-open bar downstream) and rule 3 (the open bar leaves
 * only as a labelled last price) keep them out. The third block is storage. This
 * is a copy of `LIVE_BAR_STATISTICS_FIELDS`, `LAST_PRICE_STATISTICS_FIELDS` and
 * `DROPPED_STATISTICS_FIELDS` in `mcd_common/excel_fixture_provider.py`, the
 * kit's own provider: test/sensors-statistics-fields.spec.ts reads that file and
 * fails when the two lists differ, and fails when a column is added to the model
 * and nobody has decided whether it describes the forming bar.
 */
export const LIVE_BAR_STATISTICS_FIELDS = [
  'live_bar_ts',
  'live_close',
  'baseline_value',
  'uoedt_value',
  'loedt_value',
  'dist_to_baseline',
  'dist_to_uoedt',
  'dist_to_loedt',
  'channel_position',
] as const;

/** Measured from the last price (schema.prisma: "closest level above the live close", distance "in POINTS"). */
export const LAST_PRICE_STATISTICS_FIELDS = [
  'sr_nearest_resistance',
  'sr_nearest_support',
  'sr_dist_resistance_pts',
  'sr_dist_support_pts',
] as const;

export const STORAGE_STATISTICS_FIELDS = [
  'id',
  'terminal_id',
  'createdAt',
  'cycle_id',
] as const;

export const DROPPED_STATISTICS_FIELDS: readonly string[] = Object.freeze([
  ...LIVE_BAR_STATISTICS_FIELDS,
  ...LAST_PRICE_STATISTICS_FIELDS,
  ...STORAGE_STATISTICS_FIELDS,
]);

const DROPPED = new Set<string>(DROPPED_STATISTICS_FIELDS);

/**
 * A value as the bundle carries it: a finite number, a string, a boolean or null.
 * JSON has no NaN or infinity (JSON.stringify would write null and say nothing),
 * so a non-finite number is made null here, where it is visible in a test, and an
 * evaluator reads null as a missing value. A type the bundle cannot carry (a Date,
 * a bigint, an object) is a new column nobody has classified: it throws rather
 * than reach the runner as text.
 */
export function jsonValue(value: unknown, where: string): StatisticsValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  throw new TypeError(
    `${where} holds a ${value instanceof Date ? 'Date' : typeof value}, which a bundle cannot carry`
  );
}

/**
 * An `indicator_statistics` row as the bundle carries it: every field except the
 * dropped ones, values untouched. `captured_at` stays: tier 4 compares it with the
 * slot the timeframe was last collected at (rule 5).
 */
export function bundleStatisticsRow(
  row: Readonly<Record<string, unknown>>
): StatisticsRecord {
  const out: StatisticsRecord = {};
  for (const [field, value] of Object.entries(row)) {
    if (DROPPED.has(field)) continue;
    out[field] = jsonValue(value, `statistics field ${field}`);
  }
  return out;
}
