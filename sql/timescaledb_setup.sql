-- ============================================================================
-- TimescaleDB Configuration for Trading Alerts SaaS
-- Part 20: SQLite + Sync to PostgreSQL Architecture
--
-- Purpose: Configure hypertables, retention policies, and compression
-- Run after: postgresql_schema.sql
-- ============================================================================

-- ============================================================================
-- HYPERTABLE CONVERSION
-- Convert all 135 tables to TimescaleDB hypertables
-- ============================================================================

-- AUDJPY hypertables
SELECT create_hypertable('audjpy_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audjpy_d1', 'timestamp', if_not_exists => TRUE);

-- AUDUSD hypertables
SELECT create_hypertable('audusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('audusd_d1', 'timestamp', if_not_exists => TRUE);

-- BTCUSD hypertables
SELECT create_hypertable('btcusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('btcusd_d1', 'timestamp', if_not_exists => TRUE);

-- ETHUSD hypertables
SELECT create_hypertable('ethusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ethusd_d1', 'timestamp', if_not_exists => TRUE);

-- EURUSD hypertables
SELECT create_hypertable('eurusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('eurusd_d1', 'timestamp', if_not_exists => TRUE);

-- GBPJPY hypertables
SELECT create_hypertable('gbpjpy_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpjpy_d1', 'timestamp', if_not_exists => TRUE);

-- GBPUSD hypertables
SELECT create_hypertable('gbpusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('gbpusd_d1', 'timestamp', if_not_exists => TRUE);

-- NDX100 hypertables
SELECT create_hypertable('ndx100_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('ndx100_d1', 'timestamp', if_not_exists => TRUE);

-- NZDUSD hypertables
SELECT create_hypertable('nzdusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('nzdusd_d1', 'timestamp', if_not_exists => TRUE);

-- US30 hypertables
SELECT create_hypertable('us30_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('us30_d1', 'timestamp', if_not_exists => TRUE);

-- USDCAD hypertables
SELECT create_hypertable('usdcad_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdcad_d1', 'timestamp', if_not_exists => TRUE);

-- USDCHF hypertables
SELECT create_hypertable('usdchf_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdchf_d1', 'timestamp', if_not_exists => TRUE);

-- USDJPY hypertables
SELECT create_hypertable('usdjpy_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('usdjpy_d1', 'timestamp', if_not_exists => TRUE);

-- XAGUSD hypertables
SELECT create_hypertable('xagusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xagusd_d1', 'timestamp', if_not_exists => TRUE);

-- XAUUSD hypertables
SELECT create_hypertable('xauusd_m5', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_m15', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_m30', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_h1', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_h2', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_h4', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_h8', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_h12', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('xauusd_d1', 'timestamp', if_not_exists => TRUE);


-- ============================================================================
-- RETENTION POLICIES
-- Based on 10,000 rows per timeframe:
-- M5:  5 min × 10000 = 50000 min ≈ 35 days
-- M15: 15 min × 10000 = 150000 min ≈ 105 days
-- M30: 30 min × 10000 = 300000 min ≈ 210 days
-- H1:  60 min × 10000 = 600000 min ≈ 417 days
-- H2:  120 min × 10000 = 1200000 min ≈ 834 days
-- H4:  240 min × 10000 = 2400000 min ≈ 1667 days
-- H8:  480 min × 10000 = 4800000 min ≈ 3333 days
-- H12: 720 min × 10000 = 7200000 min ≈ 5000 days
-- D1:  1440 min × 10000 = 14400000 min ≈ 10000 days
-- ============================================================================

-- Helper function to add retention policies for all symbols
DO $$
DECLARE
    symbols TEXT[] := ARRAY['audjpy', 'audusd', 'btcusd', 'ethusd', 'eurusd', 'gbpjpy', 'gbpusd', 'ndx100', 'nzdusd', 'us30', 'usdcad', 'usdchf', 'usdjpy', 'xagusd', 'xauusd'];
    sym TEXT;
BEGIN
    FOREACH sym IN ARRAY symbols
    LOOP
        -- M5: ~35 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_m5'', INTERVAL ''35 days'', if_not_exists => TRUE)', sym);
        -- M15: ~105 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_m15'', INTERVAL ''105 days'', if_not_exists => TRUE)', sym);
        -- M30: ~210 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_m30'', INTERVAL ''210 days'', if_not_exists => TRUE)', sym);
        -- H1: ~417 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_h1'', INTERVAL ''417 days'', if_not_exists => TRUE)', sym);
        -- H2: ~834 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_h2'', INTERVAL ''834 days'', if_not_exists => TRUE)', sym);
        -- H4: ~1667 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_h4'', INTERVAL ''1667 days'', if_not_exists => TRUE)', sym);
        -- H8: ~3333 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_h8'', INTERVAL ''3333 days'', if_not_exists => TRUE)', sym);
        -- H12: ~5000 days retention
        EXECUTE format('SELECT add_retention_policy(''%s_h12'', INTERVAL ''5000 days'', if_not_exists => TRUE)', sym);
        -- D1: ~10000 days retention (essentially forever)
        EXECUTE format('SELECT add_retention_policy(''%s_d1'', INTERVAL ''10000 days'', if_not_exists => TRUE)', sym);
    END LOOP;
END $$;


-- ============================================================================
-- COMPRESSION POLICIES
-- Compress data older than 7 days for storage efficiency
-- ============================================================================

-- Enable compression on all tables
DO $$
DECLARE
    symbols TEXT[] := ARRAY['audjpy', 'audusd', 'btcusd', 'ethusd', 'eurusd', 'gbpjpy', 'gbpusd', 'ndx100', 'nzdusd', 'us30', 'usdcad', 'usdchf', 'usdjpy', 'xagusd', 'xauusd'];
    timeframes TEXT[] := ARRAY['m5', 'm15', 'm30', 'h1', 'h2', 'h4', 'h8', 'h12', 'd1'];
    sym TEXT;
    tf TEXT;
    table_name TEXT;
BEGIN
    FOREACH sym IN ARRAY symbols
    LOOP
        FOREACH tf IN ARRAY timeframes
        LOOP
            table_name := sym || '_' || tf;

            -- Enable compression
            EXECUTE format('ALTER TABLE %I SET (timescaledb.compress, timescaledb.compress_segmentby = '''')', table_name);

            -- Add compression policy (compress after 7 days)
            EXECUTE format('SELECT add_compression_policy(''%s'', INTERVAL ''7 days'', if_not_exists => TRUE)', table_name);
        END LOOP;
    END LOOP;
END $$;


-- ============================================================================
-- DESCENDING TIMESTAMP INDEXES
-- Optimize for common query patterns (ORDER BY timestamp DESC)
-- ============================================================================

-- Create indexes for all tables
DO $$
DECLARE
    symbols TEXT[] := ARRAY['audjpy', 'audusd', 'btcusd', 'ethusd', 'eurusd', 'gbpjpy', 'gbpusd', 'ndx100', 'nzdusd', 'us30', 'usdcad', 'usdchf', 'usdjpy', 'xagusd', 'xauusd'];
    timeframes TEXT[] := ARRAY['m5', 'm15', 'm30', 'h1', 'h2', 'h4', 'h8', 'h12', 'd1'];
    sym TEXT;
    tf TEXT;
    table_name TEXT;
    index_name TEXT;
BEGIN
    FOREACH sym IN ARRAY symbols
    LOOP
        FOREACH tf IN ARRAY timeframes
        LOOP
            table_name := sym || '_' || tf;
            index_name := 'idx_' || sym || '_' || tf || '_ts_desc';

            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (timestamp DESC)', index_name, table_name);
        END LOOP;
    END LOOP;
END $$;


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify hypertable count (should be 135)
SELECT COUNT(*) AS hypertable_count
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public';

-- List all hypertables
SELECT hypertable_name, num_dimensions, num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public'
ORDER BY hypertable_name;

-- Verify retention policies
SELECT hypertable_name, schedule_interval
FROM timescaledb_information.jobs j
JOIN timescaledb_information.hypertables h ON j.hypertable_name = h.hypertable_name
WHERE proc_name = 'policy_retention'
ORDER BY hypertable_name;

-- Verify compression policies
SELECT hypertable_name, schedule_interval
FROM timescaledb_information.jobs j
JOIN timescaledb_information.hypertables h ON j.hypertable_name = h.hypertable_name
WHERE proc_name = 'policy_compression'
ORDER BY hypertable_name;
