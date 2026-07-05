-- ============================================================
-- Migration: 20260705010000_drop_market_data
--
-- Decommissions the old 63-column "MarketData" model (EA v2.27+: tema,
-- hrma, smma, Keltner Channels, Heiken Ashi, sr_1-8, zigzag_high/low,
-- pinbar, fractal diag/horiz lines). Confirmed unused by any live app/api
-- route before dropping (only referenced by tests and this project's own
-- seed helpers' doc comments, both already updated in the same change).
--
-- market_data_v6 (added in 20260705000000_add_market_data_v6) is NOT a
-- migration of this table's data — it's a separate table for a different
-- indicator methodology (backend-stack-c's v6 pipeline). No data is carried
-- forward from "MarketData" by this migration; if the old table has any
-- real rows in a deployed database, back it up before applying this if
-- retaining that history matters.
-- ============================================================

DROP TABLE IF EXISTS "MarketData";
