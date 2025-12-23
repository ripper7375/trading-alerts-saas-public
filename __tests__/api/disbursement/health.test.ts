/**
 * Health Check API Tests (Part 19C)
 *
 * Minimal smoke tests for health check endpoint.
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
    options?: { method?: string; headers?: Record<string, string> }
  ) {
    this.url = url;
    this.method = options?.method || 'GET';
    this.headers = new MockHeaders(options?.headers);
  }
}

global.Headers = MockHeaders as unknown as typeof Headers;
global.Request = MockRequest as unknown as typeof Request;

// Mock NextResponse
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
  NextRequest: MockRequest,
}));

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    paymentBatch: {
      count: jest.fn().mockResolvedValue(2),
    },
    disbursementTransaction: {
      count: jest.fn().mockResolvedValue(5),
    },
    riseWorksWebhookEvent: {
      findFirst: jest.fn().mockResolvedValue({
        receivedAt: new Date(),
      }),
    },
  },
}));

// Mock provider factory
jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  createPaymentProvider: jest.fn().mockReturnValue({
    authenticate: jest.fn().mockResolvedValue({ token: 'mock-token' }),
  }),
}));

// Mock constants
jest.mock('@/lib/disbursement/constants', () => ({
  getDefaultProvider: jest.fn().mockReturnValue('MOCK'),
}));

describe('Health Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/disbursement/health', () => {
    it('should return health status', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/health'
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('warnings');
      expect(data).toHaveProperty('provider');
    });

    it('should report healthy when all checks pass', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/health'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.healthy).toBe(true);
      expect(data.checks.database).toBe(true);
      expect(data.checks.provider).toBe(true);
    });

    it('should include pending batch count', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/health'
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(typeof data.checks.pendingBatches).toBe('number');
    });

    it('should include uptime', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/health'
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
