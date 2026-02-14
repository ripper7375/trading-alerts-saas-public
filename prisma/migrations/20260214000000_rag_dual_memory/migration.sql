-- ============================================================
-- RAG Dual-Memory Architecture: PostgreSQL Schema Extensions
-- Migration: 20260214000000_rag_dual_memory
--
-- Implements the 7 tables defined in:
--   RAG_SYSTEM_MODIFICATION_ARCHITECTURE_markdown-memory-and-jsonl-transcript_V2
--
-- Tables:
--   1. mt5_accounts          — MT5 account registry with JSONL session linking
--   2. upload_history        — File upload tracking with SHA-256 dedup
--   3. jsonl_sessions        — Session registry linking chat to JSONL files
--   4. behavioral_drift      — Detected behavioral patterns + JSONL evidence
--   5. advice_outcomes       — AI advice attribution to trade results
--   6. compliance_audit      — 7-year regulatory audit trail
-- (trades table already exists — enhanced with behavioral columns below)
-- ============================================================

-- ----------------------------------------------------------
-- 1. MT5 Accounts Registry
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "mt5_accounts" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             TEXT NOT NULL,
    "account_number"      TEXT NOT NULL,
    "broker_name"         TEXT,
    "account_type"        TEXT DEFAULT 'standard',  -- standard | ecn | demo
    "server"              TEXT,
    "currency"            TEXT DEFAULT 'USD',
    "balance"             DECIMAL(15, 2),
    "equity"              DECIMAL(15, 2),
    "is_active"           BOOLEAN DEFAULT TRUE,
    "last_upload_at"      TIMESTAMP WITH TIME ZONE,
    "last_jsonl_session"  TEXT,                     -- latest JSONL session_id from upload
    "jsonl_retention_days" INTEGER DEFAULT 2555,    -- 7 years = 2555 days
    "created_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE ("account_number", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_mt5_accounts_user_id"
    ON "mt5_accounts" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_mt5_accounts_account_number"
    ON "mt5_accounts" ("account_number");

-- ----------------------------------------------------------
-- 2. Upload History & Validation
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "upload_history" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             TEXT NOT NULL,
    "mt5_account_id"      UUID REFERENCES "mt5_accounts" ("id") ON DELETE SET NULL,
    "filename"            TEXT NOT NULL,
    "file_size_bytes"     BIGINT,
    "file_sha256"         TEXT UNIQUE,              -- deduplication
    "status"              TEXT DEFAULT 'pending',   -- pending | processing | success | failed
    "error_message"       TEXT,
    "trade_count"         INTEGER DEFAULT 0,
    "date_range_start"    DATE,
    "date_range_end"      DATE,
    "data_quality_score"  DECIMAL(5, 2),            -- 0–100
    "jsonl_session_id"    TEXT,                     -- links to jsonl_sessions
    "processed_at"        TIMESTAMP WITH TIME ZONE,
    "created_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_upload_history_user_id"
    ON "upload_history" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_upload_history_sha256"
    ON "upload_history" ("file_sha256");

CREATE INDEX IF NOT EXISTS "idx_upload_history_status"
    ON "upload_history" ("status");

-- ----------------------------------------------------------
-- 3. JSONL Sessions Registry
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "jsonl_sessions" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id"          TEXT NOT NULL UNIQUE,
    "user_id"             TEXT NOT NULL,
    "mt5_account_id"      UUID REFERENCES "mt5_accounts" ("id") ON DELETE SET NULL,
    "session_type"        TEXT DEFAULT 'chat_query',  -- chat_query | upload_processing | background_analytics
    "jsonl_file_path"     TEXT NOT NULL,              -- absolute path on disk
    "query_count"         INTEGER DEFAULT 0,
    "tool_call_count"     INTEGER DEFAULT 0,
    "warning_count"       INTEGER DEFAULT 0,
    "advice_given"        BOOLEAN DEFAULT FALSE,
    "advice_risk_level"   TEXT,                       -- low | medium | high | critical
    "subsequent_trade_id" UUID,                       -- FK added below after trades check
    "started_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "ended_at"            TIMESTAMP WITH TIME ZONE,
    "created_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_jsonl_sessions_session_id"
    ON "jsonl_sessions" ("session_id");

CREATE INDEX IF NOT EXISTS "idx_jsonl_sessions_user_id"
    ON "jsonl_sessions" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_jsonl_sessions_started_at"
    ON "jsonl_sessions" ("started_at");

-- ----------------------------------------------------------
-- 4. Behavioral Drift Detection
-- (Enhanced version — stores JSONL proof arrays)
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "behavioral_drift" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             TEXT NOT NULL,
    "detection_type"      TEXT NOT NULL,  -- position_sizing | risk_taking | late_night_trading |
                                          -- revenge_trading | ignore_warnings | analysis_paralysis
    "severity"            TEXT NOT NULL,  -- medium | high | critical
    "summary"             TEXT NOT NULL,
    "status"              TEXT DEFAULT 'active',  -- active | acknowledged | resolved

    -- JSONL evidence linking
    "jsonl_session_ids"   TEXT[] DEFAULT ARRAY[]::TEXT[],   -- sessions proving the pattern
    "jsonl_evidence"      JSONB,                            -- extracted entry sequences

    -- Resolution tracking
    "warning_issued_at"   TIMESTAMP WITH TIME ZONE,
    "acknowledged_at"     TIMESTAMP WITH TIME ZONE,
    "resolved_at"         TIMESTAMP WITH TIME ZONE,
    "resolution_notes"    TEXT,

    "detected_at"         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_behavioral_drift_user_id"
    ON "behavioral_drift" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_behavioral_drift_type"
    ON "behavioral_drift" ("detection_type");

CREATE INDEX IF NOT EXISTS "idx_behavioral_drift_severity"
    ON "behavioral_drift" ("severity");

CREATE INDEX IF NOT EXISTS "idx_behavioral_drift_status"
    ON "behavioral_drift" ("status");

-- ----------------------------------------------------------
-- 5. Advice Outcomes
-- (Links advice sessions to actual trade results)
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "advice_outcomes" (
    "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"                  TEXT NOT NULL,
    "session_id"               TEXT NOT NULL,
    "jsonl_session_id"         UUID REFERENCES "jsonl_sessions" ("id") ON DELETE SET NULL,
    "advice_entry_id"          TEXT,                -- JSONL entry_id of the advice

    -- Advice context
    "advice_risk_level"        TEXT NOT NULL,       -- low | medium | high | critical
    "advice_summary"           TEXT,

    -- Trader response
    "trader_response"          TEXT,                -- followed | ignored | partially_followed | unclear
    "response_delay_seconds"   INTEGER,

    -- Trade outcome
    "subsequent_trade_id"      UUID,
    "trade_pnl"                DECIMAL(15, 2),      -- actual P&L if trade occurred

    -- Effectiveness
    "effectiveness_score"      INTEGER,             -- 0–100

    -- Psychological state at time of advice
    "late_night"               BOOLEAN DEFAULT FALSE,
    "emotional_language"       BOOLEAN DEFAULT FALSE,
    "analysis_paralysis"       BOOLEAN DEFAULT FALSE,

    "attributed_at"            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_at"               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_advice_outcomes_user_id"
    ON "advice_outcomes" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_advice_outcomes_session_id"
    ON "advice_outcomes" ("session_id");

CREATE INDEX IF NOT EXISTS "idx_advice_outcomes_effectiveness"
    ON "advice_outcomes" ("effectiveness_score");

-- ----------------------------------------------------------
-- 6. Compliance Audit Log
-- (7-year retention for financial services regulation)
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS "compliance_audit" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"             TEXT NOT NULL,
    "event_type"          TEXT NOT NULL,  -- warning_issued | advice_given | risk_assessment |
                                          -- upload_processed | behavioral_drift_detected
    "risk_level"          TEXT,
    "summary"             TEXT NOT NULL,

    -- JSONL proof linking
    "jsonl_session_id"    TEXT,
    "jsonl_file_path"     TEXT,
    "jsonl_entry_index"   INTEGER,
    "jsonl_entry_id"      TEXT,

    -- Regulatory metadata
    "compliance_category" TEXT,  -- warning | advice | disclosure | assessment
    "requires_disclosure" BOOLEAN DEFAULT FALSE,
    "disclosed_at"        TIMESTAMP WITH TIME ZONE,

    -- 7-year retention enforcement (populated by application on insert)
    "retain_until"        DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 years'),

    "occurred_at"         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "created_at"          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_compliance_audit_user_id"
    ON "compliance_audit" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_compliance_audit_event_type"
    ON "compliance_audit" ("event_type");

CREATE INDEX IF NOT EXISTS "idx_compliance_audit_occurred_at"
    ON "compliance_audit" ("occurred_at");

CREATE INDEX IF NOT EXISTS "idx_compliance_audit_risk_level"
    ON "compliance_audit" ("risk_level");

-- ----------------------------------------------------------
-- Enhance existing trades table with behavioral columns
-- Only runs if the "trades" table already exists (created by a prior migration).
-- When trades is absent the block is skipped entirely — no error.
-- ----------------------------------------------------------

DO $$
BEGIN
    -- Guard: skip the whole block if trades table does not exist yet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'trades'
    ) THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'trades'
          AND column_name  = 'advice_session_id'
    ) THEN
        ALTER TABLE "trades"
            ADD COLUMN "advice_session_id"    TEXT,
            ADD COLUMN "is_revenge_trade"     BOOLEAN DEFAULT FALSE,
            ADD COLUMN "is_late_night_trade"  BOOLEAN DEFAULT FALSE,
            ADD COLUMN "is_oversize_trade"    BOOLEAN DEFAULT FALSE,
            ADD COLUMN "advice_followed"      BOOLEAN;
    END IF;
END $$;

-- Indexes on new trades columns — also guarded by table existence
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'trades'
    ) THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'trades' AND indexname = 'idx_trades_advice_session_id'
    ) THEN
        CREATE INDEX "idx_trades_advice_session_id"
            ON "trades" ("advice_session_id");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'trades' AND indexname = 'idx_trades_behavioral_flags'
    ) THEN
        CREATE INDEX "idx_trades_behavioral_flags"
            ON "trades" ("is_revenge_trade", "is_late_night_trade", "is_oversize_trade");
    END IF;
END $$;
