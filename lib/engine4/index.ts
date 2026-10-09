/**
 * Engine 4: the trader profile and exact lot sizing (architecture chapter 6).
 *
 * Pure TypeScript, no floating point in the money maths. Part 1 of build step 5
 * is arithmetic and sizing; part 2 is the structure levels, the stop options,
 * the room to the next opposing level and the badge, plus one thin reader of the
 * stored levels (`read/structure-levels.ts`, the only file here that touches a
 * database, imported by path, never through this barrel). The offer check, the validator, the stores and the routes are later
 * parts.
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

export { zoneFromStored } from './zone';
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

// The reader is NOT exported as a value: it imports the database client, `crypto` and
// `zlib`, and a client component that imports this barrel must not pull those in.
// Server code imports it from '@/lib/engine4/read/structure-levels'. Its types are free.
export type {
  CycleInputRow,
  McdOutputRow,
  StructureClient,
  StructureReadResult,
  StructureRequest,
  StructureSensorInfo,
} from './read/structure-levels';

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
