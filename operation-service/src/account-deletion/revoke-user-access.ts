import { raiseSessionVersion } from '../auth/session-version.util';
import type { PrismaService } from '../prisma/prisma.service';

/** The four delegates revocation touches; a transaction client satisfies it too. */
export type AccessRevocationClient = Pick<
  PrismaService,
  'user' | 'session' | 'refreshToken' | 'userSession'
>;

/**
 * Signs a user out of every device: deletes the NextAuth `Session` rows and every refresh token,
 * and marks the tracked device sessions inactive (they stay for the admin's login history, the
 * same convention as UsersService.revokeAllSessions).
 *
 * The access token the user already holds is stateless and keeps decoding until it expires;
 * JwtAuthGuard and the NextAuth `jwt` callback reject it by looking at `User.isActive`, and since
 * CODE-02B by `User.sessionVersion`, which this raises so the end of those tokens does not depend
 * on the account staying locked (a cancellation gives `isActive` back, never an old session).
 * The refresh tokens are deleted here (and counted), so none of them can mint a new one.
 *
 * Call it inside the caller's transaction and forget the account's cached snapshot
 * (`forgetSessionState`) after the commit. Not idempotent for the version: every call raises it.
 */
export async function revokeAllUserAccess(
  client: AccessRevocationClient,
  userId: string
): Promise<{ sessions: number; refreshTokens: number; devices: number }> {
  const sessions = await client.session.deleteMany({ where: { userId } });
  await raiseSessionVersion(client, userId);
  const refreshTokens = await client.refreshToken.deleteMany({
    where: { userId },
  });
  const devices = await client.userSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });
  return {
    sessions: sessions.count,
    refreshTokens: refreshTokens.count,
    devices: devices.count,
  };
}
