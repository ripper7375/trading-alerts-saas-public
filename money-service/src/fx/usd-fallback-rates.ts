/**
 * Fixed USD rates used when the rate API cannot be reached, and the Redis
 * contract for the rate table shared with the Next app.
 *
 * FALLBACK_USD_RATES holds the same numbers as the Next app's display rates
 * (lib/country-config.ts CURRENCY_USD_RATES), so during an outage the price a
 * page shows and the price dLocal charges use one rate. The Redis key, TTL
 * and JSON shape match lib/fx/shared-rate-store.ts. Import-free, so the Next
 * parity test (__tests__/lib/fx/usd-rates-parity.test.ts) can import it.
 */

/** Units of each currency per 1 USD. */
export const FALLBACK_USD_RATES: Readonly<Record<string, number>> = {
  USD: 1.0,
  GBP: 0.78,
  EUR: 0.92,
  JPY: 155,
  INR: 83.5,
  NGN: 1500,
  PKR: 278,
  VND: 25400,
  IDR: 15800,
  THB: 35.0,
  ZAR: 18.5,
  TRY: 32.5,
  AED: 3.67,
  KRW: 1350,
  BRL: 5.65,
};

export const FX_SUPPORTED_CURRENCIES = [
  'USD',
  'GBP',
  'EUR',
  'JPY',
  'INR',
  'NGN',
  'PKR',
  'VND',
  'IDR',
  'THB',
  'ZAR',
  'TRY',
  'AED',
  'KRW',
  'BRL',
] as const;

export type FxRateProvider = 'currencybeacon' | 'frankfurter' | 'fixed';

/** Versioned JSON: schemaVersion, rates, provider, source/fetch/expiry times. */
export const FX_USD_RATES_SCHEMA_VERSION = 2;
export const FX_USD_RATES_REDIS_KEY = 'fx:usd_rates:v2';

/** Redis TTL of the shared table (1 hour), in seconds. */
export const FX_USD_RATES_TTL_SECONDS = 3600;
export const FX_FAILURE_RETRY_MS = 15 * 60 * 1000;
export const FX_MAX_RETAINED_AGE_MS = 8 * 60 * 60 * 1000;
export const FX_MAX_DAILY_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
