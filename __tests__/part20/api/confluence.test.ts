/**
 * Part 20 - Phase 07: Confluence API Tests
 *
 * API tests for GET /api/confluence/[symbol] endpoint.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

// Mock session data - needs to be declared before jest.mock
let mockSessionData: { user: { id: string; tier: string } } | null = null;

// Helper function for mock data - must be declared before jest.mock
function createMockTimeframeData() {
  return {
    ohlc: {
      time: Date.now() / 1000,
      open: 1.08,
      high: 1.085,
      low: 1.075,
      close: 1.082,
    },
    fractals: { peaks: [], bottoms: [] },
    horizontal_trendlines: null,
    diagonal_trendlines: null,
    momentum_candles: [],
    keltner_channels: {
      ultra_extreme_upper: [],
      extreme_upper: [],
      upper_most: [],
      upper: [1.09],
      upper_middle: [1.085],
      lower_middle: [1.075],
      lower: [1.07],
      lower_most: [],
      extreme_lower: [],
      ultra_extreme_lower: [],
    },
    tema: 1.08,
    hrma: 1.079,
    smma: 1.081,
    zigzag: { peaks: [], bottoms: [] },
  };
}

// Mock modules before imports - Jest hoists these to the top
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(() => Promise.resolve(mockSessionData)),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock confluence cache
jest.mock('@/lib/cache/confluence-cache', () => ({
  __esModule: true,
  getCachedConfluence: jest.fn(() => Promise.resolve(null)),
  cacheConfluence: jest.fn(() => Promise.resolve()),
}));

// Mock multi-timeframe query
jest.mock('@/lib/db/multi-timeframe-query', () => ({
  __esModule: true,
  getMultiTimeframeData: jest.fn(() =>
    Promise.resolve({
      M5: createMockTimeframeData(),
      M15: createMockTimeframeData(),
      M30: createMockTimeframeData(),
      H1: createMockTimeframeData(),
      H2: createMockTimeframeData(),
      H4: createMockTimeframeData(),
      H8: createMockTimeframeData(),
      H12: createMockTimeframeData(),
      D1: createMockTimeframeData(),
    })
  ),
}));

// Mock confluence calculator
jest.mock('@/lib/confluence/calculator', () => ({
  __esModule: true,
  calculateConfluenceScore: jest.fn(() => ({
    confluence_score: 7.5,
    max_score: 10,
    signals: { bullish: 6, bearish: 2, neutral: 1 },
    breakdown: {
      M5: { bullish: 1, bearish: 0, neutral: 0 },
      M15: { bullish: 1, bearish: 0, neutral: 0 },
    },
    all_117_indicators: {
      M5: { tema: 'bullish', hrma: 'bullish' },
      M15: { tema: 'bullish', hrma: 'bullish' },
    },
  })),
}));

// Import dependencies after mocking
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { GET } from '@/app/api/confluence/[symbol]/route';

// Get the mocked function so we can update its implementation
const mockedGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

describe('Confluence API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionData = null;
    // Update the mock to return current mockSessionData
    mockedGetServerSession.mockImplementation(() =>
      Promise.resolve(
        mockSessionData as unknown as ReturnType<typeof getServerSession>
      )
    );
  });

  function createRequest(symbol: string, timestamp?: string): NextRequest {
    const url = timestamp
      ? `http://localhost/api/confluence/${symbol}?timestamp=${timestamp}`
      : `http://localhost/api/confluence/${symbol}`;
    return new NextRequest(url);
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockSessionData = null;

      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Authentication required');
    });
  });

  describe('Tier restrictions', () => {
    it('should return 403 for FREE tier (PRO required)', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'FREE' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('PRO tier required');
    });

    it('should return 200 for PRO tier', async () => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);

      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Symbol validation', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should return 400 for invalid symbol', async () => {
      const request = createRequest('INVALID');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'INVALID' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid symbol');
    });

    it('should accept valid symbols', async () => {
      const validSymbols = ['EURUSD', 'XAUUSD', 'BTCUSD'];

      for (const symbol of validSymbols) {
        const request = createRequest(symbol);
        const response = await GET(request, {
          params: Promise.resolve({ symbol }),
        });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Timestamp parameter', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should accept ISO 8601 timestamp', async () => {
      const timestamp = '2026-01-06T12:00:00Z';
      const request = createRequest('EURUSD', timestamp);
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.timestamp).toBe(timestamp);
    });

    it('should return 400 for invalid timestamp format', async () => {
      const request = createRequest('EURUSD', 'invalid-date');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('Invalid timestamp');
    });

    it('should use current time when timestamp not provided', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('Response format', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should return confluence score between 0-10', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      const json = await response.json();

      expect(json.confluence_score).toBeGreaterThanOrEqual(0);
      expect(json.confluence_score).toBeLessThanOrEqual(10);
      expect(json.max_score).toBe(10);
    });

    it('should include signal counts', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      const json = await response.json();

      expect(json.signals).toHaveProperty('bullish');
      expect(json.signals).toHaveProperty('bearish');
      expect(json.signals).toHaveProperty('neutral');
      expect(typeof json.signals.bullish).toBe('number');
      expect(typeof json.signals.bearish).toBe('number');
      expect(typeof json.signals.neutral).toBe('number');
    });

    it('should include all 117 indicators', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      const json = await response.json();

      expect(json).toHaveProperty('all_117_indicators');
    });

    it('should include breakdown by timeframe', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      const json = await response.json();

      expect(json).toHaveProperty('breakdown');
    });

    it('should return complete response structure', async () => {
      const request = createRequest('EURUSD');
      const response = await GET(request, {
        params: Promise.resolve({ symbol: 'EURUSD' }),
      });

      const json = await response.json();

      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('symbol');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('confluence_score');
      expect(json).toHaveProperty('max_score');
      expect(json).toHaveProperty('signals');
      expect(json).toHaveProperty('breakdown');
      expect(json).toHaveProperty('all_117_indicators');
    });
  });

  describe('All symbols', () => {
    beforeEach(() => {
      mockSessionData = { user: { id: 'test-user', tier: 'PRO' } };
      mockedGetServerSession.mockResolvedValue(mockSessionData);
    });

    it('should work for all 15 supported symbols', async () => {
      const symbols = [
        'AUDJPY',
        'AUDUSD',
        'BTCUSD',
        'ETHUSD',
        'EURUSD',
        'GBPJPY',
        'GBPUSD',
        'NDX100',
        'NZDUSD',
        'US30',
        'USDCAD',
        'USDCHF',
        'USDJPY',
        'XAGUSD',
        'XAUUSD',
      ];

      for (const symbol of symbols) {
        const request = createRequest(symbol);
        const response = await GET(request, {
          params: Promise.resolve({ symbol }),
        });

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.symbol).toBe(symbol);
      }
    });
  });
});
