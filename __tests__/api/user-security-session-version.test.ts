/**
 * @jest-environment node
 */
/**
 * CODE-02B (WS-5), the monolith's own security routes that had no test of their own: switching
 * two-factor authentication on, switching it off, and "log out all". Each one ends every session
 * of the account: it raises `User.sessionVersion` and deletes the user's refresh tokens IN THE
 * SAME TRANSACTION as the change, and a failed change leaves the version alone.
 *
 * The password change, the e-mail change, the reset, the deletion confirmation and the suspension
 * are held by `user.test.ts`, `auth/email-flows.test.ts`, `account-deletion-lockout.test.ts` and
 * `lib/fraud/fraud-detection.service.test.ts`.
 *
 * The routes only run here while the operation-service flags are off; with a flag on they forward
 * the request, and operation-service has the same behaviour with its own tests.
 */

import { NextRequest } from 'next/server';

import {
  createAccountDbFake,
  type AccountDbFake,
} from '../helpers/account-db-fake';

let mockFake: AccountDbFake;
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockSecurityAlertCreate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: [never]) => mockFake.client.user.findUnique(...a),
      update: (...a: [never]) => mockFake.client.user.update(...a),
      updateMany: (...a: [never]) => mockFake.client.user.updateMany(...a),
    },
    refreshToken: {
      deleteMany: (...a: [never]) =>
        mockFake.client.refreshToken.deleteMany(...a),
    },
    securityAlert: {
      create: (...a: unknown[]) => mockSecurityAlertCreate(...a),
    },
    $transaction: (...a: [never]) => mockFake.$transaction(...a),
  },
}));

const mockVerifyTOTP = jest.fn();
jest.mock('@/lib/auth/two-factor', () => ({
  __esModule: true,
  verifyTOTP: (...a: unknown[]) => mockVerifyTOTP(...a),
  decryptSecret: () => 'plain-secret',
  generateBackupCodes: async () => ({
    plainCodes: ['AAAA-1111', 'BBBB-2222'],
    hashedCodes: ['hash-a', 'hash-b'],
  }),
  formatBackupCodesForDisplay: (codes: string[]) => codes,
}));

jest.mock('bcryptjs', () => ({
  __esModule: true,
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendTwoFactorEnabledEmail: jest.fn().mockResolvedValue({ success: true }),
  sendTwoFactorDisabledEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/lib/security/device-detection', () => ({
  __esModule: true,
  getLoginContext: async () => ({ ipAddress: '203.0.113.7', location: null }),
  formatLocation: () => 'Unknown location',
}));

const mockUseOperationServiceFor2FA = jest.fn(() => false);
const mockUseOperationServiceForSessions = jest.fn(() => false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUser2FA: () => mockUseOperationServiceFor2FA(),
  shouldUseOperationServiceForUserSessions: () =>
    mockUseOperationServiceForSessions(),
}));
const mockForward = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationService: (...a: unknown[]) => mockForward(...a),
  OperationServiceError: class OperationServiceError extends Error {},
}));

const mockRevokeAllSessions = jest.fn();
jest.mock('@/lib/auth/session-tracker', () => ({
  __esModule: true,
  getUserSessions: jest.fn(),
  trackSession: jest.fn(),
  revokeAllSessions: (...a: unknown[]) => mockRevokeAllSessions(...a),
}));

import { POST as disableTwoFactor } from '@/app/api/user/2fa/disable/route';
import { POST as enableTwoFactor } from '@/app/api/user/2fa/verify-setup/route';
import { DELETE as logOutAll } from '@/app/api/user/sessions/route';

function seed(overrides: Record<string, unknown> = {}): AccountDbFake {
  return createAccountDbFake({
    users: [
      {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        password: 'password-hash',
        sessionVersion: 2,
        twoFactorEnabled: false,
        twoFactorSecret: 'encrypted-secret',
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
        ...overrides,
      },
      {
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob',
        password: 'bob-hash',
        sessionVersion: 8,
        twoFactorEnabled: true,
        twoFactorSecret: 'bob-secret',
        twoFactorBackupCodes: '["x"]',
        twoFactorVerifiedAt: null,
      },
    ],
    refreshTokens: [
      { id: 'rt-1', userId: 'user-1', hashedToken: 'a' },
      { id: 'rt-2', userId: 'user-1', hashedToken: 'b' },
      { id: 'rt-3', userId: 'user-2', hashedToken: 'c' },
    ],
  });
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFake = seed();
  mockGetServerSession.mockResolvedValue({
    user: { id: 'user-1', email: 'alice@example.com' },
  });
  mockVerifyTOTP.mockReturnValue(true);
  mockUseOperationServiceFor2FA.mockReturnValue(false);
  mockUseOperationServiceForSessions.mockReturnValue(false);
  mockSecurityAlertCreate.mockResolvedValue({});
  mockRevokeAllSessions.mockResolvedValue(3);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/user/2fa/verify-setup (switch 2FA on)', () => {
  const request = () => post('/api/user/2fa/verify-setup', { code: '123456' });

  it('enables 2FA, raises the version and deletes the refresh tokens together', async () => {
    const res = await enableTwoFactor(request());

    expect(res.status).toBe(200);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(true);
    expect(alice['twoFactorBackupCodes']).toBe('["hash-a","hash-b"]');
    expect(alice['sessionVersion']).toBe(3);
    expect(mockFake.refreshTokensOf('user-1')).toEqual([]);
    expect(mockFake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves every other account alone', async () => {
    await enableTwoFactor(request());

    expect(mockFake.user('user-2')['sessionVersion']).toBe(8);
    expect(mockFake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('still returns the backup codes it created', async () => {
    const res = await enableTwoFactor(request());
    const body = await res.json();

    expect(body.backupCodes).toEqual(['AAAA-1111', 'BBBB-2222']);
  });

  it('keeps 2FA off and the version alone when the write fails', async () => {
    mockFake.failNext('user.update');

    const res = await enableTwoFactor(request());

    expect(res.status).toBe(500);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(false);
    expect(alice['sessionVersion']).toBe(2);
    expect(mockFake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('keeps 2FA off when the sessions cannot be ended', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    const res = await enableTwoFactor(request());

    expect(res.status).toBe(500);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(false);
    expect(alice['twoFactorBackupCodes']).toBeNull();
    expect(alice['sessionVersion']).toBe(2);
  });

  it('ends nothing for a wrong code', async () => {
    mockVerifyTOTP.mockReturnValue(false);

    const res = await enableTwoFactor(request());

    expect(res.status).toBe(400);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(2);
    expect(mockFake.refreshTokensOf('user-1')).toHaveLength(2);
    expect(mockFake.log).not.toContain('begin');
  });

  it('forwards to operation-service and touches nothing here while its flag is on', async () => {
    mockUseOperationServiceFor2FA.mockReturnValue(true);
    mockForward.mockResolvedValue({ status: 200, body: { success: true } });

    const res = await enableTwoFactor(request());

    expect(res.status).toBe(200);
    expect(mockFake.log).toEqual([]);
  });
});

describe('POST /api/user/2fa/disable (switch 2FA off)', () => {
  const request = () =>
    post('/api/user/2fa/disable', {
      password: 'correct-password',
      code: '654321',
    });

  beforeEach(() => {
    mockFake = seed({
      twoFactorEnabled: true,
      twoFactorBackupCodes: '["hash-a"]',
    });
  });

  it('disables 2FA, raises the version and deletes the refresh tokens together', async () => {
    const res = await disableTwoFactor(request());

    expect(res.status).toBe(200);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(false);
    expect(alice['twoFactorSecret']).toBeNull();
    expect(alice['twoFactorBackupCodes']).toBeNull();
    expect(alice['sessionVersion']).toBe(3);
    expect(mockFake.refreshTokensOf('user-1')).toEqual([]);
    expect(mockFake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves every other account alone', async () => {
    await disableTwoFactor(request());

    expect(mockFake.user('user-2')['twoFactorEnabled']).toBe(true);
    expect(mockFake.user('user-2')['sessionVersion']).toBe(8);
    expect(mockFake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('keeps 2FA on and the version alone when the write fails', async () => {
    mockFake.failNext('user.update');

    const res = await disableTwoFactor(request());

    expect(res.status).toBe(500);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(true);
    expect(alice['twoFactorSecret']).toBe('encrypted-secret');
    expect(alice['sessionVersion']).toBe(2);
    expect(mockFake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('keeps 2FA on when the sessions cannot be ended', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    const res = await disableTwoFactor(request());

    expect(res.status).toBe(500);
    const alice = mockFake.user('user-1');
    expect(alice['twoFactorEnabled']).toBe(true);
    expect(alice['twoFactorSecret']).toBe('encrypted-secret');
    expect(alice['sessionVersion']).toBe(2);
  });

  it('ends nothing for a wrong code', async () => {
    mockVerifyTOTP.mockReturnValue(false);

    const res = await disableTwoFactor(request());

    expect(res.status).toBe(400);
    expect(mockFake.user('user-1')['twoFactorEnabled']).toBe(true);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(2);
    expect(mockFake.log).not.toContain('begin');
  });
});

describe('DELETE /api/user/sessions (log out all)', () => {
  const request = () =>
    new NextRequest('http://localhost/api/user/sessions', {
      method: 'DELETE',
      headers: { cookie: 'next-auth.session-token=current-token' },
    });

  it('raises the version and deletes the refresh tokens, so every session of the account ends', async () => {
    const res = await logOutAll(request());

    expect(res.status).toBe(200);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(3);
    expect(mockFake.refreshTokensOf('user-1')).toEqual([]);
    expect(mockFake.writesOutsideTransaction()).toEqual([]);
  });

  it('still marks the tracked device sessions inactive', async () => {
    const res = await logOutAll(request());
    const body = await res.json();

    expect(mockRevokeAllSessions).toHaveBeenCalledWith(
      'user-1',
      'current-token'
    );
    expect(body).toMatchObject({ success: true, revokedCount: 3 });
  });

  it('leaves every other account alone', async () => {
    await logOutAll(request());

    expect(mockFake.user('user-2')['sessionVersion']).toBe(8);
    expect(mockFake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('revokes nothing and keeps the version when the bump fails', async () => {
    mockFake.failNext('refreshToken.deleteMany');

    const res = await logOutAll(request());

    expect(res.status).toBe(500);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(2);
    expect(mockFake.refreshTokensOf('user-1')).toHaveLength(2);
    expect(mockRevokeAllSessions).not.toHaveBeenCalled();
  });

  it('answers 401 and changes nothing without a session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await logOutAll(request());

    expect(res.status).toBe(401);
    expect(mockFake.log).toEqual([]);
  });

  it('forwards to operation-service and touches nothing here while its flag is on', async () => {
    mockUseOperationServiceForSessions.mockReturnValue(true);
    mockForward.mockResolvedValue({ status: 200, body: { success: true } });

    const res = await logOutAll(request());

    expect(res.status).toBe(200);
    expect(mockFake.log).toEqual([]);
    expect(mockRevokeAllSessions).not.toHaveBeenCalled();
  });
});
