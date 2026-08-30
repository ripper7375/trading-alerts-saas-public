-- Recurring-commission follow-up: per-cycle idempotency + clawback targeting.
-- Purely additive: one nullable column + one index on the existing
-- Commission table. No existing row is touched.

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN "stripeInvoiceId" TEXT;

-- CreateIndex
CREATE INDEX "Commission_stripeInvoiceId_idx" ON "Commission"("stripeInvoiceId");
