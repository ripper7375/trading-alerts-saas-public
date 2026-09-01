-- Backfills a real tracked migration for the Marketing Resources / Media
-- Kit feature (MarketingAssetCategory, MarketingAssetStatus,
-- MarketingAsset), which was applied directly via `prisma db push` (or
-- manual SQL) to at least one database outside migration history: no
-- prior migration file creates any of these, yet
-- 20260831061759_add_tutorial_videos's TutorialVideo.status column
-- already depends on MarketingAssetStatus existing. Confirmed missing on
-- production via direct read-only introspection (2026-09-01) - without
-- this, `prisma migrate deploy` would fail partway through applying
-- add_tutorial_videos with "type MarketingAssetStatus does not exist",
-- leaving migration history in a stuck, harder-to-recover state.
-- Timestamped to apply before add_tutorial_videos (20260831061759).
-- Every statement is guarded so this is safe to run on a database that
-- already has some/all of this (idempotent no-op) or one that has none
-- of it (creates it) - exact column/index shape confirmed by introspecting
-- a database where this feature is already live and working.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingAssetCategory') THEN
    CREATE TYPE "MarketingAssetCategory" AS ENUM ('BRAND_LOGOS', 'MASCOTS', 'AD_BANNERS', 'SWIPE_COPY', 'DOCS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketingAssetStatus') THEN
    CREATE TYPE "MarketingAssetStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MarketingAsset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "MarketingAssetCategory" NOT NULL,
    "format" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "copyText" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketingAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingAsset_category_idx" ON "MarketingAsset"("category");

CREATE INDEX IF NOT EXISTS "MarketingAsset_status_idx" ON "MarketingAsset"("status");
