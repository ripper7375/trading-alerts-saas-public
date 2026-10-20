/**
 * token-{forgot-password,reset-password,verify-email,resend-verification}
 * route tests (Session 3-4, F29) — additive parallel paths to the
 * operation-service endpoints ported from the equivalent app/api/auth/*
 * routes. Exercises the real lib/operation-service/client.ts fetch wrapper
 * against a mocked global.fetch, same style as token-login.test.ts.
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

import { POST as forgotPassword } from '@/app/api/auth/token-forgot-password/route';
import { POST as resendVerification } from '@/app/api/auth/token-resend-verification/route';
import { POST as resetPassword } from '@/app/api/auth/token-reset-password/route';
import { GET as verifyEmail } from '@/app/api/auth/token-verify-email/route';
import { validateOrigin } from '@/lib/csrf';

// openapi-fetch (Session 7-2) reads response.headers.get(...) and falls back
// to response.text() rather than response.json() -- a real Response is the
// only mock shape that satisfies both, unlike the old hand-rolled
// {ok, status, json} object the raw fetch() wrapper was content with.
function mockFetchResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function headersOf(values: Record<string, string>): {
  get: (name: string) => string | null;
} {
  const map = new Headers(values);
  return { get: (name) => map.get(name) };
}

function makePostRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return {
    json: async () => body,
    headers: headersOf(headers),
  } as unknown as NextRequest;
}

function makeGetRequest(
  searchParams: Record<string, string>,
  headers: Record<string, string> = {}
): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(searchParams) },
    headers: headersOf(headers),
  } as unknown as NextRequest;
}

describe('token-forgot-password / token-reset-password / token-resend-verification (CSRF-checked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (validateOrigin as jest.Mock).mockResolvedValue(true);
  });

  it('token-forgot-password: 403 on failed CSRF check', async () => {
    (validateOrigin as jest.Mock).mockResolvedValueOnce(false);
    const response = await forgotPassword(
      makePostRequest({ email: 'a@b.com' })
    );
    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('token-forgot-password: always forwards the generic success body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, {
        success: true,
        message:
          'If an account exists with this email, you will receive a password reset link.',
      })
    );
    const response = await forgotPassword(
      makePostRequest({ email: 'a@b.com' })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('token-reset-password: 400 on missing fields', async () => {
    const response = await resetPassword(makePostRequest({ token: 'abc' }));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('token-reset-password: maps an INVALID_TOKEN error through with its status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, {
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
      })
    );
    const response = await resetPassword(
      makePostRequest({ token: 'bad', password: 'newpassword123' })
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.error).toBe('INVALID_TOKEN');
  });

  it('token-resend-verification: forwards a rate-limit error with retryAfter', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(429, {
        error: 'RATE_LIMIT_EXCEEDED',
        message:
          'Please wait 42 seconds before requesting another verification email.',
        retryAfter: 42,
      })
    );
    const response = await resendVerification(
      makePostRequest({ email: 'a@b.com' })
    );
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(42);
  });
});

describe('token-verify-email (GET, unauthenticated, no CSRF)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('returns 400 when no token query param is present', async () => {
    const response = await verifyEmail(makeGetRequest({}));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forwards the token as a query param and returns success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, {
        success: true,
        message: 'Email verified successfully. You can now sign in.',
      })
    );

    const response = await verifyEmail(makeGetRequest({ token: 'good-token' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // openapi-fetch (Session 7-2) calls fetch(request, init) with a real
    // Request object, not fetch(url, init) with a plain url string.
    const [request] = (global.fetch as jest.Mock).mock.calls[0] as [Request];
    expect(request.url).toContain('/auth/verify-email?token=good-token');
  });

  it('forwards a rate-limit (Gmail-preview guard) error with retryAfter', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(429, {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Please wait 3 more seconds, then refresh this page.',
        retryAfter: 3,
      })
    );

    const response = await verifyEmail(
      makeGetRequest({ token: 'fresh-token' })
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.retryAfter).toBe(3);
  });
});

describe('the e-mail these routes trigger is written in the reader language', () => {
  /** The headers of the request the route made to operation-service. */
  function sentHeaders(): Headers {
    const [input, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      Request | string,
      RequestInit | undefined,
    ];
    return input instanceof Request
      ? input.headers
      : new Headers(init?.headers);
  }

  const browser = {
    cookie:
      'next-auth.session-token=secret; davintrade-locale=th; davintrade-formats=DMY.24h',
    'user-agent': 'Browser/1.0',
    'x-forwarded-for': '203.0.113.7',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (validateOrigin as jest.Mock).mockResolvedValue(true);
  });

  it.each([
    [
      'token-forgot-password',
      () => forgotPassword(makePostRequest({ email: 'a@b.com' }, browser)),
    ],
    [
      'token-resend-verification',
      () => resendVerification(makePostRequest({ email: 'a@b.com' }, browser)),
    ],
    [
      'token-verify-email',
      () => verifyEmail(makeGetRequest({ token: 'abc' }, browser)),
    ],
  ])(
    '%s forwards the language and formats, and nothing else of the request',
    async (_name, call) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(200, { success: true, message: 'ok' })
      );
      await call();

      const headers = sentHeaders();
      expect(headers.get('x-email-language')).toBe('th');
      expect(headers.get('x-email-formats')).toBe('DMY.24h');
      // Not the session cookie, and not the caller's address or agent: those
      // would change what operation-service's rate limits and audit fields see.
      expect(headers.get('cookie')).toBeNull();
      expect(headers.get('x-forwarded-for')).toBeNull();
      expect(headers.get('user-agent')).not.toBe('Browser/1.0');
      expect([...headers.values()].join(' ')).not.toContain('secret');
    }
  );
});
