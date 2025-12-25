import type { Symbol, Timeframe, Tier } from './tier';

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

// ============================================
// PRO INDICATOR TYPES
// ============================================

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

export interface MomentumCandleData {
  index: number;
  type: MomentumCandleType;
  zscore: number;
}

/**
 * Keltner Channel 10-band system
 * From: Keltner Channel_ATF_10 Bands.mq5 (Buffers 0-9)
 */
export interface KeltnerChannelData {
  ultraExtremeUpper: (number | null)[]; // Buffer 0
  extremeUpper: (number | null)[]; // Buffer 1
  upperMost: (number | null)[]; // Buffer 2
  upper: (number | null)[]; // Buffer 3
  upperMiddle: (number | null)[]; // Buffer 4
  lowerMiddle: (number | null)[]; // Buffer 5
  lower: (number | null)[]; // Buffer 6
  lowerMost: (number | null)[]; // Buffer 7
  extremeLower: (number | null)[]; // Buffer 8
  ultraExtremeLower: (number | null)[]; // Buffer 9
}

/**
 * Moving Average data (TEMA, HRMA, SMMA)
 * From: TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
 */
export interface MovingAveragesData {
  smma: (number | null)[]; // Buffer 1
  hrma: (number | null)[]; // Buffer 2
  tema: (number | null)[]; // Buffer 3
}

/**
 * ZigZag peak/bottom point
 * From: ZigZagColor & MarketStructure.mq5 (Buffers 0-1)
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  timestamp?: number;
}

export interface ZigZagData {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

/**
 * Complete PRO indicators response
 */
export interface ProIndicatorData {
  momentumCandles: MomentumCandleData[];
  keltnerChannels: KeltnerChannelData | null;
  tema: (number | null)[];
  hrma: (number | null)[];
  smma: (number | null)[];
  zigzag: ZigZagData | null;
}

/**
 * Empty PRO indicator data (for FREE tier)
 */
export const EMPTY_PRO_INDICATORS: ProIndicatorData = {
  momentumCandles: [],
  keltnerChannels: null,
  tema: [],
  hrma: [],
  smma: [],
  zigzag: null,
};

/**
 * Extended indicator response (includes basic + PRO)
 */
export interface IndicatorApiResponse {
  success: boolean;
  data: {
    // OHLC data
    ohlc: Candlestick[];
    // Basic indicators (FREE + PRO)
    horizontal: Record<string, IndicatorPoint[]>;
    diagonal: Record<string, IndicatorPoint[]>;
    fractals: {
      peaks: IndicatorPoint[];
      bottoms: IndicatorPoint[];
    };
    // PRO indicators (empty for FREE tier)
    proIndicators: ProIndicatorData;
    // Metadata
    metadata: {
      symbol: string;
      timeframe: string;
      bars_returned: number;
    };
  };
  tier: Tier;
  requestedAt: string;
}
