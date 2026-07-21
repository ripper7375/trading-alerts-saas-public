/**
 * Affiliate Dynamic Configuration (Database-backed)
 *
 * Ported from lib/affiliate/db.ts (Session 4A-2, File 2/6). Fetches
 * affiliate program configuration from SystemConfig, allowing admins to
 * change discount/commission/pricing values without a code deployment.
 *
 * @module affiliate/affiliate-config.service
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  AFFILIATE_CONFIG,
  type DynamicAffiliateConfig,
} from './affiliate.constants';

@Injectable()
export class AffiliateConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch current affiliate configuration from SystemConfig database.
   *
   * @returns Current affiliate configuration from database
   */
  async getAffiliateConfigFromDB(): Promise<DynamicAffiliateConfig> {
    try {
      const configs = await this.prisma.systemConfig.findMany({
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
   */
  async getDiscountPercent(): Promise<number> {
    const config = await this.getAffiliateConfigFromDB();
    return config.discountPercent;
  }

  /**
   * Get commission percent from SystemConfig
   */
  async getCommissionPercent(): Promise<number> {
    const config = await this.getAffiliateConfigFromDB();
    return config.commissionPercent;
  }

  /**
   * Get codes per month from SystemConfig
   */
  async getCodesPerMonth(): Promise<number> {
    const config = await this.getAffiliateConfigFromDB();
    return config.codesPerMonth;
  }

  /**
   * Get base price from SystemConfig
   */
  async getBasePriceUsd(): Promise<number> {
    const config = await this.getAffiliateConfigFromDB();
    return config.basePriceUsd;
  }

  /**
   * Get 3-day trial price from SystemConfig
   */
  async getThreeDayPriceUsd(): Promise<number> {
    const config = await this.getAffiliateConfigFromDB();
    return config.threeDayPriceUsd;
  }
}
