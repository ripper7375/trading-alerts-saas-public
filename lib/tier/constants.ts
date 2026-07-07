/**
 * Indicator Tier Constants - 63-Column Database Schema
 *
 * Defines which indicators are available for each tier level based on
 * the new 61-column flat schema (replacing old 14-column JSON structure).
 *
 * Database Structure:
 * - System Columns (9): timestamp, symbol, open, high, low, close, volume, timeframe, collected_at
 * - FREE Indicators (16 columns): fractal_diagonal (8) + fractal_horizontal (8)
 * - PRO Indicators (38 columns): moving_averages (3) + body_momentum (3) + heiken_ashi (8) + keltner_channels (10) + support_resistance (8) + zigzag (3) + dual_tema_hl (2) + pinbar_detection (1)
 *
 * @module lib/tier/constants
 */

import type { Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR TYPE CONSTANTS (NEW 63-COLUMN SCHEMA)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All indicators — V8: available to BOTH tiers (no gating).
 * The FREE/PRO split below is retained only as aliases so existing
 * imports keep compiling; there are no PRO-only indicators anymore.
 */
export const ALL_INDICATORS = [
  'fractal_diagonal', // 8 columns: diag_asc_line_1-3, diag_desc_line_1-3, diag_high/low_map
  'fractal_horizontal', // 8 columns: horiz_peak_line_1-3, horiz_bottom_line_1-3, horiz_high/low_map
  'moving_averages', // 3 columns: tema, hrma, smma
  'body_momentum', // 3 columns: body_size, body_direction, body_classification
  'heiken_ashi', // 8 columns: ha_open, ha_high, ha_low, ha_close, ha_color, ha_trend, ha_body_size, ha_body_zscore
  'keltner_channels', // 10 columns: kc_ultra_extreme_upper, kc_extreme_upper, kc_uppermost, kc_upper, kc_upper_middle, kc_lower_middle, kc_lower, kc_lowermost, kc_extreme_lower, kc_ultra_extreme_lower
  'support_resistance', // 8 columns: sr_1, sr_2, sr_3, sr_4, sr_5, sr_6, sr_7, sr_8
  'zigzag', // 3 columns: zigzag_high, zigzag_low, ema
  'dual_tema_hl', // 2 columns: dual_tema_high, dual_tema_low
  'pinbar_detection', // 1 column: pinbar
] as const;

export type IndicatorId = (typeof ALL_INDICATORS)[number];

/**
 * @deprecated V8: all indicators are available to every tier. Use ALL_INDICATORS.
 */
export const FREE_TIER_INDICATORS = ALL_INDICATORS;
export type FreeTierIndicator = (typeof FREE_TIER_INDICATORS)[number];

/**
 * @deprecated V8: no PRO-only indicators. Always empty.
 */
export const PRO_ONLY_INDICATORS = [] as const;
export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

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
 * Complete indicator metadata map with all 10 indicator groups
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
  // PRO TIER INDICATORS (8 groups)
  // ========================================

  moving_averages: {
    id: 'moving_averages',
    label: 'Moving Averages (TEMA/HRMA/SMMA)',
    description: 'Triple exponential, hull-like, and smoothed moving averages',
    category: 'trend',
    tier: 'FREE', // V8: ungated — available to both tiers
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
    description: 'Candle body size analysis with Z-score classification',
    category: 'momentum',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: ['body_size', 'body_direction', 'body_classification'],
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
    description: 'Smoothed candlesticks with body size classification',
    category: 'candlesticks',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: [
      'ha_open',
      'ha_high',
      'ha_low',
      'ha_close',
      'ha_color',
      'ha_trend',
      'ha_body_size',
      'ha_body_zscore',
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
    description: '10-band volatility channel system',
    category: 'volatility',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: [
      'kc_ultra_extreme_upper',
      'kc_extreme_upper',
      'kc_uppermost',
      'kc_upper',
      'kc_upper_middle',
      'kc_lower_middle',
      'kc_lower',
      'kc_lowermost',
      'kc_extreme_lower',
      'kc_ultra_extreme_lower',
    ],
    colors: {
      upper: '#2196f3',
      middle: '#808080',
      lower: '#f23645',
      squeeze: '#9c27b0',
      width: '#ff9800',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  support_resistance: {
    id: 'support_resistance',
    label: 'Support & Resistance',
    description: 'Fractal-based support and resistance levels',
    category: 'support_resistance',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: ['sr_1', 'sr_2', 'sr_3', 'sr_4', 'sr_5', 'sr_6', 'sr_7', 'sr_8'],
    colors: {
      support: '#00c853',
      resistance: '#f23645',
    },
    dataPattern: 'sparse', // 10-30% of bars have values
  },

  zigzag: {
    id: 'zigzag',
    label: 'ZigZag + EMA',
    description: 'Market structure with swing highs/lows and EMA trend',
    category: 'trend',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: ['zigzag_high', 'zigzag_low', 'ema'],
    colors: {
      peaks: '#f23645',
      bottoms: '#00c853',
      ema: '#ffa726',
    },
    dataPattern: 'sparse', // 2-5% of bars have values (peaks/bottoms), EMA is continuous
  },

  dual_tema_hl: {
    id: 'dual_tema_hl',
    label: 'Dual TEMA High/Low',
    description: 'Dual TEMA applied to highs and lows for dynamic channel',
    category: 'trend',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: ['dual_tema_high', 'dual_tema_low'],
    colors: {
      high: '#00CED1',
      low: '#FF6B6B',
    },
    dataPattern: 'continuous', // Values on every bar
  },

  pinbar_detection: {
    id: 'pinbar_detection',
    label: 'Pinbar Detection',
    description: 'Detects pinbar reversal candlestick patterns',
    category: 'candlesticks',
    tier: 'FREE', // V8: ungated — available to both tiers
    columns: ['pinbar'],
    colors: {
      bullish: '#00c853',
      bearish: '#f23645',
    },
    dataPattern: 'sparse', // Only bars with pinbar patterns
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEGACY COLOR CONSTANTS (for backward compatibility)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Keltner Channel band colors
 * Keys match KeltnerChannelData (MT5 format) used by chart visualization
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
 * System columns (9) - always accessible by both FREE and PRO tiers
 * Symbol column added in v3.0 (EA v2.27+)
 */
export const SYSTEM_COLUMNS = [
  'timestamp',
  'symbol',
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
 * Check if a column name is valid in the 63-column schema
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
 * Get total column count for a tier.
 * V8: identical for both tiers — all columns.
 */
export function getTierColumnCount(_tier: Tier): number {
  const allIndicatorColumns = ALL_INDICATORS.reduce(
    (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
    0
  );
  return SYSTEM_COLUMNS.length + allIndicatorColumns;
}
