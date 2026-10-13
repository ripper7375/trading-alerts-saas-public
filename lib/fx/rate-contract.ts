/** Provider-neutral, client-safe contract for subscription USD conversion. */
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

export const FX_USD_RATES_SCHEMA_VERSION = 2;
export const FX_USD_RATES_REDIS_KEY = 'fx:usd_rates:v2';
export const FX_USD_RATES_TTL_SECONDS = 3600;
export const FX_FAILURE_RETRY_MS = 15 * 60 * 1000;
export const FX_MAX_RETAINED_AGE_MS = 8 * 60 * 60 * 1000;
export const FX_MAX_DAILY_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const FX_BROWSER_REFRESH_MS = 5 * 60 * 1000;

/** The time the provider published a rate is distinct from our retrieval time. */
export interface FxRateMetadata {
  provider?: FxRateProvider;
  rateUpdatedAt?: string | null;
}
