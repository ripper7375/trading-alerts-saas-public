-- Session versioning (CODE-02A): a per-user session version, and the time a session started.
--
-- NOT APPLIED by the Executor (CLAUDE.md: the Executor never applies a migration to a live
-- database). Davin applies it; see "Rollout order" below.
--
-- What it adds (purely additive; on PostgreSQL 11+ a constant DEFAULT is a catalog change, no rewrite):
--   "User"."sessionVersion": INTEGER NOT NULL DEFAULT 0. Every session token carries the version it was
--   minted for, and a token whose version differs from the row's is no longer accepted. Existing
--   tokens carry no version and count as 0, the default, so applying this signs nobody out.
--   "RefreshToken"."sessionStartedAt": nullable. The time the person signed in, carried forward when a
--   refresh token is rotated, so the 12-hour limit on an administrator session cannot be restarted by
--   rotating. NULL for every token issued before this migration.
--
-- Rollout order: apply this migration FIRST, then deploy money-service and operation-service, then
-- the monolith. The regenerated Prisma clients select "sessionVersion" (and operation-service reads
-- "sessionStartedAt" in every refresh-token read), so code deployed before the columns exist fails
-- on sign-in and on every authenticated request. The old code is safe against the new schema
-- (nullable or defaulted columns nobody reads).
-- money-service also selects "User"."deletedAt": migration 20261019000000_add_user_deleted_at must
-- be applied as well (it is already required by operation-service and the monolith).
--
-- Before applying (read-only): `prisma migrate status` and confirm the columns are absent:
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE (table_name = 'User' AND column_name = 'sessionVersion')
--      OR (table_name = 'RefreshToken' AND column_name = 'sessionStartedAt');   -- expect ZERO rows
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'User' AND column_name = 'deletedAt';                    -- expect ONE row
--
-- Apply this one migration alone (`prisma migrate deploy` applies every pending one):
--   prisma db execute --file prisma/migrations/20261024000000_add_session_version/migration.sql \
--     --config prisma.production.config.ts
--   prisma migrate resolve --applied 20261024000000_add_session_version \
--     --config prisma.production.config.ts
--
-- Rollback: revert the code; the two columns may stay (additive, unused).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "sessionStartedAt" TIMESTAMP(3);
