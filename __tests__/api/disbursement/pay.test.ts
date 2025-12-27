/**
 * Quick Payment API Tests (Part 19C)
 *
 * Minimal smoke tests for quick payment endpoint.
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
  private bodyData: unknown;

  constructor(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ) {
    this.url = url;
    this.method = options?.method || 'POST';
    this.headers = new MockHeaders(options?.headers);
    this.bodyData = options?.body ? JSON.parse(options.body) : {};
  }

  async json(): Promise<unknown> {
    return this.bodyData;
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
    affiliateProfile: {
      findUnique: jest.fn(),
    },
    commission: {
      findMany: jest.fn(),
    },
    paymentBatch: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    disbursementTransaction: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
  },
}));

// Mock provider factory
jest.mock('@/lib/disbursement/providers/provider-factory', () => ({
  createPaymentProvider: jest.fn(),
}));

describe('Quick Payment API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should require authentication', async () => {
    mockSession.mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/disbursement/pay/route');

    const request = new MockRequest(
      'http://localhost:3000/api/disbursement/pay',
      {
        method: 'POST',
        body: JSON.stringify({ affiliateId: 'aff-123' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should require admin role', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: 'user-123', role: 'USER' },
    });

    const { POST } = await import('@/app/api/disbursement/pay/route');

    const request = new MockRequest(
      'http://localhost:3000/api/disbursement/pay',
      {
        method: 'POST',
        body: JSON.stringify({ affiliateId: 'aff-123' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it('should require affiliateId', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const { POST } = await import('@/app/api/disbursement/pay/route');

    const request = new MockRequest(
      'http://localhost:3000/api/disbursement/pay',
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'MOCK' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('affiliateId is required');
  });

  it('should reject invalid provider', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const { POST } = await import('@/app/api/disbursement/pay/route');

    const request = new MockRequest(
      'http://localhost:3000/api/disbursement/pay',
      {
        method: 'POST',
        body: JSON.stringify({ affiliateId: 'aff-123', provider: 'INVALID' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid provider. Must be MOCK or RISE');
  });
});
