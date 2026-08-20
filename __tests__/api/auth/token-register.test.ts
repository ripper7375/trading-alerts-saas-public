/**
 * token-register route tests (Session 4B-20, DECISION-LOG.md F56) — mirrors
 * __tests__/api/auth/token-login.test.ts's own structure exactly. Exercises
 * the real lib/operation-service/client.ts fetch wrapper against a mocked
 * global.fetch, so these also cover its error mapping, not just the route's
 * own logic. No cookies are set here (unlike token-login) — registration
 * never logs the user in immediately, matching SOURCE.
 */
import type { NextRequest } from 'next/server';

jest.mock('@/lib/csrf', () => ({
  validateOrigin: jest.fn(() => Promise.resolve(true)),
  csrfErrorResponse: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Invalid request origin' }), {
        status: 403,
      })
  ),
}));

import { POST } from '@/app/api/auth/token-register/route';
import { validateOrigin } from '@/lib/csrf';

// openapi-fetch (Session 7-2) reads response.headers.get(...) and falls back
// to response.text() rather than response.json() -- a real Response is the
// only mock shape that satisfies both, unlike the old hand-rolled
// {ok, status, json} object the raw fetch() wrapper was content with.
function mockFetchResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe('POST /api/auth/token-register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns 403 when CSRF origin validation fails', async () => {
    (validateOrigin as jest.Mock).mockResolvedValueOnce(false);

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'Sup3r$ecret1' })
    );

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 when email or password is missing', async () => {
    const response = await POST(makeRequest({ email: 'a@b.com' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('returns 400 on unparseable JSON body', async () => {
    const badRequest = {
      json: async () => {
        throw new Error('bad json');
      },
      headers: { get: () => null },
    } as unknown as NextRequest;

    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });

  it('returns 400 when name is present but not a string', async () => {
    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'Sup3r$ecret1', name: 42 })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('forwards to operation-service and returns 201 with the result on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(201, {
        userId: 'user-1',
        message:
          'Registration successful. Please check your email to verify your account.',
        autoVerified: false,
      })
    );

    const response = await POST(
      makeRequest({
        email: 'a@b.com',
        password: 'Sup3r$ecret1',
        name: 'Alice',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.userId).toBe('user-1');
    expect(body.autoVerified).toBe(false);

    // openapi-fetch (Session 7-2) calls fetch(request, init) with a real
    // Request object carrying the body, not fetch(url, {body: string}).
    const [request] = (global.fetch as jest.Mock).mock.calls[0] as [Request];
    expect(JSON.parse(await request.text())).toEqual({
      email: 'a@b.com',
      password: 'Sup3r$ecret1',
      name: 'Alice',
    });
  });

  it('maps an operation-service ACCOUNT_EXISTS error through with the same status/code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(409, {
        error: 'ACCOUNT_EXISTS',
        message: 'An account with this email already exists',
      })
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'Sup3r$ecret1' })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('ACCOUNT_EXISTS');
  });

  it('maps an operation-service validation (weak password) error through with the same status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(400, {
        statusCode: 400,
        message: ['password must be longer than or equal to 8 characters'],
        error: 'Bad Request',
      })
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'short' })
    );

    expect(response.status).toBe(400);
  });

  it('returns 500 when operation-service is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'Sup3r$ecret1' })
    );

    expect(response.status).toBe(500);
  });
});
