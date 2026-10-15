/**
 * Units (build step 7 part 6; architecture 5.6 and 7.3; ADR-050, ADR-072, ADR-073; decisions D2
 * and D4).
 *
 * A unit is one micro-dollar of gateway cost, as a whole number (D2): $1.00 is 1,000,000 units.
 * The stored fact is the integer cost, so nothing here is a float and nothing is rounded except in
 * the one direction that never under-charges (up). The interface shows a share and "about N
 * analyses left", not a raw number, and no token number is published before the first measurement
 * (ADR-073).
 *
 * The size of a unit is a parameter (`unitMicroUsd`) so that the arithmetic says what it means;
 * decision D2 fixes it at 1 (`UNIT_MICRO_USD`), and a different size would be a new decision.
 *
 * The Pro allowance (ADR-073): monthly units = the Pro price times the share Davin allows for
 * model spend, divided by the cost of a unit. The price is NOT written in code: it is the
 * SystemConfig price the admin sets (`getBasePriceUsd()`), passed in by the one who computes the
 * allowance. The runtime reads the RESULT, `PRO_MONTHLY_UNITS` (decision D4): while it is unset,
 * zero or not a whole number, there is no allowance and the quota port refuses everything (fail
 * closed), because a number nobody has measured must not become a promise.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/meter/units
 */

/** Decision D2: one unit is one micro-dollar. */
export const UNIT_MICRO_USD = 1;
export const MICRO_USD_PER_USD = 1_000_000;

/** The most units any figure of the ledger may be: the database's bound (`ai_quota_periods_limit_is_bounded`). */
export const MAX_UNITS = 2_000_000_000;

/** The environment variable that holds the Pro allowance in units (decision D4). Unset means: refuse. */
export const PRO_MONTHLY_UNITS_ENV = 'PRO_MONTHLY_UNITS';

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * Micro-dollars to units, rounded UP to a whole unit (so a size above 1 never under-charges).
 * Returns null for anything that is not a whole number of at least zero, or a size that is not a
 * whole number of at least one.
 */
export function microUsdToUnits(
  microUsd: number,
  unitMicroUsd: number = UNIT_MICRO_USD
): number | null {
  if (!isWhole(microUsd) || !isWhole(unitMicroUsd) || unitMicroUsd < 1) {
    return null;
  }
  return Math.ceil(microUsd / unitMicroUsd);
}

/** Units to micro-dollars, exact. Null for a bad figure. */
export function unitsToMicroUsd(
  units: number,
  unitMicroUsd: number = UNIT_MICRO_USD
): number | null {
  if (!isWhole(units) || !isWhole(unitMicroUsd) || unitMicroUsd < 1) {
    return null;
  }
  const micro = units * unitMicroUsd;
  return Number.isSafeInteger(micro) ? micro : null;
}

/** US dollars to micro-dollars, to the nearest micro-dollar; null for a negative or non-finite figure. */
export function usdToMicroUsd(usd: number): number | null {
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) return null;
  const micro = Math.round(usd * MICRO_USD_PER_USD);
  return Number.isSafeInteger(micro) ? micro : null;
}

/** Units as US dollars with six decimals, for a log line or the measurement report; exact for any whole unit. */
export function unitsToUsdText(
  units: number,
  unitMicroUsd: number = UNIT_MICRO_USD
): string | null {
  const micro = unitsToMicroUsd(units, unitMicroUsd);
  if (micro === null) return null;
  const whole = Math.floor(micro / MICRO_USD_PER_USD);
  const fraction = String(micro % MICRO_USD_PER_USD).padStart(6, '0');
  return `${whole}.${fraction}`;
}

export interface ProQuotaInput {
  /** the Pro price in US dollars, as SystemConfig holds it (never a constant of the code) */
  priceUsd: number;
  /** the share of that price Davin allows for model spend, above 0 and at most 1 (ADR-073) */
  share: number;
  /** the size of a unit in micro-dollars (decision D2: 1) */
  unitMicroUsd?: number;
}

export type ProQuotaResult =
  | { ok: true; units: number }
  | { ok: false; code: 'PRICE' | 'SHARE' | 'UNIT' | 'TOO_LARGE' };

/**
 * The Pro allowance of ADR-073: `floor(price × share ÷ unit cost)`, in exact integer arithmetic.
 * The price is taken to the micro-dollar and the share to a millionth, so a share of 0.35 is exactly
 * 350,000 millionths and no float multiplication decides the result. Rounded DOWN: an allowance
 * never promises a unit the margin does not pay for.
 */
export function proQuotaUnits(input: ProQuotaInput): ProQuotaResult {
  const unit = input.unitMicroUsd ?? UNIT_MICRO_USD;
  if (!isWhole(unit) || unit < 1) return { ok: false, code: 'UNIT' };
  const priceMicro = usdToMicroUsd(input.priceUsd);
  if (priceMicro === null || priceMicro < 1)
    return { ok: false, code: 'PRICE' };
  if (
    typeof input.share !== 'number' ||
    !Number.isFinite(input.share) ||
    input.share <= 0 ||
    input.share > 1
  ) {
    return { ok: false, code: 'SHARE' };
  }
  const shareMillionths = Math.round(input.share * 1_000_000);
  if (shareMillionths < 1) return { ok: false, code: 'SHARE' };
  const units =
    (BigInt(priceMicro) * BigInt(shareMillionths)) /
    BigInt(1_000_000) /
    BigInt(unit);
  if (units > BigInt(MAX_UNITS)) return { ok: false, code: 'TOO_LARGE' };
  return { ok: true, units: Number(units) };
}

/**
 * The Pro allowance from the environment (`PRO_MONTHLY_UNITS`), or null when there is none: unset,
 * empty, not plain digits (no sign, no decimals, no separators, no leading zero), zero, or above
 * the ledger's bound. Null means the quota port refuses (decision D4).
 */
export function parseProMonthlyUnits(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const units = Number(raw);
  return Number.isSafeInteger(units) && units <= MAX_UNITS ? units : null;
}

/** The allowance of an environment object. */
export function proMonthlyUnitsFromEnv(
  env: Readonly<Record<string, string | undefined>>
): number | null {
  return parseProMonthlyUnits(env[PRO_MONTHLY_UNITS_ENV]);
}
