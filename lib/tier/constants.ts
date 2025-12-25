/**
 * Indicator Tier Constants
 *
 * Defines which indicators are available for each tier level.
 *
 * @module lib/tier/constants
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR TYPE CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PRO-only indicators (6 total)
 * These require PRO tier to access
 */
export const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

/**
 * Basic indicators available to all tiers (FREE + PRO)
 */
export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

export type BasicIndicator = (typeof BASIC_INDICATORS)[number];

/**
 * All indicators (BASIC + PRO)
 */
export const ALL_INDICATORS = [
  ...BASIC_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;

export type IndicatorId = (typeof ALL_INDICATORS)[number];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDICATOR METADATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Indicator display information
 */
export interface IndicatorMeta {
  id: IndicatorId;
  label: string;
  description: string;
  category: 'basic' | 'pro';
  color?: string;
}

/**
 * Complete indicator metadata map
 */
export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMeta> = {
  // Basic indicators
  fractals: {
    id: 'fractals',
    label: 'Fractals',
    description: 'Support/resistance fractal points',
    category: 'basic',
  },
  trendlines: {
    id: 'trendlines',
    label: 'Trendlines',
    description: 'Diagonal trend lines',
    category: 'basic',
  },

  // PRO indicators
  momentum_candles: {
    id: 'momentum_candles',
    label: 'Momentum Candles',
    description: 'Z-score based candle classification',
    category: 'pro',
  },
  keltner_channels: {
    id: 'keltner_channels',
    label: 'Keltner Channels',
    description: '10-band ATR channel system',
    category: 'pro',
  },
  tema: {
    id: 'tema',
    label: 'TEMA',
    description: 'Triple Exponential Moving Average',
    category: 'pro',
    color: '#808080',
  },
  hrma: {
    id: 'hrma',
    label: 'HRMA',
    description: 'Hull-like Responsive Moving Average',
    category: 'pro',
    color: '#00CED1',
  },
  smma: {
    id: 'smma',
    label: 'SMMA',
    description: 'Smoothed Moving Average',
    category: 'pro',
    color: '#0000FF',
  },
  zigzag: {
    id: 'zigzag',
    label: 'ZigZag',
    description: 'Peak/Bottom structure detection',
    category: 'pro',
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KELTNER CHANNEL COLORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Keltner Channel band colors
 * Purple gradient from extreme to middle
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOMENTUM CANDLE COLORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOVING AVERAGE COLORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Moving average colors (TEMA, HRMA, SMMA)
 */
export const MA_COLORS = {
  tema: '#808080',
  hrma: '#00CED1',
  smma: '#0000FF',
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZIGZAG COLORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ZigZag indicator colors
 */
export const ZIGZAG_COLORS = {
  peaks: '#f23645',
  bottoms: '#00c853',
  line: '#ffa726',
} as const;
