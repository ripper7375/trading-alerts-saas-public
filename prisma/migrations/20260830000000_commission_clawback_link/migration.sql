-- davintrade-vat-stack follow-up: commission clawback-via-netting.
-- Purely additive: one nullable column + one index on the existing
-- Commission table. No existing row is touched.

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN "clawbackOfCommissionId" TEXT;

-- CreateIndex
CREATE INDEX "Commission_clawbackOfCommissionId_idx" ON "Commission"("clawbackOfCommissionId");
