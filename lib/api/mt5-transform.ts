/**
 * MT5 Response Transformation Layer
 *
 * Transforms raw MT5 service JSON responses to type-safe TypeScript types.
 *
 * KEY TRANSFORMATIONS:
 * - Converts `null` values to `undefined` (TypeScript-friendly)
 * - Validates data structure before returning
 * - Returns empty/default values for FREE tier
 *
 * @module lib/api/mt5-transform
 */

import type {
  KeltnerChannelData,
  MomentumCandleData,
  MomentumCandleType,
  MT5ProIndicators,
  ProIndicatorData,
} from '@/types/indicator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSFORMATION FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Transform raw MT5 response to type-safe ProIndicatorData
 *
 * CRITICAL RULES:
 * 1. Convert null to undefined in arrays
 * 2. Validate data structure before returning
 * 3. Return empty/default values for FREE tier
 *
 * @param mt5Data - Raw MT5 service response
 * @param userTier - User tier (FREE or PRO)
 * @returns Type-safe ProIndicatorData
 */
export function transformProIndicators(
  mt5Data: MT5ProIndicators | undefined,
  userTier: 'FREE' | 'PRO'
): ProIndicatorData {
  // FREE tier gets empty data
  if (userTier === 'FREE' || !mt5Data) {
    return createEmptyProIndicatorData();
  }

  // Transform Momentum Candles
  const momentumCandles: MomentumCandleData[] = Array.isArray(
    mt5Data.momentum_candles
  )
    ? mt5Data.momentum_candles
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null
        )
        .map((item) => ({
          index: Number(item['index']) || 0,
          type: (Number(item['type']) || 0) as MomentumCandleType,
          zscore: Number(item['zscore']) || 0,
        }))
    : [];

  // Transform Keltner Channels (null -> undefined conversion)
  const keltnerChannels: KeltnerChannelData | undefined =
    mt5Data.keltner_channels
      ? {
          ultraExtremeUpper: convertNullToUndefined(
            mt5Data.keltner_channels.ultra_extreme_upper
          ),
          extremeUpper: convertNullToUndefined(
            mt5Data.keltner_channels.extreme_upper
          ),
          upperMost: convertNullToUndefined(
            mt5Data.keltner_channels.upper_most
          ),
          upper: convertNullToUndefined(mt5Data.keltner_channels.upper),
          upperMiddle: convertNullToUndefined(
            mt5Data.keltner_channels.upper_middle
          ),
          lowerMiddle: convertNullToUndefined(
            mt5Data.keltner_channels.lower_middle
          ),
          lower: convertNullToUndefined(mt5Data.keltner_channels.lower),
          lowerMost: convertNullToUndefined(
            mt5Data.keltner_channels.lower_most
          ),
          extremeLower: convertNullToUndefined(
            mt5Data.keltner_channels.extreme_lower
          ),
          ultraExtremeLower: convertNullToUndefined(
            mt5Data.keltner_channels.ultra_extreme_lower
          ),
        }
      : undefined;

  // Transform Moving Averages (null -> undefined)
  const tema = convertNullToUndefined(mt5Data.tema);
  const hrma = convertNullToUndefined(mt5Data.hrma);
  const smma = convertNullToUndefined(mt5Data.smma);

  // Transform ZigZag
  const zigzag = mt5Data.zigzag
    ? {
        peaks: Array.isArray(mt5Data.zigzag.peaks) ? mt5Data.zigzag.peaks : [],
        bottoms: Array.isArray(mt5Data.zigzag.bottoms)
          ? mt5Data.zigzag.bottoms
          : [],
      }
    : undefined;

  return {
    momentumCandles,
    keltnerChannels,
    tema,
    hrma,
    smma,
    zigzag,
  };
}

/**
 * Create empty ProIndicatorData for FREE tier or when no data
 */
export function createEmptyProIndicatorData(): ProIndicatorData {
  return {
    momentumCandles: [],
    keltnerChannels: undefined,
    tema: [],
    hrma: [],
    smma: [],
    zigzag: undefined,
  };
}

/**
 * Convert array of (number | null) to (number | undefined)
 * This ensures type compatibility with TypeScript's optional chaining
 *
 * @param arr - Array potentially containing null values
 * @returns Array with null values converted to undefined
 */
function convertNullToUndefined(
  arr: (number | null)[] | undefined
): (number | undefined)[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((val) => (val === null ? undefined : val));
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE GUARDS & VALIDATORS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Type guard to validate ProIndicatorData structure
 *
 * @param data - Unknown data to validate
 * @returns True if data is valid ProIndicatorData
 */
export function isValidProIndicatorData(
  data: unknown
): data is ProIndicatorData {
  if (typeof data !== 'object' || data === null) return false;

  const d = data as Record<string, unknown>;

  return (
    Array.isArray(d['momentumCandles']) &&
    Array.isArray(d['tema']) &&
    Array.isArray(d['hrma']) &&
    Array.isArray(d['smma'])
  );
}

/**
 * Type guard to validate MomentumCandleData
 */
export function isValidMomentumCandle(
  item: unknown
): item is MomentumCandleData {
  if (typeof item !== 'object' || item === null) return false;

  const d = item as Record<string, unknown>;

  return (
    typeof d['index'] === 'number' &&
    typeof d['type'] === 'number' &&
    (d['type'] as number) >= 0 &&
    (d['type'] as number) <= 5 &&
    typeof d['zscore'] === 'number'
  );
}

/**
 * Filter and validate momentum candle array
 */
export function filterValidMomentumCandles(
  candles: MomentumCandleData[]
): MomentumCandleData[] {
  return candles.filter(isValidMomentumCandle);
}
