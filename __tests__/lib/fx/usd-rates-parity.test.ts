/**
 * Parity guard: Next ↔ money-service exchange rates.
 *
 * 1. The fallback rates (used while exchangerate-api.com is down) are the
 *    same in both apps, so an outage never shows one local price and charges
 *    another: the display rates (lib/country-config.ts), the Next dLocal
 *    fallback and money-service's FALLBACK_USD_RATES.
 * 2. Both apps share the live table through the same Redis key and TTL.
 *
 * money-service/src/fx/usd-fallback-rates.ts is import-free by design, so it
 * is imported directly.
 */

import { CURRENCY_USD_RATES } from '@/lib/country-config';
import { getFallbackRate } from '@/lib/dlocal/currency-converter.service';
import {
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_TTL_SECONDS,
} from '@/lib/fx/shared-rate-store';
import type { DLocalCurrency } from '@/types/dlocal';
import * as money from '../../../money-service/src/fx/usd-fallback-rates';

const DLOCAL_CURRENCIES: DLocalCurrency[] = [
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

describe('exchange-rate parity (Next ↔ money-service)', () => {
  it('money-service fallback rates equal the Next display rates, currency for currency', () => {
    expect({ ...money.FALLBACK_USD_RATES }).toEqual(CURRENCY_USD_RATES);
  });

  it.each([
    'THB',
    'INR',
    'NGN',
    'PKR',
    'VND',
    'IDR',
    'ZAR',
    'TRY',
    'AED',
    'GBP',
    'EUR',
    'JPY',
  ])('%s has one fallback rate in both apps', (currency) => {
    expect(money.FALLBACK_USD_RATES[currency]).toBeDefined();
    expect(money.FALLBACK_USD_RATES[currency]).toBe(
      CURRENCY_USD_RATES[currency]
    );
  });

  it('the Next dLocal charge falls back to the same rates as the display', () => {
    for (const currency of DLOCAL_CURRENCIES) {
      expect(getFallbackRate(currency)).toBe(CURRENCY_USD_RATES[currency]);
    }
  });

  it('both apps share the live table under the same Redis key and TTL', () => {
    expect(money.FX_USD_RATES_REDIS_KEY).toBe(FX_USD_RATES_REDIS_KEY);
    expect(FX_USD_RATES_REDIS_KEY).toBe('fx:usd_rates');
    expect(money.FX_USD_RATES_TTL_SECONDS).toBe(FX_USD_RATES_TTL_SECONDS);
    expect(FX_USD_RATES_TTL_SECONDS).toBe(3600);
  });
});
