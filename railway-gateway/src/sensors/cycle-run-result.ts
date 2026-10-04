/**
 * What `python -m mcd_worker.cli` answers (`mcd-cycle-result/1`, `mcd_worker/cycle_runner.py`
 * `CycleResult.to_dict()`), and what can go wrong between the worker and the process.
 *
 * The runner is the authority on this shape. `parseCycleResult` reads only what the worker needs
 * and refuses a result that does not have it, so a runner that changed under the worker is a
 * loud failure and not a row with `undefined` in it.
 */

export const RESULT_SCHEMA = 'mcd-cycle-result/1';
export const REQUEST_VERSION = 'mcd-cycle-request/1';

/** One MCD's reading of the cycle, as the runner returns it (an entry of `results`). */
export interface McdRunResult {
  mcd_id: string;
  /** `shadow` or `live`: the flag when the reading was made. A flag that is `off` is never run, so never here. */
  flag: string;
  evaluator_version: string;
  status: string;
  state_code: string | null;
  bias: string | null;
  /** The canonical envelope text: what is stored and hashed, byte for byte. */
  envelope_json: string;
  envelope_sha256: string;
  evaluator_envelope_sha256: string;
  inherited_reasons: string[];
  guard_problems: string[];
}

/**
 * One trader type's SYN reading of the cycle and its entry zones, as the engine returns it (an entry of
 * `synthesis.readings`, `mcd_worker/synthesis/cycle.py` `ProfileResult.to_dict()`).
 */
export interface SynthesisProfileResult {
  /** DAY_TRADER or SCALPER. */
  profile: string;
  /** The canonical `syn-output/1` text, byte for byte; null when the reading failed its guard in the engine and may not be saved. */
  reading_json: string | null;
  reading_sha256: string | null;
  /** The canonical text of the zone rows that are kept, a JSON list (`[]` when none). */
  zones_json: string;
  /** SHA-256 of `zones_json`. */
  zones_sha256: string;
  /** Why there are no zones (NOT_DIRECTIONAL, NO_REFERENCE_PRICE, NO_ZONE_SOURCES, ZONES_REFUSED, READING_REFUSED); null when there are some. */
  zones_reason: string | null;
  /** Why a reading was withheld or some zones were dropped; never part of the reading. */
  guard_problems: string[];
}

/** The `synthesis` section of a result: present only when the `SYN` flag was `shadow` or `live`. */
export interface SynthesisRunResult {
  flag: string;
  rules_version: string;
  rules_sha256: string;
  /** The zone parameters' version and the SHA-256 of their parsed document. */
  zones_version: string;
  zones_sha256: string;
  /** The close of the last closed M5 bar the zones were built from, or null. */
  reference_price: number | null;
  /** `SYNTHESIS_ERROR` when an unexpected exception stopped synthesis (no readings then); otherwise null. */
  error: string | null;
  readings: SynthesisProfileResult[];
}

export interface CycleRunResult {
  schema_version: typeof RESULT_SCHEMA;
  runner_version: string;
  symbol: string;
  /** ISO 8601 UTC, the runner's text (the gateway keeps the slot as unix seconds). */
  cycle_slot: string;
  /** SHA-256 of `bundle_canonical_json`; null only when the bundle could not be written as JSON. */
  inputs_sha256: string | null;
  /** The exact text `inputs_sha256` is of, as the runner wrote it. The worker stores THIS text and never rebuilds it (Davin, part 3 decision 3). */
  bundle_canonical_json: string | null;
  retuning: { observed: boolean; enforced: boolean; applied: boolean };
  flags: Record<string, string>;
  order: string[];
  gate: {
    mcd_id: string;
    status: string;
    state_code: string | null;
    defect_timeframes: string[];
  } | null;
  results: McdRunResult[];
  runtime: {
    python: string;
    timings_ms: Record<string, number>;
    /** Wall time of the synthesis step; present only with `synthesis`. */
    synthesis_ms?: number;
  };
  /**
   * Build step 4 part 3: the SYN readings and zones, when the `SYN` flag is on; absent when it is `off`, which is what every
   * result looked like before synthesis existed. **Read leniently on purpose**: `parseCycleResult` does not look inside it, so a
   * malformed section cannot fail a cycle and cost the sensors their rows. `SynthesisWriter` checks its shape
   * (`synthesisSectionProblems`) and refuses what it cannot vouch for.
   */
  synthesis?: SynthesisRunResult;
}

/** What the worker did with the process, apart from the answer. */
export interface RunnerOutput {
  result: CycleRunResult;
  /** The runner's log lines (JSON, one per line), the first 64 KB. Evaluator errors are in here. */
  stderr: string;
  /** Wall time of the whole process, milliseconds. */
  wallMs: number;
}

export type RunnerFailureKind =
  /** The process could not be started (Python missing, folder missing). */
  | 'SPAWN'
  /** It ran past its time. It was killed. */
  | 'TIMEOUT'
  /** It refused the request or the configuration (exit 2): the same request fails the same way. */
  | 'REQUEST'
  /** It crashed (exit 1 or a signal): nothing was written to stdout. */
  | 'EXIT'
  /** It exited 0 but what it wrote is not a `mcd-cycle-result/1`. */
  | 'OUTPUT';

/**
 * A run that gave no usable answer. The worker invents nothing in its place: the job fails,
 * and `retryable` says whether Bull's retry is worth trying (a missing interpreter or a
 * refused request fails the same way every time).
 */
export class RunnerError extends Error {
  constructor(
    readonly kind: RunnerFailureKind,
    message: string,
    readonly retryable: boolean,
    readonly details: { exitCode?: number | null; stderr?: string } = {}
  ) {
    super(message);
    this.name = 'RunnerError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

/** Every way `value` is not a result the worker can use. Empty list = it is. */
export function cycleResultProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['the result is not an object'];
  const problems: string[] = [];
  if (value['schema_version'] !== RESULT_SCHEMA)
    problems.push(`schema_version is not ${RESULT_SCHEMA}`);
  for (const key of ['runner_version', 'symbol', 'cycle_slot'])
    if (!isString(value[key])) problems.push(`${key} must be a string`);
  for (const key of ['inputs_sha256', 'bundle_canonical_json'])
    if (!isStringOrNull(value[key]))
      problems.push(`${key} must be a string or null`);
  if (
    (value['inputs_sha256'] === null) !==
    (value['bundle_canonical_json'] === null)
  )
    problems.push(
      'inputs_sha256 and bundle_canonical_json are both set or both null'
    );
  const retuning = value['retuning'];
  if (
    !isRecord(retuning) ||
    !['observed', 'enforced', 'applied'].every(
      (key) => typeof retuning[key] === 'boolean'
    )
  )
    problems.push('retuning must be { observed, enforced, applied } booleans');
  const runtime = value['runtime'];
  if (
    !isRecord(runtime) ||
    !isString(runtime['python']) ||
    !isRecord(runtime['timings_ms'])
  )
    problems.push('runtime must be { python, timings_ms }');
  const results = value['results'];
  if (!Array.isArray(results)) {
    problems.push('results must be a list');
    return problems;
  }
  const seen = new Set<string>();
  results.forEach((entry: unknown, index: number) => {
    const where = `results[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${where} is not an object`);
      return;
    }
    for (const key of [
      'mcd_id',
      'flag',
      'evaluator_version',
      'status',
      'envelope_json',
      'envelope_sha256',
      'evaluator_envelope_sha256',
    ])
      if (!isString(entry[key]))
        problems.push(`${where}.${key} must be a string`);
    for (const key of ['state_code', 'bias'])
      if (!isStringOrNull(entry[key]))
        problems.push(`${where}.${key} must be a string or null`);
    for (const key of ['inherited_reasons', 'guard_problems'])
      if (!isStringList(entry[key]))
        problems.push(`${where}.${key} must be a list of strings`);
    if (entry['flag'] !== 'shadow' && entry['flag'] !== 'live')
      problems.push(`${where}.flag must be shadow or live`);
    if (isString(entry['mcd_id'])) {
      if (seen.has(entry['mcd_id']))
        problems.push(`${where}: ${entry['mcd_id']} appears twice`);
      seen.add(entry['mcd_id']);
      if (
        isRecord(runtime) &&
        isRecord(runtime['timings_ms']) &&
        typeof runtime['timings_ms'][entry['mcd_id']] !== 'number'
      )
        problems.push(
          `runtime.timings_ms has no number for ${entry['mcd_id']}`
        );
    }
  });
  return problems;
}

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

/**
 * Every way the `synthesis` section of a result is not one the synthesis writer can use. Empty list = it is.
 * Kept apart from `cycleResultProblems` on purpose: a section that fails here costs the cycle its SYN rows and
 * nothing else (the MCD rows are still written).
 */
export function synthesisSectionProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['synthesis is not an object'];
  const problems: string[] = [];
  for (const key of [
    'flag',
    'rules_version',
    'rules_sha256',
    'zones_version',
    'zones_sha256',
  ])
    if (!isString(value[key]))
      problems.push(`synthesis.${key} must be a string`);
  if (value['flag'] !== 'shadow' && value['flag'] !== 'live')
    problems.push('synthesis.flag must be shadow or live');
  if (!isNumberOrNull(value['reference_price']))
    problems.push('synthesis.reference_price must be a number or null');
  if (!isStringOrNull(value['error']))
    problems.push('synthesis.error must be a string or null');
  const readings = value['readings'];
  if (!Array.isArray(readings)) {
    problems.push('synthesis.readings must be a list');
    return problems;
  }
  const seen = new Set<string>();
  readings.forEach((entry: unknown, index: number) => {
    const where = `synthesis.readings[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${where} is not an object`);
      return;
    }
    for (const key of ['profile', 'zones_json', 'zones_sha256'])
      if (!isString(entry[key]))
        problems.push(`${where}.${key} must be a string`);
    for (const key of ['reading_json', 'reading_sha256', 'zones_reason'])
      if (!isStringOrNull(entry[key]))
        problems.push(`${where}.${key} must be a string or null`);
    if (!isStringList(entry['guard_problems']))
      problems.push(`${where}.guard_problems must be a list of strings`);
    if (isString(entry['profile'])) {
      if (seen.has(entry['profile']))
        problems.push(`${where}: ${entry['profile']} appears twice`);
      seen.add(entry['profile']);
    }
  });
  return problems;
}

/** The runner's stdout as a result, or a `RunnerError('OUTPUT')` naming what is wrong. */
export function parseCycleResult(text: string): CycleRunResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new RunnerError(
      'OUTPUT',
      `the runner's output is not JSON (${(error as Error).message})`,
      false
    );
  }
  const problems = cycleResultProblems(parsed);
  if (problems.length > 0) {
    throw new RunnerError(
      'OUTPUT',
      `the runner's output is not a ${RESULT_SCHEMA}: ${problems.join('; ')}`,
      false
    );
  }
  return parsed as CycleRunResult;
}
