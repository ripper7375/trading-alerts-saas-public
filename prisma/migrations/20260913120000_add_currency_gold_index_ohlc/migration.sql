-- ============================================================
-- Migration: 20260913120000_add_currency_gold_index_ohlc
--
-- Lane 4: index OPEN/HIGH/LOW per M5 bar, for the Currency Index Comparison
-- PRO page's OHLC and Heiken Ashi candles (`value` already is the index CLOSE).
-- Computed by currency_gold_index_engine.py's index_ohlc() per the
-- authoritative *_H1_{Open,High,Low}.mq5 references in
-- davintrade-currency-index-comparison-pro-stack/.
--
-- PURELY ADDITIVE -- three NULLABLE columns on one existing table, no default,
-- no rewrite of existing rows (ADD COLUMN without a default is a catalog-only
-- change in PostgreSQL), nothing else touched. A row pushed before this lands
-- simply has NULL open/high/low, which readers treat as "no OHLC for this bar".
--
-- Deliberately NOT NOT NULL: the gateway contract makes these optional so an
-- engine build that predates index OHLC keeps validating during the rollout
-- (gateway deploys first, engine redeploys after).
--
-- Authored, NOT applied, per this repo's standing rule that the Executor never
-- applies a schema migration to a live database. NOTE `prisma migrate deploy`
-- applies EVERY pending migration in history order -- run
-- `prisma migrate status` first and confirm this is the only one pending.
-- ============================================================

-- AlterTable
ALTER TABLE "currency_gold_indices" ADD COLUMN     "high" DOUBLE PRECISION,
ADD COLUMN     "low" DOUBLE PRECISION,
ADD COLUMN     "open" DOUBLE PRECISION;
