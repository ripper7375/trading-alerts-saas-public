/**
 * dLocal Integration Constants
 *
 * Defines supported countries, currencies, payment methods,
 * and pricing for dLocal payment processing.
 *
 * NOTE: For dynamic pricing from SystemConfig, use:
 * - Backend: getBasePriceUsd() from lib/affiliate/constants
 * - Frontend: useAffiliateConfig() hook
 *
 * The PRICING.MONTHLY_USD constant here is a default fallback value.
 */

import type {
  DLocalCountry,
  DLocalCurrency,
  CountryConfig,
} from '@/types/dlocal';

/**
 * List of supported dLocal countries (8 total)
 */
export const DLOCAL_SUPPORTED_COUNTRIES: DLocalCountry[] = [
  'IN', // India
  'NG', // Nigeria
  'PK', // Pakistan
  'VN', // Vietnam
  'ID', // Indonesia
  'TH', // Thailand
  'ZA', // South Africa
  'TR', // Turkey
];

/**
 * Mapping of country codes to their currencies
 */
export const COUNTRY_CURRENCY_MAP: Record<DLocalCountry, DLocalCurrency> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
};

/**
 * Country names for display
 */
export const COUNTRY_NAMES: Record<DLocalCountry, string> = {
  IN: 'India',
  NG: 'Nigeria',
  PK: 'Pakistan',
  VN: 'Vietnam',
  ID: 'Indonesia',
  TH: 'Thailand',
  ZA: 'South Africa',
  TR: 'Turkey',
};

/**
 * Available payment methods per country
 */
export const PAYMENT_METHODS: Record<DLocalCountry, string[]> = {
  IN: ['UPI', 'Paytm', 'PhonePe', 'Net Banking'],
  NG: ['Bank Transfer', 'USSD', 'Paystack'],
  PK: ['JazzCash', 'Easypaisa'],
  VN: ['VNPay', 'MoMo', 'ZaloPay'],
  ID: ['GoPay', 'OVO', 'Dana', 'ShopeePay'],
  TH: ['TrueMoney', 'Rabbit LINE Pay', 'Thai QR'],
  ZA: ['Instant EFT', 'EFT'],
  TR: ['Bank Transfer', 'Local Cards'],
};

/**
 * Default USD pricing for plans
 *
 * ⚠️ IMPORTANT: These are fallback default values only.
 *
 * For dynamic prices from SystemConfig, use:
 * - Backend: getBasePriceUsd() and getThreeDayPriceUsd() from lib/affiliate/constants
 * - Frontend: useAffiliateConfig() hook (provides regularPrice and threeDayPrice)
 */
export const PRICING = {
  /** Default 3-day trial price - use getThreeDayPriceUsd() for dynamic value from SystemConfig */
  THREE_DAY_USD: 1.99,
  /** Default monthly price - use getBasePriceUsd() for dynamic value from SystemConfig */
  MONTHLY_USD: 29.0,
} as const;

/**
 * Plan durations in days
 */
export const PLAN_DURATION = {
  THREE_DAY: 3,
  MONTHLY: 30,
} as const;

/**
 * Full country configurations
 */
export const COUNTRY_CONFIGS: CountryConfig[] = DLOCAL_SUPPORTED_COUNTRIES.map(
  (code) => ({
    code,
    name: COUNTRY_NAMES[code],
    currency: COUNTRY_CURRENCY_MAP[code],
    paymentMethods: PAYMENT_METHODS[code],
  })
);

/**
 * Type guard to check if a string is a valid dLocal country
 */
export function isDLocalCountry(country: string): country is DLocalCountry {
  return DLOCAL_SUPPORTED_COUNTRIES.includes(country as DLocalCountry);
}

/**
 * Get currency for a given country
 */
export function getCurrency(country: DLocalCountry): DLocalCurrency {
  return COUNTRY_CURRENCY_MAP[country];
}

/**
 * Get payment methods for a given country
 */
export function getPaymentMethods(country: DLocalCountry): string[] {
  return PAYMENT_METHODS[country] || [];
}

/**
 * Get country name for display
 */
export function getCountryName(country: DLocalCountry): string {
  return COUNTRY_NAMES[country];
}

/**
 * Get full country configuration
 */
export function getCountryConfig(
  country: DLocalCountry
): CountryConfig | undefined {
  return COUNTRY_CONFIGS.find((c) => c.code === country);
}

/**
 * Get price in USD for a plan type
 */
export function getPriceUSD(planType: 'THREE_DAY' | 'MONTHLY'): number {
  return planType === 'THREE_DAY' ? PRICING.THREE_DAY_USD : PRICING.MONTHLY_USD;
}

/**
 * Get plan duration in days
 */
export function getPlanDuration(planType: 'THREE_DAY' | 'MONTHLY'): number {
  return planType === 'THREE_DAY'
    ? PLAN_DURATION.THREE_DAY
    : PLAN_DURATION.MONTHLY;
}
