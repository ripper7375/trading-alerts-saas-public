/**
 * @jest-environment node
 */
/**
 * `forwardedRequestContext()` also carries the reader's language and formats
 * to operation-service, so the e-mail it sends (verification, password reset,
 * account deletion) is written in them.
 */
import { forwardedRequestContext } from '@/lib/operation-service/client';

function req(headers: Record<string, string>): {
  headers: { get(name: string): string | null };
} {
  const map = new Headers(headers);
  return { headers: { get: (name) => map.get(name) } };
}

describe('forwardedRequestContext: e-mail locale', () => {
  it('forwards the language and formats from the locale cookies', () => {
    const headers = forwardedRequestContext(
      req({
        cookie:
          'next-auth.session-token=secret; davintrade-locale=th; davintrade-formats=DMY.24h',
      })
    );
    expect(headers['x-email-language']).toBe('th');
    expect(headers['x-email-formats']).toBe('DMY.24h');
  });

  it('forwards a pinned timezone, else the one detected from the IP', () => {
    expect(
      forwardedRequestContext(
        req({
          cookie: 'davintrade-timezone=Europe%2FParis',
          'x-vercel-ip-timezone': 'Asia/Bangkok',
        })
      )['x-email-timezone']
    ).toBe('Europe/Paris');
    expect(
      forwardedRequestContext(req({ 'x-vercel-ip-timezone': 'Asia/Bangkok' }))[
        'x-email-timezone'
      ]
    ).toBe('Asia/Bangkok');
    expect(
      forwardedRequestContext(req({ 'cf-timezone': 'Asia/Tokyo' }))[
        'x-email-timezone'
      ]
    ).toBe('Asia/Tokyo');
  });

  it('never forwards the session cookie or any other cookie', () => {
    const headers = forwardedRequestContext(
      req({ cookie: 'next-auth.session-token=secret; davintrade-locale=th' })
    );
    expect(Object.values(headers).join(' ')).not.toContain('secret');
    expect(headers['cookie']).toBeUndefined();
  });

  it('forwards nothing for a cookie or timezone that is not valid', () => {
    const headers = forwardedRequestContext(
      req({
        cookie: 'davintrade-locale=klingon; davintrade-formats=XYZ',
        'x-vercel-ip-timezone': 'Mars/Base',
      })
    );
    expect(headers['x-email-language']).toBeUndefined();
    expect(headers['x-email-formats']).toBeUndefined();
    expect(headers['x-email-timezone']).toBeUndefined();
  });

  it('still forwards the headers it always did', () => {
    const headers = forwardedRequestContext(
      req({
        'user-agent': 'UA',
        'x-forwarded-for': '1.2.3.4',
        cookie: 'davintrade-locale=de',
      })
    );
    expect(headers['user-agent']).toBe('UA');
    expect(headers['x-forwarded-for']).toBe('1.2.3.4');
    expect(headers['x-email-language']).toBe('de');
  });
});
