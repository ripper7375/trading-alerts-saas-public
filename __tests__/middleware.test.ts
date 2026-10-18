/**
 * middleware.ts tests (Session 3-3) — the guard on the (dashboard) route
 * group's page paths. getToken() itself is mocked; these tests only cover
 * this file's own branching (redirect / pass-through / fail-open).
 *
 * Next.js remediation T1-e added the segment-boundary prefix match and the
 * /terminal and /free pages; T1-f added the central CSRF check on
 * state-changing /api/** requests (the last describe). validateOrigin() runs
 * for real there (lib/csrf.ts has its own tests); it is wrapped in a spy only
 * so a test can make it throw.
 */
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

jest.mock('@/lib/csrf', () => {
  const actual = jest.requireActual('@/lib/csrf');
  return { ...actual, validateOrigin: jest.fn(actual.validateOrigin) };
});

import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { middleware } from '@/middleware';

function makeRequest(
  pathname: string,
  init: { method?: string; headers?: Record<string, string> } = {}
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    nextUrl: {
      pathname,
      // The country-prefix branches rewrite a clone of the URL
      clone: () => new URL(url),
    },
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to /login with a callbackUrl when no token is present', async () => {
    (getToken as jest.Mock).mockResolvedValueOnce(null);

    const response = await middleware(makeRequest('/dashboard'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('callbackUrl=%2Fdashboard');
  });

  it('passes the request through when a valid token is present', async () => {
    (getToken as jest.Mock).mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@b.com',
    });

    const response = await middleware(makeRequest('/alerts'));

    // NextResponse.next() carries no Location header and is not a redirect.
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/pro/currency-index', '/pro/currency-index/compare'])(
    'sends a signed-out visitor from PRO page %s to /login with a return address',
    async (path) => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const response = await middleware(makeRequest(path));

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain(`callbackUrl=${encodeURIComponent(path)}`);
    }
  );

  it.each(['/pricing', '/products', '/promo'])(
    'does not gate %s just because it starts with the letters "pro"',
    async (path) => {
      const response = await middleware(makeRequest(path));

      expect(getToken).not.toHaveBeenCalled();
      expect(response.headers.get('location')).toBeNull();
    }
  );

  it.each(['/affiliate/dashboard', '/affiliate/dashboard/commissions'])(
    'lets an admin through to %s for the read-only "view as affiliate" mode',
    async (path) => {
      (getToken as jest.Mock).mockResolvedValueOnce({
        id: 'admin-1',
        role: 'ADMIN',
      });

      const response = await middleware(makeRequest(path));

      expect(response.headers.get('location')).toBeNull();
    }
  );

  it.each(['/affiliate/settings/payout', '/affiliate/register'])(
    'still sends an admin away from %s to /admin',
    async (path) => {
      (getToken as jest.Mock).mockResolvedValueOnce({
        id: 'admin-1',
        role: 'ADMIN',
      });

      const response = await middleware(makeRequest(path));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/admin');
    }
  );

  describe('workspace pages (/terminal and /free)', () => {
    it.each([
      '/terminal',
      '/terminal/anything',
      '/free',
      '/free/anything',
      '/th/terminal',
      '/th/free',
    ])(
      'sends a signed-out visitor from %s to /login with a return address',
      async (path) => {
        (getToken as jest.Mock).mockResolvedValueOnce(null);

        const response = await middleware(makeRequest(path));

        expect(response.status).toBe(307);
        const location = response.headers.get('location');
        expect(location).toContain('/login');
        expect(location).toContain(`callbackUrl=${encodeURIComponent(path)}`);
      }
    );

    it.each(['/terminal', '/free'])(
      'passes a signed-in visitor through to %s',
      async (path) => {
        (getToken as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });

        const response = await middleware(makeRequest(path));

        expect(getToken).toHaveBeenCalledTimes(1);
        expect(response.headers.get('location')).toBeNull();
      }
    );
  });

  describe('segment-boundary matching of the protected prefixes', () => {
    it.each([
      '/freebies',
      '/free-trial',
      '/terminals',
      '/terminal-guide',
      '/dashboards',
      '/alertsmith',
      '/settingsx',
      '/administrator',
      '/notifications-help',
      '/charts2',
    ])(
      'does not gate %s, a sibling that only shares the letters',
      async (path) => {
        const response = await middleware(makeRequest(path));

        expect(getToken).not.toHaveBeenCalled();
        expect(response.headers.get('location')).toBeNull();
      }
    );

    it.each([
      '/dashboard',
      '/dashboard/x',
      '/alerts',
      '/alerts/new',
      '/charts/XAUUSD/M15',
      '/settings',
      '/settings/profile',
      '/admin',
      '/admin/users',
      '/notifications',
      '/affiliate/dashboard',
      '/pro/currency-index',
    ])('still gates %s', async (path) => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const response = await middleware(makeRequest(path));

      expect(getToken).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(307);
    });

    it('does not gate /pro itself (the trailing-slash prefix means "children only")', async () => {
      const response = await middleware(makeRequest('/pro'));

      expect(getToken).not.toHaveBeenCalled();
      expect(response.headers.get('location')).toBeNull();
    });
  });

  it('fails open (passes the request through) if getToken throws', async () => {
    (getToken as jest.Mock).mockRejectedValueOnce(new Error('decode blew up'));

    const response = await middleware(makeRequest('/settings/profile'));

    expect(response.headers.get('location')).toBeNull();
  });
});

describe('central CSRF check on state-changing /api/** requests (T1-f)', () => {
  const OWN_HOST = 'davintrade.app';
  const OWN_ORIGIN = `https://${OWN_HOST}`;
  const EVIL_ORIGIN = 'https://evil.com';

  const post = (
    path: string,
    headers: Record<string, string> = {}
  ): NextRequest =>
    makeRequest(path, {
      method: 'POST',
      headers: { host: OWN_HOST, ...headers },
    });

  /** NextResponse.next() marks itself with this header; a 403 or a redirect does not. */
  const passedThrough = (response: Response): boolean =>
    response.headers.get('x-middleware-next') === '1';

  const refusedAsCsrf = async (response: Response): Promise<boolean> =>
    response.status === 403 &&
    JSON.stringify(await response.json()) ===
      JSON.stringify({ error: 'Invalid request origin' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a cross-origin POST to /api/alerts with 403 and the same body as csrfErrorResponse()', async () => {
    const response = await middleware(
      post('/api/alerts', { origin: EVIL_ORIGIN })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(await csrfErrorResponse().json());
    expect(getToken).not.toHaveBeenCalled();
  });

  it('passes a same-origin POST to /api/alerts through', async () => {
    const response = await middleware(
      post('/api/alerts', { origin: OWN_ORIGIN })
    );

    expect(passedThrough(response)).toBe(true);
  });

  it('passes the apex/www counterpart of this host, as lib/csrf.ts does', async () => {
    const response = await middleware(
      post('/api/alerts', { origin: `https://www.${OWN_HOST}` })
    );

    expect(passedThrough(response)).toBe(true);
  });

  it.each([
    `https://${OWN_HOST}.evil.com`,
    `https://evil-${OWN_HOST}`,
    `http://${OWN_HOST}:8443`,
    'null',
    'not a url',
  ])('refuses the look-alike or unparsable Origin %s', async (origin) => {
    const response = await middleware(post('/api/alerts', { origin }));

    expect(await refusedAsCsrf(response)).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'refuses a cross-origin %s',
    async (method) => {
      const response = await middleware(
        makeRequest('/api/alerts/abc', {
          method,
          headers: { host: OWN_HOST, origin: EVIL_ORIGIN },
        })
      );

      expect(await refusedAsCsrf(response)).toBe(true);
    }
  );

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'does not check a %s, even with a cross-origin Origin',
    async (method) => {
      const response = await middleware(
        makeRequest('/api/alerts', {
          method,
          headers: { host: OWN_HOST, origin: EVIL_ORIGIN },
        })
      );

      expect(passedThrough(response)).toBe(true);
      expect(validateOrigin).not.toHaveBeenCalled();
    }
  );

  it('calls validateOrigin with the request itself', async () => {
    const request = post('/api/alerts', { origin: OWN_ORIGIN });

    await middleware(request);

    expect(validateOrigin).toHaveBeenCalledTimes(1);
    expect(validateOrigin).toHaveBeenCalledWith(request);
  });

  describe("without an Origin header the browser's Sec-Fetch-Site decides", () => {
    it.each(['cross-site', 'same-site'])(
      'refuses Sec-Fetch-Site: %s',
      async (site) => {
        const response = await middleware(
          post('/api/alerts', { 'sec-fetch-site': site })
        );

        expect(await refusedAsCsrf(response)).toBe(true);
      }
    );

    it.each([
      { 'sec-fetch-site': 'same-origin' },
      { 'sec-fetch-site': 'none' },
      {},
    ])(
      'passes %j (same-origin, a typed address, or a non-browser client)',
      async (headers) => {
        const response = await middleware(post('/api/alerts', headers));

        expect(passedThrough(response)).toBe(true);
      }
    );
  });

  describe('machine callers authenticated by a signature or a secret are exempt', () => {
    it.each([
      '/api/webhooks/stripe',
      '/api/webhooks/dlocal',
      '/api/webhooks/riseworks',
      '/api/cron/check-expiring-subscriptions',
      '/api/cron/world-gold',
    ])('%s, with no Origin and with a foreign one', async (path) => {
      const withoutOrigin = await middleware(post(path));
      const foreign = await middleware(post(path, { origin: EVIL_ORIGIN }));
      const crossSite = await middleware(
        post(path, { 'sec-fetch-site': 'cross-site' })
      );

      expect(passedThrough(withoutOrigin)).toBe(true);
      expect(passedThrough(foreign)).toBe(true);
      expect(passedThrough(crossSite)).toBe(true);
      expect(validateOrigin).not.toHaveBeenCalled();
    });

    it('a webhook path with a trailing slash is exempt too', async () => {
      const response = await middleware(
        post('/api/webhooks/stripe/', { origin: EVIL_ORIGIN })
      );

      expect(passedThrough(response)).toBe(true);
    });

    it.each([
      // siblings that only share the letters
      '/api/webhooks/stripe-evil',
      '/api/webhooks/stripex/anything',
      '/api/webhooks',
      '/api/webhooks/other',
      '/api/cron',
      '/api/cronjobs/run',
      // an admin-cookie route called by the admin UI is not a machine caller
      '/api/admin/system/jobs/expire-codes/trigger',
      '/api/admin/system/outbox/retry',
      // NextAuth's own POSTs come from the browser, same-origin
      '/api/auth/callback/credentials',
      '/api/auth/signout',
    ])('%s is NOT exempt', async (path) => {
      const response = await middleware(post(path, { origin: EVIL_ORIGIN }));

      expect(await refusedAsCsrf(response)).toBe(true);
    });
  });

  describe('a path that is /api/** only after the router resolves it is still checked', () => {
    it.each([
      ['a country prefix', '/th/api/alerts'],
      ['a doubled slash', '//api/alerts'],
      ['a percent-escaped letter', '/%61pi/alerts'],
      ['an escaped slash', '/api%2Falerts'],
      ['another case', '/API/alerts'],
      ['a malformed escape', '/api/alerts/%E0%A4%A'],
      ['a malformed escape outside /api', '/%E0%A4%A'],
    ])('%s: %s', async (_label, path) => {
      const response = await middleware(post(path, { origin: EVIL_ORIGIN }));

      expect(await refusedAsCsrf(response)).toBe(true);
    });

    it.each([
      '/api/webhooks/%73tripe',
      '/%61pi/webhooks/stripe',
      '/api/webhooks/stripe%2F..%2Falerts',
      '//api/webhooks/stripe',
    ])(
      'an encoded or doubled path never reaches an exemption: %s',
      async (path) => {
        const response = await middleware(post(path, { origin: EVIL_ORIGIN }));

        expect(await refusedAsCsrf(response)).toBe(true);
      }
    );

    it('a country-prefixed same-origin POST is rewritten as before', async () => {
      const response = await middleware(
        post('/th/api/alerts', { origin: OWN_ORIGIN })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-rewrite')).toContain(
        '/api/alerts'
      );
    });
  });

  it('does not check a POST that is not aimed at /api/** (a Server Action posts to its page)', async () => {
    (getToken as jest.Mock).mockResolvedValueOnce({ id: 'user-1' });

    const response = await middleware(
      post('/dashboard', { origin: EVIL_ORIGIN })
    );

    expect(validateOrigin).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  it('refuses before the auth gate: no token is read for a refused request', async () => {
    await middleware(post('/api/alerts', { origin: EVIL_ORIGIN }));

    expect(getToken).not.toHaveBeenCalled();
  });

  it('is outside the fail-open catch: if validateOrigin throws, the request is not passed through', async () => {
    (validateOrigin as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await expect(
      middleware(post('/api/alerts', { origin: OWN_ORIGIN }))
    ).rejects.toThrow('boom');
  });

  it('a token decode error does not open the check (the check runs first; the catch only wraps the auth gate)', async () => {
    (getToken as jest.Mock).mockRejectedValue(new Error('decode blew up'));

    const refused = await middleware(
      post('/api/alerts', { origin: EVIL_ORIGIN })
    );

    expect(await refusedAsCsrf(refused)).toBe(true);
    (getToken as jest.Mock).mockReset();
  });
});
