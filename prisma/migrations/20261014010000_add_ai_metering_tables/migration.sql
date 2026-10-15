-- Stack D quota ledger (build step 7, part 6): ai_quota_periods and ai_usage_reservations.
-- docs/STACK-D-ARCHITECTURE.md 5.6 (metering) and 7.3 (the quota method), ADR-050, ADR-072,
-- ADR-073; plan docs/handoffs/2026-10-14-step7-plan.md, decisions D2, D3, D4 and D5.
--
-- ADDITIVE ONLY. Two new tables, their indexes, their foreign keys, CHECK constraints and one
-- trigger function; it touches nothing that exists (the foreign keys only REFERENCE "User") and
-- writes no data. It is safe to apply while the app is running. Nothing writes these tables
-- until the ledger store (lib/platform/metering/ledger-store.ts) is called by a route, and no
-- route calls it yet; an unapplied migration is harmless to everything that runs today.
--
-- NOT APPLIED. Authored and checked by the Executor, applied by Davin. The DDL between
-- "-- CreateTable" and the last "-- AddForeignKey" is
-- `prisma migrate diff --from-schema <prisma/non-market-data/schema.prisma at HEAD> --to-schema prisma/non-market-data/schema.prisma --script`
-- verbatim. Everything after it is hand-written: Prisma cannot express a CHECK or a trigger and
-- its diff does not see them, so they never show up as drift.
--
-- ROLLOUT ORDER. Run `prisma migrate status` first: `migrate deploy` applies EVERY pending
-- migration in history order (20261002000000 to 20261014000000 may still be pending, and none of
-- them is needed by this one; it needs only "User"). To apply this migration alone:
-- `prisma db execute --file <this file>` and then
-- `prisma migrate resolve --applied 20261014010000_add_ai_metering_tables`.
-- Setting PRO_MONTHLY_UNITS is a separate step (runbook S4, decision D4): until it is set the
-- quota port refuses every request, so applying this file turns nothing on by itself.
--
-- ROLLBACK, only while nothing has been written (the ledger is the record of what a trader was
-- charged, so check the row counts first): DROP TABLE "ai_usage_reservations", "ai_quota_periods";
-- DROP FUNCTION "ai_usage_reservations_guard"(); then
-- `prisma migrate resolve --rolled-back 20261014010000_add_ai_metering_tables`.
--
-- WHAT A UNIT IS (decision D2). One unit is one micro-dollar of gateway cost, always a whole
-- number: $1.00 is 1,000,000 units. A period is one UTC calendar month ("2026-10"). The columns
-- are INTEGER (32 bits, at most 2,147,483,647 units, about $2,147): every bound below is
-- 2,000,000,000, and the sums are made in 64 bits so a sum can never overflow into a wrong answer.
--
-- THE LEDGER IS TWO TABLES AND ONE INVARIANT.
--   ai_quota_periods      one row per trader per month: the allowance (limit), the units charged by
--                         settled requests (used) and the units held by requests in flight
--                         (reserved). used + reserved <= limit always, in every committed state.
--   ai_usage_reservations one row per request, keyed by the request id: RESERVED holds units;
--                         SETTLED charged `actual_units`; RELEASED held units and gave them back
--                         without a model call; EXPIRED is a RESERVED row the reaper gave back
--                         after its deadline (a late settlement may still charge it).
--   Invariant, which no CHECK can see because it spans two tables and which the store's
--   `auditPeriod` and the gated spec check after every scenario:
--     reserved = the sum of reserved_units of the RESERVED reservations of the period
--     used     = the sum of actual_units of the SETTLED reservations of the period
-- The reservation is ONE atomic statement in the store (the allowance is checked and the units are
-- held in the same UPDATE ... WHERE used + reserved + n <= limit), so two requests racing for the
-- last units cannot both succeed: PostgreSQL makes the second wait for the first row lock, re-reads
-- the row and finds it full.
--
-- WHAT DELETING A User DOES (the database does it, no application code):
--   ai_quota_periods       the rows are DELETED (ON DELETE CASCADE): a balance is the trader's own.
--   ai_usage_reservations  the rows are DELETED (ON DELETE CASCADE), with the period. What a request
--                          cost stays in request_traces (units_charged and the model group's cost,
--                          user_id NULL and the keyed hash kept, 7 years), which is the audit row;
--                          the ledger is the balance, not the audit. So this part uses no hash key.
--
-- WHAT THE TRIGGER ON ai_usage_reservations DOES (UPDATE only; a DELETE is the cascade above):
--   a sealed column (request_id, period_id, reserved_units, created_at, expires_at) never changes;
--   a row that keeps its state keeps its figures (only updated_at may move);
--   the only changes of state are RESERVED -> SETTLED | RELEASED | EXPIRED and EXPIRED -> SETTLED.
--   SETTLED and RELEASED are final. The ERRCODE is restrict_violation (23001). This is a hardening
--   beyond the CHECKs (which describe each state but cannot see the one before it): the store's
--   statements never ask for anything it refuses.
-- A test teardown or a cleanup of a scratch database switches the trigger off
-- (`ALTER TABLE "ai_usage_reservations" DISABLE TRIGGER USER`, then ENABLE) or drops the database.

-- CreateTable
CREATE TABLE "ai_quota_periods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_quota_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_reservations" (
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "reserved_units" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "actual_units" INTEGER,
    "cost_micro_usd" INTEGER,
    "model" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_reservations_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_quota_periods_user_id_month_key" ON "ai_quota_periods"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quota_periods_id_user_id_key" ON "ai_quota_periods"("id", "user_id");

-- CreateIndex
CREATE INDEX "ai_usage_reservations_period_id_idx" ON "ai_usage_reservations"("period_id");

-- CreateIndex
CREATE INDEX "ai_usage_reservations_status_expires_at_idx" ON "ai_usage_reservations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "ai_usage_reservations_user_id_created_at_idx" ON "ai_usage_reservations"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_period_id_user_id_fkey" FOREIGN KEY ("period_id", "user_id") REFERENCES "ai_quota_periods"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules Prisma cannot express. Hand-written; not part of the diff above.
--
-- The bounds and the lists are the database's twin of lib/platform/metering/ledger-store.ts and
-- lib/reply/contracts/ (fields.ts): a row the store writes, the database accepts, and the other way
-- round. The lists are decisions of the architecture: changing one is a new decision and a new
-- migration, never an edit of this file. PostgreSQL reports the FIRST failing CHECK by constraint
-- name (alphabetical), so a test of one constraint must break only that one.

-- ============================================================ ai_quota_periods

ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_month_is_a_month" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- 2,000,000,000 units is $2,000 a month: far above any plan, and below the 32-bit limit.
ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_limit_is_bounded" CHECK ("limit" BETWEEN 0 AND 2000000000);

ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_used_is_not_negative" CHECK ("used" >= 0);

ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_reserved_is_not_negative" CHECK ("reserved" >= 0);

-- The arithmetic of a period: what was charged and what is held never exceed the allowance. The
-- sum is made in 64 bits so it cannot overflow.
ALTER TABLE "ai_quota_periods" ADD CONSTRAINT "ai_quota_periods_balance_fits_the_limit" CHECK ("used"::bigint + "reserved"::bigint <= "limit"::bigint);

-- ============================================================ ai_usage_reservations

-- The id is the shape lib/reply/contracts/fields.ts calls ID.
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_request_id_is_an_id" CHECK ("request_id" ~ '^[A-Za-z0-9_-]{1,64}$');

-- A reservation holds at least one unit; a request that needs none holds nothing.
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_reserved_is_positive" CHECK ("reserved_units" BETWEEN 1 AND 2000000000);

ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_status_is_known" CHECK ("status" IN ('RESERVED', 'SETTLED', 'RELEASED', 'EXPIRED'));

-- Every figure that is set is a whole number of at least zero and within the 32-bit bound.
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_figures_are_in_range" CHECK (
    ("actual_units" IS NULL OR "actual_units" BETWEEN 0 AND 2000000000)
    AND ("cost_micro_usd" IS NULL OR "cost_micro_usd" BETWEEN 0 AND 2000000000)
    AND ("prompt_tokens" IS NULL OR "prompt_tokens" BETWEEN 0 AND 2000000000)
    AND ("completion_tokens" IS NULL OR "completion_tokens" BETWEEN 0 AND 2000000000)
);

-- The state machine, as the shape of each state. A SETTLED row says what it charged; a row that
-- has not been settled (RESERVED, RELEASED, EXPIRED) says nothing about a charge, a cost, a model
-- or tokens, because nothing was charged. (A cost of NULL on a SETTLED row means the gateway
-- could not say: the request is then charged its whole reservation, never nothing.)
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_state_fits_the_fields" CHECK (
    ("status" = 'SETTLED' AND "actual_units" IS NOT NULL)
    OR (
        "status" IN ('RESERVED', 'RELEASED', 'EXPIRED')
        AND "actual_units" IS NULL
        AND "cost_micro_usd" IS NULL
        AND "model" IS NULL
        AND "prompt_tokens" IS NULL
        AND "completion_tokens" IS NULL
    )
);

-- The shape of a model slug in the registry (lib/reply/contracts/fields.ts MODEL_SLUG).
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_model_is_a_slug" CHECK ("model" IS NULL OR "model" ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$');

-- A reservation has a deadline after the time it was made.
ALTER TABLE "ai_usage_reservations" ADD CONSTRAINT "ai_usage_reservations_expires_after_it_began" CHECK ("expires_at" > "created_at");

-- The guard on ai_usage_reservations. See "WHAT THE TRIGGER ON ai_usage_reservations DOES" above.
CREATE FUNCTION "ai_usage_reservations_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."request_id" IS DISTINCT FROM OLD."request_id"
       OR NEW."period_id" IS DISTINCT FROM OLD."period_id"
       OR NEW."reserved_units" IS DISTINCT FROM OLD."reserved_units"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
       OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at" THEN
        RAISE EXCEPTION 'ai_usage_reservations: UPDATE of a sealed column is refused (request_id %)', OLD."request_id"
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF OLD."status" = NEW."status" THEN
        IF NEW."actual_units" IS DISTINCT FROM OLD."actual_units"
           OR NEW."cost_micro_usd" IS DISTINCT FROM OLD."cost_micro_usd"
           OR NEW."model" IS DISTINCT FROM OLD."model"
           OR NEW."prompt_tokens" IS DISTINCT FROM OLD."prompt_tokens"
           OR NEW."completion_tokens" IS DISTINCT FROM OLD."completion_tokens" THEN
            RAISE EXCEPTION 'ai_usage_reservations: a row that keeps its state keeps its figures (request_id %)', OLD."request_id"
                USING ERRCODE = 'restrict_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF (OLD."status" = 'RESERVED' AND NEW."status" IN ('SETTLED', 'RELEASED', 'EXPIRED'))
       OR (OLD."status" = 'EXPIRED' AND NEW."status" = 'SETTLED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'ai_usage_reservations: % -> % is not a transition of a reservation (request_id %)', OLD."status", NEW."status", OLD."request_id"
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "ai_usage_reservations_guard_rows"
    BEFORE UPDATE ON "ai_usage_reservations"
    FOR EACH ROW EXECUTE FUNCTION "ai_usage_reservations_guard"();
