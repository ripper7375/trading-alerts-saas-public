/**
 * The USD rate table shared through Redis, so the Next app and money-service
 * convert with the same rates. Whichever service refreshes first writes the
 * table under `fx:usd_rates` for an hour; the other reads it instead of
 * calling the rate API itself. Mirrored in money-service/src/fx/usd-rates.ts
 * (same key, TTL and JSON shape; parity test in
 * __tests__/lib/fx/usd-rates-parity.test.ts).
 *
 * Redis is an optimisation, never a dependency: when REDIS_URL is unset or
 * Redis does not answer within READ_TIMEOUT_MS, callers get `null` and fall
 * back to their own in-memory cache and the rate API.
 *
 * Server-only.
 *
 * @module lib/fx/shared-rate-store
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis/client';

export const FX_USD_RATES_REDIS_KEY = 'fx:usd_rates';

/** Redis TTL of the shared table (1 hour), in seconds. */
export const FX_USD_RATES_TTL_SECONDS = 3600;

/** A Redis call slower than this is treated as failed. */
const REDIS_TIMEOUT_MS = 500;

/** The JSON stored under FX_USD_RATES_REDIS_KEY. Live rates only. */
export interface SharedUsdRates {
  /** Units of each currency per 1 USD. */
  rates: Record<string, number>;
  /** When the rate API was called, ISO 8601. */
  fetchedAt: string;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Redis timed out')),
      REDIS_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Parses a stored table; anything malformed counts as missing. */
export function parseSharedUsdRates(raw: string | null): SharedUsdRates | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { rates?: unknown; fetchedAt?: unknown };
    if (typeof data.fetchedAt !== 'string') return null;
    if (Number.isNaN(Date.parse(data.fetchedAt))) return null;
    if (!data.rates || typeof data.rates !== 'object') return null;
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(data.rates)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        rates[code] = value;
      }
    }
    if (Object.keys(rates).length === 0) return null;
    return { rates, fetchedAt: data.fetchedAt };
  } catch {
    return null;
  }
}

/** The shared table, or null when absent, malformed or Redis is unreachable. */
export async function readSharedUsdRates(): Promise<SharedUsdRates | null> {
  if (!process.env['REDIS_URL']) return null;
  try {
    const raw = await withTimeout(getRedisClient().get(FX_USD_RATES_REDIS_KEY));
    return parseSharedUsdRates(raw);
  } catch (error) {
    logger.warn('[fx] Could not read shared USD rates from Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/** Publishes a live table for an hour. Failures are logged and ignored. */
export async function writeSharedUsdRates(
  table: SharedUsdRates
): Promise<void> {
  if (!process.env['REDIS_URL']) return;
  try {
    await withTimeout(
      getRedisClient().set(
        FX_USD_RATES_REDIS_KEY,
        JSON.stringify(table),
        'EX',
        FX_USD_RATES_TTL_SECONDS
      )
    );
  } catch (error) {
    logger.warn('[fx] Could not write shared USD rates to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
