/**
 * Engine 4: the trader profile and exact lot sizing (architecture chapter 6).
 *
 * Pure TypeScript, no floating point in the money maths. Part 1 of build step 5
 * is arithmetic and sizing; part 2 is the structure levels, the stop options,
 * the room to the next opposing level and the badge, plus one thin reader of the
 * stored levels (`read/structure-levels.ts`). Part 3 is the offer check
 * (`offer.ts`), the Tier-1 blackout (`blackout.ts`) and the broker figures
 * (`broker.ts`), with three more readers under `read/` (`cycle.ts`, `specs.ts`,
 * `events.ts`). The readers touch a database or a config file, are imported by
 * path and never through this barrel. The validator, the stores and the routes
 * are later parts.
 *
 * @module lib/engine4
 */

export { Rational, readDecimal, readNonNegative, readPositive } from './exact';
export type { DecimalLike, RoundingMode } from './exact';

export {
  PROFILE_BOUNDS,
  PROFILE_DEFAULTS,
  RISK_PCT_STEP,
  TRADER_TYPES,
  TRADING_STYLES,
  completeProfile,
  validateProfile,
} from './profile';

export {
  resolveSymbolSpec,
  sizeSetup,
  sizeWithTarget,
  targetAt,
} from './sizing';

export { RRR_NOTCH, buildScenarios } from './scenarios';

export { underflowHelp } from './underflow';

export {
  SENSORS,
  SR_NAMES,
  TIMEFRAMES,
  ZONES_1,
  compareLevels,
  decimalOrNull,
  dedupeLevels,
  isAvailableReading,
  levelFromStored,
  levelsFromReadings,
  nearestLevel,
  sameLevel,
  srLevelsFromContext,
  toStructure,
} from './levels';
export type {
  Level,
  LevelOrigin,
  SensorId,
  StructureProblem,
  StructureProblemCode,
  StructureRead,
  Timeframe,
} from './levels';

export { zoneFromEntryRow, zoneFromStored } from './zone';
export type { InvalidationBasis, ZoneBias, ZoneInput } from './zone';

export {
  buildStopChoices,
  groupStopOptions,
  stopOptions,
  zoneDisagreement,
  zoneInvalidation,
} from './stops';
export type {
  PreselectedStop,
  StopChoices,
  StopChoicesInput,
  StopOption,
  StopOptionsInput,
  ZoneInvalidation,
} from './stops';

export { nextOpposingLevel, roomAhead, targetFitsBefore } from './room';
export type { Room } from './room';

export { badgeContextFromReading, decideBadge } from './badge';
export type {
  BadgeContext,
  BadgeInput,
  BadgeResult,
  BadgeRow,
  NoBadgeReason,
  TrendRelation,
} from './badge';

export { utcClock } from './time';

export {
  ENTRY_TYPO_FRACTION,
  M5_SECONDS,
  checkEntryBound,
  dayRange,
  entryBounds,
} from './entry-bound';
export type {
  DayBar,
  DayRange,
  DayRangeProblemCode,
  EntryBoundCode,
  EntryBoundResult,
  EntryBounds,
} from './entry-bound';

export {
  buildModalDefinition,
  customEntryStopChoices,
  riskPreset,
  rrrBounds,
} from './modal-definition';
export type {
  CustomEntryStopInput,
  ModalDefinition,
  ModalDefinitionInput,
  ModalPill,
  NotOfferedModal,
  OfferedModal,
  RiskPreset,
  RrrBounds,
} from './modal-definition';

export {
  VALIDATED_SETUP_SCHEMA,
  serializeValidatedSetup,
  validateSetup,
} from './validate';
export type {
  CheckId,
  CheckName,
  CheckResult,
  CheckStatus,
  SetupFields,
  ValidatedSetup,
  ValidationContext,
} from './validate';

export {
  BLACKOUT_APPROXIMATE_SECONDS,
  BLACKOUT_EXACT_SECONDS,
  CALENDAR_LATE_SECONDS,
  HOLDING_WINDOW_SECONDS,
  TIER1_KINDS,
  TIER1_SCHEMA_VERSION,
  checkBlackout,
  missingTier1Kinds,
  parseTier1List,
} from './blackout';
export type {
  BlackoutBlock,
  BlackoutInput,
  BlackoutResult,
  BlackoutStatus,
  BlackoutUnknownReason,
  CalendarAge,
  CalendarEvent,
  HoldingWarning,
  Tier1Entry,
  Tier1Kind,
  Tier1List,
  Tier1Parse,
} from './blackout';

export {
  SPECS_FUTURE_TOLERANCE_SECONDS,
  SPECS_MAX_AGE_SECONDS,
  readBrokerFigures,
} from './broker';
export type {
  BrokerFigures,
  BrokerProblem,
  BrokerProblemCode,
  BrokerResult,
  SymbolSpecRow,
} from './broker';

export { NOT_OFFERED_ROW, checkOffer, parseLiveDataStatus } from './offer';
export type {
  LiveDataStatus,
  NoticeCode,
  NotOfferedCode,
  OfferInput,
  OfferNotice,
  OfferReason,
  OfferResult,
  OfferSynthesis,
  OfferVerdict,
  RefreshOffer,
  SynthesisChange,
  ZoneCheck,
} from './offer';

// The readers are NOT exported as values: they import the database client, `crypto`,
// `zlib` and the Tier-1 config file, and a client component that imports this barrel
// must not pull those in. Server code imports them by path
// ('@/lib/engine4/read/structure-levels', '.../cycle', '.../specs', '.../events').
// Their types are free.
export type {
  CycleInputRow,
  McdOutputRow,
  StructureClient,
  StructureReadResult,
  StructureRequest,
  StructureSensorInfo,
} from './read/structure-levels';
export type {
  CycleClient,
  CycleFacts,
  CycleRow,
  EntryZoneRow,
  OfferReadProblem,
  OfferReadProblemCode,
  OfferSnapshot,
  OfferSnapshotRequest,
  SynthesisRow,
} from './read/cycle';
export type { SpecsClient, SpecsRequest } from './read/specs';
export type {
  CalendarClient,
  CalendarRead,
  CalendarRequest,
  CalendarRow,
} from './read/events';

export { Engine4InputError } from './types';
export type {
  InputErrorCode,
  LimitingFactor,
  OmittedReason,
  OmittedScenario,
  ProfileIssue,
  ProfileIssueCode,
  ProfileValidation,
  ResolvedSymbolSpec,
  Scenario,
  ScenarioName,
  ScenarioOptions,
  ScenarioSet,
  Side,
  SizedSetup,
  SizingBasis,
  SizingInput,
  SizingResult,
  SymbolSpecInput,
  TargetPlan,
  TraderProfile,
  TraderProfileInput,
  TraderType,
  TradingStyle,
  UnderflowCause,
  UnderflowContext,
  UnderflowFact,
  UnderflowHelp,
  UnderflowOption,
  UnderflowSetup,
} from './types';
