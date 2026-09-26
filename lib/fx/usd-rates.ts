/**
 * USD exchange rates from exchangerate-api.com: ONE source for the rate dLocal
 * charges with (lib/dlocal/currency-converter.service.ts) and the rate pages
 * display local prices at (formatCurrency / formatCurrencyAmount).
 *
 * The whole USD table is fetched at most once an hour and shared: through
 * Redis (`fx:usd_rates`, lib/fx/shared-rate-store.ts) with money-service and
 * every other server instance, and in memory within this process. A refresh
 * reads Redis first and only calls the rate API when Redis has no table
 * younger than an hour; a fetched table is written back for the others.
 * Without Redis each process falls back to its own hourly fetch. Display callers get the cached table immediately, even when it is
 * older than an hour (a refresh then runs in the background), so a slow rate
 * API never holds up a page. Charge callers (`fresh: true`) wait for the
 * refresh instead. When the API cannot be reached, callers fall back to the
 * fixed rates in lib/country-config.ts (display) or the dLocal fallback table
 * (charges), and `source` says so.
 *
 * Server-only. The browser receives the display rates through the root layout
 * (LocaleProvider `initialUsdRates`) and `GET /api/fx/rates`.
 *
 * @module lib/fx/usd-rates
 */

import { CURRENCY_USD_RATES, type DisplayUsdRates } from '@/lib/country-config';
import {
  readSharedUsdRates,
  writeSharedUsdRates,
} from '@/lib/fx/shared-rate-store';
import { logger } from '@/lib/logger';

export const USD_RATES_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

/** How long a fetched table is used before a refresh (1 hour). */
export const USD_RATES_TTL_MS = 60 * 60 * 1000;

/** A failed fetch is retried after this long (5 minutes). */
const FAILURE_RETRY_MS = 5 * 60 * 1000;

/** A request that takes longer than this is treated as failed. */
const FETCH_TIMEOUT_MS = 3000;

export interface UsdRateTable {
  /** Units of each currency per 1 USD (e.g. GBP 0.74). Empty on failure. */
  rates: Record<string, number>;
  /** 'live' from the rate API, 'fallback' when it could not be reached. */
  source: 'live' | 'fallback';
  /** When the table was fetched (or the failed attempt made), ISO 8601. */
  fetchedAt: string;
}

let cache: { table: UsdRateTable; expiresAt: number } | null = null;
let inflight: Promise<UsdRateTable> | null = null;

async function fetchTable(): Promise<UsdRateTable> {
  const nowMs = Date.now();
  const fetchedAt = new Date(nowMs).toISOString();
  try {
    // AbortSignal.timeout exists in the server runtime; skip it where absent.
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
        : undefined;
    const response = await fetch(USD_RATES_URL, {
      next: { revalidate: 3600 },
      ...(signal && { signal }),
    } as RequestInit);
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    const data = (await response.json()) as { rates?: Record<string, unknown> };
    const rates: Record<string, number> = {};
    for (const [code, value] of Object.entries(data.rates ?? {})) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        rates[code] = value;
      }
    }
    if (Object.keys(rates).length === 0) throw new Error('No rates returned');
    const table: UsdRateTable = {
      rates,
      source: 'live',
      fetchedAt,
    };
    cache = { table, expiresAt: nowMs + USD_RATES_TTL_MS };
    await writeSharedUsdRates({ rates, fetchedAt });
    return table;
  } catch (error) {
    logger.warn('[fx] USD rate API unavailable, using fallback rates', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    const table: UsdRateTable = {
      rates: {},
      source: 'fallback',
      fetchedAt,
    };
    // Keep serving an earlier live table if there is one; retry soon.
    const keep = cache?.table.source === 'live' ? cache.table : table;
    cache = { table: keep, expiresAt: nowMs + FAILURE_RETRY_MS };
    return keep;
  }
}

/**
 * The table another instance or money-service published in Redis, when it is
 * younger than an hour; otherwise a fresh fetch from the rate API. The shared
 * table keeps its own fetch time, so every reader expires it together.
 */
async function loadTable(): Promise<UsdRateTable> {
  const shared = await readSharedUsdRates();
  if (shared) {
    const expiresAt = Date.parse(shared.fetchedAt) + USD_RATES_TTL_MS;
    if (expiresAt > Date.now()) {
      const table: UsdRateTable = {
        rates: shared.rates,
        source: 'live',
        fetchedAt: shared.fetchedAt,
      };
      cache = { table, expiresAt };
      return table;
    }
  }
  return fetchTable();
}

function refresh(): Promise<UsdRateTable> {
  if (!inflight) {
    inflight = loadTable().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * The current USD rate table.
 *
 * @param options.fresh - Wait for a refresh when the table is older than an
 *   hour (charges). Without it, an expired table is returned at once and
 *   refreshed in the background (display).
 */
export async function getUsdRateTable(
  options: { fresh?: boolean } = {}
): Promise<UsdRateTable> {
  if (cache && Date.now() < cache.expiresAt) return cache.table;
  if (cache && !options.fresh) {
    void refresh();
    return cache.table;
  }
  return refresh();
}

export type { DisplayUsdRates };

/**
 * Live rates for the display currencies (those in lib/country-config.ts),
 * with the fixed rate for any currency the API did not return. This is what
 * the browser's formatCurrency() and Server Components use.
 */
export async function getDisplayUsdRates(): Promise<DisplayUsdRates> {
  const table = await getUsdRateTable();
  const rates: Record<string, number> = {};
  let live = 0;
  for (const [code, fixed] of Object.entries(CURRENCY_USD_RATES)) {
    const current = code === 'USD' ? 1 : table.rates[code];
    if (current) live++;
    rates[code] = current ?? fixed;
  }
  return {
    rates,
    source: table.source === 'live' && live > 0 ? 'live' : 'fallback',
    fetchedAt: table.fetchedAt,
  };
}

/** For tests: forget the cached table. */
export function clearUsdRateCache(): void {
  cache = null;
  inflight = null;
}
