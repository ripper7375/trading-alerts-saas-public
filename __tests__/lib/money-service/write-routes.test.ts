/**
 * Money-service write-API transport tests (Session 4A-10a, Step 1)
 *
 * Covers lib/money-service/flags.ts's 4 new write flags and
 * lib/money-service/write-routes.ts's forwardWriteRequestToMoneyService().
 *
 * @module __tests__/lib/money-service/write-routes.test
 */

const mockGetMoneyServiceToken = jest.fn();
jest.mock('@/lib/money-service/routes', () => ({
  __esModule: true,
  getMoneyServiceToken: () => mockGetMoneyServiceToken(),
}));

class MockMoneyServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
const mockCallMoneyServiceWithToken = jest.fn();
jest.mock('@/lib/money-service/client', () => ({
  __esModule: true,
  MoneyServiceError: MockMoneyServiceError,
  callMoneyServiceWithToken: (...args: unknown[]) =>
    mockCallMoneyServiceWithToken(...args),
}));

function makeRequest(opts: { body?: string; idempotencyKey?: string }): {
  headers: Headers;
  text: () => Promise<string>;
} {
  const headers = new Headers();
  if (opts.idempotencyKey) headers.set('Idempotency-Key', opts.idempotencyKey);
  return {
    headers,
    text: async () => opts.body ?? '',
  };
}

describe('money-service write flags', () => {
  const ENV_KEYS = [
    'MIGRATE_WRITE_APIS_MONEY_STRIPE',
    'MIGRATE_WRITE_APIS_MONEY_DLOCAL',
    'MIGRATE_WRITE_APIS_MONEY_ADMIN',
    'MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT',
  ] as const;
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env = { ...originalEnv };
  });

  it.each([
    ['shouldUseMoneyServiceForStripeWrite', 'MIGRATE_WRITE_APIS_MONEY_STRIPE'],
    ['shouldUseMoneyServiceForDlocalWrite', 'MIGRATE_WRITE_APIS_MONEY_DLOCAL'],
    ['shouldUseMoneyServiceForAdminWrite', 'MIGRATE_WRITE_APIS_MONEY_ADMIN'],
    [
      'shouldUseMoneyServiceForDisbursementWrite',
      'MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT',
    ],
  ] as const)('%s defaults false, reads %s', async (fnName, envKey) => {
    delete process.env[envKey];
    const flags = await import('@/lib/money-service/flags');
    expect((flags[fnName] as () => boolean)()).toBe(false);

    process.env[envKey] = 'true';
    jest.resetModules();
    const reloaded = await import('@/lib/money-service/flags');
    expect((reloaded[fnName] as () => boolean)()).toBe(true);
  });
});

describe('forwardWriteRequestToMoneyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMoneyServiceToken.mockResolvedValue('test-token');
  });

  it('throws a 401 MoneyServiceError when no session token is available', async () => {
    mockGetMoneyServiceToken.mockResolvedValue(null);
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await expect(
      forwardWriteRequestToMoneyService(
        makeRequest({}) as never,
        '/v1/stripe/checkout'
      )
    ).rejects.toMatchObject({ status: 401 });

    expect(mockCallMoneyServiceWithToken).not.toHaveBeenCalled();
  });

  it('forwards the Bearer token, method, and raw body', async () => {
    mockCallMoneyServiceWithToken.mockResolvedValue({ ok: true });
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    const result = await forwardWriteRequestToMoneyService(
      makeRequest({ body: '{"affiliateCode":"ABC"}' }) as never,
      '/v1/stripe/checkout'
    );

    expect(result).toEqual({ ok: true });
    expect(mockCallMoneyServiceWithToken).toHaveBeenCalledWith(
      '/v1/stripe/checkout',
      'test-token',
      expect.objectContaining({
        method: 'POST',
        body: '{"affiliateCode":"ABC"}',
      })
    );
  });

  it('propagates the Idempotency-Key header when present', async () => {
    mockCallMoneyServiceWithToken.mockResolvedValue({ ok: true });
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await forwardWriteRequestToMoneyService(
      makeRequest({ body: '{}', idempotencyKey: 'key-123' }) as never,
      '/v1/payments/dlocal/create'
    );

    expect(mockCallMoneyServiceWithToken).toHaveBeenCalledWith(
      '/v1/payments/dlocal/create',
      'test-token',
      expect.objectContaining({
        headers: { 'Idempotency-Key': 'key-123' },
      })
    );
  });

  it('sends no Idempotency-Key header when the client sent none', async () => {
    mockCallMoneyServiceWithToken.mockResolvedValue({ ok: true });
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await forwardWriteRequestToMoneyService(
      makeRequest({ body: '{}' }) as never,
      '/v1/payments/dlocal/create'
    );

    expect(mockCallMoneyServiceWithToken).toHaveBeenCalledWith(
      '/v1/payments/dlocal/create',
      'test-token',
      expect.objectContaining({ headers: {} })
    );
  });

  it('omits the body entirely for a genuinely bodyless request (0ms fallback shape for cancel/execute routes)', async () => {
    mockCallMoneyServiceWithToken.mockResolvedValue({ success: true });
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await forwardWriteRequestToMoneyService(
      makeRequest({}) as never,
      '/v1/stripe/subscriptions/cancel'
    );

    const callArgs = mockCallMoneyServiceWithToken.mock.calls[0]?.[2];
    expect(callArgs).not.toHaveProperty('body');
  });

  it('respects a custom HTTP method override', async () => {
    mockCallMoneyServiceWithToken.mockResolvedValue({ ok: true });
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await forwardWriteRequestToMoneyService(
      makeRequest({}) as never,
      '/v1/disbursement/batches/b1/execute',
      { method: 'PATCH' }
    );

    expect(mockCallMoneyServiceWithToken).toHaveBeenCalledWith(
      '/v1/disbursement/batches/b1/execute',
      'test-token',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('propagates a non-2xx MoneyServiceError from money-service untouched', async () => {
    mockCallMoneyServiceWithToken.mockRejectedValue(
      new MockMoneyServiceError(409, { error: 'Duplicate request' })
    );
    const { forwardWriteRequestToMoneyService } =
      await import('@/lib/money-service/write-routes');

    await expect(
      forwardWriteRequestToMoneyService(
        makeRequest({ body: '{}' }) as never,
        '/v1/payments/dlocal/create'
      )
    ).rejects.toMatchObject({ status: 409 });
  });
});
