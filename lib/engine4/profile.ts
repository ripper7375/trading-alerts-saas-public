/**
 * The Engine 4 trader profile (architecture 6.2): eight metrics, their
 * defaults, their bounds, and the 1:5 leverage ceiling.
 *
 * `validateProfile` never throws and never changes a figure: it either returns
 * the profile in canonical decimal text or every problem found, so the card
 * that edits a profile can show all of them at once. A refused profile is
 * never "fixed up" here; the numbers are the trader's.
 *
 * Two readings of 6.2 the plan left to this file (see the part 1 hand-off):
 * the counter-trend cap on the PROFILE applies to the Trend Countering style
 * only (for Both, the cap is applied per setup, ADR-064, by `scenarios.ts`);
 * and a custom leverage has no lower bound except "above zero" (6.2 gives only
 * the ceiling).
 *
 * @module lib/engine4/profile
 */

import { Rational } from './exact';
import type {
  ProfileIssue,
  ProfileIssueCode,
  ProfileValidation,
  TraderProfile,
  TraderProfileInput,
  TraderType,
  TradingStyle,
} from './types';
import { Engine4InputError } from './types';

export const TRADER_TYPES: readonly TraderType[] = ['SCALPER', 'DAY_TRADER'];

export const TRADING_STYLES: readonly TradingStyle[] = [
  'TREND_FOLLOWING',
  'TREND_COUNTERING',
  'BOTH',
];

/** D5: the profile's risk % moves in steps of this many percentage points. */
export const RISK_PCT_STEP = '0.25';

/** Bounds of 6.2, as decimal text. */
export const PROFILE_BOUNDS = {
  maxRiskPct: { min: '0.5', max: '2' },
  targetRrr: { min: '1.5', max: '3.5' },
  /** 1:5.0, the hard ceiling on Max leverage */
  maxLeverageCeiling: '5',
  /** target RRR for a counter-trend style or setup */
  counterTrendRrrCap: '2.5',
} as const;

/**
 * The 6.2 defaults. They live here and nowhere else (D17: whichever way the
 * question about leverage at today's gold price is settled, one line changes).
 */
export const PROFILE_DEFAULTS: Readonly<TraderProfile> = Object.freeze({
  traderType: 'DAY_TRADER',
  style: 'TREND_FOLLOWING',
  maxRiskPct: '1.5',
  maxLeverage: '1.5',
  targetRrr: '1.75',
  equity: '5000',
  minSld: '13',
  commission: '4',
});

type NumericField =
  | 'maxRiskPct'
  | 'maxLeverage'
  | 'targetRrr'
  | 'equity'
  | 'minSld'
  | 'commission';

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

/** Rational.of for anything: a refusal becomes undefined, never an exception. */
function readNumber(value: unknown): Rational | undefined {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'bigint'
  ) {
    return undefined;
  }
  try {
    return Rational.of(value);
  } catch (error) {
    if (error instanceof Engine4InputError) return undefined;
    throw error;
  }
}

/** Validate a candidate profile. Returns every problem, in metric order. */
export function validateProfile(
  candidate: Partial<TraderProfileInput>
): ProfileValidation {
  const issues: ProfileIssue[] = [];
  const fail = (
    field: keyof TraderProfile,
    code: ProfileIssueCode,
    message: string
  ): void => {
    issues.push({ field, code, message });
  };

  // 1 and 2: the two choices
  let traderType: TraderType | undefined;
  if (isBlank(candidate.traderType)) {
    fail('traderType', 'REQUIRED', 'Type of trader is required');
  } else if (TRADER_TYPES.includes(candidate.traderType as TraderType)) {
    traderType = candidate.traderType as TraderType;
  } else {
    fail('traderType', 'UNKNOWN_OPTION', 'Type of trader is not an option');
  }

  let style: TradingStyle | undefined;
  if (isBlank(candidate.style)) {
    fail('style', 'REQUIRED', 'Trading style is required');
  } else if (TRADING_STYLES.includes(candidate.style as TradingStyle)) {
    style = candidate.style as TradingStyle;
  } else {
    fail('style', 'UNKNOWN_OPTION', 'Trading style is not an option');
  }

  // 3 to 8: the six figures
  const read = (field: NumericField, label: string): Rational | undefined => {
    const raw = candidate[field];
    if (isBlank(raw)) {
      fail(field, 'REQUIRED', `${label} is required`);
      return undefined;
    }
    const parsed = readNumber(raw);
    if (parsed === undefined) {
      fail(field, 'NOT_A_DECIMAL', `${label} is not a number`);
    }
    return parsed;
  };

  const maxRiskPct = read('maxRiskPct', 'Max risk per trade');
  if (maxRiskPct !== undefined) {
    if (maxRiskPct.lt(Rational.of(PROFILE_BOUNDS.maxRiskPct.min))) {
      fail(
        'maxRiskPct',
        'BELOW_MIN',
        `Max risk per trade is at least ${PROFILE_BOUNDS.maxRiskPct.min}%`
      );
    } else if (maxRiskPct.gt(Rational.of(PROFILE_BOUNDS.maxRiskPct.max))) {
      fail(
        'maxRiskPct',
        'ABOVE_MAX',
        `Max risk per trade is at most ${PROFILE_BOUNDS.maxRiskPct.max}%`
      );
    }
  }

  const maxLeverage = read('maxLeverage', 'Maximum leverage');
  if (maxLeverage !== undefined) {
    if (!maxLeverage.isPositive()) {
      fail(
        'maxLeverage',
        'NOT_POSITIVE',
        'Maximum leverage must be above zero'
      );
    } else if (maxLeverage.gt(Rational.of(PROFILE_BOUNDS.maxLeverageCeiling))) {
      fail(
        'maxLeverage',
        'LEVERAGE_ABOVE_CEILING',
        `Maximum leverage cannot be above 1:${PROFILE_BOUNDS.maxLeverageCeiling}`
      );
    }
  }

  const targetRrr = read('targetRrr', 'Target RRR');
  if (targetRrr !== undefined) {
    if (targetRrr.lt(Rational.of(PROFILE_BOUNDS.targetRrr.min))) {
      fail(
        'targetRrr',
        'BELOW_MIN',
        `Target RRR is at least ${PROFILE_BOUNDS.targetRrr.min}`
      );
    } else if (targetRrr.gt(Rational.of(PROFILE_BOUNDS.targetRrr.max))) {
      fail(
        'targetRrr',
        'ABOVE_MAX',
        `Target RRR is at most ${PROFILE_BOUNDS.targetRrr.max}`
      );
    } else if (
      style === 'TREND_COUNTERING' &&
      targetRrr.gt(Rational.of(PROFILE_BOUNDS.counterTrendRrrCap))
    ) {
      fail(
        'targetRrr',
        'RRR_ABOVE_COUNTER_TREND_CAP',
        `Target RRR is at most ${PROFILE_BOUNDS.counterTrendRrrCap} for a counter-trend style`
      );
    }
  }

  const equity = read('equity', 'Current equity');
  if (equity !== undefined && !equity.isPositive()) {
    fail('equity', 'NOT_POSITIVE', 'Current equity must be above zero');
  }

  const minSld = read('minSld', 'Min stop-loss distance');
  if (minSld !== undefined && !minSld.isPositive()) {
    fail('minSld', 'NOT_POSITIVE', 'Min stop-loss distance must be above zero');
  }

  const commission = read('commission', 'Round-trip commission');
  if (commission !== undefined && commission.isNegative()) {
    fail('commission', 'NEGATIVE', 'Round-trip commission cannot be negative');
  }

  if (
    issues.length > 0 ||
    traderType === undefined ||
    style === undefined ||
    maxRiskPct === undefined ||
    maxLeverage === undefined ||
    targetRrr === undefined ||
    equity === undefined ||
    minSld === undefined ||
    commission === undefined
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    profile: {
      traderType,
      style,
      maxRiskPct: maxRiskPct.toString(),
      maxLeverage: maxLeverage.toString(),
      targetRrr: targetRrr.toString(),
      equity: equity.toString(),
      minSld: minSld.toString(),
      commission: commission.toString(),
    },
  };
}

/**
 * Validate a profile after filling every field the candidate leaves out
 * (undefined) from the defaults: the profile of a trader who has not set
 * everything yet. A field that is present and wrong is NOT replaced.
 */
export function completeProfile(
  candidate: Partial<TraderProfileInput>
): ProfileValidation {
  const filled: Record<keyof TraderProfile, unknown> = {
    ...PROFILE_DEFAULTS,
  };
  for (const key of Object.keys(PROFILE_DEFAULTS) as (keyof TraderProfile)[]) {
    if (candidate[key] !== undefined) filled[key] = candidate[key];
  }
  return validateProfile(filled);
}
