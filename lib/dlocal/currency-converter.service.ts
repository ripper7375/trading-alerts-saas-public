/**
 * Currency Converter Service
 *
 * Handles USD to local currency conversion for dLocal payments.
 *
 * Rates come from the shared USD table in lib/fx/usd-rates.ts (exchangerate-
 * api.com, refreshed hourly), the same table the pages display local prices
 * with, so the price shown and the price charged use one rate. A charge waits
 * for a fresh table (`fresh: true`) rather than using an expired one.
 */

import type { DLocalCurrency, CurrencyConversionResult } from '@/types/dlocal';
import { CURRENCY_USD_RATES } from '@/lib/country-config';
import { clearUsdRateCache, getUsdRateTable } from '@/lib/fx/usd-rates';
import { logger } from '@/lib/logger';

// Supported currencies for validation
const SUPPORTED_CURRENCIES: DLocalCurrency[] = [
  'INR',
  'NGN',
  'PKR',
  'VND',
  'IDR',
  'THB',
  'ZAR',
  'TRY',
  'AED',
];

/**
 * Rates used when the rate API cannot be reached: the same fixed rates the
 * pages display prices at (lib/country-config.ts), so an outage never shows
 * one price and charges another. money-service/src/fx/usd-fallback-rates.ts
 * holds the same numbers (parity test: __tests__/lib/fx/usd-rates-parity.test.ts).
 */
const FALLBACK_RATES = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c, CURRENCY_USD_RATES[c] as number])
) as Record<DLocalCurrency, number>;

/**
 * Validates if a currency is supported
 */
function isSupportedCurrency(currency: string): currency is DLocalCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as DLocalCurrency);
}

/**
 * Gets the exchange rate for a currency (USD base)
 * Uses caching to minimize API calls
 */
export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number> {
  // Validate currency
  if (!isSupportedCurrency(currency)) {
    throw new Error('Unsupported currency');
  }

  // Shared hourly table; a charge waits for a fresh one
  const table = await getUsdRateTable({ fresh: true });
  const live = table.rates[currency];
  if (live) return live;

  logger.warn('Exchange rate unavailable, using fallback rate', { currency });
  return FALLBACK_RATES[currency];
}

/**
 * Converts USD amount to local currency
 */
export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency
): Promise<CurrencyConversionResult> {
  if (usdAmount <= 0) {
    throw new Error('Amount must be positive');
  }

  const exchangeRate = await getExchangeRate(currency);
  const localAmount = Math.round(usdAmount * exchangeRate * 100) / 100;

  return {
    localAmount,
    currency,
    exchangeRate,
    usdAmount,
  };
}

/**
 * Clears the exchange rate cache (for testing)
 */
export function clearExchangeRateCache(): void {
  clearUsdRateCache();
}

/**
 * Gets fallback rate for a currency (for testing/offline mode)
 */
export function getFallbackRate(currency: DLocalCurrency): number {
  return FALLBACK_RATES[currency];
}
