/**
 * MT5 Transform Layer
 *
 * Transformation layer for converting Flask MT5 JSON responses
 * to TypeScript types used in the application.
 *
 * TYPE SAFETY PRINCIPLES:
 * - Never use null - use undefined for missing values
 * - Filter invalid data before returning
 * - Validate all incoming data
 *
 * Part 7: Indicators API - PRO Indicators Implementation
 */

import type {
  MT5ProIndicators,
  ProIndicatorData,
  MomentumCandleData,
  KeltnerChannelData,
  ZigZagData,
  MomentumCandleType,
} from '@/types/indicator';
import type { UserTier } from '@/types/tier';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid momentum candle object
 */
export function isValidMomentumCandle(candle: unknown): candle is MomentumCandleData {
  if (!candle || typeof candle !== 'object') {
    return false;
  }

  const c = candle as Record<string, unknown>;

  // Check required fields exist and are numbers
  if (typeof c.index !== 'number') return false;
  if (typeof c.type !== 'number') return false;
  if (typeof c.zscore !== 'number') return false;

  // Validate type is in valid range (0-5)
  if (c.type < 0 || c.type > 5) return false;

  return true;
}

/**
 * Validate PRO indicator data structure
 */
export function isValidProIndicatorData(data: unknown): data is ProIndicatorData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Record<string, unknown>;

  // Check required arrays exist
  if (!Array.isArray(d.momentumCandles)) return false;
  if (!Array.isArray(d.tema)) return false;
  if (!Array.isArray(d.hrma)) return false;
  if (!Array.isArray(d.smma)) return false;

  return true;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Filter out invalid momentum candles from array
 */
export function filterValidMomentumCandles(
  candles: MomentumCandleData[]
): MomentumCandleData[] {
  return candles.filter(isValidMomentumCandle);
}

/**
 * Convert null values to undefined in an array
 */
function convertNullToUndefined(arr: (number | null)[] | undefined): (number | undefined)[] {
  if (!arr) return [];
  return arr.map((v) => (v === null ? undefined : v));
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Create empty PRO indicator data structure
 */
export function createEmptyProIndicatorData(): ProIndicatorData {
  return {
    momentumCandles: [],
    tema: [],
    hrma: [],
    smma: [],
    keltnerChannels: undefined,
    zigzag: undefined,
  };
}

/**
 * Transform momentum candles from MT5 format
 */
function transformMomentumCandles(
  rawCandles: unknown[] | undefined
): MomentumCandleData[] {
  if (!rawCandles || !Array.isArray(rawCandles)) {
    return [];
  }

  return rawCandles
    .filter(isValidMomentumCandle)
    .map((candle) => ({
      index: candle.index,
      type: candle.type as MomentumCandleType,
      zscore: candle.zscore,
    }));
}

/**
 * Transform Keltner Channels from MT5 format
 */
function transformKeltnerChannels(
  raw: MT5ProIndicators['keltner_channels']
): KeltnerChannelData | undefined {
  if (!raw) return undefined;

  return {
    ultraExtremeUpper: convertNullToUndefined(raw.ultra_extreme_upper),
    extremeUpper: convertNullToUndefined(raw.extreme_upper),
    upperMost: convertNullToUndefined(raw.upper_most),
    upper: convertNullToUndefined(raw.upper),
    upperMiddle: convertNullToUndefined(raw.upper_middle),
    lowerMiddle: convertNullToUndefined(raw.lower_middle),
    lower: convertNullToUndefined(raw.lower),
    lowerMost: convertNullToUndefined(raw.lower_most),
    extremeLower: convertNullToUndefined(raw.extreme_lower),
    ultraExtremeLower: convertNullToUndefined(raw.ultra_extreme_lower),
  };
}

/**
 * Transform ZigZag data from MT5 format
 */
function transformZigZag(
  raw: MT5ProIndicators['zigzag']
): ZigZagData | undefined {
  if (!raw) return undefined;

  return {
    peaks: (raw.peaks || []).map((p) => ({
      index: p.index,
      price: p.price,
      timestamp: p.timestamp,
    })),
    bottoms: (raw.bottoms || []).map((b) => ({
      index: b.index,
      price: b.price,
      timestamp: b.timestamp,
    })),
  };
}

/**
 * Transform MT5 PRO indicators response to TypeScript types
 *
 * For FREE tier, returns empty data (PRO indicators not available)
 * For PRO tier, transforms and validates all indicator data
 *
 * @param mt5Data - Raw MT5 response data
 * @param tier - User's subscription tier
 * @returns Transformed PRO indicator data
 */
export function transformProIndicators(
  mt5Data: MT5ProIndicators | undefined,
  tier: UserTier
): ProIndicatorData {
  // FREE tier doesn't get PRO indicators
  if (tier === 'FREE') {
    return createEmptyProIndicatorData();
  }

  // Handle undefined input
  if (!mt5Data) {
    return createEmptyProIndicatorData();
  }

  return {
    momentumCandles: transformMomentumCandles(mt5Data.momentum_candles),
    tema: convertNullToUndefined(mt5Data.tema),
    hrma: convertNullToUndefined(mt5Data.hrma),
    smma: convertNullToUndefined(mt5Data.smma),
    keltnerChannels: transformKeltnerChannels(mt5Data.keltner_channels),
    zigzag: transformZigZag(mt5Data.zigzag),
  };
}
