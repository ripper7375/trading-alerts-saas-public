/**
 * `intake-packet/1`: what the intake path hands to Section 5 (architecture 4.9; plan
 * decisions D9 and D2, findings F10 and F11).
 *
 * A packet is built only for a request that passed the gate, the door and the scope
 * check; everything else is an `intake-refusal/1`. The packet is the whole of what
 * Section 5 may use of the market and of the trader ("Section 5 does not reach back
 * into market tables or the index"): the question, the intent, the sensor board, the
 * readings of M* in full, the knowledge pack, the profile, the data status, the
 * upcoming events and the provenance (the trace). Its shape is JSON, snake_case, the
 * same as the sensors' own envelopes it carries verbatim.
 *
 * `validatePacket` is plain code (no `ajv`, assumption A4). It checks the SHAPE of every
 * field and then the rules that tie the fields to each other, so a packet that the
 * builder got subtly wrong cannot reach a prompt:
 *  - no key called `equity` or `commission` anywhere, at any depth (ADR-077, F11);
 *  - the board agrees with the readings in full (a board that says VALID over a STALE
 *    envelope is refused), the readings agree with the pinned cycle, and M* is a subset
 *    of the board;
 *  - the reply locale is the one rule D1 gives for the language and the interface;
 *  - the trace equals what the packet itself says.
 * `config/intake/intake-packet-1.schema.json` is the same contract for readers outside
 * TypeScript; it holds the shape and not the cross-field rules (a test lists which).
 *
 * @module lib/intake/packet
 */

import {
  Issues,
  at,
  bool,
  exactObject,
  isRecord,
  join,
  keysMatching,
  list,
  mcdIdsAscending,
  num,
  oneOf,
  sameList,
  text,
  type Issue,
} from './check';
import { canonicalJson, canonicalSha256 } from './canonical';
import {
  INSTANT_INTENTS,
  PACKET_INTENTS,
  isInstantIntent,
  type PacketIntent,
} from './intents';
import {
  UNDETERMINED,
  familyOfLocale,
  isDetectedLanguage,
  isLocale,
  replyLocale,
  type Locale,
} from './locales';
import {
  MCD_ID_PATTERN,
  SENSOR_ROSTER,
  TIMEFRAMES,
  TRADER_TYPES,
  sensorById,
  type Roster,
  type Timeframe,
  type TraderType,
} from './roster';
import { INTAKE_PACKET_SCHEMA } from './version';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PACKET_SYMBOL = 'XAUUSD';

/** The door (plan A5): about 300 tokens even for Chinese or Thai. Part 2's limits re-export it. */
export const QUESTION_MAX_CHARS = 500;
/** The English pivot may run longer than the original it translates. */
export const ENGLISH_MAX_CHARS = 1000;

/** Top 4 chunks (4.7), then the cross-referenced ones while the budget allows (5.4). */
export const KNOWLEDGE_MAX_CHUNKS = 4;
export const KNOWLEDGE_MAX_EXPANSIONS = 8;
export const KNOWLEDGE_CHUNK_MAX_CHARS = 4000;
export const KNOWLEDGE_DOMAINS = ['D1', 'D2', 'D3', 'D4', 'D5'] as const;
export const KNOWLEDGE_STATUSES = ['OK', 'EMPTY', 'UNAVAILABLE'] as const;

export const QUESTION_SOURCES = ['TYPED', 'INSTANT'] as const;

/** UNKNOWN: the gateway could not be asked, so the packet says so (finding F16). */
export const DATA_STATUSES = [
  'FRESH',
  'DELAYED',
  'STALE',
  'MARKET_CLOSED',
  'UNKNOWN',
] as const;
export const DATA_FLAGS = ['SENSORS_NOT_LIVE', 'GATEWAY_UNREACHABLE'] as const;

export const SENSOR_STATUSES = [
  'VALID',
  'CAUTIONARY',
  'INVALID',
  'STALE',
] as const;
/** A live sensor with no row for the slot is ABSENT: listed, never dropped (ADR-040). */
export const BOARD_STATUSES = [...SENSOR_STATUSES, 'ABSENT'] as const;
export const BIASES = ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'] as const;
export const TREND_RELATIONS = ['WITH_TREND', 'COUNTER_TREND'] as const;
export const SYN_STATES = ['RUNNING', 'NOT_RUNNING'] as const;

export const TRADING_STYLES = [
  'TREND_FOLLOWING',
  'TREND_COUNTERING',
  'BOTH',
] as const;

export const EVENTS_STATUSES = ['OK', 'LATE', 'UNAVAILABLE'] as const;
/** The News intent gets the whole upcoming list; every other intent the next 24 hours of HIGH impact (D9 (b)). */
export const EVENTS_SCOPES = ['UPCOMING_ALL', 'NEXT_24H_HIGH'] as const;
export const EVENTS_MAX_ITEMS = 50;

/** What a packet must never carry (ADR-077, 5.4): the equity balance and the commission. */
export const FORBIDDEN_PACKET_KEY = /equity|commission/i;

const SLOT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]Z$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
const TOKEN = /^[A-Z][A-Z0-9_]{0,39}$/;
const REASON = /^[A-Z0-9_]+(:[A-Z0-9_]+)?$/;
const STATE_CODE = /^MCD([0-9]|1[0-5])_[A-Z0-9_]+$/;
const RULE_ID = /^(R[0-9]+S?_[A-Z0-9_]+|NO_MATCH)$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const THREAD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const EVENT_TIME = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type TradingStyle = (typeof TRADING_STYLES)[number];
export type DataStatus = (typeof DATA_STATUSES)[number];
export type DataFlag = (typeof DATA_FLAGS)[number];
export type SensorStatus = (typeof SENSOR_STATUSES)[number];
export type BoardStatus = (typeof BOARD_STATUSES)[number];
export type Bias = (typeof BIASES)[number];
export type TrendRelation = (typeof TREND_RELATIONS)[number];
export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];
export type QuestionSource = (typeof QUESTION_SOURCES)[number];
export type EventsStatus = (typeof EVENTS_STATUSES)[number];
export type EventsScope = (typeof EVENTS_SCOPES)[number];

export interface PacketQuestion {
  source: QuestionSource;
  /** the trader's text; null for an instant prompt, which has none */
  original: string | null;
  /** the English pivot (typed), or the fixed English question of the label (instant) */
  english: string;
  /** a language of the 17, or `und`; for an instant prompt the interface's own */
  language: string;
  interface_locale: Locale;
  /** the locale the answer is written in: decision D1 */
  reply_locale: Locale;
  /** signals of the understanding step (`TERM_DROPPED` ...): for the trace, never a refusal */
  flags: string[];
}

/** The six fields of the profile a prompt may see. Never the equity, never the commission. */
export interface PacketProfile {
  trader_type: TraderType;
  style: TradingStyle;
  max_risk_pct: string;
  max_leverage: string;
  target_rrr: string;
  min_sld: string;
}

export interface LastPrice {
  /** the close of the last closed M5 bar of the stored reading (decision D8) */
  price: number;
  timeframe: 'M5';
  /** the slot of that bar */
  bar: string;
}

export interface PacketData {
  status: DataStatus;
  retuning: boolean;
  /** the cycle the packet is pinned to; null when none could be read */
  cycle_slot: string | null;
  last_price: LastPrice | null;
  flags: DataFlag[];
}

export interface BoardSynLine {
  state: (typeof SYN_STATES)[number];
  status: SensorStatus | null;
  rule_id: string | null;
  bias: Bias | null;
  trend_relation: TrendRelation | null;
  summary: string;
}

export interface BoardSensorLine {
  mcd_id: string;
  status: BoardStatus;
  state_code: string | null;
  bias: Bias | null;
  summary: string | null;
  reasons: string[];
}

export interface Board {
  syn: BoardSynLine;
  /** one line per live sensor, unavailable ones included, in id order; empty when none is live (D7) */
  sensors: BoardSensorLine[];
}

/** A sensor's envelope (`mcd-output/1`), carried as the worker stored it, and its hash. */
export interface SensorReading {
  mcd_id: string;
  envelope_sha256: string;
  envelope: Record<string, unknown>;
}

export interface SynthesisEntry {
  profile: TraderType;
  reading_sha256: string;
  /** `syn-output/1` */
  reading: Record<string, unknown>;
  /** the hash the worker stored for the zones document, which an empty list has too */
  zones_sha256: string;
  /** why there are no zones (`NO_ZONE_SOURCES`, `NOT_DIRECTIONAL` ...); null exactly when there are some */
  zones_reason: string | null;
  /** the stored zones of the reading, in rank order */
  zones: Record<string, unknown>[];
}

export interface Readings {
  /** the sensors given in full, in id order */
  m_star: string[];
  sensors: SensorReading[];
  synthesis: SynthesisEntry | null;
}

export interface KnowledgeChunk {
  id: string;
  domain: KnowledgeDomain;
  mcd_id: string | null;
  state_codes: string[];
  timeframe: Timeframe | null;
  version: string;
  text: string;
}

export interface Knowledge {
  status: KnowledgeStatus;
  index_build_id: string | null;
  chunks: KnowledgeChunk[];
  expansions: KnowledgeChunk[];
}

export interface EventItem {
  event_id: string;
  name: string;
  /** UTC, to the second */
  time: string;
  currency: string;
  importance: string;
  approximate: boolean;
  tier1: boolean;
}

export interface PacketEvents {
  /** an unavailable calendar is said aloud, never read as "no news" (5.3) */
  status: EventsStatus;
  /** age of the newest observation of the calendar, in seconds; null when unknown */
  calendar_age_seconds: number | null;
  scope: EventsScope;
  items: EventItem[];
}

/**
 * The provenance of the packet (architecture 4.9, last row; section 7.4). Everything in
 * it except the two versions is DERIVED from the rest of the packet (`deriveTrace`), and
 * the validator refuses a trace that says otherwise. The route's own trace adds the
 * request id, the stage times and `packet_sha256`.
 */
export interface PacketTrace {
  language: string;
  reply_locale: Locale;
  intent: PacketIntent;
  m_star: string[];
  /** the ids of the chunks, then of the expansions */
  chunk_ids: string[];
  index_build_id: string | null;
  cycle_slot: string | null;
  data_status: DataStatus;
  sensor_statuses: Record<string, BoardStatus>;
  synthesis_rule: string | null;
  intake_version: string;
  routing_version: string;
}

export interface IntakePacket {
  schema: typeof INTAKE_PACKET_SCHEMA;
  symbol: typeof PACKET_SYMBOL;
  /** the chat thread, when the chat exists (decision D6) */
  thread_id: string | null;
  question: PacketQuestion;
  intent: PacketIntent;
  profile: PacketProfile;
  data: PacketData;
  board: Board;
  readings: Readings;
  /** null for Report 2 (D9 (d)); `status: UNAVAILABLE` when the index could not be asked */
  knowledge: Knowledge | null;
  events: PacketEvents;
  trace: PacketTrace;
}

export type PacketBody = Omit<IntakePacket, 'trace'>;

export type PacketValidation =
  | { ok: true; packet: IntakePacket }
  | { ok: false; issues: Issue[] };

export interface ValidateOptions {
  /** the sensors that exist; the committed roster unless a test draws up another */
  roster?: Roster;
}

export interface TraceVersions {
  intake: string;
  routing: string;
}

// ---------------------------------------------------------------------------
// The trace
// ---------------------------------------------------------------------------

/** The ids of the chunks then the expansions of a knowledge pack. */
export function chunkIdsOf(knowledge: Knowledge | null): string[] {
  return knowledge === null
    ? []
    : [...knowledge.chunks, ...knowledge.expansions].map((chunk) => chunk.id);
}

/** What the packet says about itself, in the form of section 7.4's request group. */
export function deriveTrace(
  packet: PacketBody,
  versions: TraceVersions
): PacketTrace {
  const sensorStatuses: Record<string, BoardStatus> = {};
  for (const line of packet.board.sensors) {
    sensorStatuses[line.mcd_id] = line.status;
  }
  return {
    language: packet.question.language,
    reply_locale: packet.question.reply_locale,
    intent: packet.intent,
    m_star: [...packet.readings.m_star],
    chunk_ids: chunkIdsOf(packet.knowledge),
    index_build_id: packet.knowledge?.index_build_id ?? null,
    cycle_slot: packet.data.cycle_slot,
    data_status: packet.data.status,
    sensor_statuses: sensorStatuses,
    synthesis_rule: packet.board.syn.rule_id,
    intake_version: versions.intake,
    routing_version: versions.routing,
  };
}

/** The paths of every key called like the equity or the commission, at any depth. */
export function forbiddenKeyPaths(value: unknown): string[] {
  return keysMatching(value, FORBIDDEN_PACKET_KEY);
}

/**
 * The fingerprint of a whole packet (decision D9 (e)): the SHA-256 of its canonical text,
 * trace included. The route's trace carries it next to the request id and the stage times;
 * it cannot be a field of the packet, which it is the hash of.
 */
export function packetSha256(packet: IntakePacket): Promise<string> {
  return canonicalSha256(packet);
}

// ---------------------------------------------------------------------------
// The sections
// ---------------------------------------------------------------------------

function cycleSlot(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  return text(value, path, issues, { pattern: SLOT });
}

/** `null` when the value is null; otherwise whatever `check` makes of it. */
function nullable<T>(
  value: unknown,
  check: (present: unknown) => T | undefined
): T | null | undefined {
  return value === null ? null : check(value);
}

function checkQuestion(
  value: unknown,
  intent: PacketIntent | undefined,
  issues: Issues
): void {
  const path = 'question';
  const record = exactObject(
    value,
    path,
    [
      'source',
      'original',
      'english',
      'language',
      'interface_locale',
      'reply_locale',
      'flags',
    ],
    issues
  );
  if (record === undefined) return;

  const source = oneOf(
    record['source'],
    join(path, 'source'),
    QUESTION_SOURCES,
    issues
  );
  text(record['english'], join(path, 'english'), issues, {
    max: ENGLISH_MAX_CHARS,
  });
  const languageOk = isDetectedLanguage(record['language']);
  if (!languageOk) {
    issues.add(
      join(path, 'language'),
      'NOT_ONE_OF',
      `must be one of the 17 languages or ${UNDETERMINED}`
    );
  }
  const interfaceOk = isLocale(record['interface_locale']);
  if (!interfaceOk) {
    issues.add(
      join(path, 'interface_locale'),
      'NOT_ONE_OF',
      'must be one of the 19 locales'
    );
  }
  const replyOk = isLocale(record['reply_locale']);
  if (!replyOk) {
    issues.add(
      join(path, 'reply_locale'),
      'NOT_ONE_OF',
      'must be one of the 19 locales'
    );
  }

  const flags = list(record['flags'], join(path, 'flags'), issues, { max: 8 });
  const seen = new Set<string>();
  flags?.forEach((flag, index) => {
    const found = text(flag, at(join(path, 'flags'), index), issues, {
      pattern: TOKEN,
    });
    if (found === undefined) return;
    if (seen.has(found)) {
      issues.add(at(join(path, 'flags'), index), 'DUPLICATE', `${found} twice`);
    }
    seen.add(found);
  });

  if (source === 'TYPED') {
    text(record['original'], join(path, 'original'), issues, {
      max: QUESTION_MAX_CHARS,
    });
    if (intent !== undefined && isInstantIntent(intent)) {
      issues.add(
        'intent',
        'INCONSISTENT',
        'a typed question cannot carry an instant-prompt label'
      );
    }
  } else if (source === 'INSTANT') {
    if (record['original'] !== null) {
      issues.add(
        join(path, 'original'),
        'INCONSISTENT',
        'an instant prompt has no typed text'
      );
    }
    if (intent !== undefined && !isInstantIntent(intent)) {
      issues.add(
        'intent',
        'INCONSISTENT',
        `an instant prompt carries ${INSTANT_INTENTS.join(' or ')}`
      );
    }
    if (
      interfaceOk &&
      languageOk &&
      record['language'] !==
        familyOfLocale(record['interface_locale'] as string)
    ) {
      issues.add(
        join(path, 'language'),
        'INCONSISTENT',
        'an instant prompt is in the language of the interface setting'
      );
    }
  }

  if (
    interfaceOk &&
    languageOk &&
    replyOk &&
    record['reply_locale'] !==
      replyLocale(
        record['language'] as string,
        record['interface_locale'] as string
      )
  ) {
    issues.add(
      join(path, 'reply_locale'),
      'INCONSISTENT',
      'is not the locale rule D1 gives for this language and interface'
    );
  }
}

function checkProfile(value: unknown, issues: Issues): TraderType | undefined {
  const path = 'profile';
  const record = exactObject(
    value,
    path,
    [
      'trader_type',
      'style',
      'max_risk_pct',
      'max_leverage',
      'target_rrr',
      'min_sld',
    ],
    issues
  );
  if (record === undefined) return undefined;
  const traderType = oneOf(
    record['trader_type'],
    join(path, 'trader_type'),
    TRADER_TYPES,
    issues
  );
  oneOf(record['style'], join(path, 'style'), TRADING_STYLES, issues);
  for (const key of [
    'max_risk_pct',
    'max_leverage',
    'target_rrr',
    'min_sld',
  ] as const) {
    text(record[key], join(path, key), issues, { pattern: DECIMAL, max: 20 });
  }
  return traderType;
}

interface DataView {
  status: DataStatus | undefined;
  slot: string | null | undefined;
}

function checkData(value: unknown, issues: Issues): DataView {
  const path = 'data';
  const record = exactObject(
    value,
    path,
    ['status', 'retuning', 'cycle_slot', 'last_price', 'flags'],
    issues
  );
  if (record === undefined) return { status: undefined, slot: undefined };

  const status = oneOf(
    record['status'],
    join(path, 'status'),
    DATA_STATUSES,
    issues
  );
  bool(record['retuning'], join(path, 'retuning'), issues);
  const slot = nullable(record['cycle_slot'], (present) =>
    cycleSlot(present, join(path, 'cycle_slot'), issues)
  );

  nullable(record['last_price'], (present) => {
    const price = exactObject(
      present,
      join(path, 'last_price'),
      ['price', 'timeframe', 'bar'],
      issues
    );
    if (price === undefined) return undefined;
    num(price['price'], join(path, 'last_price.price'), issues, { min: 0.01 });
    if (price['timeframe'] !== 'M5') {
      issues.add(
        join(path, 'last_price.timeframe'),
        'NOT_ONE_OF',
        'must be M5'
      );
    }
    cycleSlot(price['bar'], join(path, 'last_price.bar'), issues);
    return true;
  });

  const flags = list(record['flags'], join(path, 'flags'), issues, {
    max: DATA_FLAGS.length,
  });
  const found: DataFlag[] = [];
  flags?.forEach((flag, index) => {
    const checked = oneOf(
      flag,
      at(join(path, 'flags'), index),
      DATA_FLAGS,
      issues
    );
    if (checked === undefined) return;
    if (found.includes(checked)) {
      issues.add(
        at(join(path, 'flags'), index),
        'DUPLICATE',
        `${checked} twice`
      );
    }
    found.push(checked);
  });
  if (
    status !== undefined &&
    flags !== undefined &&
    (status === 'UNKNOWN') !== found.includes('GATEWAY_UNREACHABLE')
  ) {
    issues.add(
      join(path, 'flags'),
      'INCONSISTENT',
      'GATEWAY_UNREACHABLE is there exactly when the status is UNKNOWN'
    );
  }
  return { status, slot };
}

interface BoardView {
  lines: Map<string, BoardSensorLine>;
  syn: BoardSynLine | undefined;
  ok: boolean;
}

function checkBoard(value: unknown, roster: Roster, issues: Issues): BoardView {
  const path = 'board';
  const view: BoardView = { lines: new Map(), syn: undefined, ok: false };
  const before = issues.list.length;
  const record = exactObject(value, path, ['syn', 'sensors'], issues);
  if (record === undefined) return view;

  const synPath = join(path, 'syn');
  const syn = exactObject(
    record['syn'],
    synPath,
    ['state', 'status', 'rule_id', 'bias', 'trend_relation', 'summary'],
    issues
  );
  if (syn !== undefined) {
    const state = oneOf(
      syn['state'],
      join(synPath, 'state'),
      SYN_STATES,
      issues
    );
    text(syn['summary'], join(synPath, 'summary'), issues, { max: 120 });
    if (state === 'RUNNING') {
      oneOf(syn['status'], join(synPath, 'status'), SENSOR_STATUSES, issues);
      text(syn['rule_id'], join(synPath, 'rule_id'), issues, {
        pattern: RULE_ID,
        max: 60,
      });
      oneOf(syn['bias'], join(synPath, 'bias'), BIASES, issues);
      nullable(syn['trend_relation'], (present) =>
        oneOf(present, join(synPath, 'trend_relation'), TREND_RELATIONS, issues)
      );
    } else if (state === 'NOT_RUNNING') {
      for (const key of ['status', 'rule_id', 'bias', 'trend_relation']) {
        if (syn[key] !== null) {
          issues.add(
            join(synPath, key),
            'INCONSISTENT',
            'is null while the synthesis is not running'
          );
        }
      }
    }
    view.syn = syn as unknown as BoardSynLine;
  }

  const sensorsPath = join(path, 'sensors');
  const sensors = list(record['sensors'], sensorsPath, issues, { max: 15 });
  const ids: string[] = [];
  sensors?.forEach((raw, index) => {
    const where = at(sensorsPath, index);
    const line = exactObject(
      raw,
      where,
      ['mcd_id', 'status', 'state_code', 'bias', 'summary', 'reasons'],
      issues
    );
    if (line === undefined) return;
    const id = text(line['mcd_id'], join(where, 'mcd_id'), issues, {
      pattern: MCD_ID_PATTERN,
    });
    const known = id === undefined ? undefined : sensorById(id, roster);
    if (id !== undefined) {
      ids.push(id);
      if (known === undefined || !known.on_board) {
        issues.add(
          join(where, 'mcd_id'),
          'NOT_ONE_OF',
          'is not a sensor of the roster that has a line on the board'
        );
      }
    }
    const status = oneOf(
      line['status'],
      join(where, 'status'),
      BOARD_STATUSES,
      issues
    );
    const reasons = list(line['reasons'], join(where, 'reasons'), issues, {
      max: 12,
    });
    reasons?.forEach((reason, i) =>
      text(reason, at(join(where, 'reasons'), i), issues, {
        pattern: REASON,
        max: 60,
      })
    );
    if (status === undefined) return;

    const available = status === 'VALID' || status === 'CAUTIONARY';
    if (available) {
      const code = text(line['state_code'], join(where, 'state_code'), issues, {
        pattern: STATE_CODE,
        max: 48,
      });
      if (
        code !== undefined &&
        known !== undefined &&
        !known.state_codes.includes(code)
      ) {
        issues.add(
          join(where, 'state_code'),
          'NOT_ONE_OF',
          `is not a state of ${known.mcd_id}`
        );
      }
      oneOf(line['bias'], join(where, 'bias'), BIASES, issues);
      text(line['summary'], join(where, 'summary'), issues, { max: 80 });
    } else {
      for (const key of ['state_code', 'bias']) {
        if (line[key] !== null) {
          issues.add(
            join(where, key),
            'INCONSISTENT',
            `is null for a sensor that is ${status}`
          );
        }
      }
      if (status === 'ABSENT') {
        if (line['summary'] !== null) {
          issues.add(
            join(where, 'summary'),
            'INCONSISTENT',
            'is null for an absent sensor'
          );
        }
      } else {
        nullable(line['summary'], (present) =>
          text(present, join(where, 'summary'), issues, { max: 80 })
        );
      }
    }
    if (status !== 'VALID' && status !== 'ABSENT' && reasons?.length === 0) {
      issues.add(
        join(where, 'reasons'),
        'TOO_SHORT',
        `a ${status} sensor says why`
      );
    }
    if (id !== undefined)
      view.lines.set(id, line as unknown as BoardSensorLine);
  });
  mcdIdsAscending(ids, sensorsPath, issues);

  view.ok = issues.list.length === before;
  return view;
}

function checkEnvelope(
  envelope: unknown,
  path: string,
  id: string,
  line: BoardSensorLine | undefined,
  slot: string | null | undefined,
  issues: Issues
): void {
  if (!isRecord(envelope)) {
    issues.add(path, 'WRONG_TYPE', 'must be an object');
    return;
  }
  if (envelope['schema_version'] !== 'mcd-output/1') {
    issues.add(
      join(path, 'schema_version'),
      'NOT_ONE_OF',
      'must be mcd-output/1'
    );
  }
  if (envelope['mcd_id'] !== id) {
    issues.add(join(path, 'mcd_id'), 'INCONSISTENT', `must be ${id}`);
  }
  if (slot !== undefined && slot !== null && envelope['cycle_slot'] !== slot) {
    issues.add(
      join(path, 'cycle_slot'),
      'INCONSISTENT',
      'is not the cycle the packet is pinned to'
    );
  }
  if (line === undefined) return;
  if (line.status === 'ABSENT') {
    issues.add(
      path,
      'INCONSISTENT',
      'an absent sensor has no reading to give in full'
    );
    return;
  }
  for (const key of ['status', 'state_code', 'bias'] as const) {
    if (envelope[key] !== line[key]) {
      issues.add(
        join(path, key),
        'INCONSISTENT',
        'differs from the board line of the same sensor'
      );
    }
  }
  if (line.summary !== null && envelope['summary_line'] !== line.summary) {
    issues.add(
      join(path, 'summary_line'),
      'INCONSISTENT',
      'differs from the board line of the same sensor'
    );
  }
}

function checkSynthesis(
  value: unknown,
  path: string,
  traderType: TraderType | undefined,
  board: BoardView,
  slot: string | null | undefined,
  issues: Issues
): void {
  const record = exactObject(
    value,
    path,
    [
      'profile',
      'reading_sha256',
      'reading',
      'zones_sha256',
      'zones_reason',
      'zones',
    ],
    issues
  );
  if (record === undefined) return;
  const profile = oneOf(
    record['profile'],
    join(path, 'profile'),
    TRADER_TYPES,
    issues
  );
  if (
    profile !== undefined &&
    traderType !== undefined &&
    profile !== traderType
  ) {
    issues.add(
      join(path, 'profile'),
      'INCONSISTENT',
      "is not the trader's type"
    );
  }
  text(record['reading_sha256'], join(path, 'reading_sha256'), issues, {
    pattern: SHA256,
  });

  const readingPath = join(path, 'reading');
  const reading = record['reading'];
  if (!isRecord(reading)) {
    issues.add(readingPath, 'WRONG_TYPE', 'must be an object');
  } else {
    if (reading['schema_version'] !== 'syn-output/1') {
      issues.add(
        join(readingPath, 'schema_version'),
        'NOT_ONE_OF',
        'must be syn-output/1'
      );
    }
    if (reading['mcd_id'] !== 'SYN') {
      issues.add(join(readingPath, 'mcd_id'), 'NOT_ONE_OF', 'must be SYN');
    }
    if (traderType !== undefined && reading['profile'] !== traderType) {
      issues.add(
        join(readingPath, 'profile'),
        'INCONSISTENT',
        "is not the trader's type"
      );
    }
    if (slot !== undefined && slot !== null && reading['cycle_slot'] !== slot) {
      issues.add(
        join(readingPath, 'cycle_slot'),
        'INCONSISTENT',
        'is not the cycle the packet is pinned to'
      );
    }
    const syn = board.syn;
    if (syn !== undefined) {
      if (syn.state === 'NOT_RUNNING') {
        issues.add(
          'board.syn.state',
          'INCONSISTENT',
          'the synthesis reading is given, so the board says it is running'
        );
      }
      for (const [key, line] of [
        ['status', syn.status],
        ['rule_id', syn.rule_id],
        ['bias', syn.bias],
        ['trend_relation', syn.trend_relation],
      ] as const) {
        if (reading[key] !== line) {
          issues.add(
            join(readingPath, key),
            'INCONSISTENT',
            'differs from the SYN line of the board'
          );
        }
      }
    }
  }

  const zonesPath = join(path, 'zones');
  const zones = list(record['zones'], zonesPath, issues, { max: 5 });
  const ids: unknown[] = [];
  zones?.forEach((zone, index) => {
    const where = at(zonesPath, index);
    if (!isRecord(zone)) {
      issues.add(where, 'WRONG_TYPE', 'must be an object');
      return;
    }
    const id = text(zone['zone_id'], join(where, 'zone_id'), issues, {
      pattern: /^Z[1-5]$/,
    });
    if (id !== undefined) {
      if (ids.includes(id)) issues.add(where, 'DUPLICATE', `${id} twice`);
      ids.push(id);
    }
    if (slot !== undefined && slot !== null && zone['cycle_slot'] !== slot) {
      issues.add(
        join(where, 'cycle_slot'),
        'INCONSISTENT',
        'is not the cycle the packet is pinned to'
      );
    }
    if (traderType !== undefined && zone['profile'] !== traderType) {
      issues.add(
        join(where, 'profile'),
        'INCONSISTENT',
        "is not the trader's type"
      );
    }
  });
  if (
    zones !== undefined &&
    isRecord(reading) &&
    Array.isArray(reading['zones']) &&
    !sameList(reading['zones'], ids)
  ) {
    issues.add(
      zonesPath,
      'INCONSISTENT',
      'must be the zones the reading names, in the same order'
    );
  }
  text(record['zones_sha256'], join(path, 'zones_sha256'), issues, {
    pattern: SHA256,
  });
  const reason = nullable(record['zones_reason'], (present) =>
    text(present, join(path, 'zones_reason'), issues, { pattern: TOKEN })
  );
  if (zones !== undefined && reason !== undefined) {
    if ((zones.length === 0) !== (reason !== null)) {
      issues.add(
        join(path, 'zones_reason'),
        'INCONSISTENT',
        'is set exactly when the reading has no zones'
      );
    }
  }
}

function checkReadings(
  value: unknown,
  intent: PacketIntent | undefined,
  traderType: TraderType | undefined,
  data: DataView,
  board: BoardView,
  issues: Issues
): void {
  const path = 'readings';
  const record = exactObject(
    value,
    path,
    ['m_star', 'sensors', 'synthesis'],
    issues
  );
  if (record === undefined) return;

  const starPath = join(path, 'm_star');
  const star = list(record['m_star'], starPath, issues, { max: 15 });
  const starIds: string[] = [];
  star?.forEach((id, index) => {
    const found = text(id, at(starPath, index), issues, {
      pattern: MCD_ID_PATTERN,
    });
    if (found === undefined) return;
    starIds.push(found);
    if (board.ok && !board.lines.has(found)) {
      issues.add(
        at(starPath, index),
        'INCONSISTENT',
        'M* names a sensor that has no line on the board'
      );
    }
  });
  mcdIdsAscending(starIds, starPath, issues);

  const sensorsPath = join(path, 'sensors');
  const sensors = list(record['sensors'], sensorsPath, issues, { max: 15 });
  const readIds: string[] = [];
  sensors?.forEach((raw, index) => {
    const where = at(sensorsPath, index);
    const reading = exactObject(
      raw,
      where,
      ['mcd_id', 'envelope_sha256', 'envelope'],
      issues
    );
    if (reading === undefined) return;
    const id = text(reading['mcd_id'], join(where, 'mcd_id'), issues, {
      pattern: MCD_ID_PATTERN,
    });
    text(reading['envelope_sha256'], join(where, 'envelope_sha256'), issues, {
      pattern: SHA256,
    });
    if (id !== undefined) {
      readIds.push(id);
      checkEnvelope(
        reading['envelope'],
        join(where, 'envelope'),
        id,
        board.lines.get(id),
        data.slot,
        issues
      );
    } else if (!isRecord(reading['envelope'])) {
      issues.add(join(where, 'envelope'), 'WRONG_TYPE', 'must be an object');
    }
  });
  if (
    star !== undefined &&
    sensors !== undefined &&
    !sameList(readIds, starIds)
  ) {
    issues.add(
      sensorsPath,
      'INCONSISTENT',
      'must hold exactly the sensors of M*, in the same order'
    );
  }

  const synthesis = record['synthesis'];
  if (synthesis !== null) {
    checkSynthesis(
      synthesis,
      join(path, 'synthesis'),
      traderType,
      board,
      data.slot,
      issues
    );
  }

  if (intent === 'REPORT_2') {
    if (
      starIds.length > 0 ||
      (sensors?.length ?? 0) > 0 ||
      synthesis !== null
    ) {
      issues.add(
        path,
        'INCONSISTENT',
        'Report 2 carries no readings: Section 6 reads the pinned cycle by id'
      );
    }
  }
  if (data.slot === null && (starIds.length > 0 || synthesis !== null)) {
    issues.add(path, 'INCONSISTENT', 'readings need a cycle to be pinned to');
  }
}

function checkChunk(
  value: unknown,
  path: string,
  issues: Issues
): string | undefined {
  const record = exactObject(
    value,
    path,
    ['id', 'domain', 'mcd_id', 'state_codes', 'timeframe', 'version', 'text'],
    issues
  );
  if (record === undefined) return undefined;
  const id = text(record['id'], join(path, 'id'), issues, { pattern: ID });
  oneOf(record['domain'], join(path, 'domain'), KNOWLEDGE_DOMAINS, issues);
  nullable(record['mcd_id'], (present) =>
    text(present, join(path, 'mcd_id'), issues, { pattern: MCD_ID_PATTERN })
  );
  const codes = list(record['state_codes'], join(path, 'state_codes'), issues, {
    max: 16,
  });
  codes?.forEach((code, index) =>
    text(code, at(join(path, 'state_codes'), index), issues, {
      pattern: STATE_CODE,
      max: 48,
    })
  );
  nullable(record['timeframe'], (present) =>
    oneOf(present, join(path, 'timeframe'), TIMEFRAMES, issues)
  );
  text(record['version'], join(path, 'version'), issues, { pattern: VERSION });
  text(record['text'], join(path, 'text'), issues, {
    max: KNOWLEDGE_CHUNK_MAX_CHARS,
  });
  return id;
}

function checkKnowledge(
  value: unknown,
  intent: PacketIntent | undefined,
  issues: Issues
): void {
  const path = 'knowledge';
  if (intent === 'REPORT_2') {
    if (value !== null) {
      issues.add(
        path,
        'INCONSISTENT',
        'Report 2 has no knowledge pack (D9 (d))'
      );
    }
    return;
  }
  if (value === null) {
    if (intent !== undefined) {
      issues.add(
        path,
        'REQUIRED',
        'every intent but Report 2 has a knowledge pack, even an UNAVAILABLE one'
      );
    }
    return;
  }
  const record = exactObject(
    value,
    path,
    ['status', 'index_build_id', 'chunks', 'expansions'],
    issues
  );
  if (record === undefined) return;
  const status = oneOf(
    record['status'],
    join(path, 'status'),
    KNOWLEDGE_STATUSES,
    issues
  );
  const build = nullable(record['index_build_id'], (present) =>
    text(present, join(path, 'index_build_id'), issues, { pattern: VERSION })
  );

  const chunksPath = join(path, 'chunks');
  const chunks = list(record['chunks'], chunksPath, issues, {
    max: KNOWLEDGE_MAX_CHUNKS,
  });
  const expansionsPath = join(path, 'expansions');
  const expansions = list(record['expansions'], expansionsPath, issues, {
    max: KNOWLEDGE_MAX_EXPANSIONS,
  });
  const ids: string[] = [];
  const collect = (items: unknown[] | undefined, where: string): void =>
    items?.forEach((item, index) => {
      const id = checkChunk(item, at(where, index), issues);
      if (id === undefined) return;
      if (ids.includes(id)) {
        issues.add(at(where, index), 'DUPLICATE', `${id} twice`);
      }
      ids.push(id);
    });
  collect(chunks, chunksPath);
  collect(expansions, expansionsPath);

  if (status === undefined) return;
  if (status === 'OK') {
    if (build === null) {
      issues.add(
        join(path, 'index_build_id'),
        'REQUIRED',
        'an answer from the index names the build'
      );
    }
    if (chunks !== undefined && chunks.length === 0) {
      issues.add(chunksPath, 'TOO_SHORT', 'OK means at least one chunk');
    }
  } else {
    if ((chunks?.length ?? 0) > 0 || (expansions?.length ?? 0) > 0) {
      issues.add(path, 'INCONSISTENT', `${status} carries no chunk`);
    }
    if (status === 'UNAVAILABLE' && build !== null) {
      issues.add(
        join(path, 'index_build_id'),
        'INCONSISTENT',
        'an index that could not be asked names no build'
      );
    }
    if (status === 'EMPTY' && build === null) {
      issues.add(
        join(path, 'index_build_id'),
        'REQUIRED',
        'an index that answered with nothing still names its build'
      );
    }
  }
}

function checkEvents(
  value: unknown,
  intent: PacketIntent | undefined,
  issues: Issues
): void {
  const path = 'events';
  const record = exactObject(
    value,
    path,
    ['status', 'calendar_age_seconds', 'scope', 'items'],
    issues
  );
  if (record === undefined) return;
  const status = oneOf(
    record['status'],
    join(path, 'status'),
    EVENTS_STATUSES,
    issues
  );
  const age = nullable(record['calendar_age_seconds'], (present) =>
    num(present, join(path, 'calendar_age_seconds'), issues, {
      integer: true,
      min: 0,
    })
  );
  const scope = oneOf(
    record['scope'],
    join(path, 'scope'),
    EVENTS_SCOPES,
    issues
  );
  if (scope !== undefined && intent !== undefined) {
    if ((scope === 'UPCOMING_ALL') !== (intent === 'NEWS')) {
      issues.add(
        join(path, 'scope'),
        'INCONSISTENT',
        'the News intent gets every upcoming event, every other intent the next 24 hours of HIGH impact (D9 (b))'
      );
    }
  }

  const itemsPath = join(path, 'items');
  const items = list(record['items'], itemsPath, issues, {
    max: EVENTS_MAX_ITEMS,
  });
  let previous = '';
  items?.forEach((raw, index) => {
    const where = at(itemsPath, index);
    const item = exactObject(
      raw,
      where,
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
    if (item === undefined) return;
    text(item['event_id'], join(where, 'event_id'), issues, { pattern: ID });
    text(item['name'], join(where, 'name'), issues, { max: 120 });
    const time = text(item['time'], join(where, 'time'), issues, {
      pattern: EVENT_TIME,
    });
    if (time !== undefined) {
      if (time < previous) {
        issues.add(
          join(where, 'time'),
          'NOT_SORTED',
          'events come soonest first'
        );
      }
      previous = time;
    }
    text(item['currency'], join(where, 'currency'), issues, {
      pattern: /^[A-Z]{3}$/,
    });
    const importance = text(
      item['importance'],
      join(where, 'importance'),
      issues,
      { pattern: /^[A-Z_]{1,12}$/ }
    );
    if (
      scope === 'NEXT_24H_HIGH' &&
      importance !== undefined &&
      importance !== 'HIGH'
    ) {
      issues.add(
        join(where, 'importance'),
        'INCONSISTENT',
        'the next-24-hours list holds HIGH-impact events only'
      );
    }
    bool(item['approximate'], join(where, 'approximate'), issues);
    bool(item['tier1'], join(where, 'tier1'), issues);
  });

  if (status === 'UNAVAILABLE') {
    if (age !== null && age !== undefined) {
      issues.add(
        join(path, 'calendar_age_seconds'),
        'INCONSISTENT',
        'is null when the calendar is unavailable'
      );
    }
    if ((items?.length ?? 0) > 0) {
      issues.add(
        itemsPath,
        'INCONSISTENT',
        'an unavailable calendar lists nothing: that is not "no news"'
      );
    }
  } else if (status !== undefined && age === null) {
    issues.add(
      join(path, 'calendar_age_seconds'),
      'REQUIRED',
      'a calendar that was read has an age'
    );
  }
}

function checkTrace(
  value: unknown,
  body: PacketBody | undefined,
  issues: Issues
): void {
  const path = 'trace';
  const record = exactObject(
    value,
    path,
    [
      'language',
      'reply_locale',
      'intent',
      'm_star',
      'chunk_ids',
      'index_build_id',
      'cycle_slot',
      'data_status',
      'sensor_statuses',
      'synthesis_rule',
      'intake_version',
      'routing_version',
    ],
    issues
  );
  if (record === undefined) return;
  const intakeVersion = text(
    record['intake_version'],
    join(path, 'intake_version'),
    issues,
    { pattern: VERSION }
  );
  const routingVersion = text(
    record['routing_version'],
    join(path, 'routing_version'),
    issues,
    { pattern: VERSION }
  );
  if (body === undefined) {
    // the rest of the packet is not sound enough to say what the trace must equal
    return;
  }
  if (intakeVersion === undefined || routingVersion === undefined) return;
  const expected = deriveTrace(body, {
    intake: intakeVersion,
    routing: routingVersion,
  });
  for (const key of Object.keys(expected) as (keyof PacketTrace)[]) {
    if (!sameJson(record[key], expected[key])) {
      issues.add(
        join(path, key),
        'INCONSISTENT',
        'is not what the rest of the packet says'
      );
    }
  }
}

/** Two JSON values are the same when their canonical texts are (key order does not matter). */
function sameJson(a: unknown, b: unknown): boolean {
  try {
    return canonicalJson(a) === canonicalJson(b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The validator
// ---------------------------------------------------------------------------

const TOP_KEYS = [
  'schema',
  'symbol',
  'thread_id',
  'question',
  'intent',
  'profile',
  'data',
  'board',
  'readings',
  'knowledge',
  'events',
  'trace',
] as const;

/**
 * Check a packet. Never throws; returns every problem found with the path it was found
 * at (at most 60). A packet that passes can be handed to Section 5 as it is.
 */
export function validatePacket(
  value: unknown,
  options: ValidateOptions = {}
): PacketValidation {
  const issues = new Issues();
  const roster = options.roster ?? SENSOR_ROSTER;
  const root = exactObject(value, '', TOP_KEYS, issues);
  if (root === undefined) return { ok: false, issues: issues.list };

  // first, whatever else is wrong: the two things a prompt must never carry
  for (const where of keysMatching(value, FORBIDDEN_PACKET_KEY, issues)) {
    issues.add(
      where,
      'FORBIDDEN_KEY',
      'a packet never carries the equity balance or the commission (ADR-077)'
    );
  }

  if (root['schema'] !== INTAKE_PACKET_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${INTAKE_PACKET_SCHEMA}`);
  }
  if (root['symbol'] !== PACKET_SYMBOL) {
    issues.add('symbol', 'NOT_ONE_OF', `must be ${PACKET_SYMBOL}`);
  }
  nullable(root['thread_id'], (present) =>
    text(present, 'thread_id', issues, { pattern: THREAD_ID })
  );

  const intent = oneOf(root['intent'], 'intent', PACKET_INTENTS, issues);
  checkQuestion(root['question'], intent, issues);
  const traderType = checkProfile(root['profile'], issues);
  const data = checkData(root['data'], issues);
  const board = checkBoard(root['board'], roster, issues);

  // D7: the packet says so when no sensor is live, and only then
  const flags = isRecord(root['data']) ? root['data']['flags'] : undefined;
  if (
    Array.isArray(flags) &&
    isRecord(root['board']) &&
    Array.isArray(root['board']['sensors'])
  ) {
    const none = root['board']['sensors'].length === 0;
    if (none !== flags.includes('SENSORS_NOT_LIVE')) {
      issues.add(
        'data.flags',
        'INCONSISTENT',
        'SENSORS_NOT_LIVE is there exactly when the board has no live sensor'
      );
    }
  }

  checkReadings(root['readings'], intent, traderType, data, board, issues);
  checkKnowledge(root['knowledge'], intent, issues);
  checkEvents(root['events'], intent, issues);

  // the trace is compared with what the rest says only when the rest is sound
  // (deriveTrace reads the sections it needs and ignores the trace itself)
  checkTrace(
    root['trace'],
    issues.any ? undefined : (root as unknown as PacketBody),
    issues
  );

  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, packet: root as unknown as IntakePacket };
}
