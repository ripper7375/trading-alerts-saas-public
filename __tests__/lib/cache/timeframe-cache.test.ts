/**
 * Timeframe Cache Tests
 *
 * Tests for timeframe-specific caching with correct TTLs.
 */

import {
  TIMEFRAME_CACHE_TTL,
  getTimeframeTTL,
} from '@/lib/cache/cache-manager';

describe('Timeframe Cache TTL', () => {
  describe('TIMEFRAME_CACHE_TTL Constants', () => {
    it('should have correct TTL for M5 (5 minutes = 300 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.M5).toBe(300);
    });

    it('should have correct TTL for M15 (15 minutes = 900 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.M15).toBe(900);
    });

    it('should have correct TTL for M30 (30 minutes = 1800 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.M30).toBe(1800);
    });

    it('should have correct TTL for H1 (1 hour = 3600 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.H1).toBe(3600);
    });

    it('should have correct TTL for H2 (2 hours = 7200 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.H2).toBe(7200);
    });

    it('should have correct TTL for H4 (4 hours = 14400 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.H4).toBe(14400);
    });

    it('should have correct TTL for H8 (8 hours = 28800 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.H8).toBe(28800);
    });

    it('should have correct TTL for H12 (12 hours = 43200 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.H12).toBe(43200);
    });

    it('should have correct TTL for D1 (1 day = 86400 seconds)', () => {
      expect(TIMEFRAME_CACHE_TTL.D1).toBe(86400);
    });

    it('should NOT have M1 timeframe (not in system)', () => {
      expect((TIMEFRAME_CACHE_TTL as Record<string, number>)['M1']).toBeUndefined();
    });

    it('should NOT have W1 timeframe (not in system)', () => {
      expect((TIMEFRAME_CACHE_TTL as Record<string, number>)['W1']).toBeUndefined();
    });

    it('should have exactly 9 timeframes', () => {
      expect(Object.keys(TIMEFRAME_CACHE_TTL)).toHaveLength(9);
    });
  });

  describe('getTimeframeTTL', () => {
    it('should return correct TTL for each valid timeframe', () => {
      expect(getTimeframeTTL('M5')).toBe(300);
      expect(getTimeframeTTL('M15')).toBe(900);
      expect(getTimeframeTTL('M30')).toBe(1800);
      expect(getTimeframeTTL('H1')).toBe(3600);
      expect(getTimeframeTTL('H2')).toBe(7200);
      expect(getTimeframeTTL('H4')).toBe(14400);
      expect(getTimeframeTTL('H8')).toBe(28800);
      expect(getTimeframeTTL('H12')).toBe(43200);
      expect(getTimeframeTTL('D1')).toBe(86400);
    });

    it('should handle lowercase timeframes', () => {
      expect(getTimeframeTTL('m5')).toBe(300);
      expect(getTimeframeTTL('h1')).toBe(3600);
      expect(getTimeframeTTL('d1')).toBe(86400);
    });

    it('should fallback to H1 TTL for unknown timeframes', () => {
      expect(getTimeframeTTL('UNKNOWN')).toBe(3600);
      expect(getTimeframeTTL('M1')).toBe(3600); // M1 not supported, fallback to H1
      expect(getTimeframeTTL('W1')).toBe(3600); // W1 not supported, fallback to H1
    });
  });

  describe('TTL relationship to timeframe duration', () => {
    it('should have TTL equal to or less than timeframe duration', () => {
      // TTL should equal the timeframe duration for freshness
      expect(TIMEFRAME_CACHE_TTL.M5).toBe(5 * 60);   // 5 min
      expect(TIMEFRAME_CACHE_TTL.M15).toBe(15 * 60); // 15 min
      expect(TIMEFRAME_CACHE_TTL.M30).toBe(30 * 60); // 30 min
      expect(TIMEFRAME_CACHE_TTL.H1).toBe(60 * 60);  // 1 hour
      expect(TIMEFRAME_CACHE_TTL.H2).toBe(2 * 60 * 60);  // 2 hours
      expect(TIMEFRAME_CACHE_TTL.H4).toBe(4 * 60 * 60);  // 4 hours
      expect(TIMEFRAME_CACHE_TTL.H8).toBe(8 * 60 * 60);  // 8 hours
      expect(TIMEFRAME_CACHE_TTL.H12).toBe(12 * 60 * 60); // 12 hours
      expect(TIMEFRAME_CACHE_TTL.D1).toBe(24 * 60 * 60);  // 1 day
    });
  });
});
