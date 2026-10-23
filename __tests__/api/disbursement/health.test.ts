/**
 * Health Check API Tests (Part 19C; hardened in Next.js remediation T1-e)
 *
 * GET /api/disbursement/health answers by caller: a signed-in admin gets the
 * full diagnostic payload; anyone else gets only `{ status }` from a bare
 * `SELECT 1`, and the payment provider is never called for them.
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

// Mock constants (the rest stays real: the CODE-03 cases below use the real
// provider rules)
jest.mock('@/lib/disbursement/constants', () => ({
  ...jest.requireActual('@/lib/disbursement/constants'),
  getDefaultProvider: jest.fn().mockReturnValue('MOCK'),
  getConfiguredProviderName: jest.fn().mockReturnValue('MOCK'),
}));

// The caller's role: the real isAdmin() is covered by session.test.ts
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  isAdmin: jest.fn(),
}));

import { isAdmin } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  getConfiguredProviderName,
  getDefaultProvider,
} from '@/lib/disbursement/constants';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';

type EnvKey = 'NODE_ENV' | 'DISBURSEMENT_PROVIDER' | 'VERCEL_ENV';

// NODE_ENV is typed read-only in Next; same pattern as redirect-callback.test.ts
function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Reflect.set(process.env, key, value);
  }
}

const mockIsAdmin = isAdmin as jest.Mock;
const mockQueryRaw = prisma.$queryRaw as unknown as jest.Mock;

function healthRequest(): MockRequest {
  return new MockRequest('http://localhost:3000/api/disbursement/health');
}

describe('Health Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  describe('GET /api/disbursement/health (signed-in admin)', () => {
    beforeEach(() => {
      mockIsAdmin.mockResolvedValue(true);
    });

    it('should return health status', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('warnings');
      expect(data).toHaveProperty('provider');
    });

    it('should report healthy when all checks pass', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.healthy).toBe(true);
      expect(data.checks.database).toBe(true);
      expect(data.checks.provider).toBe(true);
    });

    it('should include pending batch count', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(typeof data.checks.pendingBatches).toBe('number');
    });

    it('should include uptime', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('authenticates against the provider and names it', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(createPaymentProvider).toHaveBeenCalledTimes(1);
      expect(data.provider).toBe('MOCK');
    });

    it('still returns the diagnostic payload, with a 503, when the database is down', async () => {
      mockQueryRaw.mockRejectedValue(new Error('db down'));
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.healthy).toBe(false);
      expect(data.checks.database).toBe(false);
      expect(data.warnings).toContain('Database connection failed');
      consoleError.mockRestore();
    });
  });

  // CODE-03 (WS-1): on the monolith the payout provider is intentionally left
  // unset in production (money-service owns payouts). That is a warning, not an
  // outage, and the provider is reported as UNCONFIGURED instead of crashing.
  describe('GET /api/disbursement/health (payout provider not configured)', () => {
    const realFactory = jest.requireActual(
      '@/lib/disbursement/providers/provider-factory'
    ) as typeof import('@/lib/disbursement/providers/provider-factory');
    const realConstants = jest.requireActual(
      '@/lib/disbursement/constants'
    ) as typeof import('@/lib/disbursement/constants');
    const saved = new Map<EnvKey, string | undefined>();
    const keys: EnvKey[] = ['NODE_ENV', 'DISBURSEMENT_PROVIDER', 'VERCEL_ENV'];

    beforeEach(() => {
      for (const key of keys) saved.set(key, process.env[key]);
      mockIsAdmin.mockResolvedValue(true);
      (createPaymentProvider as jest.Mock).mockImplementation(
        realFactory.createPaymentProvider
      );
      (getConfiguredProviderName as jest.Mock).mockImplementation(
        realConstants.getConfiguredProviderName
      );
      setEnv('NODE_ENV', 'production');
      setEnv('DISBURSEMENT_PROVIDER', undefined);
      setEnv('VERCEL_ENV', undefined);
    });

    afterEach(() => {
      for (const key of keys) setEnv(key, saved.get(key));
      (createPaymentProvider as jest.Mock).mockReset().mockReturnValue({
        authenticate: jest.fn().mockResolvedValue({ token: 'mock-token' }),
      });
      (getConfiguredProviderName as jest.Mock)
        .mockReset()
        .mockReturnValue('MOCK');
    });

    it('answers 200 with UNCONFIGURED and a warning when the provider is unset in production', async () => {
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.provider).toBe('UNCONFIGURED');
      expect(data.healthy).toBe(true);
      expect(data.checks.database).toBe(true);
      expect(data.checks.provider).toBe(false);
      expect(data.warnings).toContain('Payout provider is not configured');
      consoleWarn.mockRestore();
    });

    it('treats a named MOCK in production the same way', async () => {
      setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.provider).toBe('UNCONFIGURED');
      consoleWarn.mockRestore();
    });

    it('does not put the configuration error text in the response', async () => {
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const data = await (await GET(healthRequest() as any)).json();

      expect(JSON.stringify(data)).not.toContain('DISBURSEMENT_PROVIDER');
      consoleWarn.mockRestore();
    });

    it('is still a 503 when the database is down', async () => {
      mockQueryRaw.mockRejectedValue(new Error('db down'));
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.healthy).toBe(false);
      expect(data.provider).toBe('UNCONFIGURED');
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    });

    it('does not change the public answer for anyone else', async () => {
      mockIsAdmin.mockResolvedValue(false);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'healthy' });
    });
  });

  describe('GET /api/disbursement/health (anonymous or non-admin caller)', () => {
    beforeEach(() => {
      mockIsAdmin.mockResolvedValue(false);
    });

    it('returns only { status: "healthy" } with 200', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'healthy' });
    });

    it('returns only { status: "unhealthy" } with 503 when the database check fails, without the error', async () => {
      mockQueryRaw.mockRejectedValue(
        new Error('connect ECONNREFUSED db.internal.example:5432')
      );
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { GET } = await import('@/app/api/disbursement/health/route');

      const response = await GET(healthRequest() as any);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual({ status: 'unhealthy' });
      expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
      consoleError.mockRestore();
    });

    it('runs only the SELECT 1 check: no provider call, no counts, no provider name', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      await GET(healthRequest() as any);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(createPaymentProvider).not.toHaveBeenCalled();
      expect(getDefaultProvider).not.toHaveBeenCalled();
      expect(getConfiguredProviderName).not.toHaveBeenCalled();
      expect(prisma.paymentBatch.count).not.toHaveBeenCalled();
      expect(prisma.disbursementTransaction.count).not.toHaveBeenCalled();
      expect(prisma.riseWorksWebhookEvent.findFirst).not.toHaveBeenCalled();
    });

    it('leaks none of the diagnostic fields', async () => {
      const { GET } = await import('@/app/api/disbursement/health/route');

      const data = await (await GET(healthRequest() as any)).json();

      expect(Object.keys(data)).toEqual(['status']);
      for (const field of [
        'healthy',
        'checks',
        'warnings',
        'provider',
        'uptime',
        'timestamp',
      ]) {
        expect(data).not.toHaveProperty(field);
      }
    });
  });
});
