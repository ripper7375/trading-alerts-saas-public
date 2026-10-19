import { prisma } from '@/lib/db/prisma';

/**
 * Is this user still allowed in? (F21: a user who confirmed an account deletion is locked out at
 * once with `User.isActive = false`.)
 *
 * The NextAuth session is a stateless JWT (30 days): it decodes the same whether the account
 * behind it is live or locked. The `jwt` callback of `authOptions` calls this on every session
 * read after sign-in, and throws when it answers false, which NextAuth turns into "no session" and
 * a cleared cookie. operation-service does the same for its bearer tokens
 * (`operation-service/src/auth/user-active.util.ts`).
 *
 * Only a positive answer is cached, for 30 s per server instance: one query per user per half
 * minute (the Prisma pool is small), and a lockout is felt within 30 s. A locked account is never
 * cached, so it is read again each time, and a cancelled deletion lets the user back in at once.
 *
 * Fails open on a database error and on a missing row: signing in needs the database anyway, and a
 * blip must not sign every user out. A missing row also covers the dev test accounts whose id is
 * made up when the upsert fails.
 */
const ACTIVE_CACHE_TTL_MS = 30_000;
const ACTIVE_CACHE_MAX_ENTRIES = 10_000;

const activeUntil = new Map<string, number>();

export async function isUserActive(userId: string): Promise<boolean> {
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
    console.error(
      '[Auth] isActive lookup failed, letting the session through:',
      error instanceof Error ? error.message : 'Unknown error'
    );
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
