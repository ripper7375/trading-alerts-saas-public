-- ============================================================
-- Migration: 20260224000000_update_kc_ha_body_columns
-- Prompt 12 schema changes for MarketData table
--
-- Changes:
--   10 RENAME COLUMN for KC (Keltner Channel) bands
--   1  RENAME COLUMN ha_strength → ha_body_size
--   1  ADD COLUMN    ha_body_zscore   (DOUBLE PRECISION)
--   1  ADD COLUMN    body_classification (INTEGER)
-- ============================================================

-- ----------------------------------------------------------
-- Keltner Channel Band Renames (10 columns)
-- Old 3-band + derivative system → New 10-band system
-- ----------------------------------------------------------
ALTER TABLE "MarketData" RENAME COLUMN "kc_upper"       TO "kc_ultra_extreme_upper";
ALTER TABLE "MarketData" RENAME COLUMN "kc_middle"      TO "kc_extreme_upper";
ALTER TABLE "MarketData" RENAME COLUMN "kc_lower"       TO "kc_uppermost";
ALTER TABLE "MarketData" RENAME COLUMN "kc_upper_ema"   TO "kc_upper";
ALTER TABLE "MarketData" RENAME COLUMN "kc_middle_ema"  TO "kc_upper_middle";
ALTER TABLE "MarketData" RENAME COLUMN "kc_lower_ema"   TO "kc_lower_middle";
ALTER TABLE "MarketData" RENAME COLUMN "kc_squeeze"     TO "kc_lower";
ALTER TABLE "MarketData" RENAME COLUMN "kc_squeeze_pro" TO "kc_lowermost";
ALTER TABLE "MarketData" RENAME COLUMN "kc_width"       TO "kc_extreme_lower";
ALTER TABLE "MarketData" RENAME COLUMN "kc_width_ema"   TO "kc_ultra_extreme_lower";

-- ----------------------------------------------------------
-- Heiken Ashi Rename (1 column)
-- ha_strength → ha_body_size (more descriptive name)
-- ----------------------------------------------------------
ALTER TABLE "MarketData" RENAME COLUMN "ha_strength" TO "ha_body_size";

-- ----------------------------------------------------------
-- New Columns (2 additions)
-- ----------------------------------------------------------

-- ha_body_zscore: Z-score of the HA body size for normalization
ALTER TABLE "MarketData" ADD COLUMN "ha_body_zscore" DOUBLE PRECISION;

-- body_classification: Integer classification of body size momentum
ALTER TABLE "MarketData" ADD COLUMN "body_classification" INTEGER;
