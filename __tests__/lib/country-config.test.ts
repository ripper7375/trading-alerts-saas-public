/**
 * Display-currency conversion in `lib/country-config.ts`.
 *
 * The rate must follow the display currency, not the user's country: a Thai
 * user who picks GBP used to see a baht figure behind a pound sign
 * ($29 → "£1,015" instead of "£22.62").
 *
 * @module __tests__/lib/country-config.test
 */

import {
  CURRENCY_USD_RATES,
  SUPPORTED_COUNTRIES,
  exchangeRateForCurrency,
  formatCurrencyAmount,
  isSupportedCurrency,
} from '@/lib/country-config';

describe('exchangeRateForCurrency', () => {
  it("gives every supported country's currency that country's rate", () => {
    for (const country of Object.values(SUPPORTED_COUNTRIES)) {
      expect(exchangeRateForCurrency(country.currency)).toBe(
        country.exchangeRate
      );
    }
  });

  it('offers no currency without a country behind its rate', () => {
    for (const code of ['CNY', 'AUD', 'CAD']) {
      expect(CURRENCY_USD_RATES[code]).toBeUndefined();
      expect(isSupportedCurrency(code)).toBe(false);
    }
  });

  it('is case-insensitive and does not convert an unknown code', () => {
    expect(exchangeRateForCurrency('thb')).toBe(35);
    expect(exchangeRateForCurrency('XYZ')).toBe(1);
    expect(exchangeRateForCurrency(undefined)).toBe(1);
  });
});

describe('formatCurrencyAmount', () => {
  it('converts with the display currency rate (Thai language, GBP)', () => {
    // 29 × 0.78 (GBP), not 29 × 35 (Thailand's THB rate).
    expect(formatCurrencyAmount(29, { currency: 'GBP', language: 'th' })).toBe(
      '£22.62'
    );
  });

  it('converts to THB for a Thai user who keeps baht', () => {
    expect(formatCurrencyAmount(29, { currency: 'THB', language: 'th' })).toBe(
      '฿1,015'
    );
  });

  it('shows a withdrawn currency as plain USD, not USD behind its symbol', () => {
    expect(
      formatCurrencyAmount(29, { currency: 'CNY', language: 'en-GB' })
    ).toBe('US$29.00');
  });

  it('leaves USD unconverted', () => {
    expect(
      formatCurrencyAmount(29, { currency: 'USD', language: 'en-US' })
    ).toBe('$29.00');
  });
});
