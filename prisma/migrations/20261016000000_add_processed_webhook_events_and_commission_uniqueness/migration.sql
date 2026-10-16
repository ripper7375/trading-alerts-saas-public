-- Remediation Tier 2 §6.1: Stripe dual-delivery deduplication and Commission uniqueness.
--
-- NOT APPLIED by the Executor (CLAUDE.md: the Executor never applies a migration to a live
-- database). Davin applies it; see "Before applying" and "Rollout order" below.
--
-- What it adds (purely additive, no existing row is changed):
--   1. "ProcessedWebhookEvent": one row per (provider, eventId) a webhook handler has claimed.
--   2. A unique index on "Commission" ("affiliateCodeId", "stripeInvoiceId"): one commission per
--      affiliate code per Stripe invoice. PostgreSQL treats NULLs as distinct in a unique index, so
--      rows with a NULL "stripeInvoiceId" (dLocal conversions, pre-recurring rows and clawback
--      rows) never conflict.
--   3. A unique index on "Commission" ("clawbackOfCommissionId"): at most one clawback row per
--      original commission.
--
-- Before applying (read-only; run both against production, expect ZERO rows from each):
--
--   -- (a) two commission rows for one code and one invoice (the dual-delivery race, if it ever hit)
--   SELECT "affiliateCodeId", "stripeInvoiceId", COUNT(*) AS "rows",
--          SUM("commissionAmount") AS "total", ARRAY_AGG("id" ORDER BY "createdAt") AS "ids"
--   FROM "Commission"
--   WHERE "stripeInvoiceId" IS NOT NULL
--   GROUP BY "affiliateCodeId", "stripeInvoiceId"
--   HAVING COUNT(*) > 1;
--
--   -- (b) two clawback rows for one original commission
--   SELECT "clawbackOfCommissionId", COUNT(*) AS "rows", ARRAY_AGG("id" ORDER BY "createdAt") AS "ids"
--   FROM "Commission"
--   WHERE "clawbackOfCommissionId" IS NOT NULL
--   GROUP BY "clawbackOfCommissionId"
--   HAVING COUNT(*) > 1;
--
-- If either returns rows, the CREATE UNIQUE INDEX below FAILS (and, as one transaction, changes
-- nothing). Those are real double credits: the affiliate's totalEarnings / pendingCommissions were
-- incremented twice. Decide per row (cancel the extra commission and reverse the counters) BEFORE
-- applying; do not delete rows blindly, the money path and payouts reference them.
--
-- Rollout order: apply this migration FIRST, then deploy money-service and the monolith. The new
-- code is safe against the old schema (the claim fails open and logs when the table is missing, and
-- a unique violation can only happen once the indexes exist), but the protection starts only when
-- the table and the indexes are in place.
--
-- Apply one migration alone:
--   prisma db execute --file prisma/migrations/20261016000000_add_processed_webhook_events_and_commission_uniqueness/migration.sql
--   prisma migrate resolve --applied 20261016000000_add_processed_webhook_events_and_commission_uniqueness
--
-- Retention: rows are bookkeeping. Stripe retries a failed delivery for up to 3 days; purge rows
-- older than ~90 days with a scheduled `DELETE FROM "ProcessedWebhookEvent" WHERE "createdAt" < now() - interval '90 days'`.

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("provider","eventId")
);

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_createdAt_idx" ON "ProcessedWebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_affiliateCodeId_stripeInvoiceId_key" ON "Commission"("affiliateCodeId", "stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_clawbackOfCommissionId_key" ON "Commission"("clawbackOfCommissionId");

-- money-service connects as the narrower `money_svc` role (prisma/roles/roles.sql), which only holds
-- the grants it was given table by table. Without this the claim insert is refused (permission
-- denied), the code fails open and logs, and the deduplication silently never runs. Guarded so the
-- migration also applies on a database that has no such role (local and staging clones).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'money_svc') THEN
    GRANT ALL PRIVILEGES ON TABLE "ProcessedWebhookEvent" TO money_svc;
  END IF;
END
$$;
