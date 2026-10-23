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

// An in-memory stand-in for the shared Redis: INCR, TTL, EXPIRE, DECR, DEL (CODE-01B).
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
let mockRedisDown = false;
function redisGuard(): void {
  if (mockRedisDown) throw new Error('redis down');
}
const mockRedis = {
  incr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') + 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  decr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') - 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  ttl: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (!entry) return -2;
    return entry.ttl ?? -1;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
  del: jest.fn(async (...keys: string[]) => {
    redisGuard();
    let removed = 0;
    for (const key of keys) {
      if (mockRedisStore.delete(key)) removed += 1;
    }
    return removed;
  }),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

import { POST as forgotPassword } from '@/app/api/auth/token-forgot-password/route';
import { POST as resendVerification } from '@/app/api/auth/token-resend-verification/route';
import { POST as resetPassword } from '@/app/api/auth/token-reset-password/route';
import { GET as verifyEmail } from '@/app/api/auth/token-verify-email/route';
import { validateOrigin } from '@/lib/csrf';

beforeEach(() => {
  mockRedisStore.clear();
  mockRedisDown = false;
});

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

// CODE-01B: the client address is limited here, in the monolith (operation-service only sees
// Vercel's address). The e-mail address is limited in operation-service, with the same keys as
// the direct routes, so it is NOT counted here (it would count twice).
describe('token-forgot-password / token-resend-verification / token-reset-password: the client address limits', () => {
  const GENERIC_FORGOT = {
    success: true,
    message:
      'If an account exists with this email, you will receive a password reset link.',
  };
  const GENERIC_RESEND = {
    success: true,
    message:
      'If your email is registered, you will receive a verification email.',
  };
  const FROM_A = { 'x-real-ip': '203.0.113.7' };
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (validateOrigin as jest.Mock).mockResolvedValue(true);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  it.each([
    [
      'token-forgot-password',
      forgotPassword,
      GENERIC_FORGOT,
      (email: string) => makePostRequest({ email }, FROM_A),
    ],
    [
      'token-resend-verification',
      resendVerification,
      GENERIC_RESEND,
      (email: string) => makePostRequest({ email }, FROM_A),
    ],
  ])(
    '%s: the 4th request an hour from one address is answered like any other and forwarded nowhere',
    async (_name, route, generic, request) => {
      for (let i = 0; i < 3; i += 1) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          mockFetchResponse(200, generic)
        );
        expect((await route(request(`user-${i}@example.com`))).status).toBe(
          200
        );
      }
      expect(global.fetch).toHaveBeenCalledTimes(3);
      (global.fetch as jest.Mock).mockClear();

      const fourth = await route(request('user-3@example.com'));
      expect(fourth.status).toBe(200);
      expect(await fourth.json()).toEqual(generic);
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('does not count the e-mail address here (operation-service does, once)', async () => {
    for (let i = 0; i < 3; i += 1) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(200, GENERIC_FORGOT)
      );
      await forgotPassword(
        makePostRequest(
          { email: 'alice@example.com' },
          {
            'x-real-ip': `203.0.113.${20 + i}`,
          }
        )
      );
    }
    expect(
      [...mockRedisStore.keys()].filter((k) => k.includes(':acct:'))
    ).toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('shares the address budget with the direct route (the same key)', async () => {
    for (let i = 0; i < 3; i += 1) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(200, GENERIC_FORGOT)
      );
      await forgotPassword(makePostRequest({ email: 'a@b.com' }, FROM_A));
    }
    expect([...mockRedisStore.keys()]).toEqual([
      'authmail:forgot:ip:203.0.113.7',
    ]);
  });

  it('works without a client address: operation-service is asked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, GENERIC_FORGOT)
    );
    const res = await forgotPassword(makePostRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails OPEN when Redis is down (D-1)', async () => {
    mockRedisDown = true;
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(200, GENERIC_RESEND)
    );
    const res = await resendVerification(
      makePostRequest({ email: 'a@b.com' }, FROM_A)
    );
    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalled();
  });

  describe('token-reset-password', () => {
    const body = { token: 'bad', password: 'newpassword123' };
    const rejected = (): Response =>
      mockFetchResponse(401, {
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
      });

    it('answers the 11th rejected token from one address with 429 and never asks operation-service', async () => {
      for (let i = 0; i < 10; i += 1) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(rejected());
        expect(
          (await resetPassword(makePostRequest(body, FROM_A))).status
        ).toBe(401);
      }
      (global.fetch as jest.Mock).mockClear();

      const eleventh = await resetPassword(makePostRequest(body, FROM_A));
      expect(eleventh.status).toBe(429);
      expect(eleventh.headers.get('retry-after')).toBe('900');
      expect((await eleventh.json()).error).toBe('RATE_LIMITED');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not count a successful reset or a server error', async () => {
      for (let i = 0; i < 9; i += 1) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(rejected());
        await resetPassword(makePostRequest(body, FROM_A));
      }
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(200, { success: true, message: 'ok' })
      );
      expect((await resetPassword(makePostRequest(body, FROM_A))).status).toBe(
        200
      );
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ECONNREFUSED')
      );
      expect((await resetPassword(makePostRequest(body, FROM_A))).status).toBe(
        500
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce(rejected());
      expect((await resetPassword(makePostRequest(body, FROM_A))).status).toBe(
        401
      );
      expect((await resetPassword(makePostRequest(body, FROM_A))).status).toBe(
        429
      );
    });

    it('does not count a request the monolith itself rejects (missing fields)', async () => {
      for (let i = 0; i < 12; i += 1) {
        expect(
          (await resetPassword(makePostRequest({ token: 'abc' }, FROM_A)))
            .status
        ).toBe(400);
      }
      expect(mockRedisStore.size).toBe(0);
    });
  });
});
