import { Logger } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * Is this user still allowed in? (F21: a user who confirmed an account deletion is locked out at
 * once with `User.isActive = false`.)
 *
 * The NextAuth access token is a stateless JWE: it keeps decoding until it expires, and says
 * nothing about the account behind it. JwtAuthGuard and the realtime handshake call this after
 * decoding, so a deactivated account stops working on the next request instead of in up to 30
 * days. Same idea as the monolith's `lib/auth/user-active.ts` for the NextAuth `jwt` callback.
 *
 * Only a positive answer is cached, for 30 s per process: one query per user per half minute, and a
 * lockout is felt within 30 s. A deactivated account is never cached, so it is re-read every time
 * (rare, and a cancelled deletion lets the user back in at once).
 *
 * Fails open on a database error and on a missing row: the guard used to be database-free, and a
 * blip must not sign every user out (F58 documents a flaky id lookup for an existing row).
 */
const ACTIVE_CACHE_TTL_MS = 30_000;
const ACTIVE_CACHE_MAX_ENTRIES = 10_000;

const logger = new Logger('UserActiveCheck');
const activeUntil = new Map<string, number>();

export async function isUserActive(
  prisma: Pick<PrismaService, 'user'>,
  userId: string
): Promise<boolean> {
  const now = Date.now();
  const cachedUntil = activeUntil.get(userId);
  if (cachedUntil !== undefined && cachedUntil > now) return true;

  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (row && !row.isActive) {
      activeUntil.delete(userId);
      return false;
    }
  } catch (error) {
    logger.error('isActive lookup failed, letting the request through', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return true;
  }

  if (activeUntil.size >= ACTIVE_CACHE_MAX_ENTRIES) {
    for (const [key, until] of activeUntil) {
      if (until <= now) activeUntil.delete(key);
    }
    // Still full of live entries: drop the oldest insertion rather than grow without bound.
    if (activeUntil.size >= ACTIVE_CACHE_MAX_ENTRIES) {
      const oldest = activeUntil.keys().next();
      if (!oldest.done) activeUntil.delete(oldest.value);
    }
  }
  activeUntil.set(userId, now + ACTIVE_CACHE_TTL_MS);
  return true;
}

/** Test seam: forget every cached answer. */
export function clearUserActiveCache(): void {
  activeUntil.clear();
}
