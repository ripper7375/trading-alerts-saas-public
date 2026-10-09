/**
 * Exact rational arithmetic over BigInt (Engine 4, D2 (a)).
 *
 * Engine 4 sizes real positions, so no figure in its money maths may pass
 * through a binary float: 0.1 + 0.2 is not 0.3 there, and a lot rounded down
 * to 0.06 when the exact answer is 0.0600 can come out as 0.05999999. Every
 * figure here is a fraction of two BigInts, always in lowest terms with a
 * positive denominator, and the only way to get a decimal back out is to ask
 * for one (`toDecimal`), with the rounding named.
 *
 * Rules this file keeps, and a test enforces for all of `lib/engine4`:
 * no `Math`, no `parseFloat` / `parseInt` / `Number`, no `toFixed` family, no
 * arithmetic on a `number`. A `number` coming in (a Prisma Float column) is
 * read as its shortest round-trip decimal TEXT, which is what the broker's
 * figure means (the double nearest 0.01 is the decimal 0.01), then handled as
 * text from there on.
 *
 * Zero dependencies.
 *
 * @module lib/engine4/exact
 */

import { Engine4InputError } from './types';

/**
 * Decimal text, a JavaScript number (read as its shortest decimal text), an
 * integer, or a value that is already exact.
 */
export type DecimalLike = string | number | bigint | Rational;

/** How a value is brought to a number of decimal places. HALF_UP is half away from zero. */
export type RoundingMode = 'HALF_UP' | 'FLOOR' | 'CEIL';

const DECIMAL_TEXT = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;
const MAX_TEXT_LENGTH = 200;
/** Powers of ten beyond this are refused: a typo, not a price. */
const MAX_SHIFT = 400n;
const MAX_PLACES = 60n;

/** The greatest common divisor of |a| and b, for b > 0 (the caller has made the denominator positive). */
function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x;
}

/** floor(a / b) for b > 0, whatever the sign of a (BigInt division truncates). */
function floorDiv(a: bigint, b: bigint): bigint {
  const quotient = a / b;
  return a % b !== 0n && a < 0n ? quotient - 1n : quotient;
}

function placesOf(places: number | bigint): bigint {
  let p: bigint;
  try {
    p = typeof places === 'bigint' ? places : BigInt(places);
  } catch {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'decimal places must be a whole number',
      'places'
    );
  }
  if (p < 0n || p > MAX_PLACES) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      'decimal places are out of range',
      'places'
    );
  }
  return p;
}

function parseDecimalText(text: string, field: string | undefined): Rational {
  const label = field ?? 'value';
  const match = text.length > MAX_TEXT_LENGTH ? null : DECIMAL_TEXT.exec(text);
  if (match === null) {
    throw new Engine4InputError(
      'NOT_A_DECIMAL',
      `${label} is not a decimal number`,
      field
    );
  }
  const sign = match[1] ?? '';
  const whole = match[2] ?? '';
  const fraction = match[3] ?? '';
  const exponent = match[4] ?? '0';

  const digits = BigInt(whole + fraction);
  const shift = BigInt(exponent) - BigInt(fraction.length);
  if (shift > MAX_SHIFT || shift < -MAX_SHIFT) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `${label} has an exponent that is out of range`,
      field
    );
  }
  const magnitude =
    shift >= 0n
      ? Rational.fromFraction(digits * 10n ** shift, 1n)
      : Rational.fromFraction(digits, 10n ** -shift);
  return sign === '-' ? magnitude.neg() : magnitude;
}

/**
 * An immutable exact fraction. Build one with `Rational.of`, `Rational.int`
 * or `Rational.fromFraction`; the constructor is private so every instance is
 * in lowest terms with a positive denominator, and equality is plain
 * `eq`, never a comparison of fields.
 */
export class Rational {
  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    this.num = num;
    this.den = den;
    Object.freeze(this);
  }

  static readonly ZERO: Rational = new Rational(0n, 1n);
  static readonly ONE: Rational = new Rational(1n, 1n);

  static int(value: bigint): Rational {
    return new Rational(value, 1n);
  }

  static fromFraction(num: bigint, den: bigint): Rational {
    if (den === 0n) {
      throw new RangeError('Rational: the denominator is zero');
    }
    const sign = den < 0n ? -1n : 1n;
    const n = num * sign;
    const d = den * sign;
    const divisor = gcd(n, d);
    return new Rational(n / divisor, d / divisor);
  }

  /**
   * Read decimal text (`"2545.00"`, `"-0.5"`, `"1e-7"`), an integer, or a
   * number by its shortest round-trip decimal text. Anything else (NaN,
   * Infinity, thousands separators, blanks) is refused: callers normalise
   * what a person typed before it gets here.
   */
  static of(value: DecimalLike, field?: string): Rational {
    if (value instanceof Rational) return value;
    if (typeof value === 'bigint') return Rational.int(value);
    const text = typeof value === 'number' ? String(value) : value;
    if (typeof text !== 'string') {
      throw new Engine4InputError(
        'NOT_A_DECIMAL',
        `${field ?? 'value'} is not a decimal number`,
        field
      );
    }
    return parseDecimalText(text, field);
  }

  static min(first: Rational, ...rest: Rational[]): Rational {
    let least = first;
    for (const candidate of rest) {
      if (candidate.lt(least)) least = candidate;
    }
    return least;
  }

  static max(first: Rational, ...rest: Rational[]): Rational {
    let most = first;
    for (const candidate of rest) {
      if (candidate.gt(most)) most = candidate;
    }
    return most;
  }

  // -- arithmetic -----------------------------------------------------------

  add(other: Rational): Rational {
    return Rational.fromFraction(
      this.num * other.den + other.num * this.den,
      this.den * other.den
    );
  }

  sub(other: Rational): Rational {
    return Rational.fromFraction(
      this.num * other.den - other.num * this.den,
      this.den * other.den
    );
  }

  mul(other: Rational): Rational {
    return Rational.fromFraction(this.num * other.num, this.den * other.den);
  }

  div(other: Rational): Rational {
    if (other.num === 0n) {
      throw new RangeError('Rational: division by zero');
    }
    return Rational.fromFraction(this.num * other.den, this.den * other.num);
  }

  neg(): Rational {
    return new Rational(-this.num, this.den);
  }

  abs(): Rational {
    return this.num < 0n ? this.neg() : this;
  }

  // -- comparison -----------------------------------------------------------

  cmp(other: Rational): -1 | 0 | 1 {
    const left = this.num * other.den;
    const right = other.num * this.den;
    if (left < right) return -1;
    return left > right ? 1 : 0;
  }

  eq(other: Rational): boolean {
    return this.num === other.num && this.den === other.den;
  }

  lt(other: Rational): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: Rational): boolean {
    return this.cmp(other) <= 0;
  }

  gt(other: Rational): boolean {
    return this.cmp(other) > 0;
  }

  gte(other: Rational): boolean {
    return this.cmp(other) >= 0;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  isPositive(): boolean {
    return this.num > 0n;
  }

  isNegative(): boolean {
    return this.num < 0n;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  // -- rounding -------------------------------------------------------------

  /** The greatest integer not above this value. */
  floor(): bigint {
    return floorDiv(this.num, this.den);
  }

  /** The least integer not below this value. */
  ceil(): bigint {
    return -floorDiv(-this.num, this.den);
  }

  /**
   * The greatest multiple of `step` not above this value: the lot rule
   * ("rounded down to the lot step; never rounded up"). `step` must be positive.
   */
  floorToMultiple(step: Rational): Rational {
    if (!step.isPositive()) {
      throw new RangeError('Rational: the step must be positive');
    }
    return step.mul(Rational.int(this.div(step).floor()));
  }

  /** The least multiple of `step` not below this value. `step` must be positive. */
  ceilToMultiple(step: Rational): Rational {
    if (!step.isPositive()) {
      throw new RangeError('Rational: the step must be positive');
    }
    return step.mul(Rational.int(this.div(step).ceil()));
  }

  /** This value brought to `places` decimal places, as an exact fraction. */
  roundTo(places: number | bigint, mode: RoundingMode = 'HALF_UP'): Rational {
    const scale = 10n ** placesOf(places);
    const scaled = this.mul(Rational.int(scale));
    let units: bigint;
    if (mode === 'FLOOR') {
      units = scaled.floor();
    } else if (mode === 'CEIL') {
      units = scaled.ceil();
    } else {
      const half = Rational.fromFraction(1n, 2n);
      units = scaled.isNegative()
        ? -scaled.neg().add(half).floor()
        : scaled.add(half).floor();
    }
    return Rational.fromFraction(units, scale);
  }

  // -- text -----------------------------------------------------------------

  /** Decimal text with exactly `places` decimals, rounded as named. */
  toDecimal(places: number | bigint, mode: RoundingMode = 'HALF_UP'): string {
    const p = placesOf(places);
    const scale = 10n ** p;
    const rounded = this.roundTo(p, mode);
    const units = rounded.num * (scale / rounded.den);
    const negative = units < 0n;
    const magnitude = negative ? -units : units;
    const whole = (magnitude / scale).toString();
    const text =
      p === 0n
        ? whole
        : `${whole}.${(scale + (magnitude % scale)).toString().slice(1)}`;
    return negative ? `-${text}` : text;
  }

  /**
   * The value as decimal text with no rounding and no trailing zeros, or
   * null when it has no finite decimal form (a third, say).
   */
  toExactDecimal(): string | null {
    let rest = this.den;
    let twos = 0n;
    let fives = 0n;
    while (rest % 2n === 0n) {
      rest /= 2n;
      twos += 1n;
    }
    while (rest % 5n === 0n) {
      rest /= 5n;
      fives += 1n;
    }
    if (rest !== 1n) return null;
    return this.toDecimal(twos > fives ? twos : fives);
  }

  toString(): string {
    return this.toExactDecimal() ?? `${this.num}/${this.den}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Read a figure the caller must supply, naming the field in any refusal. */
export function readDecimal(field: string, value: unknown): Rational {
  return Rational.of(value as DecimalLike, field);
}

/** A figure that must be greater than zero. */
export function readPositive(field: string, value: unknown): Rational {
  const parsed = readDecimal(field, value);
  if (!parsed.isPositive()) {
    throw new Engine4InputError(
      'NOT_POSITIVE',
      `${field} must be greater than zero`,
      field
    );
  }
  return parsed;
}

/** A figure that may be zero but not below. */
export function readNonNegative(field: string, value: unknown): Rational {
  const parsed = readDecimal(field, value);
  if (parsed.isNegative()) {
    throw new Engine4InputError(
      'NEGATIVE',
      `${field} must not be negative`,
      field
    );
  }
  return parsed;
}
