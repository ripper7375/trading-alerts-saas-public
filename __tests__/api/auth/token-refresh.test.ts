/**
 * token-refresh route tests (Session 3-3) — backs the silent-refresh loop.
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

import { POST } from '@/app/api/auth/token-refresh/route';
import { validateOrigin } from '@/lib/csrf';

// openapi-fetch (Session 7-2) reads response.headers.get(...) and falls back
// to response.text() rather than response.json() -- a real Response is the
// only mock shape that satisfies both, unlike the old hand-rolled
// {ok, status, json} object the raw fetch() wrapper was content with.
function mockFetchResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe('POST /api/auth/token-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns 403 when CSRF origin validation fails', async () => {
    (validateOrigin as jest.Mock).mockResolvedValueOnce(false);

    const response = await POST(makeRequest());
    expect(response.status).toBe(403);
  });

  it('returns 401 with no rotation attempt when no refresh cookie is present', async () => {
    mockCookieStore.get.mockReturnValueOnce(undefined);

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('NO_REFRESH_TOKEN');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rotates both cookies on a successful refresh', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'old-raw-refresh' });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, {
        accessToken: 'new-jwe',
        refreshToken: 'new-raw-refresh',
      })
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });

    const [sessionCall, refreshCall] = mockCookieStore.set.mock.calls;
    expect(sessionCall[1]).toBe('new-jwe');
    expect(refreshCall[1]).toBe('new-raw-refresh');

    // openapi-fetch (Session 7-2) calls fetch(request, init) with a real
    // Request object carrying the body, not fetch(url, {body: string}).
    const [request] = (global.fetch as jest.Mock).mock.calls[0] as [Request];
    expect(JSON.parse(await request.text())).toEqual({
      refreshToken: 'old-raw-refresh',
    });
  });

  it('clears both cookies when rotation fails (revoked/expired/invalid token)', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'dead-refresh' });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, {
        error: 'INVALID_TOKEN',
        message: 'Refresh token is invalid or revoked',
      })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
