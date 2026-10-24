/**
 * GET /api/chat/token route tests (Session 14-2, Decision 1) and the chat
 * server's `verifyChatToken()` that consumes the token (CODE-10, WS-13).
 *
 * The verifier lives in the Contabo chat stack, which has no test runner of
 * its own; it is loaded from here so the minting side and the verifying side
 * are tested against each other (claim names, algorithm, issuer, audience and
 * lifetime must match exactly).
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetSession(),
}));

import jwt from 'jsonwebtoken';
import { GET } from '@/app/api/chat/token/route';

const ORIGINAL_ENV = process.env;
const SECRET = 'test-chat-jwt-secret';

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    CHAT_JWT_SECRET: SECRET,
    NEXT_PUBLIC_SOCKET_CHAT_URL: 'https://chat-api.davintrade.app',
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('GET /api/chat/token', () => {
  it('returns { token: null } with HTTP 200 for an unauthenticated (guest) request', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      token: null,
      url: 'https://chat-api.davintrade.app',
    });
  });

  it('returns a signed JWT carrying the expected claims for an authenticated request', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: {
        id: 'user_123',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        tier: 'PRO',
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.token).toBe('string');
    expect(body.url).toBe('https://chat-api.davintrade.app');

    const claims = jwt.verify(body.token, SECRET) as {
      userId: string;
      name: string;
      tier: string;
      exp: number;
      iat: number;
    };
    expect(claims.userId).toBe('user_123');
    expect(claims.name).toBe('Ada Lovelace');
    expect(claims.tier).toBe('PRO');
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('does not put the e-mail address in the token', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: {
        id: 'user_123',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        tier: 'PRO',
      },
    });

    const body = await (await GET()).json();

    const claims = jwt.verify(body.token, SECRET) as Record<string, unknown>;
    expect(claims).not.toHaveProperty('email');
    const rawPayload = Buffer.from(
      (body.token as string).split('.')[1],
      'base64url'
    ).toString('utf8');
    expect(rawPayload).not.toContain('ada@example.com');
  });

  it('signs with HS256 and stamps the chat issuer and audience', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user_123', name: 'Ada', tier: 'PRO' },
    });

    const body = await (await GET()).json();

    const decoded = jwt.decode(body.token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    const claims = decoded?.payload as { iss?: string; aud?: string };
    expect(claims.iss).toBe('davintrade');
    expect(claims.aud).toBe('chat-api');
  });

  it('defaults tier to FREE when the session omits it', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user_456', name: null, email: 'guest@example.com' },
    });

    const response = await GET();
    const body = await response.json();
    const claims = jwt.verify(body.token, SECRET) as {
      tier: string;
    };
    expect(claims.tier).toBe('FREE');
  });

  it('falls back to NEXTAUTH_SECRET outside production when CHAT_JWT_SECRET is unset', async () => {
    process.env['CHAT_JWT_SECRET'] = '';
    process.env['NEXTAUTH_SECRET'] = 'test-nextauth-secret';
    mockGetSession.mockResolvedValueOnce({
      user: {
        id: 'user_789',
        name: 'Guest User',
        email: 'g@example.com',
        tier: 'FREE',
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    const claims = jwt.verify(body.token, 'test-nextauth-secret', {
      algorithms: ['HS256'],
      issuer: 'davintrade',
      audience: 'chat-api',
    }) as {
      userId: string;
    };
    expect(claims.userId).toBe('user_789');
  });
});

describe('chat server verifyChatToken (CODE-10)', () => {
  type ServerAuth =
    typeof import('../../../infra/contabo-chat-stack/apps/server/src/auth');

  // The module reads CHAT_JWT_SECRET once, at import time.
  function loadVerifier(): ServerAuth {
    let loaded: ServerAuth | undefined;
    jest.isolateModules(() => {
      loaded = require('../../../infra/contabo-chat-stack/apps/server/src/auth');
    });
    return loaded as ServerAuth;
  }

  const nowSeconds = () => Math.floor(Date.now() / 1000);
  const goodClaims = { userId: 'user_1', name: 'Ada', tier: 'PRO' };
  const goodOptions: jwt.SignOptions = {
    algorithm: 'HS256',
    issuer: 'davintrade',
    audience: 'chat-api',
    expiresIn: 300,
  };
  const forge = (
    claims: Record<string, unknown> = goodClaims,
    options: jwt.SignOptions = goodOptions,
    secret: string = SECRET
  ) => jwt.sign(claims, secret, options);

  it('accepts the token the BFF route mints and exposes no e-mail', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: {
        id: 'user_123',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        tier: 'PRO',
      },
    });
    const body = await (await GET()).json();

    const identity = loadVerifier().verifyChatToken(body.token);

    expect(identity).toEqual({
      userId: 'user_123',
      name: 'Ada Lovelace',
      tier: 'PRO',
    });
    expect(identity).not.toHaveProperty('email');
  });

  it('does not pass an e-mail claim through, even from a token that carries one', () => {
    const token = forge({ ...goodClaims, email: 'ada@example.com' });

    const identity = loadVerifier().verifyChatToken(token);

    expect(identity).toEqual({ userId: 'user_1', name: 'Ada', tier: 'PRO' });
    expect(identity).not.toHaveProperty('email');
  });

  it('returns null when no token is supplied', () => {
    const { verifyChatToken } = loadVerifier();

    expect(verifyChatToken(undefined)).toBeNull();
    expect(verifyChatToken(null)).toBeNull();
    expect(verifyChatToken('')).toBeNull();
  });

  it('throws for a token that is not a string', () => {
    expect(() => loadVerifier().verifyChatToken(12345)).toThrow(
      'Malformed handshake token'
    );
  });

  it('rejects a token signed with another HMAC algorithm', () => {
    const token = forge(goodClaims, { ...goodOptions, algorithm: 'HS384' });

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(
      /invalid algorithm/
    );
  });

  it('rejects an unsigned (alg none) token', () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      ...goodClaims,
      iss: 'davintrade',
      aud: 'chat-api',
      iat: nowSeconds(),
      exp: nowSeconds() + 300,
    })}.`;

    expect(() => loadVerifier().verifyChatToken(token)).toThrow();
  });

  it.each([
    ['no issuer', { audience: 'chat-api' }],
    ['another issuer', { issuer: 'someone-else', audience: 'chat-api' }],
    ['no audience', { issuer: 'davintrade' }],
    ['another audience', { issuer: 'davintrade', audience: 'other-api' }],
  ])('rejects a token with %s', (_label, claimOptions) => {
    // An older token (before CODE-10) has neither issuer nor audience.
    const token = jwt.sign(goodClaims, SECRET, {
      algorithm: 'HS256',
      expiresIn: 300,
      ...claimOptions,
    });

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(
      /jwt (issuer|audience) invalid/
    );
  });

  it('rejects a token older than the BFF lifetime even when its exp is far out', () => {
    const issuedAt = nowSeconds() - 400;
    const token = forge(
      { ...goodClaims, iat: issuedAt, exp: issuedAt + 3600 },
      { algorithm: 'HS256', issuer: 'davintrade', audience: 'chat-api' }
    );

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(
      /maxAge exceeded/
    );
  });

  it('accepts a token that is younger than the BFF lifetime', () => {
    const issuedAt = nowSeconds() - 250;
    const token = forge(
      { ...goodClaims, iat: issuedAt, exp: issuedAt + 3600 },
      { algorithm: 'HS256', issuer: 'davintrade', audience: 'chat-api' }
    );

    expect(loadVerifier().verifyChatToken(token)).toEqual({
      userId: 'user_1',
      name: 'Ada',
      tier: 'PRO',
    });
  });

  it('rejects a token that carries no issue time', () => {
    const token = forge(goodClaims, { ...goodOptions, noTimestamp: true });

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(
      /iat required when maxAge is specified/
    );
  });

  it('rejects an expired token', () => {
    const issuedAt = nowSeconds() - 600;
    const token = forge(
      { ...goodClaims, iat: issuedAt, exp: issuedAt + 300 },
      { algorithm: 'HS256', issuer: 'davintrade', audience: 'chat-api' }
    );

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(/jwt expired/);
  });

  it('rejects a token signed with another secret', () => {
    const token = forge(goodClaims, goodOptions, 'some-other-secret');

    expect(() => loadVerifier().verifyChatToken(token)).toThrow(
      /invalid signature/
    );
  });

  it.each([
    ['userId', { name: 'Ada', tier: 'PRO' }],
    ['tier', { userId: 'user_1', name: 'Ada' }],
  ])('rejects a valid token that is missing %s', (_claim, claims) => {
    expect(() => loadVerifier().verifyChatToken(forge(claims))).toThrow(
      'Handshake token missing required claims'
    );
  });

  it('refuses to load when CHAT_JWT_SECRET is not set', () => {
    delete process.env['CHAT_JWT_SECRET'];

    expect(() => loadVerifier()).toThrow(/CHAT_JWT_SECRET is not set/);
  });

  it('builds a guest identity without any e-mail', () => {
    expect(loadVerifier().guestIdentity('sock_1')).toEqual({
      userId: 'guest_sock_1',
      tier: 'GUEST',
    });
  });
});
