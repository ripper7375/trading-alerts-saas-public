/**
 * USD exchange rates from exchangerate-api.com for dLocal charges, shared
 * with the Next app through Redis so both services charge and display with
 * the same rates. Mirrors lib/fx/usd-rates.ts + lib/fx/shared-rate-store.ts.
 *
 * A refresh reads `fx:usd_rates` from Redis first and only calls the rate API
 * when Redis has no table younger than an hour; a fetched table is written
 * back for the Next app and other instances. Within this process the table is
 * kept in memory until its hour is up. Redis is an optimisation, never a
 * dependency: when it is missing or slow, the table comes from the API; when
 * the API fails too, callers use FALLBACK_USD_RATES.
 */

import { logger } from '../common/logger.util';

import {
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_TTL_SECONDS,
} from './usd-fallback-rates';

export const USD_RATES_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

/** How long a table is used before a refresh (1 hour). */
export const USD_RATES_TTL_MS = FX_USD_RATES_TTL_SECONDS * 1000;

/** A failed fetch is retried after this long (5 minutes). */
const FAILURE_RETRY_MS = 5 * 60 * 1000;

/** A Redis call slower than this is treated as failed. */
const REDIS_TIMEOUT_MS = 500;

/** The subset of an ioredis client the shared table needs. */
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
  /** Units of each currency per 1 USD. Empty on failure. */
  rates: Record<string, number>;
  /** 'live' from the rate API (directly or via Redis), 'fallback' otherwise. */
  source: 'live' | 'fallback';
  /** When the rate API was called, ISO 8601. */
  fetchedAt: string;
}

let cache: { table: UsdRateTable; expiresAt: number } | null = null;
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

function validRates(input: unknown): Record<string, number> {
  const rates: Record<string, number> = {};
  if (!input || typeof input !== 'object') return rates;
  for (const [code, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      rates[code] = value;
    }
  }
  return rates;
}

/** Parses a stored table; anything malformed counts as missing. */
export function parseSharedUsdRates(
  raw: string | null
): { rates: Record<string, number>; fetchedAt: string } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { rates?: unknown; fetchedAt?: unknown };
    if (typeof data.fetchedAt !== 'string') return null;
    if (Number.isNaN(Date.parse(data.fetchedAt))) return null;
    const rates = validRates(data.rates);
    if (Object.keys(rates).length === 0) return null;
    return { rates, fetchedAt: data.fetchedAt };
  } catch {
    return null;
  }
}

async function readShared(
  store: SharedRateStore | null | undefined
): Promise<UsdRateTable | null> {
  if (!store) return null;
  try {
    const shared = parseSharedUsdRates(
      await withTimeout(store.get(FX_USD_RATES_REDIS_KEY))
    );
    if (!shared) return null;
    const expiresAt = Date.parse(shared.fetchedAt) + USD_RATES_TTL_MS;
    if (expiresAt <= Date.now()) return null;
    const table: UsdRateTable = { ...shared, source: 'live' };
    cache = { table, expiresAt };
    return table;
  } catch (error) {
    logger.warn('[fx] Could not read shared USD rates from Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

async function writeShared(
  store: SharedRateStore | null | undefined,
  table: UsdRateTable
): Promise<void> {
  if (!store) return;
  try {
    await withTimeout(
      store.set(
        FX_USD_RATES_REDIS_KEY,
        JSON.stringify({ rates: table.rates, fetchedAt: table.fetchedAt }),
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

async function fetchTable(
  store: SharedRateStore | null | undefined
): Promise<UsdRateTable> {
  const nowMs = Date.now();
  const fetchedAt = new Date(nowMs).toISOString();
  try {
    const response = await fetch(USD_RATES_URL);
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    const data = (await response.json()) as { rates?: unknown };
    const rates = validRates(data.rates);
    if (Object.keys(rates).length === 0) throw new Error('No rates returned');
    const table: UsdRateTable = { rates, source: 'live', fetchedAt };
    cache = { table, expiresAt: nowMs + USD_RATES_TTL_MS };
    await writeShared(store, table);
    logger.info('[fx] USD rate table fetched', { fetchedAt });
    return table;
  } catch (error) {
    logger.warn('[fx] USD rate API unavailable, using fallback rates', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    const failed: UsdRateTable = { rates: {}, source: 'fallback', fetchedAt };
    // Keep serving an earlier live table if there is one; retry soon.
    const keep = cache?.table.source === 'live' ? cache.table : failed;
    cache = { table: keep, expiresAt: nowMs + FAILURE_RETRY_MS };
    return keep;
  }
}

async function loadTable(
  store: SharedRateStore | null | undefined
): Promise<UsdRateTable> {
  return (await readShared(store)) ?? (await fetchTable(store));
}

/**
 * The current USD rate table: this process's cached table while it is
 * younger than an hour, else the shared Redis table, else a fresh fetch.
 *
 * @param store - Redis client for the table shared with the Next app;
 *   omitted or null, only the in-memory cache and the API are used.
 */
export async function getUsdRateTable(
  store?: SharedRateStore | null
): Promise<UsdRateTable> {
  if (cache && Date.now() < cache.expiresAt) return cache.table;
  if (!inflight) {
    inflight = loadTable(store).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** For tests: forget the cached table. */
export function clearUsdRateCache(): void {
  cache = null;
  inflight = null;
}
