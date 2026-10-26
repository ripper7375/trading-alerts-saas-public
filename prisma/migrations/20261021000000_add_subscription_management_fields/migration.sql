-- Manage Subscription S2: cancel at period end (W3), resume (W4) and the columns the plan switch of S3 will use.
--
-- NOT APPLIED by the Executor (CLAUDE.md: the Executor never applies a migration to a live
-- database). Davin applies it; see "Rollout order" below.
--
-- What it adds (purely additive; every existing row gets the defaults, no row is rewritten beyond that):
--   "Subscription"."cancelAtPeriodEnd"      BOOLEAN NOT NULL DEFAULT false  Stripe's cancel_at_period_end, kept in sync by the webhook.
--   "Subscription"."cancelRequestedAt"      TIMESTAMP(3)  NULL              when the user asked to cancel.
--   "Subscription"."cancellationReason"     TEXT          NULL              the reason they gave (the route caps it at 500 characters).
--   "Subscription"."pendingPlanType"        TEXT          NULL              S3: the plan that starts at pendingPlanEffectiveAt.
--   "Subscription"."pendingPlanEffectiveAt" TIMESTAMP(3)  NULL              S3.
--   "Subscription"."stripeScheduleId"       TEXT          NULL              S3: the Stripe Subscription Schedule holding the switch.
-- The last three are unused until S3, and are added now so production goes through this step once.
-- No index and no constraint: nothing queries by these columns, and a CHECK on a boolean default adds nothing.
--
-- Rollout order: apply this migration FIRST, then deploy money-service, then the monolith
-- (operation-service is not affected: its "Subscription" model declares only four columns).
-- This one is not optional, unlike the additive tables of earlier migrations: the regenerated Prisma
-- clients select the six columns in every read of "Subscription" that names no columns (a findUnique
-- or findFirst with no select, for example the webhook handlers and the checkout routes), so code
-- deployed before the columns exist fails on those reads, not only on the new cancel and resume routes
-- (the login outage of 2026-10-19 with "User"."deletedAt" was the same mistake).
-- The old code is safe against the new schema (nullable columns and one defaulted boolean nobody reads).
--
-- Before applying (read-only): `prisma migrate status`, and confirm the columns are absent:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'Subscription'
--     AND column_name IN ('cancelAtPeriodEnd', 'cancelRequestedAt', 'cancellationReason',
--                         'pendingPlanType', 'pendingPlanEffectiveAt', 'stripeScheduleId');   -- expect ZERO rows
--
-- Rollback (only before any user has asked to cancel; afterwards the two cancel columns hold the only
-- record of when and why, and "cancelAtPeriodEnd" is the only copy of what the user asked for if Stripe
-- is unreachable):
--   ALTER TABLE "Subscription"
--     DROP COLUMN "cancelAtPeriodEnd", DROP COLUMN "cancelRequestedAt", DROP COLUMN "cancellationReason",
--     DROP COLUMN "pendingPlanType", DROP COLUMN "pendingPlanEffectiveAt", DROP COLUMN "stripeScheduleId";
-- Roll the services back first: code that selects these columns fails once they are gone.

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "pendingPlanEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pendingPlanType" TEXT,
ADD COLUMN     "stripeScheduleId" TEXT;
