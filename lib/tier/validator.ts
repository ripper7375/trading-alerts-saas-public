/**
 * Indicator Tier Validator - 61-Column Schema
 *
 * Provides access control for tier-gated indicators and database columns.
 *
 * @module lib/tier/validator
 */

import type { Tier } from '@/lib/tier-config';

import {
  ALL_INDICATORS,
  FREE_TIER_INDICATORS,
  PRO_ONLY_INDICATORS,
  SYSTEM_COLUMNS,
  INDICATOR_METADATA,
  type FreeTierIndicator,
  type IndicatorId,
  type ProOnlyIndicator,
  type SystemColumn,
} from './constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR ACCESS CONTROL
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
 * canAccessIndicator('FREE', 'fractal_diagonal');    // true
 * canAccessIndicator('FREE', 'keltner_channels');    // false
 * canAccessIndicator('PRO', 'keltner_channels');     // true
 * ```
 */
export function canAccessIndicator(tier: Tier, indicator: string): boolean {
  // PRO tier can access all indicators
  if (tier === 'PRO') {
    return ALL_INDICATORS.includes(indicator as IndicatorId);
  }

  // FREE tier can only access free indicators
  if (PRO_ONLY_INDICATORS.includes(indicator as ProOnlyIndicator)) {
    return false;
  }

  return FREE_TIER_INDICATORS.includes(indicator as FreeTierIndicator);
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
  return [...FREE_TIER_INDICATORS];
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
// COLUMN-LEVEL ACCESS CONTROL (NEW)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user's tier can access a specific database column
 *
 * @param tier - User tier (FREE or PRO)
 * @param columnName - Database column name
 * @returns True if tier can access the column
 *
 * @example
 * ```typescript
 * canAccessColumn('FREE', 'timestamp');         // true (system column)
 * canAccessColumn('FREE', 'diag_asc_line_1');   // true (FREE indicator)
 * canAccessColumn('FREE', 'tema');              // false (PRO only)
 * canAccessColumn('PRO', 'tema');               // true
 * ```
 */
export function canAccessColumn(tier: Tier, columnName: string): boolean {
  // System columns: Always accessible (FREE + PRO)
  if (SYSTEM_COLUMNS.includes(columnName as SystemColumn)) {
    return true;
  }

  // Check which indicator owns this column
  for (const [indicatorId, metadata] of Object.entries(INDICATOR_METADATA)) {
    if (metadata.columns.includes(columnName)) {
      // Found the indicator - check if tier can access it
      return canAccessIndicator(tier, indicatorId);
    }
  }

  // Column not found in schema
  return false;
}

/**
 * Get list of accessible columns for a tier
 *
 * @param tier - User tier (FREE or PRO)
 * @returns Array of accessible column names
 *
 * FREE tier: 25 columns (9 system + 16 indicators)
 * PRO tier: 61 columns (9 system + 52 indicators)
 */
export function getAccessibleColumns(tier: Tier): string[] {
  const columns: string[] = [...SYSTEM_COLUMNS];

  if (tier === 'FREE') {
    // Add FREE tier indicator columns
    FREE_TIER_INDICATORS.forEach((indicator) => {
      columns.push(...INDICATOR_METADATA[indicator].columns);
    });
  } else {
    // PRO tier gets all indicator columns
    ALL_INDICATORS.forEach((indicator) => {
      columns.push(...INDICATOR_METADATA[indicator].columns);
    });
  }

  return columns;
}

/**
 * Get columns that are locked for a tier
 *
 * @param tier - User tier
 * @returns Array of locked column names (empty for PRO)
 */
export function getLockedColumns(tier: Tier): string[] {
  if (tier === 'PRO') {
    return [];
  }

  const locked: string[] = [];
  PRO_ONLY_INDICATORS.forEach((indicator) => {
    locked.push(...INDICATOR_METADATA[indicator].columns);
  });

  return locked;
}

/**
 * Filter API response data based on user's tier
 * Removes columns the user doesn't have access to
 *
 * @param tier - User tier
 * @param data - Raw data object with all columns
 * @returns Filtered data object with only accessible columns
 *
 * @example
 * ```typescript
 * const rawData = {
 *   timestamp: 1705324800,
 *   close: 43265,
 *   tema: 43260,        // PRO only
 *   diag_asc_line_1: 43200,  // FREE
 * };
 *
 * const freeData = filterDataByTier('FREE', rawData);
 * // { timestamp: 1705324800, close: 43265, diag_asc_line_1: 43200 }
 * // tema removed
 *
 * const proData = filterDataByTier('PRO', rawData);
 * // { timestamp: 1705324800, close: 43265, tema: 43260, diag_asc_line_1: 43200 }
 * // All columns included
 * ```
 */
export function filterDataByTier<T extends Record<string, unknown>>(
  tier: Tier,
  data: T
): Partial<T> {
  const accessibleColumns = getAccessibleColumns(tier);
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (accessibleColumns.includes(key)) {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }

  return filtered;
}

/**
 * Filter multiple data records by tier
 *
 * @param tier - User tier
 * @param dataArray - Array of data objects
 * @returns Array of filtered data objects
 */
export function filterDataArrayByTier<T extends Record<string, unknown>>(
  tier: Tier,
  dataArray: T[]
): Partial<T>[] {
  return dataArray.map((data) => filterDataByTier(tier, data));
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
 * Validate a list of column names and filter to accessible ones
 *
 * @param tier - User tier
 * @param columns - Array of column names to validate
 * @returns Filtered array of accessible column names
 */
export function filterAccessibleColumns(
  tier: Tier,
  columns: string[]
): string[] {
  return columns.filter((column) => canAccessColumn(tier, column));
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
    // Only consider valid indicators
    if (!isValidIndicatorId(indicator)) {
      continue;
    }

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
 * Get upgrade information for locked columns
 *
 * @param tier - User tier
 * @param requestedColumns - Columns user wants to access
 * @returns Object with upgrade details
 */
export function getColumnUpgradeInfo(
  tier: Tier,
  requestedColumns: string[]
): {
  upgradeRequired: boolean;
  lockedColumns: string[];
  accessibleColumns: string[];
} {
  const accessible: string[] = [];
  const locked: string[] = [];

  for (const column of requestedColumns) {
    if (canAccessColumn(tier, column)) {
      accessible.push(column);
    } else {
      locked.push(column);
    }
  }

  return {
    upgradeRequired: locked.length > 0,
    lockedColumns: locked,
    accessibleColumns: accessible,
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
 * Type guard to check if a string is a FREE tier indicator
 */
export function isFreeTierIndicator(id: string): id is FreeTierIndicator {
  return FREE_TIER_INDICATORS.includes(id as FreeTierIndicator);
}

/**
 * Type guard to check if a string is a PRO-only indicator
 */
export function isProIndicator(id: string): id is ProOnlyIndicator {
  return PRO_ONLY_INDICATORS.includes(id as ProOnlyIndicator);
}
