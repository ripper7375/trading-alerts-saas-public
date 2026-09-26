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
import { clearUsdRateCache, getUsdRateTable } from '@/lib/fx/usd-rates';
import { logger } from '@/lib/logger';

// Fallback rates for development/offline mode (updated periodically)
const FALLBACK_RATES: Record<DLocalCurrency, number> = {
  INR: 83.12,
  NGN: 1505.5,
  PKR: 278.45,
  VND: 24750.0,
  IDR: 15680.0,
  THB: 35.25,
  ZAR: 18.65,
  TRY: 32.15,
  AED: 3.67,
};

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
