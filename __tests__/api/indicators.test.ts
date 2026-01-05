/**
 * Indicators API Route Tests
 *
 * Tests for GET /api/indicators and GET /api/indicators/[symbol]/[timeframe]
 */

// Mock Next.js server globals
class MockHeaders {
  private headers: Map<string, string> = new Map();
  constructor(init?: Record<string, string>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }
  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;

  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string> }
  ) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
  }
}

global.Headers = MockHeaders as unknown as typeof Headers;
global.Request = MockRequest as unknown as typeof Request;
global.URL = URL;

// Mock NextResponse
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock next-auth
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: () => mockGetServerSession(),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock indicator cache (Part 20 - Phase 05: Redis caching layer)
const mockGetIndicatorDataCached = jest.fn();

jest.mock('@/lib/cache/indicator-cache', () => {
  const actual = jest.requireActual('@/lib/cache/indicator-cache');
  return {
    __esModule: true,
    ...actual,
    getIndicatorDataCached: (...args: unknown[]) =>
      mockGetIndicatorDataCached(...args),
  };
});

// ✅ Import cache clearing function (Added for Part 1.4)
import { clearAllCache } from '@/lib/cache/indicator-cache';

describe('Indicators API Routes', () => {
  beforeEach(async () => {
    // ✅ Clear cache before each test to ensure isolation (Added for Part 1.4)
    await clearAllCache();

    jest.clearAllMocks();
  });

  describe('GET /api/indicators (list)', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/indicators/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return list of indicator types when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

      const { GET } = await import('@/app/api/indicators/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.indicators).toBeInstanceOf(Array);
      expect(data.count).toBeGreaterThan(0);
    });

    it('should include FRACTAL_HORIZONTAL indicator', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

      const { GET } = await import('@/app/api/indicators/route');
      const response = await GET();
      const data = await response.json();

      const fractalH = data.indicators.find(
        (i: { id: string }) => i.id === 'FRACTAL_HORIZONTAL'
      );
      expect(fractalH).toBeDefined();
      expect(fractalH.name).toBe('Fractal Horizontal Lines');
      expect(fractalH.dataFields).toContain('peak_1');
      expect(fractalH.dataFields).toContain('bottom_1');
    });

    it('should include FRACTAL_DIAGONAL indicator', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

      const { GET } = await import('@/app/api/indicators/route');
      const response = await GET();
      const data = await response.json();

      const fractalD = data.indicators.find(
        (i: { id: string }) => i.id === 'FRACTAL_DIAGONAL'
      );
      expect(fractalD).toBeDefined();
      expect(fractalD.name).toBe('Fractal Diagonal Lines');
      expect(fractalD.dataFields).toContain('ascending_1');
      expect(fractalD.dataFields).toContain('descending_1');
    });

    it('should include OHLC indicator', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

      const { GET } = await import('@/app/api/indicators/route');
      const response = await GET();
      const data = await response.json();

      const ohlc = data.indicators.find((i: { id: string }) => i.id === 'OHLC');
      expect(ohlc).toBeDefined();
      expect(ohlc.dataFields).toContain('open');
      expect(ohlc.dataFields).toContain('high');
      expect(ohlc.dataFields).toContain('low');
      expect(ohlc.dataFields).toContain('close');
    });
  });

  describe('GET /api/indicators/[symbol]/[timeframe]', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 for invalid symbol', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/INVALID/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'INVALID', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid symbol');
    });

    it('should return 400 for invalid timeframe', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/INVALID'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'INVALID' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid timeframe');
    });

    it('should return 403 when FREE tier accesses PRO symbol', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/AUDJPY/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'AUDJPY', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tier restriction');
      expect(data.upgradeRequired).toBe(true);
    });

    it('should return 403 when FREE tier accesses PRO timeframe', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      // M5 is PRO-exclusive timeframe, not available in FREE tier
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/M5'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'M5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.upgradeRequired).toBe(true);
    });

    it('should return indicator data for FREE tier with valid symbol/timeframe', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const mockIndicatorData = {
        ohlc: [
          { time: 1234567890, open: 1900, high: 1910, low: 1890, close: 1905 },
        ],
        horizontal: { peak_1: [], bottom_1: [] },
        diagonal: { ascending_1: [], descending_1: [] },
        fractals: { peaks: [], bottoms: [] },
        metadata: { symbol: 'XAUUSD', timeframe: 'H1', bars: 1000 },
      };
      // Mock the cache-through pattern result
      mockGetIndicatorDataCached.mockResolvedValue({
        data: mockIndicatorData,
        dataSource: 'postgresql',
        cached: false,
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject(mockIndicatorData);
      expect(data.metadata.tier).toBe('FREE');
      expect(data.metadata.data_source).toBe('postgresql');
      expect(data.metadata.cached).toBe(false);
    });

    it('should allow PRO tier to access PRO symbols', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });

      const mockIndicatorData = {
        ohlc: [],
        horizontal: {},
        diagonal: {},
        fractals: {},
        metadata: { symbol: 'AUDJPY', timeframe: 'M5' },
      };
      // Mock cache hit for PRO user
      mockGetIndicatorDataCached.mockResolvedValue({
        data: mockIndicatorData,
        dataSource: 'cache',
        cached: true,
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/AUDJPY/M5'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'AUDJPY', timeframe: 'M5' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject(mockIndicatorData);
      expect(data.metadata.tier).toBe('PRO');
      expect(data.metadata.data_source).toBe('cache');
      expect(data.metadata.cached).toBe(true);
    });

    it('should handle bars query parameter', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockGetIndicatorDataCached.mockResolvedValue({
        data: { ohlc: [] },
        dataSource: 'postgresql',
        cached: false,
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1?bars=500'
      );
      await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });

      // getIndicatorDataCached(symbol, timeframe, limit)
      expect(mockGetIndicatorDataCached).toHaveBeenCalledWith(
        'XAUUSD',
        'H1',
        500
      );
    });

    it('should clamp bars parameter to valid range', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockGetIndicatorDataCached.mockResolvedValue({
        data: { ohlc: [] },
        dataSource: 'postgresql',
        cached: false,
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );

      // Test minimum clamping (bars < 100 should be clamped to 100)
      const request1 = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1?bars=10'
      );
      await GET(request1 as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      expect(mockGetIndicatorDataCached).toHaveBeenCalledWith(
        'XAUUSD',
        'H1',
        100
      );

      // Test maximum clamping (bars > 5000 should be clamped to 5000)
      const request2 = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1?bars=10000'
      );
      await GET(request2 as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      expect(mockGetIndicatorDataCached).toHaveBeenCalledWith(
        'XAUUSD',
        'H1',
        5000
      );
    });

    it('should normalize symbol to uppercase', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockGetIndicatorDataCached.mockResolvedValue({
        data: { ohlc: [] },
        dataSource: 'postgresql',
        cached: false,
      });

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/xauusd/h1'
      );
      await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'xauusd', timeframe: 'h1' }),
      });

      // Symbol and timeframe should be normalized to uppercase
      expect(mockGetIndicatorDataCached).toHaveBeenCalledWith(
        'XAUUSD',
        'H1',
        1000
      );
    });

    it('should handle database connection errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      // Simulate database connection error
      mockGetIndicatorDataCached.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:5432')
      );

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database unavailable');
    });

    it('should handle database timeout errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      // Simulate database timeout
      mockGetIndicatorDataCached.mockRejectedValue(
        new Error('Query timeout exceeded')
      );

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database unavailable');
    });

    it('should handle unknown errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockGetIndicatorDataCached.mockRejectedValue(new Error('Unknown error'));

      const { GET } = await import(
        '@/app/api/indicators/[symbol]/[timeframe]/route'
      );
      const request = new MockRequest(
        'http://localhost/api/indicators/XAUUSD/H1'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });
});
