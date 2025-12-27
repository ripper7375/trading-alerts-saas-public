/**
 * Indicator Filtering Module
 *
 * Filters indicator data based on user tier access.
 * FREE tier: fractals, trendlines (2 basic indicators)
 * PRO tier: All 8 indicators including momentum_candles, keltner_channels, tema, hrma, smma, zigzag
 *
 * @module lib/indicator-filter
 */

/**
 * Basic indicators available to FREE tier
 */
export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

/**
 * PRO-only indicators (requires PRO subscription)
 */
export const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

/**
 * All available indicators
 */
export const ALL_INDICATORS = [
  ...BASIC_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;

export type IndicatorId = (typeof ALL_INDICATORS)[number];
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];
export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];
export type Tier = 'FREE' | 'PRO';

/**
 * Check if user can access a specific indicator
 *
 * @param indicator - Indicator identifier
 * @param tier - User's subscription tier
 * @returns true if user can access the indicator
 */
export function canAccessIndicator(
  indicator: string,
  tier: Tier
): boolean {
  const normalizedIndicator = indicator.toLowerCase();

  if (tier === 'PRO') {
    return ALL_INDICATORS.includes(normalizedIndicator as IndicatorId);
  }

  return BASIC_INDICATORS.includes(normalizedIndicator as BasicIndicator);
}

/**
 * Get list of accessible indicators for a tier
 *
 * @param tier - User's subscription tier
 * @returns Array of accessible indicator IDs
 */
export function getAccessibleIndicators(tier: Tier): IndicatorId[] {
  if (tier === 'PRO') {
    return [...ALL_INDICATORS];
  }
  return [...BASIC_INDICATORS] as IndicatorId[];
}

/**
 * Get list of locked (PRO-only) indicators for a tier
 *
 * @param tier - User's subscription tier
 * @returns Array of locked indicator IDs (empty for PRO)
 */
export function getLockedIndicators(tier: Tier): ProOnlyIndicator[] {
  if (tier === 'PRO') {
    return [];
  }
  return [...PRO_ONLY_INDICATORS];
}

/**
 * Filter indicator data based on tier access
 * Removes PRO-only indicator data for FREE tier users
 *
 * @param data - Raw indicator data object
 * @param tier - User's subscription tier
 * @returns Filtered indicator data
 */
export function filterIndicatorData<T extends Record<string, unknown>>(
  data: T,
  tier: Tier
): T {
  if (tier === 'PRO') {
    return data; // No filtering for PRO
  }

  // For FREE tier, filter out PRO-only indicators
  const filtered = { ...data };

  // Filter proIndicators object if present
  if (filtered.proIndicators && typeof filtered.proIndicators === 'object') {
    const allowedData: Record<string, unknown> = {};

    Object.keys(filtered.proIndicators as object).forEach((key) => {
      const indicator = key.toLowerCase();
      if (BASIC_INDICATORS.includes(indicator as BasicIndicator)) {
        allowedData[key] = (filtered.proIndicators as Record<string, unknown>)[key];
      }
    });

    filtered.proIndicators = allowedData as T['proIndicators'];
  }

  // Filter proIndicatorsTransformed object if present
  if (filtered.proIndicatorsTransformed && typeof filtered.proIndicatorsTransformed === 'object') {
    const allowedTransformed: Record<string, unknown> = {};

    Object.keys(filtered.proIndicatorsTransformed as object).forEach((key) => {
      const indicator = key.toLowerCase();
      if (BASIC_INDICATORS.includes(indicator as BasicIndicator)) {
        allowedTransformed[key] = (filtered.proIndicatorsTransformed as Record<string, unknown>)[key];
      }
    });

    filtered.proIndicatorsTransformed = allowedTransformed as T['proIndicatorsTransformed'];
  }

  return filtered;
}

/**
 * Upgrade info structure
 */
export interface IndicatorUpgradeInfo {
  upgradeRequired: boolean;
  lockedIndicators: string[];
  accessibleIndicators: string[];
  upgradeMessage: string | null;
}

/**
 * Generate upgrade info for locked indicators
 *
 * @param requestedIndicators - Array of requested indicator IDs
 * @param tier - User's subscription tier
 * @returns Upgrade info object with locked/accessible indicators
 */
export function getIndicatorUpgradeInfo(
  requestedIndicators: string[],
  tier: Tier
): IndicatorUpgradeInfo {
  const locked = requestedIndicators.filter(
    (ind) => !canAccessIndicator(ind, tier)
  );

  const accessible = requestedIndicators.filter((ind) =>
    canAccessIndicator(ind, tier)
  );

  return {
    upgradeRequired: locked.length > 0,
    lockedIndicators: locked,
    accessibleIndicators: accessible,
    upgradeMessage:
      locked.length > 0
        ? `Upgrade to Pro to access ${locked.join(', ')}. Only $29/month with 7-day free trial.`
        : null,
  };
}

/**
 * Get indicator count by tier
 */
export function getIndicatorCount(tier: Tier): {
  accessible: number;
  locked: number;
  total: number;
} {
  const accessible = tier === 'PRO' ? ALL_INDICATORS.length : BASIC_INDICATORS.length;
  const locked = tier === 'PRO' ? 0 : PRO_ONLY_INDICATORS.length;

  return {
    accessible,
    locked,
    total: ALL_INDICATORS.length,
  };
}

/**
 * Check if any PRO indicators are present in data
 *
 * @param data - Indicator data object
 * @returns true if PRO indicators are present
 */
export function hasProIndicators(data: Record<string, unknown>): boolean {
  if (data.proIndicators && typeof data.proIndicators === 'object') {
    const proData = data.proIndicators as Record<string, unknown>;

    for (const key of Object.keys(proData)) {
      const indicator = key.toLowerCase();
      if (PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator)) {
        const value = proData[key];
        if (value !== null && value !== undefined) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Create response with upgrade prompts for FREE users
 */
export function createIndicatorResponse<T>(
  data: T,
  tier: Tier,
  requestedIndicators?: string[]
): {
  data: T;
  tier: Tier;
  upgrade?: {
    required: boolean;
    message: string;
    locked: string[];
    tier: 'PRO';
    pricing: {
      monthly: string;
      yearly: string;
      trial: string;
    };
  };
} {
  const filteredData = filterIndicatorData(data as Record<string, unknown>, tier) as T;

  const response: {
    data: T;
    tier: Tier;
    upgrade?: {
      required: boolean;
      message: string;
      locked: string[];
      tier: 'PRO';
      pricing: {
        monthly: string;
        yearly: string;
        trial: string;
      };
    };
  } = {
    data: filteredData,
    tier,
  };

  // Add upgrade info for FREE users
  if (tier === 'FREE') {
    const upgradeInfo = requestedIndicators?.length
      ? getIndicatorUpgradeInfo(requestedIndicators, tier)
      : { upgradeRequired: true, lockedIndicators: [...PRO_ONLY_INDICATORS] };

    if (upgradeInfo.upgradeRequired || tier === 'FREE') {
      response.upgrade = {
        required: true,
        message: upgradeInfo.upgradeMessage ||
          `Upgrade to Pro to access ${PRO_ONLY_INDICATORS.length} additional indicators. Only $29/month with 7-day free trial.`,
        locked: upgradeInfo.lockedIndicators || [...PRO_ONLY_INDICATORS],
        tier: 'PRO',
        pricing: {
          monthly: '$29',
          yearly: '$290',
          trial: '7 days free',
        },
      };
    }
  }

  return response;
}
