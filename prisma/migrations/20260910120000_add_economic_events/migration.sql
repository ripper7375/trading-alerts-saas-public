-- Economic events: append-only capture of MT5's built-in Economic Calendar.
--
-- SAFETY: purely additive. One CREATE TABLE plus its indexes, touching no
-- existing table, column or constraint. Unlike the 2026-09-03 best_fit rename
-- there is nothing to preserve and no pre-flight count to take; unlike
-- 20260909000000_market_data_v6_provenance_not_null there is no existing data
-- that could violate a new constraint. Safe to apply at any time.
--
-- APPEND-ONLY is enforced by the unique key, not by a trigger. A revised
-- forecast or a published actual arrives as a NEW row with a later
-- captured_at. Narrowing this key to value_id alone would make each release
-- overwrite itself and erase what the market knew before the event —
-- irrecoverably, and with no error to notice it by.
--
-- Ids are TEXT: upstream they are MQL5 `ulong` (64-bit) and JSON has no 64-bit
-- integer, so a large id would lose precision crossing the gateway. They are
-- opaque; ordering is always by captured_at / event_time.
--
-- Value columns are nullable because NULL means NOT PUBLISHED, never zero. A
-- genuine 0.0 reading is real data, and for forecast_value NULL is the common
-- case — rate decisions, votes and speeches carry no numeric forecast at all.

CREATE TABLE "economic_events" (
    "id"                 TEXT    NOT NULL,
    "terminal_id"        TEXT    NOT NULL,

    "value_id"           TEXT    NOT NULL,
    "captured_at"        INTEGER NOT NULL,
    "event_id"           TEXT    NOT NULL,

    "event_time"         INTEGER NOT NULL,
    "event_period"       INTEGER,
    "revision"           INTEGER,

    "country_code"       TEXT    NOT NULL,
    "currency"           TEXT    NOT NULL,

    "event_name"         TEXT    NOT NULL,
    "importance"         TEXT    NOT NULL,

    "event_type"         INTEGER,
    "sector"             INTEGER,
    "frequency"          INTEGER,
    "time_mode"          INTEGER,
    "unit"               INTEGER,
    "multiplier"         INTEGER,
    "digits"             INTEGER,
    "event_code"         TEXT,
    "source_url"         TEXT,

    "actual_value"       DOUBLE PRECISION,
    "forecast_value"     DOUBLE PRECISION,
    "prev_value"         DOUBLE PRECISION,
    "revised_prev_value" DOUBLE PRECISION,
    "impact_type"        INTEGER,

    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_events_pkey" PRIMARY KEY ("id")
);

-- The append-only key. Postgres backs this with a btree index on exactly these
-- columns, so no separate index repeats the same list.
CREATE UNIQUE INDEX "economic_events_value_id_captured_at_key"
    ON "economic_events" ("value_id", "captured_at");

-- "What is the next HIGH-impact event?" — the countdown's only query.
CREATE INDEX "economic_events_event_time_importance_idx"
    ON "economic_events" ("event_time", "importance");

-- "What is coming for USD?" — the Stack D news pillar's filter.
CREATE INDEX "economic_events_currency_event_time_idx"
    ON "economic_events" ("currency", "event_time");
