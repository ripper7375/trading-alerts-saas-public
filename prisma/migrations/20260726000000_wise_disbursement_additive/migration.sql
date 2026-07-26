-- CreateEnum
CREATE TYPE "WiseRecipientStatus" AS ENUM ('DRAFT', 'PENDING_DETAILS', 'ACTIVE', 'INVALID', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WiseBatchGroupStatus" AS ENUM ('NEW', 'COMPLETED', 'AWAITING_MANUAL_FUNDING', 'FUNDED', 'MARKED_FOR_CANCELLATION', 'PROCESSING_CANCEL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WiseFundingSource" AS ENUM ('API_BALANCE', 'MANUAL_ADMIN', 'MANUAL_DETECTED');

-- AlterEnum
ALTER TYPE "DisbursementProvider" ADD VALUE 'WISE';

-- CreateTable
CREATE TABLE "AffiliateWiseRecipient" (
    "id" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "wiseRecipientId" TEXT,
    "wiseProfileId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "recipientCountry" TEXT NOT NULL,
    "legalType" TEXT NOT NULL,
    "requirementsType" TEXT NOT NULL,
    "accountTail" TEXT,
    "detailsFingerprint" TEXT,
    "status" "WiseRecipientStatus" NOT NULL DEFAULT 'DRAFT',
    "lastValidatedAt" TIMESTAMP(3),
    "invalidReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateWiseRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseTransfer" (
    "id" TEXT NOT NULL,
    "disbursementTransactionId" TEXT NOT NULL,
    "affiliateWiseRecipientId" TEXT,
    "wiseBatchGroupId" TEXT,
    "wiseTransferId" TEXT NOT NULL,
    "wiseQuoteId" TEXT NOT NULL,
    "customerTransactionId" TEXT NOT NULL,
    "reference" TEXT,
    "sourceCurrency" TEXT NOT NULL,
    "sourceValue" DECIMAL(65,30) NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "targetValue" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "feeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feeBearer" TEXT NOT NULL,
    "currentState" TEXT NOT NULL DEFAULT 'created',
    "previousState" TEXT,
    "lastEventOccurredAt" TIMESTAMP(3),
    "stateHistory" JSONB,
    "payoutFailureCode" TEXT,
    "payoutFailureDescription" TEXT,
    "hasActiveIssues" BOOLEAN NOT NULL DEFAULT false,
    "balanceAppliedAt" TIMESTAMP(3),
    "balanceRevertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WiseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseBatchGroup" (
    "id" TEXT NOT NULL,
    "paymentBatchId" TEXT NOT NULL,
    "wiseBatchGroupId" TEXT NOT NULL,
    "wiseProfileId" TEXT NOT NULL,
    "wiseVersion" INTEGER NOT NULL,
    "wiseName" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "totalSourceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "WiseBatchGroupStatus" NOT NULL DEFAULT 'NEW',
    "payInDetails" JSONB,
    "fundingSource" "WiseFundingSource",
    "fundedAt" TIMESTAMP(3),
    "fundedByUserId" TEXT,
    "fundingEvidence" JSONB,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WiseBatchGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseWebhookEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT,
    "resourceType" TEXT,
    "wiseResourceId" TEXT,
    "currentState" TEXT,
    "previousState" TEXT,
    "occurredAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "rawSignature" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "isTestNotification" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "skippedReason" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WiseWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseWebhookSubscription" (
    "id" TEXT NOT NULL,
    "wiseSubscriptionId" TEXT NOT NULL,
    "scopeDomain" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "deliveryUrl" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WiseWebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateWiseRecipient_affiliateProfileId_key" ON "AffiliateWiseRecipient"("affiliateProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateWiseRecipient_wiseRecipientId_key" ON "AffiliateWiseRecipient"("wiseRecipientId");

-- CreateIndex
CREATE INDEX "AffiliateWiseRecipient_wiseRecipientId_idx" ON "AffiliateWiseRecipient"("wiseRecipientId");

-- CreateIndex
CREATE INDEX "AffiliateWiseRecipient_status_idx" ON "AffiliateWiseRecipient"("status");

-- CreateIndex
CREATE INDEX "AffiliateWiseRecipient_targetCurrency_idx" ON "AffiliateWiseRecipient"("targetCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "WiseTransfer_disbursementTransactionId_key" ON "WiseTransfer"("disbursementTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "WiseTransfer_wiseTransferId_key" ON "WiseTransfer"("wiseTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "WiseTransfer_customerTransactionId_key" ON "WiseTransfer"("customerTransactionId");

-- CreateIndex
CREATE INDEX "WiseTransfer_wiseBatchGroupId_idx" ON "WiseTransfer"("wiseBatchGroupId");

-- CreateIndex
CREATE INDEX "WiseTransfer_currentState_idx" ON "WiseTransfer"("currentState");

-- CreateIndex
CREATE INDEX "WiseTransfer_lastEventOccurredAt_idx" ON "WiseTransfer"("lastEventOccurredAt");

-- CreateIndex
CREATE INDEX "WiseTransfer_payoutFailureCode_idx" ON "WiseTransfer"("payoutFailureCode");

-- CreateIndex
CREATE UNIQUE INDEX "WiseBatchGroup_paymentBatchId_key" ON "WiseBatchGroup"("paymentBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "WiseBatchGroup_wiseBatchGroupId_key" ON "WiseBatchGroup"("wiseBatchGroupId");

-- CreateIndex
CREATE INDEX "WiseBatchGroup_status_idx" ON "WiseBatchGroup"("status");

-- CreateIndex
CREATE INDEX "WiseBatchGroup_wiseBatchGroupId_idx" ON "WiseBatchGroup"("wiseBatchGroupId");

-- CreateIndex
CREATE INDEX "WiseBatchGroup_createdAt_idx" ON "WiseBatchGroup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WiseWebhookEvent_deliveryId_key" ON "WiseWebhookEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "WiseWebhookEvent_eventType_idx" ON "WiseWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "WiseWebhookEvent_wiseResourceId_idx" ON "WiseWebhookEvent"("wiseResourceId");

-- CreateIndex
CREATE INDEX "WiseWebhookEvent_processed_idx" ON "WiseWebhookEvent"("processed");

-- CreateIndex
CREATE INDEX "WiseWebhookEvent_occurredAt_idx" ON "WiseWebhookEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "WiseWebhookEvent_receivedAt_idx" ON "WiseWebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WiseWebhookSubscription_wiseSubscriptionId_key" ON "WiseWebhookSubscription"("wiseSubscriptionId");

-- CreateIndex
CREATE INDEX "WiseWebhookSubscription_eventType_idx" ON "WiseWebhookSubscription"("eventType");

-- CreateIndex
CREATE INDEX "WiseWebhookSubscription_active_idx" ON "WiseWebhookSubscription"("active");

-- AddForeignKey
ALTER TABLE "AffiliateWiseRecipient" ADD CONSTRAINT "AffiliateWiseRecipient_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseTransfer" ADD CONSTRAINT "WiseTransfer_disbursementTransactionId_fkey" FOREIGN KEY ("disbursementTransactionId") REFERENCES "DisbursementTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseTransfer" ADD CONSTRAINT "WiseTransfer_affiliateWiseRecipientId_fkey" FOREIGN KEY ("affiliateWiseRecipientId") REFERENCES "AffiliateWiseRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseTransfer" ADD CONSTRAINT "WiseTransfer_wiseBatchGroupId_fkey" FOREIGN KEY ("wiseBatchGroupId") REFERENCES "WiseBatchGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseBatchGroup" ADD CONSTRAINT "WiseBatchGroup_paymentBatchId_fkey" FOREIGN KEY ("paymentBatchId") REFERENCES "PaymentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
