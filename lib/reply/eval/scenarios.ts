/**
 * The golden scenarios of the reply path (build step 7 part 10; architecture 5.10, 7.6 and 7.7,
 * ADR-078 and ADR-079; plan finding S7-F17).
 *
 * WHAT A SCENARIO IS. One situation the reply path must handle, with what must be true afterwards
 * written down BEFORE anything is run, by a person who reads the architecture and not the output.
 * The set is data (`config/reply/golden/scenarios.v1.json`), approved by Davin through a generated
 * `review.md` and an `approval.json` that only a person writes; this file is its types, its
 * validator and the arithmetic of its cells.
 *
 * FIVE FAMILIES.
 *   CYCLE     the 16 stored golden cycles, each for BOTH trader types, FRESH, a question about the
 *             direction. The model under test writes these in all 19 locales: they are the quality
 *             measure of a model and the only scenarios a live run pays for.
 *   DATA      the data statuses that are not FRESH and not a degraded row of their own: DELAYED.
 *             (STALE, MARKET_CLOSED and RETUNING are rows 1, 2 and 5 of architecture 7.6.)
 *   DEGRADED  the ten rows of architecture 7.6, each one scenario (row 6 has two: one model down,
 *             both down). "Each row has a golden scenario that passes" (ADR-078).
 *   PLANTED   a failure put into the model's reply on purpose, to prove the checks catch it and the
 *             reply path recovers: a wrong price, a listed phrase (in all 19 locales), malformed
 *             JSON, a zone id that does not exist.
 *   DEMO      the Free tier's recorded example (decision D19): the 18 Sep cycle, an M5 instant
 *             prompt, in all 19 locales. Its replies are what `config/reply/demo/` is made from.
 *
 * SOURCE. MODEL: the words come from the model under test (a live run) or from the fixture model's
 * recorded replies (the STAND-IN run). FIXTURE: the failure is staged (a model that is down, a
 * reply with a planted error), so a live run replays the same scripts and spends nothing.
 *
 * Pure. The one file read is the scenario table.
 *
 * @module lib/reply/eval/scenarios
 */

import scenarioFile from '@/config/reply/golden/scenarios.v1.json';

import { EVENTS_STATUSES, canonicalJson, sha256Hex } from '../contracts/intake';
import type {
  DataStatus,
  EventsStatus,
  Locale,
  PacketIntent,
  TraderType,
} from '../contracts/intake';
import { FIXED_REASONS, RESULT_NOTES } from '../contracts/result';
import type { FixedReason, ResultNote } from '../contracts/result';

import { EVAL_LOCALES, isEvalLocale } from './languages';

export const SCENARIO_SCHEMA = 'golden-reply/1';

export const FAMILIES = [
  'CYCLE',
  'DATA',
  'DEGRADED',
  'PLANTED',
  'DEMO',
] as const;
export type Family = (typeof FAMILIES)[number];

export const SOURCES = ['MODEL', 'FIXTURE'] as const;
export type Source = (typeof SOURCES)[number];

/** What is staged around the request. NONE: nothing, the cycle and the overlay are the scenario. */
export const CONDITIONS = [
  'NONE',
  'CHART_OTHER_CYCLE',
  'CHART_MISSING',
  'MODEL_DOWN',
  'BOTH_MODELS_DOWN',
  'QUOTA_EXHAUSTED',
  'KNOWLEDGE_DOWN',
  'CALENDAR_LATE',
  'SPECS_STALE',
  'PLANT_WRONG_PRICE',
  'PLANT_BANNED_PHRASE',
  'PLANT_BAD_JSON',
  'PLANT_BAD_ZONE',
] as const;
export type Condition = (typeof CONDITIONS)[number];

/** The intents a scenario may ask. Typed questions go through the Understand step; instant ones do not. */
export const SCENARIO_INTENTS = [
  'DIRECTION',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'INSTANT_M5_INSPECT',
  'INSTANT_M15_INSPECT',
] as const satisfies readonly PacketIntent[];

export const OUTCOMES = [
  'REPORT1',
  'ANSWER',
  'FIXED_ANSWER',
  'ACTION',
  'REFUSED',
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const TRADER_LIST: readonly TraderType[] = ['DAY_TRADER', 'SCALPER'];

export const OVERLAY_STATUSES: readonly DataStatus[] = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
];

/** What must be true after the request, written before it is run. */
export interface ScenarioExpect {
  outcome: Outcome;
  /** for FIXED_ANSWER: why */
  fixed_reason: FixedReason | null;
  /** for REFUSED: the refusal code of the intake path */
  refusal: string | null;
  /** the calls that reached an ANSWER model (the primary and the fallback), inclusive; the Understand call is not one */
  model_calls: { min: number; max: number };
  /** an extra call spent on the number and wording checks (the one shared regeneration of D11) */
  regenerations: 0 | 1;
  /** an extra call spent on malformed JSON or a schema failure */
  schema_retries: 0 | 1;
  /** numbers shown as "not verified" in the delivered reply; null: not asserted */
  numbers_flagged: number | null;
  /** the reply states the synthesis reading's direction (`SYN`) or none (`NONE`) */
  direction: 'SYN' | 'NONE';
  /** every chosen zone is one of the stored zones of the reading */
  zones_valid: boolean;
  /** a stand-aside reading stays a stand-aside reply: no side taken, no zone offered */
  stand_aside_kept: boolean;
  /** the notes the reply carries (codes), exactly */
  notes: ResultNote[];
  /** the calendar block's status in a Report 1 (the age is shown when it is LATE); null: not asserted */
  news_status: EventsStatus | null;
  /** the fallback model wrote the delivered reply */
  fallback_used: boolean;
}

export interface Scenario {
  id: string;
  family: Family;
  title: string;
  /** the rule of the architecture this scenario holds, in a sentence (the review sheet quotes it) */
  rule: string;
  /** the row of architecture 7.6 this is the golden scenario of; null for the others */
  row: number | null;
  /** the golden cycle, `01` to `16` */
  cycle: string;
  traders: TraderType[];
  /** `ALL`: the 19 locales */
  locales: 'ALL' | Locale[];
  intent: (typeof SCENARIO_INTENTS)[number];
  source: Source;
  condition: Condition;
  overlay: { status: DataStatus; retuning: boolean };
  expect: ScenarioExpect;
}

export interface ScenarioSet {
  schema: typeof SCENARIO_SCHEMA;
  version: string;
  scenarios: Scenario[];
}

/** The ten rows of architecture 7.6, with the ADR each cites. */
export const DEGRADED_ROWS: readonly {
  row: number;
  failure: string;
  response: string;
}[] = [
  {
    row: 1,
    failure: 'Market data STALE',
    response:
      'No direction, no Report 2; other questions answered; stop time stated',
  },
  {
    row: 2,
    failure: 'Market closed',
    response: "Last session's picture, labelled; no Report 2",
  },
  {
    row: 3,
    failure: 'Sensor INVALID or STALE',
    response: 'Listed as unavailable; left out of synthesis',
  },
  {
    row: 4,
    failure: 'Chart missing or from another cycle',
    response: 'Text-only answer; the missing chart is stated',
  },
  {
    row: 5,
    failure: 'Promote in progress (RETUNING)',
    response: 'Sensors CAUTIONARY; half risk pre-set',
  },
  {
    row: 6,
    failure: 'Model provider down',
    response:
      'Fallback model; if both fail, a fixed answer from the sensor board',
  },
  {
    row: 7,
    failure: 'Quota exhausted',
    response: 'Refused before any model call; balance shown',
  },
  {
    row: 8,
    failure: "Knowledge index won't load",
    response: 'Report 1 from sensor data, flagged; Report 2 unaffected',
  },
  {
    row: 9,
    failure: 'News calendar not exported for 45 min',
    response: 'Blackout still applied from the last known schedule; age shown',
  },
  {
    row: 10,
    failure: '`symbol_specs` older than 7 days',
    response: 'Report 2 not offered until the specs refresh',
  },
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SCENARIO_ID = /^[GODPM][0-9]{2}[a-z]?$/;
const CYCLE_ID = /^(0[1-9]|1[0-6])$/;

const SCENARIO_KEYS = [
  'id',
  'family',
  'title',
  'rule',
  'row',
  'cycle',
  'traders',
  'locales',
  'intent',
  'source',
  'condition',
  'overlay',
  'expect',
];
const EXPECT_KEYS = [
  'outcome',
  'fixed_reason',
  'refusal',
  'model_calls',
  'regenerations',
  'schema_retries',
  'numbers_flagged',
  'direction',
  'zones_valid',
  'stand_aside_kept',
  'notes',
  'news_status',
  'fallback_used',
];

function sameKeys(value: Rec, keys: readonly string[], path: string): string[] {
  const problems: string[] = [];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      problems.push(`${path}.${key} is missing`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) problems.push(`${path}.${key} is not a field`);
  }
  return problems;
}

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function expectProblems(value: unknown, path: string): string[] {
  if (!isRec(value)) return [`${path} is not an object`];
  const problems = sameKeys(value, EXPECT_KEYS, path);
  if (problems.length > 0) return problems;
  if (!(OUTCOMES as readonly unknown[]).includes(value['outcome'])) {
    problems.push(`${path}.outcome is not an outcome`);
  }
  const reason = value['fixed_reason'];
  if (
    reason !== null &&
    !(FIXED_REASONS as readonly unknown[]).includes(reason)
  ) {
    problems.push(`${path}.fixed_reason is not a fixed reason`);
  }
  if (value['outcome'] === 'FIXED_ANSWER' && reason === null) {
    problems.push(`${path}.fixed_reason is required for a fixed answer`);
  }
  if (value['outcome'] !== 'FIXED_ANSWER' && reason !== null) {
    problems.push(`${path}.fixed_reason is only for a fixed answer`);
  }
  const refusal = value['refusal'];
  if (refusal !== null && (typeof refusal !== 'string' || refusal === '')) {
    problems.push(`${path}.refusal is not a code or null`);
  }
  if ((value['outcome'] === 'REFUSED') !== (refusal !== null)) {
    problems.push(`${path}.refusal is set exactly when the outcome is REFUSED`);
  }
  const calls = value['model_calls'];
  if (
    !isRec(calls) ||
    !isWhole(calls['min']) ||
    !isWhole(calls['max']) ||
    calls['min'] > calls['max'] ||
    calls['max'] > 3
  ) {
    problems.push(
      `${path}.model_calls is not { min, max } with min <= max <= 3`
    );
  }
  for (const key of ['regenerations', 'schema_retries']) {
    if (value[key] !== 0 && value[key] !== 1) {
      problems.push(`${path}.${key} is not 0 or 1`);
    }
  }
  const flagged = value['numbers_flagged'];
  if (flagged !== null && !isWhole(flagged)) {
    problems.push(`${path}.numbers_flagged is not a count or null`);
  }
  if (value['direction'] !== 'SYN' && value['direction'] !== 'NONE') {
    problems.push(`${path}.direction is not SYN or NONE`);
  }
  for (const key of ['zones_valid', 'stand_aside_kept', 'fallback_used']) {
    if (typeof value[key] !== 'boolean')
      problems.push(`${path}.${key} is not a boolean`);
  }
  const notes = value['notes'];
  if (
    !Array.isArray(notes) ||
    notes.some(
      (note) => !(RESULT_NOTES as readonly unknown[]).includes(note)
    ) ||
    new Set(notes).size !== notes.length
  ) {
    problems.push(`${path}.notes is not a list of distinct result notes`);
  }
  const news = value['news_status'];
  if (
    news !== null &&
    !(EVENTS_STATUSES as readonly unknown[]).includes(news)
  ) {
    problems.push(`${path}.news_status is not an events status or null`);
  }
  return problems;
}

/** Every problem with a scenario file's content, in words; an empty list is a good file. */
export function scenarioSetProblems(value: unknown): string[] {
  if (!isRec(value)) return ['the file is not an object'];
  const problems = sameKeys(value, ['schema', 'version', 'scenarios'], 'file');
  if (value['schema'] !== SCENARIO_SCHEMA) {
    problems.push(`schema is not ${SCENARIO_SCHEMA}`);
  }
  if (typeof value['version'] !== 'string' || value['version'] === '') {
    problems.push('version is not a name');
  }
  const list = value['scenarios'];
  if (!Array.isArray(list)) return [...problems, 'scenarios is not a list'];
  const seen = new Set<string>();
  list.forEach((entry, index) => {
    const path = `scenarios[${index}]`;
    if (!isRec(entry)) {
      problems.push(`${path} is not an object`);
      return;
    }
    const own = sameKeys(entry, SCENARIO_KEYS, path);
    if (own.length > 0) {
      problems.push(...own);
      return;
    }
    const id = entry['id'];
    if (typeof id !== 'string' || !SCENARIO_ID.test(id)) {
      problems.push(`${path}.id is not a scenario id`);
    } else if (seen.has(id)) {
      problems.push(`${path}.id ${id} is used twice`);
    } else {
      seen.add(id);
    }
    if (!(FAMILIES as readonly unknown[]).includes(entry['family'])) {
      problems.push(`${path}.family is not a family`);
    }
    for (const key of ['title', 'rule']) {
      if (typeof entry[key] !== 'string' || entry[key] === '') {
        problems.push(`${path}.${key} is empty`);
      }
    }
    const row = entry['row'];
    if (
      row !== null &&
      !(Number.isInteger(row) && (row as number) >= 1 && (row as number) <= 10)
    ) {
      problems.push(`${path}.row is not 1 to 10 or null`);
    }
    if (typeof entry['cycle'] !== 'string' || !CYCLE_ID.test(entry['cycle'])) {
      problems.push(`${path}.cycle is not 01 to 16`);
    }
    const traders = entry['traders'];
    if (
      !Array.isArray(traders) ||
      traders.length === 0 ||
      traders.some((t) => !(TRADER_LIST as readonly unknown[]).includes(t)) ||
      new Set(traders).size !== traders.length
    ) {
      problems.push(`${path}.traders is not one or both trader types`);
    }
    const locales = entry['locales'];
    if (
      locales !== 'ALL' &&
      (!Array.isArray(locales) ||
        locales.length === 0 ||
        locales.some((l) => !isEvalLocale(l)) ||
        new Set(locales).size !== locales.length)
    ) {
      problems.push(`${path}.locales is not ALL or a list of the 19 locales`);
    }
    if (!(SCENARIO_INTENTS as readonly unknown[]).includes(entry['intent'])) {
      problems.push(`${path}.intent is not a scenario intent`);
    }
    if (!(SOURCES as readonly unknown[]).includes(entry['source'])) {
      problems.push(`${path}.source is not MODEL or FIXTURE`);
    }
    if (!(CONDITIONS as readonly unknown[]).includes(entry['condition'])) {
      problems.push(`${path}.condition is not a condition`);
    }
    const overlay = entry['overlay'];
    if (
      !isRec(overlay) ||
      !(OVERLAY_STATUSES as readonly unknown[]).includes(overlay['status']) ||
      typeof overlay['retuning'] !== 'boolean'
    ) {
      problems.push(`${path}.overlay is not { status, retuning }`);
    }
    problems.push(...expectProblems(entry['expect'], `${path}.expect`));
  });
  return problems;
}

function parseScenarioSet(value: unknown): ScenarioSet {
  const problems = scenarioSetProblems(value);
  if (problems.length > 0) {
    throw new Error(
      `config/reply/golden/scenarios.v1.json is damaged: ${problems.slice(0, 5).join('; ')}`
    );
  }
  return value as ScenarioSet;
}

/** The shipped scenarios. A damaged file stops the module from loading. */
export const SCENARIO_SET: ScenarioSet = parseScenarioSet(scenarioFile);

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/** One run of one scenario for one trader type in one locale (a pass number from 1). */
export interface CellKey {
  scenario: string;
  trader: TraderType;
  locale: Locale;
  pass: number;
}

export const cellId = (key: CellKey): string =>
  `${key.scenario}.${key.trader}.${key.locale}.${key.pass}`;

/** The locales a scenario is run in. */
export function localesOf(scenario: Scenario): readonly Locale[] {
  return scenario.locales === 'ALL' ? EVAL_LOCALES : scenario.locales;
}

/** Every cell of a set for `passes` passes, in a fixed order (scenario, trader, locale, pass). */
export function cellsOf(
  scenarios: readonly Scenario[] = SCENARIO_SET.scenarios,
  passes = 1
): CellKey[] {
  const out: CellKey[] = [];
  for (const scenario of scenarios) {
    for (const trader of scenario.traders) {
      for (const locale of localesOf(scenario)) {
        for (let pass = 1; pass <= passes; pass += 1) {
          out.push({ scenario: scenario.id, trader, locale, pass });
        }
      }
    }
  }
  return out;
}

/**
 * Does this scenario count toward a language's score? A language's score is the share of its runs
 * that pass every check without a regeneration (plan part 10), so only the scenarios in which a
 * MODEL is asked to write a clean reply count: not a staged failure, not a request that never
 * reaches a model. And only the scenarios that run in ALL 19 locales: a scenario run in English
 * alone would lower English's score and nobody else's, and the bar compares each locale with
 * English on the same questions.
 */
export function isScored(scenario: Scenario): boolean {
  const expect = scenario.expect;
  return (
    scenario.source === 'MODEL' &&
    scenario.locales === 'ALL' &&
    (expect.outcome === 'REPORT1' || expect.outcome === 'ANSWER') &&
    expect.regenerations === 0 &&
    expect.schema_retries === 0 &&
    expect.numbers_flagged === 0 &&
    !expect.fallback_used
  );
}

/** The scenario with this id, or undefined. */
export function scenarioById(
  id: string,
  set: ScenarioSet = SCENARIO_SET
): Scenario | undefined {
  return set.scenarios.find((scenario) => scenario.id === id);
}

/**
 * The hash that names a scenario set in a fingerprint: the scenarios as written, and the digests
 * of the worlds they run on (the value dictionary and the synthesis reading of every cycle and
 * trader type the set uses). A change to a scenario, to a golden cycle or to what the context
 * assembler puts in the dictionary changes it, and a recorded run goes stale.
 */
export async function scenarioSetSha256(
  set: ScenarioSet,
  worldDigests: Readonly<Record<string, string>>
): Promise<string> {
  const sorted = Object.keys(worldDigests)
    .sort()
    .map((key) => [key, worldDigests[key]]);
  return sha256Hex(canonicalJson({ scenarios: set, worlds: sorted }));
}
