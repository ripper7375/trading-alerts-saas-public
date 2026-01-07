-- Insert test data for EURUSD H1
INSERT INTO eurusd_h1 (timestamp, open, high, low, close, fractals, horizontal_trendlines, diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
VALUES 
  ('2026-01-07 10:00:00+00', 1.0850, 1.0860, 1.0845, 1.0855, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":1.0870,"lower":1.0830}'::jsonb, 1.0850, 1.0852, 1.0848, '[]'::jsonb),
  ('2026-01-07 11:00:00+00', 1.0855, 1.0865, 1.0850, 1.0860, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":1.0875,"lower":1.0835}'::jsonb, 1.0855, 1.0857, 1.0853, '[]'::jsonb),
  ('2026-01-07 12:00:00+00', 1.0860, 1.0870, 1.0855, 1.0865, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":1.0880,"lower":1.0840}'::jsonb, 1.0860, 1.0862, 1.0858, '[]'::jsonb),
  ('2026-01-07 13:00:00+00', 1.0865, 1.0875, 1.0860, 1.0870, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":1.0885,"lower":1.0845}'::jsonb, 1.0865, 1.0867, 1.0863, '[]'::jsonb);

-- Insert test data for BTCUSD M5
INSERT INTO btcusd_m5 (timestamp, open, high, low, close, fractals, horizontal_trendlines, diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
VALUES 
  ('2026-01-07 14:00:00+00', 42000, 42100, 41900, 42050, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":42200,"lower":41800}'::jsonb, 42000, 42010, 41990, '[]'::jsonb),
  ('2026-01-07 14:05:00+00', 42050, 42150, 41950, 42100, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '{"upper":42250,"lower":41850}'::jsonb, 42050, 42060, 42040, '[]'::jsonb);
