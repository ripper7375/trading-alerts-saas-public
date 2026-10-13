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
 * Part 3 adds the real glossary (`config/intake/glossary.v1.json`, 73 terms in 19 locales,
 * every form a draft until a native speaker has read it) and `text.ts`, the English registry
 * of the fixed replies, the instant prompts and the reason texts; their 19 translations are
 * the `intake.*` keys of the dictionaries.
 *
 * Part 4 adds the sensor board (`board.ts`), the warnings, the dispatch matrix (`matrix.ts`,
 * data in `config/intake/dispatch-matrix.v1.json`) and the router (`router.ts`), all pure, with
 * the facts they read out of a stored reading (`facts.ts`) and the slot arithmetic (`slots.ts`).
 * The readers that fetch what they work on (`read/snapshot.ts`, `read/events.ts`,
 * `read/profile.ts`) touch a database and the gateway: they are imported BY PATH.
 *
 * Later parts add the gate, the pipeline and the route layer (`server/`). Anything that
 * touches a database, Redis, the session or the network is imported BY PATH and never through
 * this barrel, so a client component can import it
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

export {
  DIGIT_TABLE_UNICODE,
  DIGIT_ZEROS,
  normalizeQuestion,
} from './text/normalize';
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

export {
  FIXED_REASON_TEXT_KEY,
  INSTANT_TEXT_KEY,
  INTAKE_COUNSEL_KEYS,
  INTAKE_KEYS,
  INTAKE_TEXT,
  MODIFIER_REASON_CODE,
  REFUSAL_TEXT_KEY,
  UPSTREAM_REASON_TEXT_KEY,
  instantTextKey,
  intakeText,
  reasonTextOf,
  refusalTextKey,
} from './text';
export type {
  FixedReasonCode,
  IntakeTextKey,
  ReasonText,
  TextParams,
  UpstreamReasonCode,
} from './text';

export {
  MAX_SECONDS,
  SLOT_SECONDS,
  boardStamp,
  clockOf,
  isEpochSeconds,
  isSlotSeconds,
  secondsOfSlot,
  shiftSlot,
  slotIso,
  timeIso,
} from './slots';

export {
  REASONS_MAX,
  SENSOR_SUMMARY_MAX,
  SYNTHESIS_SUMMARY_MAX,
  isUsable,
  orderedMcdIds,
  sensorFactsOf,
  synthesisFactsOf,
} from './facts';
export type { FactsResult, SensorFacts, SynthesisFacts } from './facts';

export { WARNING_KINDS, findWarnings, opposes } from './warnings';
export type { Warning, WarningKind } from './warnings';

export {
  DISPATCH_MATRIX,
  DISPATCH_MATRIX_SCHEMA,
  EXTRA_SELECTORS,
  NOTE_MAX_CHARS,
  PLAYBOOK_SCOPES,
  matrixRow,
  parseMatrix,
} from './matrix';
export type {
  ExtraSelector,
  Matrix,
  MatrixParse,
  MatrixRow,
  PlaybookScope,
} from './matrix';

export {
  BOARD_TOKEN_CAP,
  CHARS_PER_TOKEN,
  SYN_NOT_RUNNING_NO_READING,
  SYN_NOT_RUNNING_NO_SENSOR,
  buildBoard,
  estimateTokens,
  liveSensorIds,
} from './board';
export type { BoardData, BoardInput, BoardResult } from './board';

export { route } from './router';
export type { Route, RouteInput } from './router';
