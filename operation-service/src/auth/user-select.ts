/**
 * Explicit column lists for the `User` reads and writes of the sign-in, token and 2FA paths.
 *
 * Why: a Prisma call on `User` with no `select` (and every `create`, `update` and `upsert`, which
 * RETURN the row) asks the database for EVERY column of the generated client. Add a column to the
 * schema and deploy before the migration is applied, and every such call fails with
 * `The column User.<name> does not exist in the current database`: on 2026-10-19 `User.deletedAt`
 * took down sign-in. Naming the columns a path needs makes it independent of the ones it does not.
 *
 * `user-select.guard.spec.ts` holds these files to it: a `User` call without a `select` fails the
 * suite. The monolith has the same rule in `lib/auth/user-select.ts`.
 */

/** What a token is minted from, and what the checks around it read. */
export const SESSION_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  tier: true,
  role: true,
  isAffiliate: true,
  isActive: true,
  emailVerified: true,
} as const;

/** The same, plus what the password step reads: the hash and whether a 2FA code is due. */
export const LOGIN_USER_SELECT = {
  ...SESSION_USER_SELECT,
  password: true,
  twoFactorEnabled: true,
} as const;

/** What registering a user needs back for the verification e-mail. */
export const REGISTERED_USER_SELECT = {
  id: true,
  email: true,
  name: true,
} as const;

/** The only column a write needs back. */
export const ID_ONLY_SELECT = { id: true } as const;
