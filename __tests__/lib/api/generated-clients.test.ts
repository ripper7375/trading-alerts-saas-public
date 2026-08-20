/**
 * Contract tests for the generated operationApi/moneyApi clients (Session
 * 7-1 Step 5; expanded to full domain coverage at Session 7-3 Step 2).
 *
 * Mocks `global.fetch` at the network boundary and asserts on the REAL
 * `Request` object openapi-fetch builds (url, method, headers) -- this
 * exercises the actual generated client code (URL/path-param substitution,
 * header merging, our unwrapOperationApi/unwrapMoneyApi error mapping), not
 * just the mock. Neither service is a running process in this test
 * environment (matching this repo's own `lib/api/` test convention,
 * `migration-stack-analysis.md`'s appendix flag) -- a real end-to-end round
 * trip against a live service is out of this contract-test's scope, same as
 * the order's own Step 5 framing ("contract-style unit tests verifying
 * request formatting, header injection, prefix routing, and error response
 * handling").
 *
 * L31 compliance: every mocked response is a real `new Response(...)`, every
 * request assertion reads the real `Request` object `openapi-fetch` builds
 * -- never a bare `{ok, status, json}` double.
 *
 * L32 note (Session 7-3 Deviation 2): the order's own Surface line names a
 * templated `POST /v1/cron-trigger/{jobId}` money-service route. The real
 * generated schema (`lib/api/generated/money-api/schema.ts`) has no such
 * templated path -- it emits 8 separate literal-named routes instead
 * (`/v1/cron-trigger/daily-maintenance`, `/v1/cron-trigger/expire-codes`,
 * etc.), matching the real `CronTriggerController`. Tested against
 * `/v1/cron-trigger/daily-maintenance`, a real route, rather than the
 * fictional templated one -- per `LESSONS-LEARNED.md` L22, source wins over
 * the order's paraphrase.
 *
 * @module __tests__/lib/api/generated-clients.test
 */
import {
  createMoneyApi,
  unwrapMoneyApi,
} from '@/lib/api/generated/money-api/client';
import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { MoneyServiceError } from '@/lib/money-service/client';
import { OperationServiceError } from '@/lib/operation-service/client';

function mockFetchOnce(status: number, body: unknown): jest.Mock {
  const fn = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function calledRequest(fetchMock: jest.Mock): Request {
  const [request] = fetchMock.mock.calls[0] as [Request];
  return request;
}

describe('operationApi (root prefix, no /v1 segment)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the real path with no service prefix', async () => {
    const fetchMock = mockFetchOnce(200, { alerts: [] });
    const client = createOperationApi('tok-123');

    await client.GET('/alerts');

    const request = calledRequest(fetchMock);
    expect(request.url).toBe('http://localhost:3001/alerts');
    expect(request.method).toBe('GET');
  });

  it('substitutes path parameters (e.g. /alerts/{id})', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'alert-1' });
    const client = createOperationApi('tok-123');

    await client.GET('/alerts/{id}', { params: { path: { id: 'alert-1' } } });

    const request = calledRequest(fetchMock);
    expect(request.url).toBe('http://localhost:3001/alerts/alert-1');
  });

  it('attaches a Bearer Authorization header when a token is provided', async () => {
    const fetchMock = mockFetchOnce(200, {});
    const client = createOperationApi('secret-token');

    await client.GET('/alerts');

    const request = calledRequest(fetchMock);
    expect(request.headers.get('authorization')).toBe('Bearer secret-token');
  });

  it('omits the Authorization header when the token is null (unauthenticated routes)', async () => {
    const fetchMock = mockFetchOnce(200, {});
    const client = createOperationApi(null);

    await client.POST('/auth/login', {
      body: { email: 'a@b.com', password: 'x' } as never,
    });

    const request = calledRequest(fetchMock);
    expect(request.headers.has('authorization')).toBe(false);
  });

  it('unwrapOperationApi returns the parsed body on a 2xx response', async () => {
    mockFetchOnce(200, { alerts: [{ id: '1' }] });
    const client = createOperationApi('tok');

    const result = await client.GET('/alerts');
    const data = await unwrapOperationApi(result);

    expect(data).toEqual({ alerts: [{ id: '1' }] });
  });

  it('unwrapOperationApi throws a real OperationServiceError on a non-2xx response', async () => {
    mockFetchOnce(404, { error: 'Not found', message: 'Alert not found' });
    const client = createOperationApi('tok');

    const result = await client.GET('/alerts/{id}', {
      params: { path: { id: 'missing' } },
    });

    await expect(unwrapOperationApi(result)).rejects.toBeInstanceOf(
      OperationServiceError
    );
    try {
      await unwrapOperationApi(result);
      throw new Error('expected unwrapOperationApi to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OperationServiceError);
      expect((error as OperationServiceError).status).toBe(404);
      expect((error as OperationServiceError).body.message).toBe(
        'Alert not found'
      );
    }
  });

  it('maps a 500 response to OperationServiceError too, not just 4xx', async () => {
    mockFetchOnce(500, { error: 'Internal error' });
    const client = createOperationApi('tok');

    const result = await client.GET('/alerts');

    await expect(unwrapOperationApi(result)).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('moneyApi (/v1 prefix, excluding /health and /health-auth)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests real routes under the /v1 prefix', async () => {
    const fetchMock = mockFetchOnce(200, { batches: [] });
    const client = createMoneyApi('tok-123');

    await client.GET('/v1/disbursement/batches');

    const request = calledRequest(fetchMock);
    expect(request.url).toBe('http://localhost:3002/v1/disbursement/batches');
  });

  it('requests /health with no /v1 prefix (matches main.ts setGlobalPrefix exclude list)', async () => {
    const fetchMock = mockFetchOnce(200, { status: 'ok' });
    const client = createMoneyApi(null);

    await client.GET('/health');

    const request = calledRequest(fetchMock);
    expect(request.url).toBe('http://localhost:3002/health');
  });

  it('attaches a Bearer Authorization header when a token is provided', async () => {
    const fetchMock = mockFetchOnce(200, {});
    const client = createMoneyApi('money-token');

    await client.GET('/v1/disbursement/batches');

    const request = calledRequest(fetchMock);
    expect(request.headers.get('authorization')).toBe('Bearer money-token');
  });

  it('unwrapMoneyApi returns the parsed body on a 2xx response', async () => {
    mockFetchOnce(200, { status: 'ok' });
    const client = createMoneyApi(null);

    const result = await client.GET('/health');
    const data = await unwrapMoneyApi(result);

    expect(data).toEqual({ status: 'ok' });
  });

  it('unwrapMoneyApi throws a real MoneyServiceError on a non-2xx response', async () => {
    mockFetchOnce(403, { error: 'Forbidden', message: 'Admin role required' });
    const client = createMoneyApi('tok');

    const result = await client.GET('/v1/disbursement/batches');

    await expect(unwrapMoneyApi(result)).rejects.toBeInstanceOf(
      MoneyServiceError
    );
    try {
      await unwrapMoneyApi(result);
      throw new Error('expected unwrapMoneyApi to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyServiceError);
      expect((error as MoneyServiceError).status).toBe(403);
    }
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Domain contract coverage (Session 7-3, Step 2)
//
// Each block below exercises a real route verified directly against
// `lib/api/generated/{operation-api,money-api}/schema.ts` (path, method,
// and path-param shape all re-checked at this session's CONFIRM/Step 0 --
// not copied from the order's prose). Fixtures are recorded-realistic
// shapes, not live-captured payloads (no running service in this test
// environment) -- see this file's own header and the order's Decision 3.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('operationApi domain coverage: alerts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /alerts lists alerts', async () => {
    const fetchMock = mockFetchOnce(200, {
      alerts: [
        { id: 'alert-1', symbol: 'EURUSD', condition: 'ABOVE', price: 1.085 },
      ],
    });
    const client = createOperationApi('tok');

    const result = await client.GET('/alerts');
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).url).toBe('http://localhost:3001/alerts');
    expect(data).toEqual({
      alerts: [
        { id: 'alert-1', symbol: 'EURUSD', condition: 'ABOVE', price: 1.085 },
      ],
    });
  });

  it('POST /alerts creates an alert and unwraps a 201 Created', async () => {
    const fetchMock = mockFetchOnce(201, {
      id: 'alert-2',
      symbol: 'GBPUSD',
      condition: 'BELOW',
      price: 1.27,
    });
    const client = createOperationApi('tok');

    const result = await client.POST('/alerts', {
      body: { symbol: 'GBPUSD', condition: 'BELOW', price: 1.27 } as never,
    });
    const data = await unwrapOperationApi(result);

    const request = calledRequest(fetchMock);
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual({
      symbol: 'GBPUSD',
      condition: 'BELOW',
      price: 1.27,
    });
    expect(data).toMatchObject({ id: 'alert-2' });
  });

  it('GET /alerts/{id} substitutes the path parameter', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'alert-1', symbol: 'EURUSD' });
    const client = createOperationApi('tok');

    await client.GET('/alerts/{id}', { params: { path: { id: 'alert-1' } } });

    expect(calledRequest(fetchMock).url).toBe(
      'http://localhost:3001/alerts/alert-1'
    );
  });

  it('PATCH /alerts/{id} updates an alert', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'alert-1', enabled: false });
    const client = createOperationApi('tok');

    const result = await client.PATCH('/alerts/{id}', {
      params: { path: { id: 'alert-1' } },
      body: { enabled: false } as never,
    });
    const data = await unwrapOperationApi(result);

    const request = calledRequest(fetchMock);
    expect(request.method).toBe('PATCH');
    expect(request.url).toBe('http://localhost:3001/alerts/alert-1');
    expect(data).toEqual({ id: 'alert-1', enabled: false });
  });

  it('DELETE /alerts/{id} unwraps a 204 No Content response', async () => {
    const fetchMock = mockFetchOnce(204, undefined);
    const client = createOperationApi('tok');

    const result = await client.DELETE('/alerts/{id}', {
      params: { path: { id: 'alert-1' } },
    });
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).method).toBe('DELETE');
    expect(data).toBeUndefined();
  });
});

describe('operationApi domain coverage: auth', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /auth/login returns an access token', async () => {
    mockFetchOnce(200, {
      accessToken: 'tok-abc',
      user: { id: 'u1', email: 'a@b.com' },
    });
    const client = createOperationApi(null);

    const result = await client.POST('/auth/login', {
      body: { email: 'a@b.com', password: 'x' } as never,
    });
    const data = await unwrapOperationApi(result);

    expect(data).toMatchObject({ accessToken: 'tok-abc' });
  });

  it('POST /auth/register unwraps a 201 Created', async () => {
    const fetchMock = mockFetchOnce(201, {
      id: 'u2',
      email: 'new@user.com',
    });
    const client = createOperationApi(null);

    const result = await client.POST('/auth/register', {
      body: { email: 'new@user.com', password: 'x' } as never,
    });
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).url).toBe(
      'http://localhost:3001/auth/register'
    );
    expect(data).toMatchObject({ id: 'u2' });
  });

  it('POST /auth/refresh returns a new access token', async () => {
    mockFetchOnce(200, { accessToken: 'tok-def' });
    const client = createOperationApi(null);

    const result = await client.POST('/auth/refresh', { body: {} as never });
    const data = await unwrapOperationApi(result);

    expect(data).toEqual({ accessToken: 'tok-def' });
  });

  it('POST /auth/logout confirms with the Bearer token attached', async () => {
    const fetchMock = mockFetchOnce(200, { success: true });
    const client = createOperationApi('tok-abc');

    await client.POST('/auth/logout');

    expect(calledRequest(fetchMock).headers.get('authorization')).toBe(
      'Bearer tok-abc'
    );
  });
});

describe('operationApi domain coverage: user preferences & profile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /user/preferences', async () => {
    mockFetchOnce(200, { theme: 'dark', language: 'en', currency: 'USD' });
    const client = createOperationApi('tok');

    const result = await client.GET('/user/preferences');
    const data = await unwrapOperationApi(result);

    expect(data).toEqual({ theme: 'dark', language: 'en', currency: 'USD' });
  });

  it('PUT /user/preferences replaces preferences', async () => {
    const fetchMock = mockFetchOnce(200, { theme: 'light' });
    const client = createOperationApi('tok');

    const result = await client.PUT('/user/preferences', {
      body: { theme: 'light' } as never,
    });
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).method).toBe('PUT');
    expect(data).toEqual({ theme: 'light' });
  });

  it('GET /user/profile', async () => {
    mockFetchOnce(200, { id: 'u1', name: 'Jane Doe', email: 'jane@doe.com' });
    const client = createOperationApi('tok');

    const result = await client.GET('/user/profile');
    const data = await unwrapOperationApi(result);

    expect(data).toMatchObject({ id: 'u1', name: 'Jane Doe' });
  });

  it('PATCH /user/profile updates the profile', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'u1', name: 'Jane D.' });
    const client = createOperationApi('tok');

    const result = await client.PATCH('/user/profile', {
      body: { name: 'Jane D.' } as never,
    });
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).method).toBe('PATCH');
    expect(data).toEqual({ id: 'u1', name: 'Jane D.' });
  });
});

describe('operationApi domain coverage: drawings & notifications', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /drawings lists drawings', async () => {
    mockFetchOnce(200, { drawings: [{ id: 'd1', type: 'trendline' }] });
    const client = createOperationApi('tok');

    const result = await client.GET('/drawings');
    const data = await unwrapOperationApi(result);

    expect(data).toEqual({ drawings: [{ id: 'd1', type: 'trendline' }] });
  });

  it('POST /drawings creates a drawing and unwraps a 201 Created', async () => {
    const fetchMock = mockFetchOnce(201, { id: 'd2', type: 'rectangle' });
    const client = createOperationApi('tok');

    const result = await client.POST('/drawings', {
      body: { type: 'rectangle' } as never,
    });
    const data = await unwrapOperationApi(result);

    expect(calledRequest(fetchMock).method).toBe('POST');
    expect(data).toMatchObject({ id: 'd2' });
  });

  it('GET /notifications lists notifications', async () => {
    mockFetchOnce(200, { notifications: [{ id: 'n1', read: false }] });
    const client = createOperationApi('tok');

    const result = await client.GET('/notifications');
    const data = await unwrapOperationApi(result);

    expect(data).toEqual({ notifications: [{ id: 'n1', read: false }] });
  });

  it('POST /notifications/{id}/read marks one notification read', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'n1', read: true });
    const client = createOperationApi('tok');

    const result = await client.POST('/notifications/{id}/read', {
      params: { path: { id: 'n1' } },
    });
    const data = await unwrapOperationApi(result);

    const request = calledRequest(fetchMock);
    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://localhost:3001/notifications/n1/read');
    expect(data).toEqual({ id: 'n1', read: true });
  });
});

describe('moneyApi domain coverage: affiliates', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /v1/affiliate/dashboard/stats', async () => {
    mockFetchOnce(200, { totalCommission: 1200.5, activeReferrals: 8 });
    const client = createMoneyApi('tok');

    const result = await client.GET('/v1/affiliate/dashboard/stats');
    const data = await unwrapMoneyApi(result);

    expect(data).toEqual({ totalCommission: 1200.5, activeReferrals: 8 });
  });

  it('GET /v1/affiliate/dashboard/codes serializes query params (L32 pathWithQuery/buildQuery pattern)', async () => {
    const fetchMock = mockFetchOnce(200, {
      codes: [{ code: 'AFF123', status: 'active' }],
    });
    const client = createMoneyApi('tok');

    // Mirrors lib/money-service/routes.ts's own fetchAffiliateDashboardCodes:
    // parameters.query is typed `never` on this generated operation (L32),
    // so the real wrapper appends the query string to the literal path and
    // casts -- reproduced here to prove the pattern actually serializes.
    const query = new URLSearchParams({ status: 'active', page: '1' });
    const pathWithQuery = `/v1/affiliate/dashboard/codes?${query.toString()}`;

    const result = await client.GET(
      pathWithQuery as '/v1/affiliate/dashboard/codes'
    );
    const data = await unwrapMoneyApi(result);

    const request = calledRequest(fetchMock);
    expect(request.url).toBe(
      'http://localhost:3002/v1/affiliate/dashboard/codes?status=active&page=1'
    );
    expect(data).toEqual({ codes: [{ code: 'AFF123', status: 'active' }] });
  });
});

describe('moneyApi domain coverage: admin', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /v1/admin/affiliates', async () => {
    mockFetchOnce(200, { affiliates: [{ id: 'aff1' }] });
    const client = createMoneyApi('admin-tok');

    const result = await client.GET('/v1/admin/affiliates');
    const data = await unwrapMoneyApi(result);

    expect(data).toEqual({ affiliates: [{ id: 'aff1' }] });
  });

  it('GET /v1/admin/analytics', async () => {
    mockFetchOnce(200, { totalUsers: 500 });
    const client = createMoneyApi('admin-tok');

    const result = await client.GET('/v1/admin/analytics');
    const data = await unwrapMoneyApi(result);

    expect(data).toEqual({ totalUsers: 500 });
  });
});

describe('moneyApi domain coverage: wise disbursement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /v1/wise/recipients', async () => {
    mockFetchOnce(200, { recipients: [{ id: 'r1' }] });
    const client = createMoneyApi('tok');

    const result = await client.GET('/v1/wise/recipients');
    const data = await unwrapMoneyApi(result);

    expect(data).toEqual({ recipients: [{ id: 'r1' }] });
  });

  it('POST /v1/wise/recipients creates a recipient and unwraps a 201 Created', async () => {
    const fetchMock = mockFetchOnce(201, {
      id: 'r2',
      accountHolderName: 'John Smith',
    });
    const client = createMoneyApi('tok');

    const result = await client.POST('/v1/wise/recipients', {
      body: { accountHolderName: 'John Smith' } as never,
    });
    const data = await unwrapMoneyApi(result);

    expect(calledRequest(fetchMock).method).toBe('POST');
    expect(data).toMatchObject({ id: 'r2' });
  });

  it('POST /v1/wise/recipients/{id}/revalidate substitutes the path parameter', async () => {
    const fetchMock = mockFetchOnce(200, { id: 'r1', valid: true });
    const client = createMoneyApi('tok');

    const result = await client.POST('/v1/wise/recipients/{id}/revalidate', {
      params: { path: { id: 'r1' } },
    });
    const data = await unwrapMoneyApi(result);

    expect(calledRequest(fetchMock).url).toBe(
      'http://localhost:3002/v1/wise/recipients/r1/revalidate'
    );
    expect(data).toEqual({ id: 'r1', valid: true });
  });
});

describe('moneyApi domain coverage: cron trigger & health', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The order's Surface line names a templated `/v1/cron-trigger/{jobId}`
  // route; the real schema has no such path (see this file's own header
  // note, Session 7-3 Deviation 2). Tested against a real literal route.
  it('POST /v1/cron-trigger/daily-maintenance triggers a named job', async () => {
    const fetchMock = mockFetchOnce(200, {
      jobId: 'daily-maintenance',
      status: 'completed',
    });
    const client = createMoneyApi('cron-tok');

    const result = await client.POST('/v1/cron-trigger/daily-maintenance');
    const data = await unwrapMoneyApi(result);

    expect(calledRequest(fetchMock).url).toBe(
      'http://localhost:3002/v1/cron-trigger/daily-maintenance'
    );
    expect(data).toEqual({ jobId: 'daily-maintenance', status: 'completed' });
  });

  it('GET /health excludes the /v1 prefix and requires no token', async () => {
    const fetchMock = mockFetchOnce(200, { status: 'ok' });
    const client = createMoneyApi(null);

    const result = await client.GET('/health');
    const data = await unwrapMoneyApi(result);

    const request = calledRequest(fetchMock);
    expect(request.url).toBe('http://localhost:3002/health');
    expect(request.headers.has('authorization')).toBe(false);
    expect(data).toEqual({ status: 'ok' });
  });
});

describe('error status code coverage (400, 401, 403, 404, 500)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('operationApi maps a 400 to OperationServiceError with the response body', async () => {
    mockFetchOnce(400, {
      error: 'Bad Request',
      message: 'email must be a valid email address',
    });
    const client = createOperationApi(null);

    const result = await client.POST('/auth/login', {
      body: { email: 'not-an-email', password: 'x' } as never,
    });

    try {
      await unwrapOperationApi(result);
      throw new Error('expected unwrapOperationApi to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(OperationServiceError);
      expect((error as OperationServiceError).status).toBe(400);
      expect((error as OperationServiceError).body.message).toBe(
        'email must be a valid email address'
      );
    }
  });

  it('operationApi maps a 401 to OperationServiceError', async () => {
    mockFetchOnce(401, { error: 'Unauthorized', message: 'Invalid token' });
    const client = createOperationApi('expired-tok');

    const result = await client.GET('/user/profile');

    await expect(unwrapOperationApi(result)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('moneyApi maps a 400 to MoneyServiceError with the response body', async () => {
    mockFetchOnce(400, {
      error: 'Bad Request',
      message: 'accountHolderName is required',
    });
    const client = createMoneyApi('tok');

    const result = await client.POST('/v1/wise/recipients', {
      body: {} as never,
    });

    try {
      await unwrapMoneyApi(result);
      throw new Error('expected unwrapMoneyApi to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyServiceError);
      expect((error as MoneyServiceError).status).toBe(400);
      expect((error as MoneyServiceError).body.message).toBe(
        'accountHolderName is required'
      );
    }
  });

  it('moneyApi maps a 401 to MoneyServiceError', async () => {
    mockFetchOnce(401, { error: 'Unauthorized' });
    const client = createMoneyApi(null);

    const result = await client.GET('/v1/admin/analytics');

    await expect(unwrapMoneyApi(result)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('moneyApi maps a 404 to MoneyServiceError', async () => {
    mockFetchOnce(404, { error: 'Not Found', message: 'Recipient not found' });
    const client = createMoneyApi('tok');

    const result = await client.POST('/v1/wise/recipients/{id}/revalidate', {
      params: { path: { id: 'missing' } },
    });

    await expect(unwrapMoneyApi(result)).rejects.toMatchObject({
      status: 404,
    });
  });
});
