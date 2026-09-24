/**
 * middleware.ts tests (Session 3-3) — the guard on the (dashboard) route
 * group's page paths. getToken() itself is mocked; these tests only cover
 * this file's own branching (redirect / pass-through / fail-open).
 */
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { middleware } from '@/middleware';

function makeRequest(pathname: string): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    nextUrl: { pathname },
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

  it('fails open (passes the request through) if getToken throws', async () => {
    (getToken as jest.Mock).mockRejectedValueOnce(new Error('decode blew up'));

    const response = await middleware(makeRequest('/settings/profile'));

    expect(response.headers.get('location')).toBeNull();
  });
});
