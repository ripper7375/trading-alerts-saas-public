/**
 * Tests for Indicator Tier Validator - 60-Column Schema
 */

import {
  canAccessIndicator,
  isProOnlyIndicator,
  getAccessibleIndicators,
  getLockedIndicators,
  canAccessColumn,
  getAccessibleColumns,
  getLockedColumns,
  filterDataByTier,
  filterDataArrayByTier,
  filterAccessibleIndicators,
  filterAccessibleColumns,
  getIndicatorUpgradeInfo,
  getColumnUpgradeInfo,
  isValidIndicatorId,
  isSystemColumn,
  isFreeTierIndicator,
  isProIndicator,
} from '../validator';

describe('Indicator Tier Validator - 60-Column Schema', () => {
  describe('Indicator Access Control', () => {
    describe('canAccessIndicator', () => {
      it('FREE tier can access FREE indicators', () => {
        expect(canAccessIndicator('FREE', 'fractal_diagonal')).toBe(true);
        expect(canAccessIndicator('FREE', 'fractal_horizontal')).toBe(true);
      });

      it('FREE tier CANNOT access PRO indicators', () => {
        expect(canAccessIndicator('FREE', 'moving_averages')).toBe(false);
        expect(canAccessIndicator('FREE', 'body_momentum')).toBe(false);
        expect(canAccessIndicator('FREE', 'heiken_ashi')).toBe(false);
        expect(canAccessIndicator('FREE', 'keltner_channels')).toBe(false);
        expect(canAccessIndicator('FREE', 'support_resistance')).toBe(false);
        expect(canAccessIndicator('FREE', 'zigzag')).toBe(false);
        expect(canAccessIndicator('FREE', 'dual_tema_hl')).toBe(false);
        expect(canAccessIndicator('FREE', 'pinbar_detection')).toBe(false);
      });

      it('PRO tier can access all indicators', () => {
        expect(canAccessIndicator('PRO', 'fractal_diagonal')).toBe(true);
        expect(canAccessIndicator('PRO', 'fractal_horizontal')).toBe(true);
        expect(canAccessIndicator('PRO', 'moving_averages')).toBe(true);
        expect(canAccessIndicator('PRO', 'body_momentum')).toBe(true);
        expect(canAccessIndicator('PRO', 'heiken_ashi')).toBe(true);
        expect(canAccessIndicator('PRO', 'keltner_channels')).toBe(true);
        expect(canAccessIndicator('PRO', 'support_resistance')).toBe(true);
        expect(canAccessIndicator('PRO', 'zigzag')).toBe(true);
        expect(canAccessIndicator('PRO', 'dual_tema_hl')).toBe(true);
        expect(canAccessIndicator('PRO', 'pinbar_detection')).toBe(true);
      });

      it('should return false for invalid indicators', () => {
        expect(canAccessIndicator('FREE', 'invalid_indicator')).toBe(false);
        expect(canAccessIndicator('PRO', 'invalid_indicator')).toBe(false);
      });
    });

    describe('isProOnlyIndicator', () => {
      it('should return true for PRO indicators', () => {
        expect(isProOnlyIndicator('moving_averages')).toBe(true);
        expect(isProOnlyIndicator('keltner_channels')).toBe(true);
      });

      it('should return false for FREE indicators', () => {
        expect(isProOnlyIndicator('fractal_diagonal')).toBe(false);
        expect(isProOnlyIndicator('fractal_horizontal')).toBe(false);
      });
    });

    describe('getAccessibleIndicators', () => {
      it('FREE tier should get 2 indicators', () => {
        const indicators = getAccessibleIndicators('FREE');
        expect(indicators).toHaveLength(2);
        expect(indicators).toContain('fractal_diagonal');
        expect(indicators).toContain('fractal_horizontal');
      });

      it('PRO tier should get all 10 indicators', () => {
        const indicators = getAccessibleIndicators('PRO');
        expect(indicators).toHaveLength(10);
      });
    });

    describe('getLockedIndicators', () => {
      it('FREE tier should have 8 locked indicators', () => {
        const locked = getLockedIndicators('FREE');
        expect(locked).toHaveLength(8);
        expect(locked).toContain('moving_averages');
        expect(locked).toContain('keltner_channels');
        expect(locked).toContain('dual_tema_hl');
        expect(locked).toContain('pinbar_detection');
      });

      it('PRO tier should have no locked indicators', () => {
        const locked = getLockedIndicators('PRO');
        expect(locked).toHaveLength(0);
      });
    });
  });

  describe('Column-Level Access Control', () => {
    describe('canAccessColumn', () => {
      it('FREE tier can access system columns', () => {
        expect(canAccessColumn('FREE', 'timestamp')).toBe(true);
        expect(canAccessColumn('FREE', 'open')).toBe(true);
        expect(canAccessColumn('FREE', 'close')).toBe(true);
        expect(canAccessColumn('FREE', 'volume')).toBe(true);
      });

      it('FREE tier can access FREE indicator columns', () => {
        expect(canAccessColumn('FREE', 'diag_asc_line_1')).toBe(true);
        expect(canAccessColumn('FREE', 'horiz_peak_line_1')).toBe(true);
      });

      it('FREE tier CANNOT access PRO-only columns', () => {
        expect(canAccessColumn('FREE', 'tema')).toBe(false);
        expect(canAccessColumn('FREE', 'hrma')).toBe(false);
        expect(canAccessColumn('FREE', 'kc_upper')).toBe(false);
        expect(canAccessColumn('FREE', 'zigzag_high')).toBe(false);
      });

      it('PRO tier can access all columns', () => {
        expect(canAccessColumn('PRO', 'timestamp')).toBe(true);
        expect(canAccessColumn('PRO', 'tema')).toBe(true);
        expect(canAccessColumn('PRO', 'kc_upper')).toBe(true);
        expect(canAccessColumn('PRO', 'zigzag_high')).toBe(true);
      });

      it('should return false for invalid columns', () => {
        expect(canAccessColumn('FREE', 'invalid_column')).toBe(false);
        expect(canAccessColumn('PRO', 'invalid_column')).toBe(false);
      });
    });

    describe('getAccessibleColumns', () => {
      it('FREE tier should get 24 columns', () => {
        const columns = getAccessibleColumns('FREE');
        expect(columns).toHaveLength(24); // 8 system + 16 indicator
      });

      it('PRO tier should get 60 columns', () => {
        const columns = getAccessibleColumns('PRO');
        expect(columns).toHaveLength(60); // 8 system + 52 indicator
      });

      it('FREE tier columns should include system and FREE indicators', () => {
        const columns = getAccessibleColumns('FREE');
        expect(columns).toContain('timestamp');
        expect(columns).toContain('diag_asc_line_1');
        expect(columns).toContain('horiz_peak_line_1');
      });

      it('PRO tier columns should include everything', () => {
        const columns = getAccessibleColumns('PRO');
        expect(columns).toContain('timestamp');
        expect(columns).toContain('diag_asc_line_1');
        expect(columns).toContain('tema');
        expect(columns).toContain('kc_upper');
      });
    });

    describe('getLockedColumns', () => {
      it('FREE tier should have 36 locked columns', () => {
        const locked = getLockedColumns('FREE');
        expect(locked).toHaveLength(36); // All PRO indicator columns
      });

      it('PRO tier should have no locked columns', () => {
        const locked = getLockedColumns('PRO');
        expect(locked).toHaveLength(0);
      });
    });
  });

  describe('Data Filtering', () => {
    const mockData = {
      timestamp: 1705324800,
      open: 43250,
      high: 43280,
      low: 43240,
      close: 43265,
      volume: 1250,
      timeframe: 'H1',
      collected_at: 1705324805,
      // FREE indicator columns
      diag_asc_line_1: 43200,
      diag_asc_line_2: null,
      horiz_peak_line_1: 43300,
      // PRO indicator columns
      tema: 43260,
      hrma: 43258,
      kc_upper: 43300,
      zigzag_high: null,
    };

    describe('filterDataByTier', () => {
      it('FREE tier gets only accessible columns', () => {
        const filtered = filterDataByTier('FREE', mockData);

        // Should have system columns
        expect(filtered.timestamp).toBe(1705324800);
        expect(filtered.close).toBe(43265);

        // Should have FREE indicator columns
        expect(filtered.diag_asc_line_1).toBe(43200);
        expect(filtered.horiz_peak_line_1).toBe(43300);

        // Should NOT have PRO columns
        expect(filtered.tema).toBeUndefined();
        expect(filtered.hrma).toBeUndefined();
        expect(filtered.kc_upper).toBeUndefined();
      });

      it('PRO tier gets all columns', () => {
        const filtered = filterDataByTier('PRO', mockData);

        expect(filtered.timestamp).toBe(1705324800);
        expect(filtered.tema).toBe(43260);
        expect(filtered.kc_upper).toBe(43300);
      });
    });

    describe('filterDataArrayByTier', () => {
      it('should filter array of data objects', () => {
        const dataArray = [mockData, mockData];
        const filtered = filterDataArrayByTier('FREE', dataArray);

        expect(filtered).toHaveLength(2);
        expect(filtered[0].tema).toBeUndefined();
        expect(filtered[0].timestamp).toBe(1705324800);
      });
    });
  });

  describe('Validation Helpers', () => {
    describe('filterAccessibleIndicators', () => {
      it('should filter indicators for FREE tier', () => {
        const requested = [
          'fractal_diagonal',
          'moving_averages',
          'keltner_channels',
        ];
        const filtered = filterAccessibleIndicators('FREE', requested);

        expect(filtered).toHaveLength(1);
        expect(filtered).toContain('fractal_diagonal');
      });

      it('should pass all indicators for PRO tier', () => {
        const requested = ['fractal_diagonal', 'moving_averages', 'zigzag'];
        const filtered = filterAccessibleIndicators('PRO', requested);

        expect(filtered).toHaveLength(3);
      });
    });

    describe('filterAccessibleColumns', () => {
      it('should filter columns for FREE tier', () => {
        const requested = ['timestamp', 'tema', 'diag_asc_line_1'];
        const filtered = filterAccessibleColumns('FREE', requested);

        expect(filtered).toHaveLength(2);
        expect(filtered).toContain('timestamp');
        expect(filtered).toContain('diag_asc_line_1');
        expect(filtered).not.toContain('tema');
      });
    });

    describe('getIndicatorUpgradeInfo', () => {
      it('should identify locked indicators for FREE tier', () => {
        const requested = [
          'fractal_diagonal',
          'moving_averages',
          'keltner_channels',
        ];
        const info = getIndicatorUpgradeInfo('FREE', requested);

        expect(info.upgradeRequired).toBe(true);
        expect(info.lockedIndicators).toHaveLength(2);
        expect(info.accessibleIndicators).toHaveLength(1);
      });

      it('should have no locked indicators for PRO tier', () => {
        const requested = ['moving_averages', 'keltner_channels'];
        const info = getIndicatorUpgradeInfo('PRO', requested);

        expect(info.upgradeRequired).toBe(false);
        expect(info.lockedIndicators).toHaveLength(0);
      });
    });

    describe('getColumnUpgradeInfo', () => {
      it('should identify locked columns for FREE tier', () => {
        const requested = ['timestamp', 'tema', 'kc_upper'];
        const info = getColumnUpgradeInfo('FREE', requested);

        expect(info.upgradeRequired).toBe(true);
        expect(info.lockedColumns).toHaveLength(2);
        expect(info.accessibleColumns).toHaveLength(1);
      });
    });
  });

  describe('Type Guards', () => {
    describe('isValidIndicatorId', () => {
      it('should return true for valid indicators', () => {
        expect(isValidIndicatorId('fractal_diagonal')).toBe(true);
        expect(isValidIndicatorId('moving_averages')).toBe(true);
      });

      it('should return false for invalid indicators', () => {
        expect(isValidIndicatorId('invalid')).toBe(false);
      });
    });

    describe('isSystemColumn', () => {
      it('should return true for system columns', () => {
        expect(isSystemColumn('timestamp')).toBe(true);
        expect(isSystemColumn('open')).toBe(true);
      });

      it('should return false for indicator columns', () => {
        expect(isSystemColumn('tema')).toBe(false);
      });
    });

    describe('isFreeTierIndicator', () => {
      it('should return true for FREE indicators', () => {
        expect(isFreeTierIndicator('fractal_diagonal')).toBe(true);
      });

      it('should return false for PRO indicators', () => {
        expect(isFreeTierIndicator('moving_averages')).toBe(false);
      });
    });

    describe('isProIndicator', () => {
      it('should return true for PRO indicators', () => {
        expect(isProIndicator('moving_averages')).toBe(true);
      });

      it('should return false for FREE indicators', () => {
        expect(isProIndicator('fractal_diagonal')).toBe(false);
      });
    });
  });
});
