/**
 * Affiliate Marketing System Constants
 *
 * Ported byte-for-byte from lib/affiliate/constants.ts (Session 4A-2, File 2/6).
 *
 * ⚠️ COMMISSION MODEL: Percentage-based (configurable via SystemConfig)
 * - Default 20% discount for customers ($29.00 → $23.20)
 * - Default 20% commission on net revenue ($23.20 × 20% = $4.64)
 *
 * Admin can change these values from the admin dashboard.
 * Backend uses getAffiliateConfigFromDB from ./affiliate-config.service.
 *
 * @module affiliate/affiliate.constants
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
 * Use getAffiliateConfigFromDB() for backend. These values are kept as
 * fallback defaults only.
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
   */
  PAYMENT_METHODS: [
    'BANK_TRANSFER',
    'PAYPAL',
    'CRYPTOCURRENCY',
    'WISE',
  ] as const,

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
   * Mirrors lib/affiliate/constants.ts verbatim.
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
