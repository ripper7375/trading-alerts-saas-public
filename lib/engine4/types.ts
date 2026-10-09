/**
 * Engine 4 types: profile, broker figures, sizing inputs and outputs,
 * scenarios and the underflow help (STACK-D-ARCHITECTURE.md chapter 6).
 *
 * Shapes only, plus one error class. Every money figure that leaves the
 * engine is a `Rational` (exact); every figure that goes in is a
 * `DecimalLike`, read as the decimal text a person typed.
 *
 * @module lib/engine4/types
 */

import type { DecimalLike, Rational } from './exact';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type InputErrorCode =
  | 'NOT_A_DECIMAL'
  | 'NOT_POSITIVE'
  | 'NEGATIVE'
  | 'OUT_OF_RANGE'
  | 'BAD_SPEC'
  | 'BAD_OPTION';

/**
 * A figure the engine was asked to use is not usable (not a decimal, not
 * positive, a broker row that contradicts itself). It is a refusal, not an
 * outcome: an underflow, a clamped lot or an unlucky target is a RESULT, never
 * this error.
 */
export class Engine4InputError extends Error {
  readonly code: InputErrorCode;
  readonly field: string | undefined;

  constructor(code: InputErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'Engine4InputError';
    this.code = code;
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Profile (6.2)
// ---------------------------------------------------------------------------

export type Side = 'BUY' | 'SELL';

/** Metric 1: Scalper (< 2 h) or Day Trader (< 12 h). */
export type TraderType = 'SCALPER' | 'DAY_TRADER';

/** Metric 2. */
export type TradingStyle = 'TREND_FOLLOWING' | 'TREND_COUNTERING' | 'BOTH';

/**
 * The eight metrics, as stored: canonical decimal text, so a snapshot is
 * JSON-safe and byte-stable.
 */
export interface TraderProfile {
  /** 1 */
  traderType: TraderType;
  /** 2 */
  style: TradingStyle;
  /** 3: Max RPT, percent of equity (1.5 means 1.5%) */
  maxRiskPct: string;
  /** 4: Max leverage as a multiplier (1.5 means 1:1.5), ceiling 5 */
  maxLeverage: string;
  /** 5: target RRR, commission included */
  targetRrr: string;
  /** 6: current equity, dollars */
  equity: string;
  /** 7: Min SLD, dollars of price */
  minSld: string;
  /** 8: round-trip commission, dollars per lot */
  commission: string;
}

/** What may be handed to the profile validator: the same eight fields, loosely. */
export interface TraderProfileInput {
  traderType: unknown;
  style: unknown;
  maxRiskPct: unknown;
  maxLeverage: unknown;
  targetRrr: unknown;
  equity: unknown;
  minSld: unknown;
  commission: unknown;
}

export type ProfileIssueCode =
  | 'REQUIRED'
  | 'UNKNOWN_OPTION'
  | 'NOT_A_DECIMAL'
  | 'NOT_POSITIVE'
  | 'NEGATIVE'
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'LEVERAGE_ABOVE_CEILING'
  | 'RRR_ABOVE_COUNTER_TREND_CAP';

export interface ProfileIssue {
  field: keyof TraderProfile;
  code: ProfileIssueCode;
  message: string;
}

export type ProfileValidation =
  | { ok: true; profile: TraderProfile }
  | { ok: false; issues: ProfileIssue[] };

// ---------------------------------------------------------------------------
// Broker figures (6.9)
// ---------------------------------------------------------------------------

/**
 * The `symbol_specs` figures sizing needs. Field names are the table's,
 * camel-cased. Numbers and decimal text are both accepted; a number is read as
 * its shortest round-trip decimal text (the broker's double 0.01 is the
 * decimal 0.01).
 */
export interface SymbolSpecInput {
  /** SYMBOL_TRADE_CONTRACT_SIZE: ounces (units) in one lot */
  contractSize: DecimalLike;
  /** SYMBOL_VOLUME_MIN */
  volumeMin: DecimalLike;
  /** SYMBOL_VOLUME_STEP */
  volumeStep: DecimalLike;
  /** SYMBOL_VOLUME_MAX */
  volumeMax: DecimalLike;
  /** median SYMBOL_SPREAD, in points */
  typicalSpread: DecimalLike;
  /** SYMBOL_POINT: price per point */
  point: DecimalLike;
}

/** The same figures, validated and exact. */
export interface ResolvedSymbolSpec {
  contractSize: Rational;
  volumeMin: Rational;
  volumeStep: Rational;
  volumeMax: Rational;
  typicalSpread: Rational;
  point: Rational;
  /** typicalSpread x point: the spread as a price, S in the D3 formulas */
  spreadPrice: Rational;
}

// ---------------------------------------------------------------------------
// Sizing (6.7)
// ---------------------------------------------------------------------------

export interface SizingInput {
  side: Side;
  /** the chart (bid) entry price */
  entry: DecimalLike;
  /** SLD: price distance from the entry to the stop */
  stopDistance: DecimalLike;
  /** current equity, dollars */
  equity: DecimalLike;
  /** the risk chosen for this trade, percent of equity (1.5 means 1.5%) */
  riskPct: DecimalLike;
  /** Max leverage as a multiplier */
  maxLeverage: DecimalLike;
  /** round-trip commission, dollars per lot */
  commission: DecimalLike;
  spec: SymbolSpecInput;
}

/** What set the lot. A tie goes to RISK, then LEVERAGE. */
export type LimitingFactor = 'RISK' | 'LEVERAGE' | 'BROKER_MAX';

export type UnderflowCause = 'RISK' | 'LEVERAGE';

/** Figures that do not depend on the lot (6.7 steps 1, 2, 5 and 7). */
export interface SizingBasis {
  side: Side;
  /** ounces (units) in one lot, from `symbol_specs` */
  contractSize: Rational;
  /** round-trip commission, dollars per lot */
  commission: Rational;
  entry: Rational;
  /** S: the typical spread as a price */
  spreadPrice: Rational;
  /** the price the order fills at: ask for a BUY (entry + S), bid for a SELL */
  fillPrice: Rational;
  stopDistance: Rational;
  /** loss per ounce at the stop: SLD + S for a BUY, SLD for a SELL */
  lossPerOunce: Rational;
  /** loss per lot at the stop, commission included */
  lossPerLot: Rational;
  /** step 1 */
  maxLotByLeverage: Rational;
  /** step 2 */
  lotAtStop: Rational;
  /** min(step 1, step 2, broker maximum), before rounding down */
  rawLot: Rational;
  /** step 5 */
  declaredRisk: Rational;
  /** the risk chosen, percent */
  declaredRiskPct: Rational;
  /** step 7: the price where the stop triggers (the ask side for a SELL) */
  stopPrice: Rational;
  /** the chart (bid) level where the stop triggers */
  stopChartLevel: Rational;
}

export interface SizedSetup extends SizingBasis {
  status: 'OK';
  /** step 3: rounded down to the lot step, never up */
  lot: Rational;
  limitedBy: LimitingFactor;
  /** step 4 */
  leverageUsed: Rational;
  /** step 6 */
  actualRisk: Rational;
  /** actual risk as a percent of equity */
  actualRiskPct: Rational;
}

export interface UnderflowSetup extends SizingBasis {
  status: 'UNDERFLOW';
  /** why a lot of at least the broker minimum is not possible */
  causes: UnderflowCause[];
  lot: null;
}

export type SizingResult = SizedSetup | UnderflowSetup;

/** Steps 8 to 10 for one RRR. */
export interface TargetPlan {
  rrr: Rational;
  /** step 8: the target distance, from the entry */
  targetDistance: Rational;
  /** step 9: the price where the target triggers (the ask side for a SELL) */
  targetPrice: Rational;
  /** the chart (bid) level where the target triggers */
  targetChartLevel: Rational;
  /** profit per ounce at the target after the spread */
  gainPerOunce: Rational;
  /** step 10; null when there is no lot */
  netProfit: Rational | null;
}

// ---------------------------------------------------------------------------
// Scenarios (6.7, D5)
// ---------------------------------------------------------------------------

export type ScenarioName = 'CONSERVATIVE' | 'NORMAL' | 'AGGRESSIVE';

export type OmittedReason =
  | 'BELOW_MIN_RRR'
  | 'ABOVE_MAX_RRR'
  | 'ABOVE_COUNTER_TREND_CAP';

export interface Scenario {
  name: ScenarioName;
  rrr: Rational;
  target: TargetPlan;
}

export interface OmittedScenario {
  name: ScenarioName;
  rrr: Rational;
  reason: OmittedReason;
}

export interface ScenarioOptions {
  /** the profile's target RRR */
  targetRrr: DecimalLike;
  /** the SETUP is counter-trend (ADR-064), whatever the profile's style */
  counterTrend: boolean;
}

export interface ScenarioSet {
  sizing: SizingResult;
  counterTrend: boolean;
  /** the RRR of the Normal scenario: the profile's, or the cap when it was above it */
  normalRrr: Rational;
  /** the profile's RRR was above the counter-trend cap and Normal was lowered to it */
  normalCapped: boolean;
  scenarios: Scenario[];
  omitted: OmittedScenario[];
}

// ---------------------------------------------------------------------------
// Underflow help (6.8, D4)
// ---------------------------------------------------------------------------

export interface UnderflowContext {
  /** the profile's Max RPT, percent */
  maxRiskPct: DecimalLike;
  /** the profile's Min SLD */
  minSld: DecimalLike;
  /** SLD of each structural stop on offer; the caller builds this list */
  structuralStopDistances?: DecimalLike[];
}

/** What the trader may do. No option asks for another equity or more leverage. */
export type UnderflowOption =
  | {
      kind: 'RAISE_RISK';
      /** the risk to enter, percent, rounded UP to 0.01 so it is enough */
      riskPct: Rational;
      /** the exact risk a minimum lot needs, percent */
      riskPctExact: Rational;
      lot: Rational;
      actualRisk: Rational;
    }
  | {
      kind: 'NEARER_STRUCTURAL_STOP';
      stopDistance: Rational;
      lot: Rational;
      actualRisk: Rational;
      actualRiskPct: Rational;
    }
  | { kind: 'DECLINE' };

/** What the report states as a fact. Never a button, never a number to type in. */
export type UnderflowFact =
  | {
      kind: 'EQUITY_NEEDED_FOR_RISK';
      /** the least equity at which the chosen risk buys a minimum lot */
      equity: Rational;
      atRiskPct: Rational;
    }
  | {
      kind: 'EQUITY_NEEDED_FOR_LEVERAGE';
      /** the least equity at which the leverage limit allows a minimum lot */
      equity: Rational;
      atMaxLeverage: Rational;
    };

export interface UnderflowHelp {
  causes: UnderflowCause[];
  /** loss of one minimum lot at the stop, commission included */
  minLotLoss: Rational;
  /** the risk that loss is, as a percent of the trader's equity */
  minLotRiskPct: Rational;
  options: UnderflowOption[];
  facts: UnderflowFact[];
}
