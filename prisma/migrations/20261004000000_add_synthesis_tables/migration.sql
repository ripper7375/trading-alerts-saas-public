-- Stack D chapter 3 tables (build step 4, part 4): synthesis_readings, entry_zones.
-- docs/STACK-D-ARCHITECTURE.md section 3 (3.5 the SYN reading, 3.6 the entry-zone row);
-- plan docs/handoffs/2026-10-04-0110-step4-plan.md, decision D9.
--
-- ADDITIVE ONLY. Two new tables, their two unique indexes and CHECK constraints, no
-- foreign keys, touching nothing that exists, and no data is written. It is safe to
-- apply while the pipeline is running. Nothing writes these tables until the gateway's
-- synthesis step (build step 4 part 5) is deployed AND the SYN flag is turned on
-- (mcd_worker/worker_config.yaml, off); an unapplied migration is harmless to
-- everything that runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL
-- between "-- CreateTable" and the last "-- CreateIndex" is
-- `prisma migrate diff --from-schema <prisma/market-data/schema.prisma at the previous
-- commit> --to-schema prisma/market-data/schema.prisma --script` verbatim (the two
-- "injected env" lines that command prints to stdout in this repo removed). The CHECK
-- constraints after it are hand-written: Prisma cannot express them and its diff does
-- not see them, so they do not show up as drift. railway-gateway/test/schema-sync.spec.ts
-- compares them with the model.
--
-- ROLLOUT ORDER. Apply BEFORE the gateway version of build step 4 part 5 is deployed
-- (a job that writes to a missing table fails). Run `prisma migrate status` first:
-- `migrate deploy` applies EVERY pending migration in history order, and
-- 20261002000000_add_cycle_pipeline_tables and 20261003000000_add_sensor_tables (and
-- possibly three older ones, see waiting-on.md) may still be pending. This migration
-- does not depend on any of them. To apply it alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261004000000_add_synthesis_tables`.
--
-- ROLLBACK, only while nothing has been written (the tables hold nothing else):
-- DROP TABLE "entry_zones", "synthesis_readings";
-- then `prisma migrate resolve --rolled-back 20261004000000_add_synthesis_tables`.
--
-- Written by the gateway's synthesis step, never by hand.

-- CreateTable
CREATE TABLE "synthesis_readings" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cycle_slot" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "rules_version" TEXT NOT NULL,
    "rules_sha256" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "status" TEXT NOT NULL,
    "status_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "data_status" TEXT NOT NULL,
    "archetype" TEXT,
    "bias" TEXT NOT NULL,
    "trend_relation" TEXT,
    "stand_aside" BOOLEAN NOT NULL,
    "reading_json" TEXT NOT NULL,
    "reading" JSONB NOT NULL,
    "reading_sha256" TEXT NOT NULL,
    "zone_count" INTEGER NOT NULL,
    "zones_reason" TEXT,
    "zones_json" TEXT NOT NULL,
    "zones_sha256" TEXT NOT NULL,
    "zone_params_version" TEXT NOT NULL,
    "zone_params_sha256" TEXT NOT NULL,
    "reference_price" DOUBLE PRECISION,
    "guard_problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputs_sha256" TEXT,
    "retuning_observed" BOOLEAN NOT NULL,
    "retuning_applied" BOOLEAN NOT NULL,
    "runner_version" TEXT NOT NULL,
    "python_version" TEXT NOT NULL,
    "duration_ms" DOUBLE PRECISION NOT NULL,
    "evaluated_at" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synthesis_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_zones" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cycle_slot" INTEGER NOT NULL,
    "profile" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "bias" TEXT NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "reference_price" DOUBLE PRECISION NOT NULL,
    "source_sensors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confluence_count" INTEGER NOT NULL,
    "invalidation_price" DOUBLE PRECISION NOT NULL,
    "invalidation_basis" TEXT NOT NULL,
    "stop_distance" DOUBLE PRECISION NOT NULL,
    "next_opposing_price" DOUBLE PRECISION,
    "runway" DOUBLE PRECISION,
    "runway_ratio" DOUBLE PRECISION,
    "levels" JSONB NOT NULL,
    "zone_params_version" TEXT NOT NULL,
    "zone_params_sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entry_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "synthesis_readings_symbol_cycle_slot_profile_key" ON "synthesis_readings"("symbol", "cycle_slot", "profile");

-- CreateIndex
CREATE UNIQUE INDEX "entry_zones_symbol_cycle_slot_profile_zone_id_key" ON "entry_zones"("symbol", "cycle_slot", "profile", "zone_id");


-- Rules Prisma cannot express. Hand-written; not part of the diff above.
--
-- The architecture's rules that one row can show are checked here, as the last line of
-- defence: the synthesis step checks every reading (syn-output/1) and every zone
-- (zone_problems) before it writes, and a row that breaks one of these is a bug, not
-- data. Prisma leaves a TEXT[] column nullable and a NOT NULL added by hand would show
-- up as drift, so "no reasons" stays an empty array through the *_not_null CHECKs.
--
-- The constants (5 zones at most, a stop of at least 13, the half cent of a two-decimal
-- price) are decisions: changing one is a new decision and a new migration, never an
-- edit of this file, like the n >= 30 gate of state_statistics.

-- ============================================================ synthesis_readings

-- Only a SYN flag that makes readings writes them (ADR: off makes nothing).
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_flag_is_shadow_or_live" CHECK ("flag" IN ('shadow', 'live'));

ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_profile_is_known" CHECK ("profile" IN ('DAY_TRADER', 'SCALPER'));

-- 3.10 item 4: standing aside and having no direction are the same fact.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_stand_aside_is_the_bias" CHECK ("stand_aside" = ("bias" = 'STAND_ASIDE'));

-- At most five zones, and none for a reading with no direction (a stand-aside, a
-- neutral): a zone only means something beside a LONG or a SHORT.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_zone_count_range" CHECK ("zone_count" BETWEEN 0 AND 5);

ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_zones_need_a_direction" CHECK (
    "zone_count" = 0
    OR "bias" IN ('LONG', 'SHORT')
);

-- A reading with zones has no reason for having none, and one without them says why.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_zones_reason_follows_the_count" CHECK (("zone_count" > 0) = ("zones_reason" IS NULL));

ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_list_columns_not_null" CHECK (
    "status_reasons" IS NOT NULL
    AND "guard_problems" IS NOT NULL
);

-- syn-output/1: a VALID reading has no status reasons and every other status has one or more.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_reasons_follow_the_status" CHECK (("status" = 'VALID') = (cardinality("status_reasons") = 0));

-- The text is the record: its JSONB copy is the same document and its hash is its own.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_reading_text_is_its_copy_and_hash" CHECK (
    "reading_json"::jsonb = "reading"
    AND encode(sha256(convert_to("reading_json", 'UTF8')), 'hex') = "reading_sha256"
);

-- The zone text is a list of exactly zone_count rows and its hash is its own. The CASE keeps
-- a text that is not a list a plain constraint violation (jsonb_array_length would raise
-- another error on an object, and AND does not promise to look at jsonb_typeof first).
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_zones_text_is_its_count_and_hash" CHECK (
    CASE WHEN jsonb_typeof("zones_json"::jsonb) = 'array'
        THEN jsonb_array_length("zones_json"::jsonb) = "zone_count"
        ELSE FALSE
    END
    AND encode(sha256(convert_to("zones_json", 'UTF8')), 'hex') = "zones_sha256"
);

-- The columns repeat the reading's own fields and name its zones; none can disagree with it.
ALTER TABLE "synthesis_readings" ADD CONSTRAINT "synthesis_readings_columns_repeat_the_reading" CHECK (
    ("reading"->>'profile') = "profile"
    AND ("reading"->>'cycle_slot') = to_char(to_timestamp("cycle_slot"::double precision) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"')
    AND ("reading"->>'rules_version') = "rules_version"
    AND ("reading"->>'rules_sha256') = "rules_sha256"
    AND ("reading"->>'rule_id') = "rule_id"
    AND ("reading"->>'branch_id') IS NOT DISTINCT FROM "branch_id"
    AND ("reading"->>'status') = "status"
    AND ("reading"->'status_reasons') = to_jsonb("status_reasons")
    AND ("reading"->>'data_status') = "data_status"
    AND ("reading"->>'archetype') IS NOT DISTINCT FROM "archetype"
    AND ("reading"->>'bias') = "bias"
    AND ("reading"->>'trend_relation') IS NOT DISTINCT FROM "trend_relation"
    AND ("reading"->>'stand_aside')::boolean = "stand_aside"
    AND jsonb_array_length("reading"->'zones') = "zone_count"
);

-- ============================================================ entry_zones

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_profile_is_known" CHECK ("profile" IN ('DAY_TRADER', 'SCALPER'));

-- Zones exist only for a direction (3.6; 3.10 item 4).
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_bias_is_a_direction" CHECK ("bias" IN ('LONG', 'SHORT'));

-- At most five, ranked 1 to 5, the id says the rank (the reading's `zones` lists Z1.. in rank order).
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_rank_and_id" CHECK (
    "rank" BETWEEN 1 AND 5
    AND "zone_id" = 'Z' || "rank"::text
);

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_prices_are_positive" CHECK (
    "low" > 0
    AND "high" > 0
    AND "reference_price" > 0
    AND "invalidation_price" > 0
);

-- 3.6: the reference price (the entry) lies inside the zone.
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_reference_price_is_inside_the_zone" CHECK (
    "low" <= "reference_price"
    AND "reference_price" <= "high"
);

-- The invalidation is on the far side of the entry: below a LONG's, above a SHORT's.
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_invalidation_is_beyond_the_reference_price" CHECK (
    ("bias" = 'LONG' AND "invalidation_price" < "reference_price")
    OR ("bias" = 'SHORT' AND "invalidation_price" > "reference_price")
);

-- 3.6, 3.10 item 5, ADR-032: a stop of less than 13 dollars is never stored (Engine 4's
-- minimum stop distance). Changing 13 is a new decision and a new migration.
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_stop_distance_is_at_least_13" CHECK ("stop_distance" >= 13);

-- ...and the stop distance is what it says: the distance from the entry to the invalidation
-- (prices are on a cent grid, so half a cent is the tolerance for DOUBLE PRECISION).
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_stop_distance_is_the_distance" CHECK (abs(abs("reference_price" - "invalidation_price") - "stop_distance") < 0.005);

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_invalidation_basis_is_known" CHECK ("invalidation_basis" IN ('LEVEL', 'MINIMUM_STOP', 'NO_LEVEL'));

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_sources_not_empty" CHECK (
    "source_sensors" IS NOT NULL
    AND cardinality("source_sensors") >= 1
);

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_confluence_at_least_the_source" CHECK ("confluence_count" >= 1);

-- D7 (e): a zone with no level beyond the entry has no runway and no ratio: the three are
-- all NULL or all there, and the opposing level lies beyond the entry (above a LONG's, below a SHORT's).
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_runway_is_all_or_nothing" CHECK (
    ("next_opposing_price" IS NULL) = ("runway" IS NULL)
    AND ("runway" IS NULL) = ("runway_ratio" IS NULL)
    AND ("runway" IS NULL OR ("runway" > 0 AND "runway_ratio" >= 0))
);

ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_runway_is_the_distance_to_the_opposing_level" CHECK (
    "next_opposing_price" IS NULL
    OR (
        (
            ("bias" = 'LONG' AND "next_opposing_price" > "reference_price")
            OR ("bias" = 'SHORT' AND "next_opposing_price" < "reference_price")
        )
        AND abs(abs("next_opposing_price" - "reference_price") - "runway") < 0.005
    )
);

-- The audit trail is a document with its four parts, and the columns that repeat it agree with it.
ALTER TABLE "entry_zones" ADD CONSTRAINT "entry_zones_levels_match_the_columns" CHECK (
    jsonb_typeof("levels") = 'object'
    AND "levels" ?& ARRAY['source_levels', 'confluence_levels', 'invalidation_level', 'next_opposing_level']
    AND jsonb_array_length("levels"->'confluence_levels') = "confluence_count"
    AND ("levels"->'next_opposing_level' = 'null'::jsonb) = ("next_opposing_price" IS NULL)
    AND ("levels"->'invalidation_level' = 'null'::jsonb) = ("invalidation_basis" = 'NO_LEVEL')
);
