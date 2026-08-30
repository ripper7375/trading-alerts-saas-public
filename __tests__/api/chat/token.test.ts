/**
 * GET /api/chat/token route tests (Session 14-2, Decision 1).
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

describe('GET /api/chat/token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      CHAT_JWT_SECRET: 'test-chat-jwt-secret',
      NEXT_PUBLIC_SOCKET_CHAT_URL: 'https://chat-api.davintrade.app',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

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

    const claims = jwt.verify(body.token, 'test-chat-jwt-secret') as {
      userId: string;
      name: string;
      email: string;
      tier: string;
      exp: number;
      iat: number;
    };
    expect(claims.userId).toBe('user_123');
    expect(claims.name).toBe('Ada Lovelace');
    expect(claims.email).toBe('ada@example.com');
    expect(claims.tier).toBe('PRO');
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('defaults tier to FREE when the session omits it', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'user_456', name: null, email: 'guest@example.com' },
    });

    const response = await GET();
    const body = await response.json();
    const claims = jwt.verify(body.token, 'test-chat-jwt-secret') as {
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
    const claims = jwt.verify(body.token, 'test-nextauth-secret') as {
      userId: string;
    };
    expect(claims.userId).toBe('user_789');
  });
});
