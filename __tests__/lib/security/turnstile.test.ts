/**
 * @jest-environment node
 */
/**
 * Server-side Cloudflare Turnstile check (CODE-15).
 *
 * With `TURNSTILE_SECRET_KEY` unset the check is skipped (local development). With it set, the
 * check FAILS CLOSED: a missing or malformed token, a refusal, an unreachable Cloudflare, a bad
 * answer and a timeout all refuse. Neither the secret nor the token ever reaches a log.
 */

const SECRET = 'turnstile-test-secret-0123456789';
const TOKEN = 'turnstile-test-token-abcdef';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Verifier = typeof import('@/lib/security/turnstile');

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

/** A fresh copy of the module (it remembers whether it already warned). */
function load(): Verifier {
  let loaded: Verifier | undefined;
  jest.isolateModules(() => {
    loaded = require('@/lib/security/turnstile') as Verifier;
  });
  return loaded as Verifier;
}

function cloudflareAnswers(body: unknown, status = 200): jest.Mock {
  const fetchMock = jest.fn(
    async () => new Response(JSON.stringify(body), { status })
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function sentBody(fetchMock: jest.Mock): URLSearchParams {
  const init = fetchMock.mock.calls[0]?.[1] as { body: unknown };
  return new URLSearchParams(String(init.body));
}

describe('CODE-15: the Turnstile verifier', () => {
  const saved = new Map<string, string | undefined>();
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  const originalFetch = global.fetch;

  beforeAll(() => {
    for (const key of ['TURNSTILE_SECRET_KEY', 'NODE_ENV']) {
      saved.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    setEnv('TURNSTILE_SECRET_KEY', SECRET);
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    for (const [key, value] of saved) setEnv(key, value);
  });

  describe('switched off (no secret): local development', () => {
    it.each([undefined, '', '   '])(
      'is disabled and skips the check when the secret is %j',
      async (secret) => {
        setEnv('TURNSTILE_SECRET_KEY', secret);
        const fetchMock = cloudflareAnswers({ success: false });
        const { isTurnstileEnabled, verifyTurnstile } = load();

        expect(isTurnstileEnabled()).toBe(false);
        await expect(verifyTurnstile(undefined)).resolves.toEqual({
          ok: true,
          skipped: true,
        });
        await expect(verifyTurnstile(TOKEN, '203.0.113.7')).resolves.toEqual({
          ok: true,
          skipped: true,
        });
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );

    it('warns once in production that the check is off, and never in development or tests', async () => {
      setEnv('TURNSTILE_SECRET_KEY', undefined);

      setEnv('NODE_ENV', 'production');
      const production = load();
      await production.verifyTurnstile(undefined);
      await production.verifyTurnstile(undefined);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('TURNSTILE_SECRET_KEY');

      warn.mockClear();
      setEnv('NODE_ENV', 'test');
      await load().verifyTurnstile(undefined);
      setEnv('NODE_ENV', 'development');
      await load().verifyTurnstile(undefined);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('switched on (secret set)', () => {
    it('is enabled', () => {
      expect(load().isTurnstileEnabled()).toBe(true);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
      ['a blank string', '   '],
      ['a number', 12345],
      ['an object', { token: TOKEN }],
      ['an array', [TOKEN]],
      ['a string over 2048 characters', 'x'.repeat(2049)],
    ])(
      'refuses %s without asking Cloudflare',
      async (_label, token: unknown) => {
        const fetchMock = cloudflareAnswers({ success: true });

        await expect(load().verifyTurnstile(token)).resolves.toEqual({
          ok: false,
          reason: 'invalid_token',
        });
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );

    it('accepts a token of exactly 2048 characters (the Cloudflare maximum)', async () => {
      cloudflareAnswers({ success: true });

      await expect(load().verifyTurnstile('x'.repeat(2048))).resolves.toEqual({
        ok: true,
        skipped: false,
      });
    });

    it('posts the secret, the token and the client address to the siteverify endpoint', async () => {
      const fetchMock = cloudflareAnswers({
        success: true,
        hostname: 'davintrade.app',
      });

      await expect(
        load().verifyTurnstile(TOKEN, '203.0.113.7')
      ).resolves.toEqual({ ok: true, skipped: false });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [
        string,
        RequestInit & { headers: Record<string, string> },
      ];
      expect(url).toBe(VERIFY_URL);
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded'
      );
      const body = sentBody(fetchMock);
      expect(body.get('secret')).toBe(SECRET);
      expect(body.get('response')).toBe(TOKEN);
      expect(body.get('remoteip')).toBe('203.0.113.7');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('trims the token and leaves the client address out when there is none', async () => {
      const fetchMock = cloudflareAnswers({ success: true });

      await load().verifyTurnstile(`  ${TOKEN}  `, null);
      await load().verifyTurnstile(TOKEN);

      const first = new URLSearchParams(
        String((fetchMock.mock.calls[0]?.[1] as { body: unknown }).body)
      );
      const second = new URLSearchParams(
        String((fetchMock.mock.calls[1]?.[1] as { body: unknown }).body)
      );
      expect(first.get('response')).toBe(TOKEN);
      expect(first.has('remoteip')).toBe(false);
      expect(second.has('remoteip')).toBe(false);
    });

    it('refuses when Cloudflare says the token is not valid', async () => {
      cloudflareAnswers({
        success: false,
        'error-codes': ['invalid-input-response'],
      });

      await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
        ok: false,
        reason: 'rejected',
      });
    });

    it.each(['invalid-input-secret', 'missing-input-secret'])(
      'names a secret key Cloudflare refuses even though it answers HTTP 400 (the real answer to a wrong secret): %s',
      async (code) => {
        cloudflareAnswers({ success: false, 'error-codes': [code] }, 400);

        await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
          ok: false,
          reason: 'unavailable',
        });

        expect(error).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0]?.[0])).toContain(code);
        expect(
          JSON.stringify([...error.mock.calls, ...warn.mock.calls])
        ).not.toContain(SECRET);
      }
    );

    it('logs a secret key Cloudflare does not accept (the code only, never the secret), and logs an ordinary refusal not at all', async () => {
      cloudflareAnswers({
        success: false,
        'error-codes': ['invalid-input-secret'],
      });
      await load().verifyTurnstile(TOKEN);

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]?.[0])).toContain(
        'invalid-input-secret'
      );
      expect(JSON.stringify(error.mock.calls)).not.toContain(SECRET);

      error.mockClear();
      cloudflareAnswers({
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      });
      await load().verifyTurnstile(TOKEN);
      expect(error).not.toHaveBeenCalled();
    });

    it.each([
      ['no success field', {}],
      ['a string "true"', { success: 'true' }],
      ['the number 1', { success: 1 }],
      ['null', null],
      ['an array', [{ success: true }]],
    ])(
      'refuses an answer with %s (only boolean true passes)',
      async (_l, answer) => {
        cloudflareAnswers(answer);

        await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
          ok: false,
          reason: 'rejected',
        });
      }
    );

    it('refuses (fails closed) when Cloudflare cannot be reached', async () => {
      global.fetch = jest.fn(async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch;

      await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
        ok: false,
        reason: 'unavailable',
      });
    });

    it.each([500, 502, 429, 403])(
      'refuses (fails closed) on HTTP %i from Cloudflare, even with a success body',
      async (status) => {
        cloudflareAnswers({ success: true }, status);

        await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
          ok: false,
          reason: 'unavailable',
        });
      }
    );

    it('refuses (fails closed) on an answer that is not JSON', async () => {
      global.fetch = jest.fn(
        async () => new Response('<html>oops</html>', { status: 200 })
      ) as unknown as typeof fetch;

      await expect(load().verifyTurnstile(TOKEN)).resolves.toEqual({
        ok: false,
        reason: 'unavailable',
      });
    });

    it('gives up after 5 seconds and refuses', async () => {
      jest.useFakeTimers();
      let signal: AbortSignal | undefined;
      global.fetch = jest.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init?.signal as AbortSignal;
            signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      ) as unknown as typeof fetch;

      let settled = false;
      const pending = load()
        .verifyTurnstile(TOKEN)
        .then((verdict) => {
          settled = true;
          return verdict;
        });

      await jest.advanceTimersByTimeAsync(4999);
      expect(settled).toBe(false);
      expect(signal?.aborted).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({
        ok: false,
        reason: 'unavailable',
      });
      expect(signal?.aborted).toBe(true);
    });

    it('stops the timer once Cloudflare has answered', async () => {
      jest.useFakeTimers();
      cloudflareAnswers({ success: true });

      await load().verifyTurnstile(TOKEN);

      expect(jest.getTimerCount()).toBe(0);
    });

    it('never writes the secret or the token to a log, on any outcome', async () => {
      const outcomes: Array<() => void> = [
        () => cloudflareAnswers({ success: false }),
        () => cloudflareAnswers({ success: true }, 500),
        () => {
          global.fetch = jest.fn(async () => {
            throw new Error(`boom ${SECRET} ${TOKEN}`);
          }) as unknown as typeof fetch;
        },
        () => cloudflareAnswers({ success: true }),
      ];
      for (const arrange of outcomes) {
        arrange();
        await load().verifyTurnstile(TOKEN, '203.0.113.7');
      }

      const written = JSON.stringify([
        ...warn.mock.calls,
        ...error.mock.calls,
        ...log.mock.calls,
      ]);
      expect(written).not.toContain(SECRET);
      expect(written).not.toContain(TOKEN);
    });
  });
});
