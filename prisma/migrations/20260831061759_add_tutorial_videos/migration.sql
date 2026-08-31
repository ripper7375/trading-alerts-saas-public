-- CreateEnum
CREATE TYPE "TutorialCategory" AS ENUM ('GETTING_STARTED', 'PLATFORM_WALKTHROUGH', 'TRADING_STRATEGIES', 'RISK_MANAGEMENT', 'MARKET_ANALYSIS');

-- CreateTable
CREATE TABLE "TutorialVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "category" "TutorialCategory" NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorialVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorialVideo_category_idx" ON "TutorialVideo"("category");

-- CreateIndex
CREATE INDEX "TutorialVideo_status_idx" ON "TutorialVideo"("status");

