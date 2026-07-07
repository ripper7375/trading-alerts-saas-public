import type { Time } from 'lightweight-charts';

import type { Symbol, Timeframe } from './tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE TYPE PRINCIPLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Use undefined (not null) for missing data
// 2. Arrays should never contain null - use undefined or filter
// 3. Optional fields use ?: syntax

/**
 * Indicator types for the 61-column schema
 * FREE tier: fractal_diagonal, fractal_horizontal
 * PRO tier: moving_averages, body_momentum, heiken_ashi, keltner_channels, support_resistance, zigzag, dual_tema_hl, pinbar_detection
 */
export type IndicatorType =
  | 'fractal_diagonal'
  | 'fractal_horizontal'
  | 'moving_averages'
  | 'body_momentum'
  | 'heiken_ashi'
  | 'keltner_channels'
  | 'support_resistance'
  | 'zigzag'
  | 'dual_tema_hl'
  | 'pinbar_detection';

/**
 * @deprecated Use IndicatorType instead - kept for backward compatibility
 */
export type LegacyIndicatorType = 'FRACTAL_HORIZONTAL' | 'FRACTAL_DIAGONAL';

/**
 * Candlestick data point
 */
export interface Candlestick {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Indicator data point
 */
export interface IndicatorPoint {
  time: number;
  value: number;
  type?: 'SUPPORT' | 'RESISTANCE';
}

/**
 * Complete indicator data response
 */
export interface IndicatorData {
  symbol: Symbol;
  timeframe: Timeframe;
  indicatorType: IndicatorType;
  candlesticks: Candlestick[];
  indicators: IndicatorPoint[];
  lastUpdate: string; // ISO timestamp
}

/**
 * Complete MT5 indicator data (basic + pro indicators)
 * Used for WebSocket real-time streaming from Flask MT5 Service (Part 6)
 */
export interface MT5IndicatorData extends IndicatorData {
  proIndicators?: ProIndicatorData;
  metadata?: {
    timestamp: number;
    bars: number;
  };
}

/**
 * Indicator request parameters
 */
export interface IndicatorRequest {
  symbol: Symbol;
  timeframe: Timeframe;
  indicatorType: IndicatorType;
  bars?: number; // Number of bars to fetch (default: 100)
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRO INDICATOR TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Momentum Candle classification based on Z-score
 * From: Body Size Momentum Candle_V2.mq5 (Buffer 4: ColorBuffer)
 */
export enum MomentumCandleType {
  UP_NORMAL = 0,
  UP_LARGE = 1,
  UP_EXTREME = 2,
  DOWN_NORMAL = 3,
  DOWN_LARGE = 4,
  DOWN_EXTREME = 5,
}

/**
 * Momentum Candle data point
 */
export interface MomentumCandleData {
  index: number;
  type: MomentumCandleType;
  zscore: number;
}

/**
 * Keltner Channel 10-band system
 * From: Keltner Channel_ATF_10 Bands.mq5 (Buffers 0-9)
 *
 * IMPORTANT: Array values use undefined for empty slots
 * Never use null - filter before rendering
 */
export interface KeltnerChannelData {
  ultraExtremeUpper: (number | undefined)[]; // Buffer 0
  extremeUpper: (number | undefined)[]; // Buffer 1
  upperMost: (number | undefined)[]; // Buffer 2
  upper: (number | undefined)[]; // Buffer 3
  upperMiddle: (number | undefined)[]; // Buffer 4
  lowerMiddle: (number | undefined)[]; // Buffer 5
  lower: (number | undefined)[]; // Buffer 6
  lowerMost: (number | undefined)[]; // Buffer 7
  extremeLower: (number | undefined)[]; // Buffer 8
  ultraExtremeLower: (number | undefined)[]; // Buffer 9
}

/**
 * Moving Average data (TEMA, HRMA, SMMA)
 * From: TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
 *
 * IMPORTANT: Use undefined (not null) for missing values
 */
export interface MovingAveragesData {
  smma: (number | undefined)[]; // Buffer 1
  hrma: (number | undefined)[]; // Buffer 2
  tema: (number | undefined)[]; // Buffer 3
}

/**
 * ZigZag peak/bottom point
 * From: ZigZagColor & MarketStructure.mq5 (Buffers 0-1)
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  timestamp?: number; // Optional, not | undefined
}

/**
 * ZigZag indicator data
 */
export interface ZigZagData {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

/**
 * Complete PRO indicators response
 *
 * TYPE SAFETY NOTES:
 * - Arrays never contain null, only undefined for gaps
 * - Optional objects use ? not | null
 * - This is the SINGLE SOURCE OF TRUTH for PRO data types
 */
export interface ProIndicatorData {
  momentumCandles: MomentumCandleData[];
  keltnerChannels?: KeltnerChannelData; // Optional, not | null
  tema: (number | undefined)[];
  hrma: (number | undefined)[];
  smma: (number | undefined)[];
  zigzag?: ZigZagData; // Optional, not | null
}

/**
 * Raw MT5 service response (before transformation)
 * This matches Flask's JSON output format
 */
export interface MT5ProIndicators {
  momentum_candles?: unknown[];
  keltner_channels?: {
    ultra_extreme_upper?: (number | null)[];
    extreme_upper?: (number | null)[];
    upper_most?: (number | null)[];
    upper?: (number | null)[];
    upper_middle?: (number | null)[];
    lower_middle?: (number | null)[];
    lower?: (number | null)[];
    lower_most?: (number | null)[];
    extreme_lower?: (number | null)[];
    ultra_extreme_lower?: (number | null)[];
  };
  tema?: (number | null)[];
  hrma?: (number | null)[];
  smma?: (number | null)[];
  zigzag?: {
    peaks?: Array<{ index: number; price: number; timestamp?: number }>;
    bottoms?: Array<{ index: number; price: number; timestamp?: number }>;
  };
}

/**
 * @deprecated Use FractalDiagonalData or FractalHorizontalData from 57-column schema instead
 * Legacy fractal data from old 14-column JSON structure
 */
export interface LegacyFractalData {
  peaks: Array<{ time: number; price: number }>;
  bottoms: Array<{ time: number; price: number }>;
}

/**
 * @deprecated Use FractalDiagonalData instead - old nested trendline structure
 * Legacy trendline data from old 14-column JSON structure
 */
export interface LegacyTrendlineData {
  ascending: Array<{
    startTime: number;
    endTime: number;
    startPrice: number;
    endPrice: number;
  }>;
  descending: Array<{
    startTime: number;
    endTime: number;
    startPrice: number;
    endPrice: number;
  }>;
}

// Legacy type aliases for backward compatibility
/** @deprecated Use LegacyFractalData */
export type FractalData = LegacyFractalData;
/** @deprecated Use LegacyTrendlineData */
export type TrendlineData = LegacyTrendlineData;

/**
 * Helper type for chart rendering
 * Ensures time is never undefined when passed to Lightweight Charts
 */
export interface ChartDataPoint {
  time: Time; // NEVER undefined
  value: number; // NEVER undefined
}

/**
 * Type guard to check if chart data point is valid
 */
export function isValidChartDataPoint(point: {
  time?: Time;
  value?: number;
}): point is ChartDataPoint {
  return (
    point.time !== undefined && point.value !== undefined && !isNaN(point.value)
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET DATA V6 — UNIFIED SCHEMA (V8 ARCHITECTURE)
//
// Both tiers have identical access to ALL columns of the
// market_data_v6 table (79 fields). Mirrors prisma MarketDataV6,
// which itself mirrors gateway_contract_market_data.schema.json.
// The old per-tier column interfaces (FreeMarketData /
// CompleteMarketData, 63-column schema) were removed with the
// decommissioned MarketData model.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * One centroid-regression variant block (8 columns).
 * Six variants exist: best_fit, cherry_a, cherry_b, most_recent, non_a, non_b.
 */
export interface CentroidVariantColumns {
  horiz_high_map: number | null;
  horiz_low_map: number | null;
  ssa: number | null;
  ema_ssa: number | null;
  crossing: number | null;
  base_fl: number | null;
  uoedt: number | null;
  loedt: number | null;
}

/**
 * The six centroid-regression variant prefixes in market_data_v6
 */
export const CENTROID_VARIANTS = [
  'best_fit',
  'cherry_a',
  'cherry_b',
  'most_recent',
  'non_a',
  'non_b',
] as const;

export type CentroidVariant = (typeof CENTROID_VARIANTS)[number];

/**
 * Complete market_data_v6 row — all 79 fields, available to BOTH tiers.
 * Field names/types are a 1:1 mirror of prisma's MarketDataV6 model.
 */
export interface MarketDataV6 {
  id: string;
  terminal_id: string;
  timestamp: number;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Centroid-regression variant: best_fit
  best_fit_horiz_high_map: number | null;
  best_fit_horiz_low_map: number | null;
  best_fit_ssa: number | null;
  best_fit_ema_ssa: number | null;
  best_fit_crossing: number | null;
  best_fit_base_fl: number | null;
  best_fit_uoedt: number | null;
  best_fit_loedt: number | null;

  // Centroid-regression variant: cherry_a
  cherry_a_horiz_high_map: number | null;
  cherry_a_horiz_low_map: number | null;
  cherry_a_ssa: number | null;
  cherry_a_ema_ssa: number | null;
  cherry_a_crossing: number | null;
  cherry_a_base_fl: number | null;
  cherry_a_uoedt: number | null;
  cherry_a_loedt: number | null;

  // Centroid-regression variant: cherry_b
  cherry_b_horiz_high_map: number | null;
  cherry_b_horiz_low_map: number | null;
  cherry_b_ssa: number | null;
  cherry_b_ema_ssa: number | null;
  cherry_b_crossing: number | null;
  cherry_b_base_fl: number | null;
  cherry_b_uoedt: number | null;
  cherry_b_loedt: number | null;

  // Centroid-regression variant: most_recent
  most_recent_horiz_high_map: number | null;
  most_recent_horiz_low_map: number | null;
  most_recent_ssa: number | null;
  most_recent_ema_ssa: number | null;
  most_recent_crossing: number | null;
  most_recent_base_fl: number | null;
  most_recent_uoedt: number | null;
  most_recent_loedt: number | null;

  // Centroid-regression variant: non_a
  non_a_horiz_high_map: number | null;
  non_a_horiz_low_map: number | null;
  non_a_ssa: number | null;
  non_a_ema_ssa: number | null;
  non_a_crossing: number | null;
  non_a_base_fl: number | null;
  non_a_uoedt: number | null;
  non_a_loedt: number | null;

  // Centroid-regression variant: non_b
  non_b_horiz_high_map: number | null;
  non_b_horiz_low_map: number | null;
  non_b_ssa: number | null;
  non_b_ema_ssa: number | null;
  non_b_crossing: number | null;
  non_b_base_fl: number | null;
  non_b_uoedt: number | null;
  non_b_loedt: number | null;

  // Fractal EDT + single best lines (calculated)
  fractal_best_fl: number | null;
  fractal_uoedt: number | null;
  fractal_loedt: number | null;
  best_resistance: number | null;
  best_support: number | null;

  // Z-Score candle (calculated)
  body_direction: number | null; // -1, 0, 1
  body_size: number | null; // |z-score|
  body_classification: number | null; // 0-5

  // ZigZag (pivot = admin layer; metrics + category calculated)
  zigzag_point_type: string | null; // "Peak" | "Bottom"
  zigzag_current_point: number | null;
  zigzag_price_change: number | null;
  zigzag_pct_change: number | null;
  zigzag_pct_change_class: number | null;
  zigzag_bars: number | null;
  zigzag_bars_class: number | null;
  zigzag_price_per_bar: number | null;
  zigzag_price_per_bar_class: number | null;
  zigzag_slope: number | null;
  zigzag_category: string | null; // HH | HL | LH | LL | EQH | EQL

  // Provenance
  cycle_id: number | null;
  collected_at: number | null;
  calculated_at: number | null;

  createdAt: Date | string;
  updatedAt: Date | string;
}
// V8 migration: unified market_data_v6 typing — see prisma/schema.prisma
