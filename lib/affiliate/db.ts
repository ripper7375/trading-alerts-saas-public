/**
 * Affiliate Dynamic Configuration (Database-backed)
 *
 * Server-only functions that fetch affiliate program configuration from
 * SystemConfig, allowing admins to change discount/commission/pricing
 * values without a code deployment.
 *
 * Split out of lib/affiliate/constants.ts (F22, Session 2-4 follow-up):
 * these functions import the Prisma singleton, which pulls in
 * @prisma/adapter-pg → pg → Node's `dns` module. constants.ts is imported
 * by 'use client' pages for its plain AFFILIATE_CONFIG object — having the
 * Prisma import in the same file tainted the whole module for any client
 * bundle that touched it, breaking `npm run build`
 * (`app/affiliate/register/page.tsx` → constants.ts → this code).
 * Server-only code must live in its own file so client components can
 * import the plain constants without pulling in a server-only dependency
 * chain.
 *
 * @module lib/affiliate/db
 */

import { prisma } from '@/lib/db/prisma';

import { AFFILIATE_CONFIG, type DynamicAffiliateConfig } from './constants';

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
            'affiliate_three_day_price',
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
      threeDayPriceUsd: parseFloat(
        configMap['affiliate_three_day_price'] || '1.99'
      ),
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
      threeDayPriceUsd: 1.99,
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

/**
 * Get base price from SystemConfig
 * @returns Current base price in USD
 *
 * @example
 * ```typescript
 * // In an API route or webhook:
 * const basePrice = await getBasePriceUsd();
 * console.log(`Current PRO price: $${basePrice}`);
 * ```
 */
export async function getBasePriceUsd(): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return config.basePriceUsd;
}

/**
 * Get 3-day trial price from SystemConfig
 * @returns Current 3-day trial price in USD
 *
 * @example
 * ```typescript
 * // In an API route or webhook:
 * const threeDayPrice = await getThreeDayPriceUsd();
 * console.log(`Current 3-day trial price: $${threeDayPrice}`);
 * ```
 */
export async function getThreeDayPriceUsd(): Promise<number> {
  const config = await getAffiliateConfigFromDB();
  return config.threeDayPriceUsd;
}
