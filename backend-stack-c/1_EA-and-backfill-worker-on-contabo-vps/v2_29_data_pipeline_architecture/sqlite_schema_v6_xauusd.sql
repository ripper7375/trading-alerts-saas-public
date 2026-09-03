-- ============================================================================
-- SQLite schema v6 — XAUUSD indicator-export collection pipeline
-- Database file: xauusd.db  (one DB per symbol; XAUUSD is the only symbol)
--
-- Pipeline (v6 adds the CALCULATE stage backed by the Python calc stack in
-- backend-stack-c/2_python-calc-stack/):
--   1. COLLECT   — every 5 minutes the 13 indicator export files are ingested
--                  into the 13 raw_* staging tables under one collection cycle.
--   2. ADJUST    — timestamp_adj = raw timestamp rounded to the bar grid.
--   3. VALIDATE  — the validation keys (timestamp_adj, symbol, timeframe,
--                  close ±0.01) must agree across sources; any mismatch
--                  rejects the WHOLE cycle and triggers a re-request.
--   4. CALCULATE — Python computes the user-configurable derived values
--                  (zscore_candle.py, zigzag_metrics.py, fractal_lines.py,
--                  centroid_regression.py) from the staged admin-layer data.
--   5. PROMOTE   — admin-layer columns + Python-calculated columns merge into
--                  market_data, the single wide table consumed downstream.
--   6. RETAIN    — OHLCV export depth (InpBars) and every centroid variant's
--                  SSA math lookback (InpSSAMathLookback) are both pinned to
--                  3000 bars per timeframe (see ohlcvexportlightweight_v2_29.mq5
--                  and the 2EDTCentroidRegression*_v2_29.mq5 indicators). MT5
--                  never re-exports a bar once it scrolls out of that window,
--                  so market_data rows beyond 3000 bars back are a frozen
--                  last-known snapshot that will never be corrected again —
--                  keeping them indefinitely has no analytical value. A
--                  trigger (§5 below) prunes rows outside that window, but
--                  ONLY once they have been pushed to the API gateway
--                  (synced_at IS NOT NULL), so the sync guarantee for the
--                  gateway push worker is never compromised by pruning.
--
-- v6 staging stores ONLY the admin layer (MQL5-owned inputs): OHLCV, the
-- centroid variants' fractal maps / ssa / ema_ssa / crossing, and zigzag
-- pivots. Derived line/metric columns no longer live in staging — they are
-- calculated. (The MQL5 indicators keep exporting their full column set
-- during the golden-parity period; the extra columns are simply not staged.)
--
-- Notes:
--   * Timeframes restricted to M5 and M15, symbol to XAUUSD (CHECKs).
--   * Empty export fields are stored as NULL, not 0.
--   * Run with:  PRAGMA foreign_keys = ON;  (required for cascades)
-- ============================================================================

-- INCREMENTAL auto_vacuum lets the pruning trigger (§5, below) actually
-- reclaim disk space via periodic `PRAGMA incremental_vacuum;`, instead of
-- only freeing pages for internal reuse. MUST run before `journal_mode=WAL`
-- and before any table exists — switching journal modes first silently
-- locks auto_vacuum to NONE (verified: reordering these two lines is not
-- cosmetic). NOTE: on an xauusd.db that already exists and has tables, this
-- line is a silent no-op regardless of order — run `VACUUM;` ONCE by hand
-- against the existing file to convert it into incremental_vacuum mode,
-- after which `PRAGMA incremental_vacuum;` works going forward. VACUUM
-- needs an exclusive lock and up to ~2x the DB's disk space during the
-- rebuild, so do that one-time conversion during a maintenance window, not
-- while the collector is running.
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. COLLECTION CYCLE TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS collection_cycles (
    cycle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_time      INTEGER NOT NULL,                 -- scheduled 5-min boundary (unix, UTC)
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    attempt         INTEGER NOT NULL DEFAULT 1,       -- re-request counter
    status          TEXT    NOT NULL DEFAULT 'collecting'
                    CHECK (status IN ('collecting', 'validating', 'validated', 'rejected')),
    sources_received INTEGER NOT NULL DEFAULT 0,      -- 0..13 export files ingested
    rejected_reason TEXT,
    created_at      INTEGER NOT NULL,
    validated_at    INTEGER,
    UNIQUE (cycle_time, timeframe, attempt)
);

CREATE INDEX IF NOT EXISTS idx_cycles_status ON collection_cycles (status, timeframe);

CREATE TABLE IF NOT EXISTS validation_failures (
    failure_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id     INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    field        TEXT    NOT NULL CHECK (field IN ('timestamp', 'symbol', 'timeframe', 'close')),
    detail       TEXT    NOT NULL,                    -- JSON: per-source values
    created_at   INTEGER NOT NULL
);

-- ============================================================================
-- 2. RAW STAGING TABLES — admin layer only (v6)
-- ============================================================================
-- Common leading columns (the validation keys):
--   cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close

-- ---- 2.1 Centroid-regression variants: maps + SSA + crossing --------------
-- best_fit_a/best_fit_b: isolated-coexistence split of the former single
-- 'best_fit' source (2026-09-03) — best_fit_a is numerically identical to
-- the old best_fit (InpExcludeRecentCentroids=0); best_fit_b is new
-- (InpExcludeRecentCentroids=3), mirroring the existing non_a/non_b pair.
CREATE TABLE IF NOT EXISTS raw_best_fit_a (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_best_fit_b (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_cherry_a (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
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
    horiz_high_map  REAL,
    horiz_low_map   REAL,
    ssa             REAL,
    ema_ssa         REAL,
    crossing        INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.2 Keys-only sources (consistency heartbeats; lines are calculated) -
CREATE TABLE IF NOT EXISTS raw_fractal_edt (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_resistance (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_support (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_zscore (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.3 OHLCV — the per-bar spine and the calc stack's price input -------
CREATE TABLE IF NOT EXISTS raw_ohlcv (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    open            REAL    NOT NULL,
    high            REAL    NOT NULL,
    low              REAL   NOT NULL,
    volume          INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.4 ZigZag pivots (event rows; metrics are calculated) ---------------
CREATE TABLE IF NOT EXISTS raw_zigzag (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    point_type      TEXT    NOT NULL CHECK (point_type IN ('Peak', 'Bottom')),
    current_point   REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ============================================================================
-- 3. CROSS-SOURCE VALIDATION VIEW
-- ============================================================================
CREATE VIEW IF NOT EXISTS v_validation_keys AS
    SELECT cycle_id, 'best_fit_a'  AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_best_fit_a
    UNION ALL
    SELECT cycle_id, 'best_fit_b'  AS source, timestamp_raw, timestamp_adj, symbol, timeframe, close FROM raw_best_fit_b
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
-- v6: columns marked "calculated" are produced by the Python calc stack at
-- the CALCULATE stage (default parameter presets); admin-layer columns come
-- from staging. User-parameterized variants are computed on demand by the
-- same modules and are NOT stored here.

CREATE TABLE IF NOT EXISTS market_data (
    timestamp           INTEGER NOT NULL,             -- adjusted (rounded) unix timestamp
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),

    -- OHLCV (admin layer, from raw_ohlcv)
    open                REAL    NOT NULL,
    high                REAL    NOT NULL,
    low                 REAL    NOT NULL,
    close               REAL    NOT NULL,
    volume              INTEGER NOT NULL,

    -- Centroid variants: admin layer (staged) + calculated lines
    best_fit_a_horiz_high_map REAL,
    best_fit_a_horiz_low_map  REAL,
    best_fit_a_ssa            REAL,
    best_fit_a_ema_ssa        REAL,
    best_fit_a_crossing       INTEGER,
    best_fit_a_base_fl        REAL,    -- calculated (centroid_regression.py 'best_fit_a')
    best_fit_a_uoedt          REAL,    -- calculated
    best_fit_a_loedt          REAL,    -- calculated

    best_fit_b_horiz_high_map REAL,
    best_fit_b_horiz_low_map  REAL,
    best_fit_b_ssa            REAL,
    best_fit_b_ema_ssa        REAL,
    best_fit_b_crossing       INTEGER,
    best_fit_b_base_fl        REAL,    -- calculated (centroid_regression.py 'best_fit_b')
    best_fit_b_uoedt          REAL,    -- calculated
    best_fit_b_loedt          REAL,    -- calculated

    cherry_a_horiz_high_map REAL,
    cherry_a_horiz_low_map  REAL,
    cherry_a_ssa            REAL,
    cherry_a_ema_ssa        REAL,
    cherry_a_crossing       INTEGER,
    cherry_a_base_fl        REAL,    -- calculated
    cherry_a_uoedt          REAL,    -- calculated
    cherry_a_loedt          REAL,    -- calculated

    cherry_b_horiz_high_map REAL,
    cherry_b_horiz_low_map  REAL,
    cherry_b_ssa            REAL,
    cherry_b_ema_ssa        REAL,
    cherry_b_crossing       INTEGER,
    cherry_b_base_fl        REAL,    -- calculated
    cherry_b_uoedt          REAL,    -- calculated
    cherry_b_loedt          REAL,    -- calculated

    most_recent_horiz_high_map REAL,
    most_recent_horiz_low_map  REAL,
    most_recent_ssa            REAL,
    most_recent_ema_ssa        REAL,
    most_recent_crossing       INTEGER,
    most_recent_base_fl        REAL, -- calculated
    most_recent_uoedt          REAL, -- calculated
    most_recent_loedt          REAL, -- calculated

    non_a_horiz_high_map REAL,
    non_a_horiz_low_map  REAL,
    non_a_ssa            REAL,
    non_a_ema_ssa        REAL,
    non_a_crossing       INTEGER,
    non_a_base_fl        REAL,       -- calculated
    non_a_uoedt          REAL,       -- calculated
    non_a_loedt          REAL,       -- calculated

    non_b_horiz_high_map REAL,
    non_b_horiz_low_map  REAL,
    non_b_ssa            REAL,
    non_b_ema_ssa        REAL,
    non_b_crossing       INTEGER,
    non_b_base_fl        REAL,       -- calculated
    non_b_uoedt          REAL,       -- calculated
    non_b_loedt          REAL,       -- calculated

    -- Fractal EDT + single best lines (calculated, fractal_lines.py)
    fractal_best_fl      REAL,
    fractal_uoedt        REAL,
    fractal_loedt        REAL,
    best_resistance      REAL,
    best_support         REAL,

    -- Z-Score candle (calculated, zscore_candle.py)
    body_direction       INTEGER CHECK (body_direction IN (-1, 0, 1)),
    body_size            REAL,                        -- |z-score| (export convention)
    body_classification  INTEGER,

    -- ZigZag (pivot = admin layer; metrics calculated, zigzag_metrics.py;
    --  NULL on bars without a pivot)
    zigzag_point_type          TEXT CHECK (zigzag_point_type IN ('Peak', 'Bottom')),
    zigzag_current_point       REAL,
    zigzag_price_change        REAL,    -- calculated
    zigzag_pct_change          REAL,    -- calculated
    zigzag_pct_change_class    INTEGER, -- calculated
    zigzag_bars                INTEGER, -- calculated
    zigzag_bars_class          INTEGER, -- calculated
    zigzag_price_per_bar       REAL,    -- calculated
    zigzag_price_per_bar_class INTEGER, -- calculated
    zigzag_slope               REAL,    -- calculated
    zigzag_category            TEXT,    -- calculated

    -- Provenance
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id),
    collected_at        INTEGER NOT NULL,             -- unix, promote time
    calculated_at       INTEGER,                      -- unix, CALCULATE stage time (NULL = calc skipped)

    -- Sync state for the gateway push worker (backfill worker v5).
    -- A row is permanent (never deleted) UNTIL it has been synced AND has
    -- scrolled outside the live 3000-bar window (see §5 RETAIN, above, and
    -- trg_market_data_prune, below). Unsynced rows are never pruned, no
    -- matter their age — the sync guarantee always wins over retention.
    synced_at           INTEGER,                      -- NULL = not yet pushed to API gateway

    PRIMARY KEY (timestamp, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_market_data_tf_ts ON market_data (timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_unsynced ON market_data (timeframe, timestamp)
    WHERE synced_at IS NULL;

-- ============================================================================
-- 5. RETENTION — prune market_data to the 3000-bar window MT5 itself keeps
-- ============================================================================
-- Fires after every promoted row. Deletes rows for that (symbol, timeframe)
-- that have BOTH (a) fallen outside the most-recent-3000 window AND (b)
-- already been synced to the API gateway. Unsynced rows are exempt at any
-- age, so a gateway outage can never cause data loss before it's delivered.
--
-- Cost: one indexed LIMIT-3000 scan per insert (idx_market_data_tf_ts),
-- and inserts only happen once per validated cycle (every 5 or 15 min) — so
-- this is cheap relative to the collection cadence.
--
-- Note: DELETE reclaims logical space but SQLite will not shrink the .db
-- file on disk by itself. Run `PRAGMA incremental_vacuum;` (or `VACUUM;`)
-- periodically (e.g. daily, from a maintenance cron/task) if file size needs
-- to be reclaimed — this schema does not do so automatically.
CREATE TRIGGER IF NOT EXISTS trg_market_data_prune
AFTER INSERT ON market_data
BEGIN
    DELETE FROM market_data
    WHERE symbol = NEW.symbol
      AND timeframe = NEW.timeframe
      AND synced_at IS NOT NULL
      AND timestamp NOT IN (
          SELECT timestamp FROM market_data
          WHERE symbol = NEW.symbol AND timeframe = NEW.timeframe
          ORDER BY timestamp DESC
          LIMIT 3000
      );
END;
