-- ============================================================
-- Migration: 20260903000000_split_best_fit_variant
--
-- Stack C (backend-stack-c) split its `best_fit` centroid-regression
-- variant into `best_fit_a`/`best_fit_b` (isolated-coexistence MQL5
-- indicators, see backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/
-- v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md
-- §0.4/§3.4). `best_fit_a` is config-identical to the former `best_fit`
-- (InpRegCentroids=5, InpExcludeRecentCentroids=0) — every historical
-- `best_fit_*` row is valid `best_fit_a` data unchanged. `best_fit_b` is a
-- new preset (InpExcludeRecentCentroids=3) with no historical data.
--
-- market_data_v6 is a LIVE production table with real accumulated history,
-- so this is a lossless RENAME of the 8 existing best_fit_* columns to
-- best_fit_a_* (no data loss, no backfill needed), followed by an ADD of
-- the 8 new nullable best_fit_b_* columns (NULL for all existing rows,
-- since best_fit_b was never exported before this split).
--
-- gateway_contract_market_data.schema.json grew from 79 to 87 fields to
-- match.
-- ============================================================

-- RenameColumn (best_fit_* -> best_fit_a_*, lossless: best_fit_a is
-- config-identical to the former best_fit)
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_horiz_high_map" TO "best_fit_a_horiz_high_map";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_horiz_low_map" TO "best_fit_a_horiz_low_map";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_ssa" TO "best_fit_a_ssa";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_ema_ssa" TO "best_fit_a_ema_ssa";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_crossing" TO "best_fit_a_crossing";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_base_fl" TO "best_fit_a_base_fl";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_uoedt" TO "best_fit_a_uoedt";
ALTER TABLE "market_data_v6" RENAME COLUMN "best_fit_loedt" TO "best_fit_a_loedt";

-- AddColumn (best_fit_b_* — new preset, no historical data; NULL for all
-- existing rows)
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_horiz_high_map" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_horiz_low_map" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_ssa" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_ema_ssa" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_crossing" INTEGER;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_base_fl" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_uoedt" DOUBLE PRECISION;
ALTER TABLE "market_data_v6" ADD COLUMN "best_fit_b_loedt" DOUBLE PRECISION;
