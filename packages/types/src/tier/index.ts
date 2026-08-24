/**
 * @trading-alerts/types/tier — canonical FREE/PRO tier matrix (F68/F74, Session 11-1).
 *
 * Single source of truth for tier entitlements across the monorepo: the
 * Next.js monolith consumes it today via `lib/tier-config.ts`;
 * operation-service/money-service are staged to consume it directly from
 * Phase 12 (Stack D) and Phase 13 (Stack E) onward.
 *
 * @module @trading-alerts/types/tier
 */

export type { Tier, TierConfig } from './types';
export {
  SYMBOLS,
  TIMEFRAMES,
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  TIER_CONFIGS,
  TRIAL_CONFIG,
} from './constants';
export {
  getTierConfig,
  getAccessibleSymbols,
  getAccessibleTimeframes,
  getChartCombinations,
  canAccessSymbol,
  canAccessTimeframe,
  canAccessDrawingAlerts,
  canAccessAiAnalyst,
  canAccessMarketComments,
  canAccessMarketQualityMetrics,
} from './helpers';
