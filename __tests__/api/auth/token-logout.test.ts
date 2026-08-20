/**
 * token-logout route tests (Session 3-3).
 */
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

import { POST } from '@/app/api/auth/token-logout/route';
import { validateOrigin } from '@/lib/csrf';

// openapi-fetch (Session 7-2) reads response.headers.get(...) and falls back
// to response.text() rather than response.json() -- a real Response is the
// only mock shape that satisfies both, unlike the old hand-rolled
// {ok, status, json} object the raw fetch() wrapper was content with.
function mockFetchResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('POST /api/auth/token-logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns 403 when CSRF origin validation fails', async () => {
    (validateOrigin as jest.Mock).mockResolvedValueOnce(false);

    const response = await POST();
    expect(response.status).toBe(403);
  });

  it('calls operation-service logout and clears both cookies when a refresh cookie exists', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'raw-refresh' });
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, { success: true })
    );

    const response = await POST();
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
  });

  it('still clears cookies and succeeds even when no refresh cookie is present', async () => {
    mockCookieStore.get.mockReturnValueOnce(undefined);

    const response = await POST();
    const body = await response.json();

    expect(body).toEqual({ success: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
  });

  it('still clears cookies and succeeds even when operation-service is unreachable (idempotent logout)', async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: 'raw-refresh' });
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED')
    );

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
  });
});
