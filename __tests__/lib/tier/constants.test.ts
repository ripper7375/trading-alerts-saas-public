/**
 * Indicator Tier Constants Tests - 57-Column Schema
 *
 * Tests for lib/tier/constants.ts
 * Indicator definitions, metadata, and colors
 *
 * Part 4: Tier System - Updated for 57-column database schema
 */

import { describe, it, expect } from '@jest/globals';

import {
  PRO_ONLY_INDICATORS,
  FREE_TIER_INDICATORS,
  BASIC_INDICATORS,
  ALL_INDICATORS,
  INDICATOR_METADATA,
  KELTNER_COLORS,
  MOMENTUM_COLORS,
  MA_COLORS,
  ZIGZAG_COLORS,
} from '@/lib/tier/constants';

describe('Indicator Tier Constants - 57-Column Schema', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FREE_TIER_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('FREE_TIER_INDICATORS', () => {
    it('should contain exactly 2 FREE tier indicators', () => {
      expect(FREE_TIER_INDICATORS).toHaveLength(2);
    });

    it('should contain fractal_diagonal', () => {
      expect(FREE_TIER_INDICATORS).toContain('fractal_diagonal');
    });

    it('should contain fractal_horizontal', () => {
      expect(FREE_TIER_INDICATORS).toContain('fractal_horizontal');
    });

    it('should not contain PRO indicators', () => {
      expect(FREE_TIER_INDICATORS).not.toContain('moving_averages');
      expect(FREE_TIER_INDICATORS).not.toContain('keltner_channels');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO_ONLY_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PRO_ONLY_INDICATORS', () => {
    it('should contain exactly 6 PRO indicators', () => {
      expect(PRO_ONLY_INDICATORS).toHaveLength(6);
    });

    it('should contain moving_averages', () => {
      expect(PRO_ONLY_INDICATORS).toContain('moving_averages');
    });

    it('should contain body_momentum', () => {
      expect(PRO_ONLY_INDICATORS).toContain('body_momentum');
    });

    it('should contain heiken_ashi', () => {
      expect(PRO_ONLY_INDICATORS).toContain('heiken_ashi');
    });

    it('should contain keltner_channels', () => {
      expect(PRO_ONLY_INDICATORS).toContain('keltner_channels');
    });

    it('should contain support_resistance', () => {
      expect(PRO_ONLY_INDICATORS).toContain('support_resistance');
    });

    it('should contain zigzag', () => {
      expect(PRO_ONLY_INDICATORS).toContain('zigzag');
    });

    it('should not contain FREE tier indicators', () => {
      expect(PRO_ONLY_INDICATORS).not.toContain('fractal_diagonal');
      expect(PRO_ONLY_INDICATORS).not.toContain('fractal_horizontal');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BASIC_INDICATORS (Legacy Alias)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('BASIC_INDICATORS (legacy alias)', () => {
    it('should be an alias for FREE_TIER_INDICATORS', () => {
      expect(BASIC_INDICATORS).toEqual(FREE_TIER_INDICATORS);
    });

    it('should contain 2 indicators', () => {
      expect(BASIC_INDICATORS).toHaveLength(2);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALL_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('ALL_INDICATORS', () => {
    it('should contain 8 total indicators (2 FREE + 6 PRO)', () => {
      expect(ALL_INDICATORS).toHaveLength(8);
    });

    it('should include all FREE tier indicators', () => {
      FREE_TIER_INDICATORS.forEach((indicator) => {
        expect(ALL_INDICATORS).toContain(indicator);
      });
    });

    it('should include all PRO indicators', () => {
      PRO_ONLY_INDICATORS.forEach((indicator) => {
        expect(ALL_INDICATORS).toContain(indicator);
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INDICATOR_METADATA
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('INDICATOR_METADATA', () => {
    it('should have metadata for all 8 indicators', () => {
      expect(Object.keys(INDICATOR_METADATA)).toHaveLength(8);
    });

    it('should have metadata for all indicators', () => {
      ALL_INDICATORS.forEach((id) => {
        expect(INDICATOR_METADATA[id]).toBeDefined();
      });
    });

    it('should have correct structure for each indicator', () => {
      ALL_INDICATORS.forEach((id) => {
        const meta = INDICATOR_METADATA[id];
        expect(meta.id).toBe(id);
        expect(typeof meta.label).toBe('string');
        expect(typeof meta.description).toBe('string');
        expect(meta.tier).toBeDefined();
        expect(['FREE', 'PRO']).toContain(meta.tier);
        expect(Array.isArray(meta.columns)).toBe(true);
        expect(typeof meta.colors).toBe('object');
      });
    });

    it('should categorize FREE tier indicators correctly', () => {
      expect(INDICATOR_METADATA.fractal_diagonal.tier).toBe('FREE');
      expect(INDICATOR_METADATA.fractal_horizontal.tier).toBe('FREE');
    });

    it('should categorize PRO indicators correctly', () => {
      expect(INDICATOR_METADATA.moving_averages.tier).toBe('PRO');
      expect(INDICATOR_METADATA.body_momentum.tier).toBe('PRO');
      expect(INDICATOR_METADATA.heiken_ashi.tier).toBe('PRO');
      expect(INDICATOR_METADATA.keltner_channels.tier).toBe('PRO');
      expect(INDICATOR_METADATA.support_resistance.tier).toBe('PRO');
      expect(INDICATOR_METADATA.zigzag.tier).toBe('PRO');
    });

    it('should have correct column counts', () => {
      expect(INDICATOR_METADATA.fractal_diagonal.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.fractal_horizontal.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.moving_averages.columns).toHaveLength(3);
      expect(INDICATOR_METADATA.body_momentum.columns).toHaveLength(2);
      expect(INDICATOR_METADATA.heiken_ashi.columns).toHaveLength(7);
      expect(INDICATOR_METADATA.keltner_channels.columns).toHaveLength(10);
      expect(INDICATOR_METADATA.support_resistance.columns).toHaveLength(8);
      expect(INDICATOR_METADATA.zigzag.columns).toHaveLength(3);
    });

    it('should have colors for all indicators', () => {
      ALL_INDICATORS.forEach((id) => {
        expect(INDICATOR_METADATA[id].colors).toBeDefined();
        expect(typeof INDICATOR_METADATA[id].colors).toBe('object');
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // KELTNER_COLORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('KELTNER_COLORS', () => {
    it('should have 10 band colors', () => {
      const bandKeys = [
        'ultraExtremeUpper',
        'extremeUpper',
        'upperMost',
        'upper',
        'upperMiddle',
        'lowerMiddle',
        'lower',
        'lowerMost',
        'extremeLower',
        'ultraExtremeLower',
      ];

      bandKeys.forEach((key) => {
        expect(
          KELTNER_COLORS[key as keyof typeof KELTNER_COLORS]
        ).toBeDefined();
      });
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      Object.values(KELTNER_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MOMENTUM_COLORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('MOMENTUM_COLORS', () => {
    it('should have all candle type colors', () => {
      const candleTypes = [
        'UP_NORMAL',
        'UP_LARGE',
        'UP_EXTREME',
        'DOWN_NORMAL',
        'DOWN_LARGE',
        'DOWN_EXTREME',
      ];

      candleTypes.forEach((type) => {
        expect(
          MOMENTUM_COLORS[type as keyof typeof MOMENTUM_COLORS]
        ).toBeDefined();
      });
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      Object.values(MOMENTUM_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MA_COLORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('MA_COLORS', () => {
    it('should have colors for TEMA, HRMA, SMMA', () => {
      expect(MA_COLORS.tema).toBeDefined();
      expect(MA_COLORS.hrma).toBeDefined();
      expect(MA_COLORS.smma).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      expect(MA_COLORS.tema).toMatch(hexColorRegex);
      expect(MA_COLORS.hrma).toMatch(hexColorRegex);
      expect(MA_COLORS.smma).toMatch(hexColorRegex);
    });

    it('should match INDICATOR_METADATA colors for moving_averages', () => {
      expect(MA_COLORS.tema).toBe(INDICATOR_METADATA.moving_averages.colors.tema);
      expect(MA_COLORS.hrma).toBe(INDICATOR_METADATA.moving_averages.colors.hrma);
      expect(MA_COLORS.smma).toBe(INDICATOR_METADATA.moving_averages.colors.smma);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ZIGZAG_COLORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('ZIGZAG_COLORS', () => {
    it('should have peaks, bottoms, and line colors', () => {
      expect(ZIGZAG_COLORS.peaks).toBeDefined();
      expect(ZIGZAG_COLORS.bottoms).toBeDefined();
      expect(ZIGZAG_COLORS.line).toBeDefined();
    });

    it('should have valid hex color format', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      expect(ZIGZAG_COLORS.peaks).toMatch(hexColorRegex);
      expect(ZIGZAG_COLORS.bottoms).toMatch(hexColorRegex);
      expect(ZIGZAG_COLORS.line).toMatch(hexColorRegex);
    });

    it('should have distinct colors for peaks and bottoms', () => {
      expect(ZIGZAG_COLORS.peaks).not.toBe(ZIGZAG_COLORS.bottoms);
    });
  });
});
