/**
 * @jest-environment node
 */
/**
 * token-register and forgot-password check the Cloudflare Turnstile token (CODE-15).
 *
 * With `TURNSTILE_SECRET_KEY` set, a request with no valid token is answered 400
 * `TURNSTILE_FAILED` BEFORE anything else happens: no operation-service call, no account lookup,
 * no e-mail, no throttle counter (so a bot cannot burn an address's budget of three reset
 * e-mails an hour). The answer says nothing about the account. With the secret unset the routes
 * behave as before.
 */

jest.mock('@/lib/csrf', () => ({
  validateOrigin: jest.fn(() => Promise.resolve(true)),
  csrfErrorResponse: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Invalid request origin' }), {
        status: 403,
      })
  ),
}));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

const mockSendPasswordResetEmail = jest.fn();
jest.mock('@/lib/email/email', () => ({
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
}));

const mockRedis = {
  get: jest.fn(async () => null),
  incr: jest.fn(async () => 1),
  decr: jest.fn(async () => 0),
  ttl: jest.fn(async () => -1),
  expire: jest.fn(async () => 1),
  del: jest.fn(async () => 0),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

import type { NextRequest } from 'next/server';

import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as tokenRegister } from '@/app/api/auth/token-register/route';
import { validateOrigin } from '@/lib/csrf';

const SECRET = 'routes-turnstile-test-secret';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const IP = '203.0.113.7';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

interface Installed {
  fetchMock: jest.Mock;
  siteverifyCalls: () => Array<[unknown, { body: unknown }]>;
  upstreamCalls: () => unknown[][];
}

/** Cloudflare answers `verdict`; any other URL (operation-service) answers `upstream`. */
function installFetch(
  verdict: { success: boolean } | Error,
  upstream: { status: number; body: unknown } = {
    status: 201,
    body: { userId: 'user-1', message: 'ok', autoVerified: false },
  }
): Installed {
  const fetchMock = jest.fn(async (input: unknown) => {
    if (urlOf(input).startsWith(SITEVERIFY)) {
      if (verdict instanceof Error) throw verdict;
      return new Response(JSON.stringify(verdict), { status: 200 });
    }
    return new Response(JSON.stringify(upstream.body), {
      status: upstream.status,
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return {
    fetchMock,
    siteverifyCalls: () =>
      fetchMock.mock.calls.filter((call) =>
        urlOf(call[0]).startsWith(SITEVERIFY)
      ) as unknown as Array<[unknown, { body: unknown }]>,
    upstreamCalls: () =>
      fetchMock.mock.calls.filter(
        (call) => !urlOf(call[0]).startsWith(SITEVERIFY)
      ),
  };
}

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': IP },
    body: JSON.stringify(body),
  });
}

const REGISTER = {
  email: 'alice@example.com',
  password: 'Sup3r$ecret1',
  name: 'Alice',
};

const ENV_KEYS = ['TURNSTILE_SECRET_KEY', 'NODE_ENV'] as const;

describe('CODE-15: the register and forgot-password routes check the Turnstile token', () => {
  const saved = new Map<string, string | undefined>();
  const originalFetch = global.fetch;

  beforeAll(() => {
    for (const key of ENV_KEYS) saved.set(key, process.env[key]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', name: 'Alice' });
    mockUserUpdate.mockResolvedValue({ id: 'user-1' });
    mockSendPasswordResetEmail.mockResolvedValue({ success: true });
    (validateOrigin as jest.Mock).mockResolvedValue(true);
    setEnv('TURNSTILE_SECRET_KEY', SECRET);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    for (const key of ENV_KEYS) setEnv(key, saved.get(key));
  });

  describe('POST /api/auth/token-register', () => {
    const call = (body: unknown) =>
      tokenRegister(post('/api/auth/token-register', body) as NextRequest);

    it('registers with a token Cloudflare accepts, sending it the token and the client address, and does not forward the token upstream', async () => {
      const { siteverifyCalls, upstreamCalls } = installFetch({
        success: true,
      });

      const response = await call({
        ...REGISTER,
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(201);
      expect((await response.json()).userId).toBe('user-1');
      expect(siteverifyCalls()).toHaveLength(1);
      const sent = new URLSearchParams(String(siteverifyCalls()[0]?.[1].body));
      expect(sent.get('secret')).toBe(SECRET);
      expect(sent.get('response')).toBe('cf-token-1');
      expect(sent.get('remoteip')).toBe(IP);
      expect(upstreamCalls()).toHaveLength(1);
      const forwarded = await (upstreamCalls()[0]?.[0] as Request).text();
      expect(JSON.parse(forwarded)).toEqual(REGISTER);
    });

    it.each([
      ['no token', undefined],
      ['an empty token', ''],
      ['a token that is not a string', 42],
    ])(
      'answers 400 TURNSTILE_FAILED for %s and never reaches operation-service',
      async (_label, turnstileToken) => {
        const { fetchMock } = installFetch({ success: true });

        const response = await call({
          ...REGISTER,
          ...(turnstileToken === undefined ? {} : { turnstileToken }),
        });

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('TURNSTILE_FAILED');
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );

    it('answers 400 TURNSTILE_FAILED when Cloudflare rejects the token, and never reaches operation-service', async () => {
      const { upstreamCalls } = installFetch({ success: false });

      const response = await call({ ...REGISTER, turnstileToken: 'cf-bad' });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('TURNSTILE_FAILED');
      expect(upstreamCalls()).toHaveLength(0);
    });

    it('fails closed when Cloudflare cannot be reached', async () => {
      const { upstreamCalls } = installFetch(new TypeError('fetch failed'));

      const response = await call({
        ...REGISTER,
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('TURNSTILE_FAILED');
      expect(upstreamCalls()).toHaveLength(0);
    });

    it('answers a CSRF failure before it asks Cloudflare anything', async () => {
      (validateOrigin as jest.Mock).mockResolvedValueOnce(false);
      const { fetchMock } = installFetch({ success: true });

      const response = await call({
        ...REGISTER,
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps the 400 INVALID_REQUEST for a body without e-mail or password (no Cloudflare call)', async () => {
      const { fetchMock } = installFetch({ success: true });

      const response = await call({ email: 'alice@example.com' });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('INVALID_REQUEST');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not ask Cloudflare when the secret is unset (local development)', async () => {
      setEnv('TURNSTILE_SECRET_KEY', undefined);
      const { siteverifyCalls, upstreamCalls } = installFetch({
        success: false,
      });

      const response = await call(REGISTER);

      expect(response.status).toBe(201);
      expect(siteverifyCalls()).toHaveLength(0);
      expect(upstreamCalls()).toHaveLength(1);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    const call = (body: unknown) =>
      forgotPassword(post('/api/auth/forgot-password', body));

    it('sends the reset e-mail for a token Cloudflare accepts (the answer is the usual one)', async () => {
      const { siteverifyCalls } = installFetch({ success: true });

      const response = await call({
        email: 'alice@example.com',
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(200);
      expect((await response.json()).success).toBe(true);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const sent = new URLSearchParams(String(siteverifyCalls()[0]?.[1].body));
      expect(sent.get('secret')).toBe(SECRET);
      expect(sent.get('response')).toBe('cf-token-1');
      expect(sent.get('remoteip')).toBe(IP);
    });

    it.each([
      ['no token', undefined],
      ['an empty token', ''],
      ['a token that is not a string', { token: 'x' }],
    ])(
      'answers 400 TURNSTILE_FAILED for %s: no lookup, no e-mail, no throttle counter',
      async (_label, turnstileToken) => {
        const { fetchMock } = installFetch({ success: true });

        const response = await call({
          email: 'alice@example.com',
          ...(turnstileToken === undefined ? {} : { turnstileToken }),
        });

        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('TURNSTILE_FAILED');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockUserFindUnique).not.toHaveBeenCalled();
        expect(mockUserUpdate).not.toHaveBeenCalled();
        expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
        expect(mockRedis.incr).not.toHaveBeenCalled();
      }
    );

    it('answers 400 TURNSTILE_FAILED when Cloudflare rejects, and leaves the account and the budget alone', async () => {
      installFetch({ success: false });

      const response = await call({
        email: 'alice@example.com',
        turnstileToken: 'cf-bad',
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('TURNSTILE_FAILED');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('gives the same refusal for a known and an unknown address (it tells nothing about the account)', async () => {
      installFetch({ success: false });
      mockUserFindUnique.mockResolvedValue(null);

      const known = await call({ email: 'alice@example.com' });
      const unknown = await call({ email: 'nobody@example.com' });

      expect(known.status).toBe(unknown.status);
      expect(await known.text()).toBe(await unknown.text());
    });

    it('fails closed when Cloudflare cannot be reached', async () => {
      installFetch(new TypeError('fetch failed'));

      const response = await call({
        email: 'alice@example.com',
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('TURNSTILE_FAILED');
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('keeps the validation error for a malformed address (no Cloudflare call)', async () => {
      const { fetchMock } = installFetch({ success: true });

      const response = await call({ email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('Invalid email format');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers a CSRF failure before it asks Cloudflare anything', async () => {
      (validateOrigin as jest.Mock).mockResolvedValueOnce(false);
      const { fetchMock } = installFetch({ success: true });

      const response = await call({
        email: 'alice@example.com',
        turnstileToken: 'cf-token-1',
      });

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not ask Cloudflare when the secret is unset (local development)', async () => {
      setEnv('TURNSTILE_SECRET_KEY', undefined);
      const { fetchMock } = installFetch({ success: false });

      const response = await call({ email: 'alice@example.com' });

      expect(response.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });
  });
});
