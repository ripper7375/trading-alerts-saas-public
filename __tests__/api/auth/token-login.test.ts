/**
 * token-login route tests (Session 3-3) — the operation-service cookie-set
 * login route. Exercises the real lib/operation-service/client.ts fetch
 * wrapper against a mocked global.fetch, so these also cover its error
 * mapping, not just the route's own logic.
 */
import type { NextRequest } from 'next/server';

const mockCookieStore = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

jest.mock('@/lib/csrf', () => ({
  validateOrigin: jest.fn(() => Promise.resolve(true)),
  csrfErrorResponse: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Invalid request origin' }), {
        status: 403,
      })
  ),
}));

import { POST } from '@/app/api/auth/token-login/route';
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

describe('POST /api/auth/token-login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns 403 when CSRF origin validation fails', async () => {
    (validateOrigin as jest.Mock).mockResolvedValueOnce(false);

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' })
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

  it('sets the session + refresh cookies and returns the user on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, {
        accessToken: 'jwe-token',
        refreshToken: 'raw-refresh',
        user: {
          id: '1',
          email: 'a@b.com',
          tier: 'FREE',
          role: 'USER',
          isAffiliate: false,
        },
      })
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe('a@b.com');

    const [sessionCall, refreshCall] = mockCookieStore.set.mock.calls;
    expect(sessionCall[0]).toContain('next-auth.session-token');
    expect(sessionCall[1]).toBe('jwe-token');
    expect(sessionCall[2]).toMatchObject({ httpOnly: true, path: '/' });

    expect(refreshCall[0]).toContain('operation-refresh-token');
    expect(refreshCall[1]).toBe('raw-refresh');
  });

  it('passes through a twoFactorRequired response without setting any cookie', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, { twoFactorRequired: true, token: '2fa-token' })
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' })
    );
    const body = await response.json();

    expect(body).toEqual({ twoFactorRequired: true, token: '2fa-token' });
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('maps an operation-service error response through with the same status/code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, {
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      })
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'wrong' })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('returns 500 when operation-service is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    );

    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' })
    );

    expect(response.status).toBe(500);
  });
});
