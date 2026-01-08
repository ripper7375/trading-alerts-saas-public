-- Seed Staging Data Script (CORRECTED)
-- Purpose: Insert minimal test data to verify Part 20 migration
-- Symbols: EURUSD, BTCUSD, USDJPY (all H1 timeframe)
-- Generated: 2026-01-08
-- Note: Removed 'volume' column as it doesn't exist in indicator tables

-- ================================================
-- EURUSD H1 - Sample OHLC Data (4 candles)
-- ================================================
INSERT INTO eurusd_h1 (timestamp, open, high, low, close)
VALUES
  (CURRENT_TIMESTAMP - INTERVAL '3 hours', 1.0850, 1.0855, 1.0845, 1.0852),
  (CURRENT_TIMESTAMP - INTERVAL '2 hours', 1.0852, 1.0858, 1.0850, 1.0856),
  (CURRENT_TIMESTAMP - INTERVAL '1 hour', 1.0856, 1.0860, 1.0854, 1.0859),
  (CURRENT_TIMESTAMP, 1.0859, 1.0865, 1.0857, 1.0862)
ON CONFLICT (timestamp) DO NOTHING;

-- ================================================
-- BTCUSD H1 - Sample OHLC Data (4 candles)
-- ================================================
INSERT INTO btcusd_h1 (timestamp, open, high, low, close)
VALUES
  (CURRENT_TIMESTAMP - INTERVAL '3 hours', 45000.00, 45100.00, 44950.00, 45050.00),
  (CURRENT_TIMESTAMP - INTERVAL '2 hours', 45050.00, 45150.00, 45000.00, 45100.00),
  (CURRENT_TIMESTAMP - INTERVAL '1 hour', 45100.00, 45200.00, 45050.00, 45150.00),
  (CURRENT_TIMESTAMP, 45150.00, 45250.00, 45100.00, 45200.00)
ON CONFLICT (timestamp) DO NOTHING;

-- ================================================
-- USDJPY H1 - Sample OHLC Data (4 candles)
-- ================================================
INSERT INTO usdjpy_h1 (timestamp, open, high, low, close)
VALUES
  (CURRENT_TIMESTAMP - INTERVAL '3 hours', 148.50, 148.60, 148.40, 148.55),
  (CURRENT_TIMESTAMP - INTERVAL '2 hours', 148.55, 148.65, 148.50, 148.60),
  (CURRENT_TIMESTAMP - INTERVAL '1 hour', 148.60, 148.70, 148.55, 148.65),
  (CURRENT_TIMESTAMP, 148.65, 148.75, 148.60, 148.70)
ON CONFLICT (timestamp) DO NOTHING;

-- ================================================
-- Verification Query
-- ================================================
SELECT 
  'Sample data inserted successfully' as status,
  (SELECT COUNT(*) FROM eurusd_h1) as eurusd_count,
  (SELECT COUNT(*) FROM btcusd_h1) as btcusd_count,
  (SELECT COUNT(*) FROM usdjpy_h1) as usdjpy_count;
