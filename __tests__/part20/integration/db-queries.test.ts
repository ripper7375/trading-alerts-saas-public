/**
 * Part 20 - Phase 07: Database Queries Integration Tests
 *
 * Integration tests for PostgreSQL database queries.
 * Uses mocked PostgreSQL connection for testing.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

// Create mock function before jest.mock call
const mockQuery = jest.fn();

// Mock the postgresql module - this gets hoisted to the top by Jest
jest.mock('@/lib/db/postgresql', () => ({
  __esModule: true,
  query: (...args: unknown[]) => mockQuery(...args),
  getPool: jest.fn(() => ({
    connect: jest.fn(),
    end: jest.fn(),
  })),
  getClient: jest.fn(),
  checkConnection: jest.fn(() => Promise.resolve(true)),
}));

// Imports must come after jest.mock
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getIndicatorDataFromDb,
  getDataFreshness,
  getTableCount,
} from '@/lib/db/queries';

describe('Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
  });

  describe('getIndicatorDataFromDb', () => {
    it('should return correctly formatted indicator data', async () => {
      const mockRows = [
        {
          timestamp: new Date('2026-01-06T10:00:00Z'),
          open: 1.08,
          high: 1.085,
          low: 1.075,
          close: 1.082,
          fractals: { peaks: [], bottoms: [] },
          horizontal_trendlines: { support: [], resistance: [] },
          diagonal_trendlines: { support: [], resistance: [] },
          momentum_candles: [],
          keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
          tema: 1.08,
          hrma: 1.079,
          smma: 1.081,
          zigzag: { points: [] },
        },
        {
          timestamp: new Date('2026-01-06T09:00:00Z'),
          open: 1.079,
          high: 1.083,
          low: 1.074,
          close: 1.08,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: 1.078,
          hrma: 1.077,
          smma: 1.079,
          zigzag: null,
        },
      ];

      mockQuery.mockResolvedValueOnce(mockRows);

      const result = await getIndicatorDataFromDb('EURUSD', 'H1', 100);

      // Verify query was called with correct table name (double-quoted identifier)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"eurusd_h1"'),
        [100]
      );

      // Verify OHLC data is correctly formatted
      expect(result.ohlc).toHaveLength(2);
      expect(result.ohlc[0].time).toBeLessThan(result.ohlc[1].time); // Chronological order
      expect(result.ohlc[0]).toHaveProperty('open');
      expect(result.ohlc[0]).toHaveProperty('high');
      expect(result.ohlc[0]).toHaveProperty('low');
      expect(result.ohlc[0]).toHaveProperty('close');

      // Verify moving averages are arrays
      expect(Array.isArray(result.tema)).toBe(true);
      expect(Array.isArray(result.hrma)).toBe(true);
      expect(Array.isArray(result.smma)).toBe(true);
    });

    it('should handle empty result set', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await getIndicatorDataFromDb('EURUSD', 'H1', 100);

      expect(result.ohlc).toHaveLength(0);
      expect(result.fractals).toEqual({ peaks: [], bottoms: [] });
    });

    it('should use correct table name format', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await getIndicatorDataFromDb('XAUUSD', 'M15', 500);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"xauusd_m15"'),
        [500]
      );
    });

    it('should filter out null values from moving averages', async () => {
      const mockRows = [
        {
          timestamp: new Date(),
          open: 1.0,
          high: 1.01,
          low: 0.99,
          close: 1.0,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: 1.0,
          hrma: null, // null value
          smma: 1.0,
          zigzag: null,
        },
        {
          timestamp: new Date(Date.now() - 3600000),
          open: 0.99,
          high: 1.0,
          low: 0.98,
          close: 0.99,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null, // null value
          hrma: 0.99,
          smma: null, // null value
          zigzag: null,
        },
      ];

      mockQuery.mockResolvedValueOnce(mockRows);

      const result = await getIndicatorDataFromDb('EURUSD', 'H1', 100);

      // Should filter out null values
      expect(result.tema).toHaveLength(1);
      expect(result.hrma).toHaveLength(1);
      expect(result.smma).toHaveLength(1);
    });

    it('should use default limit if not specified', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await getIndicatorDataFromDb('EURUSD', 'H1');

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1000]);
    });
  });

  describe('getDataFreshness', () => {
    it('should return latest timestamp', async () => {
      const latestDate = new Date('2026-01-06T12:00:00Z');
      mockQuery.mockResolvedValueOnce([{ timestamp: latestDate }]);

      const result = await getDataFreshness('EURUSD', 'H1');

      expect(result).toEqual(latestDate);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"eurusd_h1"')
      );
    });

    it('should return null for empty table', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await getDataFreshness('EURUSD', 'H1');

      expect(result).toBeNull();
    });
  });

  describe('getTableCount', () => {
    it('should return total table count', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '135' }]);

      const result = await getTableCount();

      expect(result).toBe(135);
    });

    it('should return 0 for empty database', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '0' }]);

      const result = await getTableCount();

      expect(result).toBe(0);
    });

    it('should handle missing count field', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await getTableCount();

      expect(result).toBe(0);
    });
  });

  describe('Multi-timeframe query', () => {
    it('should query multiple timeframes for same symbol', async () => {
      const timeframes = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'];

      for (const tf of timeframes) {
        mockQuery.mockResolvedValueOnce([]);
        await getIndicatorDataFromDb('EURUSD', tf, 1);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining(`"eurusd_${tf.toLowerCase()}"`),
          [1]
        );
      }
    });
  });
});
