/**
 * Contract tests for the generated operationApi/moneyApi clients (Session
 * 7-1, Step 5).
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
