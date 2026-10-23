/**
 * @jest-environment node
 *
 * F21 (Option B): confirming an account deletion locks the account at once, and cancelling a
 * confirmed deletion inside the 24 h grace period gives it back. These are the monolith's own
 * routes (the operation-service flag off); operation-service has the same behaviour in
 * `UsersService` with its own tests.
 */

import { NextRequest } from 'next/server';

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUserProfile: () => false,
}));
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationServiceOptionalAuth: jest.fn(),
  OperationServiceError: class OperationServiceError extends Error {},
}));

const tx = {
  accountDeletionRequest: {
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: { updateMany: jest.fn() },
  session: { deleteMany: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  userSession: { updateMany: jest.fn() },
};
const mockRequestFindUnique = jest.fn();
const mockRequestFindFirst = jest.fn();
const mockRequestUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockTransaction = jest.fn(async (callback: (t: typeof tx) => unknown) =>
  callback(tx)
);
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    accountDeletionRequest: {
      findUnique: (...a: unknown[]) => mockRequestFindUnique(...a),
      findFirst: (...a: unknown[]) => mockRequestFindFirst(...a),
      update: (...a: unknown[]) => mockRequestUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    $transaction: (...a: [(t: typeof tx) => unknown]) => mockTransaction(...a),
  },
}));

import {
  createAccountDbFake,
  type AccountDbFake,
} from '../helpers/account-db-fake';
import { POST as cancelDeletion } from '@/app/api/user/account/deletion-cancel/route';
import { POST as confirmDeletion } from '@/app/api/user/account/deletion-confirm/route';
import { clearUserActiveCache, getSessionState } from '@/lib/auth/user-active';

const HOUR = 60 * 60 * 1000;

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/user/account/deletion-confirm', () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => consoleLog.mockRestore());

  const pending = () => ({
    id: 'req-1',
    userId: 'user-1',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + HOUR),
  });

  function claimWon() {
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
  }

  it('flips PENDING to CONFIRMED, deactivates the user and signs out every device in one transaction', async () => {
    mockRequestFindUnique.mockResolvedValue(pending());
    claimWon();

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(tx.accountDeletionRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'PENDING' },
      data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      data: { isActive: false },
    });
  });

  it('schedules the deletion 24 h after the confirmation it stored', async () => {
    mockRequestFindUnique.mockResolvedValue(pending());
    claimWon();

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );
    const body = await res.json();

    const stored = tx.accountDeletionRequest.updateMany.mock.calls[0][0].data
      .confirmedAt as Date;
    expect(new Date(body.scheduledDeletionTime).getTime()).toBe(
      stored.getTime() + 24 * HOUR
    );
  });

  it('changes nothing when another click already won the claim', async () => {
    mockRequestFindUnique.mockResolvedValue(pending());
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a request that is already CONFIRMED without touching the account', async () => {
    mockRequestFindUnique.mockResolvedValue({
      ...pending(),
      status: 'CONFIRMED',
    });

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('does not deactivate anyone for an unknown token', async () => {
    mockRequestFindUnique.mockResolvedValue(null);

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'nope' })
    );

    expect(res.status).toBe(404);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('logs neither the address nor the token', async () => {
    mockRequestFindUnique.mockResolvedValue(pending());
    claimWon();

    await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'secret-token' })
    );

    const logged = JSON.stringify(consoleLog.mock.calls);
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('@');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/user/account/deletion-cancel', () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (callback) => callback(tx));
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => consoleLog.mockRestore());

  function flipWon(confirmedAtAfterFlip: Date | null) {
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.accountDeletionRequest.findUnique.mockResolvedValue({
      confirmedAt: confirmedAtAfterFlip,
    });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
  }

  it('cancels a CONFIRMED request inside the grace period and gives the account back', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(Date.now() - 2 * HOUR),
    });
    flipWon(new Date(Date.now() - 2 * HOUR));

    const res = await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(res.status).toBe(200);
    expect(tx.accountDeletionRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'req-1',
        OR: [
          { status: 'PENDING' },
          { status: 'CONFIRMED', confirmedAt: { gt: expect.any(Date) } },
        ],
      },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', deletedAt: null },
      data: { isActive: true },
    });
  });

  it('leaves isActive alone when the request was only PENDING', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'PENDING',
      confirmedAt: null,
    });
    flipWon(null);

    const res = await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(res.status).toBe(200);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('still gives the account back when a confirm landed between the read and the flip', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'PENDING',
      confirmedAt: null,
    });
    flipWon(new Date());

    await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', deletedAt: null },
      data: { isActive: true },
    });
  });

  it('refuses once the 24 h grace period is over and touches nothing', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(Date.now() - 25 * HOUR),
    });

    const res = await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('refuses when the conditional flip loses (the worker took the request first)', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      confirmedAt: new Date(Date.now() - 23.99 * HOUR),
    });
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });

    const res = await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('cannot cancel a COMPLETED deletion', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'COMPLETED',
    });

    const res = await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('logs no address', async () => {
    mockRequestFindUnique.mockResolvedValue({
      id: 'req-1',
      userId: 'user-1',
      status: 'PENDING',
      confirmedAt: null,
    });
    flipWon(null);

    await cancelDeletion(
      post('/api/user/account/deletion-cancel', { token: 'tok-1' })
    );

    expect(JSON.stringify(consoleLog.mock.calls)).not.toContain('@');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

// CODE-02B (WS-5): confirming a deletion also raises the session version, in the same transaction,
// so a session token issued before the confirmation stops working even if the account is given
// back by a cancellation.
describe('POST /api/user/account/deletion-confirm: session version', () => {
  let fake: AccountDbFake;
  let consoleLog: jest.SpyInstance;

  const pending = () => ({
    id: 'req-1',
    userId: 'user-1',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + HOUR),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearUserActiveCache();
    fake = createAccountDbFake({
      users: [
        { id: 'user-1', isActive: true, deletedAt: null, sessionVersion: 2 },
        { id: 'user-2', isActive: true, deletedAt: null, sessionVersion: 9 },
      ],
      refreshTokens: [
        { id: 'rt-1', userId: 'user-1', hashedToken: 'a' },
        { id: 'rt-2', userId: 'user-2', hashedToken: 'b' },
      ],
    });
    // The route's transaction client: the fake's user and refresh-token tables, the mocks for the rest.
    const fakeTx = {
      ...tx,
      user: fake.client.user,
      refreshToken: fake.client.refreshToken,
    };
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.session.deleteMany.mockResolvedValue({ count: 0 });
    tx.userSession.updateMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation((callback) =>
      fake.$transaction(() => callback(fakeTx as never))
    );
    mockRequestFindUnique.mockResolvedValue(pending());
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => consoleLog.mockRestore());

  it('locks the account, raises its version and deletes its refresh tokens in one transaction', async () => {
    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(200);
    expect(fake.user('user-1')['isActive']).toBe(false);
    expect(fake.user('user-1')['sessionVersion']).toBe(3);
    expect(fake.refreshTokensOf('user-1')).toEqual([]);
    expect(fake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves another account alone', async () => {
    await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(fake.user('user-2')['isActive']).toBe(true);
    expect(fake.user('user-2')['sessionVersion']).toBe(9);
    expect(fake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('confirms nothing and leaves the version alone when the transaction fails', async () => {
    fake.failNext('refreshToken.deleteMany');

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(500);
    expect(fake.user('user-1')['isActive']).toBe(true);
    expect(fake.user('user-1')['sessionVersion']).toBe(2);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(1);
  });

  it('raises no version when another click already won the claim', async () => {
    tx.accountDeletionRequest.updateMany.mockResolvedValue({ count: 0 });

    const res = await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(res.status).toBe(400);
    expect(fake.user('user-1')['sessionVersion']).toBe(2);
    expect(fake.user('user-1')['isActive']).toBe(true);
  });

  it('drops the cached snapshot so the next read sees the lock and the new version at once', async () => {
    mockUserFindUnique.mockImplementation((args) =>
      fake.client.user.findUnique(args)
    );
    // The account is read once before the confirmation and cached for 30 s on this instance.
    expect(await getSessionState('user-1')).toMatchObject({
      isActive: true,
      sessionVersion: 2,
    });

    await confirmDeletion(
      post('/api/user/account/deletion-confirm', { token: 'tok-1' })
    );

    expect(await getSessionState('user-1')).toMatchObject({
      isActive: false,
      sessionVersion: 3,
    });
  });
});
