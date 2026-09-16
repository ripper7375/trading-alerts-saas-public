-- ============================================================
-- Migration: 20260916000000_add_market_data_v6_sr_levels
--
-- Onboards the 14th MQL5 indicator, SupportAndResistantAutoCalibration_v2_29,
-- into the backend-stack-c v6 pipeline (see that stack's
-- ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md and
-- DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md). It resolves up to 8 macro
-- support/resistance levels by Freedman-Diaconis IQR clustering and exports
-- them per bar, relative to that bar's own close:
--   sr_1..sr_4 = nearest supports    BELOW close (sr_1 closest)
--   sr_5..sr_8 = nearest resistances ABOVE close (sr_5 closest)
-- A slot that resolved no level is NULL, never 0 -- a $0.00 "price" is not a
-- valid XAUUSD level, and the collector's PRICE_LEVEL_COLUMNS guard coerces
-- the indicator's 0.0 sentinel to NULL before it is ever staged.
--
-- gateway_contract_market_data.schema.json grew from 87 to 95 fields to match,
-- as did the SQLite market_data table, the push worker's
-- EXPECTED_CONTRACT_FIELDS, both Prisma mirrors and the generated
-- MarketDataDto.
--
-- PURELY ADDITIVE -- eight NULLABLE columns on one existing table, no default,
-- no rename, no backfill, nothing else touched. ADD COLUMN without a default
-- is a catalog-only change in PostgreSQL, so no existing row is rewritten.
-- Rows written before this lands simply have NULL sr_*, which readers treat as
-- "no level resolved for this bar" -- the same reading as a live unresolved
-- slot, so there is no need to distinguish them.
--
-- Deliberately NOT NOT NULL: the gateway contract makes every indicator field
-- optional and nullable, and an unresolved slot is a normal, frequent state.
--
-- ============================================================
-- ROLLOUT ORDER -- this one matters, and getting it wrong loses data.
--
-- APPLY THIS MIGRATION FIRST, BEFORE railway-gateway DEPLOYS. railway-gateway
-- auto-deploys on push to main.
--
-- The contract sets "additionalProperties": false and the NestJS global pipe
-- sets forbidNonWhitelisted: true, so an sr_* field posted to a gateway that
-- has not been updated is a 400 on EVERY row. The push worker's 400 handler is
-- a poison-row guard: it quarantines the row to rejected_rows.jsonl AND stamps
-- synced_at, so those rows are permanently marked synced and are recoverable
-- only by hand via replay_quarantine.py.
--
-- The reverse order is harmless by comparison: a gateway that has the columns
-- in its DTO but not in PostgreSQL fails the Prisma upsert, returns 5xx, and
-- the worker simply retries until this migration lands.
--
-- So: (1) this migration -> (2) railway-gateway deploy -> (3) only then the
-- VPS (SQLite ALTER + updated collector + updated push worker).
-- ============================================================
--
-- This migration has been authored, NOT applied, per this repo's standing rule
-- that the Executor never applies a schema migration to a live database --
-- left for Davin's own review/apply step. NOTE `prisma migrate deploy` applies
-- EVERY pending migration in history order, not just this one -- run
-- `prisma migrate status` first and confirm this is the only one pending.
-- ============================================================

-- AddColumn (sr_1..sr_4: nearest supports below close, sr_1 closest)
ALTER TABLE "market_data_v6" ADD COLUMN     "sr_1" DOUBLE PRECISION,
ADD COLUMN     "sr_2" DOUBLE PRECISION,
ADD COLUMN     "sr_3" DOUBLE PRECISION,
ADD COLUMN     "sr_4" DOUBLE PRECISION,
-- (sr_5..sr_8: nearest resistances above close, sr_5 closest)
ADD COLUMN     "sr_5" DOUBLE PRECISION,
ADD COLUMN     "sr_6" DOUBLE PRECISION,
ADD COLUMN     "sr_7" DOUBLE PRECISION,
ADD COLUMN     "sr_8" DOUBLE PRECISION;
