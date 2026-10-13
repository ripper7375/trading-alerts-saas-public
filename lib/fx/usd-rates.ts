/** Server-only hourly USD rates, shared by subscription display and dLocal quotes. */
import { CURRENCY_USD_RATES, type DisplayUsdRates } from '@/lib/country-config';
import {
  FX_FAILURE_RETRY_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_USD_RATES_SCHEMA_VERSION,
  FX_USD_RATES_TTL_SECONDS,
  type FxRateMetadata,
} from '@/lib/fx/rate-contract';
import {
  CURRENCYBEACON_RATES_URL,
  fetchCurrencyBeaconRates,
  fetchFrankfurterRates,
  isFreshFxSource,
} from '@/lib/fx/rate-providers';
import {
  readSharedUsdRates,
  writeSharedUsdRates,
} from '@/lib/fx/shared-rate-store';

/** Kept for existing consumers; authentication is sent only in the server header. */
export const USD_RATES_URL = CURRENCYBEACON_RATES_URL;
export const USD_RATES_TTL_MS = FX_USD_RATES_TTL_SECONDS * 1000;

export interface UsdRateTable extends FxRateMetadata {
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  fetchedAt: string;
}

let cache: { table: UsdRateTable; expiresAt: number } | null = null;
let inflight: Promise<UsdRateTable> | null = null;

function mayRetain(table: UsdRateTable, nowMs: number): boolean {
  return (
    table.provider !== 'fixed' &&
    table.provider !== undefined &&
    nowMs - Date.parse(table.fetchedAt) <= FX_MAX_RETAINED_AGE_MS &&
    isFreshFxSource(table.provider, table.rateUpdatedAt, nowMs)
  );
}

async function fetchTable(): Promise<UsdRateTable> {
  const apiKey = process.env['CURRENCYBEACON_API_KEY']?.trim();
  let snapshot = apiKey ? await fetchCurrencyBeaconRates(apiKey) : null;
  const primaryFailed = !!apiKey && !snapshot;
  if (!snapshot) snapshot = await fetchFrankfurterRates();
  const nowMs = Date.now();
  const previous = cache?.table;
  const table: UsdRateTable = snapshot
    ? {
        ...snapshot,
        source: snapshot.provider === 'currencybeacon' ? 'live' : 'fallback',
        fetchedAt: new Date(nowMs).toISOString(),
      }
    : previous && mayRetain(previous, nowMs)
      ? previous
      : {
          rates: { ...CURRENCY_USD_RATES },
          provider: 'fixed',
          rateUpdatedAt: null,
          source: 'fallback',
          fetchedAt: new Date(nowMs).toISOString(),
        };
  const retryMs = primaryFailed ? FX_FAILURE_RETRY_MS : USD_RATES_TTL_MS;
  let expiresAt = nowMs + retryMs;
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
  cache = { table, expiresAt };
  if (table.provider === 'currencybeacon' || table.provider === 'frankfurter') {
    await writeSharedUsdRates({
      schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
      rates: table.rates,
      provider: table.provider,
      rateUpdatedAt: table.rateUpdatedAt as string,
      fetchedAt: table.fetchedAt,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }
  return table;
}

async function loadTable(): Promise<UsdRateTable> {
  const shared = await readSharedUsdRates();
  if (shared) {
    const table: UsdRateTable = {
      rates: shared.rates,
      provider: shared.provider,
      rateUpdatedAt: shared.rateUpdatedAt,
      fetchedAt: shared.fetchedAt,
      source: shared.provider === 'currencybeacon' ? 'live' : 'fallback',
    };
    cache = { table, expiresAt: Date.parse(shared.expiresAt) };
    return table;
  }
  return fetchTable();
}

function refresh(): Promise<UsdRateTable> {
  if (!inflight)
    inflight = loadTable().finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Fresh callers wait for expiry refresh; optional stale callers stay age-bounded. */
export async function getUsdRateTable(
  options: { fresh?: boolean } = {}
): Promise<UsdRateTable> {
  const nowMs = Date.now();
  if (
    cache &&
    nowMs < cache.expiresAt &&
    (cache.table.provider === 'fixed' || mayRetain(cache.table, nowMs))
  )
    return cache.table;
  if (cache && !options.fresh && mayRetain(cache.table, nowMs)) {
    void refresh();
    return cache.table;
  }
  return refresh();
}

export type { DisplayUsdRates };

/** Public display refreshes wait for an expired snapshot rather than hiding refresh. */
export async function getDisplayUsdRates(
  options: { fresh?: boolean } = { fresh: true }
): Promise<DisplayUsdRates> {
  const table = await getUsdRateTable(options);
  return { ...table, rates: { ...table.rates } };
}

export function clearUsdRateCache(): void {
  cache = null;
  inflight = null;
}
