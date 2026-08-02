/**
 * operation-service Alerts CRUD write-API transport tests (Session 4B-6)
 *
 * Covers lib/operation-service/flags.ts's shouldUseOperationServiceForAlertsCrud()
 * and lib/operation-service/write-routes.ts's forwardRequestToOperationService().
 *
 * @module __tests__/lib/operation-service/write-routes.test
 */

const mockGetOperationServiceToken = jest.fn();
class MockOperationServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
const mockCallOperationServiceWithTokenStatus = jest.fn();
jest.mock('@/lib/operation-service/client', () => ({
  __esModule: true,
  OperationServiceError: MockOperationServiceError,
  getOperationServiceToken: () => mockGetOperationServiceToken(),
  callOperationServiceWithTokenStatus: (...args: unknown[]) =>
    mockCallOperationServiceWithTokenStatus(...args),
  // Real implementation (pure, no dependencies) — Session 4B-11 wired this
  // into the forwarder so operation-service sees the real caller's
  // user-agent/IP instead of the monolith's own outbound request's.
  forwardedRequestContext: jest.requireActual('@/lib/operation-service/client')
    .forwardedRequestContext,
}));

function makeRequest(opts: {
  method?: string;
  body?: string;
  correlationId?: string;
  userAgent?: string;
  forwardedFor?: string;
}): {
  method: string;
  headers: Headers;
  text: () => Promise<string>;
} {
  const headers = new Headers();
  if (opts.correlationId) headers.set('x-correlation-id', opts.correlationId);
  if (opts.userAgent) headers.set('user-agent', opts.userAgent);
  if (opts.forwardedFor) headers.set('x-forwarded-for', opts.forwardedFor);
  return {
    method: opts.method ?? 'GET',
    headers,
    text: async () => opts.body ?? '',
  };
}

describe('shouldUseOperationServiceForAlertsCrud', () => {
  const ENV_KEY = 'MIGRATE_ALERTS_CRUD';
  const originalEnv = { ...process.env };

  afterEach(() => {
    delete process.env[ENV_KEY];
    process.env = { ...originalEnv };
  });

  it('defaults false, reads MIGRATE_ALERTS_CRUD', async () => {
    delete process.env[ENV_KEY];
    const flags = await import('@/lib/operation-service/flags');
    expect(flags.shouldUseOperationServiceForAlertsCrud()).toBe(false);

    process.env[ENV_KEY] = 'true';
    jest.resetModules();
    const reloaded = await import('@/lib/operation-service/flags');
    expect(reloaded.shouldUseOperationServiceForAlertsCrud()).toBe(true);
  });
});

describe('forwardRequestToOperationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOperationServiceToken.mockResolvedValue('test-token');
  });

  it('throws a 401 OperationServiceError when no session token is available', async () => {
    mockGetOperationServiceToken.mockResolvedValue(null);
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await expect(
      forwardRequestToOperationService(makeRequest({}) as never, '/alerts')
    ).rejects.toMatchObject({ status: 401 });

    expect(mockCallOperationServiceWithTokenStatus).not.toHaveBeenCalled();
  });

  it('forwards the Bearer token, method, and raw body for POST', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 201,
      body: { id: 'a1' },
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    const result = await forwardRequestToOperationService(
      makeRequest({
        method: 'POST',
        body: '{"symbol":"XAUUSD"}',
      }) as never,
      '/alerts'
    );

    expect(result).toEqual({ status: 201, body: { id: 'a1' } });
    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/alerts',
      'test-token',
      expect.objectContaining({
        method: 'POST',
        body: '{"symbol":"XAUUSD"}',
      })
    );
  });

  it('defaults method to the incoming request method when not overridden', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: { alerts: [] },
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(
      makeRequest({ method: 'GET' }) as never,
      '/alerts?status=active'
    );

    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/alerts?status=active',
      'test-token',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('omits the body for a GET/DELETE request even if the stream has content', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: { success: true },
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(
      makeRequest({ method: 'DELETE' }) as never,
      '/alerts/a1'
    );

    const callArgs = mockCallOperationServiceWithTokenStatus.mock.calls[0]?.[2];
    expect(callArgs).not.toHaveProperty('body');
  });

  it('propagates the x-correlation-id header when present', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: {},
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(
      makeRequest({ correlationId: 'req-123' }) as never,
      '/alerts'
    );

    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/alerts',
      'test-token',
      expect.objectContaining({
        headers: { 'x-correlation-id': 'req-123' },
      })
    );
  });

  it('sends no x-correlation-id header when the client sent none', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: {},
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(makeRequest({}) as never, '/alerts');

    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/alerts',
      'test-token',
      expect.objectContaining({ headers: {} })
    );
  });

  it('propagates the real caller user-agent and x-forwarded-for to operation-service (Session 4B-11)', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: {},
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(
      makeRequest({
        userAgent: 'Mozilla/5.0 Chrome/120',
        forwardedFor: '203.0.113.7',
      }) as never,
      '/user/sessions'
    );

    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/user/sessions',
      'test-token',
      expect.objectContaining({
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
          'x-forwarded-for': '203.0.113.7',
        },
      })
    );
  });

  it('respects a custom HTTP method override', async () => {
    mockCallOperationServiceWithTokenStatus.mockResolvedValue({
      status: 200,
      body: { ok: true },
    });
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await forwardRequestToOperationService(
      makeRequest({ method: 'PATCH', body: '{}' }) as never,
      '/alerts/line/a1',
      { method: 'PATCH' }
    );

    expect(mockCallOperationServiceWithTokenStatus).toHaveBeenCalledWith(
      '/alerts/line/a1',
      'test-token',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('propagates a non-2xx OperationServiceError from operation-service untouched', async () => {
    mockCallOperationServiceWithTokenStatus.mockRejectedValue(
      new MockOperationServiceError(404, { error: 'Alert not found' })
    );
    const { forwardRequestToOperationService } = await import(
      '@/lib/operation-service/write-routes'
    );

    await expect(
      forwardRequestToOperationService(
        makeRequest({ method: 'GET' }) as never,
        '/alerts/nonexistent'
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
