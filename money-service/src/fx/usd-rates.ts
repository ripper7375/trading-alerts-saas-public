/** Hourly provider snapshots shared with Next through a versioned Redis table. */
import { logger } from '../common/logger.util';
import {
  FALLBACK_USD_RATES,
  FX_FAILURE_RETRY_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_SCHEMA_VERSION,
  FX_USD_RATES_TTL_SECONDS,
  type FxRateProvider,
} from './usd-fallback-rates';
import {
  completeUsdRates,
  fetchCurrencyBeacon,
  fetchFrankfurter,
  FX_MAX_FUTURE_SKEW_MS,
  utcTimestamp,
  validSourceTime,
  type ProviderSnapshot,
} from './rate-providers';

export const USD_RATES_TTL_MS = FX_USD_RATES_TTL_SECONDS * 1000;
const REDIS_TIMEOUT_MS = 500;

export interface SharedRateStore {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number
  ): Promise<unknown>;
}

export interface UsdRateTable {
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  fetchedAt: string;
  /** Optional for existing consumers' fixtures; every runtime table supplies it. */
  provider?: FxRateProvider;
  rateUpdatedAt?: string | null;
}

export interface SharedUsdRateRecord {
  schemaVersion: typeof FX_USD_RATES_SCHEMA_VERSION;
  rates: Record<string, number>;
  provider: Exclude<FxRateProvider, 'fixed'>;
  rateUpdatedAt: string;
  fetchedAt: string;
  expiresAt: string;
}

let cache: { table: UsdRateTable; expiresAt: number } | null = null;
let priorTable: UsdRateTable | null = null;
let inflight: Promise<UsdRateTable> | null = null;

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

function usableTable(table: UsdRateTable, nowMs: number): boolean {
  const fetchedMs = utcTimestamp(table.fetchedAt);
  if (
    fetchedMs === null ||
    fetchedMs > nowMs + FX_MAX_FUTURE_SKEW_MS ||
    nowMs - fetchedMs > FX_MAX_RETAINED_AGE_MS ||
    !completeUsdRates(table.rates)
  )
    return false;
  if (table.provider === 'fixed') return table.rateUpdatedAt === null;
  return (
    (table.provider === 'currencybeacon' || table.provider === 'frankfurter') &&
    validSourceTime(table.provider, table.rateUpdatedAt, nowMs)
  );
}

/** Reject old schemas, incomplete currencies, expired or forged-long TTLs. */
export function parseSharedUsdRates(
  raw: string | null,
  nowMs = Date.now()
): SharedUsdRateRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SharedUsdRateRecord>;
    if (
      !data ||
      data.schemaVersion !== FX_USD_RATES_SCHEMA_VERSION ||
      (data.provider !== 'currencybeacon' && data.provider !== 'frankfurter')
    )
      return null;
    const rates = completeUsdRates(data.rates);
    const fetchedMs = utcTimestamp(data.fetchedAt);
    const expiresMs = utcTimestamp(data.expiresAt);
    const updatedMs = utcTimestamp(data.rateUpdatedAt);
    if (
      !rates ||
      fetchedMs === null ||
      expiresMs === null ||
      updatedMs === null ||
      fetchedMs > nowMs + FX_MAX_FUTURE_SKEW_MS ||
      nowMs - fetchedMs > FX_MAX_RETAINED_AGE_MS ||
      expiresMs <= nowMs ||
      expiresMs <= fetchedMs ||
      expiresMs > fetchedMs + FX_MAX_RETAINED_AGE_MS ||
      (data.provider === 'currencybeacon' &&
        expiresMs > updatedMs + FX_MAX_RETAINED_AGE_MS) ||
      expiresMs > nowMs + USD_RATES_TTL_MS ||
      updatedMs > fetchedMs + FX_MAX_FUTURE_SKEW_MS ||
      !validSourceTime(data.provider, data.rateUpdatedAt, nowMs)
    )
      return null;
    return {
      schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
      rates,
      provider: data.provider,
      rateUpdatedAt: data.rateUpdatedAt!,
      fetchedAt: data.fetchedAt!,
      expiresAt: data.expiresAt!,
    };
  } catch {
    return null;
  }
}

async function readShared(
  store?: SharedRateStore | null
): Promise<UsdRateTable | null> {
  if (!store) return null;
  try {
    const shared = parseSharedUsdRates(
      await withTimeout(store.get(FX_USD_RATES_REDIS_KEY))
    );
    if (!shared) return null;
    const table: UsdRateTable = {
      rates: shared.rates,
      provider: shared.provider,
      rateUpdatedAt: shared.rateUpdatedAt,
      fetchedAt: shared.fetchedAt,
      source: shared.provider === 'currencybeacon' ? 'live' : 'fallback',
    };
    cache = { table, expiresAt: Date.parse(shared.expiresAt) };
    priorTable = table;
    return table;
  } catch {
    logger.warn('[fx] Could not read shared USD rates from Redis');
    return null;
  }
}

async function writeShared(
  store: SharedRateStore | null | undefined,
  table: UsdRateTable,
  expiresAt: number
): Promise<void> {
  if (!store || table.provider === 'fixed') return;
  const record = {
    schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
    rates: table.rates,
    provider: table.provider,
    rateUpdatedAt: table.rateUpdatedAt,
    fetchedAt: table.fetchedAt,
    expiresAt: new Date(expiresAt).toISOString(),
  };
  const valid = parseSharedUsdRates(JSON.stringify(record));
  if (!valid) return;
  const ttl = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  try {
    await withTimeout(
      store.set(FX_USD_RATES_REDIS_KEY, JSON.stringify(valid), 'EX', ttl)
    );
  } catch {
    logger.warn('[fx] Could not write shared USD rates to Redis');
  }
}

async function saveSnapshot(
  snapshot: ProviderSnapshot,
  ttlMs: number,
  store?: SharedRateStore | null
): Promise<UsdRateTable> {
  const nowMs = Date.now();
  const table: UsdRateTable = {
    ...snapshot,
    source: snapshot.provider === 'currencybeacon' ? 'live' : 'fallback',
    fetchedAt: new Date(nowMs).toISOString(),
  };
  cache = { table, expiresAt: boundedExpiry(table, nowMs, ttlMs) };
  priorTable = table;
  await writeShared(store, table, cache.expiresAt);
  logger.info('[fx] USD rate table fetched', {
    provider: table.provider,
    rateUpdatedAt: table.rateUpdatedAt,
    fetchedAt: table.fetchedAt,
  });
  return table;
}

/** Retry TTL must never extend the original observation or retrieval age. */
function boundedExpiry(
  table: UsdRateTable,
  nowMs: number,
  ttlMs: number
): number {
  let expiresAt = nowMs + Math.min(ttlMs, USD_RATES_TTL_MS);
  if (table.provider !== 'fixed') {
    expiresAt = Math.min(
      expiresAt,
      Date.parse(table.fetchedAt) + FX_MAX_RETAINED_AGE_MS
    );
    if (table.provider === 'currencybeacon' && table.rateUpdatedAt) {
      expiresAt = Math.min(
        expiresAt,
        Date.parse(table.rateUpdatedAt) + FX_MAX_RETAINED_AGE_MS
      );
    }
  }
  return expiresAt;
}

async function fetchTable(
  store?: SharedRateStore | null
): Promise<UsdRateTable> {
  const apiKey = process.env.CURRENCYBEACON_API_KEY?.trim();
  if (apiKey) {
    try {
      return await saveSnapshot(
        await fetchCurrencyBeacon(apiKey),
        USD_RATES_TTL_MS,
        store
      );
    } catch {
      // Fetch errors may contain request headers. Never log raw errors or keys.
      logger.warn('[fx] CurrencyBeacon unavailable; trying Frankfurter');
    }
  }
  const retryMs = apiKey ? FX_FAILURE_RETRY_MS : USD_RATES_TTL_MS;
  try {
    return await saveSnapshot(await fetchFrankfurter(), retryMs, store);
  } catch {
    logger.warn(
      '[fx] Frankfurter unavailable; using bounded prior or fixed rates'
    );
  }
  const nowMs = Date.now();
  const table =
    priorTable && usableTable(priorTable, nowMs)
      ? priorTable
      : {
          rates: { ...FALLBACK_USD_RATES },
          provider: 'fixed' as const,
          rateUpdatedAt: null,
          source: 'fallback' as const,
          fetchedAt: new Date(nowMs).toISOString(),
        };
  cache = { table, expiresAt: boundedExpiry(table, nowMs, retryMs) };
  // Cold processes must consume the same bounded snapshot as the warm publisher.
  await writeShared(store, table, cache.expiresAt);
  return table;
}

async function loadTable(
  store?: SharedRateStore | null
): Promise<UsdRateTable> {
  return (await readShared(store)) ?? (await fetchTable(store));
}

/** Await a current shared/provider table; concurrent process refreshes deduplicate. */
export async function getUsdRateTable(
  store?: SharedRateStore | null
): Promise<UsdRateTable> {
  const nowMs = Date.now();
  if (cache && nowMs < cache.expiresAt && usableTable(cache.table, nowMs))
    return cache.table;
  if (!inflight) {
    inflight = loadTable(store).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function clearUsdRateCache(): void {
  cache = null;
  priorTable = null;
  inflight = null;
}
