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
    set(key: string, value: string) { this.headers.set(key.toLowerCase(), value); }
    get(key: string) { return this.headers.get(key.toLowerCase()); }
    has(key: string) { return this.headers.has(key.toLowerCase()); }
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

    it('should return FREE tier symbols for FREE user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('FREE');
      expect(data.count).toBe(5);
      expect(data.symbols).toContain('XAUUSD');
      expect(data.symbols).toContain('BTCUSD');
      expect(data.symbols).toContain('EURUSD');
      expect(data.symbols).not.toContain('GBPUSD'); // PRO only
    });

    it('should return PRO tier symbols for PRO user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('PRO');
      expect(data.count).toBe(15);
      expect(data.symbols).toContain('GBPUSD');
      expect(data.symbols).toContain('ETHUSD');
      expect(data.symbols).toContain('NDX100');
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
      expect(data.count).toBe(5);
    });

    it('should include symbol metadata', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(data.symbolsInfo).toBeDefined();
      expect(data.symbolsInfo.length).toBe(5);

      // Check symbol info structure
      const goldSymbol = data.symbolsInfo.find(
        (s: { symbol: string }) => s.symbol === 'XAUUSD'
      );
      expect(goldSymbol).toBeDefined();
      expect(goldSymbol.name).toBe('Gold/US Dollar');
      expect(goldSymbol.category).toBe('commodity');
      expect(goldSymbol.proOnly).toBe(false);
    });

    it('should show totalAvailable count', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getSymbols();
      const data = await response.json();

      expect(data.totalAvailable).toBe(15); // Total PRO symbols
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

    it('should return FREE tier combinations for FREE user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('FREE');
      expect(data.count).toBe(15); // 5 symbols × 3 timeframes
      expect(data.combinations).toHaveLength(15);
    });

    it('should return PRO tier combinations for PRO user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tier).toBe('PRO');
      expect(data.count).toBe(135); // 15 symbols × 9 timeframes
      expect(data.combinations).toHaveLength(135);
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

    it('should include limits in response', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.limits).toBeDefined();
      expect(data.limits.symbolCount).toBe(5);
      expect(data.limits.timeframeCount).toBe(3);
      expect(data.limits.totalCombinations).toBe(15);
    });

    it('should include upgrade info for FREE users', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.upgrade).toBeDefined();
      expect(data.upgrade.additionalSymbols).toBe(10); // 15 - 5
      expect(data.upgrade.additionalTimeframes).toBe(6); // 9 - 3
      expect(data.upgrade.additionalCombinations).toBe(120); // 135 - 15
      expect(data.upgrade.message).toContain('Upgrade to PRO');
    });

    it('should not include upgrade info for PRO users', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'PRO' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.upgrade).toBeUndefined();
    });

    it('should include timeframe metadata', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-123', tier: 'FREE' },
        expires: '2025-12-31',
      });

      const response = await getCombinations();
      const data = await response.json();

      expect(data.timeframes).toBeDefined();
      expect(data.timeframes).toHaveLength(3); // FREE has 3 timeframes

      const h1 = data.timeframes.find(
        (tf: { value: string }) => tf.value === 'H1'
      );
      expect(h1).toBeDefined();
      expect(h1.label).toBe('1 Hour');
      expect(h1.proOnly).toBe(false);
    });
  });
});
