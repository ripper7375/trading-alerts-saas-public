/**
 * Affiliate Marketing System Constants
 *
 * Central configuration for the affiliate program including
 * commission rates, discount percentages, and payment settings.
 *
 * ⚠️ COMMISSION MODEL: Percentage-based (configurable via SystemConfig)
 * - Default 20% discount for customers ($29.00 → $23.20)
 * - Default 20% commission on net revenue ($23.20 × 20% = $4.64)
 *
 * Admin can change these values from the admin dashboard.
 * Frontend uses useAffiliateConfig hook.
 * Backend uses getAffiliateConfigFromDB from lib/affiliate/db.ts.
 *
 * client-safe: this file must never import '@/lib/db/prisma' (or anything
 * that transitively does) — it's imported by 'use client' pages
 * (app/affiliate/register/page.tsx, app/affiliate/dashboard/profile/
 * payment/page.tsx) for the plain AFFILIATE_CONFIG object below. Server-only
 * DB-backed config functions live in lib/affiliate/db.ts instead (F22,
 * Session 2-4 follow-up — see DECISION-LOG.md).
 *
 * @module lib/affiliate/constants
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DYNAMIC CONFIG TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Dynamic affiliate configuration from SystemConfig
 */
export interface DynamicAffiliateConfig {
  discountPercent: number;
  commissionPercent: number;
  codesPerMonth: number;
  basePriceUsd: number;
  threeDayPriceUsd: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE CONFIGURATION (Default values)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main affiliate program configuration
 * All commission calculations use PERCENTAGE-BASED model
 *
 * ⚠️ DEPRECATED for discount/commission values.
 * Use getAffiliateConfigFromDB() for backend or useAffiliateConfig() for frontend.
 * These values are kept as fallback defaults only.
 */
export const AFFILIATE_CONFIG = {
  /**
   * @deprecated Use getAffiliateConfigFromDB().discountPercent
   * Default discount percentage for customers using affiliate codes
   * Customer pays: $29.00 × (1 - 0.20) = $23.20
   */
  DISCOUNT_PERCENT: 20.0,

  /**
   * @deprecated Use getAffiliateConfigFromDB().commissionPercent
   * Default commission percentage on net revenue (after discount)
   * Affiliate earns: $23.20 × 0.20 = $4.64
   */
  COMMISSION_PERCENT: 20.0,

  /**
   * @deprecated Use getAffiliateConfigFromDB().codesPerMonth
   * Number of codes distributed per month to active affiliates
   */
  CODES_PER_MONTH: 15,

  /**
   * Minimum balance required to request payout (USD)
   */
  MINIMUM_PAYOUT: 50.0,

  /**
   * Days until affiliate code expires from distribution date
   */
  CODE_EXPIRY_DAYS: 30,

  /**
   * Supported payment methods for affiliate payouts
   *
   * DavinTrade disburses exclusively via Wise — RiseWorks was retired and
   * PayPal/cryptocurrency were never wired to a real disbursement path.
   * Narrowed to a single value so registration has nothing to pick.
   */
  PAYMENT_METHODS: ['WISE'] as const,

  /**
   * How often affiliates receive payouts
   */
  PAYMENT_FREQUENCY: 'MONTHLY' as const,

  /**
   * @deprecated Use getAffiliateConfigFromDB().basePriceUsd
   * Base subscription price (before discount)
   */
  BASE_PRICE_USD: 29.0,

  /**
   * Recurring-commission follow-up: total number of billing cycles an
   * affiliate is paid a commission for on one referred subscription --
   * cycle 1 (the discounted signup) plus 23 further renewals, 24 total.
   * The discount itself is one-time only (cycle 1); cycles 2-24 pay
   * commission on the full, undiscounted price. Once this cap is reached,
   * or the subscription is cancelled, whichever comes first, no further
   * commission is credited even if the customer keeps paying.
   */
  MAX_RECURRING_COMMISSION_CYCLES: 24,
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DERIVED TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Valid payment method types
 */
export type PaymentMethod = (typeof AFFILIATE_CONFIG.PAYMENT_METHODS)[number];

/**
 * Affiliate profile status values
 */
export type AffiliateStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE';

/**
 * Affiliate code status values
 */
export type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

/**
 * Commission status values
 */
export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

/**
 * Code distribution reason
 */
export type DistributionReason = 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Code generation settings
 */
export const CODE_GENERATION = {
  /**
   * Length of generated affiliate codes
   */
  CODE_LENGTH: 8,

  /**
   * Character set for code generation (uppercase alphanumeric)
   */
  CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',

  /**
   * Maximum attempts to generate unique code before throwing
   */
  MAX_GENERATION_ATTEMPTS: 10,
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMISSION CALCULATION EXAMPLE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Example commission breakdown for documentation:
 *
 * Regular price:           $29.00
 * Discount (20%):          -$5.80
 * Net revenue:             $23.20  (customer pays)
 * Commission (20% of net): $4.64   (affiliate earns)
 * Company nets:            $18.56
 *
 * Formula:
 * netRevenue = basePrice × (1 - discountPercent/100)
 * commission = netRevenue × (commissionPercent/100)
 */
