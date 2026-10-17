/**
 * @jest-environment node
 */
/**
 * Unit Tests: CSRF origin validation
 * Tests validateOrigin() and csrfErrorResponse() in lib/csrf.ts
 *
 * Every case runs twice: with a Request passed in (as middleware does) and
 * with no argument, reading next/headers (as Route Handlers do).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockHeaders = jest.fn();

jest.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';

type EnvKey = 'NODE_ENV' | 'NEXTAUTH_URL';
type Entry = 'request' | 'next/headers';

const ENTRIES: Entry[] = ['request', 'next/headers'];

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    Reflect.set(process.env, key, value);
  }
}

async function check(
  headers: Record<string, string>,
  entry: Entry
): Promise<boolean> {
  if (entry === 'request') {
    return validateOrigin(
      new Request('https://davintrade.app/api/auth/token-login', {
        method: 'POST',
        headers,
      })
    );
  }
  mockHeaders.mockResolvedValue(new Headers(headers));
  return validateOrigin();
}

describe('validateOrigin', () => {
  const saved = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    mockHeaders.mockReset();
    saved.set('NODE_ENV', process.env.NODE_ENV);
    saved.set('NEXTAUTH_URL', process.env['NEXTAUTH_URL']);
    // A production deployment unless a test says otherwise
    setEnv('NODE_ENV', 'production');
    setEnv('NEXTAUTH_URL', undefined);
  });

  afterEach(() => {
    setEnv('NODE_ENV', saved.get('NODE_ENV'));
    setEnv('NEXTAUTH_URL', saved.get('NEXTAUTH_URL'));
  });

  describe.each(ENTRIES)('with %s', (entry) => {
    describe('Origin present', () => {
      it('allows an exact match of the request host', async () => {
        await expect(
          check(
            { origin: 'https://davintrade.app', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(true);
      });

      it.each([
        ['https://davintrade.app.attacker.com', 'suffix spoof'],
        ['https://attacker-davintrade.app', 'prefix spoof'],
        ['https://davintrade.app@attacker.com', 'userinfo trick'],
        ['https://sub.davintrade.app', 'sibling subdomain'],
        ['https://davintrade.app:8443', 'different port'],
        ['https://attacker.com', 'unrelated host'],
        ['null', 'sandboxed context'],
        ['not a url', 'unparsable'],
      ])('rejects Origin %s (%s)', async (origin) => {
        await expect(
          check({ origin, host: 'davintrade.app' }, entry)
        ).resolves.toBe(false);
      });

      it('rejects an Origin when the request has no host', async () => {
        await expect(
          check({ origin: 'https://davintrade.app' }, entry)
        ).resolves.toBe(false);
      });

      it('rejects http:// for the host in production', async () => {
        await expect(
          check(
            { origin: 'http://davintrade.app', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(false);
      });

      it.each(['development', 'test'])(
        'allows http:// for the host when NODE_ENV is %s',
        async (nodeEnv) => {
          setEnv('NODE_ENV', nodeEnv);

          await expect(
            check(
              { origin: 'http://localhost:3000', host: 'localhost:3000' },
              entry
            )
          ).resolves.toBe(true);
          await expect(
            check(
              { origin: 'http://davintrade.app', host: 'davintrade.app' },
              entry
            )
          ).resolves.toBe(true);
        }
      );

      it('treats the apex and www hosts as the same site', async () => {
        await expect(
          check(
            { origin: 'https://www.davintrade.app', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(true);
        await expect(
          check(
            { origin: 'https://davintrade.app', host: 'www.davintrade.app' },
            entry
          )
        ).resolves.toBe(true);
      });

      it('does not let www widen the scheme or the port', async () => {
        await expect(
          check(
            { origin: 'http://www.davintrade.app', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(false);
        await expect(
          check(
            {
              origin: 'https://www.davintrade.app:8443',
              host: 'davintrade.app',
            },
            entry
          )
        ).resolves.toBe(false);
      });

      it('uses x-forwarded-host over host, and its first entry', async () => {
        const forwarded = {
          host: 'internal.example',
          'x-forwarded-host': 'davintrade.app, proxy.internal',
        };

        await expect(
          check({ ...forwarded, origin: 'https://davintrade.app' }, entry)
        ).resolves.toBe(true);
        await expect(
          check({ ...forwarded, origin: 'https://internal.example' }, entry)
        ).resolves.toBe(false);
        await expect(
          check({ ...forwarded, origin: 'https://proxy.internal' }, entry)
        ).resolves.toBe(false);
      });
    });

    describe('NEXTAUTH_URL', () => {
      it('allows its exact origin even when the host differs', async () => {
        setEnv('NEXTAUTH_URL', 'https://davintrade.app');

        await expect(
          check(
            { origin: 'https://davintrade.app', host: 'internal.example' },
            entry
          )
        ).resolves.toBe(true);
      });

      it('does not allow a look-alike of its origin', async () => {
        setEnv('NEXTAUTH_URL', 'https://davintrade.app');

        await expect(
          check(
            {
              origin: 'https://davintrade.app.attacker.com',
              host: 'internal.example',
            },
            entry
          )
        ).resolves.toBe(false);
      });

      it('ignores a value that is not a URL', async () => {
        setEnv('NEXTAUTH_URL', 'davintrade.app');

        await expect(
          check(
            { origin: 'https://davintrade.app', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(true);
        await expect(
          check(
            { origin: 'https://attacker.com', host: 'davintrade.app' },
            entry
          )
        ).resolves.toBe(false);
      });
    });

    describe('Origin missing', () => {
      it.each(['cross-site', 'same-site'])(
        'rejects Sec-Fetch-Site: %s',
        async (site) => {
          await expect(
            check({ host: 'davintrade.app', 'sec-fetch-site': site }, entry)
          ).resolves.toBe(false);
        }
      );

      it.each(['same-origin', 'none'])(
        'allows Sec-Fetch-Site: %s',
        async (site) => {
          await expect(
            check({ host: 'davintrade.app', 'sec-fetch-site': site }, entry)
          ).resolves.toBe(true);
        }
      );

      it('allows a request with no Sec-Fetch-Site (non-browser client)', async () => {
        await expect(check({ host: 'davintrade.app' }, entry)).resolves.toBe(
          true
        );
      });
    });
  });

  describe('where the headers come from', () => {
    it('reads the Request it is given and does not touch next/headers', async () => {
      await expect(
        validateOrigin(
          new Request('https://davintrade.app/api/x', {
            method: 'POST',
            headers: {
              origin: 'https://davintrade.app',
              host: 'davintrade.app',
            },
          })
        )
      ).resolves.toBe(true);

      expect(mockHeaders).not.toHaveBeenCalled();
    });

    it('falls back to next/headers when called with no argument', async () => {
      mockHeaders.mockResolvedValue(
        new Headers({
          origin: 'https://davintrade.app.attacker.com',
          host: 'davintrade.app',
        })
      );

      await expect(validateOrigin()).resolves.toBe(false);
      expect(mockHeaders).toHaveBeenCalledTimes(1);
    });
  });
});

describe('csrfErrorResponse', () => {
  it('returns a 403 JSON error', async () => {
    const response = csrfErrorResponse();

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request origin',
    });
  });
});
