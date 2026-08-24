/**
 * Trading Alerts SaaS - Tier Validation
 * Validates user access based on subscription tier.
 *
 * V8 single-symbol architecture:
 * - Symbol/timeframe/data-column access is IDENTICAL for both tiers
 *   (XAUUSD, M5/M15, all market_data_v6 columns).
 * - The only gated resource here is Alerts: FREE 0 / PRO 100.
 * - Watchlist validation removed (feature deleted); deprecated stubs remain
 *   until the Part 10 purge removes their last consumers.
 */

import {
  SYMBOLS,
  TIMEFRAMES,
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  canAccessAiAnalyst as sharedCanAccessAiAnalyst,
  canAccessMarketComments as sharedCanAccessMarketComments,
  type Tier,
} from './tier-config';

export type { Tier };

// =============================================
// Tier Limits Configuration
// =============================================

/**
 * Tier limits derived from the canonical lib/tier-config.ts.
 * FREE: 0 alerts | PRO: 100 alerts. Everything else is shared.
 */
export const TIER_LIMITS = {
  FREE: {
    maxAlerts: FREE_TIER_CONFIG.maxAlerts, // 0
    rateLimit: FREE_TIER_CONFIG.rateLimit, // 60/hour
    symbols: SYMBOLS,
    timeframes: TIMEFRAMES,
    chartCombinations: FREE_TIER_CONFIG.chartCombinations, // 2
  },
  PRO: {
    maxAlerts: PRO_TIER_CONFIG.maxAlerts, // 100
    rateLimit: PRO_TIER_CONFIG.rateLimit, // 300/hour
    symbols: SYMBOLS,
    timeframes: TIMEFRAMES,
    chartCombinations: PRO_TIER_CONFIG.chartCombinations, // 2
  },
} as const;

// =============================================
// Type Definitions
// =============================================

export interface TierConfig {
  maxSymbols: number;
  allowedSymbols: string[];
  allowedTimeframes: string[];
  maxAlerts: number;
  rateLimit: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: {
    maxSymbols: 1,
    allowedSymbols: [...SYMBOLS],
    allowedTimeframes: [...TIMEFRAMES],
    maxAlerts: TIER_LIMITS.FREE.maxAlerts,
    rateLimit: TIER_LIMITS.FREE.rateLimit,
  },
  PRO: {
    maxSymbols: 1,
    allowedSymbols: [...SYMBOLS],
    allowedTimeframes: [...TIMEFRAMES],
    maxAlerts: TIER_LIMITS.PRO.maxAlerts,
    rateLimit: TIER_LIMITS.PRO.rateLimit,
  },
};

// =============================================
// Core Tier Functions
// =============================================

/**
 * Get tier limits
 */
export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}

/**
 * Get tier configuration (legacy)
 */
export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

// =============================================
// Symbol Access Functions
// =============================================

/**
 * Check if tier can access symbol.
 * V8: tier-independent — only XAUUSD is supported.
 *
 * Argument order is `(symbol, tier)` — matches `@trading-alerts/types/tier`'s
 * `canAccessSymbol` (and `lib/tier-config.ts`'s re-export of it), fixed at
 * Session 11-2 after this function's own signature drifted to `(tier, symbol)`,
 * the opposite of every other `canAccessSymbol` in the repo (DECISION-LOG.md,
 * Session 11-2 CONFIRM).
 */
export function canAccessSymbol(symbol: string, _tier?: Tier): boolean {
  return (SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Validate if a tier can access a specific symbol
 */
export function validateTierAccess(
  tier: Tier,
  symbol: string
): ValidationResult {
  if (!TIER_CONFIGS[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  if (canAccessSymbol(symbol, tier)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Symbol ${symbol} is not supported. This platform provides XAUUSD data only.`,
  };
}

/**
 * Get symbol limit for tier
 */
export function getSymbolLimit(tier: Tier): number {
  return TIER_CONFIGS[tier].maxSymbols;
}

// =============================================
// Timeframe Access Functions
// =============================================

/**
 * Check if tier can access timeframe.
 * V8: tier-independent — only M5 and M15 are supported.
 */
export function canAccessTimeframe(timeframe: string, _tier?: Tier): boolean {
  return (TIMEFRAMES as readonly string[]).includes(timeframe.toUpperCase());
}

/**
 * Validate timeframe access
 */
export function validateTimeframeAccess(
  tier: Tier,
  timeframe: string
): ValidationResult {
  if (canAccessTimeframe(timeframe, tier)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Timeframe ${timeframe} is not supported. Available timeframes: ${TIMEFRAMES.join(', ')}.`,
  };
}

// =============================================
// Alert Functions
// =============================================

/**
 * Get alert limit for tier
 * FREE: 0 alerts (PRO feature), PRO: 100 alerts
 */
export function getAlertLimit(tier: Tier): number {
  return TIER_LIMITS[tier].maxAlerts;
}

/**
 * Check if tier can create more alerts.
 * FREE users can never create alerts — Alerts are a PRO feature.
 */
export function canCreateAlert(
  tier: Tier,
  currentAlerts: number
): ValidationResult {
  if (tier === 'FREE') {
    return {
      allowed: false,
      reason:
        'Alerts are a PRO feature. Upgrade to PRO to create up to ' +
        `${TIER_LIMITS.PRO.maxAlerts} alerts.`,
    };
  }

  const limit = getAlertLimit(tier);
  if (currentAlerts < limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Alert limit reached (${limit}).`,
  };
}

// =============================================
// Stack D / Stack E Feature Access (F68/F74, Session 11-1 entitlements)
// =============================================

/**
 * Whether a tier may use the Stack D conversational AI analyst (Phase 12).
 * Delegates to `@trading-alerts/types/tier`'s canonical entitlement (via
 * `lib/tier-config.ts`) and wraps it in this file's own `ValidationResult`
 * shape, matching `canCreateAlert`'s convention.
 */
export function canAccessAiAnalyst(tier: Tier): ValidationResult {
  if (sharedCanAccessAiAnalyst(tier)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'The AI analyst is a PRO feature. Upgrade to PRO to access it.',
  };
}

/**
 * Whether a tier may receive the Stack E live market-comments feed (Phase 13).
 */
export function canAccessMarketComments(tier: Tier): ValidationResult {
  if (sharedCanAccessMarketComments(tier)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      'Live market comments are a PRO feature. Upgrade to PRO to access them.',
  };
}

// =============================================
// Indicator / Column Access
// V8: both tiers access ALL indicators and ALL market_data_v6 columns.
// =============================================

/**
 * Check if tier can access indicator.
 * V8: always true — no indicator gating.
 */
export function canAccessIndicator(_indicator: string, _tier: Tier): boolean {
  return true;
}

/**
 * Get accessible indicators for tier.
 * V8: no indicator gating exists — every market_data_v6 column is available
 * to every tier. Returns an empty list since there's no longer a metadata
 * source to enumerate (the legacy 63-column indicator scaffold was removed).
 */
export function getAccessibleIndicators(_tier: Tier): string[] {
  return [];
}

/**
 * Get locked (PRO-only) indicators.
 * V8: always empty — no indicator gating.
 */
export function getLockedIndicators(_tier: Tier): string[] {
  return [];
}

// =============================================
// Rate Limit Functions
// =============================================

/**
 * Get rate limit for tier (per HOUR)
 * FREE: 60/hour, PRO: 300/hour
 */
export function getRateLimit(tier: Tier): number {
  return TIER_LIMITS[tier].rateLimit;
}

/**
 * Alias for getRateLimit
 */
export function getRateLimitForTier(tier: Tier): number {
  return getRateLimit(tier);
}

// =============================================
// Chart Combination Functions
// =============================================

/**
 * Get chart combinations for tier (V8: 2 for both — XAUUSD × M5/M15)
 */
export function getChartCombinations(tier: Tier): number {
  return TIER_LIMITS[tier].chartCombinations;
}

/**
 * Get all combinations count for a tier (legacy)
 */
export function getCombinationCount(tier: Tier): number {
  return getAvailableSymbols(tier).length * getAvailableTimeframes(tier).length;
}

// =============================================
// Chart Access Validation
// =============================================

/**
 * Validate chart access (symbol + timeframe combination)
 */
export function validateChartAccess(
  tier: Tier,
  symbol: string,
  timeframe: string
): ValidationResult {
  const symbolResult = validateTierAccess(tier, symbol);
  if (!symbolResult.allowed) {
    return symbolResult;
  }

  const timeframeResult = validateTimeframeAccess(tier, timeframe);
  if (!timeframeResult.allowed) {
    return timeframeResult;
  }

  return { allowed: true };
}

// =============================================
// Comprehensive Validation
// =============================================

/**
 * Validate full tier access with all parameters
 */
export function validateFullTierAccess(params: {
  tier: Tier;
  symbol?: string;
  timeframe?: string;
  alertCount?: number;
  indicator?: string;
}): string | null {
  const { tier, symbol, timeframe, alertCount } = params;

  if (symbol && !canAccessSymbol(symbol, tier)) {
    return `Symbol ${symbol} is not supported. This platform provides XAUUSD data only.`;
  }

  if (timeframe && !canAccessTimeframe(timeframe, tier)) {
    return `Timeframe ${timeframe} is not supported. Available timeframes: ${TIMEFRAMES.join(', ')}.`;
  }

  if (alertCount !== undefined) {
    const result = canCreateAlert(tier, alertCount);
    if (!result.allowed) {
      return result.reason ?? 'Alert creation not allowed.';
    }
  }

  // Indicators/columns: no gating in V8 — always allowed.

  return null; // Access allowed
}

// =============================================
// Utility Functions
// =============================================

/**
 * Get available symbols for a tier (V8: always ['XAUUSD'])
 */
export function getAvailableSymbols(tier: Tier): string[] {
  return TIER_CONFIGS[tier]?.allowedSymbols ?? [];
}

/**
 * Get available timeframes for a tier (V8: always ['M5', 'M15'])
 */
export function getAvailableTimeframes(tier: Tier): string[] {
  return TIER_CONFIGS[tier]?.allowedTimeframes ?? [];
}

/**
 * Get all combinations for a tier
 */
export function getAllCombinations(
  tier: Tier
): Array<{ symbol: string; timeframe: string }> {
  const combinations: Array<{ symbol: string; timeframe: string }> = [];

  for (const symbol of getAvailableSymbols(tier)) {
    for (const timeframe of getAvailableTimeframes(tier)) {
      combinations.push({ symbol, timeframe });
    }
  }

  return combinations;
}
