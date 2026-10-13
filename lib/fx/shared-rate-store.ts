/** Server-only, versioned USD rate snapshots shared with money-service. */
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis/client';
import {
  FX_MAX_RETAINED_AGE_MS,
  FX_USD_RATES_SCHEMA_VERSION,
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_TTL_SECONDS,
} from '@/lib/fx/rate-contract';
import {
  FX_MAX_FUTURE_MS,
  isFreshFxSource,
  parseFxTimestamp,
  validateCompleteUsdRates,
} from '@/lib/fx/rate-providers';

export { FX_USD_RATES_REDIS_KEY, FX_USD_RATES_TTL_SECONDS };
const REDIS_TIMEOUT_MS = 500;

export interface SharedUsdRates {
  schemaVersion: typeof FX_USD_RATES_SCHEMA_VERSION;
  rates: Record<string, number>;
  provider: 'currencybeacon' | 'frankfurter';
  rateUpdatedAt: string;
  fetchedAt: string;
  expiresAt: string;
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

/** Legacy, partial, expired, future or stale source snapshots are cache misses. */
export function parseSharedUsdRates(raw: string | null): SharedUsdRates | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SharedUsdRates>;
    if (!data || data.schemaVersion !== FX_USD_RATES_SCHEMA_VERSION)
      return null;
    if (data.provider !== 'currencybeacon' && data.provider !== 'frankfurter')
      return null;
    const nowMs = Date.now();
    const fetchedMs = parseFxTimestamp(data.fetchedAt);
    const expiresMs = parseFxTimestamp(data.expiresAt);
    const hourMs = FX_USD_RATES_TTL_SECONDS * 1000;
    if (
      fetchedMs === null ||
      expiresMs === null ||
      fetchedMs > nowMs + FX_MAX_FUTURE_MS ||
      nowMs - fetchedMs > FX_MAX_RETAINED_AGE_MS
    )
      return null;
    if (
      expiresMs <= nowMs ||
      expiresMs <= fetchedMs ||
      expiresMs > fetchedMs + FX_MAX_RETAINED_AGE_MS ||
      expiresMs > nowMs + hourMs
    )
      return null;
    const rates = validateCompleteUsdRates(data.rates);
    const updatedMs = parseFxTimestamp(data.rateUpdatedAt);
    if (
      !rates ||
      updatedMs === null ||
      !isFreshFxSource(data.provider, data.rateUpdatedAt, nowMs) ||
      updatedMs > fetchedMs + FX_MAX_FUTURE_MS ||
      (data.provider === 'currencybeacon' &&
        expiresMs > updatedMs + FX_MAX_RETAINED_AGE_MS)
    )
      return null;
    return {
      schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
      rates,
      provider: data.provider,
      rateUpdatedAt: data.rateUpdatedAt as string,
      fetchedAt: data.fetchedAt as string,
      expiresAt: data.expiresAt as string,
    };
  } catch {
    return null;
  }
}

export async function readSharedUsdRates(): Promise<SharedUsdRates | null> {
  if (!process.env['REDIS_URL']) return null;
  try {
    return parseSharedUsdRates(
      await withTimeout(getRedisClient().get(FX_USD_RATES_REDIS_KEY))
    );
  } catch {
    logger.warn('[fx] Could not read shared USD rates from Redis');
    return null;
  }
}

/** Preserve the publisher's expiry, including a shorter primary-failure retry. */
export async function writeSharedUsdRates(
  table: SharedUsdRates
): Promise<void> {
  if (!process.env['REDIS_URL']) return;
  const valid = parseSharedUsdRates(JSON.stringify(table));
  if (!valid) return;
  const ttl = Math.min(
    FX_USD_RATES_TTL_SECONDS,
    Math.ceil((Date.parse(valid.expiresAt) - Date.now()) / 1000)
  );
  if (ttl <= 0) return;
  try {
    await withTimeout(
      getRedisClient().set(
        FX_USD_RATES_REDIS_KEY,
        JSON.stringify(valid),
        'EX',
        ttl
      )
    );
  } catch {
    logger.warn('[fx] Could not write shared USD rates to Redis');
  }
}
