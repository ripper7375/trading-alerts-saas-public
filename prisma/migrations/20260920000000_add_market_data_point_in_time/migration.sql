-- Point-in-time snapshot lane for the v6 pipeline.
--
-- ADDITIVE ONLY. Creates one new table and touches nothing that exists,
-- so it is safe to apply while the pipeline is running.
--
-- ROLLOUT ORDER MATTERS. railway-gateway auto-deploys from `main`, and its
-- MarketDataProcessor writes this table. Apply this migration BEFORE that
-- deploy: a gateway running against an un-migrated database would fail every
-- snapshot insert. The failure is contained (the snapshot write is wrapped and
-- cannot fail the market_data upsert) but every bar it misses is gone for good
-- -- the honest value exists only once.
--
-- See HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md section 7 option 1.

CREATE TABLE "market_data_point_in_time" (
    "id" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "first_seen_at" INTEGER NOT NULL,
    "snapshot_age_bars" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "collected_at" INTEGER,
    "best_fit_a_horiz_high_map" DOUBLE PRECISION,
    "best_fit_a_horiz_low_map" DOUBLE PRECISION,
    "best_fit_a_ssa" DOUBLE PRECISION,
    "best_fit_a_ema_ssa" DOUBLE PRECISION,
    "best_fit_a_crossing" INTEGER,
    "best_fit_a_base_fl" DOUBLE PRECISION,
    "best_fit_a_uoedt" DOUBLE PRECISION,
    "best_fit_a_loedt" DOUBLE PRECISION,
    "best_fit_b_horiz_high_map" DOUBLE PRECISION,
    "best_fit_b_horiz_low_map" DOUBLE PRECISION,
    "best_fit_b_ssa" DOUBLE PRECISION,
    "best_fit_b_ema_ssa" DOUBLE PRECISION,
    "best_fit_b_crossing" INTEGER,
    "best_fit_b_base_fl" DOUBLE PRECISION,
    "best_fit_b_uoedt" DOUBLE PRECISION,
    "best_fit_b_loedt" DOUBLE PRECISION,
    "cherry_a_horiz_high_map" DOUBLE PRECISION,
    "cherry_a_horiz_low_map" DOUBLE PRECISION,
    "cherry_a_ssa" DOUBLE PRECISION,
    "cherry_a_ema_ssa" DOUBLE PRECISION,
    "cherry_a_crossing" INTEGER,
    "cherry_a_base_fl" DOUBLE PRECISION,
    "cherry_a_uoedt" DOUBLE PRECISION,
    "cherry_a_loedt" DOUBLE PRECISION,
    "cherry_b_horiz_high_map" DOUBLE PRECISION,
    "cherry_b_horiz_low_map" DOUBLE PRECISION,
    "cherry_b_ssa" DOUBLE PRECISION,
    "cherry_b_ema_ssa" DOUBLE PRECISION,
    "cherry_b_crossing" INTEGER,
    "cherry_b_base_fl" DOUBLE PRECISION,
    "cherry_b_uoedt" DOUBLE PRECISION,
    "cherry_b_loedt" DOUBLE PRECISION,
    "most_recent_horiz_high_map" DOUBLE PRECISION,
    "most_recent_horiz_low_map" DOUBLE PRECISION,
    "most_recent_ssa" DOUBLE PRECISION,
    "most_recent_ema_ssa" DOUBLE PRECISION,
    "most_recent_crossing" INTEGER,
    "most_recent_base_fl" DOUBLE PRECISION,
    "most_recent_uoedt" DOUBLE PRECISION,
    "most_recent_loedt" DOUBLE PRECISION,
    "non_a_horiz_high_map" DOUBLE PRECISION,
    "non_a_horiz_low_map" DOUBLE PRECISION,
    "non_a_ssa" DOUBLE PRECISION,
    "non_a_ema_ssa" DOUBLE PRECISION,
    "non_a_crossing" INTEGER,
    "non_a_base_fl" DOUBLE PRECISION,
    "non_a_uoedt" DOUBLE PRECISION,
    "non_a_loedt" DOUBLE PRECISION,
    "non_b_horiz_high_map" DOUBLE PRECISION,
    "non_b_horiz_low_map" DOUBLE PRECISION,
    "non_b_ssa" DOUBLE PRECISION,
    "non_b_ema_ssa" DOUBLE PRECISION,
    "non_b_crossing" INTEGER,
    "non_b_base_fl" DOUBLE PRECISION,
    "non_b_uoedt" DOUBLE PRECISION,
    "non_b_loedt" DOUBLE PRECISION,
    "fractal_best_fl" DOUBLE PRECISION,
    "fractal_uoedt" DOUBLE PRECISION,
    "fractal_loedt" DOUBLE PRECISION,
    "best_resistance" DOUBLE PRECISION,
    "best_support" DOUBLE PRECISION,
    "sr_1" DOUBLE PRECISION,
    "sr_2" DOUBLE PRECISION,
    "sr_3" DOUBLE PRECISION,
    "sr_4" DOUBLE PRECISION,
    "sr_5" DOUBLE PRECISION,
    "sr_6" DOUBLE PRECISION,
    "sr_7" DOUBLE PRECISION,
    "sr_8" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_data_point_in_time_pkey" PRIMARY KEY ("id")
);

-- Index order below matches what `prisma migrate diff` emits for this
-- model exactly, so the hand-authored file and the generated one are
-- byte-identical after comment stripping. Verified, not assumed.
CREATE INDEX "market_data_point_in_time_symbol_timeframe_timestamp_idx" ON "market_data_point_in_time"("symbol", "timeframe", "timestamp");

-- Write-once is enforced by this constraint plus ON CONFLICT DO NOTHING in
-- the processor, not by a trigger: the key IS the rule.
CREATE UNIQUE INDEX "market_data_point_in_time_symbol_timeframe_timestamp_key" ON "market_data_point_in_time"("symbol", "timeframe", "timestamp");
