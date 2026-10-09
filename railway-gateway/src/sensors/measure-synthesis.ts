import {
  Distribution,
  ValueCount,
  distribution,
} from '../cycle/measure-cycles';

/**
 * The SYN part of the measurement kit (build step 4 part 6; STACK-D-ARCHITECTURE.md chapter 3, standard 11.2).
 *
 * Reads rows of `synthesis_readings`, the log lines the gateway writes when it leaves a SYN reading out
 * (`SYN_READING_REFUSED` and its siblings, `synthesis.writer.ts`), and the SYN part of the `cycle-ready` job outcomes, and says
 * how synthesis really behaves on real cycles: how many SYN rows each cycle has, which rule of the table decides each trader
 * type (the rule-hit histogram), every cycle that matched no rule with the states of the sensors that were read, how many
 * zones each cycle gets and why it gets none, how large the CAUTIONARY share is, whether any stored reading carries
 * wording the sensors may not use, and how many readings were refused and why. It decides nothing: whether a rule is dead,
 * whether CAUTIONARY is too common and whether the rules table needs another version are Davin's calls, made on these numbers.
 *
 * Pure (rows in, numbers out), like `measure-sensors.ts`, which loads the rows, joins this to the sensor measurement and prints
 * it. This file imports nothing from `measure-sensors.ts` (that file imports this one), so the few constants it shares with
 * it (the four statuses) are written again here, and a spec holds the two copies equal.
 *
 * REFUSAL COUNTS come from two places that are not tables, on purpose (Davin, part 5 decision 5: a refused reading is logged, not
 * stored): the log lines, and the outcomes Bull keeps for the last 100 completed jobs. A cycle that has fewer SYN rows than
 * trader types and has neither a log line nor an outcome explaining it is reported separately, because that is the one case in
 * which a reading went missing without anyone being told.
 */

// ---------------------------------------------------------------------------
// Constants, pinned to the standard and to the Python worker by tests
// ---------------------------------------------------------------------------

/** The two trader types of synthesis, in the order the engine makes them (`mcd_worker/synthesis/rules.py` `PROFILES`). */
export const SYN_PROFILES = ['DAY_TRADER', 'SCALPER'] as const;

/** The rule id of a cycle in which no row of the rules table matched (`synthesis_readings.rule_id`). */
export const NO_MATCH = 'NO_MATCH';

export const SYN_STATUSES = [
  'VALID',
  'CAUTIONARY',
  'INVALID',
  'STALE',
] as const;
export type SynStatus = (typeof SYN_STATUSES)[number];

/** How many reasons and problems a text report lists for one profile, and how many characters of one problem. */
export const SYN_TOP = 5;
const PROBLEM_CHARS = 100;

/** `mcd_common/wording.py` `BANNED_WORDS`, `BANNED_INFLECTIONS`, `ADVICE_WORDS`, `SUMMARY_MAX_CHARS`; a spec reads the Python file and requires equality. */
export const BANNED_WORDS = [
  'CONVICTION',
  'PROBABILITY',
  'CONFIDENCE',
  'GRADE',
  'GUARANTEED',
  'SAFE',
  'SURE',
  'STRONG_BUY',
  'STRONG_SELL',
  'HIGH_CONVICTION',
] as const;

export const BANNED_INFLECTIONS: Readonly<Record<string, readonly string[]>> = {
  CONVICTION: ['CONVICTIONS'],
  PROBABILITY: ['PROBABILITIES'],
  CONFIDENCE: ['CONFIDENCES', 'CONFIDENT', 'CONFIDENTLY'],
  GRADE: ['GRADES', 'GRADED', 'GRADING'],
  GUARANTEED: ['GUARANTEE', 'GUARANTEES', 'GUARANTEEING'],
  SAFE: ['SAFELY', 'SAFER', 'SAFEST'],
  SURE: ['SURELY', 'SURER', 'SUREST'],
  STRONG_BUY: ['STRONG_BUYS'],
  STRONG_SELL: ['STRONG_SELLS'],
  HIGH_CONVICTION: ['HIGH_CONVICTIONS'],
};

export const ADVICE_WORDS = [
  'BUY',
  'SELL',
  'TAKE_PROFIT',
  'HOLD',
  'OPPORTUNITY',
] as const;

export const SUMMARY_MAX_CHARS = 80;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** The columns of a `synthesis_readings` row the kit reads. */
export interface SynthesisSample {
  symbol?: string | null;
  cycle_slot: number;
  profile: string;
  flag: string;
  rules_version: string;
  rule_id: string;
  branch_id: string | null;
  status: string;
  status_reasons: string[];
  data_status: string;
  archetype: string | null;
  bias: string;
  trend_relation: string | null;
  stand_aside: boolean;
  zone_count: number;
  zones_reason: string | null;
  guard_problems: string[];
  duration_ms: number | null;
  evaluated_at: number | null;
  /** The canonical reading text: its free texts are scanned, and the states of the sensors it read are taken from it. */
  reading_json: string | null;
}

/** The columns `loadSynthesisRows` asks the database for: exactly the ones above. */
export const SYNTHESIS_SAMPLE_COLUMNS = {
  symbol: true,
  cycle_slot: true,
  profile: true,
  flag: true,
  rules_version: true,
  rule_id: true,
  branch_id: true,
  status: true,
  status_reasons: true,
  data_status: true,
  archetype: true,
  bias: true,
  trend_relation: true,
  stand_aside: true,
  zone_count: true,
  zones_reason: true,
  guard_problems: true,
  duration_ms: true,
  evaluated_at: true,
  reading_json: true,
} as const;

/** What the kit needs of a sensor row to name the sensors' states beside a cycle that matched no rule. `SensorRowSample` fits. */
export interface SensorStateRow {
  cycle_slot: number;
  mcd_id: string;
  status: string;
  state_code: string | null;
}

/** The SYN part of what the worker returns for a WRITTEN job (`SynthesisWriteSummary` in `mcd-outputs.writer.ts`). */
export interface SynthesisJobSample {
  readingsInserted: number;
  readingsExisting: number;
  zonesInserted: number;
  zonesExisting: number;
  refused: Array<{ profile: string; source: string; problems: string[] }>;
  error: string | null;
}

/** One job, as far as the SYN counts need it. */
export interface SynthesisJob {
  slot: number | null;
  /** null: the outcome has no SYN part (the flag was off, or the job was not written). */
  synthesis: SynthesisJobSample | null;
  /** Whether the job wrote its cycle: only those can say anything about the SYN rows of the slot. */
  written: boolean;
}

export type SynthesisLogKind =
  | 'READING_REFUSED'
  | 'ENGINE_ERROR'
  | 'ZONES_DROPPED'
  | 'TABLES_MISSING'
  | 'TABLES_CHECK_FAILED';

/** One line of the gateway's log that says something about SYN. */
export interface SynthesisLogEvent {
  kind: SynthesisLogKind;
  slot: number | null;
  /** DAY_TRADER, SCALPER or ALL; null for the kinds that have none. */
  profile: string | null;
  /** READING_REFUSED only: who refused it. */
  source: 'ENGINE' | 'GATEWAY' | null;
  /** The rest of the line after the kind (and the profile and source): the problems, joined by `; `. */
  detail: string;
}

/** A schema check of one stored reading text: the problems it has (empty: none). The command wires `SynReadingValidator`. */
export type SynReadingScanner = (readingJson: string) => string[];

export interface SynthesisMeasureInput {
  rows: SynthesisSample[];
  /** The sensors' rows of the same range: the cycles that should have SYN rows, and the states beside a NO_MATCH. */
  sensorRows: SensorStateRow[];
  /** Job outcomes; null: not given. */
  jobs: SynthesisJob[] | null;
  /** Log events; null: no log was given. */
  log: SynthesisLogEvent[] | null;
}

export interface SynthesisMeasureOptions {
  /** The schema check of every stored reading text. Without it the second look reports "not run". */
  scan?: SynReadingScanner | null;
  /** The trader types every cycle should have a row for. Default: `SYN_PROFILES`. */
  expectedProfiles?: readonly string[] | null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface CodeTally {
  code: string;
  count: number;
}

export interface RuleHit {
  ruleId: string;
  count: number;
  /** Over the profile's rows, 0 to 1. */
  share: number;
}

export interface SynthesisProfileMeasure {
  rows: number;
  status: Record<SynStatus, number> & { other: number };
  /** Each status over `rows`, 0 to 1. The CAUTIONARY share is `share.CAUTIONARY`. */
  share: Record<SynStatus, number> & { other: number };
  bias: Record<string, number>;
  /** Readings with no archetype (no direction) are counted under `NONE`. */
  archetype: Record<string, number>;
  dataStatus: Record<string, number>;
  /** Every rule id that decided a reading, most frequent first (`NO_MATCH` included). */
  ruleHits: RuleHit[];
  /** The most common status reasons on readings that are not VALID. */
  topReasons: CodeTally[];
  noMatch: number;
  /** Readings with at least one zone. */
  withZones: number;
  /** Zones per reading: how many readings have 0, 1, 2 ... zones. */
  zoneHistogram: ValueCount[];
  /** Why the readings without zones have none. */
  zonesReasons: CodeTally[];
  /** Readings with a guard problem recorded: some zones were dropped by the engine. */
  guardRows: number;
}

export interface NoMatchCycle {
  slot: number;
  profile: string;
  dataStatus: string;
  /** One entry per sensor, `<status> <state code>` (`-` when it has none): `MCD1: CAUTIONARY MCD1_DOWN_UPPER_BREAKOUT`. */
  sensors: Record<string, string>;
  /** Where the states come from: the reading's own `inputs` (what the rules really saw), the sensors' rows, or nowhere. */
  sensorsFrom: 'READING' | 'SENSOR_ROWS' | 'NONE';
}

export interface SynthesisRowsPerCycle {
  expected: string[];
  /** Cycles with SYN rows. */
  cycles: number;
  /** How many cycles have 2 rows, how many 1, and so on: most cycles first. */
  byRowCount: ValueCount[];
  complete: number;
  short: number;
  shortCycles: Array<{ slot: number; have: string[]; missing: string[] }>;
  /** Cycles with sensor rows at or after the first SYN row that have no SYN row at all. */
  sensorCyclesWithoutSyn: number[];
  /** Rows of a trader type that is not expected. */
  unexpectedRows: number;
}

export interface SynthesisWording {
  /** Readings whose text could be read. */
  scanned: number;
  unreadable: number;
  /** Readings with a `%` in a free text (rule R9). */
  percent: number;
  /** Readings with a banned word (or a listed inflection) in a text or in the rule or branch id. */
  banned: number;
  /** Readings with an advice word in a text. */
  advice: number;
  /** Readings whose summary line is longer than 80 characters. */
  summaryTooLong: number;
  /** The second look at every stored reading (Ajv against `syn-output/1`); `ran: false` when no scanner was given. */
  schema: { ran: boolean; scanned: number; failures: number };
  /** The first few readings with something wrong, for a person to open. */
  examples: Array<{ slot: number; profile: string; problem: string }>;
}

export interface RefusalMeasure {
  /** Which sources were given. */
  given: { log: boolean; jobs: boolean };
  log: {
    /** Lines found, and the same events once each (a retried job logs its refusal again). */
    events: number;
    distinct: number;
    readingRefused: number;
    engineErrors: number;
    zonesDropped: number;
    tablesMissing: number;
    tablesCheckFailed: number;
    /** Refused readings by `<profile> <source>`. */
    byProfileSource: Record<string, number>;
  } | null;
  jobs: {
    /** WRITTEN jobs, and how many of them ran synthesis. */
    written: number;
    ranSynthesis: number;
    readingRefused: number;
    engineErrors: number;
    tablesMissing: number;
    byProfileSource: Record<string, number>;
  } | null;
  /** What the refusals said, the most common problem first. */
  topProblems: CodeTally[];
  /** The distinct cycles (slots) in which a reading was refused, from the log and the job outcomes together. */
  refusedCycles: number[];
  /** The distinct cycles in which synthesis stopped or the tables were missing, so no SYN row was written at all. */
  stoppedCycles: number[];
  /** Log lines of those two kinds that name no slot, so they cannot be placed in a cycle. */
  unplaced: number;
  /**
   * Cycles with fewer SYN rows than trader types and a log line or an outcome that says why / says nothing. `null`: neither a log nor
   * jobs were given, so nothing can be said. With jobs only, only the slots the jobs cover are looked at.
   */
  gaps: {
    checked: number;
    explained: number;
    unexplained: number[];
  } | null;
}

export interface SynthesisMeasure {
  rows: number;
  cycles: number;
  firstSlot: number | null;
  lastSlot: number | null;
  flags: { shadow: number; live: number; other: number };
  rulesVersions: string[];
  rowsPerCycle: SynthesisRowsPerCycle;
  profiles: Record<string, SynthesisProfileMeasure>;
  noMatch: NoMatchCycle[];
  /** Zones of both trader types together, per cycle that has SYN rows. */
  zonesPerCycle: Distribution | null;
  /** Cycles with SYN rows and no zone at all. */
  cyclesWithoutZones: number;
  /** The wall time of the synthesis step of each cycle, ms (one figure per cycle: both rows carry the same). */
  durationMs: Distribution | null;
  wording: SynthesisWording;
  refusals: RefusalMeasure;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asNumber = (v: unknown): number | null => (isNumber(v) ? v : null);
const asText = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;
const asTexts = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function tally(counts: Map<string, number>, limit?: number): CodeTally[] {
  const all = [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || byText(a.code, b.code));
  return limit === undefined ? all : all.slice(0, limit);
}

const record = (counts: Map<string, number>): Record<string, number> =>
  Object.fromEntries([...counts.entries()].sort(([a], [b]) => byText(a, b)));

function emptyStatusCounts(): Record<SynStatus, number> & { other: number } {
  return { VALID: 0, CAUTIONARY: 0, INVALID: 0, STALE: 0, other: 0 };
}

// ---------------------------------------------------------------------------
// Normalizing what comes in
// ---------------------------------------------------------------------------

/** A raw JSON object as a row of `synthesis_readings`, or null when it has no numeric slot or no trader type. */
export function normalizeSynthesisRow(raw: unknown): SynthesisSample | null {
  if (!isRecord(raw)) return null;
  const slot = raw['cycle_slot'];
  const profile = raw['profile'];
  if (!isNumber(slot) || typeof profile !== 'string' || profile === '') {
    return null;
  }
  return {
    symbol: asText(raw['symbol']),
    cycle_slot: slot,
    profile,
    flag: asText(raw['flag']) ?? 'UNKNOWN',
    rules_version: asText(raw['rules_version']) ?? 'UNKNOWN',
    rule_id: asText(raw['rule_id']) ?? 'UNKNOWN',
    branch_id: asText(raw['branch_id']),
    status: asText(raw['status']) ?? 'UNKNOWN',
    status_reasons: asTexts(raw['status_reasons']),
    data_status: asText(raw['data_status']) ?? 'UNKNOWN',
    archetype: asText(raw['archetype']),
    bias: asText(raw['bias']) ?? 'UNKNOWN',
    trend_relation: asText(raw['trend_relation']),
    stand_aside: raw['stand_aside'] === true,
    zone_count: asNumber(raw['zone_count']) ?? 0,
    zones_reason: asText(raw['zones_reason']),
    guard_problems: asTexts(raw['guard_problems']),
    duration_ms: asNumber(raw['duration_ms']),
    evaluated_at: asNumber(raw['evaluated_at']),
    reading_json: asText(raw['reading_json']),
  };
}

/** The SYN part of a job outcome (`synthesis` of a WRITTEN outcome), or null when it has none or it is not one. */
export function normalizeSynthesisJob(raw: unknown): SynthesisJobSample | null {
  if (!isRecord(raw)) return null;
  const refused = Array.isArray(raw['refused']) ? raw['refused'] : [];
  return {
    readingsInserted: asNumber(raw['readingsInserted']) ?? 0,
    readingsExisting: asNumber(raw['readingsExisting']) ?? 0,
    zonesInserted: asNumber(raw['zonesInserted']) ?? 0,
    zonesExisting: asNumber(raw['zonesExisting']) ?? 0,
    refused: refused.filter(isRecord).map((entry) => ({
      profile: asText(entry['profile']) ?? 'UNKNOWN',
      source: asText(entry['source']) ?? 'UNKNOWN',
      problems: asTexts(entry['problems']),
    })),
    error: asText(raw['error']),
  };
}

// ---------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------

/** A log line as text: a JSON line (Railway's) gives its `message`, anything else is itself. */
function lineText(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed)) {
      for (const key of ['message', 'msg']) {
        const value = parsed[key];
        if (typeof value === 'string') return value;
      }
    }
  } catch {
    // not JSON after all: the text is the line
  }
  return trimmed;
}

const LOG_PATTERNS: Array<{
  kind: SynthesisLogKind;
  pattern: RegExp;
}> = [
  {
    kind: 'READING_REFUSED',
    pattern:
      /(?:Slot (\d+): )?SYN_READING_REFUSED (\S+) \((ENGINE|GATEWAY)\): (.*)$/,
  },
  { kind: 'ENGINE_ERROR', pattern: /(?:Slot (\d+): )?SYN_ENGINE_ERROR (.*)$/ },
  {
    kind: 'ZONES_DROPPED',
    pattern: /(?:Slot (\d+): )?SYN_ZONES_DROPPED (\S+) (.*)$/,
  },
  {
    kind: 'TABLES_MISSING',
    pattern: /(?:Slot (\d+): )?SYN_TABLES_MISSING (.*)$/,
  },
  {
    kind: 'TABLES_CHECK_FAILED',
    pattern: /(?:Slot (\d+): )?SYN_TABLES_CHECK_FAILED (.*)$/,
  },
];

/**
 * The SYN events in a log (the gateway's own lines, one per line, plain or Railway's JSON): `SYN_READING_REFUSED <profile> (ENGINE|GATEWAY): <problems>`,
 * `SYN_ENGINE_ERROR`, `SYN_ZONES_DROPPED <profile>`, `SYN_TABLES_MISSING`, `SYN_TABLES_CHECK_FAILED`. Anything else is ignored. The prefixes are
 * the ones `synthesis.writer.ts` and `mcd-outputs.writer.ts` write; a spec holds this parser to those functions' own output.
 */
export function parseSynthesisLog(text: string): SynthesisLogEvent[] {
  const events: SynthesisLogEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('SYN_')) continue;
    const message = lineText(line);
    for (const { kind, pattern } of LOG_PATTERNS) {
      const m = pattern.exec(message);
      if (m === null) continue;
      const slot = m[1] === undefined ? null : Number(m[1]);
      if (kind === 'READING_REFUSED') {
        events.push({
          kind,
          slot,
          profile: m[2],
          source: m[3] as 'ENGINE' | 'GATEWAY',
          detail: m[4].trim(),
        });
      } else if (kind === 'ZONES_DROPPED') {
        events.push({
          kind,
          slot,
          profile: m[2],
          source: null,
          detail: m[3].trim(),
        });
      } else {
        events.push({
          kind,
          slot,
          profile: null,
          source: null,
          detail: m[2].trim(),
        });
      }
      break;
    }
  }
  return events;
}

/** One problem of a refusal, as a short key for counting: the trader type prefix and the length are taken off. */
function problemKey(problem: string): string {
  return problem
    .replace(/^(DAY_TRADER|SCALPER|ALL)(?: zone \d+)?:\s*/, '')
    .slice(0, PROBLEM_CHARS);
}

// ---------------------------------------------------------------------------
// The wording scan
// ---------------------------------------------------------------------------

function wordRegex(forms: readonly string[]): RegExp {
  const parts = forms.map((form) => form.replace(/_/g, '[\\s_-]')).join('|');
  return new RegExp(`\\b(?:${parts})\\b`, 'i');
}

const BANNED_TEXT = BANNED_WORDS.map((word) => ({
  word,
  re: wordRegex([word, ...(BANNED_INFLECTIONS[word] ?? [])]),
}));
const ADVICE_TEXT = ADVICE_WORDS.map((word) => ({
  word,
  re: wordRegex([word]),
}));

/** Banned words in a text, and in a code (the whole `_`-separated parts of an upper-case id), reported under the banned word. */
export function bannedIn(text: string): string[] {
  return BANNED_TEXT.filter(({ re }) => re.test(text)).map(({ word }) => word);
}

export function bannedInCode(code: string): string[] {
  const padded = `_${code.toUpperCase()}_`;
  return BANNED_WORDS.filter((word) =>
    [word, ...(BANNED_INFLECTIONS[word] ?? [])].some((form) =>
      padded.includes(`_${form}_`)
    )
  );
}

export function adviceIn(text: string): string[] {
  return ADVICE_TEXT.filter(({ re }) => re.test(text)).map(({ word }) => word);
}

/** What a reading says to a trader: the summary line and every reason, as strings. */
function readingTexts(reading: Record<string, unknown>): {
  summary: string | null;
  texts: string[];
} {
  const summary = asText(reading['summary_line']);
  return {
    summary,
    texts: [
      ...(summary === null ? [] : [summary]),
      ...asTexts(reading['reasons']),
    ],
  };
}

function parseReading(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function measureWording(
  rows: SynthesisSample[],
  parsed: Map<SynthesisSample, Record<string, unknown> | null>,
  scan: SynReadingScanner | null
): SynthesisWording {
  const out: SynthesisWording = {
    scanned: 0,
    unreadable: 0,
    percent: 0,
    banned: 0,
    advice: 0,
    summaryTooLong: 0,
    schema: { ran: scan !== null, scanned: 0, failures: 0 },
    examples: [],
  };
  const example = (row: SynthesisSample, problem: string): void => {
    if (out.examples.length < 10) {
      out.examples.push({
        slot: row.cycle_slot,
        profile: row.profile,
        problem,
      });
    }
  };
  for (const row of rows) {
    const reading = parsed.get(row) ?? null;
    if (reading === null) {
      out.unreadable += 1;
      continue;
    }
    out.scanned += 1;
    const { summary, texts } = readingTexts(reading);
    if (texts.some((t) => t.includes('%'))) {
      out.percent += 1;
      example(row, "a '%' in a free text");
    }
    const ids = [asText(reading['rule_id']), asText(reading['branch_id'])];
    const banned = new Set([
      ...texts.flatMap(bannedIn),
      ...ids.flatMap((id) => (id === null ? [] : bannedInCode(id))),
    ]);
    if (banned.size > 0) {
      out.banned += 1;
      example(row, `banned word ${[...banned].sort().join(', ')}`);
    }
    const advice = new Set(texts.flatMap(adviceIn));
    if (advice.size > 0) {
      out.advice += 1;
      example(row, `advice word ${[...advice].sort().join(', ')}`);
    }
    if (summary !== null && summary.length > SUMMARY_MAX_CHARS) {
      out.summaryTooLong += 1;
      example(row, `a summary of ${summary.length} characters`);
    }
    if (scan !== null && row.reading_json !== null) {
      out.schema.scanned += 1;
      const problems = scan(row.reading_json);
      if (problems.length > 0) {
        out.schema.failures += 1;
        example(row, `fails syn-output/1: ${problems[0]}`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The sensors' states beside a cycle that matched no rule
// ---------------------------------------------------------------------------

function sensorsOfReading(
  reading: Record<string, unknown> | null
): Record<string, string> | null {
  if (reading === null) return null;
  const inputs = reading['inputs'];
  if (!isRecord(inputs)) return null;
  const out: Record<string, string> = {};
  for (const id of Object.keys(inputs).sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true })
  )) {
    const entry = inputs[id];
    if (!isRecord(entry)) continue;
    out[id] =
      `${asText(entry['status']) ?? '?'} ${asText(entry['state_code']) ?? '-'}`;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function noMatchCycle(
  row: SynthesisSample,
  reading: Record<string, unknown> | null,
  sensorsBySlot: Map<number, SensorStateRow[]>
): NoMatchCycle {
  const own = sensorsOfReading(reading);
  if (own !== null) {
    return {
      slot: row.cycle_slot,
      profile: row.profile,
      dataStatus: row.data_status,
      sensors: own,
      sensorsFrom: 'READING',
    };
  }
  const rows = sensorsBySlot.get(row.cycle_slot) ?? [];
  const sensors: Record<string, string> = {};
  for (const r of [...rows].sort((a, b) =>
    a.mcd_id.localeCompare(b.mcd_id, 'en', { numeric: true })
  )) {
    sensors[r.mcd_id] = `${r.status} ${r.state_code ?? '-'}`;
  }
  return {
    slot: row.cycle_slot,
    profile: row.profile,
    dataStatus: row.data_status,
    sensors,
    sensorsFrom: rows.length > 0 ? 'SENSOR_ROWS' : 'NONE',
  };
}

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

function measureRefusals(
  jobs: SynthesisJob[] | null,
  log: SynthesisLogEvent[] | null,
  gapSlots: number[]
): RefusalMeasure {
  const problems = new Map<string, number>();
  const explained = new Set<number>();
  const refusedCycles = new Set<number>();
  const stoppedCycles = new Set<number>();
  let unplaced = 0;

  let logPart: RefusalMeasure['log'] = null;
  if (log !== null) {
    const seen = new Set<string>();
    const byProfileSource = new Map<string, number>();
    logPart = {
      events: log.length,
      distinct: 0,
      readingRefused: 0,
      engineErrors: 0,
      zonesDropped: 0,
      tablesMissing: 0,
      tablesCheckFailed: 0,
      byProfileSource: {},
    };
    for (const event of log) {
      const key = `${event.kind}|${event.slot ?? ''}|${event.profile ?? ''}|${event.source ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      logPart.distinct += 1;
      switch (event.kind) {
        case 'READING_REFUSED':
          logPart.readingRefused += 1;
          bump(byProfileSource, `${event.profile} ${event.source}`);
          for (const p of event.detail.split('; '))
            bump(problems, problemKey(p));
          break;
        case 'ENGINE_ERROR':
          logPart.engineErrors += 1;
          break;
        case 'ZONES_DROPPED':
          logPart.zonesDropped += 1;
          break;
        case 'TABLES_MISSING':
          logPart.tablesMissing += 1;
          break;
        case 'TABLES_CHECK_FAILED':
          logPart.tablesCheckFailed += 1;
          break;
      }
      // a failed table check is logged without a slot, and always beside a TABLES_MISSING line that has one: it is counted, not placed
      if (
        event.kind !== 'ZONES_DROPPED' &&
        event.kind !== 'TABLES_CHECK_FAILED'
      ) {
        if (event.slot === null) unplaced += 1;
        else {
          explained.add(event.slot);
          (event.kind === 'READING_REFUSED'
            ? refusedCycles
            : stoppedCycles
          ).add(event.slot);
        }
      }
    }
    logPart.byProfileSource = record(byProfileSource);
  }

  let jobsPart: RefusalMeasure['jobs'] = null;
  let jobWindow: [number, number] | null = null;
  if (jobs !== null) {
    const byProfileSource = new Map<string, number>();
    jobsPart = {
      written: 0,
      ranSynthesis: 0,
      readingRefused: 0,
      engineErrors: 0,
      tablesMissing: 0,
      byProfileSource: {},
    };
    for (const job of jobs) {
      if (!job.written) continue;
      jobsPart.written += 1;
      if (job.slot !== null) {
        jobWindow =
          jobWindow === null
            ? [job.slot, job.slot]
            : [
                Math.min(jobWindow[0], job.slot),
                Math.max(jobWindow[1], job.slot),
              ];
      }
      const syn = job.synthesis;
      if (syn === null) continue;
      jobsPart.ranSynthesis += 1;
      for (const refusal of syn.refused) {
        jobsPart.readingRefused += 1;
        bump(byProfileSource, `${refusal.profile} ${refusal.source}`);
        for (const p of refusal.problems) bump(problems, problemKey(p));
      }
      if (syn.error !== null) {
        if (syn.error === 'SYN_TABLES_MISSING') jobsPart.tablesMissing += 1;
        else jobsPart.engineErrors += 1;
      }
      if (job.slot !== null) {
        if (syn.refused.length > 0) refusedCycles.add(job.slot);
        if (syn.error !== null) stoppedCycles.add(job.slot);
        if (syn.refused.length > 0 || syn.error !== null) {
          explained.add(job.slot);
        }
      }
    }
    jobsPart.byProfileSource = record(byProfileSource);
  }

  let gaps: RefusalMeasure['gaps'] = null;
  if (log !== null || jobs !== null) {
    // a log is taken to cover the range; jobs cover only the slots between the oldest and the newest they name
    const covered = (slot: number): boolean =>
      log !== null ||
      (jobWindow !== null && slot >= jobWindow[0] && slot <= jobWindow[1]);
    const checked = gapSlots.filter(covered);
    const unexplained = checked
      .filter((slot) => !explained.has(slot))
      .sort((a, b) => a - b);
    gaps = {
      checked: checked.length,
      explained: checked.length - unexplained.length,
      unexplained,
    };
  }

  return {
    given: { log: log !== null, jobs: jobs !== null },
    log: logPart,
    jobs: jobsPart,
    topProblems: tally(problems, SYN_TOP),
    refusedCycles: [...refusedCycles].sort((a, b) => a - b),
    stoppedCycles: [...stoppedCycles].sort((a, b) => a - b),
    unplaced,
    gaps,
  };
}

// ---------------------------------------------------------------------------
// The measurement
// ---------------------------------------------------------------------------

export function measureSynthesis(
  input: SynthesisMeasureInput,
  options: SynthesisMeasureOptions = {}
): SynthesisMeasure {
  const expected = [...new Set(options.expectedProfiles ?? SYN_PROFILES)].sort(
    byText
  );
  const rows = input.rows
    .filter((r) => isNumber(r.cycle_slot) && typeof r.profile === 'string')
    .sort(
      (a, b) => a.cycle_slot - b.cycle_slot || byText(a.profile, b.profile)
    );
  const parsed = new Map<SynthesisSample, Record<string, unknown> | null>();
  for (const row of rows) parsed.set(row, parseReading(row.reading_json));

  const cycles = new Map<number, SynthesisSample[]>();
  for (const row of rows) {
    const list = cycles.get(row.cycle_slot);
    if (list === undefined) cycles.set(row.cycle_slot, [row]);
    else list.push(row);
  }
  const slots = [...cycles.keys()].sort((a, b) => a - b);

  const flags = { shadow: 0, live: 0, other: 0 };
  for (const row of rows) {
    if (row.flag === 'shadow') flags.shadow += 1;
    else if (row.flag === 'live') flags.live += 1;
    else flags.other += 1;
  }

  const sensorsBySlot = new Map<number, SensorStateRow[]>();
  for (const r of input.sensorRows) {
    const list = sensorsBySlot.get(r.cycle_slot);
    if (list === undefined) sensorsBySlot.set(r.cycle_slot, [r]);
    else list.push(r);
  }

  const profileIds = [...new Set(rows.map((r) => r.profile))].sort(byText);
  const profiles: Record<string, SynthesisProfileMeasure> = {};
  const noMatch: NoMatchCycle[] = [];
  for (const id of profileIds) {
    const mine = rows.filter((r) => r.profile === id);
    const status = emptyStatusCounts();
    const bias = new Map<string, number>();
    const archetype = new Map<string, number>();
    const dataStatus = new Map<string, number>();
    const rules = new Map<string, number>();
    const reasons = new Map<string, number>();
    const zonesWhy = new Map<string, number>();
    const histogram = new Map<number, number>();
    let withZones = 0;
    let guardRows = 0;
    let noMatchCount = 0;
    for (const row of mine) {
      if ((SYN_STATUSES as readonly string[]).includes(row.status)) {
        status[row.status as SynStatus] += 1;
      } else status.other += 1;
      bump(bias, row.bias);
      bump(archetype, row.archetype ?? 'NONE');
      bump(dataStatus, row.data_status);
      bump(rules, row.rule_id);
      if (row.status !== 'VALID') {
        for (const code of row.status_reasons) bump(reasons, code);
      }
      histogram.set(row.zone_count, (histogram.get(row.zone_count) ?? 0) + 1);
      if (row.zone_count > 0) withZones += 1;
      else bump(zonesWhy, row.zones_reason ?? 'NONE_GIVEN');
      if (row.guard_problems.length > 0) guardRows += 1;
      if (row.rule_id === NO_MATCH) {
        noMatchCount += 1;
        noMatch.push(noMatchCycle(row, parsed.get(row) ?? null, sensorsBySlot));
      }
    }
    const share = (n: number): number => n / mine.length;
    profiles[id] = {
      rows: mine.length,
      status,
      share: {
        VALID: share(status.VALID),
        CAUTIONARY: share(status.CAUTIONARY),
        INVALID: share(status.INVALID),
        STALE: share(status.STALE),
        other: share(status.other),
      },
      bias: record(bias),
      archetype: record(archetype),
      dataStatus: record(dataStatus),
      ruleHits: tally(rules).map((t) => ({
        ruleId: t.code,
        count: t.count,
        share: share(t.count),
      })),
      topReasons: tally(reasons, SYN_TOP),
      noMatch: noMatchCount,
      withZones,
      zoneHistogram: [...histogram.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value - b.value),
      zonesReasons: tally(zonesWhy),
      guardRows,
    };
  }
  noMatch.sort((a, b) => a.slot - b.slot || byText(a.profile, b.profile));

  // rows per cycle, and the sensor cycles that have no SYN row at all
  const counts = new Map<number, number>();
  const shortCycles: SynthesisRowsPerCycle['shortCycles'] = [];
  let complete = 0;
  let unexpectedRows = 0;
  for (const slot of slots) {
    const list = cycles.get(slot) as SynthesisSample[];
    counts.set(list.length, (counts.get(list.length) ?? 0) + 1);
    const have = [...new Set(list.map((r) => r.profile))].sort(byText);
    unexpectedRows += list.filter((r) => !expected.includes(r.profile)).length;
    const missing = expected.filter((p) => !have.includes(p));
    if (missing.length === 0) complete += 1;
    else shortCycles.push({ slot, have, missing });
  }
  const firstSyn = slots.length > 0 ? slots[0] : null;
  const sensorSlots = [...sensorsBySlot.keys()].sort((a, b) => a - b);
  const withoutSyn =
    firstSyn === null
      ? []
      : sensorSlots.filter((s) => s >= firstSyn && !cycles.has(s));

  // the cycles that should have more SYN rows than they have
  const gapSlots = [...shortCycles.map((c) => c.slot), ...withoutSyn];

  // zones per cycle, and the time of the step
  const zonesPerCycle: number[] = [];
  const durations: number[] = [];
  for (const slot of slots) {
    const list = cycles.get(slot) as SynthesisSample[];
    zonesPerCycle.push(list.reduce((total, r) => total + r.zone_count, 0));
    const timed = list.map((r) => r.duration_ms).find(isNumber);
    if (timed !== undefined) durations.push(timed);
  }

  return {
    rows: rows.length,
    cycles: slots.length,
    firstSlot: slots.length > 0 ? slots[0] : null,
    lastSlot: slots.length > 0 ? slots[slots.length - 1] : null,
    flags,
    rulesVersions: [...new Set(rows.map((r) => r.rules_version))].sort(byText),
    rowsPerCycle: {
      expected,
      cycles: slots.length,
      byRowCount: [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value - b.value),
      complete,
      short: shortCycles.length,
      shortCycles,
      sensorCyclesWithoutSyn: withoutSyn,
      unexpectedRows,
    },
    profiles,
    noMatch,
    zonesPerCycle: distribution(zonesPerCycle),
    cyclesWithoutZones: zonesPerCycle.filter((n) => n === 0).length,
    durationMs: distribution(durations),
    wording: measureWording(rows, parsed, options.scan ?? null),
    refusals: measureRefusals(input.jobs, input.log, gapSlots),
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/** What a person should look at in the SYN measurement, one line each. */
export function synthesisFindings(m: SynthesisMeasure): string[] {
  const out: string[] = [];
  const noMatch = m.noMatch.length;
  if (noMatch > 0) {
    out.push(
      `${noMatch} SYN reading(s) matched no rule (NO_MATCH): the cycles and the sensors' states are listed`
    );
  }
  for (const [id, p] of Object.entries(m.profiles)) {
    if (p.status.other > 0) {
      out.push(
        `${id}: ${p.status.other} SYN row(s) have a status outside VALID, CAUTIONARY, INVALID, STALE`
      );
    }
    if (p.guardRows > 0) {
      out.push(
        `${id}: ${p.guardRows} SYN row(s) have zones the engine dropped (guard problems recorded)`
      );
    }
  }
  if (m.flags.other > 0) {
    out.push(
      `${m.flags.other} SYN row(s) have a flag that is neither shadow nor live`
    );
  }
  if (m.rowsPerCycle.unexpectedRows > 0) {
    out.push(
      `${m.rowsPerCycle.unexpectedRows} SYN row(s) belong to a trader type that is not expected`
    );
  }
  const w = m.wording;
  if (w.percent > 0)
    out.push(`${w.percent} SYN reading(s) have a '%' in a free text`);
  if (w.banned > 0) out.push(`${w.banned} SYN reading(s) carry a banned word`);
  if (w.advice > 0) out.push(`${w.advice} SYN reading(s) carry an advice word`);
  if (w.summaryTooLong > 0) {
    out.push(
      `${w.summaryTooLong} SYN reading(s) have a summary longer than ${SUMMARY_MAX_CHARS} characters`
    );
  }
  if (w.unreadable > 0) {
    out.push(`${w.unreadable} SYN row(s) have no readable reading text`);
  }
  if (w.schema.failures > 0) {
    out.push(
      `${w.schema.failures} stored SYN reading(s) fail syn-output/1 on a second look`
    );
  }
  const r = m.refusals;
  const refused = (r.log?.readingRefused ?? 0) + (r.jobs?.readingRefused ?? 0);
  const unplaced =
    r.unplaced > 0 ? `; ${r.unplaced} log line(s) name no slot` : '';
  if (refused > 0) {
    out.push(
      `SYN readings were refused in ${r.refusedCycles.length} cycle(s): ${r.log?.readingRefused ?? 0} in the log, ${r.jobs?.readingRefused ?? 0} in the job outcomes (see the refusals below)${unplaced}`
    );
  }
  if (r.stoppedCycles.length > 0) {
    out.push(
      `${r.stoppedCycles.length} cycle(s) wrote no SYN rows because synthesis stopped or the tables were missing${unplaced}`
    );
  } else if (
    refused === 0 &&
    (r.log?.engineErrors ?? 0) + (r.log?.tablesMissing ?? 0) > 0
  ) {
    out.push(
      `synthesis stopped or the tables were missing in some cycle(s) the log does not place${unplaced}`
    );
  }
  if ((r.log?.tablesCheckFailed ?? 0) > 0) {
    out.push(
      `${r.log?.tablesCheckFailed ?? 0} check(s) of whether the SYN tables exist failed (the database could not be asked), so the SYN rows of those cycles were left out`
    );
  }
  const missing =
    m.rowsPerCycle.short + m.rowsPerCycle.sensorCyclesWithoutSyn.length;
  if (r.gaps === null && missing > 0) {
    out.push(
      `${missing} cycle(s) have fewer SYN rows than trader types (give --log and --jobs or --redis to see whether a refusal or an engine error explains them)`
    );
  }
  if (r.gaps !== null && r.gaps.unexplained.length > 0) {
    out.push(
      `${r.gaps.unexplained.length} cycle(s) have fewer SYN rows than trader types and no log line or job outcome says why`
    );
  }
  return out;
}
