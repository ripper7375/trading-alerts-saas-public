import type { Prisma } from '.prisma/non-market-client';

import { prisma } from '@/lib/db/prisma';

import { forgetSessionState } from './user-active';

/**
 * The write side of the session version (CODE-02B).
 *
 * A NextAuth session is a stateless JWT: it keeps decoding after the account behind it changed.
 * WS-4 made every session read compare the token's `sessionVersion` with `User.sessionVersion`
 * (`lib/auth/user-active.ts`); this is what raises it. A security change (a new password, 2FA
 * switched on or off, a new e-mail address, "log out all", a suspension, a confirmed deletion)
 * ends every session minted before it:
 *
 *  - `User.sessionVersion` goes up by one, so every access token minted earlier is refused, and
 *  - the user's refresh tokens are deleted, so none of them can mint a new one,
 *
 * both IN THE SAME TRANSACTION as the change itself: there is no moment at which the password is
 * new and the old sessions still live, and a failed change leaves the version alone.
 *
 * `withSessionBump` is the shape for a site that has a single write. A site that already has a
 * transaction calls `bumpSessionVersion(tx, userId)` (or `raiseSessionVersion` when it deletes
 * the tokens itself) as the LAST statement inside it, and `forgetSessionState(userId)` after the
 * commit: forgetting inside the transaction would let a read in between put the old row back in
 * the cache for 30 s.
 *
 * The caller's own session ends too: its token carries the old version.
 */

/** What a bump needs from the client or from a transaction client. */
export type SessionVersionClient = Pick<
  Prisma.TransactionClient,
  'user' | 'refreshToken'
>;

/**
 * Raise the account's version by one. `updateMany`, not `update`: an account that is already gone
 * (a deletion racing the bump) must not turn the caller's transaction into a "record not found".
 */
export async function raiseSessionVersion(
  db: SessionVersionClient,
  userId: string
): Promise<void> {
  await db.user.updateMany({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

/**
 * Raise the account's version and delete its refresh tokens. Call it inside the transaction of the
 * security change, after the change.
 */
export async function bumpSessionVersion(
  db: SessionVersionClient,
  userId: string
): Promise<void> {
  await raiseSessionVersion(db, userId);
  await db.refreshToken.deleteMany({ where: { userId } });
}

/**
 * Run `write` and the bump in ONE transaction, then forget this instance's cached snapshot of the
 * account so the next session read sees the new version at once. If `write` or the bump throws,
 * the transaction rolls back and nothing changes.
 */
export async function withSessionBump<T>(
  userId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const result = await prisma.$transaction(async (tx) => {
    const written = await write(tx);
    await bumpSessionVersion(tx, userId);
    return written;
  });
  forgetSessionState(userId);
  return result;
}

/**
 * "Log out all": the bump with nothing to write. Every session of the account, the caller's
 * included, is refused from the next read on.
 */
export async function endAllSessions(userId: string): Promise<void> {
  await withSessionBump(userId, async () => undefined);
}
