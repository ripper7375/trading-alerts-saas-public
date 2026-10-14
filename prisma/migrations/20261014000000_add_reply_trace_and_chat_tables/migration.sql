-- Stack D reply path tables (build step 7, part 1): request_traces, chat_threads, chat_messages.
-- docs/STACK-D-ARCHITECTURE.md 5.7 (Report 1), 7.4 (the trace), 7.5 (retention and privacy);
-- plan docs/handoffs/2026-10-14-step7-plan.md, decisions D16, D17, D18 and D5.
--
-- ADDITIVE ONLY. Three new tables, their indexes, their foreign keys, CHECK constraints and
-- one trigger function; it touches nothing that exists (the foreign keys only REFERENCE
-- "User") and writes no data. It is safe to apply while the app is running. Nothing writes
-- these tables until the stores (lib/platform/traces/, lib/platform/chat/) are called by a
-- route, and no route exists yet; an unapplied migration is harmless to everything that
-- runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL between
-- "-- CreateTable" and the last "-- AddForeignKey" is
-- `prisma migrate diff --from-schema <prisma/non-market-data/schema.prisma at HEAD> --to-schema prisma/non-market-data/schema.prisma --script`
-- verbatim. Everything after it is hand-written: Prisma cannot express a CHECK or a
-- trigger and its diff does not see them, so they never show up as drift.
--
-- ROLLOUT ORDER. Run `prisma migrate status` first: `migrate deploy` applies EVERY pending
-- migration in history order (20261002000000 to 20261010000000 may still be pending, and
-- none of them is needed by this one; it needs only "User"). To apply this migration alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261014000000_add_reply_trace_and_chat_tables`.
-- Provision ENGINE4_AUDIT_HMAC_KEY (and ENGINE4_AUDIT_HMAC_KEY_VERSION) in Vercel before
-- any route writes a trace: request_traces.user_id_hash uses the same key and the same key
-- versions as the Engine 4 audit tables (decision D5), and the writer refuses to write
-- without a key. The quota ledger of part 6 is a separate migration file.
--
-- ROLLBACK, only while nothing has been written (request_traces holds legal records for 7
-- years and the trigger below does not stop a DROP TABLE, so check the row counts first):
-- DROP TABLE "chat_messages", "chat_threads", "request_traces";
-- DROP FUNCTION "request_traces_guard"();
-- then `prisma migrate resolve --rolled-back 20261014000000_add_reply_trace_and_chat_tables`.
--
-- WHAT DELETING A User DOES (the database does it, no application code):
--   chat_threads    the rows are DELETED (ON DELETE CASCADE), and with them their chat_messages
--                   (ON DELETE CASCADE): a transcript is personal data (12 months, deletable).
--   request_traces  user_id becomes NULL (ON DELETE SET NULL); user_id_hash, key_version and
--                   every other column stay as they were. The trace is the 7-year audit row
--                   (ADR-076); it holds no question text and no user id inside its groups.
-- Deleting ONE thread (the trader's own delete) removes its messages and leaves the traces:
-- request_traces.thread_id has no foreign key on purpose.
--
-- WHAT THE TRIGGER ON request_traces DOES (decision D17: nothing is deleted before it is archived):
--   DELETE    refused unless archived_at IS NOT NULL (a row is archived when it has been
--             written to the write-once archive; no archive exists yet, so nothing can be
--             deleted yet, which is the point).
--   UPDATE    refused unless every column except these is unchanged: user_id (a value to
--             NULL only, which is what ON DELETE SET NULL does, and never back), risk_group,
--             report2_json, report2_sha256, consent_action (Section 6 attaches them after the
--             row exists), archived_at and archive_ref (set once). A row that is archived is
--             frozen: only user_id may still go to NULL.
--   TRUNCATE  refused.
-- A test teardown or a cleanup of a scratch database switches the triggers off
-- (`ALTER TABLE "request_traces" DISABLE TRIGGER USER`, then ENABLE) or drops the database.
-- The ERRCODE is restrict_violation (23001). DROP TABLE is not stopped by a trigger (see
-- ROLLBACK above).

-- CreateTable
CREATE TABLE "request_traces" (
    "request_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_id_hash" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "thread_id" TEXT,
    "tier" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "cycle_slot" INTEGER,
    "data_status" TEXT,
    "model" TEXT,
    "units_charged" INTEGER NOT NULL,
    "regenerations" INTEGER NOT NULL,
    "number_violations" INTEGER NOT NULL,
    "wording_violations" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "total_ms" INTEGER NOT NULL,
    "request_group" JSONB NOT NULL,
    "data_group" JSONB NOT NULL,
    "knowledge_group" JSONB NOT NULL,
    "model_group" JSONB NOT NULL,
    "checks_group" JSONB NOT NULL,
    "risk_group" JSONB,
    "time_group" JSONB NOT NULL,
    "reply_json" TEXT,
    "reply_sha256" TEXT,
    "report2_json" TEXT,
    "report2_sha256" TEXT,
    "consent_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),
    "archive_ref" TEXT,

    CONSTRAINT "request_traces_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_source" TEXT NOT NULL,
    "trader_type" TEXT NOT NULL,
    "last_bias" TEXT,
    "last_cycle_slot" INTEGER,
    "last_preview" TEXT NOT NULL DEFAULT '',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "request_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "intent" TEXT,
    "body_text" TEXT,
    "body_json" JSONB,
    "cycle_slot" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_traces_created_at_idx" ON "request_traces"("created_at");

-- CreateIndex
CREATE INDEX "request_traces_user_id_created_at_idx" ON "request_traces"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "request_traces_user_id_hash_created_at_idx" ON "request_traces"("user_id_hash", "created_at");

-- CreateIndex
CREATE INDEX "request_traces_outcome_created_at_idx" ON "request_traces"("outcome", "created_at");

-- CreateIndex
CREATE INDEX "request_traces_intent_created_at_idx" ON "request_traces"("intent", "created_at");

-- CreateIndex
CREATE INDEX "request_traces_cycle_slot_idx" ON "request_traces"("cycle_slot");

-- CreateIndex
CREATE UNIQUE INDEX "request_traces_user_id_hash_client_request_id_key" ON "request_traces"("user_id_hash", "client_request_id");

-- CreateIndex
CREATE INDEX "chat_threads_user_id_last_message_at_idx" ON "chat_threads"("user_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_expires_at_idx" ON "chat_messages"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_thread_id_seq_key" ON "chat_messages"("thread_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_request_id_role_key" ON "chat_messages"("request_id", "role");

-- AddForeignKey
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules Prisma cannot express. Hand-written; not part of the diff above.
--
-- The enums and bounds are the database's twin of lib/reply/contracts/ (trace-fields.ts,
-- result.ts) and lib/platform/: a row the writer accepts, the database accepts, and the
-- other way round. The writer checks first (and refuses with every problem at once); these
-- constraints are the last line of defence for a row written any other way. The lists are
-- decisions of the architecture: changing one is a new decision and a new migration, never
-- an edit of this file. PostgreSQL reports the FIRST failing CHECK by constraint name
-- (alphabetical), so a test of one constraint must break only that one.

-- ============================================================ request_traces

-- The ids are the shape lib/reply/contracts/fields.ts calls ID (and THREAD_ID of the intake packet).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_ids_are_ids" CHECK (
    "request_id" ~ '^[A-Za-z0-9_-]{1,64}$'
    AND "client_request_id" ~ '^[A-Za-z0-9_-]{1,64}$'
    AND ("thread_id" IS NULL OR "thread_id" ~ '^[A-Za-z0-9_-]{1,64}$')
);

-- The hash is a lowercase hex HMAC-SHA-256 (64 characters) and says which key version made it;
-- an old hash is never recomputed (the Engine 4 rule, decision D12 of step 5).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_user_id_hash_is_hex" CHECK ("user_id_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_key_version_is_positive" CHECK ("key_version" >= 1);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_tier_is_known" CHECK ("tier" IN ('FREE', 'PRO'));

-- 19 locales: a language code and an optional region (en-US, pt-BR, zh-TW).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_locale_is_a_locale" CHECK ("locale" ~ '^[a-z]{2}(-[A-Z]{2})?$');

-- The nine intents a packet can carry (OUT_OF_SCOPE is a refusal, never a packet).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_intent_is_known" CHECK (
    "intent" IN (
        'DIRECTION', 'ENTRY_TIMING', 'EXIT_TARGETS', 'RISK_SIZING', 'EXPLAIN', 'NEWS', 'REPORT_2',
        'INSTANT_M5_INSPECT', 'INSTANT_M15_INSPECT'
    )
);

-- A cycle slot is a multiple of 300 seconds.
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_cycle_slot_is_a_slot" CHECK ("cycle_slot" IS NULL OR ("cycle_slot" > 0 AND "cycle_slot" % 300 = 0));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_data_status_is_known" CHECK ("data_status" IS NULL OR "data_status" IN ('FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED', 'UNKNOWN'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_model_is_a_slug" CHECK ("model" IS NULL OR "model" ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$');

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_units_are_not_negative" CHECK ("units_charged" >= 0);

-- One regeneration, shared by the number check and the wording check (decision D11).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_regenerations_are_zero_or_one" CHECK ("regenerations" BETWEEN 0 AND 1);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_violations_are_not_negative" CHECK ("number_violations" >= 0 AND "wording_violations" >= 0);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_outcome_is_known" CHECK ("outcome" IN ('REPORT1', 'ANSWER', 'FIXED_ANSWER', 'OPEN_TRADE_SETUP', 'REFUSED', 'ERROR'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_total_ms_is_not_negative" CHECK ("total_ms" >= 0);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_groups_are_objects" CHECK (
    jsonb_typeof("request_group") = 'object'
    AND jsonb_typeof("data_group") = 'object'
    AND jsonb_typeof("knowledge_group") = 'object'
    AND jsonb_typeof("model_group") = 'object'
    AND jsonb_typeof("checks_group") = 'object'
    AND ("risk_group" IS NULL OR jsonb_typeof("risk_group") = 'object')
    AND jsonb_typeof("time_group") = 'object'
);

-- A filter column is its group's own value, not a second opinion (the pattern of
-- trade_consent_records): the writer fills both from one object, and the database checks.
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_ids_follow_the_request" CHECK (
    "request_id" IS NOT DISTINCT FROM ("request_group"->>'request_id')
    AND "client_request_id" IS NOT DISTINCT FROM ("request_group"->>'client_request_id')
    AND "thread_id" IS NOT DISTINCT FROM ("request_group"->>'thread_id')
);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_tier_follows_the_request" CHECK ("tier" IS NOT DISTINCT FROM ("request_group"->>'tier'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_locale_follows_the_request" CHECK ("locale" IS NOT DISTINCT FROM ("request_group"->>'reply_locale'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_intent_follows_the_request" CHECK ("intent" IS NOT DISTINCT FROM ("request_group"->>'intent'));

-- The group writes the slot as the envelopes do (2026-09-18T20:55Z), the column as unix seconds.
-- (A CHECK passes when its expression is NULL, so every "follows" rule compares with
-- IS NOT DISTINCT FROM: a key missing from the group is a violation, not a pass.)
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_cycle_slot_follows_the_data" CHECK (
    ("data_group"->>'cycle_slot') IS NOT DISTINCT FROM to_char(to_timestamp("cycle_slot") AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"')
);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_data_status_follows_the_data" CHECK ("data_status" IS NOT DISTINCT FROM ("data_group"->>'data_status'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_model_follows_the_model_group" CHECK ("model" IS NOT DISTINCT FROM ("model_group"->>'model'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_units_follow_the_model_group" CHECK ("units_charged"::text IS NOT DISTINCT FROM ("model_group"->>'units_charged'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_regenerations_follow_the_checks" CHECK ("regenerations"::text IS NOT DISTINCT FROM ("checks_group"->>'regenerations'));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_violations_follow_the_checks" CHECK (
    "number_violations"::text IS NOT DISTINCT FROM ("checks_group"->'numbers'->>'violations')
    AND "wording_violations"::text IS NOT DISTINCT FROM ("checks_group"->'wording'->>'violations')
);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_total_ms_follows_the_time" CHECK ("total_ms"::text IS NOT DISTINCT FROM ("time_group"->>'total_ms'));

-- A report is its own text: the hash is the SHA-256 of the exact canonical JSON stored, which
-- the database re-derives (the pattern of synthesis_readings and trade_consent_records). The
-- cast to jsonb refuses a text that is not JSON.
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_reply_is_its_text_and_hash" CHECK (
    ("reply_json" IS NULL AND "reply_sha256" IS NULL)
    OR (
        "reply_json" IS NOT NULL
        AND "reply_sha256" IS NOT NULL
        AND "reply_json"::jsonb IS NOT NULL
        AND encode(sha256(convert_to("reply_json", 'UTF8')), 'hex') = "reply_sha256"
    )
);

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_report2_is_its_text_and_hash" CHECK (
    ("report2_json" IS NULL AND "report2_sha256" IS NULL)
    OR (
        "report2_json" IS NOT NULL
        AND "report2_sha256" IS NOT NULL
        AND "report2_json"::jsonb IS NOT NULL
        AND encode(sha256(convert_to("report2_json", 'UTF8')), 'hex') = "report2_sha256"
    )
);

-- Every outcome but ERROR has a reply: what the trader was told is the record.
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_reply_follows_the_outcome" CHECK (("outcome" = 'ERROR') = ("reply_json" IS NULL));

ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_consent_action_is_known" CHECK ("consent_action" IS NULL OR "consent_action" IN ('ACCEPT', 'MODIFY', 'DECLINE'));

-- Section 6 attaches Report 2 and the consent action together with the risk group, so there is
-- neither without one: a consent action is the group's own (NULL group, NULL action), and a
-- Report 2 is the one the group names (the rule after this one).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_consent_follows_the_risk_group" CHECK ("consent_action" IS NOT DISTINCT FROM ("risk_group"->>'consent_action'));

-- Report 2 is the setup the risk group is about: the hash the group names is the hash of the
-- text kept (the exact serialization Engine 4 hashes for the consent record).
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_report2_is_the_risk_setup" CHECK ("report2_sha256" IS NULL OR ("risk_group"->>'setup_sha256') IS NOT DISTINCT FROM "report2_sha256");

-- An archive timestamp without a reference to the archived object proves nothing.
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_archive_is_complete" CHECK (
    ("archived_at" IS NULL) = ("archive_ref" IS NULL)
    AND ("archive_ref" IS NULL OR (btrim("archive_ref") <> '' AND char_length("archive_ref") <= 512))
);

-- The user id lives in its own column, which becomes NULL when the account is deleted. A copy
-- of it inside a group or a report would outlive the deletion, so none is allowed while the
-- id is set. (User ids are cuids; a short test id that happens to occur in a report would be
-- refused too, so the spec uses ids of the real length.)
ALTER TABLE "request_traces" ADD CONSTRAINT "request_traces_groups_hold_no_user_id" CHECK (
    "user_id" IS NULL
    OR strpos(
        "request_group"::text || "data_group"::text || "knowledge_group"::text || "model_group"::text
        || "checks_group"::text || coalesce("risk_group"::text, '') || "time_group"::text
        || coalesce("reply_json", '') || coalesce("report2_json", ''),
        "user_id"
    ) = 0
);

-- ============================================================ chat_threads

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_symbol_is_a_symbol" CHECK ("symbol" ~ '^[A-Z0-9._]{1,24}$');

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_title_is_short" CHECK (char_length("title") BETWEEN 1 AND 80 AND btrim("title") <> '');

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_title_source_is_known" CHECK ("title_source" IN ('AUTO', 'USER'));

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_trader_type_is_known" CHECK ("trader_type" IN ('SCALPER', 'DAY_TRADER'));

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_last_bias_is_known" CHECK ("last_bias" IS NULL OR "last_bias" IN ('LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'));

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_last_cycle_slot_is_a_slot" CHECK ("last_cycle_slot" IS NULL OR ("last_cycle_slot" > 0 AND "last_cycle_slot" % 300 = 0));

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_preview_is_short" CHECK (char_length("last_preview") <= 120);

ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_counts_are_consistent" CHECK ("message_count" >= 0 AND "report_count" >= 0 AND "report_count" <= "message_count");

-- ============================================================ chat_messages

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_seq_is_positive" CHECK ("seq" >= 1);

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_request_id_is_an_id" CHECK ("request_id" ~ '^[A-Za-z0-9_-]{1,64}$');

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_role_and_kind_agree" CHECK (
    ("role" = 'USER' AND "kind" IN ('TYPED', 'INSTANT'))
    OR ("role" = 'ASSISTANT' AND "kind" IN ('REPORT1', 'ANSWER', 'FIXED_ANSWER', 'ACTION', 'REFUSAL'))
);

-- A typed question is text; an instant prompt is only its intent; a reply is a JSON object.
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_content_fits_the_kind" CHECK (
    ("kind" = 'TYPED' AND "body_text" IS NOT NULL AND "body_json" IS NULL)
    OR ("kind" = 'INSTANT' AND "body_text" IS NULL AND "body_json" IS NULL AND "intent" IS NOT NULL AND "intent" IN ('INSTANT_M5_INSPECT', 'INSTANT_M15_INSPECT'))
    OR ("role" = 'ASSISTANT' AND "body_text" IS NULL AND "body_json" IS NOT NULL)
);

-- The door limits a typed question to 500 characters (1,000 once normalised); 2,000 is the ceiling.
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_text_is_bounded" CHECK ("body_text" IS NULL OR (char_length("body_text") BETWEEN 1 AND 2000 AND btrim("body_text") <> ''));

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_json_is_an_object" CHECK ("body_json" IS NULL OR jsonb_typeof("body_json") = 'object');

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_intent_is_known" CHECK (
    "intent" IS NULL OR "intent" IN (
        'DIRECTION', 'ENTRY_TIMING', 'EXIT_TARGETS', 'RISK_SIZING', 'EXPLAIN', 'NEWS', 'REPORT_2',
        'INSTANT_M5_INSPECT', 'INSTANT_M15_INSPECT'
    )
);

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_cycle_slot_is_a_slot" CHECK ("cycle_slot" IS NULL OR ("cycle_slot" > 0 AND "cycle_slot" % 300 = 0));

-- 12 months from the message's own time (decision D18).
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_expires_after_it_began" CHECK ("expires_at" > "created_at");

-- The guard on request_traces (decision D17). See "WHAT THE TRIGGER ON request_traces DOES" above.
-- The mutable columns are the ones Section 6 and the archive job write AFTER the row exists;
-- every other column is sealed when the row is inserted. A row that is archived is frozen.
CREATE FUNCTION "request_traces_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    allowed text[];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."archived_at" IS NOT NULL THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'request_traces: DELETE of a row that is not archived is refused (request_id %)', OLD."request_id"
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF OLD."archived_at" IS NULL THEN
            allowed := ARRAY['user_id', 'risk_group', 'report2_json', 'report2_sha256', 'consent_action', 'archived_at', 'archive_ref'];
        ELSE
            allowed := ARRAY['user_id'];
        END IF;
        IF (to_jsonb(NEW) - allowed) = (to_jsonb(OLD) - allowed)
           AND (NEW."user_id" IS NOT DISTINCT FROM OLD."user_id"
                OR (OLD."user_id" IS NOT NULL AND NEW."user_id" IS NULL)) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'request_traces: UPDATE of a sealed column is refused (request_id %)', OLD."request_id"
            USING ERRCODE = 'restrict_violation';
    END IF;
    RAISE EXCEPTION 'request_traces: % is refused', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "request_traces_guard_rows"
    BEFORE UPDATE OR DELETE ON "request_traces"
    FOR EACH ROW EXECUTE FUNCTION "request_traces_guard"();

CREATE TRIGGER "request_traces_guard_truncate"
    BEFORE TRUNCATE ON "request_traces"
    FOR EACH STATEMENT EXECUTE FUNCTION "request_traces_guard"();
