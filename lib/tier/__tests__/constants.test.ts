/**
 * Tests for Indicator Tier Constants - 57-Column Schema
 */

import {
  FREE_TIER_INDICATORS,
  PRO_ONLY_INDICATORS,
  ALL_INDICATORS,
  INDICATOR_METADATA,
  SYSTEM_COLUMNS,
  getIndicatorColumns,
  getIndicatorByColumn,
  isValidColumnName,
  getTierColumnCount,
} from '../constants';

describe('Indicator Constants - 57-Column Schema', () => {
  describe('Indicator Arrays', () => {
    it('FREE_TIER_INDICATORS should have exactly 2 indicators', () => {
      expect(FREE_TIER_INDICATORS).toHaveLength(2);
      expect(FREE_TIER_INDICATORS).toContain('fractal_diagonal');
      expect(FREE_TIER_INDICATORS).toContain('fractal_horizontal');
    });

    it('PRO_ONLY_INDICATORS should have exactly 6 indicators', () => {
      expect(PRO_ONLY_INDICATORS).toHaveLength(6);
      expect(PRO_ONLY_INDICATORS).toContain('moving_averages');
      expect(PRO_ONLY_INDICATORS).toContain('body_momentum');
      expect(PRO_ONLY_INDICATORS).toContain('heiken_ashi');
      expect(PRO_ONLY_INDICATORS).toContain('keltner_channels');
      expect(PRO_ONLY_INDICATORS).toContain('support_resistance');
      expect(PRO_ONLY_INDICATORS).toContain('zigzag');
    });

    it('ALL_INDICATORS should have exactly 8 indicators', () => {
      expect(ALL_INDICATORS).toHaveLength(8);
    });

    it('ALL_INDICATORS should be combination of FREE + PRO', () => {
      const combined = [...FREE_TIER_INDICATORS, ...PRO_ONLY_INDICATORS];
      expect(ALL_INDICATORS).toEqual(combined);
    });
  });

  describe('System Columns', () => {
    it('should have exactly 8 system columns', () => {
      expect(SYSTEM_COLUMNS).toHaveLength(8);
    });

    it('should include all required system columns', () => {
      expect(SYSTEM_COLUMNS).toContain('timestamp');
      expect(SYSTEM_COLUMNS).toContain('open');
      expect(SYSTEM_COLUMNS).toContain('high');
      expect(SYSTEM_COLUMNS).toContain('low');
      expect(SYSTEM_COLUMNS).toContain('close');
      expect(SYSTEM_COLUMNS).toContain('volume');
      expect(SYSTEM_COLUMNS).toContain('timeframe');
      expect(SYSTEM_COLUMNS).toContain('collected_at');
    });
  });

  describe('Indicator Metadata', () => {
    it('should have metadata for all 8 indicators', () => {
      expect(Object.keys(INDICATOR_METADATA)).toHaveLength(8);
    });

    it('FREE tier indicators should have correct tier', () => {
      expect(INDICATOR_METADATA.fractal_diagonal.tier).toBe('FREE');
      expect(INDICATOR_METADATA.fractal_horizontal.tier).toBe('FREE');
    });

    it('PRO tier indicators should have correct tier', () => {
      expect(INDICATOR_METADATA.moving_averages.tier).toBe('PRO');
      expect(INDICATOR_METADATA.body_momentum.tier).toBe('PRO');
      expect(INDICATOR_METADATA.heiken_ashi.tier).toBe('PRO');
      expect(INDICATOR_METADATA.keltner_channels.tier).toBe('PRO');
      expect(INDICATOR_METADATA.support_resistance.tier).toBe('PRO');
      expect(INDICATOR_METADATA.zigzag.tier).toBe('PRO');
    });

    it('fractal_diagonal should have exactly 8 columns', () => {
      expect(INDICATOR_METADATA.fractal_diagonal.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.fractal_diagonal.columns).toContain(
        'diag_asc_line_1'
      );
      expect(INDICATOR_METADATA.fractal_diagonal.columns).toContain(
        'diag_high_map'
      );
    });

    it('fractal_horizontal should have exactly 8 columns', () => {
      expect(INDICATOR_METADATA.fractal_horizontal.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.fractal_horizontal.columns).toContain(
        'horiz_peak_line_1'
      );
      expect(INDICATOR_METADATA.fractal_horizontal.columns).toContain(
        'horiz_high_map'
      );
    });

    it('moving_averages should have exactly 3 columns', () => {
      expect(INDICATOR_METADATA.moving_averages.columns).toHaveLength(3);
      expect(INDICATOR_METADATA.moving_averages.columns).toEqual([
        'tema',
        'hrma',
        'smma',
      ]);
    });

    it('body_momentum should have exactly 2 columns', () => {
      expect(INDICATOR_METADATA.body_momentum.columns).toHaveLength(2);
      expect(INDICATOR_METADATA.body_momentum.columns).toEqual([
        'z_score_of_body_size',
        'candle_classification',
      ]);
    });

    it('heiken_ashi should have exactly 7 columns', () => {
      expect(INDICATOR_METADATA.heiken_ashi.columns).toHaveLength(7);
      expect(INDICATOR_METADATA.heiken_ashi.columns).toContain('ha_open');
      expect(INDICATOR_METADATA.heiken_ashi.columns).toContain(
        'ha_classification'
      );
    });

    it('keltner_channels should have exactly 10 columns', () => {
      expect(INDICATOR_METADATA.keltner_channels.columns).toHaveLength(10);
      expect(INDICATOR_METADATA.keltner_channels.columns).toContain(
        'kc_ultra_extreme_upper'
      );
      expect(INDICATOR_METADATA.keltner_channels.columns).toContain('kc_upper');
    });

    it('support_resistance should have exactly 8 columns', () => {
      expect(INDICATOR_METADATA.support_resistance.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.support_resistance.columns).toContain(
        'sr_support_1'
      );
      expect(INDICATOR_METADATA.support_resistance.columns).toContain(
        'sr_resistance_1'
      );
    });

    it('zigzag should have exactly 3 columns', () => {
      expect(INDICATOR_METADATA.zigzag.columns).toHaveLength(3);
      expect(INDICATOR_METADATA.zigzag.columns).toEqual([
        'zigzag_peak',
        'zigzag_bottom',
        'ema_26',
      ]);
    });
  });

  describe('Column Counts', () => {
    it('FREE tier indicators should have 16 columns total', () => {
      const freeColumns = FREE_TIER_INDICATORS.reduce(
        (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
        0
      );
      expect(freeColumns).toBe(16); // 8 + 8
    });

    it('PRO tier indicators should have 33 columns total', () => {
      const proColumns = PRO_ONLY_INDICATORS.reduce(
        (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
        0
      );
      expect(proColumns).toBe(33); // 3 + 2 + 7 + 10 + 8 + 3
    });

    it('All indicators should have 49 columns total', () => {
      const allColumns = ALL_INDICATORS.reduce(
        (count, ind) => count + INDICATOR_METADATA[ind].columns.length,
        0
      );
      expect(allColumns).toBe(49); // 16 + 33
    });
  });

  describe('Helper Functions', () => {
    describe('getIndicatorColumns', () => {
      it('should return correct columns for fractal_diagonal', () => {
        const columns = getIndicatorColumns('fractal_diagonal');
        expect(columns).toHaveLength(8);
        expect(columns).toContain('diag_asc_line_1');
      });

      it('should return correct columns for moving_averages', () => {
        const columns = getIndicatorColumns('moving_averages');
        expect(columns).toEqual(['tema', 'hrma', 'smma']);
      });
    });

    describe('getIndicatorByColumn', () => {
      it('should return correct indicator for tema', () => {
        expect(getIndicatorByColumn('tema')).toBe('moving_averages');
      });

      it('should return correct indicator for diag_asc_line_1', () => {
        expect(getIndicatorByColumn('diag_asc_line_1')).toBe(
          'fractal_diagonal'
        );
      });

      it('should return correct indicator for kc_upper', () => {
        expect(getIndicatorByColumn('kc_upper')).toBe('keltner_channels');
      });

      it('should return null for invalid column', () => {
        expect(getIndicatorByColumn('invalid_column')).toBeNull();
      });
    });

    describe('isValidColumnName', () => {
      it('should return true for system columns', () => {
        expect(isValidColumnName('timestamp')).toBe(true);
        expect(isValidColumnName('open')).toBe(true);
        expect(isValidColumnName('close')).toBe(true);
      });

      it('should return true for FREE indicator columns', () => {
        expect(isValidColumnName('diag_asc_line_1')).toBe(true);
        expect(isValidColumnName('horiz_peak_line_1')).toBe(true);
      });

      it('should return true for PRO indicator columns', () => {
        expect(isValidColumnName('tema')).toBe(true);
        expect(isValidColumnName('kc_upper')).toBe(true);
        expect(isValidColumnName('zigzag_peak')).toBe(true);
      });

      it('should return false for invalid columns', () => {
        expect(isValidColumnName('invalid_column')).toBe(false);
        expect(isValidColumnName('')).toBe(false);
      });
    });

    describe('getTierColumnCount', () => {
      it('should return 24 for FREE tier', () => {
        expect(getTierColumnCount('FREE')).toBe(24); // 8 system + 16 indicator
      });

      it('should return 57 for PRO tier', () => {
        expect(getTierColumnCount('PRO')).toBe(57); // 8 system + 49 indicator
      });
    });
  });

  describe('Data Integrity', () => {
    it('should have no duplicate column names across all indicators', () => {
      const allColumns = ALL_INDICATORS.flatMap(
        (ind) => INDICATOR_METADATA[ind].columns
      );
      const uniqueColumns = new Set(allColumns);
      expect(allColumns.length).toBe(uniqueColumns.size);
    });

    it('should have consistent ID in metadata', () => {
      ALL_INDICATORS.forEach((ind) => {
        expect(INDICATOR_METADATA[ind].id).toBe(ind);
      });
    });

    it('all metadata should have required fields', () => {
      ALL_INDICATORS.forEach((ind) => {
        const meta = INDICATOR_METADATA[ind];
        expect(meta.id).toBeDefined();
        expect(meta.label).toBeDefined();
        expect(meta.description).toBeDefined();
        expect(meta.category).toBeDefined();
        expect(meta.tier).toBeDefined();
        expect(meta.columns).toBeDefined();
        expect(meta.colors).toBeDefined();
        expect(meta.dataPattern).toBeDefined();
      });
    });
  });
});
