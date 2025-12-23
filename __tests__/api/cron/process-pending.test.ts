/**
 * Cron Job API Tests (Part 19C)
 *
 * Minimal smoke tests for cron job endpoints.
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
    this.method = options?.method || 'POST';
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
    commission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    paymentBatch: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('Cron Job API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CRON_SECRET'] = 'test-cron-secret';
  });

  afterEach(() => {
    delete process.env['CRON_SECRET'];
  });

  describe('POST /api/cron/process-pending-disbursements', () => {
    it('should require cron secret', async () => {
      const { POST } = await import(
        '@/app/api/cron/process-pending-disbursements/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/cron/process-pending-disbursements',
        {
          method: 'POST',
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject invalid cron secret', async () => {
      const { POST } = await import(
        '@/app/api/cron/process-pending-disbursements/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/cron/process-pending-disbursements',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer wrong-secret',
          },
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept valid cron secret', async () => {
      const { POST } = await import(
        '@/app/api/cron/process-pending-disbursements/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/cron/process-pending-disbursements',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer test-cron-secret',
          },
        }
      );

      const response = await POST(request as any);
      // Even if no affiliates to process, should return success
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('result');
    });

    it('should handle missing CRON_SECRET env var', async () => {
      delete process.env['CRON_SECRET'];

      // Clear module cache to pick up new env
      jest.resetModules();

      const { POST } = await import(
        '@/app/api/cron/process-pending-disbursements/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/cron/process-pending-disbursements',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer some-secret',
          },
        }
      );

      const response = await POST(request as any);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Cron job not configured');
    });
  });

  describe('GET /api/cron/process-pending-disbursements', () => {
    it('should return endpoint information', async () => {
      const { GET } = await import(
        '@/app/api/cron/process-pending-disbursements/route'
      );

      const request = new MockRequest(
        'http://localhost:3000/api/cron/process-pending-disbursements',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.endpoint).toBe('/api/cron/process-pending-disbursements');
      expect(data.method).toBe('POST');
      expect(data.status).toBe('configured');
    });
  });
});
