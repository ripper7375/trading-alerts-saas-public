-- ============================================================================
-- SQLite schema v6 — XAUUSD indicator-export collection pipeline
-- Database file: xauusd.db  (one DB per symbol; XAUUSD is the only symbol)
--
-- Pipeline (MQL5 is the single source of every value — 2026-09-09):
--   1. COLLECT   — every 5 minutes the 13 indicator export files are ingested
--                  into the 13 raw_* staging tables under one collection cycle.
--                  EVERY exported column is staged, not a subset.
--   2. ADJUST    — timestamp_adj = raw timestamp snapped to the bar grid (a
--                  no-op on correct data since the 2026-09-09 MQL5 GMT-offset
--                  fix; retained as belt-and-braces).
--   3. VALIDATE  — the validation keys (timestamp_adj, symbol, timeframe,
--                  close ±0.01) must agree across sources; any mismatch
--                  rejects the WHOLE cycle and triggers a re-request.
--   4. PROMOTE   — staged columns merge onto the OHLCV per-bar spine into
--                  market_data, the single wide table consumed downstream.
--   5. RETAIN    — OHLCV export depth (InpBars) and every centroid variant's
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
-- Staging holds EVERY column each indicator exports, so PROMOTE is a straight
-- copy and no value is ever recomputed downstream of MT5. The former Python
-- calc stack (which recomputed the line/metric columns from a staged admin
-- layer) is parked in
-- calculation-split-between-mt5-and-python-PENDING-PROJECT/ — see that folder's
-- CALCULATION-SPLIT-ARCHITECTURE-PENDING.md for what it did and how to revive it.
--
-- NOTE for an existing database: every CREATE below is IF NOT EXISTS, so this
-- file will NOT add new staging columns to a raw_* table that already exists.
-- The collector's migrate_raw_tables() handles that (idempotent ALTER TABLE
-- ADD COLUMN driven by its SOURCES registry).
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
-- 2. RAW STAGING TABLES — every column each indicator exports
-- ============================================================================
-- Common leading columns (the validation keys):
--   cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close

-- ---- 2.1 Centroid-regression variants: maps + SSA + crossing + line -------
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
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
    base_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.2 Fractal EDT + single best lines + z-score candle set -------------
-- Export header names differ from the staging column names here (the .mq5
-- files write Fractal_Best_FL / Best_Resistance / Best_Support); the mapping
-- lives in the collector's SOURCES registry.
CREATE TABLE IF NOT EXISTS raw_fractal_edt (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_fl         REAL,
    uoedt           REAL,
    loedt           REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_resistance (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_resistance REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

CREATE TABLE IF NOT EXISTS raw_support (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    best_support    REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- body_size is |z-score| (the MQL5 export convention), NOT a candle body size.
-- body_direction and body_size are legitimately 0 (doji / on-mean), so they are
-- deliberately outside the collector's "<=0 means NULL" price-level guard.
CREATE TABLE IF NOT EXISTS raw_zscore (
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw       INTEGER NOT NULL,
    timestamp_adj       INTEGER,
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close               REAL    NOT NULL,
    body_direction      INTEGER,
    body_size           REAL,
    body_classification INTEGER,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);

-- ---- 2.3 OHLCV — the per-bar spine every other source merges onto ---------
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

-- ---- 2.4 ZigZag pivots (sparse event rows, not per-bar) -------------------
-- Sparse by nature: one row per confirmed pivot, so most bars have no zigzag
-- row at all and their zigzag_* columns in market_data stay NULL. The metric
-- columns are legitimately zero or negative (a flat or falling segment), so
-- they are deliberately outside the price-level "<=0 means NULL" guard.
CREATE TABLE IF NOT EXISTS raw_zigzag (
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw       INTEGER NOT NULL,
    timestamp_adj       INTEGER,
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close               REAL    NOT NULL,
    point_type          TEXT    NOT NULL CHECK (point_type IN ('Peak', 'Bottom')),
    current_point       REAL,
    price_change        REAL,
    pct_change          REAL,
    pct_change_class    INTEGER,
    bars                INTEGER,
    bars_class          INTEGER,
    price_per_bar       REAL,
    price_per_bar_class INTEGER,
    slope               REAL,
    category            TEXT,
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
-- 3.5 INDICATOR STATISTICS OUTBOX (append-only in Postgres, transient here)
-- ============================================================================
-- One row per (source, timeframe, collection cycle): the fit-quality snapshot
-- parsed from each indicator's _Statistic.txt companion. R2, MSE, variance
-- ratio, skewness, kurtosis, EDT containment, window size — none of which
-- exists in market_data and none of which can be honestly reconstructed later.
--
-- APPEND-ONLY applies to the PostgreSQL archive, NOT to this table. Here it is
-- a pure OUTBOX: rows are pushed, then deleted once synced and older than the
-- replay window (see the trigger in §5). SQLite stays a bounded buffer, per
-- the design rule in §5.3 of the blueprint. Unsynced rows are never deleted.
--
-- Deliberately independent of market_data: its own outbox, its own push loop,
-- its own quarantine file. A failure in this stream must never be able to
-- block or reject price ingestion.
--
-- Design: STATISTIC-CAPTURE-SCOPE.md in this folder.
CREATE TABLE IF NOT EXISTS indicator_statistics (
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    source              TEXT    NOT NULL,
    captured_at         INTEGER NOT NULL,   -- the collector's cycle slot; the append-only half of the key
    live_bar_ts         INTEGER NOT NULL,   -- newest bar in that export; joins to market_data.timestamp

    -- resolved line (line indicators supply solution_found/line_origin_ts/touches)
    solution_found      INTEGER,            -- 0/1, NULL for the centroids
    raw_slope           REAL,
    anchored_y_int      REAL,
    regression_angle    REAL,
    line_origin_ts      INTEGER,
    touches             INTEGER,

    -- fitting window
    window_start_ts     INTEGER,
    window_end_ts       INTEGER,
    window_bars         INTEGER,
    math_lookback       INTEGER,
    crossings_n         INTEGER,

    -- [MODEL A; CROSSINGS] — centroid variants only
    model_a_n           INTEGER,
    model_a_r2          REAL,
    model_a_mse         REAL,
    model_a_var_ratio   REAL,
    model_a_skew        REAL,
    model_a_kurt        REAL,

    -- [MODEL B; CLOSE PRICE] — all 10 sources
    model_b_n           INTEGER,
    model_b_r2          REAL,
    model_b_mse         REAL,
    model_b_var_ratio   REAL,
    model_b_skew        REAL,
    model_b_kurt        REAL,

    -- [EDT CHANNEL] — 7 centroids + fractal_edt (single lines have no channel)
    uoedt_offset        REAL,
    loedt_offset        REAL,
    containment_n       INTEGER,
    containment_count   INTEGER,
    containment_rate    REAL,

    config_hash         TEXT    NOT NULL,   -- sha256 of the normalised params block
    config_params       TEXT    NOT NULL,   -- JSON; the gateway creates indicator_configs on first sight
    synced_at           INTEGER,            -- NULL = not yet pushed

    PRIMARY KEY (symbol, timeframe, source, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_indicator_statistics_unsynced
    ON indicator_statistics (captured_at) WHERE synced_at IS NULL;

-- ============================================================================
-- 4. VALIDATED MARKET DATA (downstream-facing wide table)
-- ============================================================================
-- EVERY data column here is a value MQL5 computed and exported; the pipeline
-- copies it from staging without recomputing anything. The per-column
-- "from MQL5" markers name which export column each one came from where that
-- is not obvious. Only the four provenance columns are collector-generated.
--
-- Consequence worth knowing: these are one fixed, admin-configured
-- parameterization per indicator. Answering "what would this look like with
-- different parameters?" needs the parked Python calc stack — see
-- calculation-split-between-mt5-and-python-PENDING-PROJECT/.
--
-- Column names and types are frozen: this table is a 1:1 mirror of
-- gateway_contract_market_data.schema.json, which the Railway gateway and both
-- Prisma schemas mirror in turn. Do not rename a column here alone.

CREATE TABLE IF NOT EXISTS market_data (
    timestamp           INTEGER NOT NULL,             -- adjusted (rounded) unix timestamp
    symbol              TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe           TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),

    -- OHLCV (from raw_ohlcv — the per-bar spine)
    open                REAL    NOT NULL,
    high                REAL    NOT NULL,
    low                 REAL    NOT NULL,
    close               REAL    NOT NULL,
    volume              INTEGER NOT NULL,

    -- Centroid variants: 7 families x 8 columns, all exported by their .mq5
    best_fit_a_horiz_high_map REAL,
    best_fit_a_horiz_low_map  REAL,
    best_fit_a_ssa            REAL,
    best_fit_a_ema_ssa        REAL,
    best_fit_a_crossing       INTEGER,
    best_fit_a_base_fl        REAL,    -- from MQL5 (Best_Fit_A_Base_FL)
    best_fit_a_uoedt          REAL,    -- from MQL5
    best_fit_a_loedt          REAL,    -- from MQL5

    best_fit_b_horiz_high_map REAL,
    best_fit_b_horiz_low_map  REAL,
    best_fit_b_ssa            REAL,
    best_fit_b_ema_ssa        REAL,
    best_fit_b_crossing       INTEGER,
    best_fit_b_base_fl        REAL,    -- from MQL5 (Best_Fit_B_Base_FL)
    best_fit_b_uoedt          REAL,    -- from MQL5
    best_fit_b_loedt          REAL,    -- from MQL5

    cherry_a_horiz_high_map REAL,
    cherry_a_horiz_low_map  REAL,
    cherry_a_ssa            REAL,
    cherry_a_ema_ssa        REAL,
    cherry_a_crossing       INTEGER,
    cherry_a_base_fl        REAL,    -- from MQL5
    cherry_a_uoedt          REAL,    -- from MQL5
    cherry_a_loedt          REAL,    -- from MQL5

    cherry_b_horiz_high_map REAL,
    cherry_b_horiz_low_map  REAL,
    cherry_b_ssa            REAL,
    cherry_b_ema_ssa        REAL,
    cherry_b_crossing       INTEGER,
    cherry_b_base_fl        REAL,    -- from MQL5
    cherry_b_uoedt          REAL,    -- from MQL5
    cherry_b_loedt          REAL,    -- from MQL5

    most_recent_horiz_high_map REAL,
    most_recent_horiz_low_map  REAL,
    most_recent_ssa            REAL,
    most_recent_ema_ssa        REAL,
    most_recent_crossing       INTEGER,
    most_recent_base_fl        REAL, -- from MQL5
    most_recent_uoedt          REAL, -- from MQL5
    most_recent_loedt          REAL, -- from MQL5

    non_a_horiz_high_map REAL,
    non_a_horiz_low_map  REAL,
    non_a_ssa            REAL,
    non_a_ema_ssa        REAL,
    non_a_crossing       INTEGER,
    non_a_base_fl        REAL,       -- from MQL5
    non_a_uoedt          REAL,       -- from MQL5
    non_a_loedt          REAL,       -- from MQL5

    non_b_horiz_high_map REAL,
    non_b_horiz_low_map  REAL,
    non_b_ssa            REAL,
    non_b_ema_ssa        REAL,
    non_b_crossing       INTEGER,
    non_b_base_fl        REAL,       -- from MQL5
    non_b_uoedt          REAL,       -- from MQL5
    non_b_loedt          REAL,       -- from MQL5

    -- Fractal EDT + single best lines (2EDTFractalBestFitv5 / SingleBest*Linev3)
    fractal_best_fl      REAL,                        -- from MQL5 (Fractal_Best_FL)
    fractal_uoedt        REAL,                        -- from MQL5 (Fractal_UOEDT)
    fractal_loedt        REAL,                        -- from MQL5 (Fractal_LOEDT)
    best_resistance      REAL,                        -- from MQL5 (Best_Resistance)
    best_support         REAL,                        -- from MQL5 (Best_Support)

    -- Z-Score candle (zscoreohlccandleexport)
    body_direction       INTEGER CHECK (body_direction IN (-1, 0, 1)),
    body_size            REAL,                        -- |z-score| (export convention)
    body_classification  INTEGER,

    -- ZigZag (ZigZagExportv43). Sparse: NULL on every bar without a pivot.
    zigzag_point_type          TEXT CHECK (zigzag_point_type IN ('Peak', 'Bottom')),
    zigzag_current_point       REAL,
    zigzag_price_change        REAL,    -- from MQL5
    zigzag_pct_change          REAL,    -- from MQL5
    zigzag_pct_change_class    INTEGER, -- from MQL5
    zigzag_bars                INTEGER, -- from MQL5
    zigzag_bars_class          INTEGER, -- from MQL5
    zigzag_price_per_bar       REAL,    -- from MQL5
    zigzag_price_per_bar_class INTEGER, -- from MQL5
    zigzag_slope               REAL,    -- from MQL5
    zigzag_category            TEXT,    -- from MQL5

    -- Provenance
    cycle_id            INTEGER NOT NULL REFERENCES collection_cycles (cycle_id),
    collected_at        INTEGER NOT NULL,             -- unix, promote time
    -- LEGACY: marked the old Python CALCULATE stage. With MQL5 as the single
    -- source there is no separate calculation step, so the collector sets it
    -- equal to collected_at. Kept (not dropped) because market_data is a 1:1
    -- mirror of the frozen 87-field gateway contract.
    calculated_at       INTEGER,                      -- unix, = collected_at

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

-- Statistics outbox retention: 7-day replay buffer, then gone. PostgreSQL is
-- the append-only archive; this table only has to survive long enough to be
-- pushed (and re-pushed, if the gateway needed a fix). Same guarantee as
-- market_data: an UNSYNCED row is never deleted, no matter how old — the sync
-- guarantee always beats retention.
CREATE TRIGGER IF NOT EXISTS trg_indicator_statistics_prune
AFTER INSERT ON indicator_statistics
BEGIN
    DELETE FROM indicator_statistics
    WHERE synced_at IS NOT NULL
      AND captured_at < NEW.captured_at - 604800;
END;

-- ============================================================================
-- 6. ECONOMIC EVENTS OUTBOX (append-only, MT5 built-in calendar)
-- ============================================================================
-- Source: MT5's own Economic Calendar API (CalendarValueHistory ->
-- CalendarEventById -> CalendarCountryById), read by the calendar exporter on
-- the same terminal that runs the 13 export indicators. No vendor, no API key.
-- Availability confirmed on the live terminal before this table was designed
-- (Eightcap-Demo build 6182: 333 events / 8 days, 333/333 lookups resolved,
-- 25 HIGH-impact, server-side currency filtering functional).
--
-- APPEND-ONLY, and for the same reason indicator_statistics is. A forecast is
-- revised and an actual lands only AFTER the release, so overwriting the row
-- destroys what the market knew beforehand — the exact loss
-- HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md documents for market_data,
-- where it is unrecoverable. A correction is a NEW row with a later
-- captured_at, never an update. Current state is then a DISTINCT ON query;
-- the reverse (recovering history from an upserted row) is impossible.
--
-- NOT symbol-scoped. Economic events are global; relevance to XAUUSD is
-- derived from `currency` at query time, not denormalised in here.
--
-- ⚠ MISSING vs ZERO. MQL5 returns LONG_MIN for an unset value, and a real 0.0
-- forecast is NOT missing data. The exporter must write NULL for LONG_MIN and
-- must never coerce it to 0 — same guard as PRICE_LEVEL_COLUMNS in the
-- export collector. Step Zero measured only 12 of 23 upcoming HIGH-impact
-- events carrying a forecast at all (rate decisions and speeches structurally
-- have none), so NULL here is the common case, not an error case.
--
-- ⚠ TIMES ARE UTC. MqlCalendarValue.time is SERVER time; the exporter converts
-- using the same hour-rounded TimeTradeServer()-TimeGMT() offset the fixed
-- export indicators use. Confirmed against two real releases (US PPI 08:30 ET,
-- ECB 14:15 CEST) rather than assumed. Never store server time here.
-- ⚠ IDS ARE TEXT, DELIBERATELY. MqlCalendarValue.id and MqlCalendarEvent.id are
-- MQL5 `ulong` (64-bit), and JSON has no 64-bit integer type — a large id would
-- silently lose precision crossing the gateway as a JSON number. They are
-- opaque identifiers we never do arithmetic on (ordering is by captured_at /
-- event_time), so they are TEXT here, in the gateway contract and in Prisma
-- alike: one representation, no conversion boundary to drift at. The exporter
-- writes IntegerToString(id).
CREATE TABLE IF NOT EXISTS economic_events (
    value_id            TEXT    NOT NULL,   -- MqlCalendarValue.id — one specific release
    captured_at         INTEGER NOT NULL,   -- unix UTC; the append-only half of the key
    event_id            TEXT    NOT NULL,   -- MqlCalendarEvent.id — the recurring event
    event_time          INTEGER NOT NULL,   -- unix UTC; when the event occurs
    event_period        INTEGER,            -- unix UTC; the reporting period covered
    revision            INTEGER,            -- MqlCalendarValue.revision

    -- Country / currency (MqlCalendarCountry)
    country_code        TEXT    NOT NULL,   -- ISO 3166-1 alpha-2
    currency            TEXT    NOT NULL,   -- e.g. USD — the XAUUSD relevance filter

    -- Event descriptors (MqlCalendarEvent)
    event_name          TEXT    NOT NULL,
    importance          TEXT    NOT NULL CHECK (importance IN ('NONE','LOW','MODERATE','HIGH')),
    event_type          INTEGER,
    sector              INTEGER,
    frequency           INTEGER,
    time_mode           INTEGER,
    unit                INTEGER,
    multiplier          INTEGER,
    digits              INTEGER,
    event_code          TEXT,
    source_url          TEXT,

    -- Values. NULL = not published (LONG_MIN upstream), NOT zero.
    actual_value        REAL,
    forecast_value      REAL,
    prev_value          REAL,
    revised_prev_value  REAL,
    impact_type         INTEGER,            -- MqlCalendarValue.impact_type

    synced_at           INTEGER,            -- NULL = not yet pushed

    PRIMARY KEY (value_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_economic_events_unsynced
    ON economic_events (captured_at) WHERE synced_at IS NULL;

-- Lets the exporter cheaply ask "has this release changed since I last saw it?"
-- so an unchanged event does not append an identical row every cycle.
CREATE INDEX IF NOT EXISTS idx_economic_events_latest
    ON economic_events (value_id, captured_at DESC);

-- Same 7-day replay buffer as the statistics outbox: PostgreSQL is the
-- append-only archive, this table only has to survive long enough to be pushed
-- and re-pushed. An UNSYNCED row is never deleted regardless of age — the sync
-- guarantee always beats retention.
CREATE TRIGGER IF NOT EXISTS trg_economic_events_prune
AFTER INSERT ON economic_events
BEGIN
    DELETE FROM economic_events
    WHERE synced_at IS NOT NULL
      AND captured_at < NEW.captured_at - 604800;
END;
