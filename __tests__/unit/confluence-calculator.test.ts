/**
 * Part 20 - Phase 07: Confluence Calculator Unit Tests
 *
 * Tests for confluence score calculation logic.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

import {
  calculateConfluenceScore,
  getConfluenceInterpretation,
  getDominantTrend,
} from '@/lib/confluence/calculator';
import {
  detectSignals,
  getTrendDirection,
  getSignalStrength,
} from '@/lib/confluence/signals';
import type {
  TimeframeData,
  MultiTimeframeData,
  SignalDetail,
} from '@/lib/confluence/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create bullish timeframe data
 */
function createBullishTimeframeData(): TimeframeData {
  return {
    ohlc: {
      time: Date.now() / 1000,
      open: 1.08,
      high: 1.09,
      low: 1.075,
      close: 1.088, // Close above open = bullish
    },
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: null,
    diagonal_trendlines: null,
    momentum_candles: [
      { index: 0, type: 1, zscore: 2.5 }, // UP_LARGE
      { index: 1, type: 2, zscore: 3.0 }, // UP_EXTREME
    ],
    keltner_channels: {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [1.095],
      upper_middle: [1.085],
      lower_middle: [1.075],
      lower: [1.07],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: 1.075, // Price above TEMA
    hrma: 1.076,
    smma: 1.074,
    zigzag: {
      peaks: [
        { index: 10, price: 1.09, time: Date.now() - 10000 },
        { index: 20, price: 1.085, time: Date.now() - 20000 },
      ],
      bottoms: [
        { index: 15, price: 1.075, time: Date.now() - 15000 },
        { index: 25, price: 1.07, time: Date.now() - 25000 },
      ],
    },
  };
}

/**
 * Create bearish timeframe data
 */
function createBearishTimeframeData(): TimeframeData {
  return {
    ohlc: {
      time: Date.now() / 1000,
      open: 1.088,
      high: 1.09,
      low: 1.075,
      close: 1.076, // Close below open = bearish
    },
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: null,
    diagonal_trendlines: null,
    momentum_candles: [
      { index: 0, type: 4, zscore: 2.5 }, // DOWN_LARGE
      { index: 1, type: 5, zscore: 3.0 }, // DOWN_EXTREME
    ],
    keltner_channels: {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [1.095],
      upper_middle: [1.085],
      lower_middle: [1.08],
      lower: [1.07],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: 1.085, // Price below TEMA
    hrma: 1.086,
    smma: 1.084,
    zigzag: {
      peaks: [
        { index: 10, price: 1.085, time: Date.now() - 10000 },
        { index: 20, price: 1.09, time: Date.now() - 20000 },
      ],
      bottoms: [
        { index: 15, price: 1.07, time: Date.now() - 15000 },
        { index: 25, price: 1.075, time: Date.now() - 25000 },
      ],
    },
  };
}

/**
 * Create neutral timeframe data
 */
function createNeutralTimeframeData(): TimeframeData {
  return {
    ohlc: {
      time: Date.now() / 1000,
      open: 1.082,
      high: 1.085,
      low: 1.079,
      close: 1.082, // Close equals open
    },
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: null,
    diagonal_trendlines: null,
    momentum_candles: [],
    keltner_channels: {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [1.09],
      upper_middle: [1.085],
      lower_middle: [1.08],
      lower: [1.075],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: 1.082, // Price equals TEMA
    hrma: 1.082,
    smma: 1.082,
    zigzag: {
      peaks: [
        { index: 10, price: 1.085, time: Date.now() - 10000 },
        { index: 20, price: 1.084, time: Date.now() - 20000 }, // Almost equal
      ],
      bottoms: [
        { index: 15, price: 1.079, time: Date.now() - 15000 },
        { index: 25, price: 1.08, time: Date.now() - 25000 }, // Almost equal
      ],
    },
  };
}

// ============================================================================
// SIGNAL DETECTION TESTS
// ============================================================================

describe('Signal Detection', () => {
  describe('detectSignals', () => {
    it('should detect moving average signals', () => {
      const tfData = createBullishTimeframeData();
      const signals = detectSignals(tfData);

      // Should have TEMA, HRMA, SMMA signals
      const maSignals = signals.filter((s) =>
        ['tema', 'hrma', 'smma'].includes(s.indicator)
      );
      expect(maSignals.length).toBe(3);

      // All should be bullish (price above MAs)
      expect(maSignals.every((s) => s.direction === 'bullish')).toBe(true);
    });

    it('should detect bearish MA signals when price below MA', () => {
      const tfData = createBearishTimeframeData();
      const signals = detectSignals(tfData);

      const maSignals = signals.filter((s) =>
        ['tema', 'hrma', 'smma'].includes(s.indicator)
      );
      expect(maSignals.every((s) => s.direction === 'bearish')).toBe(true);
    });

    it('should detect momentum candle signals', () => {
      const tfData = createBullishTimeframeData();
      const signals = detectSignals(tfData);

      const momentumSignals = signals.filter(
        (s) => s.indicator === 'momentum_candles'
      );
      expect(momentumSignals.length).toBe(1);
      expect(momentumSignals[0].direction).toBe('bullish');
    });

    it('should detect Keltner channel signals', () => {
      const tfData = createBullishTimeframeData();
      const signals = detectSignals(tfData);

      const keltnerSignals = signals.filter(
        (s) => s.indicator === 'keltner_channels'
      );
      expect(keltnerSignals.length).toBe(1);
    });

    it('should detect ZigZag trend signals', () => {
      const tfData = createBullishTimeframeData();
      const signals = detectSignals(tfData);

      const zigzagSignals = signals.filter((s) => s.indicator === 'zigzag');
      expect(zigzagSignals.length).toBe(1);
      expect(zigzagSignals[0].direction).toBe('bullish');
    });

    it('should handle missing indicator data', () => {
      const tfData: TimeframeData = {
        ohlc: {
          time: Date.now() / 1000,
          open: 1.0,
          high: 1.01,
          low: 0.99,
          close: 1.0,
        },
        fractals: null,
        horizontal_trendlines: null,
        diagonal_trendlines: null,
        momentum_candles: [],
        keltner_channels: {
          ultra_extreme_upper: [],
          extreme_upper: [],
          upper_most: [],
          upper: [],
          upper_middle: [],
          lower_middle: [],
          lower: [],
          lower_most: [],
          extreme_lower: [],
          ultra_extreme_lower: [],
        },
        tema: null,
        hrma: null,
        smma: null,
        zigzag: { peaks: [], bottoms: [] },
      };

      const signals = detectSignals(tfData);
      // Should not crash and should return some signals (may be empty)
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('getTrendDirection', () => {
    it('should return bullish when bullish signals dominate', () => {
      const signals: SignalDetail[] = [
        { indicator: 'tema', direction: 'bullish', weight: 0.15 },
        { indicator: 'hrma', direction: 'bullish', weight: 0.15 },
        { indicator: 'smma', direction: 'bullish', weight: 0.15 },
        { indicator: 'momentum', direction: 'bearish', weight: 0.1 },
      ];

      expect(getTrendDirection(signals)).toBe('bullish');
    });

    it('should return bearish when bearish signals dominate', () => {
      const signals: SignalDetail[] = [
        { indicator: 'tema', direction: 'bearish', weight: 0.2 },
        { indicator: 'hrma', direction: 'bearish', weight: 0.2 },
        { indicator: 'smma', direction: 'bullish', weight: 0.1 },
      ];

      expect(getTrendDirection(signals)).toBe('bearish');
    });

    it('should return neutral when signals are balanced', () => {
      const signals: SignalDetail[] = [
        { indicator: 'tema', direction: 'bullish', weight: 0.15 },
        { indicator: 'hrma', direction: 'bearish', weight: 0.15 },
      ];

      expect(getTrendDirection(signals)).toBe('neutral');
    });

    it('should return neutral for empty signals', () => {
      expect(getTrendDirection([])).toBe('neutral');
    });
  });

  describe('getSignalStrength', () => {
    it('should return high strength for aligned signals', () => {
      const signals: SignalDetail[] = [
        { indicator: 'tema', direction: 'bullish', weight: 0.2 },
        { indicator: 'hrma', direction: 'bullish', weight: 0.2 },
        { indicator: 'smma', direction: 'bullish', weight: 0.2 },
      ];

      const strength = getSignalStrength(signals);
      expect(strength).toBeGreaterThan(0.9);
    });

    it('should return low strength for conflicting signals', () => {
      const signals: SignalDetail[] = [
        { indicator: 'tema', direction: 'bullish', weight: 0.2 },
        { indicator: 'hrma', direction: 'bearish', weight: 0.2 },
        { indicator: 'smma', direction: 'neutral', weight: 0.2 },
      ];

      const strength = getSignalStrength(signals);
      expect(strength).toBeLessThan(0.5);
    });

    it('should return 0 for empty signals', () => {
      expect(getSignalStrength([])).toBe(0);
    });

    it('should be bounded between 0 and 1', () => {
      const signals: SignalDetail[] = [
        { indicator: 'test', direction: 'bullish', weight: 1.0 },
      ];

      const strength = getSignalStrength(signals);
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// CONFLUENCE CALCULATOR TESTS
// ============================================================================

describe('Confluence Calculator', () => {
  describe('calculateConfluenceScore', () => {
    it('should calculate score for all bullish timeframes', () => {
      const data: MultiTimeframeData = {
        M5: createBullishTimeframeData(),
        M15: createBullishTimeframeData(),
        M30: createBullishTimeframeData(),
        H1: createBullishTimeframeData(),
        H2: createBullishTimeframeData(),
        H4: createBullishTimeframeData(),
        H8: createBullishTimeframeData(),
        H12: createBullishTimeframeData(),
        D1: createBullishTimeframeData(),
      };

      const result = calculateConfluenceScore(data);

      expect(result.confluence_score).toBeGreaterThan(7);
      expect(result.max_score).toBe(10);
      expect(result.signals.bullish).toBe(9);
      expect(result.signals.bearish).toBe(0);
    });

    it('should calculate score for all bearish timeframes', () => {
      const data: MultiTimeframeData = {
        M5: createBearishTimeframeData(),
        M15: createBearishTimeframeData(),
        M30: createBearishTimeframeData(),
        H1: createBearishTimeframeData(),
        H2: createBearishTimeframeData(),
        H4: createBearishTimeframeData(),
        H8: createBearishTimeframeData(),
        H12: createBearishTimeframeData(),
        D1: createBearishTimeframeData(),
      };

      const result = calculateConfluenceScore(data);

      expect(result.confluence_score).toBeGreaterThan(7);
      expect(result.signals.bearish).toBe(9);
    });

    it('should calculate lower score for mixed signals', () => {
      const data: MultiTimeframeData = {
        M5: createBullishTimeframeData(),
        M15: createBearishTimeframeData(),
        M30: createBullishTimeframeData(),
        H1: createBearishTimeframeData(),
        H2: createNeutralTimeframeData(),
        H4: createBullishTimeframeData(),
        H8: createBearishTimeframeData(),
        H12: createNeutralTimeframeData(),
        D1: createBullishTimeframeData(),
      };

      const result = calculateConfluenceScore(data);

      // Score should be moderate due to conflicting signals
      // With 4 bullish, 3 bearish, 2 neutral: alignment = 4/9 ≈ 0.44
      // Combined with signal strength, expect score between 4-8
      expect(result.confluence_score).toBeLessThan(9);
      expect(result.confluence_score).toBeGreaterThan(2);
    });

    it('should handle missing timeframe data', () => {
      const data: MultiTimeframeData = {
        M5: createBullishTimeframeData(),
        M15: null,
        M30: null,
        H1: createBullishTimeframeData(),
        H2: null,
        H4: null,
        H8: null,
        H12: null,
        D1: null,
      };

      const result = calculateConfluenceScore(data);

      // Should not crash and should calculate based on available data
      expect(result.confluence_score).toBeGreaterThanOrEqual(0);
      expect(result.confluence_score).toBeLessThanOrEqual(10);
    });

    it('should return zero score when no valid data', () => {
      const data: MultiTimeframeData = {
        M5: null,
        M15: null,
        M30: null,
        H1: null,
        H2: null,
        H4: null,
        H8: null,
        H12: null,
        D1: null,
      };

      const result = calculateConfluenceScore(data);

      expect(result.confluence_score).toBe(0);
      expect(result.signals.bullish).toBe(0);
      expect(result.signals.bearish).toBe(0);
      expect(result.signals.neutral).toBe(0);
    });

    it('should include breakdown by timeframe', () => {
      const data: MultiTimeframeData = {
        M5: createBullishTimeframeData(),
        M15: createBullishTimeframeData(),
        M30: null,
        H1: createBullishTimeframeData(),
        H2: null,
        H4: null,
        H8: null,
        H12: null,
        D1: null,
      };

      const result = calculateConfluenceScore(data);

      // Check breakdown exists for valid timeframes
      expect(result.breakdown.M5).toBeDefined();
      expect(result.breakdown.M15).toBeDefined();
      expect(result.breakdown.H1).toBeDefined();
      expect(result.breakdown.M5.trend).toBeDefined();
      expect(result.breakdown.M5.strength).toBeDefined();
      expect(result.breakdown.M5.signals).toBeDefined();
    });

    it('should include all_117_indicators in result', () => {
      const data: MultiTimeframeData = {
        M5: createBullishTimeframeData(),
        M15: createBullishTimeframeData(),
        M30: createBullishTimeframeData(),
        H1: createBullishTimeframeData(),
        H2: createBullishTimeframeData(),
        H4: createBullishTimeframeData(),
        H8: createBullishTimeframeData(),
        H12: createBullishTimeframeData(),
        D1: createBullishTimeframeData(),
      };

      const result = calculateConfluenceScore(data);

      expect(result.all_117_indicators).toBeDefined();
      expect(result.all_117_indicators.M5).toBeDefined();
      expect(result.all_117_indicators.D1).toBeDefined();
    });

    it('should keep score within 0-10 bounds', () => {
      // Test various combinations
      const testCases = [
        { M5: createBullishTimeframeData(), rest: null },
        {
          M5: createBullishTimeframeData(),
          M15: createBearishTimeframeData(),
          rest: null,
        },
      ];

      testCases.forEach((config) => {
        const data: MultiTimeframeData = {
          M5: config.M5 || null,
          M15: (config as { M15?: TimeframeData }).M15 || null,
          M30: null,
          H1: null,
          H2: null,
          H4: null,
          H8: null,
          H12: null,
          D1: null,
        };

        const result = calculateConfluenceScore(data);

        expect(result.confluence_score).toBeGreaterThanOrEqual(0);
        expect(result.confluence_score).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('getConfluenceInterpretation', () => {
    it('should return "Very Strong" for score >= 8', () => {
      expect(getConfluenceInterpretation(8)).toContain('Very Strong');
      expect(getConfluenceInterpretation(10)).toContain('Very Strong');
    });

    it('should return "Strong" for score >= 6.5', () => {
      expect(getConfluenceInterpretation(6.5)).toContain('Strong');
      expect(getConfluenceInterpretation(7.9)).toContain('Strong');
    });

    it('should return "Moderate" for score >= 5', () => {
      expect(getConfluenceInterpretation(5)).toContain('Moderate');
      expect(getConfluenceInterpretation(6.4)).toContain('Moderate');
    });

    it('should return "Weak" for score >= 3', () => {
      expect(getConfluenceInterpretation(3)).toContain('Weak');
      expect(getConfluenceInterpretation(4.9)).toContain('Weak');
    });

    it('should return "Very Weak" for score < 3', () => {
      expect(getConfluenceInterpretation(2.9)).toContain('Very Weak');
      expect(getConfluenceInterpretation(0)).toContain('Very Weak');
    });
  });

  describe('getDominantTrend', () => {
    it('should return bullish when bullish count is highest', () => {
      const result = {
        confluence_score: 8,
        max_score: 10,
        signals: { bullish: 6, bearish: 2, neutral: 1 },
        breakdown: {} as Record<string, any>,
        all_117_indicators: {} as MultiTimeframeData,
      };

      expect(getDominantTrend(result)).toBe('bullish');
    });

    it('should return bearish when bearish count is highest', () => {
      const result = {
        confluence_score: 8,
        max_score: 10,
        signals: { bullish: 2, bearish: 6, neutral: 1 },
        breakdown: {} as Record<string, any>,
        all_117_indicators: {} as MultiTimeframeData,
      };

      expect(getDominantTrend(result)).toBe('bearish');
    });

    it('should return neutral when neutral count is highest', () => {
      const result = {
        confluence_score: 3,
        max_score: 10,
        signals: { bullish: 2, bearish: 2, neutral: 5 },
        breakdown: {} as Record<string, any>,
        all_117_indicators: {} as MultiTimeframeData,
      };

      expect(getDominantTrend(result)).toBe('neutral');
    });

    it('should return bullish when bullish ties with bearish', () => {
      const result = {
        confluence_score: 5,
        max_score: 10,
        signals: { bullish: 4, bearish: 4, neutral: 1 },
        breakdown: {} as Record<string, any>,
        all_117_indicators: {} as MultiTimeframeData,
      };

      // When bullish equals bearish, function should return bullish first
      expect(getDominantTrend(result)).toBe('bullish');
    });
  });
});
