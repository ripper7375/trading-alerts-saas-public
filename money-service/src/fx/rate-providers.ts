/** Server-only provider adapters; each successful result is a complete table. */
import {
  FX_MAX_DAILY_RATE_AGE_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_SUPPORTED_CURRENCIES,
  type FxRateProvider,
} from './usd-fallback-rates';

export const CURRENCYBEACON_URL = 'https://api.currencybeacon.com/v1/latest';
export const FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rates';
export const FX_PROVIDER_TIMEOUT_MS = 3000;
export const FX_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface ProviderSnapshot {
  rates: Record<string, number>;
  provider: Exclude<FxRateProvider, 'fixed'>;
  rateUpdatedAt: string;
}

function object(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

/** Require every supported quote; no mixing a partial table with fixed rates. */
export function completeUsdRates(
  input: unknown
): Record<string, number> | null {
  const data = object(input);
  if (!data) return null;
  const rates: Record<string, number> = {};
  for (const code of FX_SUPPORTED_CURRENCIES) {
    const value = data[code];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    rates[code] = value;
  }
  return rates.USD === 1 ? rates : null;
}

/** Parse ISO timestamps without accepting date-only values or rolled dates. */
export function utcTimestamp(input: unknown): number | null {
  if (
    typeof input !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      input
    )
  ) {
    return null;
  }
  const dayMs = Date.parse(`${input.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(dayMs) ||
    new Date(dayMs).toISOString().slice(0, 10) !== input.slice(0, 10) ||
    Number(input.slice(11, 13)) > 23 ||
    Number(input.slice(14, 16)) > 59 ||
    Number(input.slice(17, 19)) > 59
  )
    return null;
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validSourceTime(
  provider: Exclude<FxRateProvider, 'fixed'>,
  rateUpdatedAt: unknown,
  nowMs = Date.now()
): boolean {
  const updatedMs = utcTimestamp(rateUpdatedAt);
  const maxAge =
    provider === 'currencybeacon'
      ? FX_MAX_RETAINED_AGE_MS
      : FX_MAX_DAILY_RATE_AGE_MS;
  return (
    updatedMs !== null &&
    updatedMs <= nowMs + FX_MAX_FUTURE_SKEW_MS &&
    nowMs - updatedMs <= maxAge
  );
}

export function parseCurrencyBeacon(
  input: unknown,
  nowMs = Date.now()
): ProviderSnapshot | null {
  const payload = object(input);
  const response = object(payload?.response);
  const meta = object(payload?.meta);
  if (!response || response.base !== 'USD' || (meta && meta.code !== 200))
    return null;
  const suppliedRates = object(response.rates);
  if (
    !suppliedRates ||
    (suppliedRates.USD !== undefined && suppliedRates.USD !== 1)
  )
    return null;
  const rates = completeUsdRates({ ...suppliedRates, USD: 1 });
  if (!rates) return null;
  let updatedMs: number | null;
  if (response.date !== undefined) {
    updatedMs = utcTimestamp(response.date);
  } else if (response.timestamp !== undefined) {
    updatedMs =
      typeof response.timestamp === 'number' &&
      Number.isFinite(response.timestamp) &&
      response.timestamp > 0
        ? response.timestamp * 1000
        : null;
  } else {
    updatedMs = null;
  }
  if (
    updatedMs === null ||
    !Number.isFinite(updatedMs) ||
    updatedMs <= 0 ||
    updatedMs > nowMs + FX_MAX_FUTURE_SKEW_MS ||
    nowMs - updatedMs > FX_MAX_RETAINED_AGE_MS
  )
    return null;
  return {
    rates,
    provider: 'currencybeacon',
    rateUpdatedAt: new Date(updatedMs).toISOString(),
  };
}

export function parseFrankfurter(
  input: unknown,
  nowMs = Date.now()
): ProviderSnapshot | null {
  const quotes = FX_SUPPORTED_CURRENCIES.filter((code) => code !== 'USD');
  if (!Array.isArray(input) || input.length !== quotes.length) return null;
  const rates: Record<string, number> = { USD: 1 };
  let oldestMs = Number.POSITIVE_INFINITY;
  for (const item of input) {
    const row = object(item);
    if (
      !row ||
      row.base !== 'USD' ||
      typeof row.quote !== 'string' ||
      !quotes.includes(row.quote as (typeof quotes)[number]) ||
      Object.prototype.hasOwnProperty.call(rates, row.quote) ||
      typeof row.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
    )
      return null;
    const updatedAt = `${row.date}T00:00:00.000Z`;
    const updatedMs = utcTimestamp(updatedAt);
    if (updatedMs === null || !validSourceTime('frankfurter', updatedAt, nowMs))
      return null;
    rates[row.quote] = row.rate as number;
    oldestMs = Math.min(oldestMs, updatedMs);
  }
  const complete = completeUsdRates(rates);
  return complete
    ? {
        rates: complete,
        provider: 'frankfurter',
        rateUpdatedAt: new Date(oldestMs).toISOString(),
      }
    : null;
}

async function fetchJson(
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
          headers,
          signal: controller.signal,
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

export async function fetchCurrencyBeacon(
  apiKey: string
): Promise<ProviderSnapshot> {
  const url = new URL(CURRENCYBEACON_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set('symbols', FX_SUPPORTED_CURRENCIES.join(','));
  const snapshot = parseCurrencyBeacon(
    await fetchJson(url.toString(), {
      Authorization: `Bearer ${apiKey}`,
    })
  );
  if (!snapshot) throw new Error('Invalid CurrencyBeacon snapshot');
  return snapshot;
}

export async function fetchFrankfurter(): Promise<ProviderSnapshot> {
  const url = new URL(FRANKFURTER_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set(
    'quotes',
    FX_SUPPORTED_CURRENCIES.filter((code) => code !== 'USD').join(',')
  );
  const snapshot = parseFrankfurter(await fetchJson(url.toString()));
  if (!snapshot) throw new Error('Invalid Frankfurter snapshot');
  return snapshot;
}
