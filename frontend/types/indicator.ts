import type { Time } from 'lightweight-charts';

import type { Symbol, Timeframe } from './tier';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE TYPE PRINCIPLES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Use undefined (not null) for missing data
// 2. Arrays should never contain null - use undefined or filter
// 3. Optional fields use ?: syntax

/**
 * Indicator types from MT5
 */
export type IndicatorType = 'FRACTAL_HORIZONTAL' | 'FRACTAL_DIAGONAL';

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

/**
 * Chart data (candlesticks + indicators)
 */
export interface ChartData {
  symbol: Symbol;
  timeframe: Timeframe;
  data: Candlestick[];
  indicators: {
    fractalHorizontal?: IndicatorPoint[];
    fractalDiagonal?: IndicatorPoint[];
  };
  lastUpdate: Date;
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
 * Fractal data from MT5
 */
export interface FractalData {
  peaks: Array<{ time: number; price: number }>;
  bottoms: Array<{ time: number; price: number }>;
}

/**
 * Trendline data from MT5
 */
export interface TrendlineData {
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
// NEW 57-COLUMN DATABASE SCHEMA TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * System columns - accessible by FREE + PRO
 */
export interface SystemColumns {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  timeframe: string;
  collected_at: number | null;
}

/**
 * FREE tier indicator: Fractal Diagonal Lines (8 columns)
 */
export interface FractalDiagonalData {
  diag_asc_line_1: number | null;
  diag_asc_line_2: number | null;
  diag_asc_line_3: number | null;
  diag_desc_line_1: number | null;
  diag_desc_line_2: number | null;
  diag_desc_line_3: number | null;
  diag_high_map: number | null;
  diag_low_map: number | null;
}

/**
 * FREE tier indicator: Fractal Horizontal Lines (8 columns)
 */
export interface FractalHorizontalData {
  horiz_peak_line_1: number | null;
  horiz_peak_line_2: number | null;
  horiz_peak_line_3: number | null;
  horiz_bottom_line_1: number | null;
  horiz_bottom_line_2: number | null;
  horiz_bottom_line_3: number | null;
  horiz_high_map: number | null;
  horiz_low_map: number | null;
}

/**
 * PRO tier indicator: Moving Averages (3 columns)
 * Database record format (single row)
 */
export interface MovingAveragesColumns {
  tema: number | null;
  hrma: number | null;
  smma: number | null;
}

/**
 * PRO tier indicator: Body Size Momentum (2 columns)
 */
export interface BodyMomentumData {
  z_score_of_body_size: number | null;
  candle_classification: number | null;
}

/**
 * PRO tier indicator: Heiken Ashi (7 columns)
 */
export interface HeikenAshiData {
  ha_open: number | null;
  ha_high: number | null;
  ha_low: number | null;
  ha_close: number | null;
  ha_classification: number | null;
  ha_body_size: number | null;
  ha_body_zscore: number | null;
}

/**
 * PRO tier indicator: Keltner Channels (10 columns)
 */
export interface KeltnerChannelsData {
  kc_ultra_extreme_upper: number | null;
  kc_extreme_upper: number | null;
  kc_uppermost: number | null;
  kc_upper: number | null;
  kc_upper_middle: number | null;
  kc_lower_middle: number | null;
  kc_lower: number | null;
  kc_lowermost: number | null;
  kc_extreme_lower: number | null;
  kc_ultra_extreme_lower: number | null;
}

/**
 * PRO tier indicator: Support & Resistance (8 columns)
 */
export interface SupportResistanceData {
  sr_support_1: number | null;
  sr_support_2: number | null;
  sr_support_3: number | null;
  sr_support_4: number | null;
  sr_resistance_1: number | null;
  sr_resistance_2: number | null;
  sr_resistance_3: number | null;
  sr_resistance_4: number | null;
}

/**
 * PRO tier indicator: ZigZag + EMA (3 columns)
 * Database record format (single row)
 */
export interface ZigZagColumns {
  zigzag_peak: number | null;
  zigzag_bottom: number | null;
  ema_26: number | null;
}

/**
 * Complete market data (all 57 columns) - PRO tier
 */
export interface CompleteMarketData
  extends SystemColumns,
    FractalDiagonalData,
    FractalHorizontalData,
    MovingAveragesColumns,
    BodyMomentumData,
    HeikenAshiData,
    KeltnerChannelsData,
    SupportResistanceData,
    ZigZagColumns {}

/**
 * FREE tier market data (24 columns)
 * 8 system columns + 16 FREE indicator columns
 */
export interface FreeMarketData
  extends SystemColumns,
    FractalDiagonalData,
    FractalHorizontalData {}
