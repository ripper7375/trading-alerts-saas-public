/**
 * The intake path (architecture chapter 4, build step 6): the contracts of what comes
 * in and what goes on to Section 5. Part 1 is pure TypeScript with no I/O: the intent
 * labels, the 19 locales and the rule for the language of a reply, canonical JSON and
 * the fingerprint of a packet, `intake-packet/1` with its validator, `intake-refusal/1`,
 * and the sensor roster generated from the MCD registries.
 *
 * Later parts add text intake (`text/`, pure), the snapshot readers (`read/`), the gate,
 * the pipeline and the route layer (`server/`). Anything that touches a database, Redis,
 * the session or the network is imported BY PATH and never through this barrel, so a
 * client component can import it (`__tests__/lib/intake/boundaries.test.ts` holds that).
 *
 * @module lib/intake
 */

export {
  INSTANT_INTENTS,
  INTENTS,
  PACKET_INTENTS,
  UNDERSTAND_INTENTS,
  instantTimeframe,
  isInstantIntent,
  isIntent,
  isPacketIntent,
  isUnderstandIntent,
} from './intents';
export type {
  InstantIntent,
  Intent,
  PacketIntent,
  UnderstandIntent,
} from './intents';

export {
  DEFAULT_LOCALE,
  LANGUAGE_FAMILIES,
  LOCALES,
  UNDETERMINED,
  directionOf,
  familyOfLocale,
  isDetectedLanguage,
  isLanguageFamily,
  isLocale,
  localesOfFamily,
  replyLocale,
} from './locales';
export type { LanguageFamily, Locale } from './locales';

export {
  CanonicalError,
  canonicalJson,
  canonicalSha256,
  sha256Hex,
} from './canonical';
export type { CanonicalErrorCode } from './canonical';

export {
  INTAKE_PACKET_SCHEMA,
  INTAKE_REFUSAL_SCHEMA,
  INTAKE_VERSION,
  ROUTING_VERSION,
  SENSOR_ROSTER_SCHEMA,
  UNDERSTAND_RESULT_SCHEMA,
} from './version';

export {
  GATE_ORDER,
  REFUSAL_CODES,
  REFUSAL_REPLY_MAX_CHARS,
  REFUSAL_STAGE,
  REFUSAL_STAGES,
  buildRefusal,
  stageOfRefusal,
  validateRefusal,
} from './refusal';
export type {
  IntakeRefusal,
  RefusalCode,
  RefusalStage,
  RefusalValidation,
} from './refusal';

export {
  MCD_ID_PATTERN,
  PRIMARY_RUNG,
  SENSOR_FLAGS,
  SENSOR_KINDS,
  SENSOR_ROSTER,
  TIMEFRAMES,
  TRADER_TYPES,
  boardSensors,
  parseRoster,
  primarySensor,
  primarySensors,
  sensorById,
} from './roster';
export type {
  Roster,
  RosterParse,
  RosterSensor,
  SensorFlag,
  SensorKind,
  Timeframe,
  TraderType,
} from './roster';

export {
  BIASES,
  BOARD_STATUSES,
  DATA_FLAGS,
  DATA_STATUSES,
  ENGLISH_MAX_CHARS,
  EVENTS_MAX_ITEMS,
  EVENTS_SCOPES,
  EVENTS_STATUSES,
  FORBIDDEN_PACKET_KEY,
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_DOMAINS,
  KNOWLEDGE_MAX_CHUNKS,
  KNOWLEDGE_MAX_EXPANSIONS,
  KNOWLEDGE_STATUSES,
  PACKET_SYMBOL,
  QUESTION_MAX_CHARS,
  QUESTION_SOURCES,
  SENSOR_STATUSES,
  SYN_STATES,
  TRADING_STYLES,
  TREND_RELATIONS,
  chunkIdsOf,
  deriveTrace,
  forbiddenKeyPaths,
  packetSha256,
  validatePacket,
} from './packet';
export type {
  Bias,
  Board,
  BoardSensorLine,
  BoardStatus,
  BoardSynLine,
  DataFlag,
  DataStatus,
  EventItem,
  EventsScope,
  EventsStatus,
  IntakePacket,
  Knowledge,
  KnowledgeChunk,
  KnowledgeDomain,
  KnowledgeStatus,
  LastPrice,
  PacketBody,
  PacketData,
  PacketEvents,
  PacketProfile,
  PacketQuestion,
  PacketTrace,
  PacketValidation,
  QuestionSource,
  Readings,
  SensorReading,
  SensorStatus,
  SynthesisEntry,
  TraceVersions,
  TradingStyle,
  TrendRelation,
  ValidateOptions,
} from './packet';

export type { Issue, IssueCode } from './check';
