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
