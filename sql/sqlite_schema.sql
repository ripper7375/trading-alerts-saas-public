-- ============================================================================
-- SQLite Schema for MT5 Data Collection
-- Part 20: Trading Alerts SaaS
--
-- Purpose: Local high-frequency data store on Contabo VPS (Windows)
-- Writes: Every 30 seconds from MQL5 Service
-- Tables: 15 (one per symbol)
-- Columns: 14 per table
-- ============================================================================

-- ============================================================================
-- SYMBOL: AUDJPY
-- ============================================================================
CREATE TABLE IF NOT EXISTS AUDJPY (
    timestamp               INTEGER PRIMARY KEY,  -- Unix timestamp
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,  -- JSON: {"peaks": [...], "bottoms": [...]}
    horizontal_trendlines   TEXT,  -- JSON: {"peak_1": [...], "bottom_1": [...]}
    diagonal_trendlines     TEXT,  -- JSON: {"ascending_1": [...], "descending_1": [...]}
    momentum_candles        TEXT,  -- JSON: [{"index": 0, "type": 1, "zscore": 2.5}, ...]
    keltner_channels        TEXT,  -- JSON: {"ultra_extreme_upper": [...], ...}
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT   -- JSON: {"peaks": [...], "bottoms": [...]}
);

CREATE INDEX IF NOT EXISTS idx_audjpy_timestamp ON AUDJPY(timestamp);

-- ============================================================================
-- SYMBOL: AUDUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS AUDUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_audusd_timestamp ON AUDUSD(timestamp);

-- ============================================================================
-- SYMBOL: BTCUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS BTCUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_btcusd_timestamp ON BTCUSD(timestamp);

-- ============================================================================
-- SYMBOL: ETHUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS ETHUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ethusd_timestamp ON ETHUSD(timestamp);

-- ============================================================================
-- SYMBOL: EURUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS EURUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_eurusd_timestamp ON EURUSD(timestamp);

-- ============================================================================
-- SYMBOL: GBPJPY
-- ============================================================================
CREATE TABLE IF NOT EXISTS GBPJPY (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbpjpy_timestamp ON GBPJPY(timestamp);

-- ============================================================================
-- SYMBOL: GBPUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS GBPUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbpusd_timestamp ON GBPUSD(timestamp);

-- ============================================================================
-- SYMBOL: NDX100
-- ============================================================================
CREATE TABLE IF NOT EXISTS NDX100 (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ndx100_timestamp ON NDX100(timestamp);

-- ============================================================================
-- SYMBOL: NZDUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS NZDUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_nzdusd_timestamp ON NZDUSD(timestamp);

-- ============================================================================
-- SYMBOL: US30
-- ============================================================================
CREATE TABLE IF NOT EXISTS US30 (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_us30_timestamp ON US30(timestamp);

-- ============================================================================
-- SYMBOL: USDCAD
-- ============================================================================
CREATE TABLE IF NOT EXISTS USDCAD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_usdcad_timestamp ON USDCAD(timestamp);

-- ============================================================================
-- SYMBOL: USDCHF
-- ============================================================================
CREATE TABLE IF NOT EXISTS USDCHF (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_usdchf_timestamp ON USDCHF(timestamp);

-- ============================================================================
-- SYMBOL: USDJPY
-- ============================================================================
CREATE TABLE IF NOT EXISTS USDJPY (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_usdjpy_timestamp ON USDJPY(timestamp);

-- ============================================================================
-- SYMBOL: XAGUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS XAGUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_xagusd_timestamp ON XAGUSD(timestamp);

-- ============================================================================
-- SYMBOL: XAUUSD
-- ============================================================================
CREATE TABLE IF NOT EXISTS XAUUSD (
    timestamp               INTEGER PRIMARY KEY,
    open                    REAL NOT NULL,
    high                    REAL NOT NULL,
    low                     REAL NOT NULL,
    close                   REAL NOT NULL,
    fractals                TEXT,
    horizontal_trendlines   TEXT,
    diagonal_trendlines     TEXT,
    momentum_candles        TEXT,
    keltner_channels        TEXT,
    tema                    REAL,
    hrma                    REAL,
    smma                    REAL,
    zigzag                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_xauusd_timestamp ON XAUUSD(timestamp);

-- ============================================================================
-- METADATA TABLE: Track sync status
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
    symbol                  TEXT PRIMARY KEY,
    last_sync_timestamp     INTEGER,
    rows_synced             INTEGER DEFAULT 0,
    last_sync_datetime      TEXT,
    created_at              TEXT DEFAULT (datetime('now')),
    updated_at              TEXT DEFAULT (datetime('now'))
);

-- Initialize sync metadata for all symbols
INSERT OR IGNORE INTO sync_metadata (symbol, last_sync_timestamp, rows_synced) VALUES
    ('AUDJPY', 0, 0),
    ('AUDUSD', 0, 0),
    ('BTCUSD', 0, 0),
    ('ETHUSD', 0, 0),
    ('EURUSD', 0, 0),
    ('GBPJPY', 0, 0),
    ('GBPUSD', 0, 0),
    ('NDX100', 0, 0),
    ('NZDUSD', 0, 0),
    ('US30', 0, 0),
    ('USDCAD', 0, 0),
    ('USDCHF', 0, 0),
    ('USDJPY', 0, 0),
    ('XAGUSD', 0, 0),
    ('XAUUSD', 0, 0);
