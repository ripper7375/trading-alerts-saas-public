-- Session 11-3: Token Metering & Schema
-- Generated via `prisma migrate diff --from-schema <committed HEAD> --to-schema prisma/non-market-data/schema.prisma --script`
-- (pure schema-to-schema diff, zero DB connection -- LESSONS-LEARNED.md L6).
-- Applied via `prisma db execute` (not `db push`/`migrate dev`) to avoid the shared-database
-- shadow-diff proposing to drop `market_data_v6` (migration-stack-analysis.md:1095-1098,
-- Session 2-3 / Session 8-2 precedent).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profile" JSONB;

-- CreateTable
CREATE TABLE "token_usage_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "imageTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_usage_log_userId_timestamp_idx" ON "token_usage_log"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "token_usage_log" ADD CONSTRAINT "token_usage_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
