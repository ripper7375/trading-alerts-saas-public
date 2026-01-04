-- ============================================================================
-- PostgreSQL Schema for Trading Alerts SaaS
-- Part 20: SQLite + Sync to PostgreSQL Architecture
--
-- Purpose: Cloud-accessible time-series storage on Railway
-- Tables: 135 (15 symbols × 9 timeframes)
-- Columns: 14 per table
-- ============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================================
-- AUDJPY TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audjpy_m5 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_m15 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_m30 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_h1 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_h2 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_h4 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_h8 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_h12 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

CREATE TABLE IF NOT EXISTS audjpy_d1 (
    timestamp               TIMESTAMPTZ PRIMARY KEY,
    open                    DOUBLE PRECISION NOT NULL,
    high                    DOUBLE PRECISION NOT NULL,
    low                     DOUBLE PRECISION NOT NULL,
    close                   DOUBLE PRECISION NOT NULL,
    fractals                JSONB,
    horizontal_trendlines   JSONB,
    diagonal_trendlines     JSONB,
    momentum_candles        JSONB,
    keltner_channels        JSONB,
    tema                    DOUBLE PRECISION,
    hrma                    DOUBLE PRECISION,
    smma                    DOUBLE PRECISION,
    zigzag                  JSONB
);

-- ============================================================================
-- AUDUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS audusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- BTCUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS btcusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS btcusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- ETHUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ethusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ethusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- EURUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS eurusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS eurusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- GBPJPY TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gbpjpy_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpjpy_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- GBPUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gbpusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS gbpusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- NDX100 TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ndx100_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS ndx100_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- NZDUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nzdusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS nzdusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- US30 TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS us30_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS us30_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- USDCAD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usdcad_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdcad_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- USDCHF TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usdchf_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdchf_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- USDJPY TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usdjpy_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS usdjpy_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- XAGUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS xagusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xagusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- XAUUSD TABLES (9 timeframes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS xauusd_m5 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_m15 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_m30 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_h1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_h2 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_h4 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_h8 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_h12 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

CREATE TABLE IF NOT EXISTS xauusd_d1 (
    timestamp TIMESTAMPTZ PRIMARY KEY, open DOUBLE PRECISION NOT NULL, high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL, close DOUBLE PRECISION NOT NULL, fractals JSONB,
    horizontal_trendlines JSONB, diagonal_trendlines JSONB, momentum_candles JSONB,
    keltner_channels JSONB, tema DOUBLE PRECISION, hrma DOUBLE PRECISION, smma DOUBLE PRECISION, zigzag JSONB
);

-- ============================================================================
-- SYNC METADATA TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
    symbol              VARCHAR(10) NOT NULL,
    timeframe           VARCHAR(5) NOT NULL,
    last_sync_timestamp TIMESTAMPTZ,
    rows_synced         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, timeframe)
);

-- Initialize sync metadata for all 135 combinations
INSERT INTO sync_metadata (symbol, timeframe, rows_synced) VALUES
    ('AUDJPY', 'M5', 0), ('AUDJPY', 'M15', 0), ('AUDJPY', 'M30', 0), ('AUDJPY', 'H1', 0), ('AUDJPY', 'H2', 0), ('AUDJPY', 'H4', 0), ('AUDJPY', 'H8', 0), ('AUDJPY', 'H12', 0), ('AUDJPY', 'D1', 0),
    ('AUDUSD', 'M5', 0), ('AUDUSD', 'M15', 0), ('AUDUSD', 'M30', 0), ('AUDUSD', 'H1', 0), ('AUDUSD', 'H2', 0), ('AUDUSD', 'H4', 0), ('AUDUSD', 'H8', 0), ('AUDUSD', 'H12', 0), ('AUDUSD', 'D1', 0),
    ('BTCUSD', 'M5', 0), ('BTCUSD', 'M15', 0), ('BTCUSD', 'M30', 0), ('BTCUSD', 'H1', 0), ('BTCUSD', 'H2', 0), ('BTCUSD', 'H4', 0), ('BTCUSD', 'H8', 0), ('BTCUSD', 'H12', 0), ('BTCUSD', 'D1', 0),
    ('ETHUSD', 'M5', 0), ('ETHUSD', 'M15', 0), ('ETHUSD', 'M30', 0), ('ETHUSD', 'H1', 0), ('ETHUSD', 'H2', 0), ('ETHUSD', 'H4', 0), ('ETHUSD', 'H8', 0), ('ETHUSD', 'H12', 0), ('ETHUSD', 'D1', 0),
    ('EURUSD', 'M5', 0), ('EURUSD', 'M15', 0), ('EURUSD', 'M30', 0), ('EURUSD', 'H1', 0), ('EURUSD', 'H2', 0), ('EURUSD', 'H4', 0), ('EURUSD', 'H8', 0), ('EURUSD', 'H12', 0), ('EURUSD', 'D1', 0),
    ('GBPJPY', 'M5', 0), ('GBPJPY', 'M15', 0), ('GBPJPY', 'M30', 0), ('GBPJPY', 'H1', 0), ('GBPJPY', 'H2', 0), ('GBPJPY', 'H4', 0), ('GBPJPY', 'H8', 0), ('GBPJPY', 'H12', 0), ('GBPJPY', 'D1', 0),
    ('GBPUSD', 'M5', 0), ('GBPUSD', 'M15', 0), ('GBPUSD', 'M30', 0), ('GBPUSD', 'H1', 0), ('GBPUSD', 'H2', 0), ('GBPUSD', 'H4', 0), ('GBPUSD', 'H8', 0), ('GBPUSD', 'H12', 0), ('GBPUSD', 'D1', 0),
    ('NDX100', 'M5', 0), ('NDX100', 'M15', 0), ('NDX100', 'M30', 0), ('NDX100', 'H1', 0), ('NDX100', 'H2', 0), ('NDX100', 'H4', 0), ('NDX100', 'H8', 0), ('NDX100', 'H12', 0), ('NDX100', 'D1', 0),
    ('NZDUSD', 'M5', 0), ('NZDUSD', 'M15', 0), ('NZDUSD', 'M30', 0), ('NZDUSD', 'H1', 0), ('NZDUSD', 'H2', 0), ('NZDUSD', 'H4', 0), ('NZDUSD', 'H8', 0), ('NZDUSD', 'H12', 0), ('NZDUSD', 'D1', 0),
    ('US30', 'M5', 0), ('US30', 'M15', 0), ('US30', 'M30', 0), ('US30', 'H1', 0), ('US30', 'H2', 0), ('US30', 'H4', 0), ('US30', 'H8', 0), ('US30', 'H12', 0), ('US30', 'D1', 0),
    ('USDCAD', 'M5', 0), ('USDCAD', 'M15', 0), ('USDCAD', 'M30', 0), ('USDCAD', 'H1', 0), ('USDCAD', 'H2', 0), ('USDCAD', 'H4', 0), ('USDCAD', 'H8', 0), ('USDCAD', 'H12', 0), ('USDCAD', 'D1', 0),
    ('USDCHF', 'M5', 0), ('USDCHF', 'M15', 0), ('USDCHF', 'M30', 0), ('USDCHF', 'H1', 0), ('USDCHF', 'H2', 0), ('USDCHF', 'H4', 0), ('USDCHF', 'H8', 0), ('USDCHF', 'H12', 0), ('USDCHF', 'D1', 0),
    ('USDJPY', 'M5', 0), ('USDJPY', 'M15', 0), ('USDJPY', 'M30', 0), ('USDJPY', 'H1', 0), ('USDJPY', 'H2', 0), ('USDJPY', 'H4', 0), ('USDJPY', 'H8', 0), ('USDJPY', 'H12', 0), ('USDJPY', 'D1', 0),
    ('XAGUSD', 'M5', 0), ('XAGUSD', 'M15', 0), ('XAGUSD', 'M30', 0), ('XAGUSD', 'H1', 0), ('XAGUSD', 'H2', 0), ('XAGUSD', 'H4', 0), ('XAGUSD', 'H8', 0), ('XAGUSD', 'H12', 0), ('XAGUSD', 'D1', 0),
    ('XAUUSD', 'M5', 0), ('XAUUSD', 'M15', 0), ('XAUUSD', 'M30', 0), ('XAUUSD', 'H1', 0), ('XAUUSD', 'H2', 0), ('XAUUSD', 'H4', 0), ('XAUUSD', 'H8', 0), ('XAUUSD', 'H12', 0), ('XAUUSD', 'D1', 0)
ON CONFLICT (symbol, timeframe) DO NOTHING;
