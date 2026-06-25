/**
 * Audit Logs API Tests (Part 19C)
 *
 * Minimal smoke tests for audit logs endpoint.
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
    // Simple URL parsing for tests
    const queryStart = url.indexOf('?');
    if (queryStart !== -1) {
      const queryString = url.slice(queryStart + 1);
      queryString.split('&').forEach((param) => {
        const [key, value] = param.split('=');
        if (key) {
          this.searchParams.set(key, value || '');
        }
      });
    }
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
    disbursementAuditLog: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'log-1',
          action: 'batch.created',
          status: 'SUCCESS',
          actor: 'admin-123',
          details: { batchNumber: 'BATCH-2024-ABC123' },
          createdAt: new Date(),
          transaction: null,
          batch: { batchNumber: 'BATCH-2024-ABC123', status: 'COMPLETED' },
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
    },
  },
}));

describe('Audit Logs API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/disbursement/audit-logs', () => {
    it('should require authentication', async () => {
      mockSession.mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/disbursement/audit-logs/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/audit-logs'
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

      const { GET } = await import('@/app/api/disbursement/audit-logs/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/audit-logs'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(401);
    });

    it('should return audit logs for admin', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      const { GET } = await import('@/app/api/disbursement/audit-logs/route');

      const request = new MockRequest(
        'http://localhost:3000/api/disbursement/audit-logs'
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('logs');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.logs)).toBe(true);
    });
  });
});
