/**
 * Commission Calculator
 *
 * Ported from lib/affiliate/commission-calculator.ts (Session 4A-4, File
 * 2/4 — untraced dependency of conversion-processor.ts, see this order's
 * Deviations). The 4 pure functions (calculateDiscount, calculateNetRevenue,
 * calculateCommission, calculateFullBreakdown) are byte-identical plain
 * exports — no DI needed, no DB dependency.
 *
 * The 3 `*WithDynamicConfig` wrappers are also ported for parity (grep
 * confirmed at CONFIRM: unused anywhere in the monolith, including the
 * Stripe webhook their own doc comment describes — already dead code
 * upstream), but adapted to take the resolved `DynamicAffiliateConfig` as a
 * parameter instead of importing a free `getAffiliateConfigFromDB()` — that
 * function doesn't exist standalone in money-service, only as
 * `AffiliateConfigService.getAffiliateConfigFromDB()` (Session 4A-2). A free
 * function can't constructor-inject a service, so the caller resolves the
 * config first and passes it in.
 *
 * Calculates affiliate commissions using percentage-based model:
 * - Default 20% discount for customers ($29.00 → $23.20)
 * - Default 20% commission on net revenue ($23.20 × 20% = $4.64)
 */

import { AFFILIATE_CONFIG } from './affiliate.constants';
import type { DynamicAffiliateConfig } from './affiliate.constants';

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

/**
 * Round number to specified decimal places
 * Uses banker's rounding (round half to even)
 */
function roundToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate discount amount from gross revenue
 */
export function calculateDiscount(
  grossAmount: number,
  discountPercent: number = AFFILIATE_CONFIG.DISCOUNT_PERCENT
): number {
  if (grossAmount <= 0) return 0;
  return roundToDecimals((grossAmount * discountPercent) / 100);
}

/**
 * Calculate net revenue (what customer pays after discount)
 */
export function calculateNetRevenue(
  grossAmount: number,
  discountPercent: number = AFFILIATE_CONFIG.DISCOUNT_PERCENT
): number {
  if (grossAmount <= 0) return 0;
  return roundToDecimals(grossAmount * (1 - discountPercent / 100));
}

/**
 * Calculate affiliate commission from net revenue
 */
export function calculateCommission(
  netRevenue: number,
  commissionPercent: number = AFFILIATE_CONFIG.COMMISSION_PERCENT
): number {
  if (netRevenue <= 0) return 0;
  return roundToDecimals((netRevenue * commissionPercent) / 100);
}

/**
 * Calculate complete commission breakdown
 *
 * Provides full visibility into how commission is calculated:
 * - Gross revenue (original price)
 * - Discount amount (what customer saves)
 * - Net revenue (what customer pays)
 * - Commission (what affiliate earns)
 * - Company revenue (what company keeps)
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
// DYNAMIC CONFIG VERSIONS (Backend) — config resolved by the caller
// (AffiliateConfigService), see file header. Unused anywhere in this
// session's scope; ported for parity only.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate complete commission breakdown using dynamic config from SystemConfig.
 */
export function calculateFullBreakdownWithDynamicConfig(
  grossAmount: number,
  config: DynamicAffiliateConfig
): CommissionBreakdown {
  return calculateFullBreakdown(
    grossAmount,
    config.discountPercent,
    config.commissionPercent
  );
}

/**
 * Calculate discount amount using dynamic config from SystemConfig.
 */
export function calculateDiscountWithDynamicConfig(
  grossAmount: number,
  config: DynamicAffiliateConfig
): number {
  return calculateDiscount(grossAmount, config.discountPercent);
}

/**
 * Calculate net revenue using dynamic config from SystemConfig.
 */
export function calculateNetRevenueWithDynamicConfig(
  grossAmount: number,
  config: DynamicAffiliateConfig
): number {
  return calculateNetRevenue(grossAmount, config.discountPercent);
}

/**
 * Calculate commission amount using dynamic config from SystemConfig.
 */
export function calculateCommissionWithDynamicConfig(
  netRevenue: number,
  config: DynamicAffiliateConfig
): number {
  return calculateCommission(netRevenue, config.commissionPercent);
}
