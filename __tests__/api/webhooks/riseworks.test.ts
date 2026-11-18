/**
 * RiseWorks Webhook API Tests (Part 19C)
 *
 * Minimal smoke tests for the webhook handler. The route itself is archived
 * (F42) and answers 410 Gone; the original handler lives, unchanged, in
 * lib/disbursement/rise/archived-webhook-handler.ts, so the three original
 * tests exercise that module and a second block pins the route's 410.
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
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
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
    const { archivedRiseWorksWebhookPost: POST } = await import(
      '@/lib/disbursement/rise/archived-webhook-handler'
    );

    const request = new MockRequest(
      'http://localhost:3000/api/webhooks/riseworks',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ event: 'payment.completed' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Missing signature');
  });

  it('should reject request with invalid signature', async () => {
    const { archivedRiseWorksWebhookPost: POST } = await import(
      '@/lib/disbursement/rise/archived-webhook-handler'
    );

    const request = new MockRequest(
      'http://localhost:3000/api/webhooks/riseworks',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-rise-signature': 'invalid-signature',
        },
        body: JSON.stringify({ event: 'payment.completed' }),
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Invalid signature');
  });

  it('should reject request with invalid JSON', async () => {
    const { archivedRiseWorksWebhookPost: POST } = await import(
      '@/lib/disbursement/rise/archived-webhook-handler'
    );

    // Create valid signature for invalid JSON
    const crypto = await import('crypto');
    const payload = 'not valid json';
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(payload, 'utf8')
      .digest('hex');

    const request = new MockRequest(
      'http://localhost:3000/api/webhooks/riseworks',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-rise-signature': signature,
        },
        body: payload,
      }
    );

    const response = await POST(request as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON');
  });
});

describe('RiseWorks webhook route (archived, F42)', () => {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env['NODE_ENV'];

  const cases: Array<{
    name: string;
    secret?: string;
    nodeEnv: string;
    signature?: string;
  }> = [
    {
      name: 'a secret is set and the request is signed',
      secret: 'test-secret',
      nodeEnv: 'test',
      signature: 'any-signature',
    },
    {
      name: 'a secret is set and the request is unsigned',
      secret: 'test-secret',
      nodeEnv: 'test',
    },
    {
      name: 'no secret is set in development and the request is unsigned',
      nodeEnv: 'development',
    },
    {
      name: 'no secret is set in production and the request is signed',
      nodeEnv: 'production',
      signature: 'any-signature',
    },
  ];

  // Every mocked database method, whichever model it belongs to.
  function expectNoDatabaseCalls(db: unknown): void {
    for (const model of Object.values(db as Record<string, object>)) {
      for (const method of Object.values(model)) {
        if (jest.isMockFunction(method)) {
          expect(method).not.toHaveBeenCalled();
        }
      }
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete env['RISE_WEBHOOK_SECRET'];
    env['NODE_ENV'] = nodeEnv;
  });

  it.each(cases)(
    'answers 410 Gone without reading the body or using the database when $name',
    async ({ secret, nodeEnv: mode, signature }) => {
      if (secret) env['RISE_WEBHOOK_SECRET'] = secret;
      env['NODE_ENV'] = mode;

      const { POST } = await import('@/app/api/webhooks/riseworks/route');
      const { prisma } = await import('@/lib/db/prisma');

      const request = new MockRequest(
        'http://localhost:3000/api/webhooks/riseworks',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(signature ? { 'x-rise-signature': signature } : {}),
          },
          body: JSON.stringify({ event: 'payment.completed' }),
        }
      );
      const readBody = jest.spyOn(request, 'text');

      const response = await POST(request as any);

      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'RiseWorks webhook endpoint is archived',
      });
      expect(readBody).not.toHaveBeenCalled();
      expectNoDatabaseCalls(prisma);
    }
  );
});
