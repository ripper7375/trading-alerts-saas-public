import { revokeAllUserAccess } from './revoke-user-access';

describe('revokeAllUserAccess', () => {
  const client = () => ({
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
});
