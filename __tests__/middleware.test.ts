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

  it('fails open (passes the request through) if getToken throws', async () => {
    (getToken as jest.Mock).mockRejectedValueOnce(new Error('decode blew up'));

    const response = await middleware(makeRequest('/settings/profile'));

    expect(response.headers.get('location')).toBeNull();
  });
});
