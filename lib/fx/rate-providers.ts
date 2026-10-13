/** Server-only provider requests and validation for complete USD snapshots. */
import { logger } from '@/lib/logger';
import {
  FX_MAX_DAILY_RATE_AGE_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_SUPPORTED_CURRENCIES,
  type FxRateProvider,
} from '@/lib/fx/rate-contract';

export const CURRENCYBEACON_RATES_URL =
  'https://api.currencybeacon.com/v1/latest';
export const FRANKFURTER_RATES_URL = 'https://api.frankfurter.dev/v2/rates';
export const FX_PROVIDER_TIMEOUT_MS = 3000;
export const FX_MAX_FUTURE_MS = 5 * 60 * 1000;

export interface ProviderRateSnapshot {
  rates: Record<string, number>;
  provider: Exclude<FxRateProvider, 'fixed'>;
  rateUpdatedAt: string;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reject dates that JavaScript would silently normalise (such as February 30). */
export function parseFxTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  ) {
    return null;
  }
  const date = value.slice(0, 10);
  const dayMs = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(dayMs) ||
    new Date(dayMs).toISOString().slice(0, 10) !== date ||
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  ) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function validateCompleteUsdRates(
  value: unknown
): Record<string, number> | null {
  const input = object(value);
  if (!input) return null;
  const rates: Record<string, number> = {};
  for (const code of FX_SUPPORTED_CURRENCIES) {
    const rate = input[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)
      return null;
    rates[code] = rate;
  }
  return rates['USD'] === 1 ? rates : null;
}

export function isFreshFxSource(
  provider: FxRateProvider,
  rateUpdatedAt: unknown,
  nowMs = Date.now()
): boolean {
  if (provider === 'fixed') return rateUpdatedAt === null;
  const updatedMs = parseFxTimestamp(rateUpdatedAt);
  const maxAge =
    provider === 'currencybeacon'
      ? FX_MAX_RETAINED_AGE_MS
      : FX_MAX_DAILY_RATE_AGE_MS;
  return (
    updatedMs !== null &&
    updatedMs <= nowMs + FX_MAX_FUTURE_MS &&
    nowMs - updatedMs <= maxAge
  );
}

export function parseCurrencyBeaconRates(
  data: unknown,
  nowMs = Date.now()
): ProviderRateSnapshot | null {
  const envelope = object(data);
  const response = object(envelope?.['response']);
  const meta = object(envelope?.['meta']);
  if (meta && meta['code'] !== 200) return null;
  if (!response || response['base'] !== 'USD') return null;
  const inputRates = object(response['rates']);
  if (
    !inputRates ||
    (inputRates['USD'] !== undefined && inputRates['USD'] !== 1)
  )
    return null;
  // Some providers omit the base's identity quote; the confirmed base supplies it.
  const rates = validateCompleteUsdRates({ ...inputRates, USD: 1 });
  const timestamp = response['timestamp'];
  const epochMs = typeof timestamp === 'number' ? timestamp * 1000 : NaN;
  // A malformed provided date must not be rescued by another, conflicting field.
  const updatedAt =
    response['date'] !== undefined
      ? response['date']
      : Number.isFinite(epochMs) && epochMs > 0 && epochMs <= 8.64e15
        ? new Date(epochMs).toISOString()
        : null;
  if (!rates || !isFreshFxSource('currencybeacon', updatedAt, nowMs))
    return null;
  return {
    rates,
    provider: 'currencybeacon',
    rateUpdatedAt: new Date(
      parseFxTimestamp(updatedAt) as number
    ).toISOString(),
  };
}

export function parseFrankfurterRates(
  data: unknown,
  nowMs = Date.now()
): ProviderRateSnapshot | null {
  if (
    !Array.isArray(data) ||
    data.length !== FX_SUPPORTED_CURRENCIES.length - 1
  )
    return null;
  const rates: Record<string, number> = { USD: 1 };
  let oldestDate = Infinity;
  for (const value of data) {
    const row = object(value);
    if (!row || row['base'] !== 'USD' || typeof row['quote'] !== 'string')
      return null;
    const quote = row['quote'];
    if (
      quote === 'USD' ||
      !(FX_SUPPORTED_CURRENCIES as readonly string[]).includes(quote) ||
      quote in rates
    )
      return null;
    if (
      typeof row['date'] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row['date'])
    )
      return null;
    const sourceDate = `${row['date']}T00:00:00.000Z`;
    if (!isFreshFxSource('frankfurter', sourceDate, nowMs)) return null;
    rates[quote] = row['rate'] as number;
    oldestDate = Math.min(oldestDate, parseFxTimestamp(sourceDate) as number);
  }
  const complete = validateCompleteUsdRates(rates);
  return complete
    ? {
        rates: complete,
        provider: 'frankfurter',
        rateUpdatedAt: new Date(oldestDate).toISOString(),
      }
    : null;
}

async function requestRates(
  url: string,
  headers?: Record<string, string>
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('FX provider timed out'));
    }, FX_PROVIDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
          ...(headers && { headers }),
        });
        if (!response.ok) throw new Error('FX provider request failed');
        return response.json() as Promise<unknown>;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCurrencyBeaconRates(
  apiKey: string
): Promise<ProviderRateSnapshot | null> {
  const url = new URL(CURRENCYBEACON_RATES_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set('symbols', FX_SUPPORTED_CURRENCIES.join(','));
  try {
    const data = await requestRates(url.toString(), {
      Authorization: `Bearer ${apiKey}`,
    });
    const snapshot = parseCurrencyBeaconRates(data);
    if (!snapshot)
      logger.warn('[fx] CurrencyBeacon returned an invalid rate snapshot');
    return snapshot;
  } catch {
    // Never log raw errors: a fetch implementation may include request credentials.
    logger.warn('[fx] CurrencyBeacon unavailable');
    return null;
  }
}

export async function fetchFrankfurterRates(): Promise<ProviderRateSnapshot | null> {
  const url = new URL(FRANKFURTER_RATES_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set(
    'quotes',
    FX_SUPPORTED_CURRENCIES.filter((code) => code !== 'USD').join(',')
  );
  try {
    const data = await requestRates(url.toString());
    const snapshot = parseFrankfurterRates(data);
    if (!snapshot)
      logger.warn('[fx] Frankfurter returned an invalid rate snapshot');
    return snapshot;
  } catch {
    logger.warn('[fx] Frankfurter unavailable');
    return null;
  }
}
