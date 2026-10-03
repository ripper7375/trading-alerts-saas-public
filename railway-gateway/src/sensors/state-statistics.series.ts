/**
 * What a `state_statistics` row is, and how its series is named (STACK-D-ARCHITECTURE.md section 2.8,
 * ADR-022; build step 3 part 6). Pure: no database, shared by the writer and the reader.
 *
 * One row is one SERIES, state and horizon. A series is an MCD at one evaluator `MAJOR.MINOR` reading
 * sources with one `config_hash`: a PATCH of the evaluator continues it, a MINOR or MAJOR change or a
 * changed `config_hash` of a source the MCD reads starts a new one (standard section 14; the part 2
 * decision D1). The key is built HERE and nowhere else: the Python engine
 * (`mcd_worker/statistics/`) treats the series text and the `config_hash` text as opaque and only
 * groups by them, so there is one implementation of the naming, not two that could drift apart.
 *
 * The gate. Below `MIN_SAMPLE` outcomes a row holds `n` and no number. `rowProblems` refuses a row
 * that breaks it before the database sees it; the database refuses it too (`state_statistics_n_gate`,
 * in the part 2 migration), and a spec reads the migration and the Python engine to keep the three
 * `30`s equal.
 */

/** ADR-022: n >= 30 per state and horizon before a number is quoted. */
export const MIN_SAMPLE = 30;

/** The horizons that are measured, in hours: 2 (Scalper) and 12 (Day Trader). */
export const HORIZON_HOURS = [2, 12] as const;
export type HorizonHours = (typeof HORIZON_HOURS)[number];

/**
 * Every series carries this note until the forming-bar fit is traced (plan section 6: the SSA fit may
 * include the still-open bar; B4 starts with the read-only trace of the seven centroid files).
 */
export const SERIES_NOTES = 'FORMING_BAR_FIT: UNVERIFIED';

/** The five figures the engine measures. `opposing_level_rate` is not one of them: it needs the levels and stops of build step 4. */
export const MEASURED_FIELDS = [
  'forward_move_median',
  'forward_move_q1',
  'forward_move_q3',
  'adverse_excursion_median',
  'adverse_excursion_q3',
] as const;
export type MeasuredField = (typeof MEASURED_FIELDS)[number];

export const KEY_FIELDS = [
  'mcd_id',
  'evaluator_version_series',
  'config_hash_key',
  'state_code',
  'horizon_hours',
] as const;

/** The keys of a row as the engine returns it (`mcd_worker.statistics.ROW_FIELDS`). */
export const ROW_FIELDS = [
  ...KEY_FIELDS,
  'n',
  'forward_move_median',
  'forward_move_q1',
  'forward_move_q3',
  'opposing_level_rate',
  'adverse_excursion_median',
  'adverse_excursion_q3',
] as const;

export interface SeriesKey {
  mcd_id: string;
  /** `MAJOR.MINOR` of the evaluator, such as `2.0`. */
  evaluator_version_series: string;
  /** The canonical JSON text of the envelope's `config_hash` object (`configHashKeyOf`). */
  config_hash_key: string;
  state_code: string;
  horizon_hours: number;
}

export interface StateStatisticsRow extends SeriesKey {
  /** Occurrences of the state in the series that have an outcome at this horizon. */
  n: number;
  forward_move_median: number | null;
  forward_move_q1: number | null;
  forward_move_q3: number | null;
  /** Always null before build step 4 (Davin's decision, 2026-10-03). */
  opposing_level_rate: number | null;
  adverse_excursion_median: number | null;
  adverse_excursion_q3: number | null;
}

const MCD_ID = /^MCD([0-9]|1[0-5])$/;
const STATE_CODE = /^MCD([0-9]|1[0-5])_[A-Z0-9_]+$/;
const EVALUATOR_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const EVALUATOR_SERIES = /^[0-9]+\.[0-9]+$/;
const STATE_CODE_MAX = 48;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `2.0.1` -> `2.0`. A PATCH continues a series; a MINOR or MAJOR change is another one. */
export function evaluatorSeriesOf(evaluatorVersion: string): string {
  if (
    typeof evaluatorVersion !== 'string' ||
    !EVALUATOR_VERSION.test(evaluatorVersion)
  )
    throw new TypeError(
      `evaluator_version must be MAJOR.MINOR.PATCH, not ${JSON.stringify(evaluatorVersion)}`
    );
  const [major, minor] = evaluatorVersion.split('.');
  return `${major}.${minor}`;
}

/**
 * The series' `config_hash` as one text: the envelope's `config_hash` object, keys sorted, no
 * spaces. Keys are sorted here and the text is built by hand, so neither the order the object was
 * written in nor an integer-like key (which an object keeps in its own order) can change it.
 */
export function configHashKeyOf(configHash: unknown): string {
  if (!isRecord(configHash))
    throw new TypeError('config_hash must be an object');
  const parts = Object.keys(configHash)
    .sort()
    .map((key) => {
      const value = configHash[key];
      if (typeof value !== 'string')
        throw new TypeError(`config_hash.${key} must be a string`);
      return `${JSON.stringify(key)}:${JSON.stringify(value)}`;
    });
  return `{${parts.join(',')}}`;
}

export interface SeriesQuery {
  mcdId: string;
  /** The full evaluator version of the reading, such as `2.0.1`. */
  evaluatorVersion: string;
  /** The reading's own `config_hash` object. */
  configHash: Record<string, string>;
  stateCode: string;
  horizonHours: number;
}

/** The key of the row a reading belongs to. Throws `TypeError` when the reading is not shaped like an envelope's. */
export function seriesKeyOf(query: SeriesQuery): SeriesKey {
  return {
    mcd_id: query.mcdId,
    evaluator_version_series: evaluatorSeriesOf(query.evaluatorVersion),
    config_hash_key: configHashKeyOf(query.configHash),
    state_code: query.stateCode,
    horizon_hours: query.horizonHours,
  };
}

/** Everything wrong with a key (empty list = it names a row that can exist). */
export function keyProblems(key: unknown): string[] {
  if (!isRecord(key)) return ['the key is not an object'];
  const problems: string[] = [];
  const mcd = key['mcd_id'];
  if (typeof mcd !== 'string' || !MCD_ID.test(mcd))
    problems.push(`mcd_id must be MCD0 to MCD15, not ${JSON.stringify(mcd)}`);
  const series = key['evaluator_version_series'];
  if (typeof series !== 'string' || !EVALUATOR_SERIES.test(series))
    problems.push(
      `evaluator_version_series must be MAJOR.MINOR, not ${JSON.stringify(series)}`
    );
  const config = key['config_hash_key'];
  if (typeof config !== 'string') {
    problems.push('config_hash_key must be a string');
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(config);
    } catch {
      parsed = undefined;
    }
    if (!isRecord(parsed)) {
      problems.push('config_hash_key must be the JSON text of an object');
    } else if (
      !Object.values(parsed).every((v) => typeof v === 'string') ||
      configHashKeyOf(parsed) !== config
    ) {
      problems.push(
        'config_hash_key must be the canonical text of an object of strings (keys sorted, no spaces)'
      );
    }
  }
  const state = key['state_code'];
  if (
    typeof state !== 'string' ||
    !STATE_CODE.test(state) ||
    state.length > STATE_CODE_MAX
  ) {
    problems.push(
      `state_code must be MCD<n>_<UPPER_CASE_PARTS> of at most ${STATE_CODE_MAX} characters, not ${JSON.stringify(state)}`
    );
  } else if (typeof mcd === 'string' && !state.startsWith(`${mcd}_`)) {
    problems.push(`state_code ${state} does not belong to ${mcd}`);
  }
  const horizon = key['horizon_hours'];
  if (!(HORIZON_HOURS as readonly unknown[]).includes(horizon))
    problems.push(
      `horizon_hours must be ${HORIZON_HOURS.join(' or ')}, not ${JSON.stringify(horizon)}`
    );
  return problems;
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Everything wrong with one row (empty list = it may be written). The gate is here: `n` below
 * `MIN_SAMPLE` with a number is a problem, and so is `n` at or above it with a figure missing.
 * Nothing is repaired or dropped.
 */
export function rowProblems(row: unknown): string[] {
  if (!isRecord(row)) return ['the row is not an object'];
  const problems: string[] = [];
  const extra = Object.keys(row).filter(
    (key) => !(ROW_FIELDS as readonly string[]).includes(key)
  );
  if (extra.length) problems.push(`unknown fields: ${extra.sort().join(', ')}`);
  const missing = ROW_FIELDS.filter((key) => !(key in row));
  if (missing.length) problems.push(`missing fields: ${missing.join(', ')}`);
  problems.push(...keyProblems(row));

  const n = row['n'];
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    problems.push(
      `n must be a whole number of at least 0, not ${JSON.stringify(n)}`
    );
    return problems;
  }
  if (row['opposing_level_rate'] !== null && 'opposing_level_rate' in row)
    problems.push(
      'opposing_level_rate must be null: it needs the levels and stops of build step 4'
    );

  const figures = MEASURED_FIELDS.filter((field) => field in row);
  if (n < MIN_SAMPLE) {
    const numbered = figures.filter((field) => row[field] !== null);
    if (numbered.length)
      problems.push(
        `n = ${n} is below ${MIN_SAMPLE}, so no number may be stored (${numbered.join(', ')})`
      );
    return problems;
  }
  for (const field of figures) {
    if (!isNumber(row[field]))
      problems.push(
        `${field} must be a finite number at n = ${n}, not ${JSON.stringify(row[field])}`
      );
  }
  const value = (field: MeasuredField) => row[field] as number;
  if (figures.every((field) => isNumber(row[field]))) {
    if (
      !(
        value('forward_move_q1') <= value('forward_move_median') &&
        value('forward_move_median') <= value('forward_move_q3')
      )
    )
      problems.push(
        'the forward move quartiles are out of order (q1 <= median <= q3)'
      );
    if (value('adverse_excursion_median') < 0)
      problems.push('adverse_excursion_median must not be negative');
    if (value('adverse_excursion_median') > value('adverse_excursion_q3'))
      problems.push('the adverse excursion median is above its third quartile');
  }
  return problems;
}
