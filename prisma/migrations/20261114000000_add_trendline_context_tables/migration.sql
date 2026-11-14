-- Trendline context: hand-drawn, labelled trendlines (analyst policy +
-- system-computed context). Full design: TRENDLINE-CONTEXT-BLUEPRINT.md and
-- DATA-PIPELINE-ARCHITECTURE.md, in backend-stack-c/1_EA-and-backfill-worker-
-- on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-
-- synthesis-and-analysis-architecture/.
--
-- THIS FILE IS NOT APPLIED. Per this project's non-negotiables the Executor
-- never applies a production migration; this is a file for Davin to review
-- and run (or not) at his own discretion, the same as every other migration
-- in this folder that says "NOT applied" in current-state.md.
--
-- Three tables:
--   trendline_policy_sessions / trendline_policy_lines  -- Layer 1 (policy):
--     written by the gateway's TrendlineContextModule when it is enabled
--     (TRENDLINE_CONTEXT_ENABLED=true). Append-only.
--   trendline_context_readings                          -- Layer 2 (context):
--     the TABLE is created here so the schema is complete, but nothing
--     writes to it yet -- the sensor-worker code that would compute it
--     every 5-minute cycle is explicitly out of scope of this change
--     (Blueprint §9). Safe to create now: an empty, unwritten table costs
--     nothing and blocks nothing.

-- CreateTable
CREATE TABLE "trendline_policy_sessions" (
    "id"             TEXT        NOT NULL,
    "symbol"         TEXT        NOT NULL,
    "published_at"   INTEGER     NOT NULL,
    "overview_note"  TEXT,
    "regime_hint"    TEXT,
    "source_charts"  TEXT[]      DEFAULT ARRAY[]::TEXT[],
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trendline_policy_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trendline_policy_sessions_regime_hint_check"
        CHECK ("regime_hint" IS NULL OR "regime_hint" IN
            ('TREND_UP', 'TREND_DOWN', 'RANGE_BOUND', 'TRANSITIONING', 'UNCLEAR'))
);

-- CreateIndex
CREATE UNIQUE INDEX "trendline_policy_sessions_symbol_published_at_key"
    ON "trendline_policy_sessions"("symbol", "published_at");

-- CreateIndex
CREATE INDEX "trendline_policy_sessions_symbol_published_at_idx"
    ON "trendline_policy_sessions"("symbol", "published_at");

-- CreateTable
CREATE TABLE "trendline_policy_lines" (
    "id"               TEXT          NOT NULL,
    "session_id"       TEXT          NOT NULL,
    "slot_key"         TEXT          NOT NULL,
    "slot"             INTEGER       NOT NULL,
    "source_timeframe" TEXT          NOT NULL,
    "anchor1_time"     INTEGER       NOT NULL,
    "anchor1_price"    DOUBLE PRECISION NOT NULL,
    "anchor2_time"     INTEGER       NOT NULL,
    "anchor2_price"    DOUBLE PRECISION NOT NULL,
    "ray_extends"      BOOLEAN       NOT NULL DEFAULT true,
    "label_raw"        TEXT          NOT NULL,
    "role"             TEXT          NOT NULL,
    "bias_hint"        TEXT,
    "note"             TEXT,
    "parse_method"     TEXT          NOT NULL,
    "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trendline_policy_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trendline_policy_lines_slot_check"
        CHECK ("slot" >= 1 AND "slot" <= 99),
    CONSTRAINT "trendline_policy_lines_role_check"
        CHECK ("role" IN
            ('SUPPORT', 'RESISTANCE', 'TREND_UP', 'TREND_DOWN',
             'CHANNEL_UPPER', 'CHANNEL_LOWER', 'PIVOT', 'OTHER')),
    CONSTRAINT "trendline_policy_lines_bias_hint_check"
        CHECK ("bias_hint" IS NULL OR "bias_hint" IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    CONSTRAINT "trendline_policy_lines_parse_method_check"
        CHECK ("parse_method" IN ('rule', 'model', 'manual')),
    CONSTRAINT "trendline_policy_lines_anchors_check"
        CHECK ("anchor1_time" <> "anchor2_time")
);

-- CreateIndex
CREATE INDEX "trendline_policy_lines_session_id_slot_key_idx"
    ON "trendline_policy_lines"("session_id", "slot_key");

-- AddForeignKey
ALTER TABLE "trendline_policy_lines"
    ADD CONSTRAINT "trendline_policy_lines_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "trendline_policy_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (Layer 2 -- schema only; not written by anything yet, see header)
CREATE TABLE "trendline_context_readings" (
    "id"                         TEXT    NOT NULL,
    "cycle_slot"                 INTEGER NOT NULL,
    "policy_line_id"             TEXT    NOT NULL,
    "policy_session_id"          TEXT    NOT NULL,
    "policy_published_at"        INTEGER NOT NULL,
    "value_now"                  DOUBLE PRECISION,
    "side"                       TEXT    NOT NULL,
    "crossed_since_published"    BOOLEAN NOT NULL,
    "touch_count_since_publish"  INTEGER NOT NULL,
    "hours_since_published"      DOUBLE PRECISION NOT NULL,
    "status"                     TEXT    NOT NULL,

    CONSTRAINT "trendline_context_readings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "trendline_context_readings_side_check"
        CHECK ("side" IN ('ABOVE', 'BELOW', 'AT')),
    CONSTRAINT "trendline_context_readings_status_check"
        CHECK ("status" IN ('VALID', 'CAUTIONARY', 'INVALID', 'STALE')),
    CONSTRAINT "trendline_context_readings_touch_count_check"
        CHECK ("touch_count_since_publish" >= 0),
    CONSTRAINT "trendline_context_readings_hours_check"
        CHECK ("hours_since_published" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "trendline_context_readings_cycle_slot_policy_line_id_key"
    ON "trendline_context_readings"("cycle_slot", "policy_line_id");

-- CreateIndex
CREATE INDEX "trendline_context_readings_cycle_slot_idx"
    ON "trendline_context_readings"("cycle_slot");

-- AddForeignKey
ALTER TABLE "trendline_context_readings"
    ADD CONSTRAINT "trendline_context_readings_policy_line_id_fkey"
    FOREIGN KEY ("policy_line_id") REFERENCES "trendline_policy_lines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
