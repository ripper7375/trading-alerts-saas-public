-- Stack D chapter 2 tables (build step 3, part 2): mcd_outputs,
-- market_cycle_inputs, state_statistics.
-- docs/STACK-D-ARCHITECTURE.md section 2; plan docs/handoffs/2026-10-02-1707-step3-plan.md.
--
-- ADDITIVE ONLY. Three new tables, their indexes and three CHECK constraints, no
-- foreign keys, touching nothing that exists, and no data is written. It is safe
-- to apply while the pipeline is running. Nothing writes these tables until the
-- sensor worker (build step 3 part 4) is deployed AND enabled
-- (SENSOR_WORKER_ENABLED, off by default); an unapplied migration is harmless to
-- everything that runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL
-- between "-- CreateTable" and the last "-- CreateIndex" is
-- `prisma migrate diff --from-schema <schema at the previous commit>
-- --to-schema prisma/market-data/schema.prisma --script` verbatim (the two
-- "injected env" lines that command prints to stdout in this repo removed). The
-- CHECK constraints after it are hand-written: Prisma cannot express them and its
-- diff does not see them, so they do not show up as drift.
--
-- ROLLOUT ORDER. Apply BEFORE the sensor worker is enabled (build step 3, phase B,
-- B0). Run `prisma migrate status` first: `migrate deploy` applies EVERY pending
-- migration in history order, and 20261002000000_add_cycle_pipeline_tables (and
-- possibly three older ones, see waiting-on.md) may still be pending. This
-- migration does not depend on any of them. To apply it alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261003000000_add_sensor_tables`.
--
-- ROLLBACK, only while nothing has been written (the tables hold nothing else):
-- DROP TABLE "state_statistics", "market_cycle_inputs", "mcd_outputs";
-- then `prisma migrate resolve --rolled-back 20261003000000_add_sensor_tables`.
--
-- Written by the gateway's sensor worker, never by hand.

-- CreateTable
CREATE TABLE "mcd_outputs" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cycle_slot" INTEGER NOT NULL,
    "mcd_id" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "evaluator_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state_code" TEXT,
    "bias" TEXT,
    "envelope_json" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "envelope_sha256" TEXT NOT NULL,
    "evaluator_envelope_sha256" TEXT NOT NULL,
    "inputs_sha256" TEXT,
    "inherited_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guard_problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retuning_observed" BOOLEAN NOT NULL,
    "retuning_applied" BOOLEAN NOT NULL,
    "runner_version" TEXT NOT NULL,
    "python_version" TEXT NOT NULL,
    "duration_ms" DOUBLE PRECISION NOT NULL,
    "evaluated_at" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcd_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_cycle_inputs" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cycle_slot" INTEGER NOT NULL,
    "bundle_gz" BYTEA NOT NULL,
    "bundle_encoding" TEXT NOT NULL,
    "bundle_bytes" INTEGER NOT NULL,
    "inputs_sha256" TEXT NOT NULL,
    "retuning_observed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_cycle_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "state_statistics" (
    "id" TEXT NOT NULL,
    "mcd_id" TEXT NOT NULL,
    "evaluator_version_series" TEXT NOT NULL,
    "config_hash_key" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "horizon_hours" INTEGER NOT NULL,
    "n" INTEGER NOT NULL,
    "forward_move_median" DOUBLE PRECISION,
    "forward_move_q1" DOUBLE PRECISION,
    "forward_move_q3" DOUBLE PRECISION,
    "opposing_level_rate" DOUBLE PRECISION,
    "adverse_excursion_median" DOUBLE PRECISION,
    "adverse_excursion_q3" DOUBLE PRECISION,
    "series_notes" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcd_outputs_symbol_cycle_slot_mcd_id_key" ON "mcd_outputs"("symbol", "cycle_slot", "mcd_id");

-- CreateIndex
CREATE INDEX "market_cycle_inputs_cycle_slot_idx" ON "market_cycle_inputs"("cycle_slot");

-- CreateIndex
CREATE UNIQUE INDEX "market_cycle_inputs_symbol_cycle_slot_key" ON "market_cycle_inputs"("symbol", "cycle_slot");

-- CreateIndex
CREATE UNIQUE INDEX "state_statistics_series_key" ON "state_statistics"("mcd_id", "evaluator_version_series", "config_hash_key", "state_code", "horizon_hours");


-- Rules Prisma cannot express. Hand-written; not part of the diff above.

-- ADR-022: below n = 30 a state has a count and no number. Every measured column
-- must be NULL unless n >= 30. When a measured column is added to the model it
-- must be added here too (railway-gateway/test/schema-sync.spec.ts fails if not).
ALTER TABLE "state_statistics" ADD CONSTRAINT "state_statistics_n_gate" CHECK (
    "n" >= 30
    OR (
        "forward_move_median" IS NULL
        AND "forward_move_q1" IS NULL
        AND "forward_move_q3" IS NULL
        AND "opposing_level_rate" IS NULL
        AND "adverse_excursion_median" IS NULL
        AND "adverse_excursion_q3" IS NULL
    )
);

-- mcd_outputs holds the readings of MCDs that run (shadow or live), never one whose
-- flag is off.
ALTER TABLE "mcd_outputs" ADD CONSTRAINT "mcd_outputs_flag_is_shadow_or_live" CHECK ("flag" IN ('shadow', 'live'));

-- Prisma creates a TEXT[] column without NOT NULL and a NOT NULL added by hand
-- would show up as drift, so this CHECK is what keeps "no reasons" an empty array
-- instead of NULL (cardinality(NULL) is NULL, which would hide a row from a count).
ALTER TABLE "mcd_outputs" ADD CONSTRAINT "mcd_outputs_reason_lists_not_null" CHECK (
    "inherited_reasons" IS NOT NULL
    AND "guard_problems" IS NOT NULL
);
