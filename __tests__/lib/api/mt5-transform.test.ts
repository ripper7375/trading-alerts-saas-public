/**
 * Database Query Functions Tests (Part 20)
 *
 * Tests for lib/db/queries.ts
 * Replaced Part 6 Flask MT5 transform tests.
 *
 * Part 20 Migration: Direct PostgreSQL queries instead of Flask response transformation.
 */

// Mock the postgresql module before imports
const mockQuery = jest.fn();

jest.mock('@/lib/db/postgresql', () => ({
  __esModule: true,
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Import after mocking
import {
  getIndicatorDataFromDb,
  getDataFreshness,
  getTableCount,
} from '@/lib/db/queries';

describe('Database Query Functions - Part 20', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('getIndicatorDataFromDb', () => {
    it('should fetch and transform indicator data', async () => {
      const mockRows = [
        {
          timestamp: new Date('2025-12-15T10:00:00Z'),
          open: 1950.0,
          high: 1955.0,
          low: 1948.0,
          close: 1952.0,
          fractals: { peaks: [{ price: 1955 }], bottoms: [{ price: 1948 }] },
          horizontal_trendlines: { support: [], resistance: [] },
          diagonal_trendlines: { support: [], resistance: [] },
          momentum_candles: [{ index: 0, type: 1, zscore: 1.5 }],
          keltner_channels: { upper: [1960], middle: [1950], lower: [1940], timestamps: [] },
          tema: 1951.5,
          hrma: 1950.8,
          smma: 1949.2,
          zigzag: { points: [] },
        },
        {
          timestamp: new Date('2025-12-15T09:55:00Z'),
          open: 1948.0,
          high: 1952.0,
          low: 1946.0,
          close: 1950.0,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: 1949.5,
          hrma: null,
          smma: 1948.2,
          zigzag: null,
        },
      ];
      mockQuery.mockResolvedValue(mockRows);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1', 500);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT timestamp, open, high, low, close'),
        [500]
      );
      expect(result.ohlc).toHaveLength(2);
      // Data should be reversed (oldest first)
      expect(result.ohlc[0]?.close).toBe(1950.0);
      expect(result.ohlc[1]?.close).toBe(1952.0);
    });

    it('should convert timestamps to Unix time', async () => {
      const mockRows = [
        {
          timestamp: new Date('2025-12-15T10:00:00Z'),
          open: 1950.0,
          high: 1955.0,
          low: 1948.0,
          close: 1952.0,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
      ];
      mockQuery.mockResolvedValue(mockRows);

      const result = await getIndicatorDataFromDb('XAUUSD', 'M5');

      const expectedTime = Math.floor(
        new Date('2025-12-15T10:00:00Z').getTime() / 1000
      );
      expect(result.ohlc[0]?.time).toBe(expectedTime);
    });

    it('should use default limit of 1000', async () => {
      mockQuery.mockResolvedValue([]);

      await getIndicatorDataFromDb('EURUSD', 'H4');

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1000]);
    });

    it('should throw for invalid symbol', async () => {
      await expect(getIndicatorDataFromDb('INVALID', 'H1')).rejects.toThrow(
        'Invalid symbol or timeframe'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should throw for invalid timeframe', async () => {
      await expect(getIndicatorDataFromDb('XAUUSD', 'W1')).rejects.toThrow(
        'Invalid symbol or timeframe'
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should handle empty result set', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1');

      expect(result.ohlc).toEqual([]);
      expect(result.fractals).toEqual({ peaks: [], bottoms: [] });
      expect(result.tema).toEqual([]);
    });

    it('should filter null values from moving averages', async () => {
      const mockRows = [
        {
          timestamp: new Date(),
          open: 1950,
          high: 1955,
          low: 1948,
          close: 1952,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null,
          hrma: 1950.5,
          smma: null,
          zigzag: null,
        },
        {
          timestamp: new Date(),
          open: 1948,
          high: 1952,
          low: 1946,
          close: 1950,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: 1949.5,
          hrma: null,
          smma: 1948.2,
          zigzag: null,
        },
      ];
      mockQuery.mockResolvedValue(mockRows);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1');

      expect(result.tema).toEqual([1949.5]); // Only non-null values
      expect(result.hrma).toEqual([1950.5]);
      expect(result.smma).toEqual([1948.2]);
    });

    it('should flatten momentum candles from all rows', async () => {
      const mockRows = [
        {
          timestamp: new Date(),
          open: 1950,
          high: 1955,
          low: 1948,
          close: 1952,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: [{ index: 0, type: 1, zscore: 1.5 }],
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
        {
          timestamp: new Date(),
          open: 1948,
          high: 1952,
          low: 1946,
          close: 1950,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: [{ index: 1, type: 2, zscore: -0.5 }],
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
      ];
      mockQuery.mockResolvedValue(mockRows);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1');

      expect(result.momentum_candles).toHaveLength(2);
    });

    it('should use correct table name format', async () => {
      mockQuery.mockResolvedValue([]);

      await getIndicatorDataFromDb('BTCUSD', 'M15');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"btcusd_m15"'),
        expect.any(Array)
      );
    });

    it('should handle case-insensitive symbol and timeframe', async () => {
      mockQuery.mockResolvedValue([]);

      await getIndicatorDataFromDb('xauusd', 'h1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"xauusd_h1"'),
        expect.any(Array)
      );
    });
  });

  describe('getDataFreshness', () => {
    it('should return latest timestamp', async () => {
      const latestTimestamp = new Date('2025-12-15T10:00:00Z');
      mockQuery.mockResolvedValue([{ timestamp: latestTimestamp }]);

      const result = await getDataFreshness('XAUUSD', 'H1');

      expect(result).toEqual(latestTimestamp);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC LIMIT 1')
      );
    });

    it('should return null for empty table', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await getDataFreshness('XAUUSD', 'H1');

      expect(result).toBeNull();
    });

    it('should throw for invalid symbol', async () => {
      await expect(getDataFreshness('INVALID', 'H1')).rejects.toThrow(
        'Invalid symbol or timeframe'
      );
    });

    it('should throw for invalid timeframe', async () => {
      await expect(getDataFreshness('XAUUSD', 'M1')).rejects.toThrow(
        'Invalid symbol or timeframe'
      );
    });
  });

  describe('getTableCount', () => {
    it('should return count of tables', async () => {
      mockQuery.mockResolvedValue([{ count: '135' }]);

      const result = await getTableCount();

      expect(result).toBe(135);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.tables')
      );
    });

    it('should return 0 for no tables', async () => {
      mockQuery.mockResolvedValue([{ count: '0' }]);

      const result = await getTableCount();

      expect(result).toBe(0);
    });

    it('should handle empty result', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await getTableCount();

      expect(result).toBe(0);
    });
  });

  describe('Table Name Validation (SQL Injection Prevention)', () => {
    it('should reject symbols with SQL injection attempts', async () => {
      await expect(
        getIndicatorDataFromDb('XAUUSD; DROP TABLE--', 'H1')
      ).rejects.toThrow('Invalid symbol or timeframe');
    });

    it('should reject timeframes with special characters', async () => {
      await expect(
        getIndicatorDataFromDb('XAUUSD', 'H1; DROP TABLE--')
      ).rejects.toThrow('Invalid symbol or timeframe');
    });

    it('should only allow whitelisted symbols', async () => {
      // Valid symbols should work
      mockQuery.mockResolvedValue([]);

      await expect(getIndicatorDataFromDb('XAUUSD', 'H1')).resolves.toBeDefined();
      await expect(getIndicatorDataFromDb('BTCUSD', 'M5')).resolves.toBeDefined();
      await expect(getIndicatorDataFromDb('EURUSD', 'D1')).resolves.toBeDefined();

      // Invalid symbols should be rejected
      await expect(getIndicatorDataFromDb('FAKEUSD', 'H1')).rejects.toThrow();
    });

    it('should only allow whitelisted timeframes', async () => {
      mockQuery.mockResolvedValue([]);

      // Valid timeframes
      await expect(getIndicatorDataFromDb('XAUUSD', 'M5')).resolves.toBeDefined();
      await expect(getIndicatorDataFromDb('XAUUSD', 'H4')).resolves.toBeDefined();
      await expect(getIndicatorDataFromDb('XAUUSD', 'D1')).resolves.toBeDefined();

      // Invalid timeframes
      await expect(getIndicatorDataFromDb('XAUUSD', 'M1')).rejects.toThrow(); // Not supported
      await expect(getIndicatorDataFromDb('XAUUSD', 'W1')).rejects.toThrow(); // Not supported
    });
  });

  describe('Data Transformation', () => {
    it('should provide default empty structures for missing data', async () => {
      mockQuery.mockResolvedValue([
        {
          timestamp: new Date(),
          open: 1950,
          high: 1955,
          low: 1948,
          close: 1952,
          fractals: null,
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
      ]);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1');

      expect(result.fractals).toEqual({ peaks: [], bottoms: [] });
      expect(result.horizontal_trendlines).toEqual({
        support: [],
        resistance: [],
      });
      expect(result.diagonal_trendlines).toEqual({
        support: [],
        resistance: [],
      });
      expect(result.keltner_channels).toEqual({
        upper: [],
        middle: [],
        lower: [],
        timestamps: [],
      });
      expect(result.zigzag).toEqual({ points: [] });
      expect(result.momentum_candles).toEqual([]);
    });

    it('should use first row for JSONB indicator data', async () => {
      const mockRows = [
        {
          timestamp: new Date('2025-12-15T10:00:00Z'),
          open: 1950,
          high: 1955,
          low: 1948,
          close: 1952,
          fractals: { peaks: [{ price: 1955, index: 5 }], bottoms: [] },
          horizontal_trendlines: { support: [1940], resistance: [1960] },
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
        {
          timestamp: new Date('2025-12-15T09:55:00Z'),
          open: 1948,
          high: 1952,
          low: 1946,
          close: 1950,
          fractals: { peaks: [], bottoms: [{ price: 1946, index: 10 }] },
          horizontal_trendlines: null,
          diagonal_trendlines: null,
          momentum_candles: null,
          keltner_channels: null,
          tema: null,
          hrma: null,
          smma: null,
          zigzag: null,
        },
      ];
      mockQuery.mockResolvedValue(mockRows);

      const result = await getIndicatorDataFromDb('XAUUSD', 'H1');

      // Should use first row's fractals (latest data)
      expect(result.fractals.peaks).toHaveLength(1);
      expect(result.fractals.peaks[0]?.price).toBe(1955);
    });
  });

  describe('All Valid Symbols', () => {
    const validSymbols = [
      'XAUUSD',
      'BTCUSD',
      'EURUSD',
      'USDJPY',
      'US30',
      'AUDJPY',
      'AUDUSD',
      'ETHUSD',
      'GBPJPY',
      'GBPUSD',
      'NDX100',
      'NZDUSD',
      'USDCAD',
      'USDCHF',
      'XAGUSD',
    ];

    it.each(validSymbols)('should accept valid symbol: %s', async (symbol) => {
      mockQuery.mockResolvedValue([]);

      await expect(
        getIndicatorDataFromDb(symbol, 'H1')
      ).resolves.toBeDefined();
    });
  });

  describe('All Valid Timeframes', () => {
    const validTimeframes = [
      'M5',
      'M15',
      'M30',
      'H1',
      'H2',
      'H4',
      'H8',
      'H12',
      'D1',
    ];

    it.each(validTimeframes)(
      'should accept valid timeframe: %s',
      async (timeframe) => {
        mockQuery.mockResolvedValue([]);

        await expect(
          getIndicatorDataFromDb('XAUUSD', timeframe)
        ).resolves.toBeDefined();
      }
    );
  });
});
