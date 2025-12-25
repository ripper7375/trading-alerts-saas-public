/**
 * Indicator Tier Constants Tests
 *
 * Tests for lib/tier/constants.ts
 * Indicator definitions, metadata, and colors
 *
 * Part 4: Tier System - PRO Indicators Implementation
 */

import { describe, it, expect } from '@jest/globals';

import {
  PRO_ONLY_INDICATORS,
  BASIC_INDICATORS,
  ALL_INDICATORS,
  INDICATOR_METADATA,
  KELTNER_COLORS,
  MOMENTUM_COLORS,
  MA_COLORS,
  ZIGZAG_COLORS,
} from '@/lib/tier/constants';

describe('Indicator Tier Constants', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO_ONLY_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PRO_ONLY_INDICATORS', () => {
    it('should contain exactly 6 PRO indicators', () => {
      expect(PRO_ONLY_INDICATORS).toHaveLength(6);
    });

    it('should contain momentum_candles', () => {
      expect(PRO_ONLY_INDICATORS).toContain('momentum_candles');
    });

    it('should contain keltner_channels', () => {
      expect(PRO_ONLY_INDICATORS).toContain('keltner_channels');
    });

    it('should contain tema', () => {
      expect(PRO_ONLY_INDICATORS).toContain('tema');
    });

    it('should contain hrma', () => {
      expect(PRO_ONLY_INDICATORS).toContain('hrma');
    });

    it('should contain smma', () => {
      expect(PRO_ONLY_INDICATORS).toContain('smma');
    });

    it('should contain zigzag', () => {
      expect(PRO_ONLY_INDICATORS).toContain('zigzag');
    });

    it('should not contain basic indicators', () => {
      expect(PRO_ONLY_INDICATORS).not.toContain('fractals');
      expect(PRO_ONLY_INDICATORS).not.toContain('trendlines');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BASIC_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('BASIC_INDICATORS', () => {
    it('should contain exactly 2 basic indicators', () => {
      expect(BASIC_INDICATORS).toHaveLength(2);
    });

    it('should contain fractals', () => {
      expect(BASIC_INDICATORS).toContain('fractals');
    });

    it('should contain trendlines', () => {
      expect(BASIC_INDICATORS).toContain('trendlines');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALL_INDICATORS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('ALL_INDICATORS', () => {
    it('should contain 8 total indicators (2 basic + 6 PRO)', () => {
      expect(ALL_INDICATORS).toHaveLength(8);
    });

    it('should include all basic indicators', () => {
      BASIC_INDICATORS.forEach((indicator) => {
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
        expect(['basic', 'pro']).toContain(meta.category);
      });
    });

    it('should categorize basic indicators as "basic"', () => {
      expect(INDICATOR_METADATA.fractals.category).toBe('basic');
      expect(INDICATOR_METADATA.trendlines.category).toBe('basic');
    });

    it('should categorize PRO indicators as "pro"', () => {
      expect(INDICATOR_METADATA.momentum_candles.category).toBe('pro');
      expect(INDICATOR_METADATA.keltner_channels.category).toBe('pro');
      expect(INDICATOR_METADATA.tema.category).toBe('pro');
      expect(INDICATOR_METADATA.hrma.category).toBe('pro');
      expect(INDICATOR_METADATA.smma.category).toBe('pro');
      expect(INDICATOR_METADATA.zigzag.category).toBe('pro');
    });

    it('should have colors for moving averages', () => {
      expect(INDICATOR_METADATA.tema.color).toBe('#808080');
      expect(INDICATOR_METADATA.hrma.color).toBe('#00CED1');
      expect(INDICATOR_METADATA.smma.color).toBe('#0000FF');
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

    it('should match INDICATOR_METADATA colors', () => {
      expect(MA_COLORS.tema).toBe(INDICATOR_METADATA.tema.color);
      expect(MA_COLORS.hrma).toBe(INDICATOR_METADATA.hrma.color);
      expect(MA_COLORS.smma).toBe(INDICATOR_METADATA.smma.color);
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
