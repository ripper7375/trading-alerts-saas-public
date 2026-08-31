/**
 * dLocal Integration Constants (mobile reference)
 *
 * Mirrors lib/dlocal/constants.ts from the monolith -- 9 supported
 * countries (incl. UAE/AE, added 2026-08-30), their currencies, and
 * per-country local payment methods. Reference/UI-only: no live API calls,
 * matching this seed app's all-mock-data style.
 */

import type {
  DLocalCountry,
  DLocalCurrency,
  CountryConfig,
} from '@/types/dlocal';

/** List of supported dLocal countries (9 total) */
export const DLOCAL_SUPPORTED_COUNTRIES: DLocalCountry[] = [
  'IN', // India
  'NG', // Nigeria
  'PK', // Pakistan
  'VN', // Vietnam
  'ID', // Indonesia
  'TH', // Thailand
  'ZA', // South Africa
  'TR', // Turkey
  'AE', // United Arab Emirates
];

/** Mapping of country codes to their currencies */
export const COUNTRY_CURRENCY_MAP: Record<DLocalCountry, DLocalCurrency> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
  AE: 'AED',
};

/** Country names for display */
export const COUNTRY_NAMES: Record<DLocalCountry, string> = {
  IN: 'India',
  NG: 'Nigeria',
  PK: 'Pakistan',
  VN: 'Vietnam',
  ID: 'Indonesia',
  TH: 'Thailand',
  ZA: 'South Africa',
  TR: 'Turkey',
  AE: 'United Arab Emirates',
};

/** Country flags for display */
export const COUNTRY_FLAGS: Record<DLocalCountry, string> = {
  IN: '🇮🇳',
  NG: '🇳🇬',
  PK: '🇵🇰',
  VN: '🇻🇳',
  ID: '🇮🇩',
  TH: '🇹🇭',
  ZA: '🇿🇦',
  TR: '🇹🇷',
  AE: '🇦🇪',
};

/** Available payment methods per country */
export const PAYMENT_METHODS: Record<DLocalCountry, string[]> = {
  IN: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  NG: ['Bank Transfer', 'USSD', 'Paystack'],
  PK: ['JazzCash', 'Easypaisa'],
  VN: ['VNPay', 'MoMo', 'ZaloPay'],
  ID: ['GoPay', 'OVO', 'Dana', 'ShopeePay'],
  TH: ['TrueMoney', 'Rabbit LINE Pay', 'Thai QR'],
  ZA: ['Instant EFT', 'EFT'],
  TR: ['Bank Transfer', 'Local Cards'],
  AE: ['Local Cards', 'Apple Pay', 'Bank Transfer'],
};

/** Currency symbols for display */
export const CURRENCY_SYMBOLS: Record<DLocalCurrency, string> = {
  INR: '₹',
  NGN: '₦',
  PKR: 'Rs',
  VND: '₫',
  IDR: 'Rp',
  THB: '฿',
  ZAR: 'R',
  TRY: '₺',
  AED: 'AED',
};

/** Currency display names */
export const CURRENCY_NAMES: Record<DLocalCurrency, string> = {
  INR: 'Indian Rupee',
  NGN: 'Nigerian Naira',
  PKR: 'Pakistani Rupee',
  VND: 'Vietnamese Dong',
  IDR: 'Indonesian Rupiah',
  THB: 'Thai Baht',
  ZAR: 'South African Rand',
  TRY: 'Turkish Lira',
  AED: 'UAE Dirham',
};

/**
 * Approximate reference exchange rates (USD -> local currency). Static,
 * for UI display only -- matches how the real PriceDisplay.tsx falls back
 * when its live conversion API is unavailable.
 */
export const FALLBACK_RATES: Record<DLocalCurrency, number> = {
  INR: 83.0,
  NGN: 780.0,
  PKR: 278.0,
  VND: 24500.0,
  IDR: 15600.0,
  THB: 35.0,
  ZAR: 18.5,
  TRY: 32.0,
  AED: 3.67,
};

/** Full country configurations */
export const COUNTRY_CONFIGS: CountryConfig[] = DLOCAL_SUPPORTED_COUNTRIES.map(
  (code) => ({
    code,
    name: COUNTRY_NAMES[code],
    currency: COUNTRY_CURRENCY_MAP[code],
    paymentMethods: PAYMENT_METHODS[code],
  })
);

export function getCurrency(country: DLocalCountry): DLocalCurrency {
  return COUNTRY_CURRENCY_MAP[country];
}

export function getPaymentMethods(country: DLocalCountry): string[] {
  return PAYMENT_METHODS[country] || [];
}
