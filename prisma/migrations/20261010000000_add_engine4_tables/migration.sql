-- Stack D chapter 6 tables (build step 5, part 5): user_trade_preferences,
-- user_trade_preferences_history, trade_consent_records.
-- docs/STACK-D-ARCHITECTURE.md section 6 (6.2 the profile, 6.11 the consent record);
-- plan docs/handoffs/2026-10-09-1357-step5-plan.md, decisions D10 and D12.
--
-- ADDITIVE ONLY. Three new tables, their indexes, their foreign keys, CHECK constraints
-- and one trigger function; it touches nothing that exists (the foreign keys only
-- REFERENCE "User") and writes no data. It is safe to apply while the app is running.
-- Nothing writes these tables until the Engine 4 stores (lib/engine4/store/) are called
-- by a route, and no route exists yet; an unapplied migration is harmless to everything
-- that runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL between
-- "-- CreateTable" and the last "-- AddForeignKey" is
-- `prisma migrate diff --from-schema <prisma/non-market-data/schema.prisma at HEAD> --to-schema prisma/non-market-data/schema.prisma --script`
-- verbatim. Everything after it is hand-written: Prisma cannot express a CHECK or a
-- trigger and its diff does not see them, so they never show up as drift.
--
-- ROLLOUT ORDER. Run `prisma migrate status` first: `migrate deploy` applies EVERY pending
-- migration in history order (20261002000000, 20261003000000 and 20261004000000 may still
-- be pending, and none of them is needed by this one). To apply this migration alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261010000000_add_engine4_tables`.
-- Provision ENGINE4_AUDIT_HMAC_KEY (and ENGINE4_AUDIT_HMAC_KEY_VERSION) in Vercel before
-- any route writes: the stores refuse to write without a key.
--
-- ROLLBACK, only while nothing has been written (the audit tables hold legal records and
-- the trigger below does not stop a DROP TABLE, so check the row counts first):
-- DROP TABLE "trade_consent_records", "user_trade_preferences", "user_trade_preferences_history";
-- DROP FUNCTION "engine4_audit_append_only"();
-- then `prisma migrate resolve --rolled-back 20261010000000_add_engine4_tables`.
--
-- WHAT DELETING A User DOES (the database does it, no application code):
--   user_trade_preferences          the row is DELETED (ON DELETE CASCADE): it is the current
--                                   profile, personal data, and has no hash.
--   user_trade_preferences_history  user_id becomes NULL (ON DELETE SET NULL); user_id_hash,
--   trade_consent_records           key_version and every other column stay as they were.
-- The consent record and the history point at each other's rows with ON DELETE RESTRICT, and
-- nothing in this file cascades into an audit table.

-- CreateTable
CREATE TABLE "user_trade_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "trader_type" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "max_risk_pct" TEXT NOT NULL,
    "max_leverage" TEXT NOT NULL,
    "target_rrr" TEXT NOT NULL,
    "equity" TEXT NOT NULL,
    "min_sld" TEXT NOT NULL,
    "commission" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_trade_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trade_preferences_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_id_hash" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "trader_type" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "max_risk_pct" TEXT NOT NULL,
    "max_leverage" TEXT NOT NULL,
    "target_rrr" TEXT NOT NULL,
    "equity" TEXT NOT NULL,
    "min_sld" TEXT NOT NULL,
    "commission" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_trade_preferences_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_consent_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_id_hash" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "cycle_slot" INTEGER NOT NULL,
    "synthesis_rule_id" TEXT NOT NULL,
    "synthesis_rules_version" TEXT NOT NULL,
    "zone_id" TEXT,
    "side" TEXT,
    "profile_snapshot_id" TEXT NOT NULL,
    "badge" TEXT,
    "setup_json" TEXT NOT NULL,
    "setup" JSONB NOT NULL,
    "setup_sha256" TEXT NOT NULL,
    "engine4_version" TEXT NOT NULL,
    "symbol_specs_version" INTEGER,
    "template_version" TEXT NOT NULL,
    "disclaimer_version" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_trade_preferences_user_id_key" ON "user_trade_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_trade_preferences_snapshot_id_idx" ON "user_trade_preferences"("snapshot_id");

-- CreateIndex
CREATE INDEX "user_trade_preferences_history_user_id_recorded_at_idx" ON "user_trade_preferences_history"("user_id", "recorded_at");

-- CreateIndex
CREATE INDEX "user_trade_preferences_history_user_id_hash_recorded_at_idx" ON "user_trade_preferences_history"("user_id_hash", "recorded_at");

-- CreateIndex
CREATE INDEX "trade_consent_records_user_id_recorded_at_idx" ON "trade_consent_records"("user_id", "recorded_at");

-- CreateIndex
CREATE INDEX "trade_consent_records_user_id_hash_recorded_at_idx" ON "trade_consent_records"("user_id_hash", "recorded_at");

-- CreateIndex
CREATE INDEX "trade_consent_records_profile_snapshot_id_idx" ON "trade_consent_records"("profile_snapshot_id");

-- AddForeignKey
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "user_trade_preferences_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_profile_snapshot_id_fkey" FOREIGN KEY ("profile_snapshot_id") REFERENCES "user_trade_preferences_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules Prisma cannot express. Hand-written; not part of the diff above.
--
-- The profile rules are the database's twin of lib/engine4/profile.ts (`validateProfile`):
-- a profile the engine accepts, the database accepts, and the other way round. The stores
-- check first (and refuse with every problem at once); these constraints are the last line
-- of defence for a row written any other way. The figures are canonical decimal TEXT, as
-- the engine returns them, so a column scale can never round a trader's number. The
-- bounds are decisions of architecture 6.2: changing one is a new decision and a new
-- migration, never an edit of this file.
--
-- Every bound is a CASE on the decimal-text rule: a text that is not a number is the
-- "figures_are_decimal_text" constraint's business alone, so each constraint fails for
-- its own rule only and a cast never raises another error.
-- The decimal text is the canonical form: no sign, no leading zero, no trailing zero.

-- ============================================================ user_trade_preferences

ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_trader_type_is_known" CHECK ("trader_type" IN ('SCALPER', 'DAY_TRADER'));

ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_style_is_known" CHECK ("style" IN ('TREND_FOLLOWING', 'TREND_COUNTERING', 'BOTH'));

ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_figures_are_decimal_text" CHECK (
    "max_risk_pct" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "max_leverage" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "equity" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "min_sld" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "commission" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
);

-- Max risk per trade: 0.5% to 2.0%.
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_max_risk_pct_bounds" CHECK (
    CASE WHEN "max_risk_pct" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "max_risk_pct"::numeric BETWEEN 0.5 AND 2 ELSE TRUE END
);

-- Maximum leverage: above zero, ceiling 1:5.0.
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_max_leverage_ceiling" CHECK (
    CASE WHEN "max_leverage" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "max_leverage"::numeric > 0 AND "max_leverage"::numeric <= 5 ELSE TRUE END
);

-- Target RRR: 1.5 to 3.5.
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_target_rrr_bounds" CHECK (
    CASE WHEN "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "target_rrr"::numeric BETWEEN 1.5 AND 3.5 ELSE TRUE END
);

-- A counter-trend style: at most 2.5 (ADR-064 applies the same cap per setup).
ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_counter_trend_rrr_cap" CHECK (
    CASE WHEN "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN ("style" <> 'TREND_COUNTERING' OR "target_rrr"::numeric <= 2.5) ELSE TRUE END
);

ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_equity_is_positive" CHECK (
    CASE WHEN "equity" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "equity"::numeric > 0 ELSE TRUE END
);

ALTER TABLE "user_trade_preferences" ADD CONSTRAINT "user_trade_preferences_min_sld_is_positive" CHECK (
    CASE WHEN "min_sld" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "min_sld"::numeric > 0 ELSE TRUE END
);

-- The commission may be zero; the decimal-text rule already refuses a minus sign.

-- ============================================================ user_trade_preferences_history

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_trader_type_is_known" CHECK ("trader_type" IN ('SCALPER', 'DAY_TRADER'));

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_style_is_known" CHECK ("style" IN ('TREND_FOLLOWING', 'TREND_COUNTERING', 'BOTH'));

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_figures_are_decimal_text" CHECK (
    "max_risk_pct" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "max_leverage" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "equity" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "min_sld" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
    AND "commission" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_max_risk_pct_bounds" CHECK (
    CASE WHEN "max_risk_pct" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "max_risk_pct"::numeric BETWEEN 0.5 AND 2 ELSE TRUE END
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_max_leverage_ceiling" CHECK (
    CASE WHEN "max_leverage" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "max_leverage"::numeric > 0 AND "max_leverage"::numeric <= 5 ELSE TRUE END
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_target_rrr_bounds" CHECK (
    CASE WHEN "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "target_rrr"::numeric BETWEEN 1.5 AND 3.5 ELSE TRUE END
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_counter_trend_rrr_cap" CHECK (
    CASE WHEN "target_rrr" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN ("style" <> 'TREND_COUNTERING' OR "target_rrr"::numeric <= 2.5) ELSE TRUE END
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_equity_is_positive" CHECK (
    CASE WHEN "equity" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "equity"::numeric > 0 ELSE TRUE END
);

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_min_sld_is_positive" CHECK (
    CASE WHEN "min_sld" ~ '^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$' THEN "min_sld"::numeric > 0 ELSE TRUE END
);

-- The hash is a lowercase hex HMAC-SHA-256 (64 characters) and says which key version made it
-- (D12: a key is rotated by a new version; an old hash is never recomputed).
ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_user_id_hash_is_hex" CHECK ("user_id_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "user_trade_preferences_history" ADD CONSTRAINT "user_trade_preferences_history_key_version_is_positive" CHECK ("key_version" >= 1);

-- ============================================================ trade_consent_records

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_action_is_known" CHECK ("action" IN ('ACCEPT', 'MODIFY', 'DECLINE'));

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_side_is_known" CHECK ("side" IS NULL OR "side" IN ('BUY', 'SELL'));

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_user_id_hash_is_hex" CHECK ("user_id_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_key_version_is_positive" CHECK ("key_version" >= 1);

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_cycle_slot_is_positive" CHECK ("cycle_slot" > 0);

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_symbol_specs_version_is_positive" CHECK ("symbol_specs_version" IS NULL OR "symbol_specs_version" >= 1);

-- A record that names nothing proves nothing.
ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_names_are_not_empty" CHECK (
    btrim("symbol") <> ''
    AND btrim("synthesis_rule_id") <> ''
    AND btrim("synthesis_rules_version") <> ''
    AND btrim("engine4_version") <> ''
    AND btrim("template_version") <> ''
    AND btrim("disclaimer_version") <> ''
    AND btrim("language") <> ''
);

-- The text is the record: its JSONB copy is the same document and its hash is its own
-- (same pattern as synthesis_readings; the database re-derives the SHA-256).
ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_setup_text_is_its_copy_and_hash" CHECK (
    "setup_json"::jsonb = "setup"
    AND encode(sha256(convert_to("setup_json", 'UTF8')), 'hex') = "setup_sha256"
);

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_setup_is_a_validated_setup" CHECK ("setup"->>'schema' = 'validated-setup/1');

-- The three columns a reader filters on are the setup's own values, not a second opinion.
ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_cycle_slot_follows_the_setup" CHECK ("cycle_slot"::text = "setup"->>'pinnedSlot');

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_side_follows_the_setup" CHECK ("side" IS NOT DISTINCT FROM ("setup"->>'side'));

ALTER TABLE "trade_consent_records" ADD CONSTRAINT "trade_consent_records_zone_follows_the_setup" CHECK ("zone_id" IS NOT DISTINCT FROM ("setup"->'entry'->>'zoneId'));

-- The audit tables are append-only (decision D10 (c)): no UPDATE, no DELETE, no TRUNCATE,
-- with ONE exception, the only change a row may ever have: user_id goes from a value to
-- NULL and nothing else changes. That is what `ON DELETE SET NULL` does when a User row is
-- deleted (the referential action is an UPDATE and fires this trigger), so deleting an
-- account leaves the audit row and its hash intact. A hand-written
-- `UPDATE ... SET user_id = NULL` is allowed for the same reason: it loses nothing that
-- the hash does not keep.
-- Consequence: the id of a User cannot be changed while audit rows name it (ON UPDATE
-- CASCADE would have to rewrite user_id). Ids are cuids and never change.
-- DROP TABLE is not stopped by a trigger (see ROLLBACK above).
-- The ERRCODE is restrict_violation (23001).

CREATE FUNCTION "engine4_audit_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD."user_id" IS NOT NULL
           AND NEW."user_id" IS NULL
           AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'engine4 audit rows are append-only: % of "%" is refused', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "user_trade_preferences_history_append_only"
    BEFORE UPDATE OR DELETE ON "user_trade_preferences_history"
    FOR EACH ROW EXECUTE FUNCTION "engine4_audit_append_only"();

CREATE TRIGGER "user_trade_preferences_history_no_truncate"
    BEFORE TRUNCATE ON "user_trade_preferences_history"
    FOR EACH STATEMENT EXECUTE FUNCTION "engine4_audit_append_only"();

CREATE TRIGGER "trade_consent_records_append_only"
    BEFORE UPDATE OR DELETE ON "trade_consent_records"
    FOR EACH ROW EXECUTE FUNCTION "engine4_audit_append_only"();

CREATE TRIGGER "trade_consent_records_no_truncate"
    BEFORE TRUNCATE ON "trade_consent_records"
    FOR EACH STATEMENT EXECUTE FUNCTION "engine4_audit_append_only"();
