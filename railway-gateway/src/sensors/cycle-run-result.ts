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
  runtime: { python: string; timings_ms: Record<string, number> };
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
