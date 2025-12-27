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
 * Backend uses getAffiliateConfigFromDB function.
 *
 * @module lib/affiliate/constants
 */

import { prisma } from '@/lib/db/prisma';

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
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DYNAMIC CONFIG FUNCTIONS (Backend)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch current affiliate configuration from SystemConfig database.
 *
 * Use this function in backend code (API routes, cron jobs, webhooks)
 * to get the current discount and commission percentages.
 *
 * For frontend code, use the useAffiliateConfig hook instead.
 *
 * @returns Current affiliate configuration from database
 *
 * @example
 * ```typescript
 * // In an API route or cron job:
 * const config = await getAffiliateConfigFromDB();
 *
 * const discountAmount = price * (config.discountPercent / 100);
 * const netRevenue = price - discountAmount;
 * const commission = netRevenue * (config.commissionPercent / 100);
 * ```
 */
export async function getAffiliateConfigFromDB(): Promise<DynamicAffiliateConfig> {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'affiliate_discount_percent',
            'affiliate_commission_percent',
            'affiliate_codes_per_month',
            'affiliate_base_price',
          ],
        },
      },
    });

    const configMap: Record<string, string> = {};
    for (const config of configs) {
      configMap[config.key] = config.value;
    }

    return {
      discountPercent: parseFloat(
        configMap['affiliate_discount_percent'] || '20.0'
      ),
      commissionPercent: parseFloat(
        configMap['affiliate_commission_percent'] || '20.0'
      ),
      codesPerMonth: parseInt(
        configMap['affiliate_codes_per_month'] || '15',
        10
      ),
      basePriceUsd: parseFloat(configMap['affiliate_base_price'] || '29.0'),
    };
  } catch (error) {
    console.error(
      '[AffiliateConfig] Failed to fetch config from DB, using defaults:',
      error
    );
    // Return defaults on error
    return {
      discountPercent: AFFILIATE_CONFIG.DISCOUNT_PERCENT,
      commissionPercent: AFFILIATE_CONFIG.COMMISSION_PERCENT,
      codesPerMonth: AFFILIATE_CONFIG.CODES_PER_MONTH,
      basePriceUsd: AFFILIATE_CONFIG.BASE_PRICE_USD,
    };
  }
}

/**
 * Get discount percent from SystemConfig
 * @returns Current discount percentage
 */
export async function getDiscountPercent(): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return config.discountPercent;
}

/**
 * Get commission percent from SystemConfig
 * @returns Current commission percentage
 */
export async function getCommissionPercent(): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return config.commissionPercent;
}

/**
 * Get codes per month from SystemConfig
 * @returns Current codes per month value
 */
export async function getCodesPerMonth(): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return config.codesPerMonth;
}

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
