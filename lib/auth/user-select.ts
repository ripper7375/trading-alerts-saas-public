/**
 * Explicit column lists for the `User` reads and writes on the sign-in path.
 *
 * Why: a Prisma call on `User` with no `select` (and every `create`, `update` and `upsert`, which
 * RETURN the row) asks the database for EVERY column of the generated client. Add a column to the
 * schema and deploy before the migration is applied, and every such call fails with
 * `The column User.<name> does not exist in the current database`: on 2026-10-19 `User.deletedAt`
 * took down the credentials sign-in, the OAuth callback and the adapter at once. Naming the columns
 * a path needs makes it independent of the ones it does not.
 *
 * `__tests__/lib/auth/user-select-guard.test.ts` holds the sign-in files to this: a `User` call
 * without a `select` there fails the build.
 *
 * Each constant lists what its callers read, so a caller that starts reading another column adds it
 * here, where a reviewer sees it.
 */

/** What NextAuth's `AdapterUser` carries. */
export const ADAPTER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
} as const;

/** The user object the credentials provider hands to NextAuth (no password hash). */
export const SESSION_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  tier: true,
  role: true,
  isAffiliate: true,
  emailVerified: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The same, plus the hash the credentials provider compares the typed password with. */
export const CREDENTIALS_USER_SELECT = {
  ...SESSION_USER_SELECT,
  password: true,
} as const;

/** The only column a write on the sign-in path needs back. */
export const ID_ONLY_SELECT = { id: true } as const;
