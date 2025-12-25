/**
 * MT5 Transform Layer Tests
 *
 * Tests for lib/api/mt5-transform.ts
 * Transformation layer converting Flask JSON → TypeScript types
 *
 * Part 7: Indicators API - PRO Indicators Implementation
 */

import { describe, it, expect } from '@jest/globals';

import {
  transformProIndicators,
  createEmptyProIndicatorData,
  isValidProIndicatorData,
  isValidMomentumCandle,
  filterValidMomentumCandles,
} from '@/lib/api/mt5-transform';
import type { MT5ProIndicators, MomentumCandleData } from '@/types/indicator';

describe('MT5 Transform Layer', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // transformProIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('transformProIndicators', () => {
    it('should return empty data for FREE tier', () => {
      const mt5Data: MT5ProIndicators = {
        momentum_candles: [{ index: 0, type: 1, zscore: 1.5 }],
        tema: [1.0, 2.0],
      };

      const result = transformProIndicators(mt5Data, 'FREE');

      expect(result.momentumCandles).toEqual([]);
      expect(result.tema).toEqual([]);
      expect(result.hrma).toEqual([]);
      expect(result.smma).toEqual([]);
      expect(result.keltnerChannels).toBeUndefined();
      expect(result.zigzag).toBeUndefined();
    });

    it('should return empty data when mt5Data is undefined', () => {
      const result = transformProIndicators(undefined, 'PRO');

      expect(result.momentumCandles).toEqual([]);
      expect(result.tema).toEqual([]);
      expect(result.keltnerChannels).toBeUndefined();
    });

    it('should transform momentum candles for PRO tier', () => {
      const mt5Data: MT5ProIndicators = {
        momentum_candles: [
          { index: 0, type: 1, zscore: 1.5 },
          { index: 5, type: 4, zscore: -2.1 },
        ],
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.momentumCandles).toHaveLength(2);
      expect(result.momentumCandles[0]).toEqual({
        index: 0,
        type: 1,
        zscore: 1.5,
      });
      expect(result.momentumCandles[1]).toEqual({
        index: 5,
        type: 4,
        zscore: -2.1,
      });
    });

    it('should convert null to undefined in Keltner channels', () => {
      const mt5Data: MT5ProIndicators = {
        keltner_channels: {
          ultra_extreme_upper: [100, null, 102],
          extreme_upper: [null, 90, null],
          upper_most: [80, 81, 82],
          upper: [70, null, 72],
          upper_middle: [60, 61, null],
          lower_middle: [50, null, 52],
          lower: [40, 41, null],
          lower_most: [30, null, 32],
          extreme_lower: [20, 21, null],
          ultra_extreme_lower: [null, 11, 12],
        },
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.keltnerChannels).toBeDefined();
      expect(result.keltnerChannels?.ultraExtremeUpper).toEqual([
        100,
        undefined,
        102,
      ]);
      expect(result.keltnerChannels?.extremeUpper).toEqual([
        undefined,
        90,
        undefined,
      ]);
      expect(result.keltnerChannels?.ultraExtremeLower).toEqual([
        undefined,
        11,
        12,
      ]);
    });

    it('should convert null to undefined in moving averages', () => {
      const mt5Data: MT5ProIndicators = {
        tema: [1.0, null, 3.0],
        hrma: [null, 2.0, 3.0],
        smma: [1.0, 2.0, null],
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.tema).toEqual([1.0, undefined, 3.0]);
      expect(result.hrma).toEqual([undefined, 2.0, 3.0]);
      expect(result.smma).toEqual([1.0, 2.0, undefined]);
    });

    it('should transform ZigZag data correctly', () => {
      const mt5Data: MT5ProIndicators = {
        zigzag: {
          peaks: [
            { index: 10, price: 2050.5 },
            { index: 30, price: 2100.0 },
          ],
          bottoms: [
            { index: 20, price: 2000.0 },
            { index: 40, price: 1980.5 },
          ],
        },
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.zigzag).toBeDefined();
      expect(result.zigzag?.peaks).toHaveLength(2);
      expect(result.zigzag?.bottoms).toHaveLength(2);
      expect(result.zigzag?.peaks[0]).toEqual({ index: 10, price: 2050.5 });
    });

    it('should handle empty arrays in mt5Data', () => {
      const mt5Data: MT5ProIndicators = {
        momentum_candles: [],
        tema: [],
        hrma: [],
        smma: [],
        zigzag: {
          peaks: [],
          bottoms: [],
        },
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.momentumCandles).toEqual([]);
      expect(result.tema).toEqual([]);
      expect(result.zigzag?.peaks).toEqual([]);
    });

    it('should handle invalid momentum candle objects', () => {
      const mt5Data: MT5ProIndicators = {
        momentum_candles: [
          null,
          undefined,
          'invalid',
          { index: 0, type: 1, zscore: 1.0 },
        ] as unknown as unknown[],
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      // Only the valid object should be transformed
      expect(result.momentumCandles).toHaveLength(1);
      expect(result.momentumCandles[0].index).toBe(0);
    });

    it('should handle undefined keltner_channels', () => {
      const mt5Data: MT5ProIndicators = {
        tema: [1.0, 2.0],
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.keltnerChannels).toBeUndefined();
    });

    it('should handle undefined zigzag', () => {
      const mt5Data: MT5ProIndicators = {
        tema: [1.0, 2.0],
      };

      const result = transformProIndicators(mt5Data, 'PRO');

      expect(result.zigzag).toBeUndefined();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createEmptyProIndicatorData
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('createEmptyProIndicatorData', () => {
    it('should return structure with empty arrays', () => {
      const result = createEmptyProIndicatorData();

      expect(result.momentumCandles).toEqual([]);
      expect(result.tema).toEqual([]);
      expect(result.hrma).toEqual([]);
      expect(result.smma).toEqual([]);
      expect(result.keltnerChannels).toBeUndefined();
      expect(result.zigzag).toBeUndefined();
    });

    it('should return a new object each time', () => {
      const result1 = createEmptyProIndicatorData();
      const result2 = createEmptyProIndicatorData();

      expect(result1).not.toBe(result2);
      expect(result1.momentumCandles).not.toBe(result2.momentumCandles);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isValidProIndicatorData
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('isValidProIndicatorData', () => {
    it('should return true for valid structure', () => {
      const data = {
        momentumCandles: [],
        tema: [],
        hrma: [],
        smma: [],
      };

      expect(isValidProIndicatorData(data)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidProIndicatorData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidProIndicatorData(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isValidProIndicatorData('string')).toBe(false);
      expect(isValidProIndicatorData(123)).toBe(false);
    });

    it('should return false for missing required arrays', () => {
      expect(isValidProIndicatorData({ momentumCandles: [] })).toBe(false);
      expect(
        isValidProIndicatorData({ momentumCandles: [], tema: [], hrma: [] })
      ).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isValidMomentumCandle
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('isValidMomentumCandle', () => {
    it('should return true for valid candle', () => {
      const candle = { index: 0, type: 1, zscore: 1.5 };
      expect(isValidMomentumCandle(candle)).toBe(true);
    });

    it('should return true for all valid candle types 0-5', () => {
      for (let type = 0; type <= 5; type++) {
        const candle = { index: 0, type, zscore: 0 };
        expect(isValidMomentumCandle(candle)).toBe(true);
      }
    });

    it('should return false for invalid candle type > 5', () => {
      const candle = { index: 0, type: 6, zscore: 0 };
      expect(isValidMomentumCandle(candle)).toBe(false);
    });

    it('should return false for negative candle type', () => {
      const candle = { index: 0, type: -1, zscore: 0 };
      expect(isValidMomentumCandle(candle)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidMomentumCandle(null)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(isValidMomentumCandle({ index: 0 })).toBe(false);
      expect(isValidMomentumCandle({ type: 1 })).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // filterValidMomentumCandles
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('filterValidMomentumCandles', () => {
    it('should filter out invalid candles', () => {
      const candles: MomentumCandleData[] = [
        { index: 0, type: 1, zscore: 1.0 },
        { index: 1, type: 6, zscore: 0 }, // Invalid type
        { index: 2, type: 2, zscore: 2.0 },
      ];

      const result = filterValidMomentumCandles(candles);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(2);
    });

    it('should return empty array for all invalid candles', () => {
      const candles = [
        { index: 0, type: 10, zscore: 0 },
        { index: 1, type: -1, zscore: 0 },
      ] as MomentumCandleData[];

      const result = filterValidMomentumCandles(candles);

      expect(result).toHaveLength(0);
    });

    it('should return all candles when all valid', () => {
      const candles: MomentumCandleData[] = [
        { index: 0, type: 0, zscore: 0 },
        { index: 1, type: 3, zscore: -1.0 },
        { index: 2, type: 5, zscore: 3.0 },
      ];

      const result = filterValidMomentumCandles(candles);

      expect(result).toHaveLength(3);
    });
  });
});
