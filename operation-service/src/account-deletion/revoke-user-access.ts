import type { PrismaService } from '../prisma/prisma.service';

/** The three delegates revocation touches; a transaction client satisfies it too. */
export type AccessRevocationClient = Pick<
  PrismaService,
  'session' | 'refreshToken' | 'userSession'
>;

/**
 * Signs a user out of every device: deletes the NextAuth `Session` rows and every refresh token,
 * and marks the tracked device sessions inactive (they stay for the admin's login history, the
 * same convention as UsersService.revokeAllSessions).
 *
 * The access token the user already holds is stateless and keeps decoding until it expires;
 * JwtAuthGuard and the NextAuth `jwt` callback reject it by looking at `User.isActive`. This only
 * removes what could mint a new one.
 *
 * Idempotent: calling it again for the same user changes nothing.
 */
export async function revokeAllUserAccess(
  client: AccessRevocationClient,
  userId: string
): Promise<{ sessions: number; refreshTokens: number; devices: number }> {
  const sessions = await client.session.deleteMany({ where: { userId } });
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
