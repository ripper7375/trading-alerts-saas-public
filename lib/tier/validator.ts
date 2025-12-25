/**
 * Indicator Tier Validator
 *
 * Provides access control for tier-gated indicators.
 *
 * @module lib/tier/validator
 */

import type { Tier } from '@/lib/tier-config';

import {
  ALL_INDICATORS,
  BASIC_INDICATORS,
  PRO_ONLY_INDICATORS,
  type BasicIndicator,
  type IndicatorId,
  type ProOnlyIndicator,
} from './constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCESS CONTROL FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a user tier can access a specific indicator
 *
 * @param tier - User tier (FREE or PRO)
 * @param indicator - Indicator ID to check
 * @returns True if tier has access, false otherwise
 *
 * @example
 * ```typescript
 * canAccessIndicator('FREE', 'fractals');     // true
 * canAccessIndicator('FREE', 'keltner_channels'); // false
 * canAccessIndicator('PRO', 'keltner_channels');  // true
 * ```
 */
export function canAccessIndicator(tier: Tier, indicator: string): boolean {
  // PRO tier can access all indicators
  if (tier === 'PRO') {
    return ALL_INDICATORS.includes(indicator as IndicatorId);
  }

  // FREE tier can only access basic indicators
  if (PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator)) {
    return false;
  }

  return BASIC_INDICATORS.includes(indicator as BasicIndicator);
}

/**
 * Check if an indicator requires PRO tier
 *
 * @param indicator - Indicator ID to check
 * @returns True if indicator is PRO-only
 */
export function isProOnlyIndicator(indicator: string): boolean {
  return PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator);
}

/**
 * Get all accessible indicators for a tier
 *
 * @param tier - User tier (FREE or PRO)
 * @returns Array of accessible indicator IDs
 */
export function getAccessibleIndicators(tier: Tier): IndicatorId[] {
  if (tier === 'PRO') {
    return [...ALL_INDICATORS];
  }
  return [...BASIC_INDICATORS];
}

/**
 * Get all locked indicators for a tier
 *
 * @param tier - User tier (FREE or PRO)
 * @returns Array of locked indicator IDs
 */
export function getLockedIndicators(tier: Tier): IndicatorId[] {
  if (tier === 'PRO') {
    return [];
  }
  return [...PRO_ONLY_INDICATORS];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate a list of indicator IDs and filter to accessible ones
 *
 * @param tier - User tier
 * @param indicators - Array of indicator IDs to validate
 * @returns Filtered array of accessible indicator IDs
 */
export function filterAccessibleIndicators(
  tier: Tier,
  indicators: string[]
): IndicatorId[] {
  return indicators.filter(
    (indicator): indicator is IndicatorId =>
      ALL_INDICATORS.includes(indicator as IndicatorId) &&
      canAccessIndicator(tier, indicator)
  );
}

/**
 * Get upgrade information for locked indicators
 *
 * @param tier - User tier
 * @param requestedIndicators - Indicators user wants to access
 * @returns Object with upgrade required flag and locked indicator list
 */
export function getIndicatorUpgradeInfo(
  tier: Tier,
  requestedIndicators: string[]
): {
  upgradeRequired: boolean;
  lockedIndicators: string[];
  accessibleIndicators: string[];
} {
  const accessible: string[] = [];
  const locked: string[] = [];

  for (const indicator of requestedIndicators) {
    if (canAccessIndicator(tier, indicator)) {
      accessible.push(indicator);
    } else {
      locked.push(indicator);
    }
  }

  return {
    upgradeRequired: locked.length > 0,
    lockedIndicators: locked,
    accessibleIndicators: accessible,
  };
}

/**
 * Type guard to check if a string is a valid indicator ID
 */
export function isValidIndicatorId(id: string): id is IndicatorId {
  return ALL_INDICATORS.includes(id as IndicatorId);
}
