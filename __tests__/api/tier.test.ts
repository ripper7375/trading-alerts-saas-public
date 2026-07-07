/**
 * E2E Tests: Tier API Routes
 * Tests /api/tier/* endpoints
 */

import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

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

// Mock Headers if not available
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

// Mock next-auth
const mockGetServerSession = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock NextResponse to avoid next/server issues
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

// Import after mocks
import { GET as getSymbols } from '@/app/api/tier/symbols/route';
import { GET as getCombinations } from '@/app/api/tier/combinations/route';

describe('Tier API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tier/symbols', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return XAUUSD for FREE user (V8: identical for both tiers)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('FREE');
      expect(data.count).toBe(1);
      expect(data.symbols).toEqual(['XAUUSD']);
    });

    it('should return XAUUSD for PRO user (V8: identical for both tiers)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('PRO');
      expect(data.count).toBe(1);
      expect(data.symbols).toEqual(['XAUUSD']);
    });

    it('should default to FREE tier when tier not specified', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123' }, // No tier specified
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('FREE');
      expect(data.count).toBe(1);
    });

    it('should include symbol metadata', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(data.symbolsInfo).toBeDefined();
      expect(data.symbolsInfo.length).toBe(1);

      // Check symbol info structure
      const goldSymbol = data.symbolsInfo.find(
        (s: { symbol: string }) => s.symbol === 'XAUUSD'
      );
      expect(goldSymbol).toBeDefined();
      expect(goldSymbol.name).toBe('Gold/US Dollar');
      expect(goldSymbol.category).toBe('commodity');
      expect(goldSymbol.proOnly).toBe(false);
    });

    it('should show totalAvailable count (V8: 1)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(data.totalAvailable).toBe(1);
    });
  });

  describe('GET /api/tier/combinations', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await getCombinations();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return the 2 combinations for FREE user (V8)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('FREE');
      expect(data.count).toBe(2); // XAUUSD x M5/M15
      expect(data.combinations).toEqual([
        { symbol: 'XAUUSD', timeframe: 'M5' },
        { symbol: 'XAUUSD', timeframe: 'M15' },
      ]);
    });

    it('should return the same 2 combinations for PRO user (V8)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('PRO');
      expect(data.count).toBe(2);
      expect(data.combinations).toHaveLength(2);
    });

    it('should return correct combination structure', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      // Check combination structure
      const firstCombination = data.combinations[0];
      expect(firstCombination).toHaveProperty('symbol');
      expect(firstCombination).toHaveProperty('timeframe');
    });

    it('should include limits in response (V8)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.limits).toBeDefined();
      expect(data.limits.symbolCount).toBe(1);
      expect(data.limits.timeframeCount).toBe(2);
      expect(data.limits.totalCombinations).toBe(2);
    });

    it('should NOT include upgrade info (V8: chart access is not gated)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.upgrade).toBeUndefined();
    });

    it('should include timeframe metadata (V8: M5/M15)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.timeframes).toBeDefined();
      expect(data.timeframes).toHaveLength(2);

      const m5 = data.timeframes.find(
        (tf: { value: string }) => tf.value === 'M5'
      );
      expect(m5).toBeDefined();
      expect(m5.label).toBe('5 Minutes');
      expect(m5.proOnly).toBe(false);
    });
  });
});
