/**
 * Public Affiliate Config API
 *
 * Returns current affiliate discount and commission percentages
 * from SystemConfig. This endpoint is public (no authentication required)
 * and is cached for 5 minutes.
 *
 * @module app/api/config/affiliate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateConfigResponse {
  discountPercent: number;
  commissionPercent: number;
  codesPerMonth: number;
  regularPrice: number;
  lastUpdated: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEFAULT VALUES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Default values used when SystemConfig entries don't exist */
const DEFAULTS = {
  affiliate_discount_percent: '20.0',
  affiliate_commission_percent: '20.0',
  affiliate_codes_per_month: '15',
  affiliate_base_price: '29.0',
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/config/affiliate
 *
 * Returns current affiliate configuration.
 * Public endpoint - no authentication required.
 * Response is cached for 5 minutes for performance.
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse<AffiliateConfigResponse | { error: string }>> {
  try {
    // Fetch all affiliate config keys from SystemConfig
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

    // Create a map for easy lookup
    const configMap: Record<string, string> = {};
    let latestUpdate: Date | null = null;

    for (const config of configs) {
      configMap[config.key] = config.value;
      if (!latestUpdate || config.updatedAt > latestUpdate) {
        latestUpdate = config.updatedAt;
      }
    }

    // Parse values with fallbacks to defaults
    const response: AffiliateConfigResponse = {
      discountPercent: parseFloat(
        configMap['affiliate_discount_percent'] ??
          DEFAULTS['affiliate_discount_percent']
      ),
      commissionPercent: parseFloat(
        configMap['affiliate_commission_percent'] ??
          DEFAULTS['affiliate_commission_percent']
      ),
      codesPerMonth: parseInt(
        configMap['affiliate_codes_per_month'] ??
          DEFAULTS['affiliate_codes_per_month'],
        10
      ),
      regularPrice: parseFloat(
        configMap['affiliate_base_price'] ?? DEFAULTS['affiliate_base_price']
      ),
      lastUpdated: latestUpdate?.toISOString() ?? new Date().toISOString(),
    };

    // Return with cache headers (5 minutes)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[Config API] Failed to fetch affiliate config:', error);

    // Return defaults on error to prevent UI breakage
    const fallbackResponse: AffiliateConfigResponse = {
      discountPercent: parseFloat(DEFAULTS.affiliate_discount_percent),
      commissionPercent: parseFloat(DEFAULTS.affiliate_commission_percent),
      codesPerMonth: parseInt(DEFAULTS.affiliate_codes_per_month, 10),
      regularPrice: parseFloat(DEFAULTS.affiliate_base_price),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(fallbackResponse);
  }
}
