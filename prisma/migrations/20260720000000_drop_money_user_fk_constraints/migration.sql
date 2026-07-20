-- Session 2-3 (F20 FK audit): drop DB-level FK constraints from the 4
-- money-domain models to User, converting them to opaque userId references.
-- userId columns and their existing @@index([userId]) are untouched — only
-- the constraint (and its ON DELETE CASCADE behavior) is removed. Prisma
-- Client's `include: { user: true }` on these 4 models stops compiling;
-- Session 2-4 must adapt any such call site.
--
-- Hand-written (not `prisma migrate dev`) because that command's shadow-DB
-- diff against the partial non-market-data schema would propose dropping
-- market_data_v6 (declared only in the sibling market-data schema). See
-- Session 2-3 Deviations for the full explanation. Constraint names
-- confirmed from prisma/migrations/20251227000000_init/migration.sql.

ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";
ALTER TABLE "FraudAlert" DROP CONSTRAINT "FraudAlert_userId_fkey";
ALTER TABLE "AffiliateProfile" DROP CONSTRAINT "AffiliateProfile_userId_fkey";
