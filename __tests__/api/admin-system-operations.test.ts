/**
 * Admin System Operations API Route Tests (Session 6-11, B2-14..17)
 *
 * Covers the 3 new server-side routes: the flask-api reachability check
 * (GET /api/admin/system/terminals), the money-service cron trigger proxy
 * (POST /api/admin/system/jobs/[jobId]/trigger), and the outbox bulk-retry
 * action (POST /api/admin/system/outbox/retry).
 *
 * @module __tests__/api/admin-system-operations.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

class MockAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
jest.mock('@/lib/auth/errors', () => ({
  __esModule: true,
  AuthError: MockAuthError,
}));

const mockOutboxUpdateMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    outboxEvent: {
      updateMany: (...args: unknown[]) => mockOutboxUpdateMany(...args),
    },
  },
}));

const mockCallMoneyService = jest.fn();
class MockMoneyServiceError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string }
  ) {
    super(body.message ?? 'money-service error');
  }
}
jest.mock('@/lib/money-service/client', () => ({
  __esModule: true,
  callMoneyService: (...args: unknown[]) => mockCallMoneyService(...args),
  MoneyServiceError: MockMoneyServiceError,
}));

// Session 7-2 Step 1: the trigger route now calls createMoneyApi/
// unwrapMoneyApi instead of callMoneyService directly. Mock only
// createMoneyApi's returned client's POST method -- unwrapMoneyApi is the
// REAL implementation (jest.requireActual), so it still throws the real
// (mocked-class) MoneyServiceError on a non-ok response, same as production.
const mockMoneyApiPost = jest.fn();
const mockCreateMoneyApi = jest.fn(() => ({
  POST: (...args: unknown[]) => mockMoneyApiPost(...args),
}));
jest.mock('@/lib/api/generated/money-api/client', () => {
  const actual = jest.requireActual('@/lib/api/generated/money-api/client');
  return {
    __esModule: true,
    createMoneyApi: (...args: unknown[]) => mockCreateMoneyApi(...args),
    unwrapMoneyApi: (actual as { unwrapMoneyApi: unknown }).unwrapMoneyApi,
  };
});

describe('GET /api/admin/system/terminals', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['MT5_ADMIN_API_KEY'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 403 when not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { GET } = await import('@/app/api/admin/system/terminals/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.status).toBe('restricted');
  });

  it('returns not_configured when MT5_ADMIN_API_KEY is unset, without calling flask-api', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    global.fetch = jest.fn();

    const { GET } = await import('@/app/api/admin/system/terminals/route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('not_configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns offline when flask-api is unreachable', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    process.env['MT5_ADMIN_API_KEY'] = 'test-key';
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const { GET } = await import('@/app/api/admin/system/terminals/route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('offline');
  });

  it('returns restricted when flask-api rejects the admin key', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    process.env['MT5_ADMIN_API_KEY'] = 'wrong-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    const { GET } = await import('@/app/api/admin/system/terminals/route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('restricted');
  });

  it('returns online with real health data on success', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    process.env['MT5_ADMIN_API_KEY'] = 'real-key';
    const health = {
      status: 'ok',
      version: '6.0.0',
      total_terminals: 1,
      connected_terminals: 1,
      terminals: {},
    };
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, json: async () => health });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const { GET } = await import('@/app/api/admin/system/terminals/route');
    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('online');
    expect(body.health).toEqual(health);
    expect(body.stats).toBeNull();
  });
});

describe('POST /api/admin/system/jobs/[jobId]/trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CRON_SECRET'] = 'test-cron-secret';
  });

  it('rejects an unknown job id', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });

    const { POST } = await import(
      '@/app/api/admin/system/jobs/[jobId]/trigger/route'
    );
    const response = await POST({} as Request, {
      params: Promise.resolve({ jobId: 'not-a-real-job' }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Unknown job id');
    expect(mockMoneyApiPost).not.toHaveBeenCalled();
  });

  it('forwards a known job to money-service (v1-prefixed) with the Bearer CRON_SECRET', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    mockMoneyApiPost.mockResolvedValue({
      data: { count: 2 },
      response: { ok: true, status: 200 },
    });

    const { POST } = await import(
      '@/app/api/admin/system/jobs/[jobId]/trigger/route'
    );
    const response = await POST({} as Request, {
      params: Promise.resolve({ jobId: 'expire-codes' }),
    });
    const body = await response.json();

    // Session 7-2 Deviation 1: money-service's real global prefix is `v1`
    // (CronTriggerController is not excluded from it) -- the pre-7-2 route
    // called the un-prefixed path, which almost certainly 404'd live.
    expect(mockCreateMoneyApi).toHaveBeenCalledWith('test-cron-secret');
    expect(mockMoneyApiPost).toHaveBeenCalledWith(
      '/v1/cron-trigger/expire-codes',
      {}
    );
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toEqual({ count: 2 });
  });

  it('maps a MoneyServiceError to its real status and message', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    mockMoneyApiPost.mockResolvedValue({
      error: { message: 'Unauthorized' },
      response: { ok: false, status: 401 },
    });

    const { POST } = await import(
      '@/app/api/admin/system/jobs/[jobId]/trigger/route'
    );
    const response = await POST({} as Request, {
      params: Promise.resolve({ jobId: 'daily-maintenance' }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});

describe('POST /api/admin/system/outbox/retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when not an admin', async () => {
    mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

    const { POST } = await import('@/app/api/admin/system/outbox/retry/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(mockOutboxUpdateMany).not.toHaveBeenCalled();
  });

  it('resets every FAILED row to PENDING with a fresh attempt budget', async () => {
    mockRequireAdmin.mockResolvedValue({ user: { role: 'ADMIN' } });
    mockOutboxUpdateMany.mockResolvedValue({ count: 4 });

    const { POST } = await import('@/app/api/admin/system/outbox/retry/route');
    const response = await POST();
    const body = await response.json();

    expect(mockOutboxUpdateMany).toHaveBeenCalledWith({
      where: { status: 'FAILED' },
      data: { status: 'PENDING', attemptCount: 0, lastError: null },
    });
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, retried: 4 });
  });
});
