/**
 * Indicator Tier Validator Tests
 *
 * Tests for lib/tier/validator.ts
 * Access control functions for tier-gated indicators
 *
 * Part 4: Tier System - PRO Indicators Implementation
 */

import { describe, it, expect } from '@jest/globals';

import {
  canAccessIndicator,
  isProOnlyIndicator,
  getAccessibleIndicators,
  getLockedIndicators,
  filterAccessibleIndicators,
  getIndicatorUpgradeInfo,
  isValidIndicatorId,
} from '@/lib/tier/validator';

describe('Indicator Tier Validator', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // canAccessIndicator
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('canAccessIndicator', () => {
    describe('FREE tier', () => {
      it('should allow access to fractals indicator', () => {
        expect(canAccessIndicator('FREE', 'fractals')).toBe(true);
      });

      it('should allow access to trendlines indicator', () => {
        expect(canAccessIndicator('FREE', 'trendlines')).toBe(true);
      });

      it('should deny access to momentum_candles', () => {
        expect(canAccessIndicator('FREE', 'momentum_candles')).toBe(false);
      });

      it('should deny access to keltner_channels', () => {
        expect(canAccessIndicator('FREE', 'keltner_channels')).toBe(false);
      });

      it('should deny access to tema', () => {
        expect(canAccessIndicator('FREE', 'tema')).toBe(false);
      });

      it('should deny access to hrma', () => {
        expect(canAccessIndicator('FREE', 'hrma')).toBe(false);
      });

      it('should deny access to smma', () => {
        expect(canAccessIndicator('FREE', 'smma')).toBe(false);
      });

      it('should deny access to zigzag', () => {
        expect(canAccessIndicator('FREE', 'zigzag')).toBe(false);
      });

      it('should deny access to invalid indicator', () => {
        expect(canAccessIndicator('FREE', 'invalid_indicator')).toBe(false);
      });
    });

    describe('PRO tier', () => {
      it('should allow access to all basic indicators', () => {
        expect(canAccessIndicator('PRO', 'fractals')).toBe(true);
        expect(canAccessIndicator('PRO', 'trendlines')).toBe(true);
      });

      it('should allow access to momentum_candles', () => {
        expect(canAccessIndicator('PRO', 'momentum_candles')).toBe(true);
      });

      it('should allow access to keltner_channels', () => {
        expect(canAccessIndicator('PRO', 'keltner_channels')).toBe(true);
      });

      it('should allow access to all moving averages', () => {
        expect(canAccessIndicator('PRO', 'tema')).toBe(true);
        expect(canAccessIndicator('PRO', 'hrma')).toBe(true);
        expect(canAccessIndicator('PRO', 'smma')).toBe(true);
      });

      it('should allow access to zigzag', () => {
        expect(canAccessIndicator('PRO', 'zigzag')).toBe(true);
      });

      it('should deny access to invalid indicator', () => {
        expect(canAccessIndicator('PRO', 'invalid_indicator')).toBe(false);
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isProOnlyIndicator
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('isProOnlyIndicator', () => {
    it('should return true for momentum_candles', () => {
      expect(isProOnlyIndicator('momentum_candles')).toBe(true);
    });

    it('should return true for keltner_channels', () => {
      expect(isProOnlyIndicator('keltner_channels')).toBe(true);
    });

    it('should return true for tema', () => {
      expect(isProOnlyIndicator('tema')).toBe(true);
    });

    it('should return true for hrma', () => {
      expect(isProOnlyIndicator('hrma')).toBe(true);
    });

    it('should return true for smma', () => {
      expect(isProOnlyIndicator('smma')).toBe(true);
    });

    it('should return true for zigzag', () => {
      expect(isProOnlyIndicator('zigzag')).toBe(true);
    });

    it('should return false for fractals', () => {
      expect(isProOnlyIndicator('fractals')).toBe(false);
    });

    it('should return false for trendlines', () => {
      expect(isProOnlyIndicator('trendlines')).toBe(false);
    });

    it('should return false for invalid indicator', () => {
      expect(isProOnlyIndicator('invalid')).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAccessibleIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getAccessibleIndicators', () => {
    it('should return only basic indicators for FREE tier', () => {
      const indicators = getAccessibleIndicators('FREE');

      expect(indicators).toContain('fractals');
      expect(indicators).toContain('trendlines');
      expect(indicators).toHaveLength(2);
    });

    it('should return all indicators for PRO tier', () => {
      const indicators = getAccessibleIndicators('PRO');

      expect(indicators).toContain('fractals');
      expect(indicators).toContain('trendlines');
      expect(indicators).toContain('momentum_candles');
      expect(indicators).toContain('keltner_channels');
      expect(indicators).toContain('tema');
      expect(indicators).toContain('hrma');
      expect(indicators).toContain('smma');
      expect(indicators).toContain('zigzag');
      expect(indicators).toHaveLength(8);
    });

    it('should return a new array each time', () => {
      const indicators1 = getAccessibleIndicators('PRO');
      const indicators2 = getAccessibleIndicators('PRO');

      expect(indicators1).not.toBe(indicators2);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getLockedIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getLockedIndicators', () => {
    it('should return all PRO indicators for FREE tier', () => {
      const locked = getLockedIndicators('FREE');

      expect(locked).toContain('momentum_candles');
      expect(locked).toContain('keltner_channels');
      expect(locked).toContain('tema');
      expect(locked).toContain('hrma');
      expect(locked).toContain('smma');
      expect(locked).toContain('zigzag');
      expect(locked).toHaveLength(6);
    });

    it('should return empty array for PRO tier', () => {
      const locked = getLockedIndicators('PRO');

      expect(locked).toHaveLength(0);
    });

    it('should not contain basic indicators for FREE tier', () => {
      const locked = getLockedIndicators('FREE');

      expect(locked).not.toContain('fractals');
      expect(locked).not.toContain('trendlines');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // filterAccessibleIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('filterAccessibleIndicators', () => {
    it('should filter to only basic for FREE tier', () => {
      const requested = ['fractals', 'keltner_channels', 'zigzag'];
      const result = filterAccessibleIndicators('FREE', requested);

      expect(result).toEqual(['fractals']);
    });

    it('should return all valid for PRO tier', () => {
      const requested = ['fractals', 'keltner_channels', 'zigzag'];
      const result = filterAccessibleIndicators('PRO', requested);

      expect(result).toEqual(['fractals', 'keltner_channels', 'zigzag']);
    });

    it('should filter out invalid indicators', () => {
      const requested = ['fractals', 'invalid_indicator', 'tema'];
      const result = filterAccessibleIndicators('PRO', requested);

      expect(result).toEqual(['fractals', 'tema']);
      expect(result).not.toContain('invalid_indicator');
    });

    it('should return empty array for all invalid', () => {
      const requested = ['invalid1', 'invalid2'];
      const result = filterAccessibleIndicators('PRO', requested);

      expect(result).toHaveLength(0);
    });

    it('should handle empty array input', () => {
      const result = filterAccessibleIndicators('PRO', []);

      expect(result).toHaveLength(0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getIndicatorUpgradeInfo
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getIndicatorUpgradeInfo', () => {
    it('should return upgradeRequired: true when PRO indicators requested by FREE tier', () => {
      const requested = ['fractals', 'keltner_channels'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.lockedIndicators).toContain('keltner_channels');
      expect(result.accessibleIndicators).toContain('fractals');
    });

    it('should return upgradeRequired: false for PRO tier', () => {
      const requested = ['fractals', 'keltner_channels', 'zigzag'];
      const result = getIndicatorUpgradeInfo('PRO', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
      expect(result.accessibleIndicators).toHaveLength(3);
    });

    it('should return upgradeRequired: false for FREE tier with only basic', () => {
      const requested = ['fractals', 'trendlines'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
    });

    it('should correctly categorize mixed requests', () => {
      const requested = ['fractals', 'tema', 'hrma', 'trendlines', 'zigzag'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.accessibleIndicators).toEqual(['fractals', 'trendlines']);
      expect(result.lockedIndicators).toEqual(['tema', 'hrma', 'zigzag']);
    });

    it('should handle empty request array', () => {
      const result = getIndicatorUpgradeInfo('FREE', []);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
      expect(result.accessibleIndicators).toHaveLength(0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isValidIndicatorId
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('isValidIndicatorId', () => {
    it('should return true for all valid indicators', () => {
      const validIds = [
        'fractals',
        'trendlines',
        'momentum_candles',
        'keltner_channels',
        'tema',
        'hrma',
        'smma',
        'zigzag',
      ];

      validIds.forEach((id) => {
        expect(isValidIndicatorId(id)).toBe(true);
      });
    });

    it('should return false for invalid indicator id', () => {
      expect(isValidIndicatorId('invalid')).toBe(false);
      expect(isValidIndicatorId('FRACTALS')).toBe(false); // case sensitive
      expect(isValidIndicatorId('')).toBe(false);
    });
  });
});
