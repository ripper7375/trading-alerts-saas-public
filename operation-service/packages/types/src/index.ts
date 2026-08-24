/**
 * @trading-alerts/types — root barrel.
 *
 * Shared types, Zod validation schemas, and drawing-geometry math consumed by
 * the Next.js monolith and NestJS microservices (operation-service,
 * money-service). Established Session 4B-1 to resolve F9. See
 * docs/migration-orders/4b-1-types-and-geometry.migration-order.md.
 *
 * Subpath exports (`@trading-alerts/types/geometry`,
 * `@trading-alerts/types/alert-engine`, `@trading-alerts/types/validations`,
 * `@trading-alerts/types/tier`) are also available for more granular imports.
 *
 * @module @trading-alerts/types
 */

export * from './geometry';
export * from './alert-engine/types';
export * from './validations/alert';

// `./tier`'s SYMBOLS/TIMEFRAMES are intentionally excluded from this root
// barrel: `./validations/alert` already exports identically-valued SYMBOLS/
// TIMEFRAMES constants here (pre-existing, undisclosed at Session 11-1's
// drafting — see that order's Deviations). Both still export from their own
// subpaths (`@trading-alerts/types/validations`, `@trading-alerts/types/tier`)
// unaffected; only the flattened root re-export is de-duplicated.
export type { Tier, TierConfig } from './tier';
export {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  TIER_CONFIGS,
  TRIAL_CONFIG,
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
} from './tier';
