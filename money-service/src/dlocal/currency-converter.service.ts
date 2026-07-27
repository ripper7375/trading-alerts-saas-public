/**
 * Currency Converter Service (Session 4A-9, File 6/10)
 *
 * Ported byte-for-byte from lib/dlocal/currency-converter.service.ts -- a
 * real, direct dependency of app/api/payments/dlocal/create/route.ts that
 * the 4A-9 order's own File 5/6 list omitted (same class of gap as File
 * 4/10's missing webhook-handlers.ts). No policy decision here, just USD
 * to local currency conversion for dLocal payments -- ported as-is.
 */

import { logger } from '../common/logger.util';

import type { DLocalCurrency, CurrencyConversionResult } from './dlocal.types';

// Cache for exchange rates with 1-hour TTL
const exchangeRateCache: Map<
  DLocalCurrency,
  { rate: number; timestamp: number }
> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

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
};

const SUPPORTED_CURRENCIES: DLocalCurrency[] = [
  'INR',
  'NGN',
  'PKR',
  'VND',
  'IDR',
  'THB',
  'ZAR',
  'TRY',
];

function isSupportedCurrency(currency: string): currency is DLocalCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as DLocalCurrency);
}

async function fetchExchangeRateFromAPI(
  currency: DLocalCurrency
): Promise<number> {
  try {
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[currency]) {
      throw new Error(`Exchange rate not found for ${currency}`);
    }

    return data.rates[currency];
  } catch (error) {
    logger.warn('Failed to fetch exchange rate from API, using fallback rate', {
      currency,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (!FALLBACK_RATES[currency]) {
      throw new Error(`Unsupported currency: ${currency}`);
    }
    return FALLBACK_RATES[currency];
  }
}

/**
 * Gets the exchange rate for a currency (USD base). Uses caching to
 * minimize API calls.
 */
export async function getExchangeRate(
  currency: DLocalCurrency
): Promise<number> {
  if (!isSupportedCurrency(currency)) {
    throw new Error('Unsupported currency');
  }

  const cached = exchangeRateCache.get(currency);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    logger.debug('Using cached exchange rate', {
      currency,
      rate: cached.rate,
    });
    return cached.rate;
  }

  const rate = await fetchExchangeRateFromAPI(currency);

  exchangeRateCache.set(currency, {
    rate,
    timestamp: Date.now(),
  });

  logger.info('Exchange rate fetched', { currency, rate });
  return rate;
}

/**
 * Converts USD amount to local currency.
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

/** Clears the exchange rate cache (for testing). */
export function clearExchangeRateCache(): void {
  exchangeRateCache.clear();
}

/** Gets fallback rate for a currency (for testing/offline mode). */
export function getFallbackRate(currency: DLocalCurrency): number {
  return FALLBACK_RATES[currency];
}
