/**
 * Currency Converter Service (Session 4A-9, File 6/10)
 *
 * Ported from lib/dlocal/currency-converter.service.ts -- a
 * real, direct dependency of app/api/payments/dlocal/create/route.ts that
 * the 4A-9 order's own File 5/6 list omitted (same class of gap as File
 * 4/10's missing webhook-handlers.ts). No policy decision here, just USD
 * to local currency conversion for dLocal payments. Rates come from the USD
 * table shared with the Next app through Redis (../fx/usd-rates.ts).
 */

import { logger } from '../common/logger.util';
import { FALLBACK_USD_RATES } from '../fx/usd-fallback-rates';
import {
  clearUsdRateCache,
  getUsdRateTable,
  type SharedRateStore,
} from '../fx/usd-rates';

import type { DLocalCurrency, CurrencyConversionResult } from './dlocal.types';

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
 * Next app displays prices at, so an outage never shows one price and
 * charges another (see ../fx/usd-fallback-rates.ts).
 */
const FALLBACK_RATES = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c, FALLBACK_USD_RATES[c] as number])
) as Record<DLocalCurrency, number>;

function isSupportedCurrency(currency: string): currency is DLocalCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as DLocalCurrency);
}

/**
 * Gets the exchange rate for a currency (USD base) from the hourly USD table
 * shared with the Next app (../fx/usd-rates.ts).
 *
 * @param store - Redis client holding the shared table (optional)
 */
export async function getExchangeRate(
  currency: DLocalCurrency,
  store?: SharedRateStore | null
): Promise<number> {
  if (!isSupportedCurrency(currency)) {
    throw new Error('Unsupported currency');
  }

  const table = await getUsdRateTable(store);
  const live = table.rates[currency];
  if (live) return live;

  logger.warn('Exchange rate unavailable, using fallback rate', { currency });
  return FALLBACK_RATES[currency];
}

/**
 * Converts USD amount to local currency.
 */
export async function convertUSDToLocal(
  usdAmount: number,
  currency: DLocalCurrency,
  store?: SharedRateStore | null
): Promise<CurrencyConversionResult> {
  if (usdAmount <= 0) {
    throw new Error('Amount must be positive');
  }

  const exchangeRate = await getExchangeRate(currency, store);
  const localAmount = Math.round(usdAmount * exchangeRate * 100) / 100;

  return {
    localAmount,
    currency,
    exchangeRate,
    usdAmount,
  };
}

/** Clears the exchange rate cache (for testing). */
export function clearExchangeRateCache(): void {
  clearUsdRateCache();
}

/** Gets fallback rate for a currency (for testing/offline mode). */
export function getFallbackRate(currency: DLocalCurrency): number {
  return FALLBACK_RATES[currency];
}
