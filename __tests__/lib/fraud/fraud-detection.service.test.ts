/**
 * @jest-environment node
 */
/**
 * Guard: the fraud alert service is server-only and exposes only the four
 * admin functions.
 *
 * It used to start with a top-level 'use server' directive, which makes every
 * exported async function a Server Action. The module does no authorization of
 * its own (the admin routes call requireAdmin() first), so it must stay
 * 'server-only' and must not grow unauthenticated exports again.
 */
import fs from 'fs';
import path from 'path';

import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../helpers/account-db-fake';

// CODE-02B: the suspension of an account and the session-version bump commit together, so the
// tests below read the rows of an in-memory database that really rolls a transaction back.
let mockFake: AccountDbFake;
const mockFraudAlertFindUnique = jest.fn();
const mockFraudAlertUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    fraudAlert: {
      findUnique: (...a: unknown[]) => mockFraudAlertFindUnique(...a),
      update: (...a: unknown[]) => mockFraudAlertUpdate(...a),
    },
    user: {
      update: (...a: [never]) => mockFake.client.user.update(...a),
      updateMany: (...a: [never]) => mockFake.client.user.updateMany(...a),
    },
    refreshToken: {
      deleteMany: (...a: [never]) =>
        mockFake.client.refreshToken.deleteMany(...a),
    },
    $transaction: (...a: [never]) => mockFake.$transaction(...a),
  },
}));

const SERVICE_PATH = path.join(
  process.cwd(),
  'lib/fraud/fraud-detection.service.ts'
);

describe('lib/fraud/fraud-detection.service', () => {
  it("is imported with 'server-only', not marked 'use server'", () => {
    const source = fs.readFileSync(SERVICE_PATH, 'utf8');

    expect(source).not.toMatch(/^\s*['"]use server['"]/m);
    expect(source).toMatch(/^import 'server-only';/m);
  });

  it('exports only the four admin functions', async () => {
    const service = await import('@/lib/fraud/fraud-detection.service');

    expect(Object.keys(service).sort()).toEqual([
      'blockUserFromFraudAlert',
      'getFraudAlertStats',
      'getFraudAlerts',
      'updateFraudAlertStatus',
    ]);
  });
});

describe('blockUserFromFraudAlert: session version (CODE-02B)', () => {
  beforeEach(() => {
    mockFake = createAccountDbFake({
      users: [
        { id: 'user-1', isActive: true, sessionVersion: 1 },
        { id: 'user-2', isActive: true, sessionVersion: 6 },
      ],
      refreshTokens: [
        { id: 'rt-1', userId: 'user-1', hashedToken: 'a' },
        { id: 'rt-2', userId: 'user-2', hashedToken: 'b' },
      ],
    });
    mockFraudAlertFindUnique.mockReset();
    mockFraudAlertFindUnique.mockResolvedValue({ userId: 'user-1' });
    mockFraudAlertUpdate.mockReset();
    mockFraudAlertUpdate.mockResolvedValue({});
  });

  it('suspends the account, raises its session version and deletes its refresh tokens together', async () => {
    const { blockUserFromFraudAlert } = await import(
      '@/lib/fraud/fraud-detection.service'
    );

    await expect(
      blockUserFromFraudAlert('alert-1', 'admin-1', 'note')
    ).resolves.toEqual({ success: true });

    expect(mockFake.user('user-1')['isActive']).toBe(false);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(2);
    expect(mockFake.refreshTokensOf('user-1')).toEqual([]);
    expect(mockFake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves every other account alone', async () => {
    const { blockUserFromFraudAlert } = await import(
      '@/lib/fraud/fraud-detection.service'
    );

    await blockUserFromFraudAlert('alert-1', 'admin-1');

    expect(mockFake.user('user-2')['isActive']).toBe(true);
    expect(mockFake.user('user-2')['sessionVersion']).toBe(6);
    expect(mockFake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('keeps the account active and the version alone when the suspension fails', async () => {
    const { blockUserFromFraudAlert } = await import(
      '@/lib/fraud/fraud-detection.service'
    );
    mockFake.failNext('user.update');

    await expect(blockUserFromFraudAlert('alert-1', 'admin-1')).rejects.toThrow(
      'user.update failed'
    );

    expect(mockFake.user('user-1')['isActive']).toBe(true);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(1);
    expect(mockFake.refreshTokensOf('user-1')).toHaveLength(1);
  });

  it('keeps the account active when the sessions cannot be ended', async () => {
    const { blockUserFromFraudAlert } = await import(
      '@/lib/fraud/fraud-detection.service'
    );
    mockFake.failNext('refreshToken.deleteMany');

    await expect(blockUserFromFraudAlert('alert-1', 'admin-1')).rejects.toThrow(
      'refreshToken.deleteMany failed'
    );

    expect(mockFake.user('user-1')['isActive']).toBe(true);
    expect(mockFake.user('user-1')['sessionVersion']).toBe(1);
  });

  it('changes nothing for an unknown alert', async () => {
    const { blockUserFromFraudAlert } = await import(
      '@/lib/fraud/fraud-detection.service'
    );
    mockFraudAlertFindUnique.mockResolvedValue(null);

    await expect(blockUserFromFraudAlert('nope', 'admin-1')).rejects.toThrow(
      'Fraud alert not found'
    );

    expect(mockFake.user('user-1')['sessionVersion']).toBe(1);
    expect(mockFake.user('user-1')['isActive']).toBe(true);
  });
});
