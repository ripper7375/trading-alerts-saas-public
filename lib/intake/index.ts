/**
 * The intake path (architecture chapter 4, build step 6): the contracts of what comes
 * in and what goes on to Section 5. Part 1 is pure TypeScript with no I/O: the intent
 * labels, the 19 locales and the rule for the language of a reply, canonical JSON and
 * the fingerprint of a packet, `intake-packet/1` with its validator, `intake-refusal/1`,
 * and the sensor roster generated from the MCD registries.
 *
 * Part 2 adds text intake (`text/`, pure): normalising a typed question, the trading
 * glossary and the pass that spots its terms, the scope check, the Understand step behind
 * its port with the validator of `understand-result/1`, and the door limits. The fixture
 * adapter `text/understand-fixture.ts` is test infrastructure and is imported by path.
 *
 * Later parts add the snapshot readers (`read/`), the gate, the pipeline and the route layer
 * (`server/`). Anything that touches a database, Redis, the session or the network is
 * imported BY PATH and never through this barrel, so a client component can import it
 * (`__tests__/lib/intake/boundaries.test.ts` holds that).
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

export { DIGIT_ZEROS, normalizeQuestion } from './text/normalize';
export type {
  NormalizeChange,
  NormalizeFlag,
  NormalizedText,
} from './text/normalize';

export {
  MAX_GLOSSARY_HINTS,
  MAX_RESULT_TOKENS,
  NORMALIZED_MAX_CHARS,
  passTheDoor,
} from './text/limits';
export type { DoorCode, DoorResult } from './text/limits';

export {
  FORM_STATUSES,
  GLOSSARY,
  createSpotter,
  foldCase,
  glossaryHints,
  matchKey,
  parseGlossary,
  spotTerms,
  termById,
} from './text/glossary';
export type {
  FormStatus,
  Glossary,
  GlossaryForm,
  GlossaryHint,
  GlossaryHit,
  GlossaryParse,
  GlossaryTerm,
  HitTerm,
  Spotter,
} from './text/glossary';

export {
  ALLOWED_SYMBOL,
  ALLOWED_TIMEFRAMES,
  canonicalTimeframe,
  checkScope,
  scanText,
} from './text/scope';
export type {
  ScopeInput,
  ScopeReason,
  ScopeReasonKind,
  ScopeSource,
  ScopeVerdict,
} from './text/scope';

export {
  TERM_DROPPED,
  UNDERSTAND_PROMPT_VERSION,
  UNDERSTAND_SYSTEM_PROMPT,
  buildUnderstandRequest,
  checkTermPreservation,
  runUnderstand,
  validateUnderstandResult,
} from './text/understand';
export type {
  PreservationReport,
  UnderstandFailure,
  UnderstandInput,
  UnderstandOutcome,
  UnderstandPort,
  UnderstandRequest,
  UnderstandResult,
  UnderstandValidation,
} from './text/understand';
