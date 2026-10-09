/**
 * Engine 4: the trader profile and exact lot sizing (architecture chapter 6).
 *
 * Pure TypeScript, no I/O, no floating point in the money maths. Part 1 of
 * build step 5: arithmetic and sizing. The offer check, the validator, the
 * stores and the routes are later parts.
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
