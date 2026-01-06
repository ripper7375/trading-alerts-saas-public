/**
 * Part 20 - Phase 07: Indicators API Tests
 *
 * API tests for GET /api/indicators/[symbol]/[timeframe] endpoint.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

// Mock session data - needs to be declared before jest.mock
let mockSessionData: { user: { id: string; tier: string } } | null = null;

// Mock modules before imports - Jest hoists these to the top
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(() => Promise.resolve(mockSessionData)),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

jest.mock('@/lib/cache/indicator-cache', () => ({
  __esModule: true,
  getIndicatorDataCached: jest.fn(() =>
    Promise.resolve({
      data: {
        ohlc: Array.from({ length: 100 }, (_, i) => ({
          time: 1767657600 + i * 3600,
          open: 1.08 + i * 0.001,
          high: 1.09 + i * 0.001,
          low: 1.07 + i * 0.001,
          close: 1.085 + i * 0.001,
        })),
        fractals: { peaks: [], bottoms: [] },
        horizontal_trendlines: { support: [], resistance: [] },
        diagonal_trendlines: { support: [], resistance: [] },
        momentum_candles: [],
        keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
        tema: Array(100).fill(1.08),
        hrma: Array(100).fill(1.079),
        smma: Array(100).fill(1.081),
        zigzag: { points: [] },
      },
      dataSource: 'postgresql',
      cached: false,
    })
  ),
  INDICATOR_CACHE_TTL: 30,
}));

jest.mock('@/lib/market-hours/validator', () => ({
  __esModule: true,
  isMarketOpen: jest.fn(() => true),
}));

// Import dependencies after mocking
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/indicators/[symbol]/[timeframe]/route';

// Get the mocked function so we can update its implementation
import { getServerSession } from 'next-auth';
const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

describe('Indicators API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionData = null;
    // Update the mock to return current mockSessionData
    mockedGetServerSession.mockImplementation(() =>
      Promise.resolve(mockSessionData as unknown as ReturnType<typeof getServerSession>)
    );
  });

  function createRequest(
    symbol: string,
    timeframe: string,
    bars?: number
  ): NextRequest {
    const url = bars
      ? `http://localhost/api/indicators/${symbol}/${timeframe}?bars=${bars}`
      : `http://localhost/api/indicators/${symbol}/${timeframe}`;
    return new NextRequest(url);
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockSessionData = null;

      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });

    it('should process request when authenticated', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Symbol validation', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should return 200 for valid symbol EURUSD', async () => {
      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.metadata.symbol).toBe('EURUSD');
    });

    it('should return 400 for invalid symbol', async () => {
      const request = createRequest('INVALID', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'INVALID', timeframe: 'H1' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid symbol');
    });

    it('should normalize symbol to uppercase', async () => {
      const request = createRequest('eurusd', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'eurusd', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.metadata.symbol).toBe('EURUSD');
    });
  });

  describe('Timeframe validation', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should return 200 for valid timeframe H1', async () => {
      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.metadata.timeframe).toBe('H1');
    });

    it('should return 400 for invalid timeframe', async () => {
      const request = createRequest('EURUSD', 'INVALID');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'INVALID' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid timeframe');
    });

    it('should return 400 for unsupported M1 timeframe', async () => {
      const request = createRequest('EURUSD', 'M1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'M1' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Tier restrictions', () => {
    it('should return 403 for FREE tier accessing PRO symbol', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'FREE' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('AUDJPY', 'H1'); // PRO-only symbol
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'AUDJPY', timeframe: 'H1' }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Tier restriction');
      expect(json.upgradeRequired).toBe(true);
    });

    it('should return 403 for FREE tier accessing PRO timeframe', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'FREE' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('EURUSD', 'M5'); // PRO-only timeframe
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'M5' }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.upgradeRequired).toBe(true);
    });

    it('should return 200 for FREE tier accessing FREE symbol/timeframe', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'FREE' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('EURUSD', 'H1'); // FREE symbol and timeframe
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
    });

    it('should return 200 for PRO tier accessing any symbol/timeframe', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('AUDJPY', 'M5'); // PRO symbol and timeframe
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'AUDJPY', timeframe: 'M5' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should return properly formatted response', async () => {
      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      const json = await response.json();

      // Check structure
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('requestedAt');

      // Check data properties
      expect(json.data).toHaveProperty('ohlc');
      expect(json.data).toHaveProperty('fractals');
      expect(json.data).toHaveProperty('keltner_channels');
      expect(json.data).toHaveProperty('tema');
      expect(json.data).toHaveProperty('hrma');
      expect(json.data).toHaveProperty('smma');
      expect(json.data).toHaveProperty('zigzag');

      // Check metadata
      expect(json.metadata).toHaveProperty('symbol');
      expect(json.metadata).toHaveProperty('timeframe');
      expect(json.metadata).toHaveProperty('tier');
      expect(json.metadata).toHaveProperty('data_source');
      expect(json.metadata).toHaveProperty('cached');
      expect(json.metadata).toHaveProperty('bars_returned');
    });

    it('should include cache headers', async () => {
      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('X-Data-Source')).toBe('postgresql');
    });
  });

  describe('Bars limit parameter', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should respect bars parameter', async () => {
      const request = createRequest('EURUSD', 'H1', 500);
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
    });

    it('should use default bars when not specified', async () => {
      const request = createRequest('EURUSD', 'H1');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD', timeframe: 'H1' }),
      });

      expect(response.status).toBe(200);
    });
  });
});
