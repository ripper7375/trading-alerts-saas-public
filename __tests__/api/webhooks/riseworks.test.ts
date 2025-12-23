/**
 * RiseWorks Webhook API Tests (Part 19C)
 *
 * Minimal smoke tests for webhook endpoint.
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
  private bodyText: string;

  constructor(
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.url = url;
    this.method = options?.method || 'POST';
    this.headers = new MockHeaders(options?.headers);
    this.bodyText = options?.body || '';
  }

  async text(): Promise<string> {
    return this.bodyText;
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
    riseWorksWebhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-123' }),
      update: jest.fn().mockResolvedValue({}),
    },
    disbursementTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    commission: {
      update: jest.fn().mockResolvedValue({}),
    },
    affiliateRiseAccount: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    disbursementAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('RiseWorks Webhook API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['RISE_WEBHOOK_SECRET'] = 'test-secret';
  });

  afterEach(() => {
    delete process.env['RISE_WEBHOOK_SECRET'];
  });

  it('should reject request with missing signature', async () => {
    const { POST } = await import(
      '@/app/api/webhooks/riseworks/route'
    );

    const request = new MockRequest('http://localhost:3000/api/webhooks/riseworks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'payment.completed' }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Missing signature');
  });

  it('should reject request with invalid signature', async () => {
    const { POST } = await import(
      '@/app/api/webhooks/riseworks/route'
    );

    const request = new MockRequest('http://localhost:3000/api/webhooks/riseworks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rise-signature': 'invalid-signature',
      },
      body: JSON.stringify({ event: 'payment.completed' }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Invalid signature');
  });

  it('should reject request with invalid JSON', async () => {
    const { POST } = await import(
      '@/app/api/webhooks/riseworks/route'
    );

    // Create valid signature for invalid JSON
    const crypto = await import('crypto');
    const payload = 'not valid json';
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(payload, 'utf8')
      .digest('hex');

    const request = new MockRequest('http://localhost:3000/api/webhooks/riseworks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rise-signature': signature,
      },
      body: payload,
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON');
  });
});
