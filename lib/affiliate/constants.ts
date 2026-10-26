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
  /** Annual PRO price in USD, billed once a year */
  annualPriceUsd: number;
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
   * @deprecated Use SystemConfig 'disbursement_minimum_payout_usd' via getDisbursementSettings() / useAffiliateConfig().minimumPayoutUsd
   * (money-service: DisbursementSettingsService.get().minimumPayoutUsd).
   * Minimum balance required to request payout (USD) — default only.
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
   * Recurring-commission cap, in months of subscription lifetime. An
   * affiliate is paid on one referred subscription for at most this many
   * months: 24 monthly invoices, or 2 annual invoices (each annual invoice
   * covers 12 months). Resolve the invoice count for a billing interval
   * with getMaxCommissionCycles(). The discount itself is one-time only
   * (cycle 1); later cycles pay commission on the full price. Once the cap
   * is reached, or the subscription is cancelled, whichever comes first, no
   * further commission is credited even if the customer keeps paying.
   */
  MAX_RECURRING_COMMISSION_MONTHS: 24,
} as const;

/** Billing interval of a subscription invoice. */
export type CommissionBillingInterval = 'month' | 'year';

/**
 * Number of commission-bearing invoices that make up
 * MAX_RECURRING_COMMISSION_MONTHS for a billing interval: 24 for monthly,
 * 2 for annual.
 */
export function getMaxCommissionCycles(
  interval: CommissionBillingInterval
): number {
  const monthsPerCycle = interval === 'year' ? 12 : 1;
  return Math.ceil(
    AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_MONTHS / monthsPerCycle
  );
}

/**
 * Months of subscription lifetime one paid invoice covers (decision E4): a
 * monthly invoice 1, a yearly invoice 12. The prorated invoice of a monthly to
 * yearly upgrade is a yearly invoice (it starts the yearly period), so it
 * covers 12.
 */
export function commissionMonthsForInterval(
  interval: CommissionBillingInterval
): number {
  return interval === 'year' ? 12 : 1;
}

/**
 * Months of lifetime already paid on, from the invoices that earned a
 * commission before this one (E4). `monthsByInvoiceId` is what Stripe says each
 * of them covered; an invoice it cannot resolve (an older commission row with no
 * invoice id, an invoice outside the list, or no answer at all) counts as
 * `fallbackMonths`, which the caller sets to the months of the plan the
 * subscription had before this invoice, so a subscription that never switched
 * is counted exactly as before.
 */
export function commissionMonthsBefore(
  priorInvoiceIds: ReadonlyArray<string | null>,
  monthsByInvoiceId: Readonly<Record<string, number>> | null,
  fallbackMonths: number
): number {
  return priorInvoiceIds.reduce<number>((sum, id) => {
    const known = id !== null ? monthsByInvoiceId?.[id] : undefined;
    return (
      sum + (typeof known === 'number' && known > 0 ? known : fallbackMonths)
    );
  }, 0);
}

export interface CommissionWindow {
  /** The invoice earns commission: fewer than the cap's months came before it. */
  payable: boolean;
  /** Months of lifetime this invoice covers. */
  months: number;
  /** The cap is reached once this invoice is paid, so the attribution ends. */
  capReached: boolean;
}

/**
 * Whether an invoice earns commission, by months of lifetime (decision E4,
 * cap MAX_RECURRING_COMMISSION_MONTHS): it does when fewer than the cap's
 * months came before it. An invoice that crosses the cap is paid in full and the
 * next one is not. For a subscription that never switches this is the old
 * result: 24 monthly invoices, or 2 yearly ones.
 */
export function commissionWindow(
  monthsBefore: number,
  interval: CommissionBillingInterval
): CommissionWindow {
  const cap = AFFILIATE_CONFIG.MAX_RECURRING_COMMISSION_MONTHS;
  const months = commissionMonthsForInterval(interval);
  return {
    payable: monthsBefore < cap,
    months,
    capReached: monthsBefore + months >= cap,
  };
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
