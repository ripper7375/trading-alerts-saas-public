/**
 * The trace of ONE answer (architecture 7.4, ADR-075; build step 7 decisions D16 and D17).
 *
 * Section 7.4 has one row per answer with seven groups, each filled by the section that
 * knows it: **request**, **data**, **knowledge**, **model**, **checks**, **risk**, **time**.
 * The orchestrator collects them over the request and writes the row ONCE, at the end
 * (not staged upserts: a half-written row after a crash is worse than none). The risk group
 * is the exception: Section 6 attaches it later, when the trader opens Report 2.
 *
 * What the trace never holds:
 *  - the trader's question, in any form (D16): "missed knowledge" is the intent, M*, locale,
 *    a count and the packet's fingerprint, enough to build the corpus backlog;
 *  - the user id inside a group: the row has the id in its own column, which the database
 *    sets to NULL when the account is deleted, and the keyed hash beside it. A group that
 *    held the id would outlive the deletion (a CHECK in the migration refuses it);
 *  - a field called like the equity or the commission (ADR-077).
 *
 * Every group is a strict object: a key that is not listed is refused, so a developer
 * cannot add a free-text field by accident. `validateReplyTrace` also holds the groups to
 * each other (the class counts add up to the violation count, the regeneration count equals
 * the regeneration calls).
 *
 * The columns the dashboard filters on are projected from the groups by the store
 * (`lib/platform/traces/store.ts`); the database checks each equals its group's value.
 *
 * Pure.
 *
 * @module lib/reply/contracts/trace-fields
 */

import {
  BOARD_STATUSES,
  DATA_FLAGS,
  DATA_STATUSES,
  Issues,
  KNOWLEDGE_STATUSES,
  PACKET_INTENTS,
  at,
  bool,
  exactObject,
  isLocale,
  isRecord,
  join,
  list,
  oneOf,
  text,
} from './intake';
import type {
  BoardStatus,
  DataFlag,
  DataStatus,
  KnowledgeStatus,
  Locale,
  PacketIntent,
} from './intake';
import {
  CODE,
  INSTANT,
  INT_MAX,
  MCD,
  MODEL_SLUG,
  RULES_VERSION,
  RULE_ID,
  codeList,
  idText,
  intIn,
  sha256Text,
  slotText,
  versionText,
} from './fields';
import { finish } from './shape';
import type { Validation } from './shape';
import { FIXED_REASONS } from './result';
import type { FixedReason } from './result';

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

export const TRACE_TIERS = ['FREE', 'PRO'] as const;
export type TraceTier = (typeof TRACE_TIERS)[number];

export const REQUEST_KINDS = ['TYPED', 'INSTANT'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** How the request ended. `FIXED_ANSWER` and `OPEN_TRADE_SETUP` are `reply-result/1` kinds. */
export const REPLY_OUTCOMES = [
  'REPORT1',
  'ANSWER',
  'FIXED_ANSWER',
  'OPEN_TRADE_SETUP',
  'REFUSED',
  'ERROR',
] as const;
export type ReplyOutcome = (typeof REPLY_OUTCOMES)[number];

/** The ten rows of the budget table of 5.4. */
export const CONTEXT_COMPONENTS = [
  'SYSTEM_RULES',
  'BOARD_SYNTHESIS',
  'OHLC',
  'CHART',
  'READINGS_ZONES',
  'KNOWLEDGE',
  'PROFILE_EVENTS',
  'HISTORY',
  'QUESTION',
  'ANSWER',
] as const;
export type ContextComponent = (typeof CONTEXT_COMPONENTS)[number];

/** What a literal in a reply can be (the value dictionary's kinds, plan section 4). */
export const NUMBER_CLASSES = [
  'PRICE',
  'DISTANCE',
  'PCT',
  'RATIO',
  'TIME',
  'COUNT',
] as const;
export type NumberClass = (typeof NUMBER_CLASSES)[number];

/** The "never" rows of 5.9, and the direction-word guard of part 4. */
export const WORDING_CATEGORIES = [
  'ADVICE',
  'PROBABILITY',
  'GUARANTEE',
  'URGENCY',
  'UNLISTED_NEWS',
  'DIRECTION_WORD',
] as const;
export type WordingCategory = (typeof WORDING_CATEGORIES)[number];

export const REPLY_SHAPES = ['REPORT1', 'ANSWER', 'NONE'] as const;
export type ReplyShape = (typeof REPLY_SHAPES)[number];

export const MODEL_CALL_ROLES = [
  'UNDERSTAND',
  'ANSWER',
  'REGENERATE',
  'FALLBACK',
] as const;
export type ModelCallRole = (typeof MODEL_CALL_ROLES)[number];

export const MODEL_CALL_OUTCOMES = [
  'OK',
  'TIMEOUT',
  'ERROR',
  'BAD_JSON',
  'BAD_SCHEMA',
] as const;
export type ModelCallOutcome = (typeof MODEL_CALL_OUTCOMES)[number];

/** What the answer gate decided about the chart (5.3, ADR-051). */
export const CHART_DECISIONS = [
  'SENT',
  'NO_VISION',
  'TIER',
  'CYCLE_MISMATCH',
  'NOT_CALLED_FOR',
  'MISSING',
  'DATA_STATUS',
] as const;
export type ChartDecision = (typeof CHART_DECISIONS)[number];

/** The columns of the table in 5.3: what the data status allows. */
export const GATE_DIRECTION = ['YES', 'DELAYED', 'NO', 'LAST_SESSION'] as const;
export const GATE_OTHER_QUESTIONS = ['ALL', 'EXPLAIN_AND_GENERAL'] as const;
export const GATE_REPORT2 = [
  'ALLOWED',
  'ALLOWED_DELAY_STATED',
  'BLOCKED',
  'HALF_RISK_PRESET',
] as const;

export const CONSENT_ACTIONS = ['ACCEPT', 'MODIFY', 'DECLINE'] as const;
export type TraceConsentAction = (typeof CONSENT_ACTIONS)[number];

/** Stage names are free words so that adding a stage never changes the contract. */
export const STAGE_NAME = /^[A-Z][A-Z_]{1,23}$/;

export const TRACE_LIMITS = {
  questionFlags: 8,
  sensors: 16,
  chunks: 12,
  calls: 6,
  stages: 24,
  validatorResults: 16,
  overrides: 8,
  /** a single request does not cost more than the INTEGER column holds */
  units: INT_MAX,
  count: 100_000,
  tokens: 2_000_000,
  ms: 3_600_000,
} as const;

// ---------------------------------------------------------------------------
// The groups
// ---------------------------------------------------------------------------

export interface TraceRequestGroup {
  reply_version: string;
  request_id: string;
  /** the client's idempotency key: one per button press or sent message */
  client_request_id: string;
  /** the chat thread ("session" of 7.4); null when the request made none */
  thread_id: string | null;
  tier: TraceTier;
  kind: RequestKind;
  intent: PacketIntent;
  /** a language family or `und`; for an instant prompt the interface's own */
  language: string;
  interface_locale: Locale;
  reply_locale: Locale;
  /** signals of the understanding step (`TERM_DROPPED`): codes, never text */
  question_flags: string[];
}

export interface TraceDataGroup {
  cycle_slot: string | null;
  data_status: DataStatus | null;
  retuning: boolean;
  flags: DataFlag[];
  sensor_statuses: Record<string, BoardStatus>;
  synthesis_rule: string | null;
  synthesis_rules_version: string | null;
  /** the bar whose close was the prompt's last price (decision D6) */
  last_price_bar: string | null;
  intake_version: string | null;
  routing_version: string | null;
  /** the fingerprint of the whole packet */
  packet_sha256: string | null;
}

/**
 * Where a reply had no relevant knowledge, for the corpus backlog (decision D16). Nothing
 * the trader typed is in it.
 */
export interface MissedKnowledge {
  intent: PacketIntent;
  m_star: string[];
  reply_locale: Locale;
  /** how many chunks the pack held (0 is a miss) */
  chunk_count: number;
  packet_sha256: string;
}

export interface TraceKnowledgeGroup {
  m_star: string[];
  chunk_ids: string[];
  index_build_id: string | null;
  status: KnowledgeStatus | null;
  missed: MissedKnowledge | null;
}

export interface ModelCallRecord {
  role: ModelCallRole;
  model: string;
  outcome: ModelCallOutcome;
  attempts: number;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  tokens_cached: number | null;
  /** integer micro-dollars (decision D2); null when the provider reported none */
  cost_micro_usd: number | null;
  /** true when the cost is ours (the registry price) and not the provider's */
  cost_estimated: boolean;
  latency_ms: number;
}

export interface TraceModelGroup {
  /** the model that wrote the delivered reply; null when none did */
  model: string | null;
  prompt_version: string | null;
  fallback_used: boolean;
  /** the estimated size of every component of the prompt (the caps table of 5.4) */
  components: Record<ContextComponent, number>;
  /** the SHA-256 of the cycle block: two users of one trader type in one cycle share it */
  cycle_block_sha256: string | null;
  /** the real counts, summed over the calls that wrote an answer */
  tokens: {
    prompt: number | null;
    completion: number | null;
    cached: number | null;
  };
  calls: ModelCallRecord[];
  units_charged: number;
  cost_micro_usd: number | null;
}

export interface TraceAnswerGate {
  direction: (typeof GATE_DIRECTION)[number];
  other_questions: (typeof GATE_OTHER_QUESTIONS)[number];
  chart: ChartDecision;
  report2: (typeof GATE_REPORT2)[number];
}

export interface TraceChecksGroup {
  answer_gate: TraceAnswerGate | null;
  /** what the request tried to produce (a fixed answer may follow a failed REPORT1) */
  shape: ReplyShape;
  /** times the model's JSON failed the schema and was asked again */
  schema_retries: number;
  numbers: {
    extracted: number;
    matched: number;
    /** unmatched on the first pass; the class counts add up to it */
    violations: number;
    /** still unmatched after the regeneration, shown as "not verified" */
    flagged: number;
    classes: Record<NumberClass, number>;
  };
  wording: {
    /** the category counts add up to it */
    violations: number;
    categories: Record<WordingCategory, number>;
    /** whether a fixed answer replaced the reply because of it */
    fixed_answer: boolean;
  };
  /** one regeneration, shared by the number check and the wording check (decision D11) */
  regenerations: number;
  /** the structured direction equals the synthesis reading; null when there is no direction */
  direction_equals_syn: boolean | null;
  fixed_reason: FixedReason | null;
}

export interface TraceRiskGroup {
  engine4_version: string;
  /** the SHA-256 of the validated setup that was shown (`trade_consent_records.setup_sha256`) */
  setup_sha256: string | null;
  profile_snapshot_id: string | null;
  validator_results: { code: string; ok: boolean }[];
  overrides: string[];
  consent_action: TraceConsentAction | null;
}

export interface TraceTimeGroup {
  started_at: string;
  total_ms: number;
  deadline_hit: boolean;
  stages: { name: string; ms: number }[];
}

export interface ReplyTrace {
  request: TraceRequestGroup;
  data: TraceDataGroup;
  knowledge: TraceKnowledgeGroup;
  model: TraceModelGroup;
  checks: TraceChecksGroup;
  /** null until Section 6 attaches it */
  risk: TraceRiskGroup | null;
  time: TraceTimeGroup;
  outcome: ReplyOutcome;
}

export type TraceValidation = Validation<ReplyTrace>;

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function count(
  value: unknown,
  path: string,
  issues: Issues,
  max: number = TRACE_LIMITS.count
): number | undefined {
  return intIn(value, path, issues, max);
}

function checkTokensOrNull(value: unknown, path: string, issues: Issues): void {
  if (value !== null) count(value, path, issues, TRACE_LIMITS.tokens);
}

/** The count of each word of a closed list, every word present. */
function countsOf<K extends string>(
  value: unknown,
  path: string,
  issues: Issues,
  words: readonly K[]
): Record<K, number> | undefined {
  const r = exactObject(value, path, words, issues);
  if (r === undefined) return undefined;
  const out = {} as Record<K, number>;
  let complete = true;
  for (const word of words) {
    const n = count(r[word], join(path, word), issues);
    if (n === undefined) complete = false;
    else out[word] = n;
  }
  return complete ? out : undefined;
}

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((total, n) => total + n, 0);
}

function checkRequest(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'request',
    [
      'reply_version',
      'request_id',
      'client_request_id',
      'thread_id',
      'tier',
      'kind',
      'intent',
      'language',
      'interface_locale',
      'reply_locale',
      'question_flags',
    ],
    issues
  );
  if (r === undefined) return;
  versionText(r['reply_version'], 'request.reply_version', issues);
  idText(r['request_id'], 'request.request_id', issues);
  idText(r['client_request_id'], 'request.client_request_id', issues);
  if (r['thread_id'] !== null)
    idText(r['thread_id'], 'request.thread_id', issues);
  oneOf(r['tier'], 'request.tier', TRACE_TIERS, issues);
  oneOf(r['kind'], 'request.kind', REQUEST_KINDS, issues);
  oneOf(r['intent'], 'request.intent', PACKET_INTENTS, issues);
  text(r['language'], 'request.language', issues, {
    pattern: /^[a-z]{2,3}(-[A-Z]{2})?$/,
  });
  for (const key of ['interface_locale', 'reply_locale']) {
    if (!isLocale(r[key])) {
      issues.add(
        join('request', key),
        'NOT_ONE_OF',
        'must be one of the 19 locales'
      );
    }
  }
  codeList(
    r['question_flags'],
    'request.question_flags',
    issues,
    TRACE_LIMITS.questionFlags
  );
}

function checkData(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'data',
    [
      'cycle_slot',
      'data_status',
      'retuning',
      'flags',
      'sensor_statuses',
      'synthesis_rule',
      'synthesis_rules_version',
      'last_price_bar',
      'intake_version',
      'routing_version',
      'packet_sha256',
    ],
    issues
  );
  if (r === undefined) return;
  if (r['cycle_slot'] !== null)
    slotText(r['cycle_slot'], 'data.cycle_slot', issues);
  if (r['data_status'] !== null)
    oneOf(r['data_status'], 'data.data_status', DATA_STATUSES, issues);
  bool(r['retuning'], 'data.retuning', issues);
  const flags = codeList(r['flags'], 'data.flags', issues, DATA_FLAGS.length);
  flags?.forEach((flag, index) => {
    if (!(DATA_FLAGS as readonly string[]).includes(flag)) {
      issues.add(
        at('data.flags', index),
        'NOT_ONE_OF',
        `must be one of ${DATA_FLAGS.join(', ')}`
      );
    }
  });
  const statuses = r['sensor_statuses'];
  if (!isRecord(statuses)) {
    issues.add('data.sensor_statuses', 'WRONG_TYPE', 'must be an object');
  } else {
    // a name must be a sensor id, so there are at most fifteen of them
    for (const name of Object.keys(statuses)) {
      const here = join('data.sensor_statuses', name);
      if (!MCD.test(name))
        issues.add(here, 'BAD_FORMAT', 'must be a sensor id (MCD1 to MCD15)');
      oneOf(statuses[name], here, BOARD_STATUSES, issues);
    }
  }
  if (r['synthesis_rule'] !== null) {
    text(r['synthesis_rule'], 'data.synthesis_rule', issues, {
      pattern: RULE_ID,
    });
  }
  if (r['synthesis_rules_version'] !== null) {
    text(r['synthesis_rules_version'], 'data.synthesis_rules_version', issues, {
      pattern: RULES_VERSION,
      max: 40,
    });
  }
  if (r['last_price_bar'] !== null)
    slotText(r['last_price_bar'], 'data.last_price_bar', issues);
  if (r['intake_version'] !== null)
    versionText(r['intake_version'], 'data.intake_version', issues);
  if (r['routing_version'] !== null)
    versionText(r['routing_version'], 'data.routing_version', issues);
  if (r['packet_sha256'] !== null)
    sha256Text(r['packet_sha256'], 'data.packet_sha256', issues);
}

function sensorIds(value: unknown, path: string, issues: Issues): void {
  const items = list(value, path, issues, { max: TRACE_LIMITS.sensors });
  items?.forEach((item, index) =>
    text(item, at(path, index), issues, { pattern: MCD })
  );
}

function checkKnowledge(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'knowledge',
    ['m_star', 'chunk_ids', 'index_build_id', 'status', 'missed'],
    issues
  );
  if (r === undefined) return;
  sensorIds(r['m_star'], 'knowledge.m_star', issues);
  const ids = list(r['chunk_ids'], 'knowledge.chunk_ids', issues, {
    max: TRACE_LIMITS.chunks,
  });
  ids?.forEach((item, index) =>
    text(item, at('knowledge.chunk_ids', index), issues, {
      pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/,
    })
  );
  if (r['index_build_id'] !== null) {
    text(r['index_build_id'], 'knowledge.index_build_id', issues, {
      pattern: /^kb-[0-9a-f]{32}$/,
    });
  }
  if (r['status'] !== null)
    oneOf(r['status'], 'knowledge.status', KNOWLEDGE_STATUSES, issues);
  if (r['missed'] !== null) {
    const m = exactObject(
      r['missed'],
      'knowledge.missed',
      ['intent', 'm_star', 'reply_locale', 'chunk_count', 'packet_sha256'],
      issues
    );
    if (m !== undefined) {
      oneOf(m['intent'], 'knowledge.missed.intent', PACKET_INTENTS, issues);
      sensorIds(m['m_star'], 'knowledge.missed.m_star', issues);
      if (!isLocale(m['reply_locale'])) {
        issues.add(
          'knowledge.missed.reply_locale',
          'NOT_ONE_OF',
          'must be one of the 19 locales'
        );
      }
      count(
        m['chunk_count'],
        'knowledge.missed.chunk_count',
        issues,
        TRACE_LIMITS.chunks
      );
      sha256Text(m['packet_sha256'], 'knowledge.missed.packet_sha256', issues);
    }
  }
}

function checkModel(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'model',
    [
      'model',
      'prompt_version',
      'fallback_used',
      'components',
      'cycle_block_sha256',
      'tokens',
      'calls',
      'units_charged',
      'cost_micro_usd',
    ],
    issues
  );
  if (r === undefined) return;
  if (r['model'] !== null)
    text(r['model'], 'model.model', issues, { pattern: MODEL_SLUG });
  if (r['prompt_version'] !== null)
    versionText(r['prompt_version'], 'model.prompt_version', issues);
  bool(r['fallback_used'], 'model.fallback_used', issues);
  countsOf(r['components'], 'model.components', issues, CONTEXT_COMPONENTS);
  if (r['cycle_block_sha256'] !== null)
    sha256Text(r['cycle_block_sha256'], 'model.cycle_block_sha256', issues);
  const t = exactObject(
    r['tokens'],
    'model.tokens',
    ['prompt', 'completion', 'cached'],
    issues
  );
  if (t !== undefined) {
    for (const key of ['prompt', 'completion', 'cached']) {
      checkTokensOrNull(t[key], join('model.tokens', key), issues);
    }
  }
  const calls = list(r['calls'], 'model.calls', issues, {
    max: TRACE_LIMITS.calls,
  });
  calls?.forEach((item, index) => {
    const here = at('model.calls', index);
    const c = exactObject(
      item,
      here,
      [
        'role',
        'model',
        'outcome',
        'attempts',
        'tokens_prompt',
        'tokens_completion',
        'tokens_cached',
        'cost_micro_usd',
        'cost_estimated',
        'latency_ms',
      ],
      issues
    );
    if (c === undefined) return;
    oneOf(c['role'], join(here, 'role'), MODEL_CALL_ROLES, issues);
    text(c['model'], join(here, 'model'), issues, { pattern: MODEL_SLUG });
    oneOf(c['outcome'], join(here, 'outcome'), MODEL_CALL_OUTCOMES, issues);
    intIn(c['attempts'], join(here, 'attempts'), issues, 5, 1);
    for (const key of ['tokens_prompt', 'tokens_completion', 'tokens_cached']) {
      checkTokensOrNull(c[key], join(here, key), issues);
    }
    if (c['cost_micro_usd'] !== null) {
      count(
        c['cost_micro_usd'],
        join(here, 'cost_micro_usd'),
        issues,
        TRACE_LIMITS.units
      );
    }
    bool(c['cost_estimated'], join(here, 'cost_estimated'), issues);
    intIn(c['latency_ms'], join(here, 'latency_ms'), issues, TRACE_LIMITS.ms);
  });
  count(r['units_charged'], 'model.units_charged', issues, TRACE_LIMITS.units);
  if (r['cost_micro_usd'] !== null) {
    count(
      r['cost_micro_usd'],
      'model.cost_micro_usd',
      issues,
      TRACE_LIMITS.units
    );
  }
}

function checkChecks(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'checks',
    [
      'answer_gate',
      'shape',
      'schema_retries',
      'numbers',
      'wording',
      'regenerations',
      'direction_equals_syn',
      'fixed_reason',
    ],
    issues
  );
  if (r === undefined) return;
  if (r['answer_gate'] !== null) {
    const g = exactObject(
      r['answer_gate'],
      'checks.answer_gate',
      ['direction', 'other_questions', 'chart', 'report2'],
      issues
    );
    if (g !== undefined) {
      oneOf(
        g['direction'],
        'checks.answer_gate.direction',
        GATE_DIRECTION,
        issues
      );
      oneOf(
        g['other_questions'],
        'checks.answer_gate.other_questions',
        GATE_OTHER_QUESTIONS,
        issues
      );
      oneOf(g['chart'], 'checks.answer_gate.chart', CHART_DECISIONS, issues);
      oneOf(g['report2'], 'checks.answer_gate.report2', GATE_REPORT2, issues);
    }
  }
  oneOf(r['shape'], 'checks.shape', REPLY_SHAPES, issues);
  intIn(r['schema_retries'], 'checks.schema_retries', issues, 2);

  const n = exactObject(
    r['numbers'],
    'checks.numbers',
    ['extracted', 'matched', 'violations', 'flagged', 'classes'],
    issues
  );
  if (n !== undefined) {
    count(n['extracted'], 'checks.numbers.extracted', issues);
    count(n['matched'], 'checks.numbers.matched', issues);
    const violations = count(
      n['violations'],
      'checks.numbers.violations',
      issues
    );
    count(n['flagged'], 'checks.numbers.flagged', issues);
    const classes = countsOf(
      n['classes'],
      'checks.numbers.classes',
      issues,
      NUMBER_CLASSES
    );
    if (
      violations !== undefined &&
      classes !== undefined &&
      sum(classes) !== violations
    ) {
      issues.add(
        'checks.numbers.classes',
        'INCONSISTENT',
        `the classes add up to ${sum(classes)}, the violations to ${violations}`
      );
    }
  }

  const w = exactObject(
    r['wording'],
    'checks.wording',
    ['violations', 'categories', 'fixed_answer'],
    issues
  );
  if (w !== undefined) {
    const violations = count(
      w['violations'],
      'checks.wording.violations',
      issues
    );
    const categories = countsOf(
      w['categories'],
      'checks.wording.categories',
      issues,
      WORDING_CATEGORIES
    );
    bool(w['fixed_answer'], 'checks.wording.fixed_answer', issues);
    if (
      violations !== undefined &&
      categories !== undefined &&
      sum(categories) !== violations
    ) {
      issues.add(
        'checks.wording.categories',
        'INCONSISTENT',
        `the categories add up to ${sum(categories)}, the violations to ${violations}`
      );
    }
  }
  intIn(r['regenerations'], 'checks.regenerations', issues, 1);
  if (r['direction_equals_syn'] !== null) {
    bool(r['direction_equals_syn'], 'checks.direction_equals_syn', issues);
  }
  if (r['fixed_reason'] !== null) {
    oneOf(r['fixed_reason'], 'checks.fixed_reason', FIXED_REASONS, issues);
  }
}

/** The risk group, on its own: Section 6 attaches it after the row exists. */
export function checkRiskGroup(
  value: unknown,
  path: string,
  issues: Issues
): void {
  const r = exactObject(
    value,
    path,
    [
      'engine4_version',
      'setup_sha256',
      'profile_snapshot_id',
      'validator_results',
      'overrides',
      'consent_action',
    ],
    issues
  );
  if (r === undefined) return;
  versionText(r['engine4_version'], join(path, 'engine4_version'), issues);
  if (r['setup_sha256'] !== null)
    sha256Text(r['setup_sha256'], join(path, 'setup_sha256'), issues);
  if (r['profile_snapshot_id'] !== null)
    idText(r['profile_snapshot_id'], join(path, 'profile_snapshot_id'), issues);
  const results = list(
    r['validator_results'],
    join(path, 'validator_results'),
    issues,
    {
      max: TRACE_LIMITS.validatorResults,
    }
  );
  results?.forEach((item, index) => {
    const here = at(join(path, 'validator_results'), index);
    const v = exactObject(item, here, ['code', 'ok'], issues);
    if (v === undefined) return;
    text(v['code'], join(here, 'code'), issues, { pattern: CODE });
    bool(v['ok'], join(here, 'ok'), issues);
  });
  codeList(
    r['overrides'],
    join(path, 'overrides'),
    issues,
    TRACE_LIMITS.overrides
  );
  if (r['consent_action'] !== null) {
    oneOf(
      r['consent_action'],
      join(path, 'consent_action'),
      CONSENT_ACTIONS,
      issues
    );
  }
}

/** The risk group alone, as Section 6 hands it over when it attaches it to a trace. */
export function validateRiskGroup(value: unknown): Validation<TraceRiskGroup> {
  const issues = new Issues();
  checkRiskGroup(value, '', issues);
  return finish(issues, () => value as TraceRiskGroup);
}

function checkTime(value: unknown, issues: Issues): void {
  const r = exactObject(
    value,
    'time',
    ['started_at', 'total_ms', 'deadline_hit', 'stages'],
    issues
  );
  if (r === undefined) return;
  text(r['started_at'], 'time.started_at', issues, { pattern: INSTANT });
  intIn(r['total_ms'], 'time.total_ms', issues, TRACE_LIMITS.ms);
  bool(r['deadline_hit'], 'time.deadline_hit', issues);
  const stages = list(r['stages'], 'time.stages', issues, {
    max: TRACE_LIMITS.stages,
  });
  stages?.forEach((item, index) => {
    const here = at('time.stages', index);
    const s = exactObject(item, here, ['name', 'ms'], issues);
    if (s === undefined) return;
    text(s['name'], join(here, 'name'), issues, { pattern: STAGE_NAME });
    intIn(s['ms'], join(here, 'ms'), issues, TRACE_LIMITS.ms);
  });
}

export function validateReplyTrace(value: unknown): TraceValidation {
  const issues = new Issues();
  const record = exactObject(
    value,
    '',
    [
      'request',
      'data',
      'knowledge',
      'model',
      'checks',
      'risk',
      'time',
      'outcome',
    ],
    issues
  );
  if (record === undefined) return { ok: false, issues: issues.list };

  checkRequest(record['request'], issues);
  checkData(record['data'], issues);
  checkKnowledge(record['knowledge'], issues);
  checkModel(record['model'], issues);
  checkChecks(record['checks'], issues);
  if (record['risk'] !== null) checkRiskGroup(record['risk'], 'risk', issues);
  checkTime(record['time'], issues);
  const outcome = oneOf(record['outcome'], 'outcome', REPLY_OUTCOMES, issues);

  // the groups hold to each other
  const model = record['model'] as { calls?: unknown } | null;
  const checks = record['checks'] as {
    regenerations?: unknown;
    shape?: unknown;
  } | null;
  if (
    model !== null &&
    typeof model === 'object' &&
    Array.isArray(model.calls) &&
    checks !== null &&
    typeof checks === 'object' &&
    typeof checks.regenerations === 'number'
  ) {
    const regenerated = model.calls.filter(
      (call) => (call as { role?: unknown } | null)?.role === 'REGENERATE'
    ).length;
    if (regenerated !== checks.regenerations) {
      issues.add(
        'checks.regenerations',
        'INCONSISTENT',
        `${checks.regenerations} regeneration(s) counted and ${regenerated} regeneration call(s) recorded`
      );
    }
  }
  // a shape that is itself invalid has been reported already
  const shape = REPLY_SHAPES.find((candidate) => candidate === checks?.shape);
  if (
    shape !== undefined &&
    (outcome === 'REPORT1' || outcome === 'ANSWER') &&
    shape !== outcome
  ) {
    issues.add(
      'checks.shape',
      'INCONSISTENT',
      `a ${outcome} outcome was produced as a ${shape}`
    );
  }

  return finish(issues, () => record as unknown as ReplyTrace);
}
