/**
 * Indicator Tier Validator — V8 (ungated)
 *
 * V8 single-symbol architecture: BOTH tiers have full access to all
 * indicators and all market_data_v6 columns. This module keeps its original
 * API surface so existing callers compile, but every access check now
 * resolves to "allowed". Tier differentiation lives elsewhere (Alerts,
 * multi-timeframe visualization, drawing-engine line alerts).
 *
 * @module lib/tier/validator
 */

import type { Tier } from '@/lib/tier-config';

import {
  ALL_INDICATORS,
  SYSTEM_COLUMNS,
  INDICATOR_METADATA,
  type FreeTierIndicator,
  type IndicatorId,
  type ProOnlyIndicator,
  type SystemColumn,
} from './constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR ACCESS CONTROL (V8: no gating)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a user tier can access a specific indicator.
 * V8: true for every valid indicator, regardless of tier.
 */
export function canAccessIndicator(_tier: Tier, indicator: string): boolean {
  return ALL_INDICATORS.includes(indicator as IndicatorId);
}

/**
 * Check if an indicator requires PRO tier.
 * V8: no indicator is PRO-only.
 */
export function isProOnlyIndicator(_indicator: string): boolean {
  return false;
}

/**
 * Get all accessible indicators for a tier.
 * V8: every indicator, for every tier.
 */
export function getAccessibleIndicators(_tier: Tier): IndicatorId[] {
  return [...ALL_INDICATORS];
}

/**
 * Get all locked indicators for a tier.
 * V8: always empty.
 */
export function getLockedIndicators(_tier: Tier): IndicatorId[] {
  return [];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLUMN-LEVEL ACCESS CONTROL (V8: no gating)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user's tier can access a specific database column.
 * V8: true for every column known to the schema.
 */
export function canAccessColumn(_tier: Tier, columnName: string): boolean {
  if (SYSTEM_COLUMNS.includes(columnName as SystemColumn)) {
    return true;
  }

  for (const metadata of Object.values(INDICATOR_METADATA)) {
    if (metadata.columns.includes(columnName)) {
      return true;
    }
  }

  // Unknown column — not part of the schema
  return false;
}

/**
 * Get list of accessible columns for a tier.
 * V8: all columns, for every tier.
 */
export function getAccessibleColumns(_tier: Tier): string[] {
  const columns: string[] = [...SYSTEM_COLUMNS];
  ALL_INDICATORS.forEach((indicator) => {
    columns.push(...INDICATOR_METADATA[indicator].columns);
  });
  return columns;
}

/**
 * Get columns that are locked for a tier.
 * V8: always empty.
 */
export function getLockedColumns(_tier: Tier): string[] {
  return [];
}

/**
 * Filter API response data based on user's tier.
 * V8: no filtering — returns data unchanged.
 */
export function filterDataByTier<T extends Record<string, unknown>>(
  _tier: Tier,
  data: T
): Partial<T> {
  return data;
}

/**
 * Filter multiple data records by tier.
 * V8: no filtering — returns array unchanged.
 */
export function filterDataArrayByTier<T extends Record<string, unknown>>(
  _tier: Tier,
  dataArray: T[]
): Partial<T>[] {
  return dataArray;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Validate a list of indicator IDs and filter to valid ones.
 * V8: filters only on validity, not tier.
 */
export function filterAccessibleIndicators(
  _tier: Tier,
  indicators: string[]
): IndicatorId[] {
  return indicators.filter((indicator): indicator is IndicatorId =>
    ALL_INDICATORS.includes(indicator as IndicatorId)
  );
}

/**
 * Validate a list of column names and filter to schema-valid ones.
 */
export function filterAccessibleColumns(
  tier: Tier,
  columns: string[]
): string[] {
  return columns.filter((column) => canAccessColumn(tier, column));
}

/**
 * Get upgrade information for locked indicators.
 * V8: upgrade never required — nothing is locked.
 */
export function getIndicatorUpgradeInfo(
  _tier: Tier,
  requestedIndicators: string[]
): {
  upgradeRequired: boolean;
  lockedIndicators: string[];
  accessibleIndicators: string[];
} {
  return {
    upgradeRequired: false,
    lockedIndicators: [],
    accessibleIndicators: requestedIndicators.filter(isValidIndicatorId),
  };
}

/**
 * Get upgrade information for locked columns.
 * V8: upgrade never required — nothing is locked.
 */
export function getColumnUpgradeInfo(
  tier: Tier,
  requestedColumns: string[]
): {
  upgradeRequired: boolean;
  lockedColumns: string[];
  accessibleColumns: string[];
} {
  return {
    upgradeRequired: false,
    lockedColumns: [],
    accessibleColumns: requestedColumns.filter((column) =>
      canAccessColumn(tier, column)
    ),
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE GUARDS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Type guard to check if a string is a valid indicator ID
 */
export function isValidIndicatorId(id: string): id is IndicatorId {
  return ALL_INDICATORS.includes(id as IndicatorId);
}

/**
 * Type guard to check if a string is a valid system column
 */
export function isSystemColumn(column: string): column is SystemColumn {
  return SYSTEM_COLUMNS.includes(column as SystemColumn);
}

/**
 * Type guard to check if a string is a FREE tier indicator.
 * V8: every valid indicator is available to FREE tier.
 */
export function isFreeTierIndicator(id: string): id is FreeTierIndicator {
  return isValidIndicatorId(id);
}

/**
 * Type guard to check if a string is a PRO-only indicator.
 * V8: no indicator is PRO-only.
 */
export function isProIndicator(_id: string): _id is ProOnlyIndicator {
  return false;
}
