-- Stack D chapter 1 tables (build step 2, part 2): market_cycles,
-- active_indicator_settings, symbol_specs, cycle_events.
-- docs/STACK-D-ARCHITECTURE.md section 1; plan docs/handoffs/2026-10-01-2321-step2-plan.md.
--
-- ADDITIVE ONLY. Four new tables and their indexes, no foreign keys, touching
-- nothing that exists, so it is safe to apply while the pipeline is running. The
-- one data change is the two seed rows at the end. Nothing writes these tables
-- until later parts of build step 2 deploy; an unapplied migration is harmless
-- to everything that runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL
-- below is `prisma migrate diff --from-schema <schema at the previous commit>
-- --to-schema prisma/market-data/schema.prisma --script` verbatim (the two
-- "injected env" lines that command prints to stdout in this repo removed).
--
-- ROLLOUT ORDER. Apply BEFORE any railway-gateway deploy that writes these
-- tables (parts 4, 6, 8 and 9). Run `prisma migrate status` first:
-- `migrate deploy` applies EVERY pending migration in history order, and
-- production may still lack 20260920000000_add_market_data_point_in_time,
-- 20260920000000_add_indicator_statistics_extended and
-- 20260922000000_add_market_data_v6_sr2_levels (waiting-on.md, section 0.5).
-- This migration does not depend on any of them. To apply it alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261002000000_add_cycle_pipeline_tables`.
--
-- Written by the gateway, never by hand, except the seed below.

-- CreateTable
CREATE TABLE "market_cycles" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "data_status" TEXT,
    "attempts" INTEGER NOT NULL,
    "manifest_received_at" INTEGER NOT NULL,
    "ready_at" INTEGER,
    "collector_started_at" INTEGER,
    "collector_validated_at" INTEGER,
    "m5_collection_cycle_id" INTEGER,
    "m15_collection_cycle_id" INTEGER,
    "m5_bar_count" INTEGER,
    "m15_bar_count" INTEGER,
    "m5_newest_bar_ts" INTEGER,
    "m15_newest_bar_ts" INTEGER,
    "m5_export_at" INTEGER,
    "m15_export_at" INTEGER,
    "check_detail" JSONB,
    "terminal_id" TEXT,
    "config_hashes" JSONB,
    "source_modes" JSONB,
    "retuning" BOOLEAN NOT NULL DEFAULT false,
    "backlog_rows" INTEGER,
    "repush_rows_unsent" INTEGER,
    "closed_bars_digest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_indicator_settings" (
    "id" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "effective_slot" INTEGER NOT NULL,
    "set_by" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_indicator_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_specs" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "captured_at" INTEGER NOT NULL,
    "contract_size" DOUBLE PRECISION NOT NULL,
    "volume_min" DOUBLE PRECISION NOT NULL,
    "volume_step" DOUBLE PRECISION NOT NULL,
    "volume_max" DOUBLE PRECISION NOT NULL,
    "tick_size" DOUBLE PRECISION NOT NULL,
    "typical_spread" DOUBLE PRECISION NOT NULL,
    "swap_long" DOUBLE PRECISION NOT NULL,
    "swap_short" DOUBLE PRECISION NOT NULL,
    "point" DOUBLE PRECISION NOT NULL,
    "digits" INTEGER NOT NULL,
    "swap_mode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symbol_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_events" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "effective_slot" INTEGER NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "terminal_id" TEXT,
    "config_hashes" JSONB,
    "source_modes" JSONB,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_cycles_symbol_slot_key" ON "market_cycles"("symbol", "slot");

-- CreateIndex
CREATE INDEX "active_indicator_settings_timeframe_effective_slot_idx" ON "active_indicator_settings"("timeframe", "effective_slot");

-- CreateIndex
CREATE UNIQUE INDEX "symbol_specs_symbol_captured_at_key" ON "symbol_specs"("symbol", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "symbol_specs_symbol_version_key" ON "symbol_specs"("symbol", "version");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_events_dedupe_key_key" ON "cycle_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "cycle_events_symbol_event_type_effective_slot_idx" ON "cycle_events"("symbol", "event_type", "effective_slot");

-- Seed: the ADR-010 starting values (M15 non_b, M5 best_fit_a), effective from
-- slot 0 so that every slot resolves to a setting. `set_by` 'migration' marks
-- them as not chosen by an admin. Idempotent: re-running changes nothing.
INSERT INTO "active_indicator_settings" ("id", "timeframe", "source", "effective_slot", "set_by", "reason")
VALUES
    ('seed_active_indicator_m15_non_b', 'M15', 'non_b', 0, 'migration', 'ADR-010 starting value'),
    ('seed_active_indicator_m5_best_fit_a', 'M5', 'best_fit_a', 0, 'migration', 'ADR-010 starting value')
ON CONFLICT ("id") DO NOTHING;
