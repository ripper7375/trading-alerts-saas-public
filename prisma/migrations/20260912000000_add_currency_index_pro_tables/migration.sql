-- ============================================================
-- Migration: 20260912000000_add_currency_index_pro_tables
--
-- Currency Index PRO Plan (Phase 1 of 5) -- database foundation for the
-- 28-pair relative strength screener built on top of the already-live Lane 4
-- Currency & Gold Index Stack (currency_gold_indices). Design:
-- davintrade-currency-index-pro-plan/COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_INDEX_PRO_PLAN.md
--
-- PURELY ADDITIVE -- four new tables. currency_gold_indices, market_data_v6,
-- indicator_statistics, indicator_configs and economic_events are not
-- touched in any way, so this carries no risk to any existing row and no
-- risk to the running alert pipeline or the live Lane 4 landing widget.
--
-- This repo's two Prisma schema files (prisma/market-data/schema.prisma,
-- prisma/non-market-data/schema.prisma) share one physical database and one
-- migration history (LESSONS-LEARNED.md L24), so one migration correctly
-- covers tables declared in either file:
--   - daily_currency_index_metrics, daily_volatility_corridors,
--     currency_index_signals  -> declared in prisma/market-data/schema.prisma
--     (pure market/signal data, no user reference, same file as
--     CurrencyGoldIndex/EconomicEvent/IndicatorStatistic).
--   - user_currency_index_preferences -> declared in
--     prisma/non-market-data/schema.prisma (the spec's own illustrative
--     placement put this table in market-data instead, but every other
--     per-user table -- UserPreferences, UserAppearance -- lives alongside
--     User in non-market-data, which is the only schema file with any user
--     FK at all; corrected here to match that established convention).
--
-- This migration has been authored, NOT applied, per this repo's standing
-- rule that the Executor never applies a schema migration to a live
-- database.
-- ============================================================

-- CreateTable: daily_currency_index_metrics
-- Pre-aggregated daily peak-excursion metrics per FX currency index (the 8
-- G8 currencies only -- never XAUX). One row per (date, index_name),
-- finalized once that trading day's session has closed. `date` is unix UTC
-- (that day's own session_open_bar_time), matching every other business
-- timestamp in this schema (bar_time, event_time, captured_at) rather than
-- a separate DATE column.
CREATE TABLE "daily_currency_index_metrics" (
    "id"         TEXT NOT NULL,
    "date"       INTEGER NOT NULL,
    "index_name" TEXT NOT NULL,

    "open_value"    DOUBLE PRECISION NOT NULL,
    "peak_high_pct" DOUBLE PRECISION NOT NULL,
    "peak_low_pct"  DOUBLE PRECISION NOT NULL,
    "close_pct"     DOUBLE PRECISION NOT NULL,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_currency_index_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_currency_index_metrics_date_index_name_key"
    ON "daily_currency_index_metrics" ("date", "index_name");

CREATE INDEX "daily_currency_index_metrics_date_idx"
    ON "daily_currency_index_metrics" ("date");

-- CreateTable: daily_volatility_corridors
-- The daily system-calculated Dynamic Volatility Corridor (spec Section 3.2's
-- mu_basket/sigma_basket), one row per trading day. `date` uses the same
-- unix-UTC session_open_bar_time convention as the table above.
CREATE TABLE "daily_volatility_corridors" (
    "id"               TEXT NOT NULL,
    "date"             INTEGER NOT NULL,
    "lookback_days"    INTEGER NOT NULL DEFAULT 20,
    "strike_zone_pct"  DOUBLE PRECISION NOT NULL,
    "extreme_zone_pct" DOUBLE PRECISION NOT NULL,
    "mean_excursion"   DOUBLE PRECISION NOT NULL,
    "std_dev"          DOUBLE PRECISION NOT NULL,

    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_volatility_corridors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_volatility_corridors_date_key"
    ON "daily_volatility_corridors" ("date");

-- CreateTable: currency_index_signals
-- Audit log of generated Stage A / Stage B signals. Declared now, populated
-- starting Phase 2 (no writer exists yet in this migration's own phase).
CREATE TABLE "currency_index_signals" (
    "id"          TEXT NOT NULL,
    "timeframe"   TEXT NOT NULL DEFAULT 'M15',
    "bar_time"    INTEGER NOT NULL,
    "index_name"  TEXT NOT NULL,
    "index_value" DOUBLE PRECISION NOT NULL,
    "hrma_val"    DOUBLE PRECISION NOT NULL,
    "smma_val"    DOUBLE PRECISION NOT NULL,
    "zone_state"  TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "top_pairs"   JSONB NOT NULL,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_index_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "currency_index_signals_bar_time_index_name_idx"
    ON "currency_index_signals" ("bar_time", "index_name");

-- CreateTable: user_currency_index_preferences
-- Per-user slider/period overrides. FK to the real "User" table -- this is
-- the one model of the four with a user reference, hence its placement in
-- non-market-data's own migration history/schema rather than market-data's.
CREATE TABLE "user_currency_index_preferences" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 20,
    "useAutoZones" BOOLEAN NOT NULL DEFAULT true,
    "customObPct"  DOUBLE PRECISION,
    "customOsPct"  DOUBLE PRECISION,
    "hrmaPeriod"   INTEGER NOT NULL DEFAULT 36,
    "smmaPeriod"   INTEGER NOT NULL DEFAULT 13,
    "preferredTf"  TEXT NOT NULL DEFAULT 'M15',
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_currency_index_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_currency_index_preferences_userId_key"
    ON "user_currency_index_preferences" ("userId");

CREATE INDEX "user_currency_index_preferences_userId_idx"
    ON "user_currency_index_preferences" ("userId");

-- AddForeignKey
ALTER TABLE "user_currency_index_preferences"
    ADD CONSTRAINT "user_currency_index_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
