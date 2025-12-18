/**
 * Affiliate Marketing System Constants
 *
 * Central configuration for the affiliate program including
 * commission rates, discount percentages, and payment settings.
 *
 * ⚠️ COMMISSION MODEL: Percentage-based
 * - 20% discount for customers ($29.00 → $23.20)
 * - 20% commission on net revenue ($23.20 × 20% = $4.64)
 *
 * @module lib/affiliate/constants
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main affiliate program configuration
 * All commission calculations use PERCENTAGE-BASED model
 */
export const AFFILIATE_CONFIG = {
  /**
   * Discount percentage for customers using affiliate codes
   * Customer pays: $29.00 × (1 - 0.20) = $23.20
   */
  DISCOUNT_PERCENT: 20.0,

  /**
   * Commission percentage on net revenue (after discount)
   * Affiliate earns: $23.20 × 0.20 = $4.64
   */
  COMMISSION_PERCENT: 20.0,

  /**
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
   * Base subscription price (before discount)
   */
  BASE_PRICE_USD: 29.0,
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
