/** @jest-environment node */
/**
 * The one-shot `?lang=` setter (Q1, M1.0). davintrade.com links to unprefixed
 * URLs for languages that have no country prefix; the middleware writes the
 * language cookie once and redirects to the same URL without the parameter.
 * Real NextRequest objects, so cookies and query strings behave as deployed.
 */
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { middleware } from '@/middleware';

const ORIGIN = 'https://davintrade.app';

function run(path: string, method = 'GET'): ReturnType<typeof middleware> {
  return middleware(new NextRequest(`${ORIGIN}${path}`, { method }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('?lang= on an unprefixed URL', () => {
  it('sets the language cookie and redirects without lang', async () => {
    const response = await run('/?from=dotcom&lang=es&ref=ABC');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/?from=dotcom&ref=ABC`
    );
    expect(response.cookies.get('davintrade-locale')).toMatchObject({
      value: 'es',
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    // No currency or timezone cookie: those keep .app's own resolution.
    expect(response.cookies.getAll()).toHaveLength(1);
  });

  it('keeps every other query parameter', async () => {
    const response = await run(
      '/register?lang=zh-TW&attr_id=a1&utm_source=x&utm_campaign=y'
    );

    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/register?attr_id=a1&utm_source=x&utm_campaign=y`
    );
    expect(response.cookies.get('davintrade-locale')?.value).toBe('zh-TW');
  });

  it('marks the cookie Secure in production only', async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env['NODE_ENV'];
    try {
      env['NODE_ENV'] = 'production';
      const prod = await run('/pricing?lang=it');
      expect(prod.cookies.get('davintrade-locale')?.secure).toBe(true);
    } finally {
      env['NODE_ENV'] = before;
    }
    const dev = await run('/pricing?lang=it');
    expect(dev.cookies.get('davintrade-locale')?.secure).toBeFalsy();
  });

  it('runs before the auth gate, so the language survives the login bounce', async () => {
    const response = await run('/dashboard?lang=pt');

    expect(response.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('?lang= that must be ignored', () => {
  it.each([
    '/?lang=zz',
    '/?lang=ES',
    '/?lang=zh-tw',
    '/?lang=es-ES',
    '/?lang=',
  ])('ignores the unsupported value in %s', async (path) => {
    const response = await run(path);

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('davintrade-locale')).toBeUndefined();
  });

  it('lets a country prefix win', async () => {
    const response = await run('/th/pricing?lang=es');

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('davintrade-locale')?.value).toBe('th');
  });

  it('leaves /eu as it was', async () => {
    const response = await run('/eu/pricing?lang=it');

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('davintrade-locale')?.value).toBe('de');
  });

  it.each(['/api/config/affiliate?lang=es', '/%61pi/fx/rates?lang=es'])(
    'leaves the API path %s alone',
    async (path) => {
      const response = await run(path);

      expect(response.headers.get('location')).toBeNull();
      expect(response.cookies.get('davintrade-locale')).toBeUndefined();
    }
  );

  it('does not redirect a form submission', async () => {
    const response = await run('/pricing?lang=es', 'POST');

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('davintrade-locale')).toBeUndefined();
  });
});
