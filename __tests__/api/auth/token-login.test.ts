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
    mockRedisStore.clear();
    mockRedisDown = false;
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

// CODE-01B: the client address is limited here, in the monolith (operation-service only sees
// Vercel's address); the account is limited in operation-service, with the same keys as the
// credentials provider.
describe('POST /api/auth/token-login: the client address limit', () => {
  const FROM_A = { 'x-real-ip': '203.0.113.7' };
  const WRONG = {
    error: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  };
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockRedisStore.clear();
    mockRedisDown = false;
    (validateOrigin as jest.Mock).mockResolvedValue(true);
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  async function wrongPassword(
    email: string,
    headers: Record<string, string> = FROM_A
  ): Promise<Response> {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, WRONG)
    );
    return POST(makeRequest({ email, password: 'guess' }, headers));
  }

  it('answers the 21st failure from one address with 429 and never asks operation-service', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await wrongPassword(`victim-${i}@example.com`)).status).toBe(401);
    }
    (global.fetch as jest.Mock).mockClear();

    const response = await POST(
      makeRequest({ email: 'victim-20@example.com', password: 'guess' }, FROM_A)
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('RATE_LIMITED');
    expect(response.headers.get('retry-after')).toBe('900');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not limit a different address', async () => {
    for (let i = 0; i < 20; i += 1) {
      await wrongPassword(`victim-${i}@example.com`);
    }
    const other = await wrongPassword('victim-20@example.com', {
      'x-real-ip': '198.51.100.9',
    });
    expect(other.status).toBe(401);
  });

  it('a successful sign-in gives its count back', async () => {
    for (let i = 0; i < 19; i += 1) {
      await wrongPassword(`victim-${i}@example.com`);
    }
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
    const ok = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' }, FROM_A)
    );
    expect(ok.status).toBe(200);

    expect((await wrongPassword('victim-19@example.com')).status).toBe(401);
    expect((await wrongPassword('victim-20@example.com')).status).toBe(429);
  });

  it('only a 401 is a failure: a locked account (429) or an unverified one (403) is not counted against the address', async () => {
    for (let i = 0; i < 25; i += 1) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(i % 2 === 0 ? 429 : 403, {
          error: i % 2 === 0 ? 'RATE_LIMITED' : 'EMAIL_NOT_VERIFIED',
          message: 'refused',
        })
      );
      const res = await POST(
        makeRequest({ email: `u-${i}@example.com`, password: 'x' }, FROM_A)
      );
      expect(res.status).toBe(i % 2 === 0 ? 429 : 403);
    }
    expect((await wrongPassword('someone@example.com')).status).toBe(401);
  });

  it('passes the 429 of the account lockout through', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(429, {
        error: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again later.',
        retryAfter: 600,
      })
    );
    const response = await POST(
      makeRequest({ email: 'a@b.com', password: 'secret123' }, FROM_A)
    );
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe('RATE_LIMITED');
  });

  it('does not count a network failure towards the address', async () => {
    for (let i = 0; i < 25; i += 1) {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ECONNREFUSED')
      );
      expect(
        (
          await POST(
            makeRequest({ email: `u-${i}@example.com`, password: 'x' }, FROM_A)
          )
        ).status
      ).toBe(500);
    }
  });

  it('does not count the 2FA completion step (the 2FA limits cover it)', async () => {
    for (let i = 0; i < 25; i += 1) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(401, WRONG)
      );
      const res = await POST(
        makeRequest({ email: '__2fa_verified__', password: 'token' }, FROM_A)
      );
      expect(res.status).toBe(401);
    }
    expect(mockRedisStore.size).toBe(0);
  });

  it('works without a client address: operation-service is asked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, WRONG)
    );
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'x' }));
    expect(res.status).toBe(401);
    expect(mockRedisStore.size).toBe(0);
  });

  it('fails OPEN when Redis is down (D-1): operation-service is asked and a warning is logged', async () => {
    mockRedisDown = true;
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(401, WRONG)
    );
    const res = await POST(
      makeRequest({ email: 'a@b.com', password: 'x' }, FROM_A)
    );
    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalled();
  });
});
