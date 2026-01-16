/**
 * Indicator Tier Validator Tests - 57-Column Schema
 *
 * Tests for lib/tier/validator.ts
 * Access control functions for tier-gated indicators and columns
 *
 * Part 4: Tier System - Updated for 57-column database schema
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
  canAccessColumn,
  getAccessibleColumns,
  getLockedColumns,
  filterDataByTier,
  filterAccessibleColumns,
  getColumnUpgradeInfo,
} from '@/lib/tier/validator';

describe('Indicator Tier Validator - 57-Column Schema', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // canAccessIndicator
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('canAccessIndicator', () => {
    describe('FREE tier', () => {
      it('should allow access to fractal_diagonal', () => {
        expect(canAccessIndicator('FREE', 'fractal_diagonal')).toBe(true);
      });

      it('should allow access to fractal_horizontal', () => {
        expect(canAccessIndicator('FREE', 'fractal_horizontal')).toBe(true);
      });

      it('should deny access to moving_averages', () => {
        expect(canAccessIndicator('FREE', 'moving_averages')).toBe(false);
      });

      it('should deny access to body_momentum', () => {
        expect(canAccessIndicator('FREE', 'body_momentum')).toBe(false);
      });

      it('should deny access to heiken_ashi', () => {
        expect(canAccessIndicator('FREE', 'heiken_ashi')).toBe(false);
      });

      it('should deny access to keltner_channels', () => {
        expect(canAccessIndicator('FREE', 'keltner_channels')).toBe(false);
      });

      it('should deny access to support_resistance', () => {
        expect(canAccessIndicator('FREE', 'support_resistance')).toBe(false);
      });

      it('should deny access to zigzag', () => {
        expect(canAccessIndicator('FREE', 'zigzag')).toBe(false);
      });

      it('should deny access to invalid indicator', () => {
        expect(canAccessIndicator('FREE', 'invalid_indicator')).toBe(false);
      });
    });

    describe('PRO tier', () => {
      it('should allow access to fractal_diagonal', () => {
        expect(canAccessIndicator('PRO', 'fractal_diagonal')).toBe(true);
      });

      it('should allow access to fractal_horizontal', () => {
        expect(canAccessIndicator('PRO', 'fractal_horizontal')).toBe(true);
      });

      it('should allow access to moving_averages', () => {
        expect(canAccessIndicator('PRO', 'moving_averages')).toBe(true);
      });

      it('should allow access to body_momentum', () => {
        expect(canAccessIndicator('PRO', 'body_momentum')).toBe(true);
      });

      it('should allow access to heiken_ashi', () => {
        expect(canAccessIndicator('PRO', 'heiken_ashi')).toBe(true);
      });

      it('should allow access to keltner_channels', () => {
        expect(canAccessIndicator('PRO', 'keltner_channels')).toBe(true);
      });

      it('should allow access to support_resistance', () => {
        expect(canAccessIndicator('PRO', 'support_resistance')).toBe(true);
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
    it('should return false for fractal_diagonal (FREE tier)', () => {
      expect(isProOnlyIndicator('fractal_diagonal')).toBe(false);
    });

    it('should return false for fractal_horizontal (FREE tier)', () => {
      expect(isProOnlyIndicator('fractal_horizontal')).toBe(false);
    });

    it('should return true for moving_averages', () => {
      expect(isProOnlyIndicator('moving_averages')).toBe(true);
    });

    it('should return true for body_momentum', () => {
      expect(isProOnlyIndicator('body_momentum')).toBe(true);
    });

    it('should return true for heiken_ashi', () => {
      expect(isProOnlyIndicator('heiken_ashi')).toBe(true);
    });

    it('should return true for keltner_channels', () => {
      expect(isProOnlyIndicator('keltner_channels')).toBe(true);
    });

    it('should return true for support_resistance', () => {
      expect(isProOnlyIndicator('support_resistance')).toBe(true);
    });

    it('should return true for zigzag', () => {
      expect(isProOnlyIndicator('zigzag')).toBe(true);
    });

    it('should return false for invalid indicator', () => {
      expect(isProOnlyIndicator('invalid')).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAccessibleIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getAccessibleIndicators', () => {
    it('should return 2 FREE tier indicators for FREE tier', () => {
      const indicators = getAccessibleIndicators('FREE');

      expect(indicators).toContain('fractal_diagonal');
      expect(indicators).toContain('fractal_horizontal');
      expect(indicators).toHaveLength(2);
    });

    it('should return all 8 indicators for PRO tier (2 FREE + 6 PRO)', () => {
      const indicators = getAccessibleIndicators('PRO');

      // FREE tier indicators
      expect(indicators).toContain('fractal_diagonal');
      expect(indicators).toContain('fractal_horizontal');

      // PRO tier indicators
      expect(indicators).toContain('moving_averages');
      expect(indicators).toContain('body_momentum');
      expect(indicators).toContain('heiken_ashi');
      expect(indicators).toContain('keltner_channels');
      expect(indicators).toContain('support_resistance');
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
    it('should return all 6 PRO indicators for FREE tier', () => {
      const locked = getLockedIndicators('FREE');

      expect(locked).toContain('moving_averages');
      expect(locked).toContain('body_momentum');
      expect(locked).toContain('heiken_ashi');
      expect(locked).toContain('keltner_channels');
      expect(locked).toContain('support_resistance');
      expect(locked).toContain('zigzag');
      expect(locked).toHaveLength(6);
    });

    it('should return empty array for PRO tier', () => {
      const locked = getLockedIndicators('PRO');

      expect(locked).toHaveLength(0);
    });

    it('should not contain FREE tier indicators', () => {
      const locked = getLockedIndicators('FREE');

      expect(locked).not.toContain('fractal_diagonal');
      expect(locked).not.toContain('fractal_horizontal');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // filterAccessibleIndicators
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('filterAccessibleIndicators', () => {
    it('should filter to only FREE indicators for FREE tier', () => {
      const requested = [
        'fractal_diagonal',
        'keltner_channels',
        'zigzag',
        'moving_averages',
      ];
      const result = filterAccessibleIndicators('FREE', requested);

      expect(result).toEqual(['fractal_diagonal']);
    });

    it('should return all valid indicators for PRO tier', () => {
      const requested = [
        'fractal_diagonal',
        'keltner_channels',
        'zigzag',
        'moving_averages',
      ];
      const result = filterAccessibleIndicators('PRO', requested);

      expect(result).toEqual([
        'fractal_diagonal',
        'keltner_channels',
        'zigzag',
        'moving_averages',
      ]);
    });

    it('should filter out invalid indicators', () => {
      const requested = [
        'fractal_diagonal',
        'invalid_indicator',
        'moving_averages',
      ];
      const result = filterAccessibleIndicators('PRO', requested);

      expect(result).toEqual(['fractal_diagonal', 'moving_averages']);
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
      const requested = ['keltner_channels', 'zigzag'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.lockedIndicators).toContain('keltner_channels');
      expect(result.lockedIndicators).toContain('zigzag');
      expect(result.accessibleIndicators).toHaveLength(0);
    });

    it('should return upgradeRequired: false for PRO tier with all valid indicators', () => {
      const requested = [
        'fractal_diagonal',
        'keltner_channels',
        'zigzag',
        'moving_averages',
      ];
      const result = getIndicatorUpgradeInfo('PRO', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
      expect(result.accessibleIndicators).toEqual([
        'fractal_diagonal',
        'keltner_channels',
        'zigzag',
        'moving_averages',
      ]);
    });

    it('should return upgradeRequired: false for FREE tier with only FREE indicators', () => {
      const requested = ['fractal_diagonal', 'fractal_horizontal'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
      expect(result.accessibleIndicators).toEqual([
        'fractal_diagonal',
        'fractal_horizontal',
      ]);
    });

    it('should correctly categorize mixed requests', () => {
      const requested = [
        'fractal_diagonal',
        'moving_averages',
        'heiken_ashi',
        'zigzag',
      ];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.accessibleIndicators).toEqual(['fractal_diagonal']);
      expect(result.lockedIndicators).toEqual([
        'moving_averages',
        'heiken_ashi',
        'zigzag',
      ]);
    });

    it('should handle empty request array', () => {
      const result = getIndicatorUpgradeInfo('FREE', []);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedIndicators).toHaveLength(0);
      expect(result.accessibleIndicators).toHaveLength(0);
    });

    it('should ignore invalid indicator IDs', () => {
      const requested = ['fractal_diagonal', 'invalid_id', 'moving_averages'];
      const result = getIndicatorUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.accessibleIndicators).toEqual(['fractal_diagonal']);
      expect(result.lockedIndicators).toEqual(['moving_averages']);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isValidIndicatorId
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('isValidIndicatorId', () => {
    it('should return true for all valid indicators (8 total)', () => {
      const validIds = [
        'fractal_diagonal',
        'fractal_horizontal',
        'moving_averages',
        'body_momentum',
        'heiken_ashi',
        'keltner_channels',
        'support_resistance',
        'zigzag',
      ];

      validIds.forEach((id) => {
        expect(isValidIndicatorId(id)).toBe(true);
      });
    });

    it('should return false for invalid indicator id', () => {
      expect(isValidIndicatorId('invalid')).toBe(false);
      expect(isValidIndicatorId('fractals')).toBe(false); // old name
      expect(isValidIndicatorId('trendlines')).toBe(false); // old name
      expect(isValidIndicatorId('tema')).toBe(false); // sub-indicator
      expect(isValidIndicatorId('')).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // canAccessColumn (NEW - Column-level access control)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('canAccessColumn', () => {
    describe('System columns (always accessible)', () => {
      it('should allow FREE tier to access system columns', () => {
        expect(canAccessColumn('FREE', 'timestamp')).toBe(true);
        expect(canAccessColumn('FREE', 'open')).toBe(true);
        expect(canAccessColumn('FREE', 'high')).toBe(true);
        expect(canAccessColumn('FREE', 'low')).toBe(true);
        expect(canAccessColumn('FREE', 'close')).toBe(true);
        expect(canAccessColumn('FREE', 'volume')).toBe(true);
        expect(canAccessColumn('FREE', 'timeframe')).toBe(true);
        expect(canAccessColumn('FREE', 'collected_at')).toBe(true);
      });

      it('should allow PRO tier to access system columns', () => {
        expect(canAccessColumn('PRO', 'timestamp')).toBe(true);
        expect(canAccessColumn('PRO', 'close')).toBe(true);
      });
    });

    describe('FREE tier indicator columns', () => {
      it('should allow FREE tier to access fractal_diagonal columns', () => {
        expect(canAccessColumn('FREE', 'diag_asc_line_1')).toBe(true);
        expect(canAccessColumn('FREE', 'diag_desc_line_2')).toBe(true);
        expect(canAccessColumn('FREE', 'diag_high_map')).toBe(true);
      });

      it('should allow FREE tier to access fractal_horizontal columns', () => {
        expect(canAccessColumn('FREE', 'horiz_peak_line_1')).toBe(true);
        expect(canAccessColumn('FREE', 'horiz_bottom_line_2')).toBe(true);
        expect(canAccessColumn('FREE', 'horiz_low_map')).toBe(true);
      });

      it('should allow PRO tier to access FREE tier columns', () => {
        expect(canAccessColumn('PRO', 'diag_asc_line_1')).toBe(true);
        expect(canAccessColumn('PRO', 'horiz_peak_line_1')).toBe(true);
      });
    });

    describe('PRO tier indicator columns', () => {
      it('should deny FREE tier access to moving_averages columns', () => {
        expect(canAccessColumn('FREE', 'tema')).toBe(false);
        expect(canAccessColumn('FREE', 'hrma')).toBe(false);
        expect(canAccessColumn('FREE', 'smma')).toBe(false);
      });

      it('should deny FREE tier access to body_momentum columns', () => {
        expect(canAccessColumn('FREE', 'z_score_of_body_size')).toBe(false);
        expect(canAccessColumn('FREE', 'candle_classification')).toBe(false);
      });

      it('should deny FREE tier access to keltner_channels columns', () => {
        expect(canAccessColumn('FREE', 'kc_ultra_extreme_upper')).toBe(false);
        expect(canAccessColumn('FREE', 'kc_upper')).toBe(false);
      });

      it('should deny FREE tier access to zigzag columns', () => {
        expect(canAccessColumn('FREE', 'zigzag_peak')).toBe(false);
        expect(canAccessColumn('FREE', 'ema_26')).toBe(false);
      });

      it('should allow PRO tier to access all PRO columns', () => {
        expect(canAccessColumn('PRO', 'tema')).toBe(true);
        expect(canAccessColumn('PRO', 'z_score_of_body_size')).toBe(true);
        expect(canAccessColumn('PRO', 'kc_ultra_extreme_upper')).toBe(true);
        expect(canAccessColumn('PRO', 'zigzag_peak')).toBe(true);
      });
    });

    describe('Invalid columns', () => {
      it('should return false for non-existent columns', () => {
        expect(canAccessColumn('FREE', 'invalid_column')).toBe(false);
        expect(canAccessColumn('PRO', 'invalid_column')).toBe(false);
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getAccessibleColumns (NEW)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getAccessibleColumns', () => {
    it('should return 24 columns for FREE tier (8 system + 16 indicators)', () => {
      const columns = getAccessibleColumns('FREE');

      expect(columns).toHaveLength(24);
      expect(columns).toContain('timestamp');
      expect(columns).toContain('close');
      expect(columns).toContain('diag_asc_line_1');
      expect(columns).toContain('horiz_peak_line_1');
    });

    it('should return 57 columns for PRO tier (8 system + 49 indicators)', () => {
      const columns = getAccessibleColumns('PRO');

      expect(columns).toHaveLength(57);
      expect(columns).toContain('timestamp');
      expect(columns).toContain('close');
      expect(columns).toContain('diag_asc_line_1');
      expect(columns).toContain('tema');
      expect(columns).toContain('kc_ultra_extreme_upper');
      expect(columns).toContain('zigzag_peak');
    });

    it('should not include PRO columns for FREE tier', () => {
      const columns = getAccessibleColumns('FREE');

      expect(columns).not.toContain('tema');
      expect(columns).not.toContain('kc_ultra_extreme_upper');
      expect(columns).not.toContain('zigzag_peak');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getLockedColumns (NEW)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getLockedColumns', () => {
    it('should return 33 locked columns for FREE tier (all PRO indicator columns)', () => {
      const locked = getLockedColumns('FREE');

      expect(locked).toHaveLength(33);
      expect(locked).toContain('tema');
      expect(locked).toContain('z_score_of_body_size');
      expect(locked).toContain('kc_ultra_extreme_upper');
      expect(locked).toContain('zigzag_peak');
    });

    it('should return empty array for PRO tier', () => {
      const locked = getLockedColumns('PRO');

      expect(locked).toHaveLength(0);
    });

    it('should not include system columns or FREE columns', () => {
      const locked = getLockedColumns('FREE');

      expect(locked).not.toContain('timestamp');
      expect(locked).not.toContain('close');
      expect(locked).not.toContain('diag_asc_line_1');
      expect(locked).not.toContain('horiz_peak_line_1');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // filterDataByTier (NEW)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('filterDataByTier', () => {
    it('should remove PRO columns for FREE tier', () => {
      const data = {
        timestamp: 1705324800,
        close: 43265,
        tema: 43260, // PRO only
        diag_asc_line_1: 43200, // FREE
        zigzag_peak: 43500, // PRO only
      };

      const filtered = filterDataByTier('FREE', data);

      expect(filtered.timestamp).toBe(1705324800);
      expect(filtered.close).toBe(43265);
      expect(filtered.diag_asc_line_1).toBe(43200);
      expect(filtered.tema).toBeUndefined();
      expect(filtered.zigzag_peak).toBeUndefined();
    });

    it('should keep all columns for PRO tier', () => {
      const data = {
        timestamp: 1705324800,
        close: 43265,
        tema: 43260,
        diag_asc_line_1: 43200,
        zigzag_peak: 43500,
      };

      const filtered = filterDataByTier('PRO', data);

      expect(filtered).toEqual(data);
    });

    it('should handle null values correctly', () => {
      const data = {
        timestamp: 1705324800,
        close: 43265,
        tema: null,
        diag_asc_line_1: null,
      };

      const freeFiltered = filterDataByTier('FREE', data);
      expect(freeFiltered.diag_asc_line_1).toBeNull();
      expect(freeFiltered.tema).toBeUndefined();

      const proFiltered = filterDataByTier('PRO', data);
      expect(proFiltered.tema).toBeNull();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // filterAccessibleColumns (NEW)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('filterAccessibleColumns', () => {
    it('should filter to only accessible columns for FREE tier', () => {
      const requested = [
        'timestamp',
        'close',
        'diag_asc_line_1',
        'tema',
        'zigzag_peak',
      ];
      const result = filterAccessibleColumns('FREE', requested);

      expect(result).toEqual(['timestamp', 'close', 'diag_asc_line_1']);
    });

    it('should keep all valid columns for PRO tier', () => {
      const requested = [
        'timestamp',
        'close',
        'diag_asc_line_1',
        'tema',
        'zigzag_peak',
      ];
      const result = filterAccessibleColumns('PRO', requested);

      expect(result).toEqual(requested);
    });

    it('should filter out invalid column names', () => {
      const requested = [
        'timestamp',
        'invalid_column',
        'diag_asc_line_1',
        'another_invalid',
      ];
      const result = filterAccessibleColumns('FREE', requested);

      expect(result).toEqual(['timestamp', 'diag_asc_line_1']);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // getColumnUpgradeInfo (NEW)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('getColumnUpgradeInfo', () => {
    it('should return upgradeRequired: true when PRO columns requested by FREE tier', () => {
      const requested = ['timestamp', 'close', 'tema', 'zigzag_peak'];
      const result = getColumnUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(true);
      expect(result.lockedColumns).toEqual(['tema', 'zigzag_peak']);
      expect(result.accessibleColumns).toEqual(['timestamp', 'close']);
    });

    it('should return upgradeRequired: false for PRO tier with valid columns', () => {
      const requested = ['timestamp', 'close', 'tema', 'zigzag_peak'];
      const result = getColumnUpgradeInfo('PRO', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedColumns).toHaveLength(0);
      expect(result.accessibleColumns).toEqual(requested);
    });

    it('should return upgradeRequired: false for FREE tier with only FREE columns', () => {
      const requested = ['timestamp', 'close', 'diag_asc_line_1'];
      const result = getColumnUpgradeInfo('FREE', requested);

      expect(result.upgradeRequired).toBe(false);
      expect(result.lockedColumns).toHaveLength(0);
      expect(result.accessibleColumns).toEqual(requested);
    });
  });
});
