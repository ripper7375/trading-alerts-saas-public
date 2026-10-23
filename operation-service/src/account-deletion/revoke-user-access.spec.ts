import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../test/account-db-fake';
import { revokeAllUserAccess } from './revoke-user-access';

describe('revokeAllUserAccess', () => {
  const client = () => ({
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    userSession: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
  });

  it('deletes the sessions and refresh tokens and deactivates the device sessions, for that user only', async () => {
    const db = client();

    const result = await revokeAllUserAccess(db as never, 'user-1');

    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(db.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      data: { isActive: false },
    });
    expect(result).toEqual({ sessions: 2, refreshTokens: 3, devices: 4 });
  });

  // CODE-02B (WS-5): the access token the user already holds is stateless; what ends it is the
  // version on the account row. A locked account used to rely on `isActive` alone, so a
  // cancellation (which sets `isActive` back) would have revived every older token.
  it('raises the session version of that user, and only that user', async () => {
    const db = client();

    await revokeAllUserAccess(db as never, 'user-1');

    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  describe('against a database that rolls back', () => {
    let fake: AccountDbFake;
    const extras = () => ({
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    });

    beforeEach(() => {
      fake = createAccountDbFake({
        users: [
          { id: 'user-1', isActive: true, sessionVersion: 2 },
          { id: 'user-2', isActive: true, sessionVersion: 6 },
        ],
        refreshTokens: [
          { id: 'rt-1', userId: 'user-1', hashedToken: 'a' },
          { id: 'rt-2', userId: 'user-2', hashedToken: 'b' },
        ],
      });
    });

    it('raises the version and deletes the refresh tokens inside the caller transaction', async () => {
      const other = extras();

      const result = await fake.$transaction((tx) =>
        revokeAllUserAccess({ ...tx, ...other } as never, 'user-1')
      );

      expect(result.refreshTokens).toBe(1);
      expect(fake.user('user-1')['sessionVersion']).toBe(3);
      expect(fake.refreshTokensOf('user-1')).toEqual([]);
      expect(fake.user('user-2')['sessionVersion']).toBe(6);
      expect(fake.refreshTokensOf('user-2')).toHaveLength(1);
      expect(fake.writesOutsideTransaction()).toEqual([]);
    });

    it('leaves the version alone when a later statement fails, because the caller rolls back', async () => {
      const other = extras();
      other.userSession.updateMany.mockRejectedValue(new Error('boom'));

      await expect(
        fake.$transaction((tx) =>
          revokeAllUserAccess({ ...tx, ...other } as never, 'user-1')
        )
      ).rejects.toThrow('boom');

      expect(fake.user('user-1')['sessionVersion']).toBe(2);
      expect(fake.refreshTokensOf('user-1')).toHaveLength(1);
    });

    it('does not fail for a user that is already gone', async () => {
      const other = extras();

      await expect(
        fake.$transaction((tx) =>
          revokeAllUserAccess({ ...tx, ...other } as never, 'ghost')
        )
      ).resolves.toMatchObject({ refreshTokens: 0 });
    });
  });
});
