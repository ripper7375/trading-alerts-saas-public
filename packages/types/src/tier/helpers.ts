/**
 * Tier-access validation and lookup helpers (F68/F74, Session 11-1).
 *
 * @module @trading-alerts/types/tier/helpers
 */

import { SYMBOLS, TIMEFRAMES, TIER_CONFIGS } from './constants';
import type { Tier, TierConfig } from './types';

/** Get tier configuration by tier name. Throws on an invalid tier. */
export function getTierConfig(tier: Tier): TierConfig {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(
      `Invalid tier: ${tier}. Valid tiers are: ${Object.keys(TIER_CONFIGS).join(', ')}`
    );
  }
  return config;
}

/**
 * All symbols accessible by a tier.
 * V8: identical for both tiers (XAUUSD only).
 */
export function getAccessibleSymbols(_tier: Tier): readonly string[] {
  return SYMBOLS;
}

/**
 * All timeframes accessible by a tier.
 * V8: identical for both tiers (M5, M15).
 */
export function getAccessibleTimeframes(_tier: Tier): readonly string[] {
  return TIMEFRAMES;
}

/** Chart combination count for a tier (V8: always 2 — XAUUSD × M5/M15). */
export function getChartCombinations(tier: Tier): number {
  return getTierConfig(tier).chartCombinations;
}

/**
 * Whether a tier can access a specific symbol.
 * V8: tier-independent — XAUUSD only.
 */
export function canAccessSymbol(symbol: string, _tier: Tier): boolean {
  return (SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Whether a tier can access a specific timeframe.
 * V8: tier-independent — M5 and M15 only.
 */
export function canAccessTimeframe(timeframe: string, _tier: Tier): boolean {
  return (TIMEFRAMES as readonly string[]).includes(timeframe.toUpperCase());
}

/** Whether a tier may attach a server-monitored line alert to a drawing (Phase 10). */
export function canAccessDrawingAlerts(tier: Tier): boolean {
  return getTierConfig(tier).drawingAlertsAllowed;
}

/** Whether a tier may use the Stack D conversational AI analyst (Phase 12). */
export function canAccessAiAnalyst(tier: Tier): boolean {
  return getTierConfig(tier).aiAnalystAllowed;
}

/** Whether a tier may receive the Stack E live market-comments socket stream (Phase 13). */
export function canAccessMarketComments(tier: Tier): boolean {
  return getTierConfig(tier).marketCommentsFeedAllowed;
}

/** Whether a tier may view the Stack E quality-metrics panel (Phase 13). */
export function canAccessMarketQualityMetrics(tier: Tier): boolean {
  return getTierConfig(tier).marketQualityMetricsAllowed;
}
