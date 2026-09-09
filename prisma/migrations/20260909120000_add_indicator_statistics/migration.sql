-- ============================================================
-- Migration: 20260909120000_add_indicator_statistics
--
-- Append-only capture of the MQL5 indicators' `_Statistic.txt` snapshots —
-- the fit-quality substrate (R², MSE, variance ratio, skewness, kurtosis,
-- EDT containment, window size, touch counts) that the indicators have always
-- written and that nothing has ever read. None of it exists in
-- `market_data_v6` and none of it can be honestly reconstructed after the
-- fact. Design: backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/
-- v2_29_data_pipeline_architecture/STATISTIC-CAPTURE-SCOPE.md
--
-- PURELY ADDITIVE — two new tables. `market_data_v6` is not touched in any
-- way, so this carries no risk to existing rows and no risk to the running
-- pipeline. (Contrast 20260909000000_market_data_v6_provenance_not_null,
-- which tightens constraints on live data and needs a pre-flight check.)
--
-- APPEND-ONLY is enforced by the KEY, not by a trigger: `indicator_statistics`
-- is unique on (symbol, timeframe, source, captured_at) — "which fit, and when
-- it was observed". captured_at is new on every collection cycle, so a new row
-- never collides with an old one and nothing is ever overwritten. This is the
-- deliberate opposite of market_data_v6, which is keyed by bar and is mutable
-- by design.
--
-- The gateway upserts on that key because push retries deliver duplicates by
-- design; the re-pushed content is byte-identical, so this never mutates
-- history. A correction is a NEW row with a later captured_at.
--
-- This migration has been authored, NOT applied, per this repo's standing rule
-- that the Executor never applies a schema migration to a live database.
-- ============================================================

-- CreateTable: the deduplicated indicator configuration behind each snapshot.
-- Created FIRST because indicator_statistics carries a foreign key to it.
-- Parameters are compiled into the .mq5 and change only on redeploy, so storing
-- them on every statistics row would repeat an identical blob ~1M times a year.
-- A NEW config_hash appearing is itself the drift signal (indicator reconfigured).
CREATE TABLE "indicator_configs" (
    "config_hash" TEXT NOT NULL,
    "source"      TEXT NOT NULL,
    "params"      JSONB NOT NULL,
    "first_seen"  INTEGER NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_configs_pkey" PRIMARY KEY ("config_hash")
);

CREATE INDEX "indicator_configs_source_idx" ON "indicator_configs" ("source");

-- CreateTable
CREATE TABLE "indicator_statistics" (
    "id"          TEXT NOT NULL,

    -- identity + when observed
    "terminal_id" TEXT NOT NULL,
    "symbol"      TEXT NOT NULL,
    "timeframe"   TEXT NOT NULL,
    "source"      TEXT NOT NULL,
    "captured_at" INTEGER NOT NULL,
    "live_bar_ts" INTEGER NOT NULL,
    "cycle_id"    INTEGER NOT NULL,

    -- resolved line (line indicators only for the last three)
    "solution_found"   BOOLEAN,
    "raw_slope"        DOUBLE PRECISION,
    "anchored_y_int"   DOUBLE PRECISION,
    "regression_angle" DOUBLE PRECISION,
    "line_origin_ts"   INTEGER,
    "touches"          INTEGER,

    -- fitting window
    "window_start_ts" INTEGER,
    "window_end_ts"   INTEGER,
    "window_bars"     INTEGER,
    "math_lookback"   INTEGER,
    "crossings_n"     INTEGER,

    -- [MODEL A; CROSSINGS] — centroid variants only
    "model_a_n"         INTEGER,
    "model_a_r2"        DOUBLE PRECISION,
    "model_a_mse"       DOUBLE PRECISION,
    "model_a_var_ratio" DOUBLE PRECISION,
    "model_a_skew"      DOUBLE PRECISION,
    "model_a_kurt"      DOUBLE PRECISION,

    -- [MODEL B; CLOSE PRICE] — all 10 sources
    "model_b_n"         INTEGER,
    "model_b_r2"        DOUBLE PRECISION,
    "model_b_mse"       DOUBLE PRECISION,
    "model_b_var_ratio" DOUBLE PRECISION,
    "model_b_skew"      DOUBLE PRECISION,
    "model_b_kurt"      DOUBLE PRECISION,

    -- [EDT CHANNEL] — 7 centroids + fractal_edt (single lines have no channel)
    "uoedt_offset"      DOUBLE PRECISION,
    "loedt_offset"      DOUBLE PRECISION,
    "containment_n"     INTEGER,
    "containment_count" INTEGER,
    "containment_rate"  DOUBLE PRECISION,

    "config_hash" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_statistics_pkey" PRIMARY KEY ("id")
);

-- The append-only guarantee lives here: one row per fit per observation moment.
-- Postgres backs this with a btree index on exactly these columns, so it also
-- serves the "this indicator, this timeframe, over time" read path. No separate
-- non-unique index on the same list — it would be pure write cost on a table
-- designed to grow ~1M rows/year and never be updated.
CREATE UNIQUE INDEX "indicator_statistics_symbol_timeframe_source_captured_at_key"
    ON "indicator_statistics" ("symbol", "timeframe", "source", "captured_at");

-- Supports "show me this indicator's quality over time", the primary
-- drift-detection query.
CREATE INDEX "indicator_statistics_source_captured_at_idx"
    ON "indicator_statistics" ("source", "captured_at");

-- AddForeignKey
ALTER TABLE "indicator_statistics"
    ADD CONSTRAINT "indicator_statistics_config_hash_fkey"
    FOREIGN KEY ("config_hash") REFERENCES "indicator_configs" ("config_hash")
    ON DELETE RESTRICT ON UPDATE CASCADE;
