/**
 * dLocal Payment Integration Types (mobile reference)
 *
 * Mirrors the monolith's types/dlocal.ts so this seed app's UI shapes stay
 * consistent with the real DavinTrade payment flow. Reference/UI-only --
 * this app has no dLocal backend of its own to call.
 */

export type PaymentProvider = 'DLOCAL' | 'STRIPE';

/** Supported dLocal countries (9 total) */
export type DLocalCountry =
  | 'IN'
  | 'NG'
  | 'PK'
  | 'VN'
  | 'ID'
  | 'TH'
  | 'ZA'
  | 'TR'
  | 'AE';

/** Corresponding currencies for dLocal countries */
export type DLocalCurrency =
  | 'INR'
  | 'NGN'
  | 'PKR'
  | 'VND'
  | 'IDR'
  | 'THB'
  | 'ZAR'
  | 'TRY'
  | 'AED';

export interface CountryConfig {
  code: DLocalCountry;
  name: string;
  currency: DLocalCurrency;
  paymentMethods: string[];
}
