/**
 * Trading Alerts SaaS - Tier Helpers
 * Helper functions for tier operations
 */

import type { Tier } from './tier-validation';
import {
  validateTierAccess,
  validateTimeframeAccess,
  getAvailableSymbols as getSymbols,
  getAvailableTimeframes as getTimeframes,
} from './tier-validation';

/**
 * Check if user has access to a combination of symbol and timeframe
 */
export function hasChartAccess(
  tier: Tier,
  symbol: string,
  timeframe: string
): boolean {
  const symbolCheck = validateTierAccess(tier, symbol);
  const timeframeCheck = validateTimeframeAccess(tier, timeframe);

  return symbolCheck.allowed && timeframeCheck.allowed;
}

/**
 * Get available symbols for a tier
 */
export function getAvailableSymbols(tier: Tier): string[] {
  return getSymbols(tier);
}

/**
 * Get available timeframes for a tier
 */
export function getAvailableTimeframes(tier: Tier): string[] {
  return getTimeframes(tier);
}

/**
 * Calculate total chart combinations for a tier
 */
export function getChartCombinations(tier: Tier): number {
  const symbols = getAvailableSymbols(tier);
  const timeframes = getAvailableTimeframes(tier);

  if (symbols.includes('*') || timeframes.includes('*')) {
    return -1; // Unlimited
  }

  return symbols.length * timeframes.length;
}

/**
 * Check if tier allows a specific combination
 */
export function allowsCombination(
  tier: Tier,
  symbol: string,
  timeframe: string
): boolean {
  const availableSymbols = getAvailableSymbols(tier);
  const availableTimeframes = getAvailableTimeframes(tier);

  const symbolAllowed =
    availableSymbols.includes('*') || availableSymbols.includes(symbol);
  const timeframeAllowed =
    availableTimeframes.includes('*') ||
    availableTimeframes.includes(timeframe);

  return symbolAllowed && timeframeAllowed;
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: Tier): string {
  switch (tier) {
    case 'FREE':
      return 'Free';
    case 'PRO':
      return 'Pro';
    default:
      return 'Unknown';
  }
}

/**
 * Check if tier can be upgraded
 */
export function canUpgradeTier(currentTier: Tier, targetTier: Tier): boolean {
  const tierOrder: Tier[] = ['FREE', 'PRO'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  return targetIndex > currentIndex;
}

/**
 * Get upgrade path for a tier
 */
export function getUpgradePath(tier: Tier): Tier[] {
  switch (tier) {
    case 'FREE':
      return ['PRO'];
    case 'PRO':
      return [];
    default:
      return [];
  }
}
