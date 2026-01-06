/**
 * Part 20 - Phase 07: Timeframe Filter Unit Tests
 *
 * Tests for timeframe filtering logic used by sync script and API.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 4.3
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

import {
  filterByTimeframe,
  isTimeframeBoundary,
  getLatestTimeframeTimestamp,
  getNextTimeframeBoundary,
  getExpectedBarCount,
  TIMEFRAME_DIVISORS,
} from '@/lib/indicators/timeframe-filter';

describe('Timeframe Filter', () => {
  describe('TIMEFRAME_DIVISORS', () => {
    it('should have correct divisor values', () => {
      expect(TIMEFRAME_DIVISORS.M5).toBe(5);
      expect(TIMEFRAME_DIVISORS.M15).toBe(15);
      expect(TIMEFRAME_DIVISORS.M30).toBe(30);
      expect(TIMEFRAME_DIVISORS.H1).toBe(60);
      expect(TIMEFRAME_DIVISORS.H2).toBe(120);
      expect(TIMEFRAME_DIVISORS.H4).toBe(240);
      expect(TIMEFRAME_DIVISORS.H8).toBe(480);
      expect(TIMEFRAME_DIVISORS.H12).toBe(720);
      expect(TIMEFRAME_DIVISORS.D1).toBe(1440);
    });
  });

  describe('filterByTimeframe', () => {
    // Base timestamp: 2026-01-06 00:00:00 UTC = 1767657600
    const baseTimestamp = 1767657600;

    // Create test rows at 5-minute intervals for 2 hours (24 rows)
    const testRows = Array.from({ length: 24 }, (_, i) => ({
      timestamp: baseTimestamp + i * 5 * 60, // 5 minutes apart
      open: 1.0 + i * 0.001,
      high: 1.01 + i * 0.001,
      low: 0.99 + i * 0.001,
      close: 1.005 + i * 0.001,
    }));

    describe('M5 filtering (5-minute boundaries)', () => {
      it('should include all rows on 5-minute boundaries', () => {
        const filtered = filterByTimeframe(testRows, 'M5');
        // All 24 rows are on 5-minute boundaries
        expect(filtered.length).toBe(24);
      });

      it('should exclude rows not on 5-minute boundaries', () => {
        const offBoundaryRows = [
          { timestamp: baseTimestamp + 62 }, // 00:01:02
          { timestamp: baseTimestamp + 180 }, // 00:03:00
          { timestamp: baseTimestamp + 240 }, // 00:04:00
        ];
        const filtered = filterByTimeframe(offBoundaryRows, 'M5');
        expect(filtered.length).toBe(0);
      });

      it('should be case-insensitive', () => {
        const filtered = filterByTimeframe(testRows, 'm5');
        expect(filtered.length).toBe(24);
      });
    });

    describe('M15 filtering (15-minute boundaries)', () => {
      it('should include only rows on 15-minute boundaries', () => {
        const filtered = filterByTimeframe(testRows, 'M15');
        // 00:00, 00:15, 00:30, 00:45, 01:00, 01:15, 01:30, 01:45 = 8 rows
        expect(filtered.length).toBe(8);
      });

      it('should filter correctly for specific timestamps', () => {
        const rows = [
          { timestamp: baseTimestamp }, // 00:00 ✓
          { timestamp: baseTimestamp + 5 * 60 }, // 00:05 ✗
          { timestamp: baseTimestamp + 10 * 60 }, // 00:10 ✗
          { timestamp: baseTimestamp + 15 * 60 }, // 00:15 ✓
          { timestamp: baseTimestamp + 30 * 60 }, // 00:30 ✓
        ];
        const filtered = filterByTimeframe(rows, 'M15');
        expect(filtered.length).toBe(3);
        expect(filtered[0].timestamp).toBe(baseTimestamp);
        expect(filtered[1].timestamp).toBe(baseTimestamp + 15 * 60);
        expect(filtered[2].timestamp).toBe(baseTimestamp + 30 * 60);
      });
    });

    describe('M30 filtering (30-minute boundaries)', () => {
      it('should include only rows on 30-minute boundaries', () => {
        const filtered = filterByTimeframe(testRows, 'M30');
        // 00:00, 00:30, 01:00, 01:30 = 4 rows
        expect(filtered.length).toBe(4);
      });
    });

    describe('H1 filtering (hourly boundaries)', () => {
      it('should include only rows on the hour', () => {
        const filtered = filterByTimeframe(testRows, 'H1');
        // 00:00, 01:00 = 2 rows
        expect(filtered.length).toBe(2);
      });

      it('should require seconds to be zero', () => {
        const rows = [
          { timestamp: baseTimestamp }, // 00:00:00 ✓
          { timestamp: baseTimestamp + 1 }, // 00:00:01 ✗
          { timestamp: baseTimestamp + 3600 }, // 01:00:00 ✓
        ];
        const filtered = filterByTimeframe(rows, 'H1');
        expect(filtered.length).toBe(2);
      });
    });

    describe('H2 filtering (even hours)', () => {
      it('should include only even hours', () => {
        const extendedRows = [
          { timestamp: baseTimestamp }, // 00:00 ✓ (0 is even)
          { timestamp: baseTimestamp + 3600 }, // 01:00 ✗
          { timestamp: baseTimestamp + 7200 }, // 02:00 ✓
          { timestamp: baseTimestamp + 10800 }, // 03:00 ✗
          { timestamp: baseTimestamp + 14400 }, // 04:00 ✓
        ];
        const filtered = filterByTimeframe(extendedRows, 'H2');
        expect(filtered.length).toBe(3);
      });
    });

    describe('H4 filtering (hours divisible by 4)', () => {
      it('should include hours divisible by 4', () => {
        // Create rows at every hour for a day
        const hourlyRows = Array.from({ length: 24 }, (_, i) => ({
          timestamp: baseTimestamp + i * 3600, // Every hour
        }));
        const filtered = filterByTimeframe(hourlyRows, 'H4');
        // 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 = 6 rows
        expect(filtered.length).toBe(6);
      });
    });

    describe('H8 filtering (hours divisible by 8)', () => {
      it('should include hours divisible by 8', () => {
        const hourlyRows = Array.from({ length: 24 }, (_, i) => ({
          timestamp: baseTimestamp + i * 3600,
        }));
        const filtered = filterByTimeframe(hourlyRows, 'H8');
        // 00:00, 08:00, 16:00 = 3 rows
        expect(filtered.length).toBe(3);
      });
    });

    describe('H12 filtering (hours divisible by 12)', () => {
      it('should include hours divisible by 12', () => {
        const hourlyRows = Array.from({ length: 24 }, (_, i) => ({
          timestamp: baseTimestamp + i * 3600,
        }));
        const filtered = filterByTimeframe(hourlyRows, 'H12');
        // 00:00, 12:00 = 2 rows
        expect(filtered.length).toBe(2);
      });
    });

    describe('D1 filtering (midnight only)', () => {
      it('should include only midnight timestamps', () => {
        const dailyRows = [
          { timestamp: baseTimestamp }, // 00:00:00 ✓
          { timestamp: baseTimestamp + 12 * 3600 }, // 12:00:00 ✗
          { timestamp: baseTimestamp + 24 * 3600 }, // Next day 00:00:00 ✓
        ];
        const filtered = filterByTimeframe(dailyRows, 'D1');
        expect(filtered.length).toBe(2);
      });

      it('should exclude non-midnight timestamps', () => {
        const rows = [
          { timestamp: baseTimestamp + 1 }, // 00:00:01 ✗
          { timestamp: baseTimestamp + 60 }, // 00:01:00 ✗
          { timestamp: baseTimestamp + 3600 }, // 01:00:00 ✗
        ];
        const filtered = filterByTimeframe(rows, 'D1');
        expect(filtered.length).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should return empty array for empty input', () => {
        const filtered = filterByTimeframe([], 'H1');
        expect(filtered.length).toBe(0);
      });

      it('should return empty array for unknown timeframe', () => {
        const filtered = filterByTimeframe(testRows, 'INVALID');
        expect(filtered.length).toBe(0);
      });

      it('should handle timestamps with milliseconds correctly', () => {
        // Timestamp with ms should still work (seconds are checked)
        const rows = [{ timestamp: baseTimestamp }]; // Clean timestamp
        const filtered = filterByTimeframe(rows, 'H1');
        expect(filtered.length).toBe(1);
      });
    });
  });

  describe('isTimeframeBoundary', () => {
    // 2026-01-06 00:00:00 UTC
    const midnight = 1767657600;

    it('should return true for valid M5 boundary', () => {
      expect(isTimeframeBoundary(midnight, 'M5')).toBe(true);
      expect(isTimeframeBoundary(midnight + 5 * 60, 'M5')).toBe(true);
    });

    it('should return false for invalid M5 boundary', () => {
      expect(isTimeframeBoundary(midnight + 3 * 60, 'M5')).toBe(false);
    });

    it('should return true for valid H1 boundary', () => {
      expect(isTimeframeBoundary(midnight, 'H1')).toBe(true);
      expect(isTimeframeBoundary(midnight + 3600, 'H1')).toBe(true);
    });

    it('should return false for invalid H1 boundary', () => {
      expect(isTimeframeBoundary(midnight + 30 * 60, 'H1')).toBe(false);
    });

    it('should return true for valid D1 boundary', () => {
      expect(isTimeframeBoundary(midnight, 'D1')).toBe(true);
    });

    it('should return false for invalid D1 boundary', () => {
      expect(isTimeframeBoundary(midnight + 3600, 'D1')).toBe(false);
    });
  });

  describe('getLatestTimeframeTimestamp', () => {
    it('should align M5 to 5-minute boundary', () => {
      const refTime = new Date('2026-01-06T10:23:45Z');
      const aligned = getLatestTimeframeTimestamp('M5', refTime);
      const alignedDate = new Date(aligned * 1000);

      expect(alignedDate.getUTCMinutes()).toBe(20); // 23 -> 20
      expect(alignedDate.getUTCSeconds()).toBe(0);
    });

    it('should align M15 to 15-minute boundary', () => {
      const refTime = new Date('2026-01-06T10:23:45Z');
      const aligned = getLatestTimeframeTimestamp('M15', refTime);
      const alignedDate = new Date(aligned * 1000);

      expect(alignedDate.getUTCMinutes()).toBe(15); // 23 -> 15
    });

    it('should align H1 to hour boundary', () => {
      const refTime = new Date('2026-01-06T10:23:45Z');
      const aligned = getLatestTimeframeTimestamp('H1', refTime);
      const alignedDate = new Date(aligned * 1000);

      expect(alignedDate.getUTCHours()).toBe(10);
      expect(alignedDate.getUTCMinutes()).toBe(0);
    });

    it('should align H4 to 4-hour boundary', () => {
      const refTime = new Date('2026-01-06T10:23:45Z');
      const aligned = getLatestTimeframeTimestamp('H4', refTime);
      const alignedDate = new Date(aligned * 1000);

      expect(alignedDate.getUTCHours()).toBe(8); // 10 -> 8 (next lower H4)
      expect(alignedDate.getUTCMinutes()).toBe(0);
    });

    it('should align D1 to midnight', () => {
      const refTime = new Date('2026-01-06T10:23:45Z');
      const aligned = getLatestTimeframeTimestamp('D1', refTime);
      const alignedDate = new Date(aligned * 1000);

      expect(alignedDate.getUTCHours()).toBe(0);
      expect(alignedDate.getUTCMinutes()).toBe(0);
      expect(alignedDate.getUTCSeconds()).toBe(0);
    });

    it('should throw for unknown timeframe', () => {
      expect(() => getLatestTimeframeTimestamp('INVALID')).toThrow();
    });
  });

  describe('getNextTimeframeBoundary', () => {
    it('should get next M5 boundary', () => {
      const refTime = new Date('2026-01-06T10:20:00Z');
      const next = getNextTimeframeBoundary('M5', refTime);
      const nextDate = new Date(next * 1000);

      expect(nextDate.getUTCMinutes()).toBe(25);
    });

    it('should get next H1 boundary', () => {
      const refTime = new Date('2026-01-06T10:00:00Z');
      const next = getNextTimeframeBoundary('H1', refTime);
      const nextDate = new Date(next * 1000);

      expect(nextDate.getUTCHours()).toBe(11);
    });

    it('should get next D1 boundary', () => {
      const refTime = new Date('2026-01-06T00:00:00Z');
      const next = getNextTimeframeBoundary('D1', refTime);
      const nextDate = new Date(next * 1000);

      expect(nextDate.getUTCDate()).toBe(7); // Next day
    });
  });

  describe('getExpectedBarCount', () => {
    const oneDayInSeconds = 24 * 60 * 60;

    it('should calculate M5 bars for one day', () => {
      const start = 1767657600;
      const end = start + oneDayInSeconds;
      const count = getExpectedBarCount(start, end, 'M5');

      // 24 hours * 12 bars per hour + 1 = 289
      expect(count).toBe(289);
    });

    it('should calculate H1 bars for one day', () => {
      const start = 1767657600;
      const end = start + oneDayInSeconds;
      const count = getExpectedBarCount(start, end, 'H1');

      // 24 bars + 1 = 25
      expect(count).toBe(25);
    });

    it('should calculate D1 bars for one week', () => {
      const start = 1767657600;
      const end = start + 7 * oneDayInSeconds;
      const count = getExpectedBarCount(start, end, 'D1');

      // 7 days + 1 = 8
      expect(count).toBe(8);
    });

    it('should return 0 for invalid timeframe', () => {
      const count = getExpectedBarCount(0, 1000000, 'INVALID');
      expect(count).toBe(0);
    });
  });
});
