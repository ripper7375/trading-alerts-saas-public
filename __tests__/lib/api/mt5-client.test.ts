/**
 * PostgreSQL Client Tests (Part 20)
 *
 * Tests for lib/db/postgresql.ts
 * Replaced Part 6 Flask MT5 client tests.
 *
 * Part 20 Migration: Direct PostgreSQL access instead of Flask MT5 API.
 */

// Mock pg module before importing postgresql
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn();
const mockEnd = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    end: mockEnd,
  })),
}));

// Reset module cache to ensure fresh import with mocks
beforeEach(() => {
  jest.resetModules();
  mockConnect.mockReset();
  mockQuery.mockReset();
  mockRelease.mockReset();
  mockEnd.mockReset();

  // Default mock implementation
  mockConnect.mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
});

describe('PostgreSQL Client - Part 20', () => {
  describe('query function', () => {
    it('should execute a query and return rows', async () => {
      const mockRows = [
        { id: 1, close: 1950.5 },
        { id: 2, close: 1951.0 },
      ];
      mockQuery.mockResolvedValue({ rows: mockRows });

      const { query } = await import('@/lib/db/postgresql');
      const result = await query<{ id: number; close: number }>(
        'SELECT * FROM xauusd_m5'
      );

      expect(result).toEqual(mockRows);
      expect(mockConnect).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should pass parameters to query', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { query } = await import('@/lib/db/postgresql');
      await query('SELECT * FROM xauusd_m5 WHERE close > $1', [1900]);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM xauusd_m5 WHERE close > $1',
        [1900]
      );
    });

    it('should release client even on error', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      const { query } = await import('@/lib/db/postgresql');

      await expect(query('SELECT * FROM invalid')).rejects.toThrow(
        'Query failed'
      );
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should return empty array for no results', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { query } = await import('@/lib/db/postgresql');
      const result = await query('SELECT * FROM xauusd_m5 LIMIT 0');

      expect(result).toEqual([]);
    });
  });

  describe('checkConnection function', () => {
    it('should return true when connection is successful', async () => {
      mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });

      const { checkConnection } = await import('@/lib/db/postgresql');
      const result = await checkConnection();

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const { checkConnection } = await import('@/lib/db/postgresql');
      const result = await checkConnection();

      expect(result).toBe(false);
    });

    it('should return false when query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Query error'));

      const { checkConnection } = await import('@/lib/db/postgresql');
      const result = await checkConnection();

      expect(result).toBe(false);
    });
  });

  describe('getClient function', () => {
    it('should return a pool client', async () => {
      const mockClient = { query: mockQuery, release: mockRelease };
      mockConnect.mockResolvedValue(mockClient);

      const { getClient } = await import('@/lib/db/postgresql');
      const client = await getClient();

      expect(client).toBe(mockClient);
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('getPool function', () => {
    it('should return the pool instance', async () => {
      const { getPool } = await import('@/lib/db/postgresql');
      const pool = getPool();

      expect(pool).toBeDefined();
      expect(pool.connect).toBeDefined();
    });

    it('should return same pool instance on multiple calls', async () => {
      const { getPool } = await import('@/lib/db/postgresql');
      const pool1 = getPool();
      const pool2 = getPool();

      expect(pool1).toBe(pool2);
    });
  });

  describe('connection pooling', () => {
    it('should reuse connections from pool', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const { query } = await import('@/lib/db/postgresql');

      // Multiple queries should reuse the pool
      await query('SELECT 1');
      await query('SELECT 2');
      await query('SELECT 3');

      // Connect should be called for each query (pool gives out connections)
      expect(mockConnect).toHaveBeenCalledTimes(3);
      // Each connection should be released back to pool
      expect(mockRelease).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should handle connection timeout', async () => {
      mockConnect.mockRejectedValue(new Error('Connection timeout'));

      const { query } = await import('@/lib/db/postgresql');

      await expect(query('SELECT 1')).rejects.toThrow('Connection timeout');
    });

    it('should handle invalid SQL syntax', async () => {
      mockQuery.mockRejectedValue(
        new Error('syntax error at or near "SELEC"')
      );

      const { query } = await import('@/lib/db/postgresql');

      await expect(query('SELEC * FROM test')).rejects.toThrow('syntax error');
    });

    it('should handle table not found error', async () => {
      mockQuery.mockRejectedValue(
        new Error('relation "nonexistent" does not exist')
      );

      const { query } = await import('@/lib/db/postgresql');

      await expect(query('SELECT * FROM nonexistent')).rejects.toThrow(
        'does not exist'
      );
    });
  });
});

describe('PostgreSQL Client - Integration Patterns', () => {
  beforeEach(() => {
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  describe('OHLC data queries', () => {
    it('should query latest price data', async () => {
      const mockData = [
        {
          timestamp: new Date('2025-12-15T10:00:00Z'),
          close: 1950.5,
        },
      ];
      mockQuery.mockResolvedValue({ rows: mockData });

      const { query } = await import('@/lib/db/postgresql');
      const result = await query<{ timestamp: Date; close: number }>(
        'SELECT timestamp, close FROM xauusd_m5 ORDER BY timestamp DESC LIMIT 1'
      );

      expect(result[0]?.close).toBe(1950.5);
    });

    it('should query OHLC data with limit', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 300000),
        open: 1950 + i * 0.1,
        high: 1951 + i * 0.1,
        low: 1949 + i * 0.1,
        close: 1950.5 + i * 0.1,
      }));
      mockQuery.mockResolvedValue({ rows: mockData });

      const { query } = await import('@/lib/db/postgresql');
      const result = await query(
        'SELECT timestamp, open, high, low, close FROM xauusd_m5 ORDER BY timestamp DESC LIMIT $1',
        [100]
      );

      expect(result).toHaveLength(100);
    });
  });

  describe('indicator data queries', () => {
    it('should query indicator data with JSONB columns', async () => {
      const mockData = [
        {
          timestamp: new Date(),
          close: 1950.5,
          fractals: { peaks: [{ price: 1955 }], bottoms: [{ price: 1945 }] },
          tema: 1950.2,
        },
      ];
      mockQuery.mockResolvedValue({ rows: mockData });

      const { query } = await import('@/lib/db/postgresql');
      const result = await query<{
        timestamp: Date;
        close: number;
        fractals: { peaks: Array<{ price: number }>; bottoms: Array<{ price: number }> };
        tema: number;
      }>('SELECT timestamp, close, fractals, tema FROM xauusd_h1 LIMIT 1');

      expect(result[0]?.fractals.peaks[0]?.price).toBe(1955);
      expect(result[0]?.tema).toBe(1950.2);
    });
  });

  describe('concurrent queries', () => {
    it('should handle multiple concurrent queries', async () => {
      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('xauusd')) {
          return Promise.resolve({ rows: [{ close: 1950 }] });
        }
        if (sql.includes('eurusd')) {
          return Promise.resolve({ rows: [{ close: 1.08 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const { query } = await import('@/lib/db/postgresql');

      const [gold, euro] = await Promise.all([
        query<{ close: number }>('SELECT close FROM xauusd_m5 LIMIT 1'),
        query<{ close: number }>('SELECT close FROM eurusd_m5 LIMIT 1'),
      ]);

      expect(gold[0]?.close).toBe(1950);
      expect(euro[0]?.close).toBe(1.08);
    });
  });
});
