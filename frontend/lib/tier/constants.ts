/**
 * Indicator Tier Constants - 57-Column Database Schema
 *
 * Defines which indicators are available for each tier level based on
 * the new 57-column flat schema (replacing old 14-column JSON structure).
 *
 * Database Structure:
 * - System Columns (8): timestamp, open, high, low, close, volume, timeframe, collected_at
 * - FREE Indicators (16 columns): fractal_diagonal (8) + fractal_horizontal (8)
 * - PRO Indicators (33 columns): moving_averages (3) + body_momentum (2) + heiken_ashi (7) + keltner_channels (10) + support_resistance (8) + zigzag (3)
 *
 * @module frontend/lib/tier/constants
 */

import type { Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR TYPE CONSTANTS (NEW 57-COLUMN SCHEMA)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier indicators (2 groups, 16 columns total)
 * Available to both FREE and PRO tier users
 */
export const FREE_TIER_INDICATORS = [
  'fractal_diagonal', // 8 columns: diag_asc_line_1-3, diag_desc_line_1-3, diag_high/low_map
  'fractal_horizontal', // 8 columns: horiz_peak_line_1-3, horiz_bottom_line_1-3, horiz_high/low_map
] as const;

export type FreeTierIndicator = (typeof FREE_TIER_INDICATORS)[number];

/**
 * PRO-only indicators (6 groups, 33 columns total)
 * Requires PRO tier subscription to access
 */
export const PRO_ONLY_INDICATORS = [
  'moving_averages', // 3 columns: tema, hrma, smma
  'body_momentum', // 2 columns: body_size, body_direction
  'heiken_ashi', // 7 columns: ha_open, ha_high, ha_low, ha_close, ha_color, ha_trend, ha_strength
  'keltner_channels', // 10 columns: kc_upper, kc_middle, kc_lower, kc_upper_ema, kc_middle_ema, kc_lower_ema, kc_squeeze, kc_squeeze_pro, kc_width, kc_width_ema
  'support_resistance', // 8 columns: sr_1, sr_2, sr_3, sr_4, sr_5, sr_6, sr_7, sr_8
  'zigzag', // 3 columns: zigzag_high, zigzag_low, zigzag_trend
] as const;

export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

/**
 * All available indicators (FREE + PRO = 8 groups, 49 indicator columns)
 * System columns (8) + Indicator columns (49) = 57 total columns
 */
export const ALL_INDICATORS = [
  ...FREE_TIER_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;

export type IndicatorId = (typeof ALL_INDICATORS)[number];

// Legacy types and constants for backward compatibility
export type BasicIndicator = FreeTierIndicator;
export const BASIC_INDICATORS = FREE_TIER_INDICATORS; // Legacy alias

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR METADATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Indicator display information with column mappings
 */
export interface IndicatorMetadata {
  id: IndicatorId;
  label: string;
  description: string;
  category:
    | 'trendlines'
    | 'support_resistance'
    | 'trend'
    | 'momentum'
    | 'candlesticks'
    | 'volatility';
  tier: Tier;
  columns: string[]; // Database column names
  colors: Record<string, string>; // Color scheme for visualization
  dataPattern: 'sparse' | 'continuous'; // Data density
}

// Legacy interface for backward compatibility - now aliased to new structure
export type IndicatorMeta = IndicatorMetadata;

/**
 * Complete indicator metadata map with all 8 indicator groups
 */
export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMetadata> = {
  // ========================================
  // FREE TIER INDICATORS (2 groups)
  // ========================================

  fractal_diagonal: {
    id: 'fractal_diagonal',
    label: 'Fractal Diagonal Lines',
    description: 'Dynamic trendlines based on fractal analysis',
    category: 'trendlines',
    tier: 'FREE',
    columns: [
      'diag_asc_line_1',
      'diag_asc_line_2',
      'diag_asc_line_3',
      'diag_desc_line_1',
      'diag_desc_line_2',
      'diag_desc_line_3',
      'diag_high_map',
      'diag_low_map',
    ],
    colors: {
      ascending: '#00c853',
      descending: '#f23645',
    },
    dataPattern: 'sparse', // 5-15% of bars have values
  },

  fractal_horizontal: {
    id: 'fractal_horizontal',
    label: 'Fractal Horizontal Lines',
    description: 'Horizontal support and resistance levels from fractals',
    category: 'support_resistance',
    tier: 'FREE',
    columns: [
      'horiz_peak_line_1',
      'horiz_peak_line_2',
      'horiz_peak_line_3',
      'horiz_bottom_line_1',
      'horiz_bottom_line_2',
      'horiz_bottom_line_3',
      'horiz_high_map',
      'horiz_low_map',
    ],
    colors: {
      peaks: '#f23645',
      bottoms: '#00c853',
    },
    dataPattern: 'sparse', // 5-15% of bars have values
  },

  // ========================================
  // PRO TIER INDICATORS (6 groups)
  // ========================================

  moving_averages: {
    id: 'moving_averages',
    label: 'Moving Averages (TEMA/HRMA/SMMA)',
    description: 'Triple exponential, hull-like, and smoothed moving averages',
    category: 'trend',
    tier: 'PRO',
    columns: ['tema', 'hrma', 'smma'],
    colors: {
      tema: '#808080',
      hrma: '#00CED1',
      smma: '#0000FF',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  body_momentum: {
    id: 'body_momentum',
    label: 'Body Size Momentum',
    description: 'Candle body size analysis with direction classification',
    category: 'momentum',
    tier: 'PRO',
    columns: ['body_size', 'body_direction'],
    colors: {
      up_normal: '#90ee90',
      up_large: '#00c853',
      up_extreme: '#2e7d32',
      down_normal: '#ffcdd2',
      down_large: '#f23645',
      down_extreme: '#c62828',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  heiken_ashi: {
    id: 'heiken_ashi',
    label: 'Heiken Ashi',
    description: 'Smoothed candlesticks with trend and strength analysis',
    category: 'candlesticks',
    tier: 'PRO',
    columns: [
      'ha_open',
      'ha_high',
      'ha_low',
      'ha_close',
      'ha_color',
      'ha_trend',
      'ha_strength',
    ],
    colors: {
      bullish: '#00c853',
      bearish: '#f23645',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  keltner_channels: {
    id: 'keltner_channels',
    label: 'Keltner Channels',
    description: 'Volatility channel system with squeeze detection',
    category: 'volatility',
    tier: 'PRO',
    columns: [
      'kc_upper',
      'kc_middle',
      'kc_lower',
      'kc_upper_ema',
      'kc_middle_ema',
      'kc_lower_ema',
      'kc_squeeze',
      'kc_squeeze_pro',
      'kc_width',
      'kc_width_ema',
    ],
    colors: {
      upper: '#2196f3',
      middle: '#808080',
      lower: '#ff5722',
      ema: '#9c27b0',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  support_resistance: {
    id: 'support_resistance',
    label: 'Support & Resistance',
    description: 'Key support and resistance levels (8 levels)',
    category: 'support_resistance',
    tier: 'PRO',
    columns: [
      'sr_1',
      'sr_2',
      'sr_3',
      'sr_4',
      'sr_5',
      'sr_6',
      'sr_7',
      'sr_8',
    ],
    colors: {
      support: '#00c853',
      resistance: '#f23645',
    },
    dataPattern: 'sparse', // 10-30% of bars have values
  },

  zigzag: {
    id: 'zigzag',
    label: 'ZigZag',
    description: 'Market structure with swing highs/lows and trend direction',
    category: 'trend',
    tier: 'PRO',
    columns: ['zigzag_high', 'zigzag_low', 'zigzag_trend'],
    colors: {
      highs: '#f23645',
      lows: '#00c853',
      trend: '#ffa726',
    },
    dataPattern: 'sparse', // 2-5% of bars have values
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEGACY COLOR CONSTANTS (for backward compatibility)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Keltner Channel band colors
 */
export const KELTNER_COLORS = {
  ultraExtremeUpper: '#9C27B0',
  extremeUpper: '#AB47BC',
  upperMost: '#BA68C8',
  upper: '#CE93D8',
  upperMiddle: '#FF5722',
  lowerMiddle: '#FF7043',
  lower: '#CE93D8',
  lowerMost: '#BA68C8',
  extremeLower: '#AB47BC',
  ultraExtremeLower: '#9C27B0',
} as const;

/**
 * Momentum candle type colors
 */
export const MOMENTUM_COLORS = {
  UP_NORMAL: '#26a69a',
  UP_LARGE: '#00897b',
  UP_EXTREME: '#004d40',
  DOWN_NORMAL: '#ef5350',
  DOWN_LARGE: '#c62828',
  DOWN_EXTREME: '#7f0000',
} as const;

/**
 * Moving average colors (TEMA, HRMA, SMMA)
 */
export const MA_COLORS = {
  tema: '#808080',
  hrma: '#00CED1',
  smma: '#0000FF',
} as const;

/**
 * ZigZag indicator colors
 */
export const ZIGZAG_COLORS = {
  peaks: '#f23645',
  bottoms: '#00c853',
  line: '#ffa726',
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM COLUMNS (8 columns - accessible to all tiers)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * System columns - always accessible by both FREE and PRO tiers
 */
export const SYSTEM_COLUMNS = [
  'timestamp',
  'open',
  'high',
  'low',
  'close',
  'volume',
  'timeframe',
  'collected_at',
] as const;

export type SystemColumn = (typeof SYSTEM_COLUMNS)[number];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all database columns for a specific indicator
 */
export function getIndicatorColumns(indicator: IndicatorId): string[] {
  return INDICATOR_METADATA[indicator].columns;
}

/**
 * Get indicator ID by column name
 */
export function getIndicatorByColumn(columnName: string): IndicatorId | null {
  for (const [id, metadata] of Object.entries(INDICATOR_METADATA)) {
    if (metadata.columns.includes(columnName)) {
      return id as IndicatorId;
    }
  }
  return null;
}

/**
 * Check if a column name is valid in the 57-column schema
 */
export function isValidColumnName(columnName: string): boolean {
  // Check system columns
  if (SYSTEM_COLUMNS.includes(columnName as SystemColumn)) {
    return true;
  }

  // Check indicator columns
  for (const metadata of Object.values(INDICATOR_METADATA)) {
    if (metadata.columns.includes(columnName)) {
      return true;
    }
  }

  return false;
}

/**
 * Get total column count for a tier
 * FREE: 8 system + 16 indicator = 24 columns
 * PRO: 8 system + 49 indicator = 57 columns
 */
export function getTierColumnCount(tier: Tier): number {
  if (tier === 'FREE') {
    const freeIndicatorColumns = FREE_TIER_INDICATORS.reduce(
      (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
      0
    );
    return SYSTEM_COLUMNS.length + freeIndicatorColumns; // 8 + 16 = 24
  }

  // PRO tier
  const allIndicatorColumns = ALL_INDICATORS.reduce(
    (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
    0
  );
  return SYSTEM_COLUMNS.length + allIndicatorColumns; // 8 + 49 = 57
}
