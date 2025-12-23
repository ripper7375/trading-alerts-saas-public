/**
 * Reports API Tests (Part 19C)
 *
 * Minimal smoke tests for reports endpoints.
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

class MockURL {
  searchParams: Map<string, string>;

  constructor(url: string) {
    this.searchParams = new Map();
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      this.searchParams.set(key, value);
    });
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
global.URL = MockURL as unknown as typeof URL;

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

// Mock getServerSession
const mockSession = jest.fn();
jest.mock('next-auth', () => ({
  getServerSession: () => mockSession(),
}));

// Mock auth options
jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}));

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      count: jest.fn().mockResolvedValue(5),
    },
    disbursementTransaction: {
      count: jest.fn().mockResolvedValue(10),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500 } }),
    },
    commission: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { commissionAmount: 100 } }),
    },
  },
}));

describe('Reports API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/disbursement/reports/summary', () => {
    it('should require authentication', async () => {
      mockSession.mockResolvedValueOnce(null);

      const { GET } = await import(
        '@/app/api/disbursement/reports/summary/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/reports/summary'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should require admin role', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-123', role: 'USER' },
      });

      const { GET } = await import(
        '@/app/api/disbursement/reports/summary/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/reports/summary'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(401);
    });

    it('should return disbursement summary for admin', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      const { GET } = await import(
        '@/app/api/disbursement/reports/summary/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/reports/summary'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('batches');
      expect(data.summary).toHaveProperty('transactions');
      expect(data.summary).toHaveProperty('amounts');
    });
  });
});
