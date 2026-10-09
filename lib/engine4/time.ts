/**
 * Whole seconds of unix time, read exactly.
 *
 * Every clock Engine 4 looks at (the cycle's slot, `now`, a release's time, a
 * broker row's `captured_at`) is unix UTC seconds. They arrive as `number`
 * (a database integer), `bigint` or decimal text; they are read once here and
 * carried as `bigint`, so a window edge is an exact comparison and there is no
 * floating-point date arithmetic anywhere in the engine.
 *
 * @module lib/engine4/time
 */

import { readPositive } from './exact';
import { Engine4InputError } from './types';

export const MINUTE_SECONDS = 60n;
export const HOUR_SECONDS = 3_600n;
export const DAY_SECONDS = 86_400n;

/**
 * A unix time in whole seconds, greater than zero. A fraction of a second, a
 * zero, a negative or something that is not a decimal is refused: the caller
 * is told which field.
 */
export function readSeconds(field: string, value: unknown): bigint {
  const parsed = readPositive(field, value);
  if (!parsed.isInteger()) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `${field} must be a whole number of seconds`,
      field
    );
  }
  return parsed.num;
}

function twoDigits(value: bigint): string {
  return value.toString().padStart(2, '0');
}

/** The UTC time of day of a unix time, `hh:mm`, for the reply texts ("data as of 20:50 UTC"). */
export function utcClock(seconds: bigint): string {
  const inDay = ((seconds % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS;
  const hours = inDay / HOUR_SECONDS;
  const minutes = (inDay % HOUR_SECONDS) / MINUTE_SECONDS;
  return `${twoDigits(hours)}:${twoDigits(minutes)}`;
}

/** The largest value a PostgreSQL `integer` column (Prisma `Int`) holds. */
const MAX_DB_INT = 2_147_483_647n;

/**
 * A whole-second time as the JavaScript integer a database query takes. This
 * is a conversion, not arithmetic: the value is checked to fit an `Int` column
 * first, so the number is exactly the bigint. It is the one place the engine
 * calls `Number`, and the exactness guard allows `Number` only on a `bigint`.
 */
export function toDbInt(field: string, value: bigint): number {
  if (value < 1n || value > MAX_DB_INT) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `${field} does not fit a database integer`,
      field
    );
  }
  return Number(value);
}
