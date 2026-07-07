/**
 * Unit Tests: Indicator Tier Validator — V8 (ungated)
 *
 * V8: BOTH tiers have full access to all indicators and all columns.
 * Every access check resolves to "allowed"; nothing is locked; data is
 * never filtered by tier.
 */

import { describe, it, expect } from '@jest/globals';

import {
  ALL_INDICATORS,
  SYSTEM_COLUMNS,
  INDICATOR_METADATA,
} from '../constants';
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

describe('Indicator Tier Validator — V8 (ungated)', () => {
  describe('canAccessIndicator', () => {
    it('allows every known indicator for both tiers', () => {
      for (const indicator of ALL_INDICATORS) {
        expect(canAccessIndicator('FREE', indicator)).toBe(true);
        expect(canAccessIndicator('PRO', indicator)).toBe(true);
      }
    });

    it('rejects unknown indicators for both tiers', () => {
      expect(canAccessIndicator('FREE', 'nonexistent')).toBe(false);
      expect(canAccessIndicator('PRO', 'nonexistent')).toBe(false);
    });
  });

  describe('isProOnlyIndicator', () => {
    it('no indicator is PRO-only anymore', () => {
      for (const indicator of ALL_INDICATORS) {
        expect(isProOnlyIndicator(indicator)).toBe(false);
      }
    });
  });

  describe('getAccessibleIndicators', () => {
    it('returns all indicators for both tiers', () => {
      expect(getAccessibleIndicators('FREE')).toEqual([...ALL_INDICATORS]);
      expect(getAccessibleIndicators('PRO')).toEqual([...ALL_INDICATORS]);
    });
  });

  describe('getLockedIndicators', () => {
    it('returns empty for both tiers', () => {
      expect(getLockedIndicators('FREE')).toEqual([]);
      expect(getLockedIndicators('PRO')).toEqual([]);
    });
  });

  describe('canAccessColumn', () => {
    it('allows system columns for both tiers', () => {
      for (const column of SYSTEM_COLUMNS) {
        expect(canAccessColumn('FREE', column)).toBe(true);
        expect(canAccessColumn('PRO', column)).toBe(true);
      }
    });

    it('allows every indicator column for both tiers', () => {
      for (const metadata of Object.values(INDICATOR_METADATA)) {
        for (const column of metadata.columns) {
          expect(canAccessColumn('FREE', column)).toBe(true);
          expect(canAccessColumn('PRO', column)).toBe(true);
        }
      }
    });

    it('rejects unknown columns', () => {
      expect(canAccessColumn('PRO', 'no_such_column')).toBe(false);
    });
  });

  describe('getAccessibleColumns', () => {
    it('returns identical full column sets for both tiers', () => {
      const freeColumns = getAccessibleColumns('FREE');
      const proColumns = getAccessibleColumns('PRO');
      expect(freeColumns).toEqual(proColumns);
      expect(freeColumns.length).toBeGreaterThan(SYSTEM_COLUMNS.length);
    });
  });

  describe('getLockedColumns', () => {
    it('returns empty for both tiers', () => {
      expect(getLockedColumns('FREE')).toEqual([]);
      expect(getLockedColumns('PRO')).toEqual([]);
    });
  });

  describe('filterDataByTier (V8: pass-through)', () => {
    const row = { timestamp: 1, close: 42, tema: 41, custom: 'x' };

    it('returns data unchanged for FREE tier', () => {
      expect(filterDataByTier('FREE', row)).toEqual(row);
    });

    it('returns data unchanged for PRO tier', () => {
      expect(filterDataByTier('PRO', row)).toEqual(row);
    });

    it('filterDataArrayByTier returns arrays unchanged', () => {
      expect(filterDataArrayByTier('FREE', [row, row])).toEqual([row, row]);
    });
  });

  describe('Validation Helpers', () => {
    it('filterAccessibleIndicators keeps valid IDs regardless of tier', () => {
      const input = ['fractal_diagonal', 'keltner_channels', 'bogus'];
      expect(filterAccessibleIndicators('FREE', input)).toEqual([
        'fractal_diagonal',
        'keltner_channels',
      ]);
    });

    it('filterAccessibleColumns keeps schema-valid columns', () => {
      const input = ['timestamp', 'tema', 'no_such_column'];
      expect(filterAccessibleColumns('FREE', input)).toEqual([
        'timestamp',
        'tema',
      ]);
    });

    it('getIndicatorUpgradeInfo never requires upgrade', () => {
      const info = getIndicatorUpgradeInfo('FREE', [...ALL_INDICATORS]);
      expect(info.upgradeRequired).toBe(false);
      expect(info.lockedIndicators).toEqual([]);
      expect(info.accessibleIndicators).toEqual([...ALL_INDICATORS]);
    });

    it('getColumnUpgradeInfo never requires upgrade', () => {
      const info = getColumnUpgradeInfo('FREE', ['timestamp', 'tema']);
      expect(info.upgradeRequired).toBe(false);
      expect(info.lockedColumns).toEqual([]);
    });
  });

  describe('Type Guards', () => {
    it('isValidIndicatorId accepts known and rejects unknown', () => {
      expect(isValidIndicatorId('zigzag')).toBe(true);
      expect(isValidIndicatorId('bogus')).toBe(false);
    });

    it('isSystemColumn accepts known and rejects unknown', () => {
      expect(isSystemColumn('timestamp')).toBe(true);
      expect(isSystemColumn('tema')).toBe(false);
    });

    it('isFreeTierIndicator accepts every valid indicator (V8)', () => {
      for (const indicator of ALL_INDICATORS) {
        expect(isFreeTierIndicator(indicator)).toBe(true);
      }
    });

    it('isProIndicator is always false (V8)', () => {
      for (const indicator of ALL_INDICATORS) {
        expect(isProIndicator(indicator)).toBe(false);
      }
    });
  });
});
