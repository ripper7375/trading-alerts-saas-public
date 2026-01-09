/**
 * Part 20 - Phase 06: Confluence Score System - Types
 *
 * TypeScript types for multi-timeframe confluence analysis.
 * Analyzes 117 indicators (13 indicators × 9 timeframes) at a specific point in time.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import type { Timeframe } from '@/lib/constants/business-rules';

// ============================================================================
// INDICATOR DATA STRUCTURES
// ============================================================================

/**
 * OHLC (Open-High-Low-Close) bar data
 */
export interface OHLCBar {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Fractal point data
 */
export interface FractalPoint {
  index: number;
  time: number;
  price: number;
}

/**
 * Fractals (peaks and bottoms)
 */
export interface Fractals {
  peaks: FractalPoint[];
  bottoms: FractalPoint[];
}

/**
 * Line point for trendlines
 */
export interface LinePoint {
  index: number;
  value: number;
}

/**
 * Horizontal trendlines (support/resistance)
 */
export interface HorizontalTrendlines {
  peak_1: LinePoint[];
  peak_2: LinePoint[];
  peak_3: LinePoint[];
  bottom_1: LinePoint[];
  bottom_2: LinePoint[];
  bottom_3: LinePoint[];
}

/**
 * Diagonal trendlines (ascending/descending)
 */
export interface DiagonalTrendlines {
  ascending_1: LinePoint[];
  ascending_2: LinePoint[];
  ascending_3: LinePoint[];
  descending_1: LinePoint[];
  descending_2: LinePoint[];
  descending_3: LinePoint[];
}

/**
 * Momentum candle data
 */
export interface MomentumCandle {
  index: number;
  type: 1 | 2 | 4 | 5; // 1=UP_LARGE, 2=UP_EXTREME, 4=DOWN_LARGE, 5=DOWN_EXTREME
  zscore: number;
}

/**
 * Keltner channel data (10-band volatility)
 */
export interface KeltnerChannels {
  ultra_extreme_upper: (number | null)[];
  extreme_upper: (number | null)[];
  upper_most: (number | null)[];
  upper: (number | null)[];
  upper_middle: (number | null)[];
  lower_middle: (number | null)[];
  lower: (number | null)[];
  lower_most: (number | null)[];
  extreme_lower: (number | null)[];
  ultra_extreme_lower: (number | null)[];
}

/**
 * ZigZag point data
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  time: number;
}

/**
 * ZigZag data (swing points)
 */
export interface ZigZag {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

// ============================================================================
// TIMEFRAME DATA
// ============================================================================

/**
 * All indicator data for a single timeframe
 * Contains 13 indicators total
 */
export interface TimeframeData {
  ohlc: OHLCBar;
  fractals: Fractals | null;
  horizontal_trendlines: HorizontalTrendlines | null;
  diagonal_trendlines: DiagonalTrendlines | null;
  momentum_candles: MomentumCandle[];
  keltner_channels: KeltnerChannels;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: ZigZag;
}

/**
 * Multi-timeframe data (9 timeframes)
 * Total: 117 indicators (13 indicators × 9 timeframes)
 */
export interface MultiTimeframeData {
  M5: TimeframeData | null;
  M15: TimeframeData | null;
  M30: TimeframeData | null;
  H1: TimeframeData | null;
  H2: TimeframeData | null;
  H4: TimeframeData | null;
  H8: TimeframeData | null;
  H12: TimeframeData | null;
  D1: TimeframeData | null;
}

// ============================================================================
// SIGNAL ANALYSIS
// ============================================================================

/**
 * Signal direction
 */
export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

/**
 * Individual signal detail
 */
export interface SignalDetail {
  indicator: string;
  direction: SignalDirection;
  weight: number; // 0-1
  reason?: string;
}

/**
 * Timeframe signal analysis
 */
export interface TimeframeSignal {
  trend: SignalDirection;
  strength: number; // 0-1
  signals: SignalDetail[];
}

// ============================================================================
// CONFLUENCE RESULT
// ============================================================================

/**
 * Signal count by direction
 */
export interface SignalCount {
  bullish: number;
  bearish: number;
  neutral: number;
}

/**
 * Complete confluence analysis result
 */
export interface ConfluenceResult {
  confluence_score: number; // 0-10
  max_score: number; // Always 10
  signals: SignalCount;
  breakdown: Record<Timeframe, TimeframeSignal>;
  all_117_indicators: MultiTimeframeData;
}

/**
 * API response for confluence endpoint
 */
export interface ConfluenceResponse {
  success: boolean;
  symbol: string;
  timestamp: string;
  confluence_score: number;
  max_score: number;
  signals: SignalCount;
  breakdown: Record<Timeframe, TimeframeSignal>;
  all_117_indicators: MultiTimeframeData;
}
