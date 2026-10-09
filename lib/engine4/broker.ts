/**
 * The broker's figures: one `symbol_specs` row read, checked and dated
 * (architecture 6.9, ADR-066, degraded modes 7.6).
 *
 * Engine 4 reads the newest row, sizes with its contract size, volume limits
 * and typical spread, and records its `version` in the consent record. A row
 * older than 7 days means Report 2 is NOT OFFERED until the specs refresh
 * (ADR-078); a missing row, an unreadable one, and one dated in the future
 * (its clock cannot be trusted, and a far-future date would never go stale)
 * fail the same way. Nothing is guessed and no default stands in for a missing
 * figure.
 *
 * The row's floats are read by their shortest round-trip decimal text, so the
 * double 0.01 is the decimal 0.01. Validation of the sizing figures is part 1's
 * `resolveSymbolSpec`, so the two cannot disagree about what a usable spec is.
 *
 * Pure: the clock is passed in.
 *
 * @module lib/engine4/broker
 */

import { Rational, readDecimal, readNonNegative, readPositive } from './exact';
import type { DecimalLike } from './exact';
import { isRecord } from './levels';
import { resolveSymbolSpec } from './sizing';
import { DAY_SECONDS, MINUTE_SECONDS, readSeconds } from './time';
import { Engine4InputError } from './types';
import type { ResolvedSymbolSpec, SymbolSpecInput } from './types';

/** A row older than this is stale (6.9, 7.6): 7 days, inclusive of the boundary second. */
export const SPECS_MAX_AGE_SECONDS = 7n * DAY_SECONDS;
/** How far ahead of our clock a row's `captured_at` may be before its clock is not trusted. */
export const SPECS_FUTURE_TOLERANCE_SECONDS = 5n * MINUTE_SECONDS;

/** The columns of a `symbol_specs` row Engine 4 reads (the table's own names). */
export interface SymbolSpecRow {
  symbol: string;
  version: number;
  captured_at: number;
  contract_size: number;
  volume_min: number;
  volume_step: number;
  volume_max: number;
  tick_size: number;
  typical_spread: number;
  swap_long: number;
  swap_short: number;
  point: number;
  digits: number;
  swap_mode: number;
}

export interface BrokerFigures {
  symbol: string;
  /** recorded in the consent record (ADR-066) */
  version: bigint;
  /** unix UTC seconds, when the terminal was read */
  capturedAt: bigint;
  ageSeconds: bigint;
  /** the sizing figures as canonical decimal text: part 1's input, JSON-safe */
  spec: SymbolSpecInput;
  resolved: ResolvedSymbolSpec;
  tickSize: Rational;
  /** SYMBOL_SWAP_LONG and _SHORT, in the unit `swapMode` names; negative is a charge */
  swapLong: Rational;
  swapShort: Rational;
  digits: bigint;
  swapMode: bigint;
}

export type BrokerProblemCode =
  | 'NO_SPECS'
  | 'SPECS_UNREADABLE'
  | 'SPECS_STALE'
  | 'SPECS_FROM_THE_FUTURE'
  | 'DATABASE_ERROR';

export interface BrokerProblem {
  ok: false;
  code: BrokerProblemCode;
  detail: string;
  /** what could be read of the row, for the trace */
  version: bigint | null;
  capturedAt: bigint | null;
  ageSeconds: bigint | null;
}

export type BrokerResult = { ok: true; figures: BrokerFigures } | BrokerProblem;

function problem(
  code: BrokerProblemCode,
  detail: string,
  found: Partial<
    Pick<BrokerProblem, 'version' | 'capturedAt' | 'ageSeconds'>
  > = {}
): BrokerProblem {
  return {
    ok: false,
    code,
    detail,
    version: found.version ?? null,
    capturedAt: found.capturedAt ?? null,
    ageSeconds: found.ageSeconds ?? null,
  };
}

function wholeNumber(field: string, value: unknown): bigint {
  const parsed = readNonNegative(field, value);
  if (!parsed.isInteger()) {
    throw new Engine4InputError(
      'OUT_OF_RANGE',
      `${field} must be a whole number`,
      field
    );
  }
  return parsed.num;
}

/**
 * Read a `symbol_specs` row as of `nowSeconds`. Never throws for a bad row (the
 * problem is the answer); a bad clock is the caller's error and does throw.
 */
export function readBrokerFigures(
  row: unknown,
  nowSeconds: DecimalLike
): BrokerResult {
  const now = readSeconds('nowSeconds', nowSeconds);
  if (row === null || row === undefined) {
    return problem('NO_SPECS', 'there is no symbol_specs row for the symbol');
  }
  if (!isRecord(row)) {
    return problem('SPECS_UNREADABLE', 'the symbol_specs row is not an object');
  }

  let version: bigint;
  let capturedAt: bigint;
  try {
    version = readSeconds('version', row['version']);
    capturedAt = readSeconds('captured_at', row['captured_at']);
  } catch (error) {
    if (error instanceof Engine4InputError) {
      return problem('SPECS_UNREADABLE', error.message);
    }
    throw error;
  }

  // the date comes before the figures: a stale or future-dated row is refused whatever it holds
  if (capturedAt - now > SPECS_FUTURE_TOLERANCE_SECONDS) {
    return problem(
      'SPECS_FROM_THE_FUTURE',
      'the symbol_specs row is dated later than our clock allows',
      { version, capturedAt }
    );
  }
  const ageSeconds = now > capturedAt ? now - capturedAt : 0n;
  if (ageSeconds > SPECS_MAX_AGE_SECONDS) {
    return problem('SPECS_STALE', 'the symbol_specs row is older than 7 days', {
      version,
      capturedAt,
      ageSeconds,
    });
  }

  try {
    const symbol = row['symbol'];
    if (typeof symbol !== 'string' || symbol === '') {
      throw new Engine4InputError('BAD_SPEC', 'symbol is missing', 'symbol');
    }
    const contractSize = readPositive('contract_size', row['contract_size']);
    const volumeMin = readPositive('volume_min', row['volume_min']);
    const volumeStep = readPositive('volume_step', row['volume_step']);
    const volumeMax = readPositive('volume_max', row['volume_max']);
    const typicalSpread = readNonNegative(
      'typical_spread',
      row['typical_spread']
    );
    const point = readPositive('point', row['point']);
    const tickSize = readPositive('tick_size', row['tick_size']);
    const swapLong = readDecimal('swap_long', row['swap_long']);
    const swapShort = readDecimal('swap_short', row['swap_short']);
    const digits = wholeNumber('digits', row['digits']);
    const swapMode = wholeNumber('swap_mode', row['swap_mode']);

    const spec: SymbolSpecInput = {
      contractSize: contractSize.toString(),
      volumeMin: volumeMin.toString(),
      volumeStep: volumeStep.toString(),
      volumeMax: volumeMax.toString(),
      typicalSpread: typicalSpread.toString(),
      point: point.toString(),
    };
    // part 1's own check: the minimum is a multiple of the step, the maximum is not below the minimum
    const resolved = resolveSymbolSpec(spec);
    return {
      ok: true,
      figures: {
        symbol,
        version,
        capturedAt,
        ageSeconds,
        spec,
        resolved,
        tickSize,
        swapLong,
        swapShort,
        digits,
        swapMode,
      },
    };
  } catch (error) {
    if (error instanceof Engine4InputError) {
      return problem('SPECS_UNREADABLE', error.message, {
        version,
        capturedAt,
        ageSeconds,
      });
    }
    throw error;
  }
}
