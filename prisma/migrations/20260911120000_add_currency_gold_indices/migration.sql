-- ============================================================
-- Migration: 20260911120000_add_currency_gold_indices
--
-- Lane 4: G8 Currency & Gold Index Suite -- the public landing-page widget's
-- data source (8 equal-weighted currency indices + rebased gold index XAUX,
-- computed by currency_gold_index_engine.py, a fully separate VPS process
-- from the v6 alert pipeline: own script, own NSSM service, own SQLite
-- outbox, never xauusd.db). Design:
-- davintrade-currency-index-stack/COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md
--
-- PURELY ADDITIVE -- one new table. market_data_v6, indicator_statistics,
-- indicator_configs and economic_events are not touched in any way, so this
-- carries no risk to any existing row and no risk to the running alert
-- pipeline.
--
-- UNLIKE indicator_statistics/economic_events, this is NOT an append-only
-- revision stream: (index_name, bar_time) has exactly one correct value -- a
-- deterministic, stateless recomputation from that bar's own rates (see
-- currency_gold_index_engine.py's index_value() docstring) -- so the gateway
-- upserts in place rather than always inserting a new row. A retry
-- delivering the same key is a true no-op, not an append.
--
-- This migration has been authored, NOT applied, per this repo's standing
-- rule that the Executor never applies a schema migration to a live
-- database.
-- ============================================================

-- CreateTable
CREATE TABLE "currency_gold_indices" (
    "id"          TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "index_name"  TEXT NOT NULL,
    "bar_time"    INTEGER NOT NULL,

    "value"      DOUBLE PRECISION NOT NULL,
    "change_pct" DOUBLE PRECISION NOT NULL,

    "session_open_bar_time" INTEGER NOT NULL,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_gold_indices_pkey" PRIMARY KEY ("id")
);

-- One row per (index_name, bar_time). Backed by a btree index Postgres also
-- uses for the "this index over time" sparkline read path -- no separate
-- non-unique index on the same list.
CREATE UNIQUE INDEX "currency_gold_indices_index_name_bar_time_key"
    ON "currency_gold_indices" ("index_name", "bar_time");

-- Descending variant for the sparkline read path (latest-N-bars-per-index),
-- matching indicator_statistics' own "source, captured_at" index precedent.
CREATE INDEX "currency_gold_indices_index_name_bar_time_idx"
    ON "currency_gold_indices" ("index_name", "bar_time" DESC);
