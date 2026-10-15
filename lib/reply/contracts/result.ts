/**
 * `reply-result/1`: the ONE complete, checked result the server delivers (ADR-054, plan
 * decision D24). The stream shows progress while the reply is made and then this, whole:
 * a reply with a wrong number is never shown and then retracted.
 *
 * Four kinds:
 *  - `REPORT1`: the report of section 5.7, composed by the server from the model's
 *    `report1.v1` fields and engine data (see `REPORT1_SECTIONS`). Direction is copied from
 *    the synthesis reading;
 *  - `ANSWER`: a short answer (`answer.v1`) with its placeholders filled;
 *  - `FIXED_ANSWER`: the answer built from the sensor board when a model cannot or may not
 *    answer (data stopped, a second wording failure, both models down, the deadline). It
 *    carries no free-text sensor summary (D20): a direction word, a rule id, statuses,
 *    state codes and levels are the same in all 19 languages;
 *  - `ACTION`: no model ran; Section 6 opens the Trade Setup modal (REPORT_2).
 *
 * The text of a model's line arrives with its placeholders filled and its numbers
 * formatted for the locale; a number that could not be verified is already shown as the
 * "not verified" mark of that locale and counted in `checks.numbers_flagged`. Everything
 * else is structure: the disclaimer is a VERSION (the interface shows the fixed text for
 * its language), the stamp is data (the interface formats the time), so no translated
 * string is made twice.
 *
 * `validateReplyResult` is plain code: strict objects, bounded lists, every problem
 * reported with its path. Pure.
 *
 * @module lib/reply/contracts/result
 */

import {
  BIASES,
  BOARD_STATUSES,
  DATA_FLAGS,
  DATA_STATUSES,
  EVENTS_MAX_ITEMS,
  EVENTS_STATUSES,
  Issues,
  PACKET_INTENTS,
  THREAD_ID,
  TIMEFRAMES,
  TRADER_TYPES,
  TREND_RELATIONS,
  at,
  bool,
  exactObject,
  isLocale,
  join,
  list,
  num,
  oneOf,
  text,
} from './intake';
import type {
  Bias,
  BoardStatus,
  DataFlag,
  DataStatus,
  EventItem,
  EventsStatus,
  Locale,
  PacketIntent,
  Timeframe,
  TraderType,
  TrendRelation,
} from './intake';
import {
  INT_MAX,
  MCD,
  MODEL_SLUG,
  RULE_ID,
  STATE_CODE,
  codeList,
  idText,
  intIn,
  slotText,
  versionText,
} from './fields';
import { CITE_ID, MAX_ZONES, VALUE_ID, ZONE_ID, finish } from './shape';
import type { Validation } from './shape';
import { REPLY_RESULT_SCHEMA } from '../version';

export const RESULT_KINDS = [
  'REPORT1',
  'ANSWER',
  'FIXED_ANSWER',
  'ACTION',
] as const;
export type ResultKind = (typeof RESULT_KINDS)[number];

/** Why a fixed answer replaced a model's reply. */
export const FIXED_REASONS = [
  /** the data stopped: no direction, the stop time is the stamp (5.3) */
  'DATA_STALE',
  /** a second wording failure (5.9, decision D11) */
  'WORDING_FAILED',
  /** the schema was still wrong after the one retry */
  'SCHEMA_FAILED',
  /** the model and the fallback model both failed (7.6) */
  'MODEL_UNAVAILABLE',
  /** the request deadline passed (decision D23) */
  'DEADLINE',
  /**
   * The market is closed and the request needs a live cycle (Report 2, 5.3): the last session's
   * picture is shown, labelled by the stamp (build step 7 part 5).
   */
  'MARKET_CLOSED',
  /**
   * No synthesis reading exists for this cycle (it is not running, 4.4): there is no direction to
   * copy, so the board is shown and none is stated (build step 7 part 5).
   */
  'NO_SYNTHESIS',
] as const;
export type FixedReason = (typeof FIXED_REASONS)[number];

/**
 * What the reply must say about its own inputs, as codes the interface turns into words in the
 * reader's language (build step 7 part 5; 5.3: "a chart from another cycle is dropped and the
 * reply says the chart is missing"). The data status, the delay and the retuning already travel in
 * the stamp; the chart has no other home.
 */
export const RESULT_NOTES = [
  /**
   * a chart was available but it was drawn for another cycle (usually the one before): it was not
   * sent to the model, and the reader is told so
   */
  'CHART_OTHER_CYCLE',
  /** a chart was called for and none could be read (no image, no stamp, storage down) */
  'CHART_UNAVAILABLE',
] as const;
export type ResultNote = (typeof RESULT_NOTES)[number];

export const ARCHETYPES = ['A', 'B', 'C', 'D'] as const;
export const ZONE_BIASES = ['LONG', 'SHORT'] as const;
export const INVALIDATION_BASES = [
  'LEVEL',
  'MINIMUM_STOP',
  'NO_LEVEL',
] as const;
export const LEVEL_KINDS = ['CHANNEL', 'CONTEXT'] as const;
export const ACTION_TYPES = ['OPEN_TRADE_SETUP'] as const;

/** Bounds on what the server composes. */
export const RESULT_LIMITS = {
  /** a filled-in line: a 240-character template plus eight values */
  lineText: 480,
  headline: 400,
  alignmentLines: 6,
  /** the model's four lines plus one invalidation line the server adds for each of at most five zones */
  watchLines: 9,
  riskLines: 5,
  levels: 40,
  boardLines: 16,
  channels: 4,
  changes: 16,
  answerText: 1200,
  numbersFlagged: 200,
  eventName: 160,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction, copied from the synthesis reading for the trader's type. Never the model's. */
export interface DirectionLine {
  bias: Bias;
  trend_relation: TrendRelation | null;
  rule_id: string;
  archetype: (typeof ARCHETYPES)[number] | null;
  stand_aside: boolean;
  profile: TraderType;
}

export interface ChannelLine {
  mcd_id: string;
  timeframe: Timeframe;
  status: BoardStatus;
  state_code: string | null;
  bias: Bias | null;
}

export interface LevelLine {
  /** the id of the value in the dictionary: `MCD2.baseline` */
  id: string;
  kind: (typeof LEVEL_KINDS)[number];
  timeframe: Timeframe | null;
  /** the level's own name, never translated */
  name: string;
  price: number;
}

/** A stored entry zone as it was stored: the numbers are the engines'. */
export interface ComposedZone {
  zone_id: string;
  bias: (typeof ZONE_BIASES)[number];
  low: number;
  high: number;
  reference_price: number;
  invalidation_price: number;
  invalidation_basis: (typeof INVALIDATION_BASES)[number];
  stop_distance: number;
  next_opposing_price: number | null;
  runway: number | null;
  runway_ratio: number | null;
  source_sensors: string[];
  confluence_count: number;
}

/** A line of the model's, its placeholders filled. */
export interface ResolvedLine {
  text: string;
  cites: string[];
}

export interface NewsBlock {
  status: EventsStatus;
  calendar_age_seconds: number | null;
  items: EventItem[];
}

export interface ComposedReport1 {
  headline: string;
  direction: DirectionLine;
  alignment: {
    trend_relation: TrendRelation | null;
    channels: ChannelLine[];
    lines: ResolvedLine[];
  };
  levels: LevelLine[];
  zones: ComposedZone[];
  watch: ResolvedLine[];
  risks: ResolvedLine[];
  news: NewsBlock;
}

export interface DataStamp {
  /** the cycle slot the reply is about; null when no cycle could be read */
  as_of: string | null;
  data_status: DataStatus;
  retuning: boolean;
  flags: DataFlag[];
}

export interface TradeSetupAction {
  type: (typeof ACTION_TYPES)[number];
  cycle_slot: string;
  trader_type: TraderType;
  zone_ids: string[];
}

/** One sensor whose state changed between the last cycle of the thread and this one. */
export interface StateChange {
  mcd_id: string;
  from: string | null;
  to: string | null;
}

export interface FixedBoardLine {
  mcd_id: string;
  status: BoardStatus;
  state_code: string | null;
}

export interface ResultBase {
  schema: typeof REPLY_RESULT_SCHEMA;
  kind: ResultKind;
  thread_id: string;
  reply_locale: Locale;
  intent: PacketIntent;
  stamp: DataStamp;
  /** the version of the disclaimer text the interface shows (counsel reviews the text) */
  disclaimer_version: string;
  provenance: {
    request_id: string;
    model: string | null;
    prompt_version: string | null;
    reply_version: string;
  };
  checks: { numbers_flagged: number; regenerations: number };
  /** what moved since the thread's last cycle, built by code; empty on a first message */
  changes: StateChange[];
  /** what the reply says about its inputs (a chart that was dropped); codes, never text */
  notes: ResultNote[];
}

export interface Report1Result extends ResultBase {
  kind: 'REPORT1';
  report: ComposedReport1;
}

export interface AnswerResult extends ResultBase {
  kind: 'ANSWER';
  answer: { text: string; cites: string[] };
  action: TradeSetupAction | null;
}

export interface FixedAnswerResult extends ResultBase {
  kind: 'FIXED_ANSWER';
  fixed: {
    reason: FixedReason;
    /** null when the data stopped: there is no direction to state */
    direction: DirectionLine | null;
    board: FixedBoardLine[];
    levels: LevelLine[];
  };
}

export interface ActionResult extends ResultBase {
  kind: 'ACTION';
  action: TradeSetupAction;
}

export type ReplyResult =
  | Report1Result
  | AnswerResult
  | FixedAnswerResult
  | ActionResult;

export type ResultValidation = Validation<ReplyResult>;

// ---------------------------------------------------------------------------
// Checks (each reports at its path and returns nothing)
// ---------------------------------------------------------------------------

/** A text the server made: no controls, no bidirectional overrides, no tag characters, no brace left. */
const SERVER_TEXT_FORBIDDEN =
  /[\p{Cc}\u{2028}\u{2029}\u{202A}-\u{202E}\u{FEFF}\u{E0000}-\u{E007F}{}]/u;

function checkServerText(
  value: unknown,
  path: string,
  issues: Issues,
  max: number
): void {
  const checked = text(value, path, issues, { max });
  if (checked === undefined) return;
  if (checked.trim() === '') {
    issues.add(path, 'TOO_SHORT', 'must not be blank');
  } else if (SERVER_TEXT_FORBIDDEN.test(checked)) {
    issues.add(
      path,
      'BAD_FORMAT',
      'must be plain text with no control or override character and no unresolved placeholder'
    );
  }
}

const checkPrice = (value: unknown, path: string, issues: Issues): void => {
  num(value, path, issues, { min: 0 });
};

const checkPriceOrNull = (
  value: unknown,
  path: string,
  issues: Issues
): void => {
  if (value !== null) checkPrice(value, path, issues);
};

const checkSensorId = (value: unknown, path: string, issues: Issues): void => {
  text(value, path, issues, { pattern: MCD });
};

const checkStateCodeOrNull = (
  value: unknown,
  path: string,
  issues: Issues
): void => {
  if (value !== null) {
    text(value, path, issues, { pattern: STATE_CODE, max: 48 });
  }
};

const checkBiasOrNull = (
  value: unknown,
  path: string,
  issues: Issues
): void => {
  if (value !== null) oneOf(value, path, BIASES, issues);
};

const checkTrendOrNull = (
  value: unknown,
  path: string,
  issues: Issues
): void => {
  if (value !== null) oneOf(value, path, TREND_RELATIONS, issues);
};

/** Every item of a bounded list, at its path. */
function eachItem(
  value: unknown,
  path: string,
  issues: Issues,
  max: number,
  each: (item: unknown, here: string) => void,
  min = 0
): void {
  const items = list(value, path, issues, { max, min });
  items?.forEach((item, index) => each(item, at(path, index)));
}

function checkDirection(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    [
      'bias',
      'trend_relation',
      'rule_id',
      'archetype',
      'stand_aside',
      'profile',
    ],
    issues
  );
  if (r === undefined) return;
  oneOf(r['bias'], join(path, 'bias'), BIASES, issues);
  checkTrendOrNull(r['trend_relation'], join(path, 'trend_relation'), issues);
  text(r['rule_id'], join(path, 'rule_id'), issues, { pattern: RULE_ID });
  if (r['archetype'] !== null) {
    oneOf(r['archetype'], join(path, 'archetype'), ARCHETYPES, issues);
  }
  bool(r['stand_aside'], join(path, 'stand_aside'), issues);
  oneOf(r['profile'], join(path, 'profile'), TRADER_TYPES, issues);
}

function checkChannel(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    ['mcd_id', 'timeframe', 'status', 'state_code', 'bias'],
    issues
  );
  if (r === undefined) return;
  checkSensorId(r['mcd_id'], join(path, 'mcd_id'), issues);
  oneOf(r['timeframe'], join(path, 'timeframe'), TIMEFRAMES, issues);
  oneOf(r['status'], join(path, 'status'), BOARD_STATUSES, issues);
  checkStateCodeOrNull(r['state_code'], join(path, 'state_code'), issues);
  checkBiasOrNull(r['bias'], join(path, 'bias'), issues);
}

function checkLevel(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    ['id', 'kind', 'timeframe', 'name', 'price'],
    issues
  );
  if (r === undefined) return;
  text(r['id'], join(path, 'id'), issues, { pattern: VALUE_ID });
  oneOf(r['kind'], join(path, 'kind'), LEVEL_KINDS, issues);
  if (r['timeframe'] !== null) {
    oneOf(r['timeframe'], join(path, 'timeframe'), TIMEFRAMES, issues);
  }
  text(r['name'], join(path, 'name'), issues, {
    pattern: /^[A-Za-z0-9_]{1,40}$/,
  });
  checkPrice(r['price'], join(path, 'price'), issues);
}

function checkZone(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    [
      'zone_id',
      'bias',
      'low',
      'high',
      'reference_price',
      'invalidation_price',
      'invalidation_basis',
      'stop_distance',
      'next_opposing_price',
      'runway',
      'runway_ratio',
      'source_sensors',
      'confluence_count',
    ],
    issues
  );
  if (r === undefined) return;
  text(r['zone_id'], join(path, 'zone_id'), issues, { pattern: ZONE_ID });
  oneOf(r['bias'], join(path, 'bias'), ZONE_BIASES, issues);
  for (const key of [
    'low',
    'high',
    'reference_price',
    'invalidation_price',
    'stop_distance',
  ]) {
    checkPrice(r[key], join(path, key), issues);
  }
  if (
    typeof r['low'] === 'number' &&
    typeof r['high'] === 'number' &&
    r['low'] > r['high']
  ) {
    issues.add(
      join(path, 'low'),
      'INCONSISTENT',
      'the band starts above where it ends'
    );
  }
  oneOf(
    r['invalidation_basis'],
    join(path, 'invalidation_basis'),
    INVALIDATION_BASES,
    issues
  );
  for (const key of ['next_opposing_price', 'runway', 'runway_ratio']) {
    checkPriceOrNull(r[key], join(path, key), issues);
  }
  eachItem(
    r['source_sensors'],
    join(path, 'source_sensors'),
    issues,
    15,
    (item, here) => checkSensorId(item, here, issues)
  );
  intIn(r['confluence_count'], join(path, 'confluence_count'), issues, 64);
}

function checkLines(
  value: unknown,
  path: string,
  issues: Issues,
  max: number,
  min = 0
): void {
  eachItem(
    value,
    path,
    issues,
    max,
    (item, here) => {
      const r = exactObject(item, here, ['text', 'cites'], issues);
      if (r === undefined) return;
      checkServerText(
        r['text'],
        join(here, 'text'),
        issues,
        RESULT_LIMITS.lineText
      );
      codeList(r['cites'], join(here, 'cites'), issues, 4, CITE_ID);
    },
    min
  );
}

function checkNews(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    ['status', 'calendar_age_seconds', 'items'],
    issues
  );
  if (r === undefined) return;
  oneOf(r['status'], join(path, 'status'), EVENTS_STATUSES, issues);
  if (r['calendar_age_seconds'] !== null) {
    intIn(
      r['calendar_age_seconds'],
      join(path, 'calendar_age_seconds'),
      issues,
      INT_MAX
    );
  }
  eachItem(
    r['items'],
    join(path, 'items'),
    issues,
    EVENTS_MAX_ITEMS,
    (item, here) => {
      const e = exactObject(
        item,
        here,
        [
          'event_id',
          'name',
          'time',
          'currency',
          'importance',
          'approximate',
          'tier1',
        ],
        issues
      );
      if (e === undefined) return;
      text(e['event_id'], join(here, 'event_id'), issues, {
        pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/,
      });
      checkServerText(
        e['name'],
        join(here, 'name'),
        issues,
        RESULT_LIMITS.eventName
      );
      text(e['time'], join(here, 'time'), issues, {
        pattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/,
      });
      text(e['currency'], join(here, 'currency'), issues, {
        pattern: /^[A-Z]{2,5}$/,
      });
      text(e['importance'], join(here, 'importance'), issues, {
        pattern: /^[A-Za-z_]{1,20}$/,
      });
      bool(e['approximate'], join(here, 'approximate'), issues);
      bool(e['tier1'], join(here, 'tier1'), issues);
    }
  );
}

function checkReport(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    [
      'headline',
      'direction',
      'alignment',
      'levels',
      'zones',
      'watch',
      'risks',
      'news',
    ],
    issues
  );
  if (r === undefined) return;
  checkServerText(
    r['headline'],
    join(path, 'headline'),
    issues,
    RESULT_LIMITS.headline
  );
  checkDirection(r['direction'], join(path, 'direction'), issues);

  const alignPath = join(path, 'alignment');
  const a = exactObject(
    r['alignment'],
    alignPath,
    ['trend_relation', 'channels', 'lines'],
    issues
  );
  if (a !== undefined) {
    checkTrendOrNull(
      a['trend_relation'],
      join(alignPath, 'trend_relation'),
      issues
    );
    eachItem(
      a['channels'],
      join(alignPath, 'channels'),
      issues,
      RESULT_LIMITS.channels,
      (item, here) => checkChannel(item, here, issues)
    );
    checkLines(
      a['lines'],
      join(alignPath, 'lines'),
      issues,
      RESULT_LIMITS.alignmentLines
    );
  }

  eachItem(
    r['levels'],
    join(path, 'levels'),
    issues,
    RESULT_LIMITS.levels,
    (item, here) => checkLevel(item, here, issues)
  );
  const seen = new Set<string>();
  eachItem(r['zones'], join(path, 'zones'), issues, MAX_ZONES, (item, here) => {
    checkZone(item, here, issues);
    const id = (item as { zone_id?: unknown } | null)?.zone_id;
    if (typeof id === 'string') {
      if (seen.has(id)) issues.add(here, 'DUPLICATE', `${id} appears twice`);
      seen.add(id);
    }
  });
  checkLines(r['watch'], join(path, 'watch'), issues, RESULT_LIMITS.watchLines);
  checkLines(r['risks'], join(path, 'risks'), issues, RESULT_LIMITS.riskLines);
  checkNews(r['news'], join(path, 'news'), issues);
}

function checkAction(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    ['type', 'cycle_slot', 'trader_type', 'zone_ids'],
    issues
  );
  if (r === undefined) return;
  oneOf(r['type'], join(path, 'type'), ACTION_TYPES, issues);
  slotText(r['cycle_slot'], join(path, 'cycle_slot'), issues);
  oneOf(r['trader_type'], join(path, 'trader_type'), TRADER_TYPES, issues);
  codeList(r['zone_ids'], join(path, 'zone_ids'), issues, MAX_ZONES, ZONE_ID);
}

function checkStamp(value: unknown, path: string, issues: Issues): void {
  const r = exactObject(
    value,
    path,
    ['as_of', 'data_status', 'retuning', 'flags'],
    issues
  );
  if (r === undefined) return;
  if (r['as_of'] !== null) slotText(r['as_of'], join(path, 'as_of'), issues);
  oneOf(r['data_status'], join(path, 'data_status'), DATA_STATUSES, issues);
  bool(r['retuning'], join(path, 'retuning'), issues);
  codeList(r['flags'], join(path, 'flags'), issues, DATA_FLAGS.length)?.forEach(
    (flag, index) => {
      if (!(DATA_FLAGS as readonly string[]).includes(flag)) {
        issues.add(
          at(join(path, 'flags'), index),
          'NOT_ONE_OF',
          `must be one of ${DATA_FLAGS.join(', ')}`
        );
      }
    }
  );
}

function checkNotes(value: unknown, path: string, issues: Issues): void {
  codeList(value, path, issues, RESULT_NOTES.length)?.forEach((note, index) => {
    if (!(RESULT_NOTES as readonly string[]).includes(note)) {
      issues.add(
        at(path, index),
        'NOT_ONE_OF',
        `must be one of ${RESULT_NOTES.join(', ')}`
      );
    }
  });
}

/** The reasons for which a fixed answer states no direction (a stale cycle; no synthesis reading). */
const NO_DIRECTION_REASONS: readonly string[] = ['DATA_STALE', 'NO_SYNTHESIS'];

function checkFixed(value: unknown, path: string, issues: Issues): void {
  const f = exactObject(
    value,
    path,
    ['reason', 'direction', 'board', 'levels'],
    issues
  );
  if (f === undefined) return;
  oneOf(f['reason'], join(path, 'reason'), FIXED_REASONS, issues);
  if (f['direction'] !== null) {
    checkDirection(f['direction'], join(path, 'direction'), issues);
    if (
      typeof f['reason'] === 'string' &&
      NO_DIRECTION_REASONS.includes(f['reason'])
    ) {
      issues.add(
        join(path, 'direction'),
        'INCONSISTENT',
        f['reason'] === 'DATA_STALE'
          ? 'a stale cycle has no direction to state'
          : 'a cycle with no synthesis reading has no direction to state'
      );
    }
  }
  eachItem(
    f['board'],
    join(path, 'board'),
    issues,
    RESULT_LIMITS.boardLines,
    (item, here) => {
      const r = exactObject(
        item,
        here,
        ['mcd_id', 'status', 'state_code'],
        issues
      );
      if (r === undefined) return;
      checkSensorId(r['mcd_id'], join(here, 'mcd_id'), issues);
      oneOf(r['status'], join(here, 'status'), BOARD_STATUSES, issues);
      checkStateCodeOrNull(r['state_code'], join(here, 'state_code'), issues);
    }
  );
  eachItem(
    f['levels'],
    join(path, 'levels'),
    issues,
    RESULT_LIMITS.levels,
    (item, here) => checkLevel(item, here, issues)
  );
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

const BASE_KEYS = [
  'schema',
  'kind',
  'thread_id',
  'reply_locale',
  'intent',
  'stamp',
  'disclaimer_version',
  'provenance',
  'checks',
  'changes',
  'notes',
] as const;

const KIND_KEYS: Readonly<Record<ResultKind, readonly string[]>> = {
  REPORT1: ['report'],
  ANSWER: ['answer', 'action'],
  FIXED_ANSWER: ['fixed'],
  ACTION: ['action'],
};

export function validateReplyResult(value: unknown): ResultValidation {
  const issues = new Issues();
  const rawKind =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)['kind']
      : undefined;
  const kind = RESULT_KINDS.find((candidate) => candidate === rawKind);
  const record = exactObject(
    value,
    '',
    [...BASE_KEYS, ...(kind === undefined ? [] : KIND_KEYS[kind])],
    issues
  );
  if (record === undefined) return { ok: false, issues: issues.list };

  if (record['schema'] !== REPLY_RESULT_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${REPLY_RESULT_SCHEMA}`);
  }
  oneOf(record['kind'], 'kind', RESULT_KINDS, issues);
  text(record['thread_id'], 'thread_id', issues, { pattern: THREAD_ID });
  if (!isLocale(record['reply_locale'])) {
    issues.add('reply_locale', 'NOT_ONE_OF', 'must be one of the 19 locales');
  }
  oneOf(record['intent'], 'intent', PACKET_INTENTS, issues);
  checkStamp(record['stamp'], 'stamp', issues);
  versionText(record['disclaimer_version'], 'disclaimer_version', issues);

  const p = exactObject(
    record['provenance'],
    'provenance',
    ['request_id', 'model', 'prompt_version', 'reply_version'],
    issues
  );
  if (p !== undefined) {
    idText(p['request_id'], 'provenance.request_id', issues);
    if (p['model'] !== null) {
      text(p['model'], 'provenance.model', issues, { pattern: MODEL_SLUG });
    }
    if (p['prompt_version'] !== null) {
      versionText(p['prompt_version'], 'provenance.prompt_version', issues);
    }
    versionText(p['reply_version'], 'provenance.reply_version', issues);
  }

  const c = exactObject(
    record['checks'],
    'checks',
    ['numbers_flagged', 'regenerations'],
    issues
  );
  if (c !== undefined) {
    intIn(
      c['numbers_flagged'],
      'checks.numbers_flagged',
      issues,
      RESULT_LIMITS.numbersFlagged
    );
    intIn(c['regenerations'], 'checks.regenerations', issues, 1);
  }

  eachItem(
    record['changes'],
    'changes',
    issues,
    RESULT_LIMITS.changes,
    (item, here) => {
      const r = exactObject(item, here, ['mcd_id', 'from', 'to'], issues);
      if (r === undefined) return;
      checkSensorId(r['mcd_id'], join(here, 'mcd_id'), issues);
      checkStateCodeOrNull(r['from'], join(here, 'from'), issues);
      checkStateCodeOrNull(r['to'], join(here, 'to'), issues);
    }
  );
  checkNotes(record['notes'], 'notes', issues);

  switch (kind) {
    case 'REPORT1':
      checkReport(record['report'], 'report', issues);
      break;
    case 'ANSWER': {
      const a = exactObject(
        record['answer'],
        'answer',
        ['text', 'cites'],
        issues
      );
      if (a !== undefined) {
        checkServerText(
          a['text'],
          'answer.text',
          issues,
          RESULT_LIMITS.answerText
        );
        codeList(a['cites'], 'answer.cites', issues, 4, CITE_ID);
      }
      if (record['action'] !== null)
        checkAction(record['action'], 'action', issues);
      break;
    }
    case 'FIXED_ANSWER':
      checkFixed(record['fixed'], 'fixed', issues);
      break;
    case 'ACTION':
      checkAction(record['action'], 'action', issues);
      break;
    case undefined:
      break;
  }

  return finish(issues, () => record as unknown as ReplyResult);
}
