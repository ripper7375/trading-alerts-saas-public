-- ============================================================================
-- SQLite schema v5 — XAUUSD indicator-export collection pipeline
-- Database file: xauusd.db  (one DB per symbol; XAUUSD is the only symbol)
--
-- Pipeline:
--   1. COLLECT  — every 5 minutes the 12 indicator export files are ingested
--                 into the 12 raw_* staging tables under one collection cycle.
--   2. VALIDATE — the first 4 columns of every export (timestamp, symbol,
--                 timeframe, close) are compared across all 12 sources for
--                 the cycle. Any mismatch ⇒ the WHOLE cycle is rejected and
--                 a new collection request is made (attempt + 1).
--   3. PROMOTE  — only fully validated cycles are merged into market_data,
--                 the single wide table consumed downstream.
--
-- Notes:
--   * Timeframes restricted to M5 and M15 (CHECK constraints).
--   * Symbol restricted to XAUUSD (CHECK constraints).
--   * timestamp_raw  = exported unix timestamp (sources differ by seconds).
--     timestamp_adj  = filled later by the Python rounding stack
--                      (nearest 5-min / 15-min close). NULL until then.
--   * Empty export fields (e.g. blank Base_FL) are stored as NULL, not 0.
--   * Each of the 6 centroid-regression variants keeps its own ssa /
--     ema_ssa / crossing columns: the mock exports show the values differ
--     slightly between variants, so they cannot be deduplicated.
--   * Run with:  PRAGMA foreign_keys = ON;  (required for cascades)
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. COLLECTION CYCLE TRACKING
-- ============================================================================
-- One row per (5-minute collection slot, timeframe, attempt).
-- A rejected cycle keeps its row (audit trail) but its raw rows are
-- cascade-deleted; the re-request inserts a new cycle with attempt + 1.

CREATE TABLE IF NOT EXISTS collection_cycles (
    cycle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_time      INTEGER NOT NULL,                 -- scheduled 5-min boundary (unix, UTC)
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    attempt         INTEGER NOT NULL DEFAULT 1,       -- re-request counter
    status          TEXT    NOT NULL DEFAULT 'collecting'
                    CHECK (status IN ('collecting', 'validating', 'validated', 'rejected')),
    sources_received INTEGER NOT NULL DEFAULT 0,      -- 0..12 export files ingested
    rejected_reason TEXT,                             -- set when status = 'rejected'
    created_at      INTEGER NOT NULL,                 -- unix
    validated_at    INTEGER,                          -- unix, set on promote
    UNIQUE (cycle_time, timeframe, attempt)
);

CREATE INDEX IF NOT EXISTS idx_cycles_status ON collection_cycles (status, timeframe);

-- Mismatch forensics: one row per failed cross-source comparison.
CREATE TABLE IF NOT EXISTS validation_failures (
    failure_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id     INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    field        TEXT    NOT NULL CHECK (field IN ('timestamp', 'symbol', 'timeframe', 'close')),
    detail       TEXT    NOT NULL,                    -- JSON: { source: value, ... } per mismatching source
    created_at   INTEGER NOT NULL
);

-- ============================================================================
-- 2. RAW STAGING TABLES (one per export file, columns mirror the file)
-- ============================================================================
-- Common leading columns in every raw table:
--   cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close
-- These are the validation keys ("first 4 columns" + adjusted timestamp).

-- ---- 2.1 Centroid-regression variants (identical 12-column export layout) --
-- Files: Centriod_Best_Fit / Cherry-Pick-A / Cherry-Pick-B / Most-Recent /
--        Non-Recent-A / Non-Recent-B  (_XAUUSD_M5.txt, _XAUUSD_M15.txt)

CREATE TABLE IF NOT EXISTS raw_best_fit (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,                          -- filled by rounding stack
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,                             -- Best_Fit_Base_FL
    uoedt           REAL,                             -- Best_Fit_UOEDT
    loedt           REAL,                             -- Best_Fit_LOEDT
    horiz_high_map  REAL,                             -- Best_Fit_horiz_high_map
    horiz_low_map   REAL,                             -- Best_Fit_horiz_low_map
    ssa             REAL,                             -- Best_Fit_ssa
    ema_ssa         REAL,                             -- Best_Fit_ema_ssa
    crossing        INTEGER,                          -- Best_Fit_crossing (0/1)
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_cherry_a (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_cherry_b (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_most_recent (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_non_a (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_non_b (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.2 Fractal EDT (Fractal_EDT_XAUUSD_*.txt, 7 columns) ----------------
CREATE TABLE IF NOT EXISTS raw_fractal_edt (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_fl         REAL,                             -- Fractal_Best_FL
    uoedt           REAL,                             -- Fractal_UOEDT
    loedt           REAL,                             -- Fractal_LOEDT
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.3 OHLCV (OHLCV_XAUUSD_*.txt, 8 columns) ----------------------------
CREATE TABLE IF NOT EXISTS raw_ohlcv (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    open            REAL    NOT NULL,
    high            REAL    NOT NULL,
    low             REAL    NOT NULL,
    volume          INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.4 Single best lines (Resistance_Line / Support_Line, 5 columns) ----
CREATE TABLE IF NOT EXISTS raw_resistance (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_resistance REAL,                             -- Best_Resistance
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_support (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_support    REAL,                             -- Best_Support
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.5 Z-Score candles (ZScore_XAUUSD_*.txt, 10 columns) ----------------
CREATE TABLE IF NOT EXISTS raw_zscore (
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw       INTEGER NOT NULL,
    timestamp_adj       INTEGER,
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close               REAL    NOT NULL,
    open                REAL    NOT NULL,
    high                REAL    NOT NULL,
    low                 REAL    NOT NULL,
    body_direction      INTEGER NOT NULL CHECK (body_direction IN (-1, 0, 1)),
    body_size           REAL,                         -- absolute z-score of body
    body_classification INTEGER,                      -- 0-5 color class
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.6 ZigZag market structure (ZigZag_XAUUSD_*.txt, 15 columns) --------
-- IMPORTANT: rows are PIVOT EVENTS (Peak/Bottom), not one row per bar.
-- The first-4-column cross-validation against the per-bar sources only
-- aligns on bars where a pivot exists — the validator must account for this.
CREATE TABLE IF NOT EXISTS raw_zigzag (
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw       INTEGER NOT NULL,             -- zigzag_TimeStamp
    timestamp_adj       INTEGER,
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close               REAL    NOT NULL,
    point_type          TEXT    NOT NULL CHECK (point_type IN ('Peak', 'Bottom')),  -- zigzag_Type
    current_point       REAL,                         -- CurrentPoint (pivot price)
    price_change        REAL,                         -- CurrentPrChg
    pct_change          REAL,                         -- Current%Chg
    pct_change_class    INTEGER,                      -- Current%ChgClass
    bars                INTEGER,                      -- CurrentBars
    bars_class          INTEGER,                      -- CurrentBarsClass
    price_per_bar       REAL,                         -- CurrentPrPerBar
    price_per_bar_class INTEGER,                      -- CurrentPrPerBarClass
    slope               REAL,                         -- CurrentSlope
    category            TEXT,                         -- CurrentCategory (HH/HL/LH/LL/EQH/EQL)
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ============================================================================
-- 3. CROSS-SOURCE VALIDATION VIEW
-- ============================================================================
-- Flattens the validation keys of all 12 sources so the validator can compare
-- them per cycle. After the rounding stack fills timestamp_adj, the check is:
--
--   SELECT timestamp_adj, COUNT(DISTINCT symbol), COUNT(DISTINCT timeframe),
--          COUNT(DISTINCT close), COUNT(DISTINCT source)
--   FROM v_validation_keys
--   WHERE cycle_id = ?
--   GROUP BY timestamp_adj
--   HAVING COUNT(DISTINCT symbol) > 1
--       OR COUNT(DISTINCT timeframe) > 1
--       OR COUNT(DISTINCT close) > 1;
--
-- Any returned row = mismatch ⇒ reject the whole cycle.
-- (zigzag is excluded from per-bar matching by default — pivot events only
--  exist on some bars; include it once the validator handles sparse sources.)

CREATE VIEW IF NOT EXISTS v_validation_keys AS
    SELECT cycle_id, 'best_fit'    AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_best_fit
    UNION ALL
    SELECT cycle_id, 'cherry_a'    AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_cherry_a
    UNION ALL
    SELECT cycle_id, 'cherry_b'    AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_cherry_b
    UNION ALL
    SELECT cycle_id, 'most_recent' AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_most_recent
    UNION ALL
    SELECT cycle_id, 'non_a'       AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_non_a
    UNION ALL
    SELECT cycle_id, 'non_b'       AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_non_b
    UNION ALL
    SELECT cycle_id, 'fractal_edt' AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_fractal_edt
    UNION ALL
    SELECT cycle_id, 'ohlcv'       AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_ohlcv
    UNION ALL
    SELECT cycle_id, 'resistance'  AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_resistance
    UNION ALL
    SELECT cycle_id, 'support'     AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_support
    UNION ALL
    SELECT cycle_id, 'zscore'      AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_zscore;

CREATE VIEW IF NOT EXISTS v_validation_keys_zigzag AS
    SELECT cycle_id, 'zigzag'      AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_zigzag;

-- ============================================================================
-- 4. VALIDATED MARKET DATA (downstream-facing wide table)
-- ============================================================================
-- Only rows from cycles with status = 'validated' are merged here.
-- Keyed by adjusted timestamp + timeframe (one row per bar).

CREATE TABLE IF NOT EXISTS market_data (
    timestamp           INTEGER NOT NULL,             -- adjusted (rounded) unix timestamp
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),

    -- OHLCV (from raw_ohlcv)
    open                REAL    NOT NULL,
    high                REAL    NOT NULL,
    low                 REAL    NOT NULL,
    close               REAL    NOT NULL,
    volume              INTEGER NOT NULL,

    -- Centroid Regression: Best Fit
    best_fit_base_fl        REAL,
    best_fit_uoedt          REAL,
    best_fit_loedt          REAL,
    best_fit_horiz_high_map REAL,
    best_fit_horiz_low_map  REAL,
    best_fit_ssa            REAL,
    best_fit_ema_ssa        REAL,
    best_fit_crossing       INTEGER,

    -- Centroid Regression: Cherry Pick A
    cherry_a_base_fl        REAL,
    cherry_a_uoedt          REAL,
    cherry_a_loedt          REAL,
    cherry_a_horiz_high_map REAL,
    cherry_a_horiz_low_map  REAL,
    cherry_a_ssa            REAL,
    cherry_a_ema_ssa        REAL,
    cherry_a_crossing       INTEGER,

    -- Centroid Regression: Cherry Pick B
    cherry_b_base_fl        REAL,
    cherry_b_uoedt          REAL,
    cherry_b_loedt          REAL,
    cherry_b_horiz_high_map REAL,
    cherry_b_horiz_low_map  REAL,
    cherry_b_ssa            REAL,
    cherry_b_ema_ssa        REAL,
    cherry_b_crossing       INTEGER,

    -- Centroid Regression: Most Recent Line Extension
    most_recent_base_fl        REAL,
    most_recent_uoedt          REAL,
    most_recent_loedt          REAL,
    most_recent_horiz_high_map REAL,
    most_recent_horiz_low_map  REAL,
    most_recent_ssa            REAL,
    most_recent_ema_ssa        REAL,
    most_recent_crossing       INTEGER,

    -- Centroid Regression: Non-Most-Recent A
    non_a_base_fl        REAL,
    non_a_uoedt          REAL,
    non_a_loedt          REAL,
    non_a_horiz_high_map REAL,
    non_a_horiz_low_map  REAL,
    non_a_ssa            REAL,
    non_a_ema_ssa        REAL,
    non_a_crossing       INTEGER,

    -- Centroid Regression: Non-Most-Recent B
    non_b_base_fl        REAL,
    non_b_uoedt          REAL,
    non_b_loedt          REAL,
    non_b_horiz_high_map REAL,
    non_b_horiz_low_map  REAL,
    non_b_ssa            REAL,
    non_b_ema_ssa        REAL,
    non_b_crossing       INTEGER,

    -- Fractal EDT
    fractal_best_fl      REAL,
    fractal_uoedt        REAL,
    fractal_loedt        REAL,

    -- Single best lines
    best_resistance      REAL,
    best_support         REAL,

    -- Z-Score candle
    body_direction       INTEGER CHECK (body_direction IN (-1, 0, 1)),
    body_size            REAL,
    body_classification  INTEGER,

    -- ZigZag market structure (NULL on bars without a pivot)
    zigzag_point_type          TEXT CHECK (zigzag_point_type IN ('Peak', 'Bottom')),
    zigzag_current_point       REAL,
    zigzag_price_change        REAL,
    zigzag_pct_change          REAL,
    zigzag_pct_change_class    INTEGER,
    zigzag_bars                INTEGER,
    zigzag_bars_class          INTEGER,
    zigzag_price_per_bar       REAL,
    zigzag_price_per_bar_class INTEGER,
    zigzag_slope               REAL,
    zigzag_category            TEXT,

    -- Provenance
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id),
    collected_at        INTEGER NOT NULL,             -- unix, promote time

    -- Sync state for the gateway push worker (backfill worker v5).
    -- market_data is a permanent store: rows are marked synced, never deleted.
    synced_at           INTEGER,                      -- unix, NULL = not yet pushed to API gateway

    PRIMARY KEY (timestamp, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_market_data_tf_ts ON market_data (timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_unsynced ON market_data (timeframe, timestamp)
    WHERE synced_at IS NULL;
