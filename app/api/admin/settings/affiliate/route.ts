/**
 * Admin Affiliate Settings API
 *
 * Allows admin to view and update affiliate discount and commission percentages.
 * Changes are stored in SystemConfig and create audit history entries.
 *
 * @module app/api/admin/settings/affiliate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ConfigValue {
  value: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface GetResponse {
  discountPercent: ConfigValue;
  commissionPercent: ConfigValue;
  codesPerMonth: ConfigValue;
  basePrice: ConfigValue;
}

interface PatchRequest {
  discountPercent?: number;
  commissionPercent?: number;
  codesPerMonth?: number;
  basePrice?: number;
  reason?: string;
}

interface PatchResponse {
  success: boolean;
  message: string;
  changes: Array<{
    setting: string;
    oldValue: string;
    newValue: string;
  }>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG KEYS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONFIG_KEYS = {
  discountPercent: 'affiliate_discount_percent',
  commissionPercent: 'affiliate_commission_percent',
  codesPerMonth: 'affiliate_codes_per_month',
  basePrice: 'affiliate_base_price',
} as const;

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
 * GET /api/admin/settings/affiliate
 *
 * Returns current affiliate settings with metadata (who last updated, when).
 * Requires admin authentication.
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse<GetResponse | { error: string }>> {
  try {
    // Require admin authentication
    await requireAdmin();

    // Fetch all affiliate config keys
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: Object.values(CONFIG_KEYS),
        },
      },
    });

    // Create lookup map
    const configMap: Record<string, { value: string; updatedBy: string | null; updatedAt: Date }> = {};
    for (const config of configs) {
      configMap[config.key] = {
        value: config.value,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt,
      };
    }

    // Build response with defaults for missing values
    const response: GetResponse = {
      discountPercent: {
        value: parseFloat(configMap[CONFIG_KEYS.discountPercent]?.value ?? DEFAULTS.affiliate_discount_percent),
        updatedBy: configMap[CONFIG_KEYS.discountPercent]?.updatedBy ?? null,
        updatedAt: configMap[CONFIG_KEYS.discountPercent]?.updatedAt?.toISOString() ?? new Date().toISOString(),
      },
      commissionPercent: {
        value: parseFloat(configMap[CONFIG_KEYS.commissionPercent]?.value ?? DEFAULTS.affiliate_commission_percent),
        updatedBy: configMap[CONFIG_KEYS.commissionPercent]?.updatedBy ?? null,
        updatedAt: configMap[CONFIG_KEYS.commissionPercent]?.updatedAt?.toISOString() ?? new Date().toISOString(),
      },
      codesPerMonth: {
        value: parseInt(configMap[CONFIG_KEYS.codesPerMonth]?.value ?? DEFAULTS.affiliate_codes_per_month, 10),
        updatedBy: configMap[CONFIG_KEYS.codesPerMonth]?.updatedBy ?? null,
        updatedAt: configMap[CONFIG_KEYS.codesPerMonth]?.updatedAt?.toISOString() ?? new Date().toISOString(),
      },
      basePrice: {
        value: parseFloat(configMap[CONFIG_KEYS.basePrice]?.value ?? DEFAULTS.affiliate_base_price),
        updatedBy: configMap[CONFIG_KEYS.basePrice]?.updatedBy ?? null,
        updatedAt: configMap[CONFIG_KEYS.basePrice]?.updatedAt?.toISOString() ?? new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[Admin Settings] Failed to fetch affiliate settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH HANDLER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PATCH /api/admin/settings/affiliate
 *
 * Updates affiliate settings (discount %, commission %, codes per month).
 * Creates history entries for audit trail.
 * Requires admin authentication.
 */
export async function PATCH(
  request: NextRequest
): Promise<NextResponse<PatchResponse | { error: string }>> {
  try {
    // Require admin authentication
    const session = await requireAdmin();
    const adminEmail = session.user?.email || 'unknown';
    const adminId = session.user?.id || 'unknown';

    // Parse request body
    const body: PatchRequest = await request.json();
    const { discountPercent, commissionPercent, codesPerMonth, basePrice, reason } = body;

    // Validate values
    if (discountPercent !== undefined) {
      if (discountPercent < 0 || discountPercent > 100) {
        return NextResponse.json(
          { error: 'Discount percent must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (commissionPercent !== undefined) {
      if (commissionPercent < 0 || commissionPercent > 100) {
        return NextResponse.json(
          { error: 'Commission percent must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (codesPerMonth !== undefined) {
      if (codesPerMonth < 1 || codesPerMonth > 100) {
        return NextResponse.json(
          { error: 'Codes per month must be between 1 and 100' },
          { status: 400 }
        );
      }
    }

    if (basePrice !== undefined) {
      if (basePrice < 0) {
        return NextResponse.json(
          { error: 'Base price must be positive' },
          { status: 400 }
        );
      }
    }

    const changes: PatchResponse['changes'] = [];

    // Update discount percent
    if (discountPercent !== undefined) {
      const change = await updateConfig(
        CONFIG_KEYS.discountPercent,
        discountPercent.toString(),
        adminId,
        adminEmail,
        reason
      );
      if (change) {
        changes.push({ setting: 'discountPercent', ...change });
      }
    }

    // Update commission percent
    if (commissionPercent !== undefined) {
      const change = await updateConfig(
        CONFIG_KEYS.commissionPercent,
        commissionPercent.toString(),
        adminId,
        adminEmail,
        reason
      );
      if (change) {
        changes.push({ setting: 'commissionPercent', ...change });
      }
    }

    // Update codes per month
    if (codesPerMonth !== undefined) {
      const change = await updateConfig(
        CONFIG_KEYS.codesPerMonth,
        codesPerMonth.toString(),
        adminId,
        adminEmail,
        reason
      );
      if (change) {
        changes.push({ setting: 'codesPerMonth', ...change });
      }
    }

    // Update base price
    if (basePrice !== undefined) {
      const change = await updateConfig(
        CONFIG_KEYS.basePrice,
        basePrice.toString(),
        adminId,
        adminEmail,
        reason
      );
      if (change) {
        changes.push({ setting: 'basePrice', ...change });
      }
    }

    console.log(`[Admin Settings] Admin ${adminEmail} updated affiliate settings:`, changes);

    return NextResponse.json({
      success: true,
      message: changes.length > 0
        ? 'Affiliate settings updated. Changes will propagate across all pages within 5 minutes.'
        : 'No changes made.',
      changes,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[Admin Settings] Failed to update affiliate settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Update a single config value and create history entry
 */
async function updateConfig(
  key: string,
  newValue: string,
  adminId: string,
  adminEmail: string,
  reason?: string
): Promise<{ oldValue: string; newValue: string } | null> {
  // Get current value
  const current = await prisma.systemConfig.findUnique({
    where: { key },
  });

  const oldValue = current?.value ?? DEFAULTS[key as keyof typeof DEFAULTS] ?? '0';

  // Skip if value hasn't changed
  if (oldValue === newValue) {
    return null;
  }

  // Upsert the config
  await prisma.systemConfig.upsert({
    where: { key },
    create: {
      key,
      value: newValue,
      valueType: 'number',
      category: 'affiliate',
      description: getDescription(key),
      updatedBy: adminId,
    },
    update: {
      value: newValue,
      updatedBy: adminId,
    },
  });

  // Create history entry
  await prisma.systemConfigHistory.create({
    data: {
      configKey: key,
      oldValue,
      newValue,
      changedBy: adminEmail,
      reason,
    },
  });

  return { oldValue, newValue };
}

/**
 * Get description for a config key
 */
function getDescription(key: string): string {
  switch (key) {
    case 'affiliate_discount_percent':
      return 'Discount percentage for customers using affiliate codes';
    case 'affiliate_commission_percent':
      return 'Commission percentage for affiliates on net revenue';
    case 'affiliate_codes_per_month':
      return 'Number of codes distributed to each affiliate monthly';
    case 'affiliate_base_price':
      return 'Base subscription price in USD before discount';
    default:
      return '';
  }
}
