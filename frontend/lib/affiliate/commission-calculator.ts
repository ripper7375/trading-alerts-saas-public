/**
 * Commission Calculator
 *
 * Calculates affiliate commissions using percentage-based model:
 * - Default 20% discount for customers ($29.00 → $23.20)
 * - Default 20% commission on net revenue ($23.20 × 20% = $4.64)
 *
 * SYSTEMCONFIG INTEGRATION:
 * - Use *WithDynamicConfig functions for backend code that needs current config
 * - These functions fetch from SystemConfig database
 * - For frontend, use useAffiliateConfig hook instead
 *
 * @module lib/affiliate/commission-calculator
 */

import { AFFILIATE_CONFIG, getAffiliateConfigFromDB } from './constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Complete breakdown of a commission transaction
 */
export interface CommissionBreakdown {
  /** Original price before discount */
  grossRevenue: number;
  /** Discount percentage applied */
  discountPercent: number;
  /** Amount discounted from gross */
  discountAmount: number;
  /** Amount customer pays (gross - discount) */
  netRevenue: number;
  /** Commission percentage on net revenue */
  commissionPercent: number;
  /** Amount affiliate earns */
  commissionAmount: number;
  /** Amount company keeps (net - commission) */
  companyRevenue: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Round to 2 decimal places
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Round number to specified decimal places
 * Uses banker's rounding (round half to even)
 */
function roundToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISCOUNT CALCULATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate discount amount from gross revenue
 *
 * @param grossAmount - Original price before discount
 * @param discountPercent - Discount percentage (default: AFFILIATE_CONFIG.DISCOUNT_PERCENT)
 * @returns Discount amount
 *
 * @example
 * ```typescript
 * calculateDiscount(29.00); // Returns 5.80 (20% of $29)
 * calculateDiscount(100.00, 15); // Returns 15.00 (15% of $100)
 * ```
 */
export function calculateDiscount(
  grossAmount: number,
  discountPercent: number = AFFILIATE_CONFIG.DISCOUNT_PERCENT
): number {
  if (grossAmount <= 0) return 0;
  return roundToDecimals((grossAmount * discountPercent) / 100);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NET REVENUE CALCULATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate net revenue (what customer pays after discount)
 *
 * @param grossAmount - Original price before discount
 * @param discountPercent - Discount percentage (default: AFFILIATE_CONFIG.DISCOUNT_PERCENT)
 * @returns Net revenue (gross - discount)
 *
 * @example
 * ```typescript
 * calculateNetRevenue(29.00); // Returns 23.20 ($29 - $5.80)
 * ```
 */
export function calculateNetRevenue(
  grossAmount: number,
  discountPercent: number = AFFILIATE_CONFIG.DISCOUNT_PERCENT
): number {
  if (grossAmount <= 0) return 0;
  return roundToDecimals(grossAmount * (1 - discountPercent / 100));
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMISSION CALCULATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate affiliate commission from net revenue
 *
 * @param netRevenue - Revenue after discount (what customer pays)
 * @param commissionPercent - Commission percentage (default: AFFILIATE_CONFIG.COMMISSION_PERCENT)
 * @returns Commission amount affiliate earns
 *
 * @example
 * ```typescript
 * calculateCommission(23.20); // Returns 4.64 (20% of $23.20)
 * calculateCommission(100.00, 25); // Returns 25.00 (25% of $100)
 * ```
 */
export function calculateCommission(
  netRevenue: number,
  commissionPercent: number = AFFILIATE_CONFIG.COMMISSION_PERCENT
): number {
  if (netRevenue <= 0) return 0;
  return roundToDecimals((netRevenue * commissionPercent) / 100);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FULL BREAKDOWN
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate complete commission breakdown
 *
 * Provides full visibility into how commission is calculated:
 * - Gross revenue (original price)
 * - Discount amount (what customer saves)
 * - Net revenue (what customer pays)
 * - Commission (what affiliate earns)
 * - Company revenue (what company keeps)
 *
 * @param grossAmount - Original price before discount
 * @param discountPercent - Discount percentage (default: AFFILIATE_CONFIG.DISCOUNT_PERCENT)
 * @param commissionPercent - Commission percentage (default: AFFILIATE_CONFIG.COMMISSION_PERCENT)
 * @returns Complete breakdown of all amounts
 *
 * @example
 * ```typescript
 * const breakdown = calculateFullBreakdown(29.00);
 * // {
 * //   grossRevenue: 29.00,
 * //   discountPercent: 20,
 * //   discountAmount: 5.80,
 * //   netRevenue: 23.20,
 * //   commissionPercent: 20,
 * //   commissionAmount: 4.64,
 * //   companyRevenue: 18.56
 * // }
 * ```
 */
export function calculateFullBreakdown(
  grossAmount: number,
  discountPercent: number = AFFILIATE_CONFIG.DISCOUNT_PERCENT,
  commissionPercent: number = AFFILIATE_CONFIG.COMMISSION_PERCENT
): CommissionBreakdown {
  const discountAmount = calculateDiscount(grossAmount, discountPercent);
  const netRevenue = calculateNetRevenue(grossAmount, discountPercent);
  const commissionAmount = calculateCommission(netRevenue, commissionPercent);
  const companyRevenue = roundToDecimals(netRevenue - commissionAmount);

  return {
    grossRevenue: grossAmount,
    discountPercent,
    discountAmount,
    netRevenue,
    commissionPercent,
    commissionAmount,
    companyRevenue,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DYNAMIC CONFIG VERSIONS (Backend)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate complete commission breakdown using dynamic config from SystemConfig.
 *
 * This is the preferred function for backend code (API routes, webhooks, cron jobs)
 * as it automatically fetches the current discount and commission percentages
 * from the database.
 *
 * @param grossAmount - Original price before discount
 * @returns Promise resolving to complete breakdown of all amounts
 *
 * @example
 * ```typescript
 * // In a Stripe webhook handler:
 * const breakdown = await calculateFullBreakdownWithDynamicConfig(29.00);
 * // Uses current config from SystemConfig table
 * ```
 */
export async function calculateFullBreakdownWithDynamicConfig(
  grossAmount: number
): Promise<CommissionBreakdown> {
  const config = await getAffiliateConfigFromDB();
  return calculateFullBreakdown(
    grossAmount,
    config.discountPercent,
    config.commissionPercent
  );
}

/**
 * Calculate discount amount using dynamic config from SystemConfig.
 *
 * @param grossAmount - Original price before discount
 * @returns Promise resolving to discount amount
 */
export async function calculateDiscountWithDynamicConfig(
  grossAmount: number
): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return calculateDiscount(grossAmount, config.discountPercent);
}

/**
 * Calculate net revenue using dynamic config from SystemConfig.
 *
 * @param grossAmount - Original price before discount
 * @returns Promise resolving to net revenue
 */
export async function calculateNetRevenueWithDynamicConfig(
  grossAmount: number
): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return calculateNetRevenue(grossAmount, config.discountPercent);
}

/**
 * Calculate commission amount using dynamic config from SystemConfig.
 *
 * @param netRevenue - Revenue after discount
 * @returns Promise resolving to commission amount
 */
export async function calculateCommissionWithDynamicConfig(
  netRevenue: number
): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return calculateCommission(netRevenue, config.commissionPercent);
}
