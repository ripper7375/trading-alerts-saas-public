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
    systemConfig: {
      findMany: jest.fn().mockResolvedValue([]),
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

type EnvKey = 'NODE_ENV' | 'DISBURSEMENT_PROVIDER' | 'VERCEL_ENV';

// NODE_ENV is typed read-only in Next; same pattern as redirect-callback.test.ts
function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Reflect.set(process.env, key, value);
  }
}

// CODE-03 (WS-1): the mock provider exists only in development and test; in
// production the route refuses before it reads or writes anything.
describe('Quick Payment API — payout provider fails closed (CODE-03)', () => {
  const keys: EnvKey[] = ['NODE_ENV', 'DISBURSEMENT_PROVIDER', 'VERCEL_ENV'];
  const saved = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of keys) saved.set(key, process.env[key]);
    setEnv('NODE_ENV', 'production');
    setEnv('DISBURSEMENT_PROVIDER', undefined);
    setEnv('VERCEL_ENV', undefined);
    mockSession.mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
  });

  afterEach(() => {
    for (const key of keys) setEnv(key, saved.get(key));
    // the suites below assert on call counts of the shared prisma mock
    jest.clearAllMocks();
    mockSession.mockReset();
  });

  const payRequest = (body: Record<string, unknown>): MockRequest =>
    new MockRequest('http://localhost:3000/api/disbursement/pay', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  it.each([
    [
      'no provider named (the route defaults to MOCK)',
      { affiliateId: 'aff-1' },
    ],
    ['MOCK named', { affiliateId: 'aff-1', provider: 'MOCK' }],
  ])(
    'refuses with a generic 503 and writes nothing: %s',
    async (_name, body) => {
      const { POST } = await import('@/app/api/disbursement/pay/route');
      const { prisma } = await import('@/lib/db/prisma');
      const { createPaymentProvider } = await import(
        '@/lib/disbursement/providers/provider-factory'
      );
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const response = await POST(payRequest(body) as never);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: 'Disbursement is not configured',
      });
      expect(prisma.affiliateProfile.findUnique).not.toHaveBeenCalled();
      expect(prisma.commission.findMany).not.toHaveBeenCalled();
      expect(prisma.paymentBatch.create).not.toHaveBeenCalled();
      expect(prisma.paymentBatch.update).not.toHaveBeenCalled();
      expect(prisma.disbursementTransaction.create).not.toHaveBeenCalled();
      expect(createPaymentProvider).not.toHaveBeenCalled();
      consoleError.mockRestore();
    }
  );

  it('refuses on Preview too, where NODE_ENV is production', async () => {
    setEnv('VERCEL_ENV', 'preview');
    const { POST } = await import('@/app/api/disbursement/pay/route');
    const { prisma } = await import('@/lib/db/prisma');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await POST(
      payRequest({ affiliateId: 'aff-1', provider: 'MOCK' }) as never
    );

    expect(response.status).toBe(503);
    expect(prisma.paymentBatch.create).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('does not refuse in test, where MOCK is allowed (it goes on to look the affiliate up)', async () => {
    setEnv('NODE_ENV', 'test');
    const { POST } = await import('@/app/api/disbursement/pay/route');
    const { prisma } = await import('@/lib/db/prisma');
    (prisma.affiliateProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      payRequest({ affiliateId: 'aff-1', provider: 'MOCK' }) as never
    );

    expect(response.status).toBe(404);
    expect(prisma.affiliateProfile.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('Quick Payment API — pause gate (E10, DECISION-LOG F83)', () => {
  it('returns 409 DISBURSEMENTS_PAUSED while payouts are paused, before any payout work', async () => {
    const { POST } = await import('@/app/api/disbursement/pay/route');
    const { prisma } = await import('@/lib/db/prisma');
    mockSession.mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValueOnce([
      { key: 'disbursement_enabled', value: 'false' },
    ]);

    const request = new MockRequest(
      'http://localhost:3000/api/disbursement/pay',
      {
        method: 'POST',
        body: JSON.stringify({ affiliateId: 'aff-123' }),
      }
    );
    const response = await POST(request as never);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Disbursements are paused',
      code: 'DISBURSEMENTS_PAUSED',
    });
    expect(prisma.affiliateProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentBatch.create).not.toHaveBeenCalled();
  });
});
