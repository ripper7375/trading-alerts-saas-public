/**
 * Indicator Filter Tests
 *
 * Tests for tier-based indicator filtering module.
 */

import {
  BASIC_INDICATORS,
  PRO_ONLY_INDICATORS,
  ALL_INDICATORS,
  canAccessIndicator,
  getAccessibleIndicators,
  getLockedIndicators,
  filterIndicatorData,
  getIndicatorUpgradeInfo,
  getIndicatorCount,
  hasProIndicators,
  createIndicatorResponse,
} from '@/lib/indicator-filter';

describe('Indicator Filter Module', () => {
  describe('Constants', () => {
    it('should have 2 basic indicators', () => {
      expect(BASIC_INDICATORS).toHaveLength(2);
      expect(BASIC_INDICATORS).toContain('fractals');
      expect(BASIC_INDICATORS).toContain('trendlines');
    });

    it('should have 6 PRO-only indicators', () => {
      expect(PRO_ONLY_INDICATORS).toHaveLength(6);
      expect(PRO_ONLY_INDICATORS).toContain('momentum_candles');
      expect(PRO_ONLY_INDICATORS).toContain('keltner_channels');
      expect(PRO_ONLY_INDICATORS).toContain('tema');
      expect(PRO_ONLY_INDICATORS).toContain('hrma');
      expect(PRO_ONLY_INDICATORS).toContain('smma');
      expect(PRO_ONLY_INDICATORS).toContain('zigzag');
    });

    it('should have 8 total indicators', () => {
      expect(ALL_INDICATORS).toHaveLength(8);
    });
  });

  describe('canAccessIndicator', () => {
    it('should allow FREE tier to access basic indicators', () => {
      expect(canAccessIndicator('fractals', 'FREE')).toBe(true);
      expect(canAccessIndicator('trendlines', 'FREE')).toBe(true);
    });

    it('should block FREE tier from PRO-only indicators', () => {
      expect(canAccessIndicator('momentum_candles', 'FREE')).toBe(false);
      expect(canAccessIndicator('keltner_channels', 'FREE')).toBe(false);
      expect(canAccessIndicator('tema', 'FREE')).toBe(false);
      expect(canAccessIndicator('zigzag', 'FREE')).toBe(false);
    });

    it('should allow PRO tier to access all indicators', () => {
      ALL_INDICATORS.forEach((indicator) => {
        expect(canAccessIndicator(indicator, 'PRO')).toBe(true);
      });
    });

    it('should handle case-insensitive indicator names', () => {
      expect(canAccessIndicator('FRACTALS', 'FREE')).toBe(true);
      expect(canAccessIndicator('Fractals', 'FREE')).toBe(true);
      expect(canAccessIndicator('MOMENTUM_CANDLES', 'PRO')).toBe(true);
    });
  });

  describe('getAccessibleIndicators', () => {
    it('should return only basic indicators for FREE tier', () => {
      const accessible = getAccessibleIndicators('FREE');
      expect(accessible).toHaveLength(2);
      expect(accessible).toContain('fractals');
      expect(accessible).toContain('trendlines');
    });

    it('should return all indicators for PRO tier', () => {
      const accessible = getAccessibleIndicators('PRO');
      expect(accessible).toHaveLength(8);
    });
  });

  describe('getLockedIndicators', () => {
    it('should return PRO-only indicators for FREE tier', () => {
      const locked = getLockedIndicators('FREE');
      expect(locked).toHaveLength(6);
      expect(locked).toContain('momentum_candles');
      expect(locked).toContain('keltner_channels');
    });

    it('should return empty array for PRO tier', () => {
      const locked = getLockedIndicators('PRO');
      expect(locked).toHaveLength(0);
    });
  });

  describe('filterIndicatorData', () => {
    const mockData = {
      ohlc: [{ time: 1, open: 100, high: 110, low: 90, close: 105 }],
      proIndicators: {
        fractals: { peaks: [], bottoms: [] },
        trendlines: { ascending: [], descending: [] },
        momentum_candles: [{ type: 'UP_NORMAL' }],
        keltner_channels: { upper: [1.1] },
      },
      proIndicatorsTransformed: {
        fractals: { peaks: [], bottoms: [] },
        momentum_candles: [{ type: 'UP_NORMAL' }],
      },
    };

    it('should not filter data for PRO tier', () => {
      const filtered = filterIndicatorData(mockData, 'PRO');
      expect(filtered).toEqual(mockData);
    });

    it('should filter out PRO-only indicators for FREE tier', () => {
      const filtered = filterIndicatorData(mockData, 'FREE');

      // Should keep basic indicators
      expect(filtered.proIndicators).toBeDefined();
      expect((filtered.proIndicators as Record<string, unknown>).fractals).toBeDefined();
      expect((filtered.proIndicators as Record<string, unknown>).trendlines).toBeDefined();

      // Should remove PRO-only indicators
      expect((filtered.proIndicators as Record<string, unknown>).momentum_candles).toBeUndefined();
      expect((filtered.proIndicators as Record<string, unknown>).keltner_channels).toBeUndefined();
    });

    it('should preserve non-indicator data', () => {
      const filtered = filterIndicatorData(mockData, 'FREE');
      expect(filtered.ohlc).toEqual(mockData.ohlc);
    });
  });

  describe('getIndicatorUpgradeInfo', () => {
    it('should indicate no upgrade required if all requested indicators are accessible', () => {
      const info = getIndicatorUpgradeInfo(['fractals', 'trendlines'], 'FREE');
      expect(info.upgradeRequired).toBe(false);
      expect(info.lockedIndicators).toHaveLength(0);
      expect(info.accessibleIndicators).toHaveLength(2);
      expect(info.upgradeMessage).toBeNull();
    });

    it('should indicate upgrade required for PRO-only indicators', () => {
      const info = getIndicatorUpgradeInfo(['fractals', 'momentum_candles'], 'FREE');
      expect(info.upgradeRequired).toBe(true);
      expect(info.lockedIndicators).toContain('momentum_candles');
      expect(info.accessibleIndicators).toContain('fractals');
      expect(info.upgradeMessage).toContain('Upgrade to Pro');
    });

    it('should return no locked indicators for PRO tier', () => {
      const info = getIndicatorUpgradeInfo(
        ['fractals', 'momentum_candles', 'zigzag'],
        'PRO'
      );
      expect(info.upgradeRequired).toBe(false);
      expect(info.lockedIndicators).toHaveLength(0);
      expect(info.accessibleIndicators).toHaveLength(3);
    });
  });

  describe('getIndicatorCount', () => {
    it('should return correct counts for FREE tier', () => {
      const count = getIndicatorCount('FREE');
      expect(count.accessible).toBe(2);
      expect(count.locked).toBe(6);
      expect(count.total).toBe(8);
    });

    it('should return correct counts for PRO tier', () => {
      const count = getIndicatorCount('PRO');
      expect(count.accessible).toBe(8);
      expect(count.locked).toBe(0);
      expect(count.total).toBe(8);
    });
  });

  describe('hasProIndicators', () => {
    it('should return true when PRO indicators are present', () => {
      const data = {
        proIndicators: {
          momentum_candles: [{ type: 'UP_NORMAL' }],
        },
      };
      expect(hasProIndicators(data)).toBe(true);
    });

    it('should return false when PRO indicators are null/undefined', () => {
      const data = {
        proIndicators: {
          momentum_candles: null,
          keltner_channels: undefined,
        },
      };
      expect(hasProIndicators(data)).toBe(false);
    });

    it('should return false when no PRO indicators section', () => {
      const data = {
        ohlc: [],
      };
      expect(hasProIndicators(data)).toBe(false);
    });
  });

  describe('createIndicatorResponse', () => {
    const mockData = {
      ohlc: [],
      proIndicators: {
        fractals: {},
        momentum_candles: {},
      },
    };

    it('should include upgrade info for FREE tier', () => {
      const response = createIndicatorResponse(mockData, 'FREE');
      expect(response.tier).toBe('FREE');
      expect(response.upgrade).toBeDefined();
      expect(response.upgrade?.tier).toBe('PRO');
      expect(response.upgrade?.pricing).toBeDefined();
      expect(response.upgrade?.pricing.monthly).toBe('$29');
      expect(response.upgrade?.pricing.yearly).toBe('$290');
      expect(response.upgrade?.pricing.trial).toBe('7 days free');
    });

    it('should not include upgrade info for PRO tier', () => {
      const response = createIndicatorResponse(mockData, 'PRO');
      expect(response.tier).toBe('PRO');
      expect(response.upgrade).toBeUndefined();
    });
  });
});
