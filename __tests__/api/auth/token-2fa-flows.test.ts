/**
 * token-2fa-{status,setup,verify-setup,verify,backup-codes,disable} route
 * tests (Session 3-4) — additive parallel paths to operation-service's new
 * /auth/2fa/* endpoints (lib/auth/two-factor.ts ported, deferred out of
 * Session 3-2). Same mocked-fetch style as token-login.test.ts.
 */
const mockCookieStore = {
  get: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
}));

import {
  GET as backupCodesGet,
  POST as backupCodesPost,
} from '@/app/api/auth/token-2fa-backup-codes/route';
import { POST as disable } from '@/app/api/auth/token-2fa-disable/route';
import { GET as status } from '@/app/api/auth/token-2fa-status/route';
import { POST as verify } from '@/app/api/auth/token-2fa-verify/route';
import { POST as verifySetup } from '@/app/api/auth/token-2fa-verify-setup/route';

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe('token-2fa-* routes requiring the access-token cookie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockCookieStore.get.mockReturnValue(undefined);
  });

  it('token-2fa-status: 401 when no access-token cookie is present', async () => {
    const response = await status();
    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('token-2fa-status: forwards the cookie as a Bearer token and returns the status', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        enabled: true,
        verifiedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    const response = await status();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.enabled).toBe(true);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer access-token-123');
  });

  it('token-2fa-verify-setup: 400 on missing code, without calling operation-service', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    const response = await verifySetup(makeRequest({}));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('token-2fa-verify-setup: maps an already-enabled error through', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        statusCode: 400,
        message: 'Two-factor authentication is already enabled',
        error: 'Bad Request',
      }),
    });

    const response = await verifySetup(makeRequest({ code: '123456' }));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.message).toBe('Two-factor authentication is already enabled');
  });

  it('token-2fa-backup-codes GET: 401 without a cookie, 200 with one', async () => {
    const unauthed = await backupCodesGet();
    expect(unauthed.status).toBe(401);

    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ enabled: true, remainingCodes: 7, totalCodes: 10 }),
    });
    const authed = await backupCodesGet();
    const body = await authed.json();
    expect(authed.status).toBe(200);
    expect(body.remainingCodes).toBe(7);
  });

  it('token-2fa-backup-codes POST: 400 on missing password', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    const response = await backupCodesPost(makeRequest({}));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('token-2fa-disable: maps an incorrect-password (401) error through', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'access-token-123' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        statusCode: 401,
        message: 'Incorrect password',
        error: 'Unauthorized',
      }),
    });

    const response = await disable(
      makeRequest({ password: 'wrong', code: '123456' })
    );
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.message).toBe('Incorrect password');
  });
});

describe('token-2fa-verify (unauthenticated, completes login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('does not read any cookie and calls operation-service directly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, verified: true, method: 'totp' }),
    });

    const response = await verify(
      makeRequest({ code: '123456', token: 'temp-2fa-token' })
    );
    const body = await response.json();

    expect(mockCookieStore.get).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.method).toBe('totp');
  });

  it('400 when code or token is missing', async () => {
    const response = await verify(makeRequest({ code: '123456' }));
    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps an expired-token (401) error through', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      message: 'Invalid or expired verification token. Please log in again.',
      json: async () => ({
        statusCode: 401,
        message: 'Invalid or expired verification token. Please log in again.',
        error: 'Unauthorized',
      }),
    });

    const response = await verify(
      makeRequest({ code: '123456', token: 'expired' })
    );
    expect(response.status).toBe(401);
  });
});
