import { TIMEFRAMES, Timeframe, TIMEFRAME_SECONDS } from '../../cycle/slot';
import { isoToSlot } from './stats-slot';

/**
 * The cycle input bundle: the JSON form of the MCD kit's `CycleInputs`
 * (`mcd_common/cycle_inputs.py`, `CycleInputs.to_dict()`), which the Python runner
 * (`python -m mcd_worker.cli`) reads. One bundle holds everything one evaluation
 * may read; an evaluator never queries anything (standard section 4).
 *
 * The runner is the authority on this shape. These types are for reading the
 * loader, and test/sensors-fixture-source.spec.ts plus the gated
 * test/sensors-inputs.pg.spec.ts hold them to it: the three stored bundles of
 * `mcd_worker/fixtures/` must pass `bundleProblems`, and a bundle from the
 * database must give the stored readings when the runner reads it.
 */

/** A bar: `timestamp` is the open time (unix UTC), the rest are `market_data_v6` columns, null where the column is empty. */
export type BarRecord = {
  timestamp: number;
  close: number;
} & { [column: string]: number | null };

export type StatisticsValue = number | string | boolean | null;
/** An `indicator_statistics` row, live-bar fields removed (statistics-fields.ts). */
export type StatisticsRecord = { [field: string]: StatisticsValue };

export type ChannelMode = 'dynamic' | 'frozen';

export interface CycleInputsBundle {
  symbol: string;
  /** ISO 8601 UTC, "2026-09-18T20:55Z" (rule 1). */
  cycle_slot: string;
  /** FRESH | DELAYED | STALE | MARKET_CLOSED (rule 7), or REFUSED_DATA_STATUS when the loader refused the cycle. */
  data_status: string;
  /** A promote is in progress (rule 9). */
  retuning: boolean;
  /** Closed bars only, ascending (rule 2). */
  bars: Record<Timeframe, BarRecord[]>;
  /** `{ M5: { best_fit_a: row }, M15: { non_b: row } }`: rows captured at `stats_slot` (rule 5). A missing key is a missing row. */
  statistics: Partial<Record<Timeframe, Record<string, StatisticsRecord>>>;
  /** Per timeframe, the ISO slot at which it was last collected. */
  stats_slot: Record<Timeframe, string>;
  /** The setting per timeframe in the kit's names ("fractal", not "fractal_edt"); a timeframe without a setting is absent (rule 6). */
  active_indicator: Partial<Record<Timeframe, string>>;
  /** Per statistics source, from `market_cycles.config_hashes`. */
  config_hash: Record<string, string>;
  /** Per statistics source, from `market_cycles.source_modes`. */
  channel_mode: Record<string, ChannelMode>;
  /**
   * Optional (kit standard 1.0.6, decision D8): the `sr_1` to `sr_16` columns of the last closed bar of each
   * timeframe, as the data source holds them (null for an empty cell). Context for synthesis's entry zones;
   * no evaluator reads it. The kit leaves the key out of its JSON when it is empty, so a bundle without it
   * keeps the text and the hash it had before the section existed.
   */
  context_levels?: Partial<Record<Timeframe, Record<string, number | null>>>;
}

/**
 * The `data_status` of a bundle the loader refused to build faithfully (for
 * example two timeframes using the same indicator under different tunings, Q13).
 *
 * It is not one of the kit's four statuses on purpose: the kit's cycle check
 * ends a reading whose `data_status` is outside them as INVALID + SANITY_FAILED
 * ("a provider bug", `mcd_common/preflight.py` `cycle_check`), for every MCD, so
 * a refused cycle can never be read as if it were fresh and the kit needs no change.
 */
export const REFUSED_DATA_STATUS = 'INPUTS_REFUSED';

// ---------------------------------------------------------------- the channel catalogue (cycle_inputs.py)

/** Centroid-regression variants: seven on M15, the same seven plus the fractal EDT on M5. */
export const CENTROID_INDICATORS = [
  'best_fit_a',
  'best_fit_b',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
] as const;

export const KIT_CANDIDATES: Readonly<Record<Timeframe, readonly string[]>> =
  Object.freeze({
    M15: CENTROID_INDICATORS,
    M5: [...CENTROID_INDICATORS, 'fractal'],
  });

/** The kit's name of a channel indicator: the setting says "fractal_edt", the kit says "fractal". */
export function kitIndicatorOf(source: string): string {
  return source === 'fractal_edt' ? 'fractal' : source;
}

/** The `indicator_statistics.source` of an indicator in the kit's names ("fractal" -> "fractal_edt"). */
export function statisticsSourceOf(indicator: string): string {
  return indicator === 'fractal' ? 'fractal_edt' : indicator;
}

/** `market_data_v6` columns of one candidate (the kit's `channel_columns`). */
export function channelColumns(indicator: string): {
  upper: string;
  lower: string;
  baseline: string;
  fit: string;
} {
  if (indicator === 'fractal') {
    return {
      upper: 'fractal_uoedt',
      lower: 'fractal_loedt',
      baseline: 'fractal_best_fl',
      fit: 'fractal_best_fl',
    };
  }
  return {
    upper: `${indicator}_uoedt`,
    lower: `${indicator}_loedt`,
    baseline: `${indicator}_base_fl`,
    fit: `${indicator}_ssa`,
  };
}

/**
 * The columns a bar can carry in a bundle: the open time, the close, and the four
 * channel columns of every candidate (three for the fractal EDT), 33 in all. The
 * database query selects these; open, high, low and volume are not in a bundle.
 *
 * What a bar CARRIES depends on where it sits, because that is all the evaluators
 * read (checked on the three stored cycles: nulling every other column leaves every
 * envelope byte for byte as it was, and the gated parity specs keep checking it):
 *   - the LAST closed bar of a timeframe carries all of BAR_COLUMNS: the tier-1
 *     cross-check asks of every candidate whether it has a channel on that bar
 *     (`preflight.py` `indicator_check`);
 *   - every other bar carries `windowBarColumns`: the open time, the close and the
 *     ACTIVE indicator's channel, which is what the windows of MCD1, MCD2 and MCD3 read.
 * In production all eight candidates run on both charts, so carrying all of them on
 * every bar would store several times what the evaluators read, for 90 days of cycles.
 */
export const BAR_COLUMNS: readonly string[] = Object.freeze(
  [
    'timestamp',
    'close',
    ...new Set(
      [...CENTROID_INDICATORS, 'fractal'].flatMap((indicator) =>
        Object.values(channelColumns(indicator))
      )
    ),
  ].sort()
);

/**
 * The support and resistance columns `context_levels` carries, `sr_1` to `sr_16` (kit standard 1.0.6,
 * decision D8). `sr_1` to `sr_4` are the nearest supports below a bar's close and `sr_5` to `sr_8` the nearest
 * resistances above it; `sr_9` to `sr_16` are the same from the second calibration. Empty is NULL, never 0.
 * They are NOT in `BAR_COLUMNS`: no evaluator reads them, so the bars of a bundle do not carry them.
 */
export const SR_COLUMNS: readonly string[] = Object.freeze(
  Array.from({ length: 16 }, (_, index) => `sr_${index + 1}`)
);

/**
 * The columns of a bar inside a window: the open time, the close and the four channel
 * columns (upper, lower, baseline, fit) of the active indicator. With no active
 * indicator (no setting: the evaluators answer INVALID + NO_SETTING) just the first two.
 */
export function windowBarColumns(
  activeIndicator: string | undefined
): readonly string[] {
  const channel =
    activeIndicator === undefined
      ? []
      : Object.values(channelColumns(activeIndicator));
  return [...new Set(['timestamp', 'close', ...channel])].sort();
}

// ---------------------------------------------------------------- shape check

const BUNDLE_KEYS = [
  'symbol',
  'cycle_slot',
  'data_status',
  'retuning',
  'bars',
  'statistics',
  'stats_slot',
  'active_indicator',
  'config_hash',
  'channel_mode',
] as const;

/** The optional `context_levels` key: allowed beside the ten required ones, and checked only when present. */
const OPTIONAL_BUNDLE_KEYS = ['context_levels'] as const;
const LEVEL_NAME = /^sr_([1-9]|1[0-6])$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Every way `value` is not the JSON form of a `CycleInputs` (empty list = fine).
 * It checks the SHAPE the runner needs to read the bundle; whether the data in it
 * is good is the evaluators' business (INVALID and STALE are readings, not errors),
 * so a bundle with too few bars or a missing statistics row passes.
 */
export function bundleProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['the bundle is not an object'];
  const problems: string[] = [];
  const extra = Object.keys(value).filter(
    (key) =>
      !(BUNDLE_KEYS as readonly string[]).includes(key) &&
      !(OPTIONAL_BUNDLE_KEYS as readonly string[]).includes(key)
  );
  if (extra.length) problems.push(`unknown keys: ${extra.sort().join(', ')}`);
  for (const key of BUNDLE_KEYS) {
    if (!(key in value)) problems.push(`missing key: ${key}`);
  }
  if (typeof value['symbol'] !== 'string' || value['symbol'] === '')
    problems.push('symbol must be a non-empty string');
  const slot = isoToSlot(value['cycle_slot']);
  if (slot === null)
    problems.push('cycle_slot must be an ISO 8601 UTC 5-minute slot');
  if (typeof value['data_status'] !== 'string')
    problems.push('data_status must be a string');
  if (typeof value['retuning'] !== 'boolean')
    problems.push('retuning must be a boolean');

  const bars = value['bars'];
  if (!isRecord(bars)) {
    problems.push('bars must be an object');
  } else {
    for (const timeframe of TIMEFRAMES) {
      const list = bars[timeframe];
      if (!Array.isArray(list)) {
        problems.push(`bars.${timeframe} must be a list`);
        continue;
      }
      let previous = -Infinity;
      list.forEach((bar: unknown, index: number) => {
        if (!isRecord(bar) || !isNumber(bar['timestamp'])) {
          problems.push(`bars.${timeframe}[${index}] has no numeric timestamp`);
          return;
        }
        if (bar['timestamp'] <= previous)
          problems.push(`bars.${timeframe}[${index}] is not ascending`);
        previous = bar['timestamp'];
      });
    }
  }

  const statistics = value['statistics'];
  if (!isRecord(statistics)) {
    problems.push('statistics must be an object');
  } else {
    for (const [timeframe, sources] of Object.entries(statistics)) {
      if (!(TIMEFRAMES as readonly string[]).includes(timeframe))
        problems.push(`statistics has an unknown timeframe: ${timeframe}`);
      else if (!isRecord(sources) || !Object.values(sources).every(isRecord))
        problems.push(`statistics.${timeframe} must map source to row`);
    }
  }

  const statsSlot = value['stats_slot'];
  if (!isRecord(statsSlot)) {
    problems.push('stats_slot must be an object');
  } else {
    for (const timeframe of TIMEFRAMES) {
      if (isoToSlot(statsSlot[timeframe]) === null)
        problems.push(`stats_slot.${timeframe} must be an ISO 8601 UTC slot`);
    }
  }

  if ('context_levels' in value) {
    const levels = value['context_levels'];
    if (!isRecord(levels)) {
      problems.push('context_levels must be an object');
    } else {
      for (const [timeframe, columns] of Object.entries(levels)) {
        if (!(TIMEFRAMES as readonly string[]).includes(timeframe))
          problems.push(
            `context_levels has an unknown timeframe: ${timeframe}`
          );
        else if (!isRecord(columns))
          problems.push(`context_levels.${timeframe} must map level to price`);
        else
          for (const [name, price] of Object.entries(columns)) {
            if (!LEVEL_NAME.test(name))
              problems.push(
                `context_levels.${timeframe} has an unknown level: ${name}`
              );
            else if (price !== null && !isNumber(price))
              problems.push(
                `context_levels.${timeframe}.${name} must be a number or null`
              );
          }
      }
    }
  }

  for (const key of ['active_indicator', 'config_hash', 'channel_mode']) {
    const map = value[key];
    if (
      !isRecord(map) ||
      !Object.values(map).every((v) => typeof v === 'string')
    )
      problems.push(`${key} must map names to strings`);
  }
  return problems;
}

/** Bars of the bundle that are not closed at its slot (rule 2): the open time plus the period is after the slot. */
export function barsNotClosed(
  bundle: Pick<CycleInputsBundle, 'bars' | 'cycle_slot'>
): Array<{ timeframe: Timeframe; timestamp: number }> {
  const slot = isoToSlot(bundle.cycle_slot);
  if (slot === null) return [];
  const open: Array<{ timeframe: Timeframe; timestamp: number }> = [];
  for (const timeframe of TIMEFRAMES) {
    for (const bar of bundle.bars[timeframe] ?? []) {
      if (bar.timestamp + TIMEFRAME_SECONDS[timeframe] > slot)
        open.push({ timeframe, timestamp: bar.timestamp });
    }
  }
  return open;
}
