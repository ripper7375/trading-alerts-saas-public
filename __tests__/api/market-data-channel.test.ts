/**
 * E2E Tests: Market Data Channel API
 * Tests /api/market-data/channel — no prior coverage existed anywhere in
 * the tree before Session 4B-12 (same L28-class gap as Sessions 4B-8/9/10).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Polyfill fetch-related globals for Next.js
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// Mock Request/Response for Next.js
class MockRequest {
  url: string;
  method: string;
  headers: Headers;
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
  }
}
global.Request = MockRequest as unknown as typeof Request;

class MockResponse {
  body: unknown;
  status: number;
  headers: Headers;
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers);
  }
}
global.Response = MockResponse as unknown as typeof Response;

if (typeof global.Headers === 'undefined') {
  class MockHeaders {
    private headers: Map<string, string> = new Map();
    set(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value);
    }
    get(key: string) {
      return this.headers.get(key.toLowerCase());
    }
    has(key: string) {
      return this.headers.has(key.toLowerCase());
    }
  }
  global.Headers = MockHeaders as unknown as typeof Headers;
}

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockFindMany = jest.fn();
jest.mock('@/lib/db/market-prisma', () => ({
  __esModule: true,
  marketPrisma: {
    marketDataV6: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => {
      mockNextResponseJson(data, init);
      return {
        json: async () => data,
        status: init?.status || 200,
      };
    },
  },
}));

// Session 4B-12 operation-service transport (flag + forwarder). Route
// modules are imported dynamically (`await import(...)`) inside each test
// below, not statically at the top of this file — matches the established
// __tests__/api/tier.test.ts (Session 4B-10) / notifications.test.ts
// (Session 4B-9) convention avoiding a Babel CommonJS-hoisting TDZ error.
class MockOperationServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
const mockShouldUseOpService = jest.fn().mockReturnValue(false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForMarketDataChannel: () => mockShouldUseOpService(),
}));

const mockForwardRequestToOperationService = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  OperationServiceError: MockOperationServiceError,
  forwardRequestToOperationService: (...args: unknown[]) =>
    mockForwardRequestToOperationService(...args),
}));

function makeRequest(url = 'http://localhost/api/market-data/channel') {
  return new MockRequest(url) as unknown as Request;
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: 100,
    best_fit_uoedt: 1901.5,
    best_fit_base_fl: 1900,
    best_fit_loedt: 1898.5,
    ...overrides,
  };
}

describe('GET /api/market-data/channel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks() does not reset mockReturnValue() — re-pin the flag to
    // its default OFF state before every test.
    mockShouldUseOpService.mockReturnValue(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns 403 with the exact PRO-upsell payload for a FREE-tier caller', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'FREE' },
    });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({
      success: false,
      error: 'Multi-timeframe visualization is a PRO feature',
      message: 'Upgrade to PRO to overlay M5 channel structure on M15 charts.',
    });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('defaults a missing tier to FREE and 403s', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it('returns 400 for an unsupported symbol (PRO caller)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(
      makeRequest('http://localhost/api/market-data/channel?symbol=EURUSD')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Unsupported symbol (XAUUSD only)');
  });

  it('returns 400 for an unsupported timeframe (PRO caller)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(
      makeRequest('http://localhost/api/market-data/channel?timeframe=H1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Unsupported timeframe (M5, M15 only)');
  });

  it('returns 400 listing all 6 variants for an invalid variant (PRO caller)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(
      makeRequest(
        'http://localhost/api/market-data/channel?variant=not_a_variant'
      )
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      'Invalid variant. Available: best_fit, cherry_a, cherry_b, most_recent, non_a, non_b'
    );
  });

  it('queries with default params (XAUUSD, M5, best_fit, limit 300) and returns mapped points', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockFindMany.mockResolvedValue([makeRow({ timestamp: 200 }), makeRow()]);

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { symbol: 'XAUUSD', timeframe: 'M5' },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });
    expect(data.success).toBe(true);
    expect(data.symbol).toBe('XAUUSD');
    expect(data.timeframe).toBe('M5');
    expect(data.variant).toBe('best_fit');
    // Reversed to chronological order.
    expect(data.points).toEqual([
      { time: 100, upper: 1901.5, mid: 1900, lower: 1898.5 },
      { time: 200, upper: 1901.5, mid: 1900, lower: 1898.5 },
    ]);
  });

  it('honors an explicit variant, reading that variant-specific column set', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockFindMany.mockResolvedValue([
      makeRow({
        best_fit_uoedt: 999,
        cherry_b_uoedt: 5,
        cherry_b_base_fl: 4,
        cherry_b_loedt: 3,
      }),
    ]);

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(
      makeRequest('http://localhost/api/market-data/channel?variant=cherry_b')
    );
    const data = await response.json();

    expect(data.variant).toBe('cherry_b');
    expect(data.points).toEqual([{ time: 100, upper: 5, mid: 4, lower: 3 }]);
  });

  it('clamps a limit above 1000 down to the MAX_LIMIT', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/market-data/channel/route');
    await GET(
      makeRequest('http://localhost/api/market-data/channel?limit=5000')
    );

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1000 })
    );
  });

  it('falls back to the default limit for a non-numeric limit', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/market-data/channel/route');
    await GET(
      makeRequest('http://localhost/api/market-data/channel?limit=abc')
    );

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 300 })
    );
  });

  it('forwards a FREE-tier caller too when the flag is on (operation-service owns the tier gate)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'FREE' },
    });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockRejectedValue(
      new MockOperationServiceError(403, {
        success: false,
        error: 'Multi-timeframe visualization is a PRO feature',
        message:
          'Upgrade to PRO to overlay M5 channel structure on M15 charts.',
      })
    );

    const { GET } = await import('@/app/api/market-data/channel/route');
    const request = makeRequest();
    const response = await GET(request);
    const data = await response.json();

    // The 403 comes from operation-service's own forwarded response, not a
    // local short-circuit — proven by the mock being called at all.
    expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
      request,
      '/market-data/channel'
    );
    expect(response.status).toBe(403);
    expect(data.error).toBe('Multi-timeframe visualization is a PRO feature');
  });

  it('forwards to operation-service with the query string when MIGRATE_MARKET_DATA_CHANNEL is on', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockResolvedValue({
      status: 200,
      body: { success: true, symbol: 'XAUUSD', points: [] },
    });

    const { GET } = await import('@/app/api/market-data/channel/route');
    const request = makeRequest(
      'http://localhost/api/market-data/channel?timeframe=M15'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
      request,
      '/market-data/channel?timeframe=M15'
    );
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('passes through operation-service error status/body when forwarding fails', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', tier: 'PRO' },
    });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockRejectedValue(
      new MockOperationServiceError(400, {
        success: false,
        error: 'Unsupported symbol (XAUUSD only)',
      })
    );

    const { GET } = await import('@/app/api/market-data/channel/route');
    const response = await GET(
      makeRequest('http://localhost/api/market-data/channel?symbol=EURUSD')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Unsupported symbol (XAUUSD only)');
  });
});
