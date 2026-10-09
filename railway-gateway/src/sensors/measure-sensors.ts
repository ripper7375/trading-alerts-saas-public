import {
  Distribution,
  ValueCount,
  distribution,
} from '../cycle/measure-cycles';
import type { SensorJobOutcome } from './cycle-ready.processor';
import type {
  CycleReplayReport,
  ReplayDatabase,
  ReplayVerdict,
} from './replay';
import { slotToIso } from './inputs/stats-slot';
import {
  NO_MATCH,
  SYNTHESIS_SAMPLE_COLUMNS,
  SYN_STATUSES,
  SynReadingScanner,
  SynthesisJob,
  SynthesisJobSample,
  SynthesisLogEvent,
  SynthesisMeasure,
  SynthesisSample,
  measureSynthesis,
  normalizeSynthesisJob,
  normalizeSynthesisRow,
  parseSynthesisLog,
  synthesisFindings,
} from './measure-synthesis';
import { tableIsMissing } from './table-missing';

/**
 * The measurement kit for the sensor worker (STACK-D-ARCHITECTURE.md section 2.11, standard
 * sections 11.2 and 13; build step 3 part 7; the live use is Phase B, steps B1 to B3).
 *
 * Reads rows of `mcd_outputs`, the READY rows of `market_cycles`, the outcomes of the `cycle-ready`
 * jobs and the verdicts of a replay, and says how the sensors really behave: the mix of readings per
 * MCD, how often MCD0 flags a timeframe, how many readings were replaced by an `EVALUATOR_ERROR`,
 * what the output guards recorded, how long each MCD and the whole cycle took against the budgets of
 * standard 11.2 (1.0 s and 30.0 s), how many rows each cycle has, how many jobs were skipped, whether
 * a replay of stored cycles reproduces them, and whether the MCD0 inheritance rule left a trace that
 * agrees with MCD0's own reading. It decides nothing: reading the status mix, deciding what a high
 * MCD0 rate means for its thresholds, and turning a flag from `shadow` to `live` are Davin's calls,
 * made on these numbers and recorded as decisions.
 *
 * This file is pure (rows in, numbers and text out) apart from `loadSensorRows`, `loadJobOutcomes`
 * and `runMeasureCommand`, which take what they read from the caller, only ever READ, and are
 * held to that by their types. The command line is `scripts/measure-sensors.js`.
 *
 * PERCENTILES are `measure-cycles.ts`'s nearest-rank: every figure is a value that really occurred.
 *
 * CLOCKS. `evaluated_at` is the gateway's clock when the worker STARTED handling the job, in whole
 * seconds (`handle` in `cycle-ready.processor.ts`), and `market_cycles.ready_at` is the same clock when the
 * cycle became READY, also in whole seconds: their difference is the time from the cycle-ready signal
 * to the start of the sensors, accurate to about a second, and it contains any retry back-off.
 * `duration_ms` is the wall time of one MCD inside the Python runner (`time.perf_counter`). The
 * database never holds when the cycle was DONE, so "signal to done" is the start delay plus the job's
 * own wall time when the job outcomes are given (that includes the Python start and the writes'
 * preparation, not the database round trip) or else the sum of the MCDs' times (a lower bound).
 */

// ---------------------------------------------------------------------------
// Constants, pinned to the standard and to the Python worker by tests
// ---------------------------------------------------------------------------

/** One MCD's evaluation budget: standard 11.2 and R15 ("evaluation <= 1 s"), starting value. */
export const MCD_BUDGET_MS = 1000;
/** The whole cycle's budget after the cycle-ready signal: standard 11.2 ("<= 30 s"), starting value. */
export const CYCLE_BUDGET_MS = 30_000;
export const DEFAULT_LAST_CYCLES = 576;
/** How many reasons, mismatches and slots a text report lists before it says "and N more". */
export const LIST_LIMIT = 20;
export const TOP_REASONS = 5;

export const STATUSES = ['VALID', 'CAUTIONARY', 'INVALID', 'STALE'] as const;
export type Status = (typeof STATUSES)[number];

/** The four states of MCD0 and the timeframes each calls defective: `mcd_worker/inheritance.py` `DEFECT_TIMEFRAMES`. */
export const MCD0_DEFECT_TIMEFRAMES: Readonly<
  Record<string, readonly string[]>
> = {
  MCD0_ALL_QUALIFIED: [],
  MCD0_M5_DEFECT: ['M5'],
  MCD0_M15_DEFECT: ['M15'],
  MCD0_M5_M15_DEFECT: ['M5', 'M15'],
};

/** The timeframes whose MCD0 defect marks each MCD: the registries' `uses_channel`. A gate is not marked. */
export const USES_CHANNEL: Readonly<Record<string, readonly string[]>> = {
  MCD0: [],
  MCD1: ['M15'],
  MCD2: ['M5'],
  MCD3: ['M5', 'M15'],
};

/** The reason code the worker adds to a channel MCD on a defective timeframe (`mcd_common/reason_codes.py` `mcd0_defect`). */
export const defectReason = (timeframe: string): string =>
  `MCD0_DEFECT_${timeframe}`;
const DEFECT_REASON = /^MCD0_DEFECT_(M5|M15)$/;

export const EVALUATOR_ERROR = 'EVALUATOR_ERROR';
/** The prefixes the output guards put on a problem (`mcd_worker/guards.py`, `cycle_runner.py`). */
export const GUARD_CATEGORIES = [
  'SCHEMA',
  'IDENTITY',
  'REASONS',
  'REGISTER',
  'WORDING',
  'RAISED',
] as const;
export type GuardCategory = (typeof GUARD_CATEGORIES)[number] | 'OTHER';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** The columns of a `mcd_outputs` row the kit reads. */
export interface SensorRowSample {
  symbol?: string | null;
  cycle_slot: number;
  mcd_id: string;
  flag: string;
  evaluator_version: string;
  status: string;
  state_code: string | null;
  bias: string | null;
  inherited_reasons: string[];
  guard_problems: string[];
  retuning_observed: boolean;
  retuning_applied: boolean;
  duration_ms: number | null;
  evaluated_at: number | null;
  /** The canonical envelope text: the reasons and the free texts are read from it, and it is looked at again. */
  envelope_json: string | null;
}

/** The columns `loadSensorRows` asks the database for: exactly the ones above. */
export const SENSOR_ROW_COLUMNS = {
  symbol: true,
  cycle_slot: true,
  mcd_id: true,
  flag: true,
  evaluator_version: true,
  status: true,
  state_code: true,
  bias: true,
  inherited_reasons: true,
  guard_problems: true,
  retuning_observed: true,
  retuning_applied: true,
  duration_ms: true,
  evaluated_at: true,
  envelope_json: true,
} as const;

/** A READY `market_cycles` row: the slot and when it became READY (the cycle-ready signal). */
export interface ReadySample {
  slot: number;
  ready_at: number | null;
}

export const READY_COLUMNS = { slot: true, ready_at: true } as const;

/** What the worker did with one job (`SensorJobOutcome`, the return value Bull keeps), as far as the kit needs it. */
export interface JobSample {
  outcome: string;
  slot: number | null;
  basis: string | null;
  wallMs: number | null;
  ageSeconds: number | null;
  /** Build step 4 part 6: the SYN part of a WRITTEN outcome (`synthesis` of `SensorJobOutcome`); absent when the flag was off. */
  synthesis?: SynthesisJobSample | null;
}

/** One cycle's replay: its slot and the verdict (`CycleReplayReport`). */
export interface ReplaySample {
  slot: number;
  verdict: string;
  cause: string | null;
  /** Build step 4 part 6: how many SYN readings the replay compared and how many of them were VERIFIED; absent when the cycle has none. */
  synthesis?: { replayed: number; verified: number } | null;
}

export interface SensorMeasureInput {
  rows: SensorRowSample[];
  /** READY cycles of the same range; `null`: not given (the signal-to-start time and the missing cycles are then not measured). */
  ready?: ReadySample[] | null;
  /** Outcomes of `cycle-ready` jobs; `null`: not given (skipped jobs are then not counted). */
  jobs?: JobSample[] | null;
  /** How many jobs failed (Bull's failed set), when known. */
  failedJobs?: number | null;
  /** Replay verdicts; `null` or empty: no determinism check was run. */
  replay?: ReplaySample[] | null;
  /** Rows of `synthesis_readings` of the same range (build step 4 part 6); `null`: not given (no SYN measurement unless a log or the jobs carry SYN outcomes). */
  synthesis?: SynthesisSample[] | null;
  /** The SYN events of the gateway's log (`parseSynthesisLog`); `null`: no log was given. */
  log?: SynthesisLogEvent[] | null;
}

/** Looks at one stored envelope text again; returns what is wrong with it (empty: nothing). The command wires `EnvelopeValidator`. */
export type EnvelopeScanner = (envelopeJson: string) => string[];

export interface MeasureOptions {
  /** The MCDs every cycle should have a row for. Default: the ones in the newest cycle. */
  expectedMcds?: string[] | null;
  /** The second look at every stored envelope (Ajv against the schema). Without it the rescan reports "not run". */
  scan?: EnvelopeScanner | null;
  /** The second look at every stored SYN reading (Ajv against `syn-output/1`). Without it the SYN rescan reports "not run". */
  scanSynthesis?: SynReadingScanner | null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface McdMeasure {
  rows: number;
  flags: { shadow: number; live: number; other: number };
  evaluatorVersions: string[];
  /** Counts by status; a status outside the four is counted under `other`. */
  status: Record<Status, number> & { other: number };
  /** Each count over `rows`, as a fraction from 0 to 1. */
  share: Record<Status, number> & { other: number };
  /** The most common reason codes on the readings that are not VALID, at most five. */
  topReasons: CodeCount[];
  /** Readings carrying `EVALUATOR_ERROR`. */
  evaluatorError: number;
  durationMs: Distribution | null;
  /** Rows slower than the 1 s budget. */
  overBudget: number;
}

export interface CodeCount {
  code: string;
  count: number;
}

export interface Mcd0Flags {
  rows: number;
  /** Rows whose state names the timeframes MCD0 calls defective (a VALID or CAUTIONARY reading). */
  judged: number;
  /** INVALID and STALE rows: they have no state. */
  noState: number;
  /** A state the kit does not know: a state added to the register without the kit. */
  unknownState: number;
  allQualified: number;
  m5Only: number;
  m15Only: number;
  both: number;
  /** M5 flagged at all (M5 only or both), and M15 likewise. */
  m5Flagged: number;
  m15Flagged: number;
  /** Over `judged`; null when none was judged. */
  rate: {
    m5: number | null;
    m15: number | null;
    both: number | null;
    any: number | null;
  };
}

export interface Violations {
  /** Readings carrying `EVALUATOR_ERROR` (any MCD). */
  evaluatorError: number;
  /** Rows with at least one guard problem recorded when the reading was replaced. */
  guardRows: number;
  /** Rows with at least one problem of each category. */
  guardByCategory: Record<GuardCategory, number>;
  /** Rows with a SCHEMA problem, and rows with a WORDING problem (the two the standard names). */
  schema: number;
  wording: number;
  /** The second look at every stored envelope; `ran: false` when no scanner was given. */
  rescan: {
    ran: boolean;
    scanned: number;
    schemaFailures: number;
    /** Rows with a `%` in a free text (rule R9). */
    percentInText: number;
    /** Rows without an envelope text that can be read. */
    unreadable: number;
  };
}

export interface TimingMeasure {
  perMcdBudgetMs: number;
  cycleBudgetMs: number;
  /** Per cycle, the sum of its rows' times: the sensors' own work, a lower bound of the time to done. */
  computeMs: Distribution | null;
  computeOver: number;
  /** evaluated_at - ready_at, in milliseconds (whole seconds, so about a second of resolution), over cycles with both. */
  startDelayMs: Distribution | null;
  /** start delay + the job's wall time (or the cycle's compute time without it), in milliseconds. */
  signalToDoneMs: Distribution | null;
  signalToDoneOver: number;
  /** How many of those used the job's wall time, and how many fell back to the compute time. */
  signalToDoneBasis: { jobWall: number; compute: number };
}

export interface RowsPerCycle {
  expected: string[];
  expectedFrom: 'GIVEN' | 'NEWEST_CYCLE';
  /** How many cycles have 4 rows, how many 3, and so on: most cycles first. */
  byRowCount: ValueCount[];
  complete: number;
  short: number;
  shortCycles: Array<{ slot: number; have: string[]; missing: string[] }>;
  /** Rows of an MCD that is not in the expected list. */
  unexpectedRows: number;
  /** READY cycles in the range; null when the READY rows were not given. */
  readyCycles: number | null;
  /** READY cycles up to the newest cycle with rows that have no row at all. */
  readyWithoutRows: number[] | null;
  /** READY cycles newer than the newest cycle with rows: in flight, or the worker is not keeping up. */
  readyAfterLastRow: number | null;
}

export interface JobsMeasure {
  given: number;
  written: number;
  skippedOld: number;
  nothingEnabled: number;
  other: number;
  /** WRITTEN jobs by what they were made from: the cycle's inputs, or STALE rows when the cycle could not be read. */
  basis: Record<string, number>;
  /** The age of the skipped jobs when they were picked up, seconds. */
  skippedAgeSeconds: Distribution | null;
  wallMs: Distribution | null;
  failed: number | null;
}

export type DeterminismVerdict =
  | 'NOT_CHECKED'
  | 'DETERMINISTIC'
  | 'NOT_DETERMINISTIC'
  | 'STORED_DATA_DAMAGED'
  | 'VERSION_CHANGED'
  | 'INCONCLUSIVE';

export interface DeterminismMeasure {
  verdict: DeterminismVerdict;
  checked: number;
  /** SYN readings (one per trader type and cycle) the replays compared, and how many were VERIFIED (build step 4 part 6). */
  synthesis: { replayed: number; verified: number };
  /** Cycles by replay verdict. */
  counts: Record<string, number>;
  /** The cycles that were not VERIFIED, with the verdict and the cause. */
  attention: Array<{ slot: number; verdict: string; cause: string | null }>;
}

export interface InheritanceMismatch {
  slot: number;
  mcd: string;
  timeframe: string;
  /** MISSING: MCD0 flagged the timeframe (VALID) and this MCD uses it, but its reading does not carry the code. UNEXPLAINED: it carries the code and MCD0 did not flag that timeframe for it. */
  kind: 'MISSING' | 'UNEXPLAINED';
}

export interface InheritanceMeasure {
  /** Cycles whose MCD0 reading is VALID and flags at least one timeframe. */
  cyclesWithValidDefect: number;
  /** (cycle, MCD, timeframe) marks that the rule requires. */
  expectedMarks: number;
  missing: number;
  unexplained: number;
  mismatches: InheritanceMismatch[];
  /** MCDs the kit has no `uses_channel` for (a new MCD): their rows are not checked. */
  unknownMcds: string[];
}

export interface MeasureSensorsReport {
  /** Rows measured (rows without a slot or an MCD are not). */
  rows: number;
  skippedRows: number;
  cycles: number;
  firstSlot: number | null;
  lastSlot: number | null;
  mcds: Record<string, McdMeasure>;
  mcd0: Mcd0Flags;
  violations: Violations;
  timing: TimingMeasure;
  rowsPerCycle: RowsPerCycle;
  /** null when no job outcomes were given. */
  jobs: JobsMeasure | null;
  determinism: DeterminismMeasure;
  inheritance: InheritanceMeasure;
  /** Build step 4 part 6: the SYN readings and entry zones, the refusals counted from the log and the job outcomes; null when none of the three was given. */
  synthesis: SynthesisMeasure | null;
  /** What a person should look at, one line each; empty when nothing needs a look. */
  findings: string[];
  /**
   * What the report could not look at, for a reason that is not a defect (a SYN table that the migration has not created yet). Not findings:
   * `--strict` does not fail on them, and a deployment that has only the sensors, with `SYN` off, sees one and is fine.
   */
  notices: string[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** MCD0, MCD1, ... MCD10: by the number, so MCD10 is after MCD9. */
const byMcd = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

const slotText = (slot: number): string => {
  try {
    return slotToIso(slot);
  } catch {
    return String(slot);
  }
};

function topCodes(counts: Map<string, number>, limit: number): CodeCount[] {
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
    )
    .slice(0, limit);
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** What the kit reads of a stored envelope: its reasons and its free texts. */
interface EnvelopeView {
  readable: boolean;
  reasons: string[];
  texts: string[];
}

const UNREADABLE: EnvelopeView = { readable: false, reasons: [], texts: [] };

/**
 * The texts a trader or the model could read, as the output guard collects them (`mcd_worker/guards.py`
 * `_texts`): the summary, the commentary, the level names and every string inside `details`.
 */
function freeTexts(envelope: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ['summary_line', 'commentary']) {
    const value = envelope[key];
    if (typeof value === 'string') out.push(value);
  }
  const levels = envelope['levels'];
  if (Array.isArray(levels)) {
    for (const level of levels) {
      if (isRecord(level) && typeof level['name'] === 'string') {
        out.push(level['name']);
      }
    }
  }
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (isRecord(node)) Object.keys(node).forEach((k) => walk(node[k]));
  };
  walk(envelope['details']);
  return out;
}

function viewEnvelope(text: string | null): EnvelopeView {
  if (text === null) return UNREADABLE;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return UNREADABLE;
  }
  if (!isRecord(parsed)) return UNREADABLE;
  const reasons = parsed['status_reasons'];
  return {
    readable: true,
    reasons: Array.isArray(reasons)
      ? reasons.filter((r): r is string => typeof r === 'string')
      : [],
    texts: freeTexts(parsed),
  };
}

/** The category of a guard problem: the text before the first colon when it is one the guards use. */
export function guardCategory(problem: string): GuardCategory {
  const head = problem.split(':', 1)[0];
  return (GUARD_CATEGORIES as readonly string[]).includes(head)
    ? (head as GuardCategory)
    : 'OTHER';
}

function emptyStatusCounts(): Record<Status, number> & { other: number } {
  return { VALID: 0, CAUTIONARY: 0, INVALID: 0, STALE: 0, other: 0 };
}

// ---------------------------------------------------------------------------
// The determinism verdict
// ---------------------------------------------------------------------------

/**
 * What each verdict of `replay.ts` means for the determinism question. A `Record` over `ReplayVerdict`, so a verdict added
 * to the replay does not compile here until it is placed.
 */
const VERDICT_KIND: Record<
  ReplayVerdict,
  'VERIFIED' | 'DIVERGED' | 'DAMAGED' | 'VERSION' | 'NOT_REPLAYED'
> = {
  VERIFIED: 'VERIFIED',
  LOGIC_DIVERGENCE: 'DIVERGED',
  TAMPERED_BUNDLE: 'DAMAGED',
  STORED_READING_CORRUPT: 'DAMAGED',
  VERSION_MISMATCH: 'VERSION',
  NOT_REPLAYABLE: 'NOT_REPLAYED',
};

/** A verdict the kit does not know (a report from another version) proves nothing: it is kind `UNKNOWN`. */
function kindOf(
  verdict: string
): (typeof VERDICT_KIND)[ReplayVerdict] | 'UNKNOWN' {
  return Object.prototype.hasOwnProperty.call(VERDICT_KIND, verdict)
    ? VERDICT_KIND[verdict as ReplayVerdict]
    : 'UNKNOWN';
}

/**
 * One word for "does a replay of stored cycles give the stored readings". In order of weight:
 * a `LOGIC_DIVERGENCE` anywhere makes it NOT_DETERMINISTIC (the evaluator, the kit or the runner is not
 * deterministic, or was changed without a version); damaged stored data (`TAMPERED_BUNDLE`,
 * `STORED_READING_CORRUPT`) is a different finding and is reported as such; a `VERSION_MISMATCH` is the
 * expected result of a deploy and is not a defect; cycles that could not be replayed, or a verdict the kit
 * does not know, prove nothing (INCONCLUSIVE); otherwise DETERMINISTIC. No replay at all is NOT_CHECKED.
 */
export function measureDeterminism(
  samples: ReplaySample[] | null | undefined
): DeterminismMeasure {
  const list = samples ?? [];
  const counts: Record<string, number> = {};
  for (const sample of list) {
    counts[sample.verdict] = (counts[sample.verdict] ?? 0) + 1;
  }
  const kinds = new Set(list.map((s) => kindOf(s.verdict)));
  let verdict: DeterminismVerdict;
  if (list.length === 0) verdict = 'NOT_CHECKED';
  else if (kinds.has('DIVERGED')) verdict = 'NOT_DETERMINISTIC';
  else if (kinds.has('DAMAGED')) verdict = 'STORED_DATA_DAMAGED';
  else if (kinds.has('VERSION')) verdict = 'VERSION_CHANGED';
  else if (kinds.has('UNKNOWN') || !kinds.has('VERIFIED'))
    verdict = 'INCONCLUSIVE';
  else verdict = 'DETERMINISTIC';
  const synthesis = { replayed: 0, verified: 0 };
  for (const sample of list) {
    synthesis.replayed += sample.synthesis?.replayed ?? 0;
    synthesis.verified += sample.synthesis?.verified ?? 0;
  }
  return {
    verdict,
    checked: list.length,
    synthesis,
    counts,
    attention: list
      .filter((s) => s.verdict !== 'VERIFIED')
      .map((s) => ({ slot: s.slot, verdict: s.verdict, cause: s.cause })),
  };
}

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

export function measureSensors(
  input: SensorMeasureInput,
  options: MeasureOptions = {}
): MeasureSensorsReport {
  const rows = input.rows
    .filter((r) => isNumber(r.cycle_slot) && typeof r.mcd_id === 'string')
    .sort((a, b) => a.cycle_slot - b.cycle_slot || byMcd(a.mcd_id, b.mcd_id));

  const views = new Map<SensorRowSample, EnvelopeView>();
  for (const row of rows) views.set(row, viewEnvelope(row.envelope_json));

  const cycles = new Map<number, SensorRowSample[]>();
  for (const row of rows) {
    const list = cycles.get(row.cycle_slot);
    if (list === undefined) cycles.set(row.cycle_slot, [row]);
    else list.push(row);
  }
  const slots = [...cycles.keys()].sort((a, b) => a - b);

  const mcds = measureMcds(rows, views);
  const violations = measureViolations(rows, views, options.scan ?? null);
  const rowsPerCycle = measureRowsPerCycle(
    cycles,
    slots,
    options.expectedMcds ?? null,
    input.ready ?? null
  );
  const jobs =
    input.jobs === undefined || input.jobs === null
      ? null
      : measureJobs(input.jobs, input.failedJobs ?? null);
  const timing = measureTiming(
    cycles,
    slots,
    input.ready ?? null,
    input.jobs ?? null
  );
  const determinism = measureDeterminism(input.replay);
  const inheritance = measureInheritance(cycles, slots, views);
  const mcd0 = measureMcd0(rows);
  const synthesis = measureSynthesisPart(input, rows, options);

  const report: MeasureSensorsReport = {
    rows: rows.length,
    skippedRows: input.rows.length - rows.length,
    cycles: slots.length,
    firstSlot: slots.length > 0 ? slots[0] : null,
    lastSlot: slots.length > 0 ? slots[slots.length - 1] : null,
    mcds,
    mcd0,
    violations,
    timing,
    rowsPerCycle,
    jobs,
    determinism,
    inheritance,
    synthesis,
    findings: [],
    notices: [],
  };
  report.findings = findingsOf(report);
  return report;
}

/** A job outcome as the SYN refusal counts read it. */
const synthesisJobOf = (job: JobSample): SynthesisJob => ({
  slot: job.slot,
  synthesis: job.synthesis ?? null,
  written: counterOf(job.outcome) === 'written',
});

/**
 * The SYN measurement, when there is anything to measure: SYN rows were given, or a log, or job outcomes that carry a SYN part (the
 * refusals of a database that does not have the tables yet are in the log and the outcomes and nowhere else).
 */
function measureSynthesisPart(
  input: SensorMeasureInput,
  sensorRows: SensorRowSample[],
  options: MeasureOptions
): SynthesisMeasure | null {
  const jobsCarrySynthesis = (input.jobs ?? []).some(
    (job) => (job.synthesis ?? null) !== null
  );
  if (
    (input.synthesis ?? null) === null &&
    (input.log ?? null) === null &&
    !jobsCarrySynthesis
  ) {
    return null;
  }
  return measureSynthesis(
    {
      rows: input.synthesis ?? [],
      sensorRows,
      jobs: input.jobs == null ? null : input.jobs.map(synthesisJobOf),
      log: input.log ?? null,
    },
    { scan: options.scanSynthesis ?? null }
  );
}

function measureMcds(
  rows: SensorRowSample[],
  views: Map<SensorRowSample, EnvelopeView>
): Record<string, McdMeasure> {
  const ids = [...new Set(rows.map((r) => r.mcd_id))].sort(byMcd);
  const out: Record<string, McdMeasure> = {};
  for (const id of ids) {
    const mine = rows.filter((r) => r.mcd_id === id);
    const status = emptyStatusCounts();
    const flags = { shadow: 0, live: 0, other: 0 };
    const reasons = new Map<string, number>();
    let evaluatorError = 0;
    for (const row of mine) {
      if ((STATUSES as readonly string[]).includes(row.status)) {
        status[row.status as Status] += 1;
      } else status.other += 1;
      if (row.flag === 'shadow') flags.shadow += 1;
      else if (row.flag === 'live') flags.live += 1;
      else flags.other += 1;
      const view = views.get(row) as EnvelopeView;
      if (view.reasons.includes(EVALUATOR_ERROR)) evaluatorError += 1;
      if (row.status !== 'VALID') {
        for (const code of view.reasons) bump(reasons, code);
      }
    }
    const share = (n: number): number => n / mine.length;
    const durations = mine
      .map((r) => r.duration_ms)
      .filter((v): v is number => isNumber(v));
    out[id] = {
      rows: mine.length,
      flags,
      evaluatorVersions: [
        ...new Set(mine.map((r) => r.evaluator_version)),
      ].sort(),
      status,
      share: {
        VALID: share(status.VALID),
        CAUTIONARY: share(status.CAUTIONARY),
        INVALID: share(status.INVALID),
        STALE: share(status.STALE),
        other: share(status.other),
      },
      topReasons: topCodes(reasons, TOP_REASONS),
      evaluatorError,
      durationMs: distribution(durations),
      overBudget: durations.filter((d) => d > MCD_BUDGET_MS).length,
    };
  }
  return out;
}

function measureMcd0(rows: SensorRowSample[]): Mcd0Flags {
  const mine = rows.filter((r) => r.mcd_id === 'MCD0');
  const out: Mcd0Flags = {
    rows: mine.length,
    judged: 0,
    noState: 0,
    unknownState: 0,
    allQualified: 0,
    m5Only: 0,
    m15Only: 0,
    both: 0,
    m5Flagged: 0,
    m15Flagged: 0,
    rate: { m5: null, m15: null, both: null, any: null },
  };
  for (const row of mine) {
    if (row.state_code === null) {
      out.noState += 1;
      continue;
    }
    const frames = Object.prototype.hasOwnProperty.call(
      MCD0_DEFECT_TIMEFRAMES,
      row.state_code
    )
      ? MCD0_DEFECT_TIMEFRAMES[row.state_code]
      : null;
    if (frames === null) {
      out.unknownState += 1;
      continue;
    }
    out.judged += 1;
    const m5 = frames.includes('M5');
    const m15 = frames.includes('M15');
    if (m5) out.m5Flagged += 1;
    if (m15) out.m15Flagged += 1;
    if (m5 && m15) out.both += 1;
    else if (m5) out.m5Only += 1;
    else if (m15) out.m15Only += 1;
    else out.allQualified += 1;
  }
  if (out.judged > 0) {
    out.rate = {
      m5: out.m5Flagged / out.judged,
      m15: out.m15Flagged / out.judged,
      both: out.both / out.judged,
      any: (out.judged - out.allQualified) / out.judged,
    };
  }
  return out;
}

function measureViolations(
  rows: SensorRowSample[],
  views: Map<SensorRowSample, EnvelopeView>,
  scan: EnvelopeScanner | null
): Violations {
  const byCategory: Record<GuardCategory, number> = {
    SCHEMA: 0,
    IDENTITY: 0,
    REASONS: 0,
    REGISTER: 0,
    WORDING: 0,
    RAISED: 0,
    OTHER: 0,
  };
  let guardRows = 0;
  let evaluatorError = 0;
  const rescan = {
    ran: scan !== null,
    scanned: 0,
    schemaFailures: 0,
    percentInText: 0,
    unreadable: 0,
  };
  for (const row of rows) {
    const view = views.get(row) as EnvelopeView;
    if (view.reasons.includes(EVALUATOR_ERROR)) evaluatorError += 1;
    if (row.guard_problems.length > 0) {
      guardRows += 1;
      const seen = new Set(row.guard_problems.map(guardCategory));
      for (const category of seen) byCategory[category] += 1;
    }
    if (!view.readable) rescan.unreadable += 1;
    else if (view.texts.some((t) => t.includes('%'))) rescan.percentInText += 1;
    if (scan !== null && row.envelope_json !== null) {
      rescan.scanned += 1;
      if (scan(row.envelope_json).length > 0) rescan.schemaFailures += 1;
    }
  }
  return {
    evaluatorError,
    guardRows,
    guardByCategory: byCategory,
    schema: byCategory.SCHEMA,
    wording: byCategory.WORDING,
    rescan,
  };
}

function measureRowsPerCycle(
  cycles: Map<number, SensorRowSample[]>,
  slots: number[],
  given: string[] | null,
  ready: ReadySample[] | null
): RowsPerCycle {
  const newest =
    slots.length > 0 ? cycles.get(slots[slots.length - 1]) : undefined;
  const expected = (
    given !== null && given.length > 0
      ? [...new Set(given)]
      : [...new Set((newest ?? []).map((r) => r.mcd_id))]
  ).sort(byMcd);
  const counts = new Map<number, number>();
  const shortCycles: RowsPerCycle['shortCycles'] = [];
  let unexpectedRows = 0;
  let complete = 0;
  for (const slot of slots) {
    const list = cycles.get(slot) as SensorRowSample[];
    counts.set(list.length, (counts.get(list.length) ?? 0) + 1);
    const have = [...new Set(list.map((r) => r.mcd_id))].sort(byMcd);
    unexpectedRows += list.filter((r) => !expected.includes(r.mcd_id)).length;
    const missing = expected.filter((id) => !have.includes(id));
    if (missing.length === 0) complete += 1;
    else shortCycles.push({ slot, have, missing });
  }
  let readyWithoutRows: number[] | null = null;
  let readyAfterLastRow: number | null = null;
  if (ready !== null) {
    const last = slots.length > 0 ? slots[slots.length - 1] : null;
    const readySlots = [...new Set(ready.map((r) => r.slot))].sort(
      (a, b) => a - b
    );
    readyWithoutRows = readySlots.filter(
      (s) => last !== null && s <= last && !cycles.has(s)
    );
    readyAfterLastRow = readySlots.filter(
      (s) => last === null || s > last
    ).length;
  }
  return {
    expected,
    expectedFrom: given !== null && given.length > 0 ? 'GIVEN' : 'NEWEST_CYCLE',
    byRowCount: [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value - b.value),
    complete,
    short: shortCycles.length,
    shortCycles,
    unexpectedRows,
    readyCycles: ready === null ? null : new Set(ready.map((r) => r.slot)).size,
    readyWithoutRows,
    readyAfterLastRow,
  };
}

/**
 * Which counter each outcome of the worker feeds. A `Record` over `SensorJobOutcome['outcome']`, so an outcome added
 * to the processor does not compile here until it is placed.
 */
const OUTCOME_COUNTER: Record<
  SensorJobOutcome['outcome'],
  'written' | 'skippedOld' | 'nothingEnabled'
> = {
  WRITTEN: 'written',
  SKIPPED_OLD: 'skippedOld',
  NOTHING_ENABLED: 'nothingEnabled',
};

function counterOf(
  outcome: string
): 'written' | 'skippedOld' | 'nothingEnabled' | null {
  return Object.prototype.hasOwnProperty.call(OUTCOME_COUNTER, outcome)
    ? OUTCOME_COUNTER[outcome as SensorJobOutcome['outcome']]
    : null;
}

function measureJobs(jobs: JobSample[], failed: number | null): JobsMeasure {
  const out: JobsMeasure = {
    given: jobs.length,
    written: 0,
    skippedOld: 0,
    nothingEnabled: 0,
    other: 0,
    basis: {},
    skippedAgeSeconds: null,
    wallMs: null,
    failed,
  };
  const ages: number[] = [];
  const walls: number[] = [];
  for (const job of jobs) {
    const counter = counterOf(job.outcome);
    if (counter === null) {
      out.other += 1;
      continue;
    }
    out[counter] += 1;
    if (counter === 'written') {
      const basis = job.basis ?? 'UNKNOWN';
      out.basis[basis] = (out.basis[basis] ?? 0) + 1;
      if (isNumber(job.wallMs)) walls.push(job.wallMs);
    } else if (counter === 'skippedOld' && isNumber(job.ageSeconds)) {
      ages.push(job.ageSeconds);
    }
  }
  out.skippedAgeSeconds = distribution(ages);
  out.wallMs = distribution(walls);
  return out;
}

function measureTiming(
  cycles: Map<number, SensorRowSample[]>,
  slots: number[],
  ready: ReadySample[] | null,
  jobs: JobSample[] | null
): TimingMeasure {
  const readyAt = new Map<number, number>();
  for (const r of ready ?? []) {
    if (isNumber(r.ready_at)) readyAt.set(r.slot, r.ready_at);
  }
  const wallBySlot = new Map<number, number>();
  for (const job of jobs ?? []) {
    if (
      counterOf(job.outcome) === 'written' &&
      isNumber(job.slot) &&
      isNumber(job.wallMs)
    ) {
      wallBySlot.set(job.slot, job.wallMs);
    }
  }
  const compute: number[] = [];
  const delays: number[] = [];
  const toDone: number[] = [];
  const basis = { jobWall: 0, compute: 0 };
  for (const slot of slots) {
    const list = cycles.get(slot) as SensorRowSample[];
    const durations = list
      .map((r) => r.duration_ms)
      .filter((v): v is number => isNumber(v));
    // a cycle whose rows are not all timed has no honest sum
    const sum =
      durations.length === list.length && durations.length > 0
        ? durations.reduce((total, v) => total + v, 0)
        : null;
    if (sum !== null) compute.push(sum);
    const started = list
      .map((r) => r.evaluated_at)
      .filter((v): v is number => isNumber(v));
    const signal = readyAt.get(slot);
    if (started.length === 0 || signal === undefined) continue;
    // all rows of a cycle are written together; a row added later (an MCD enabled later) is a later
    // delivery, so the first start is the cycle's
    const delayMs = (Math.min(...started) - signal) * 1000;
    delays.push(delayMs);
    const wall = wallBySlot.get(slot);
    if (wall !== undefined) {
      toDone.push(delayMs + wall);
      basis.jobWall += 1;
    } else if (sum !== null) {
      toDone.push(delayMs + sum);
      basis.compute += 1;
    }
  }
  return {
    perMcdBudgetMs: MCD_BUDGET_MS,
    cycleBudgetMs: CYCLE_BUDGET_MS,
    computeMs: distribution(compute),
    computeOver: compute.filter((v) => v > CYCLE_BUDGET_MS).length,
    startDelayMs: distribution(delays),
    signalToDoneMs: distribution(toDone),
    signalToDoneOver: toDone.filter((v) => v > CYCLE_BUDGET_MS).length,
    signalToDoneBasis: basis,
  };
}

function measureInheritance(
  cycles: Map<number, SensorRowSample[]>,
  slots: number[],
  views: Map<SensorRowSample, EnvelopeView>
): InheritanceMeasure {
  const out: InheritanceMeasure = {
    cyclesWithValidDefect: 0,
    expectedMarks: 0,
    missing: 0,
    unexplained: 0,
    mismatches: [],
    unknownMcds: [],
  };
  const unknown = new Set<string>();
  for (const slot of slots) {
    const list = cycles.get(slot) as SensorRowSample[];
    const gate = list.find((r) => r.mcd_id === 'MCD0');
    const frames =
      gate !== undefined &&
      gate.status === 'VALID' &&
      gate.state_code !== null &&
      Object.prototype.hasOwnProperty.call(
        MCD0_DEFECT_TIMEFRAMES,
        gate.state_code
      )
        ? MCD0_DEFECT_TIMEFRAMES[gate.state_code]
        : [];
    if (frames.length > 0) out.cyclesWithValidDefect += 1;
    for (const row of list) {
      if (!Object.prototype.hasOwnProperty.call(USES_CHANNEL, row.mcd_id)) {
        unknown.add(row.mcd_id);
        continue;
      }
      const uses = USES_CHANNEL[row.mcd_id];
      const marked = row.status === 'VALID' || row.status === 'CAUTIONARY';
      const required = marked ? frames.filter((tf) => uses.includes(tf)) : [];
      const view = views.get(row) as EnvelopeView;
      const present = new Set<string>();
      for (const code of [...view.reasons, ...row.inherited_reasons]) {
        const m = DEFECT_REASON.exec(code);
        if (m !== null) present.add(m[1]);
      }
      out.expectedMarks += required.length;
      for (const tf of required) {
        if (!present.has(tf)) {
          out.missing += 1;
          out.mismatches.push({
            slot,
            mcd: row.mcd_id,
            timeframe: tf,
            kind: 'MISSING',
          });
        }
      }
      for (const tf of [...present].sort()) {
        if (!required.includes(tf)) {
          out.unexplained += 1;
          out.mismatches.push({
            slot,
            mcd: row.mcd_id,
            timeframe: tf,
            kind: 'UNEXPLAINED',
          });
        }
      }
    }
  }
  out.unknownMcds = [...unknown].sort(byMcd);
  return out;
}

function findingsOf(report: MeasureSensorsReport): string[] {
  const out: string[] = [];
  const v = report.violations;
  if (v.evaluatorError > 0)
    out.push(
      `${v.evaluatorError} reading(s) carry EVALUATOR_ERROR (the shadow stage needs none)`
    );
  if (v.guardRows > 0)
    out.push(
      `${v.guardRows} row(s) have guard problems recorded (a reading was replaced)`
    );
  if (v.rescan.schemaFailures > 0)
    out.push(
      `${v.rescan.schemaFailures} stored envelope(s) fail the schema on a second look`
    );
  if (v.rescan.percentInText > 0)
    out.push(
      `${v.rescan.percentInText} stored envelope(s) have a '%' in a free text`
    );
  if (v.rescan.unreadable > 0)
    out.push(`${v.rescan.unreadable} row(s) have no readable envelope text`);
  for (const [id, m] of Object.entries(report.mcds)) {
    if (m.overBudget > 0)
      out.push(
        `${id}: ${m.overBudget} reading(s) took longer than ${MCD_BUDGET_MS} ms`
      );
    if (m.status.other > 0)
      out.push(
        `${id}: ${m.status.other} row(s) have a status outside VALID, CAUTIONARY, INVALID, STALE`
      );
    if (m.flags.other > 0)
      out.push(
        `${id}: ${m.flags.other} row(s) have a flag that is neither shadow nor live`
      );
  }
  if (report.timing.computeOver > 0)
    out.push(
      `${report.timing.computeOver} cycle(s) spent more than ${CYCLE_BUDGET_MS / 1000} s in the MCDs`
    );
  if (report.timing.signalToDoneOver > 0)
    out.push(
      `${report.timing.signalToDoneOver} cycle(s) took more than ${CYCLE_BUDGET_MS / 1000} s from the cycle-ready signal to done`
    );
  if (report.rowsPerCycle.short > 0)
    out.push(
      `${report.rowsPerCycle.short} cycle(s) lack a row of an expected MCD`
    );
  const without = report.rowsPerCycle.readyWithoutRows;
  if (without !== null && without.length > 0)
    out.push(
      `${without.length} READY cycle(s) before the newest reading have no row at all`
    );
  if (report.mcd0.unknownState > 0)
    out.push(
      `MCD0: ${report.mcd0.unknownState} row(s) have a state the kit does not know`
    );
  if (report.inheritance.missing > 0)
    out.push(
      `${report.inheritance.missing} MCD0 mark(s) are missing from a channel MCD`
    );
  if (report.inheritance.unexplained > 0)
    out.push(
      `${report.inheritance.unexplained} MCD0 mark(s) have no MCD0 defect behind them`
    );
  if (report.inheritance.unknownMcds.length > 0)
    out.push(
      `no uses_channel is known for ${report.inheritance.unknownMcds.join(', ')}: their marks were not checked`
    );
  const d = report.determinism.verdict;
  if (d !== 'NOT_CHECKED' && d !== 'DETERMINISTIC' && d !== 'VERSION_CHANGED')
    out.push(`replay: ${d}`);
  if (report.synthesis !== null)
    out.push(...synthesisFindings(report.synthesis));
  return out;
}

// ---------------------------------------------------------------------------
// Text report
// ---------------------------------------------------------------------------

const num = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(1);

const pct = (share: number | null): string =>
  share === null ? 'n/a' : `${(share * 100).toFixed(1)}%`;

/** One distribution on one line: `plain` prints the values as they are, `seconds` turns milliseconds into seconds (two decimals). */
function distRow(
  label: string,
  d: Distribution | null,
  unit: 'plain' | 'seconds' = 'plain'
): string {
  const show = (v: number): string =>
    unit === 'seconds' ? (Math.round(v / 10) / 100).toFixed(2) : num(v);
  const cells = (
    d
      ? [
          String(d.count),
          ...[d.min, d.p50, d.p90, d.p99, d.max, d.mean].map(show),
        ]
      : ['0', '-', '-', '-', '-', '-', '-']
  ).map((c) => c.padStart(9));
  const skew = d && d.negative > 0 ? `   (${d.negative} below 0)` : '';
  return `${label.padEnd(34)}${cells.join('')}${skew}`;
}

const DIST_HEADER = ['count', 'min', 'p50', 'p90', 'p99', 'max', 'mean']
  .map((h) => h.padStart(9))
  .join('');

function listLimited<T>(items: T[], show: (item: T) => string): string[] {
  const lines = items.slice(0, LIST_LIMIT).map(show);
  if (items.length > LIST_LIMIT) {
    lines.push(`    ... and ${items.length - LIST_LIMIT} more`);
  }
  return lines;
}

/** The report as plain text, for a terminal or a saved file. */
export function formatReport(report: MeasureSensorsReport): string {
  const lines: string[] = [];
  lines.push(
    `Sensor measurement: ${report.cycles} cycles, ${report.rows} rows` +
      (report.skippedRows > 0
        ? ` (${report.skippedRows} rows without a slot or an MCD skipped)`
        : '') +
      `, slots ${report.firstSlot === null ? 'n/a' : slotText(report.firstSlot)} to ${report.lastSlot === null ? 'n/a' : slotText(report.lastSlot)}`
  );
  const rpc = report.rowsPerCycle;
  lines.push(
    `Expected MCDs per cycle: ${rpc.expected.join(', ') || 'none'} (${rpc.expectedFrom === 'GIVEN' ? 'given' : 'those of the newest cycle'})`
  );
  lines.push('');

  lines.push('Status mix per MCD (rows, and each status as a share of them)');
  for (const [id, m] of Object.entries(report.mcds)) {
    const cell = (s: Status): string =>
      `${s} ${m.status[s]} (${pct(m.share[s])})`;
    const other = m.status.other > 0 ? `  other ${m.status.other}` : '';
    lines.push(
      `  ${id.padEnd(5)} rows ${String(m.rows).padStart(5)}   ${STATUSES.map(cell).join('  ')}${other}` +
        `   flag ${describeFlags(m.flags)}, evaluator ${m.evaluatorVersions.join(', ')}`
    );
    if (m.topReasons.length > 0) {
      lines.push(
        `        reasons on readings that are not VALID: ${m.topReasons.map((r) => `${r.code} x ${r.count}`).join(', ')}`
      );
    }
  }
  lines.push('');

  const z = report.mcd0;
  lines.push(
    `MCD0 flag rate (over ${z.judged} readings that name a state; ${z.noState} INVALID or STALE have none` +
      (z.unknownState > 0
        ? `; ${z.unknownState} have a state the kit does not know`
        : '') +
      ')'
  );
  lines.push(
    `  M5 flagged ${z.m5Flagged} (${pct(z.rate.m5)})   M15 flagged ${z.m15Flagged} (${pct(z.rate.m15)})   both ${z.both} (${pct(z.rate.both)})   either ${z.judged - z.allQualified} (${pct(z.rate.any)})   none ${z.allQualified}`
  );
  lines.push(
    `  (M5 only ${z.m5Only}, M15 only ${z.m15Only}; a VALID reading of a flagged timeframe marks the channel MCDs CAUTIONARY)`
  );
  lines.push('');

  const v = report.violations;
  lines.push('Errors and violations');
  lines.push(`  EVALUATOR_ERROR readings: ${v.evaluatorError}`);
  lines.push(
    `  rows with guard problems: ${v.guardRows}` +
      (v.guardRows > 0
        ? ` (${[...GUARD_CATEGORIES, 'OTHER' as const]
            .filter((c) => v.guardByCategory[c] > 0)
            .map((c) => `${c} ${v.guardByCategory[c]}`)
            .join(', ')})`
        : '')
  );
  lines.push(
    `  schema violations recorded: ${v.schema}   wording violations recorded: ${v.wording}`
  );
  lines.push(
    v.rescan.ran
      ? `  second look at every stored envelope: ${v.rescan.scanned} scanned, ${v.rescan.schemaFailures} fail the schema, ${v.rescan.percentInText} have a '%' in a free text, ${v.rescan.unreadable} unreadable`
      : `  second look at every stored envelope: not run (no schema scanner); ${v.rescan.percentInText} have a '%' in a free text, ${v.rescan.unreadable} unreadable`
  );
  lines.push('');

  const t = report.timing;
  lines.push(
    `Milliseconds per MCD (nearest-rank percentiles), budget ${t.perMcdBudgetMs} ms (standard 11.2)`
  );
  lines.push(`${''.padEnd(34)}${DIST_HEADER}   over`);
  for (const [id, m] of Object.entries(report.mcds)) {
    lines.push(`${distRow(`  ${id}`, m.durationMs)}   ${m.overBudget}`);
  }
  lines.push('');
  lines.push(
    `Seconds per cycle, budget ${t.cycleBudgetMs / 1000} s after the cycle-ready signal (standard 11.2)`
  );
  lines.push(`${''.padEnd(34)}${DIST_HEADER}   over`);
  lines.push(
    `${distRow('  MCDs, summed (lower bound)', t.computeMs, 'seconds')}   ${t.computeOver}`
  );
  lines.push(distRow('  signal to start', t.startDelayMs, 'seconds'));
  lines.push(
    `${distRow('  signal to done', t.signalToDoneMs, 'seconds')}   ${t.signalToDoneOver}`
  );
  lines.push(
    `  (signal to done = signal to start + the job's wall time for ${t.signalToDoneBasis.jobWall} cycle(s), + the MCDs' summed time for ${t.signalToDoneBasis.compute}; the start is in whole seconds)`
  );
  lines.push('');

  lines.push(
    `Rows per cycle: ${rpc.complete} of ${report.cycles} cycles have a row for every expected MCD` +
      (rpc.byRowCount.length > 0
        ? ` (${rpc.byRowCount.map((c) => `${c.count} x ${c.value} rows`).join(', ')})`
        : '')
  );
  lines.push(
    ...listLimited(
      rpc.shortCycles,
      (c) => `    ${slotText(c.slot)} lacks ${c.missing.join(', ')}`
    )
  );
  if (rpc.unexpectedRows > 0) {
    lines.push(
      `  ${rpc.unexpectedRows} row(s) belong to an MCD that is not expected`
    );
  }
  if (rpc.readyCycles !== null) {
    const without = rpc.readyWithoutRows ?? [];
    lines.push(
      `  READY cycles in the range: ${rpc.readyCycles}; ${without.length} before the newest reading have no row; ${rpc.readyAfterLastRow ?? 0} after it (in flight, or the worker is behind)`
    );
    lines.push(...listLimited(without, (s) => `    ${slotText(s)} has no row`));
  } else {
    lines.push(
      '  READY cycles: not given (cycles with no row at all cannot be listed)'
    );
  }
  lines.push('');

  if (report.jobs === null) {
    lines.push(
      'Jobs: no outcomes given (skipped jobs are not counted; give --jobs or --redis)'
    );
  } else {
    const j = report.jobs;
    lines.push(
      `Jobs: ${j.given} outcomes: ${j.written} written, ${j.skippedOld} skipped as too old, ${j.nothingEnabled} with every MCD off` +
        (j.other > 0 ? `, ${j.other} other` : '') +
        (j.failed !== null ? `; ${j.failed} failed` : '')
    );
    const basis = Object.entries(j.basis).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    if (basis.length > 0) {
      lines.push(
        `  written from: ${basis.map(([k, n]) => `${k} ${n}`).join(', ')}`
      );
    }
    lines.push(`${''.padEnd(34)}${DIST_HEADER}`);
    lines.push(distRow('  job wall time, ms', j.wallMs));
    lines.push(distRow('  age of a skipped job, s', j.skippedAgeSeconds));
  }
  lines.push('');

  const d = report.determinism;
  lines.push(
    `Determinism: ${d.verdict}` +
      (d.checked > 0
        ? ` (${d.checked} cycle(s) replayed: ${Object.entries(d.counts)
            .map(([k, n]) => `${n} ${k}`)
            .join(', ')})`
        : ' (no replay was run; give --replay N or --replay-file)')
  );
  if (d.synthesis.replayed > 0) {
    lines.push(
      `  SYN readings replayed: ${d.synthesis.verified} of ${d.synthesis.replayed} VERIFIED (reading and zones, byte for byte)`
    );
  }
  lines.push(
    ...listLimited(
      d.attention,
      (a) =>
        `    ${slotText(a.slot)} ${a.verdict}${a.cause ? ` (${a.cause})` : ''}`
    )
  );
  lines.push('');

  const h = report.inheritance;
  lines.push(
    `MCD0 inheritance: ${h.cyclesWithValidDefect} cycle(s) with a VALID defect, ${h.expectedMarks} mark(s) required, ${h.missing} missing, ${h.unexplained} without a defect behind them`
  );
  lines.push(
    ...listLimited(
      h.mismatches,
      (m) => `    ${slotText(m.slot)} ${m.mcd} ${m.timeframe} ${m.kind}`
    )
  );
  lines.push('');

  if (report.synthesis !== null) {
    lines.push(...formatSynthesis(report.synthesis));
    lines.push('');
  }

  if (report.notices.length > 0) {
    lines.push('Notices (not findings; --strict ignores them):');
    for (const n of report.notices) lines.push(`  - ${n}`);
    lines.push('');
  }

  lines.push(
    report.findings.length === 0
      ? 'Findings: none'
      : `Findings (${report.findings.length}):`
  );
  for (const f of report.findings) lines.push(`  - ${f}`);
  return lines.join('\n');
}

function describeFlags(f: McdMeasure['flags']): string {
  const parts: string[] = [];
  if (f.shadow > 0) parts.push(`shadow ${f.shadow}`);
  if (f.live > 0) parts.push(`live ${f.live}`);
  if (f.other > 0) parts.push(`other ${f.other}`);
  return parts.join(' ') || 'none';
}

/** The SYN section of the text report (build step 4 part 6). */
function formatSynthesis(m: SynthesisMeasure): string[] {
  const lines: string[] = [];
  const flags: string[] = [];
  if (m.flags.shadow > 0) flags.push(`shadow ${m.flags.shadow}`);
  if (m.flags.live > 0) flags.push(`live ${m.flags.live}`);
  if (m.flags.other > 0) flags.push(`other ${m.flags.other}`);
  if (m.rows === 0) {
    lines.push(
      'SYN (synthesis): no SYN rows in the range (the SYN flag was off, or the tables are not there); the refusals below come from the log and the job outcomes'
    );
  } else {
    lines.push(
      `SYN (synthesis): ${m.rows} rows in ${m.cycles} cycles, slots ${m.firstSlot === null ? 'n/a' : slotText(m.firstSlot)} to ${m.lastSlot === null ? 'n/a' : slotText(m.lastSlot)}; ` +
        `flag ${flags.join(', ') || 'none'}; rules ${m.rulesVersions.join(', ') || 'none'}`
    );
    const rpc = m.rowsPerCycle;
    lines.push(
      `  rows per cycle: ${rpc.complete} of ${rpc.cycles} cycles have a row for every trader type (${rpc.expected.join(', ')})` +
        (rpc.byRowCount.length > 0
          ? ` (${rpc.byRowCount.map((c) => `${c.count} x ${c.value} rows`).join(', ')})`
          : '')
    );
    lines.push(
      ...listLimited(
        rpc.shortCycles,
        (c) => `    ${slotText(c.slot)} lacks ${c.missing.join(', ')}`
      )
    );
    if (rpc.sensorCyclesWithoutSyn.length > 0) {
      lines.push(
        `  ${rpc.sensorCyclesWithoutSyn.length} cycle(s) with sensor rows after the first SYN row have no SYN row at all`
      );
      lines.push(
        ...listLimited(
          rpc.sensorCyclesWithoutSyn,
          (s) => `    ${slotText(s)} has no SYN row`
        )
      );
    }
    if (rpc.unexpectedRows > 0) {
      lines.push(
        `  ${rpc.unexpectedRows} row(s) belong to a trader type that is not expected`
      );
    }
    for (const [id, p] of Object.entries(m.profiles)) {
      const cell = (s: (typeof SYN_STATUSES)[number]): string =>
        `${s} ${p.status[s]} (${pct(p.share[s])})`;
      lines.push(
        `  ${id.padEnd(10)} rows ${String(p.rows).padStart(5)}   ${SYN_STATUSES.map(cell).join('  ')}` +
          (p.status.other > 0 ? `  other ${p.status.other}` : '')
      );
      const counts = (record: Record<string, number>): string =>
        Object.entries(record)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ');
      lines.push(`        bias: ${counts(p.bias)}`);
      lines.push(`        archetype: ${counts(p.archetype)}`);
      lines.push(`        data status: ${counts(p.dataStatus)}`);
      if (p.topReasons.length > 0) {
        lines.push(
          `        reasons on readings that are not VALID: ${p.topReasons.map((r) => `${r.code} x ${r.count}`).join(', ')}`
        );
      }
      lines.push(
        `        rule hits (${p.ruleHits.length} rule(s) decided a reading):`
      );
      lines.push(
        ...listLimited(
          p.ruleHits,
          (r) =>
            `          ${r.ruleId.padEnd(40)} ${String(r.count).padStart(6)} (${pct(r.share)})${r.ruleId === NO_MATCH ? '   <- no row of the rules table matched' : ''}`
        )
      );
      lines.push(
        `        readings by number of zones: ${p.zoneHistogram.map((z) => `${z.count} with ${z.value}`).join(', ') || 'none'} (${p.withZones} reading(s) have zones)` +
          (p.zonesReasons.length > 0
            ? `; none because ${p.zonesReasons.map((r) => `${r.code} x ${r.count}`).join(', ')}`
            : '')
      );
      if (p.guardRows > 0) {
        lines.push(
          `        ${p.guardRows} reading(s) had zones the engine dropped (guard problems recorded)`
        );
      }
    }
    lines.push(`${''.padEnd(34)}${DIST_HEADER}`);
    lines.push(distRow('  zones per cycle (both types)', m.zonesPerCycle));
    lines.push(distRow('  SYN step per cycle, ms', m.durationMs));
    lines.push(
      `  cycles without any zone: ${m.cyclesWithoutZones} of ${m.cycles}`
    );
  }
  lines.push(
    m.noMatch.length === 0
      ? '  NO_MATCH: no reading matched no rule'
      : `  NO_MATCH: ${m.noMatch.length} reading(s) matched no rule, with the states of the sensors:`
  );
  lines.push(
    ...listLimited(m.noMatch, (c) => {
      const sensors = Object.entries(c.sensors)
        .map(([id, state]) => `${id} ${state}`)
        .join(' | ');
      return `    ${slotText(c.slot)} ${c.profile.padEnd(10)} ${c.dataStatus}  ${sensors || 'no sensor state'}${c.sensorsFrom === 'SENSOR_ROWS' ? "  (from the sensors' rows)" : c.sensorsFrom === 'NONE' ? '  (no sensor rows)' : ''}`;
    })
  );
  if (m.rows > 0) {
    const w = m.wording;
    lines.push(
      `  wording: ${w.scanned} reading(s) read; ${w.percent} with a '%', ${w.banned} with a banned word, ${w.advice} with an advice word, ${w.summaryTooLong} with a summary over 80 characters, ${w.unreadable} unreadable` +
        (w.schema.ran
          ? `; second look against syn-output/1: ${w.schema.scanned} scanned, ${w.schema.failures} fail`
          : '; second look against syn-output/1: not run (no schema scanner)')
    );
    lines.push(
      ...listLimited(
        w.examples,
        (e) => `    ${slotText(e.slot)} ${e.profile}: ${e.problem}`
      )
    );
  }
  const r = m.refusals;
  if (!r.given.log && !r.given.jobs) {
    lines.push(
      '  refusals: no log and no job outcomes given (readings the gateway left out are not counted; give --log FILE and --jobs or --redis)'
    );
  } else {
    if (r.log !== null) {
      lines.push(
        `  refusals in the log: ${r.log.readingRefused} reading(s) refused` +
          (Object.keys(r.log.byProfileSource).length > 0
            ? ` (${Object.entries(r.log.byProfileSource)
                .map(([k, n]) => `${k} ${n}`)
                .join(', ')})`
            : '') +
          `, ${r.log.engineErrors} engine error(s), ${r.log.zonesDropped} zone set(s) dropped, ${r.log.tablesMissing} cycle(s) without the tables, ${r.log.tablesCheckFailed} failed table check(s); ${r.log.events} line(s), ${r.log.distinct} distinct`
      );
    }
    if (r.jobs !== null) {
      lines.push(
        `  refusals in the job outcomes: ${r.jobs.readingRefused} reading(s) refused` +
          (Object.keys(r.jobs.byProfileSource).length > 0
            ? ` (${Object.entries(r.jobs.byProfileSource)
                .map(([k, n]) => `${k} ${n}`)
                .join(', ')})`
            : '') +
          `, ${r.jobs.engineErrors} engine error(s), ${r.jobs.tablesMissing} cycle(s) without the tables; ${r.jobs.ranSynthesis} of ${r.jobs.written} written job(s) ran synthesis`
      );
    }
    if (r.topProblems.length > 0) {
      lines.push(
        `    what the refusals said: ${r.topProblems.map((p) => `${p.code} x ${p.count}`).join('; ')}`
      );
    }
    if (r.gaps !== null) {
      lines.push(
        `  cycles with fewer SYN rows than trader types: ${r.gaps.checked} looked at, ${r.gaps.explained} explained by a refusal or an engine error, ${r.gaps.unexplained.length} not explained by anything` +
          (r.given.log ? '' : ' (jobs only: just the slots the jobs cover)')
      );
      lines.push(
        ...listLimited(
          r.gaps.unexplained,
          (s) => `    ${slotText(s)} has fewer SYN rows and nothing says why`
        )
      );
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Input: JSON, the database (read only), the queue (read only), and the command line
// ---------------------------------------------------------------------------

const asNumber = (v: unknown): number | null => (isNumber(v) ? v : null);
const asText = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;
const asTexts = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** A raw JSON object as a row of `mcd_outputs`, or null when it has no numeric slot or no MCD id. */
export function normalizeRow(raw: unknown): SensorRowSample | null {
  if (!isRecord(raw)) return null;
  const slot = raw['cycle_slot'];
  const mcd = raw['mcd_id'];
  if (!isNumber(slot) || typeof mcd !== 'string' || mcd === '') return null;
  return {
    symbol: asText(raw['symbol']),
    cycle_slot: slot,
    mcd_id: mcd,
    flag: asText(raw['flag']) ?? 'UNKNOWN',
    evaluator_version: asText(raw['evaluator_version']) ?? 'UNKNOWN',
    status: asText(raw['status']) ?? 'UNKNOWN',
    state_code: asText(raw['state_code']),
    bias: asText(raw['bias']),
    inherited_reasons: asTexts(raw['inherited_reasons']),
    guard_problems: asTexts(raw['guard_problems']),
    retuning_observed: raw['retuning_observed'] === true,
    retuning_applied: raw['retuning_applied'] === true,
    duration_ms: asNumber(raw['duration_ms']),
    evaluated_at: asNumber(raw['evaluated_at']),
    envelope_json: asText(raw['envelope_json']),
  };
}

export function normalizeReady(raw: unknown): ReadySample | null {
  if (!isRecord(raw) || !isNumber(raw['slot'])) return null;
  return { slot: raw['slot'], ready_at: asNumber(raw['ready_at']) };
}

/** A job outcome, or a Bull job whose `returnvalue` is one; null for anything else. */
export function normalizeJob(raw: unknown): JobSample | null {
  if (!isRecord(raw)) return null;
  const value = isRecord(raw['returnvalue']) ? raw['returnvalue'] : raw;
  const outcome = asText(value['outcome']);
  if (outcome === null) return null;
  const synthesis = normalizeSynthesisJob(value['synthesis']);
  return {
    outcome,
    slot: asNumber(value['slot']),
    basis: asText(value['basis']),
    wallMs: asNumber(value['wallMs']),
    ageSeconds: asNumber(value['ageSeconds']),
    ...(synthesis === null ? {} : { synthesis }),
  };
}

/** A replay report as `replay-cycle.js --json` prints it, or a bare `{ slot, verdict }`. */
export function normalizeReplay(raw: unknown): ReplaySample | null {
  if (!isRecord(raw) || !isNumber(raw['slot'])) return null;
  const verdict = asText(raw['verdict']);
  if (verdict === null) return null;
  const profiles = isRecord(raw['synthesis'])
    ? raw['synthesis']['profiles']
    : undefined;
  const compared = Array.isArray(profiles) ? profiles.filter(isRecord) : [];
  return {
    slot: raw['slot'],
    verdict,
    cause: asText(raw['cause']),
    ...(compared.length === 0
      ? {}
      : {
          synthesis: {
            replayed: compared.length,
            verified: compared.filter((p) => p['verdict'] === 'VERIFIED')
              .length,
          },
        }),
  };
}

/** The log as the input file gives it: one text, or a list of lines. */
function logOf(value: unknown): SynthesisLogEvent[] | null {
  if (typeof value === 'string') return parseSynthesisLog(value);
  if (Array.isArray(value)) {
    return parseSynthesisLog(
      value
        .filter((line): line is string => typeof line === 'string')
        .join('\n')
    );
  }
  return null;
}

function listOf<T>(
  value: unknown,
  normalize: (raw: unknown) => T | null
): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalize).filter((x): x is T => x !== null);
}

/**
 * The input file: `{ "rows": [...], "ready": [...], "jobs": [...], "replay": [...], "failedJobs": 0, "synthesis": [...], "log": "text" }`,
 * where only `rows` is required (`synthesis` holds `synthesis_readings` rows, `log` the gateway's log as one text or a list of lines), or a bare array of rows. Bad rows are dropped (the caller counts them from the lengths).
 */
export interface ParsedInput {
  input: SensorMeasureInput;
  /** Rows given and dropped. */
  droppedRows: number;
}

export function parseInputJson(text: string): ParsedInput {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`not valid JSON: ${(error as Error).message}`);
  }
  const object = isRecord(data) ? data : null;
  const rawRows = Array.isArray(data)
    ? data
    : object !== null
      ? object['rows']
      : undefined;
  if (!Array.isArray(rawRows)) {
    throw new Error(
      'expected a JSON array of mcd_outputs rows, or an object with a "rows" array'
    );
  }
  const rows = rawRows
    .map(normalizeRow)
    .filter((r): r is SensorRowSample => r !== null);
  return {
    droppedRows: rawRows.length - rows.length,
    input: {
      rows,
      ready: object === null ? null : listOf(object['ready'], normalizeReady),
      jobs: object === null ? null : listOf(object['jobs'], normalizeJob),
      replay:
        object === null ? null : listOf(object['replay'], normalizeReplay),
      failedJobs: object === null ? null : asNumber(object['failedJobs']),
      synthesis:
        object === null
          ? null
          : listOf(object['synthesis'], normalizeSynthesisRow),
      log: object === null ? null : logOf(object['log']),
    },
  };
}

/** A list of job outcomes (an array, or an object with a "jobs" array) from a JSON text. */
export function parseJobsJson(text: string): JobSample[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`not valid JSON: ${(error as Error).message}`);
  }
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? data['jobs']
      : undefined;
  const jobs = listOf(list, normalizeJob);
  if (jobs === null) throw new Error('expected a JSON array of job outcomes');
  return jobs;
}

/** A list of replay verdicts (what `replay-cycle.js --json` prints: an array of reports) from a JSON text. */
export function parseReplayJson(text: string): ReplaySample[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`not valid JSON: ${(error as Error).message}`);
  }
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? data['replay']
      : undefined;
  const samples = listOf(list, normalizeReplay);
  if (samples === null)
    throw new Error('expected a JSON array of replay reports');
  return samples;
}

export interface CliOptions {
  help: boolean;
  /** Read everything from this JSON file instead of the database. */
  file: string | null;
  /** Read `mcd_outputs` and the READY `market_cycles` rows from the database (DATABASE_URL). */
  db: boolean;
  symbol: string;
  /** Unix seconds. */
  since: number | null;
  until: number | null;
  /** The newest N cycles (default 576, two days of slots) when neither bound is given. */
  last: number | null;
  expect: string[] | null;
  /** Job outcomes from this JSON file. */
  jobsFile: string | null;
  /** Job outcomes from the `cycle-ready` queue in Redis (REDIS_URL), read only. */
  redis: boolean;
  /** Replay the newest N cycles of the range (needs --db and Python). */
  replay: number;
  /** Replay verdicts from this JSON file (what `replay-cycle.js --json` printed). */
  replayFile: string | null;
  /** The gateway's log, one file each (build step 4 part 6): the SYN refusals are counted from it. */
  logFiles: string[];
  json: boolean;
  /** Exit 1 when there is a finding. */
  strict: boolean;
}

export const USAGE = `Usage:
  node scripts/measure-sensors.js --db   [--symbol XAUUSD] [--last 576 | --since T --until T] [--expect MCD0,MCD1,MCD2,MCD3]
                                         [--jobs jobs.json | --redis] [--replay N | --replay-file replay.json] [--log gateway.log ...] [--json] [--strict]
  node scripts/measure-sensors.js --file sensors.json [--symbol XAUUSD] [--expect ...] [--jobs jobs.json] [--replay-file replay.json] [--log gateway.log ...] [--json] [--strict]

  --db       read mcd_outputs, synthesis_readings and the READY market_cycles rows from the database in DATABASE_URL (read only:
             SELECTs; a database without the SYN table is read as "no SYN rows", with a note)
  --file     read rows from a JSON file: { "rows": [...], "ready": [...], "jobs": [...], "replay": [...], "synthesis": [...], "log": "..." } (see the runbook)
  --since/--until  unix seconds or an ISO date (2026-10-03T00:00:00Z), on the cycle slot
  --last     the newest N cycles (default ${DEFAULT_LAST_CYCLES}, two days of slots)
  --expect   the MCDs every cycle should have a row for (default: the ones in the newest cycle)
  --jobs     job outcomes as JSON (an array of what the worker returns for a job: outcome, slot, basis, wallMs, ageSeconds,
             and a synthesis part with its refused readings when the SYN flag was on)
  --redis    read the outcomes of the last 100 completed jobs of the cycle-ready queue from REDIS_URL (read only)
  --replay   replay the newest N cycles of the range from their stored bundles and report the verdicts (needs --db, Python,
             PyYAML, jsonschema and the engine folder: SENSOR_PYTHON, SENSOR_ENGINE_DIR)
  --replay-file  replay verdicts as JSON, the output of: node scripts/replay-cycle.js --db --slot ... --json
  --log      a log file of the gateway (plain lines or Railway's JSON lines); may be repeated. The SYN lines are counted:
             SYN_READING_REFUSED, SYN_ENGINE_ERROR, SYN_ZONES_DROPPED, SYN_TABLES_MISSING, SYN_TABLES_CHECK_FAILED. Together with
             the job outcomes this is where refused SYN readings are counted (they are logged, not stored)
  --json     print the report as JSON instead of text
  --strict   exit 1 when the report has a finding (exit 0 otherwise; 2 for a bad command line, 1 also for an error)`;

function parseTime(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Command-line arguments (without `node` and the script) as options, or an error text. */
export function parseArgs(argv: string[]): CliOptions | { error: string } {
  const options: CliOptions = {
    help: false,
    file: null,
    db: false,
    symbol: 'XAUUSD',
    since: null,
    until: null,
    last: null,
    expect: null,
    jobsFile: null,
    redis: false,
    replay: 0,
    replayFile: null,
    logFiles: [],
    json: false,
    strict: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = (): string | null => {
      i += 1;
      return i < argv.length ? argv[i] : null;
    };
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--db':
        options.db = true;
        break;
      case '--redis':
        options.redis = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--file':
      case '--jobs':
      case '--log':
      case '--replay-file': {
        const v = value();
        if (v === null || v === '') return { error: `${arg} needs a path` };
        if (arg === '--file') options.file = v;
        else if (arg === '--jobs') options.jobsFile = v;
        else if (arg === '--log') options.logFiles.push(v);
        else options.replayFile = v;
        break;
      }
      case '--symbol': {
        const v = value();
        if (v === null || v === '') return { error: '--symbol needs a symbol' };
        options.symbol = v;
        break;
      }
      case '--expect': {
        const v = value();
        const ids = v === null ? [] : v.split(',').map((s) => s.trim());
        if (ids.length === 0 || ids.some((s) => !/^MCD\d+$/.test(s))) {
          return {
            error:
              '--expect needs a comma-separated list like MCD0,MCD1,MCD2,MCD3',
          };
        }
        options.expect = [...new Set(ids)];
        break;
      }
      case '--since':
      case '--until': {
        const v = value();
        const t = v === null ? null : parseTime(v);
        if (t === null) {
          return { error: `${arg} needs unix seconds or an ISO date` };
        }
        if (arg === '--since') options.since = t;
        else options.until = t;
        break;
      }
      case '--last':
      case '--replay': {
        const v = value();
        if (v === null || !/^[1-9]\d*$/.test(v)) {
          return { error: `${arg} needs a positive whole number` };
        }
        if (arg === '--last') options.last = Number(v);
        else options.replay = Number(v);
        break;
      }
      default:
        return { error: `unknown argument ${arg}` };
    }
  }
  if (options.help) return options;
  if (options.db === (options.file !== null)) {
    return { error: 'give exactly one of --db and --file' };
  }
  if (
    options.since !== null &&
    options.until !== null &&
    options.since > options.until
  ) {
    return { error: '--since is after --until' };
  }
  if (options.jobsFile !== null && options.redis) {
    return { error: 'give at most one of --jobs and --redis' };
  }
  if (options.replay > 0 && options.replayFile !== null) {
    return { error: 'give at most one of --replay and --replay-file' };
  }
  if (!options.db && (options.redis || options.replay > 0)) {
    return { error: '--redis and --replay need --db' };
  }
  return options;
}

/** The two Prisma methods the kit uses, so a caller cannot hand it anything that writes. */
export interface SensorRowSource {
  mcdOutput: {
    findMany(args: {
      where: { symbol: string; cycle_slot?: { gte?: number; lte?: number } };
      orderBy: { cycle_slot: 'asc' | 'desc' };
      distinct?: ['cycle_slot'];
      take?: number;
      select: Record<string, true>;
    }): Promise<unknown[]>;
  };
  marketCycle: {
    findMany(args: {
      where: {
        symbol: string;
        state: 'READY';
        slot?: { gte?: number; lte?: number };
      };
      orderBy: { slot: 'asc' };
      select: typeof READY_COLUMNS;
    }): Promise<unknown[]>;
  };
}

export interface LoadedRows {
  rows: SensorRowSample[];
  ready: ReadySample[];
}

/** The one Prisma method the SYN part of the kit uses, so a caller cannot hand it anything that writes. */
export interface SynthesisRowSource {
  synthesisReading: {
    findMany(args: {
      where: { symbol: string; cycle_slot: { gte: number; lte: number } };
      orderBy: { cycle_slot: 'asc' };
      select: typeof SYNTHESIS_SAMPLE_COLUMNS;
    }): Promise<unknown[]>;
  };
}

/**
 * The `synthesis_readings` rows of the slots the sensor rows cover. READ ONLY: a SELECT with a `select`. A database that does
 * not have the table yet (the migration is Davin's to apply) gives `missing`, not a failure: any other failed read is thrown.
 */
export async function loadSynthesisRows(
  source: SynthesisRowSource,
  symbol: string,
  slots: { first: number; last: number }
): Promise<{ rows: SynthesisSample[]; missing: boolean }> {
  let found: unknown[];
  try {
    found = await source.synthesisReading.findMany({
      where: { symbol, cycle_slot: { gte: slots.first, lte: slots.last } },
      orderBy: { cycle_slot: 'asc' },
      select: SYNTHESIS_SAMPLE_COLUMNS,
    });
  } catch (error) {
    if (tableIsMissing(error)) return { rows: [], missing: true };
    throw error;
  }
  return {
    rows: found
      .map(normalizeSynthesisRow)
      .filter((r): r is SynthesisSample => r !== null),
    missing: false,
  };
}

/**
 * The cycles to measure, oldest first, and the READY cycles of the same range. With `since` or `until` the whole
 * range (capped to the newest `last` cycles when that is given too); with neither, the newest `last` cycles.
 * READ ONLY: SELECTs with a `select`.
 */
export async function loadSensorRows(
  source: SensorRowSource,
  options: Pick<CliOptions, 'symbol' | 'since' | 'until' | 'last'>
): Promise<LoadedRows> {
  const range: { gte?: number; lte?: number } = {};
  if (options.since !== null) range.gte = options.since;
  if (options.until !== null) range.lte = options.until;
  const bounded = options.since !== null || options.until !== null;
  const cap =
    options.last !== null ? options.last : bounded ? null : DEFAULT_LAST_CYCLES;

  if (cap !== null) {
    // the cycles are counted, not the rows: a cycle has as many rows as there are MCDs
    const newest = await source.mcdOutput.findMany({
      where: {
        symbol: options.symbol,
        ...(bounded ? { cycle_slot: { ...range } } : {}),
      },
      orderBy: { cycle_slot: 'desc' },
      distinct: ['cycle_slot'],
      take: cap,
      select: { cycle_slot: true },
    });
    const slots = newest
      .map((r) => (isRecord(r) ? r['cycle_slot'] : null))
      .filter(isNumber);
    if (slots.length === 0) return { rows: [], ready: [] };
    range.gte = Math.min(...slots);
  }

  const [found, ready] = await Promise.all([
    source.mcdOutput.findMany({
      where: { symbol: options.symbol, cycle_slot: { ...range } },
      orderBy: { cycle_slot: 'asc' },
      select: SENSOR_ROW_COLUMNS,
    }),
    source.marketCycle.findMany({
      where: { symbol: options.symbol, state: 'READY', slot: { ...range } },
      orderBy: { slot: 'asc' },
      select: READY_COLUMNS,
    }),
  ]);
  return {
    rows: found
      .map(normalizeRow)
      .filter((r): r is SensorRowSample => r !== null),
    ready: ready
      .map(normalizeReady)
      .filter((r): r is ReadySample => r !== null),
  };
}

/** The three Redis read commands the kit uses on Bull's keys; an `ioredis` client has them, and none of them writes. */
export interface RedisReader {
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  hget(key: string, field: string): Promise<string | null>;
  zcard(key: string): Promise<number>;
}

/**
 * Bull's own keys, read directly with three read commands, so that no Queue object is started (a Queue
 * promotes delayed jobs, which is a side effect a measurement must not have): `bull:<queue>:completed` is the
 * sorted set of finished job ids (newest last, scored by finish time), `bull:<queue>:<id>` is the job's hash with
 * the worker's return value in `returnvalue` as JSON, and `bull:<queue>:failed` counts the failures.
 */
export function redisJobReader(
  redis: RedisReader,
  queueName = 'cycle-ready',
  prefix = 'bull'
): JobQueueReader {
  const key = (part: string): string => `${prefix}:${queueName}:${part}`;
  return {
    async getCompleted(start = 0, end = 99) {
      const ids = await redis.zrevrange(key('completed'), start, end);
      const found: unknown[] = [];
      for (const id of ids) {
        const text = await redis.hget(key(id), 'returnvalue');
        if (text === null) continue;
        try {
          found.push({ returnvalue: JSON.parse(text) as unknown });
        } catch {
          // a return value that is not JSON is not an outcome of this worker
        }
      }
      return found;
    },
    getFailedCount: () => redis.zcard(key('failed')),
  };
}

/** What the kit asks of the `cycle-ready` queue: two reads. */
export interface JobQueueReader {
  getCompleted(start?: number, end?: number): Promise<unknown[]>;
  getFailedCount(): Promise<number>;
}

/** The outcomes Bull kept for the last 100 completed jobs, and how many jobs failed. READ ONLY. */
export async function loadJobOutcomes(
  queue: JobQueueReader
): Promise<{ jobs: JobSample[]; failed: number }> {
  const [completed, failed] = await Promise.all([
    queue.getCompleted(0, 99),
    queue.getFailedCount(),
  ]);
  return {
    jobs: completed.map(normalizeJob).filter((j): j is JobSample => j !== null),
    failed,
  };
}

/** What the command needs from the outside. The script wires Prisma, Bull, the file system and the replayer. */
export interface MeasureCommandDeps {
  readFile: (path: string) => string;
  /** Opens the database named by DATABASE_URL (only called for --db). */
  openDatabase?: () => Promise<{
    database: SensorRowSource & SynthesisRowSource & ReplayDatabase;
    close: () => Promise<void>;
  }>;
  /** Opens the cycle-ready queue named by REDIS_URL (only called for --redis). */
  openQueue?: () => Promise<{
    queue: JobQueueReader;
    close: () => Promise<void>;
  }>;
  /** Replays these slots from the database and returns the reports (only called for --replay). */
  replaySlots?: (
    database: ReplayDatabase,
    symbol: string,
    slots: number[]
  ) => Promise<CycleReplayReport[]>;
  /** The second look at every stored envelope. */
  scan?: EnvelopeScanner;
  /** The second look at every stored SYN reading. */
  scanSynthesis?: SynReadingScanner;
}

export interface MeasureCommandResult {
  report: MeasureSensorsReport;
  text: string;
  exitCode: 0 | 1;
}

/** Reads what the options ask for, measures, and says what it found. */
export async function runMeasureCommand(
  options: CliOptions,
  deps: MeasureCommandDeps
): Promise<MeasureCommandResult> {
  let input: SensorMeasureInput;
  let dropped = 0;
  let synthesisTablesMissing = false;
  if (options.file !== null) {
    const parsed = parseInputJson(deps.readFile(options.file));
    dropped = parsed.droppedRows;
    input = parsed.input;
    input.rows = input.rows.filter(
      (r) => !r.symbol || r.symbol === options.symbol
    );
  } else {
    if (deps.openDatabase === undefined) {
      throw new Error('no database to read (openDatabase is not wired)');
    }
    const { database, close } = await deps.openDatabase();
    try {
      const loaded = await loadSensorRows(database, options);
      input = {
        rows: loaded.rows,
        ready: loaded.ready,
        jobs: null,
        replay: null,
        failedJobs: null,
        synthesis: null,
      };
      if (loaded.rows.length > 0) {
        const slots = loaded.rows.map((r) => r.cycle_slot);
        const syn = await loadSynthesisRows(database, options.symbol, {
          first: Math.min(...slots),
          last: Math.max(...slots),
        });
        // a database without the table has no SYN rows to measure; the refusals still can be (log, jobs)
        input.synthesis = syn.missing ? null : syn.rows;
        synthesisTablesMissing = syn.missing;
      }
      if (options.replay > 0) {
        if (deps.replaySlots === undefined) {
          throw new Error('no replayer to run (replaySlots is not wired)');
        }
        const newest = [...new Set(loaded.rows.map((r) => r.cycle_slot))]
          .sort((a, b) => b - a)
          .slice(0, options.replay)
          .sort((a, b) => a - b);
        const reports = await deps.replaySlots(
          database,
          options.symbol,
          newest
        );
        input.replay = reports.map((r) => ({
          slot: r.slot,
          verdict: r.verdict,
          cause: r.cause,
          ...(r.synthesis.profiles.length === 0
            ? {}
            : {
                synthesis: {
                  replayed: r.synthesis.profiles.length,
                  verified: r.synthesis.profiles.filter(
                    (p) => p.verdict === 'VERIFIED'
                  ).length,
                },
              }),
        }));
      }
    } finally {
      await close();
    }
  }
  if (options.jobsFile !== null) {
    input.jobs = parseJobsJson(deps.readFile(options.jobsFile));
  } else if (options.redis) {
    if (deps.openQueue === undefined) {
      throw new Error('no queue to read (openQueue is not wired)');
    }
    const { queue, close } = await deps.openQueue();
    try {
      const loaded = await loadJobOutcomes(queue);
      input.jobs = loaded.jobs;
      input.failedJobs = loaded.failed;
    } finally {
      await close();
    }
  }
  if (options.replayFile !== null) {
    input.replay = parseReplayJson(deps.readFile(options.replayFile));
  }
  if (options.logFiles.length > 0) {
    input.log = [
      ...(input.log ?? []),
      ...options.logFiles.flatMap((file) =>
        parseSynthesisLog(deps.readFile(file))
      ),
    ];
  }

  const report = measureSensors(input, {
    expectedMcds: options.expect,
    scan: deps.scan ?? null,
    scanSynthesis: deps.scanSynthesis ?? null,
  });
  if (synthesisTablesMissing) {
    report.notices.push(
      'the database has no synthesis_readings table yet (the migration 20261004000000_add_synthesis_tables is not applied): no SYN row could be measured'
    );
  }
  report.skippedRows += dropped;
  return {
    report,
    exitCode: options.strict && report.findings.length > 0 ? 1 : 0,
    text: options.json ? JSON.stringify(report, null, 2) : formatReport(report),
  };
}
