-- docker/init-db.sql
-- This script runs automatically when PostgreSQL container starts for the first time
-- Creates TimescaleDB extension and sets up hypertables

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create trading_data table with 57 columns
CREATE TABLE IF NOT EXISTS eurusd (
    -- System columns (8)
    timestamp BIGINT NOT NULL,
    open NUMERIC(10, 5) NOT NULL,
    high NUMERIC(10, 5) NOT NULL,
    low NUMERIC(10, 5) NOT NULL,
    close NUMERIC(10, 5) NOT NULL,
    volume INTEGER,
    timeframe VARCHAR(10) NOT NULL,
    collected_at BIGINT,
    
    -- Indicator #1: Moving Averages (3) - PRO ONLY
    tema NUMERIC(10, 5),
    hrma NUMERIC(10, 5),
    smma NUMERIC(10, 5),
    
    -- Indicator #2: Body Size Momentum (2) - PRO ONLY
    "Z-Score of body size" NUMERIC(10, 5),
    "Candle classification" INTEGER,
    
    -- Indicator #3: Fractal Diagonal Lines (8) - FREE + PRO
    diag_asc_line_1 NUMERIC(10, 5),
    diag_asc_line_2 NUMERIC(10, 5),
    diag_asc_line_3 NUMERIC(10, 5),
    diag_desc_line_1 NUMERIC(10, 5),
    diag_desc_line_2 NUMERIC(10, 5),
    diag_desc_line_3 NUMERIC(10, 5),
    diag_high_map NUMERIC(10, 5),
    diag_low_map NUMERIC(10, 5),
    
    -- Indicator #4: Fractal Horizontal Lines (8) - FREE + PRO
    horiz_peak_line_1 NUMERIC(10, 5),
    horiz_peak_line_2 NUMERIC(10, 5),
    horiz_peak_line_3 NUMERIC(10, 5),
    horiz_bottom_line_1 NUMERIC(10, 5),
    horiz_bottom_line_2 NUMERIC(10, 5),
    horiz_bottom_line_3 NUMERIC(10, 5),
    horiz_high_map NUMERIC(10, 5),
    horiz_low_map NUMERIC(10, 5),
    
    -- Indicator #5: Heiken Ashi (7) - PRO ONLY
    ha_open NUMERIC(10, 5),
    ha_high NUMERIC(10, 5),
    ha_low NUMERIC(10, 5),
    ha_close NUMERIC(10, 5),
    ha_classification INTEGER,
    ha_body_size NUMERIC(10, 5),
    ha_body_zscore NUMERIC(10, 5),
    
    -- Indicator #6: Keltner Channel (10) - PRO ONLY
    kc_ultra_extreme_upper NUMERIC(10, 5),
    kc_extreme_upper NUMERIC(10, 5),
    kc_uppermost NUMERIC(10, 5),
    kc_upper NUMERIC(10, 5),
    kc_upper_middle NUMERIC(10, 5),
    kc_lower_middle NUMERIC(10, 5),
    kc_lower NUMERIC(10, 5),
    kc_lowermost NUMERIC(10, 5),
    kc_extreme_lower NUMERIC(10, 5),
    kc_ultra_extreme_lower NUMERIC(10, 5),
    
    -- Indicator #7: Support/Resistance (8) - PRO ONLY
    sr_support_4 NUMERIC(10, 5),
    sr_support_3 NUMERIC(10, 5),
    sr_support_2 NUMERIC(10, 5),
    sr_support_1 NUMERIC(10, 5),
    sr_resistance_1 NUMERIC(10, 5),
    sr_resistance_2 NUMERIC(10, 5),
    sr_resistance_3 NUMERIC(10, 5),
    sr_resistance_4 NUMERIC(10, 5),
    
    -- Indicator #8: ZigZag (3) - PRO ONLY
    zigzag_peak NUMERIC(10, 5),
    zigzag_bottom NUMERIC(10, 5),
    ema_26 NUMERIC(10, 5),
    
    -- Primary Key
    PRIMARY KEY (timestamp, timeframe)
);

-- Convert to TimescaleDB hypertable (optimized for time-series data)
SELECT create_hypertable('eurusd', 'timestamp', if_not_exists => TRUE);

-- Create index for fast queries by timeframe
CREATE INDEX IF NOT EXISTS idx_eurusd_timeframe_timestamp 
ON eurusd (timeframe, timestamp DESC);

-- Enable compression for older data (optional, saves storage)
ALTER TABLE eurusd SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'timeframe'
);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('eurusd', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (keep data for 1 year, then auto-delete)
SELECT add_retention_policy('eurusd', INTERVAL '1 year', if_not_exists => TRUE);

-- Grant permissions (if needed)
-- GRANT ALL PRIVILEGES ON TABLE eurusd TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'TimescaleDB initialized successfully!';
    RAISE NOTICE 'Table: eurusd with 57 columns created';
    RAISE NOTICE 'Hypertable: enabled for time-series optimization';
    RAISE NOTICE 'Compression: enabled for data older than 7 days';
    RAISE NOTICE 'Retention: data kept for 1 year';
END $$;
