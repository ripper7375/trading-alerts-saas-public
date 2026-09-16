-- ============================================================================
-- One-off SQLite migration: add the 14th indicator's 8 columns to market_data
-- Target: xauusd.db on the VPS (C:/Scripts/database/xauusd.db by default)
-- Added 2026-09-16 alongside SupportAndResistantAutoCalibration_v2_29.
-- ============================================================================
--
-- WHY THIS FILE EXISTS
-- --------------------
-- sqlite_schema_v6_xauusd.sql is re-run by open_db() on every collector start,
-- but every CREATE in it is `IF NOT EXISTS`, which is a silent no-op against a
-- database that already has the table. So adding 8 columns to the market_data
-- DDL does NOT widen an existing xauusd.db. And migrate_raw_tables() is, by
-- its own docstring, staging-only.
--
-- Without the columns, promote_cycle()'s INSERT names sr_1 and SQLite raises
--   OperationalError: table market_data has no column named sr_1
-- which is uncaught in run_cycle() -- i.e. the collector crash-loops on the
-- first validated cycle after deployment.
--
-- BELT AND BRACES
-- ---------------
-- The collector now also carries migrate_market_data(), which performs exactly
-- these ALTERs automatically, derived from the SOURCES registry, on every
-- start. That is the braces. This file is the belt: run it by hand BEFORE
-- starting the updated collector if you would rather widen the database as an
-- explicit, reviewable step than have the service do it on boot.
--
-- Running both is safe in either order. If the collector has already widened
-- the table, every statement below fails with "duplicate column name" and
-- changes nothing -- SQLite has no ADD COLUMN IF NOT EXISTS, so re-running is
-- idempotent only by inspection, not by syntax. A duplicate-column error here
-- means the work was already done; it is not a fault.
--
-- ADD COLUMN on a nullable column with no default is a catalog-only change in
-- SQLite: existing rows are not rewritten and no data is at risk. Nothing here
-- drops, renames or backfills.
--
-- USAGE
-- -----
--   sqlite3 C:/Scripts/database/xauusd.db < migrate_sqlite_add_sr_columns.sql
--
-- Verify afterwards (expect 95):
--   sqlite3 C:/Scripts/database/xauusd.db "SELECT COUNT(*) FROM pragma_table_info('market_data');"
-- ============================================================================

-- sr_1..sr_4: nearest supports BELOW each bar's close (sr_1 closest)
ALTER TABLE market_data ADD COLUMN sr_1 REAL;
ALTER TABLE market_data ADD COLUMN sr_2 REAL;
ALTER TABLE market_data ADD COLUMN sr_3 REAL;
ALTER TABLE market_data ADD COLUMN sr_4 REAL;

-- sr_5..sr_8: nearest resistances ABOVE each bar's close (sr_5 closest)
ALTER TABLE market_data ADD COLUMN sr_5 REAL;
ALTER TABLE market_data ADD COLUMN sr_6 REAL;
ALTER TABLE market_data ADD COLUMN sr_7 REAL;
ALTER TABLE market_data ADD COLUMN sr_8 REAL;

-- The cross-source validation view gains an sr_levels branch. Dropping it here
-- is optional -- the schema file now DROPs and recreates it on every collector
-- start -- but doing it now keeps a hand-migrated database self-consistent
-- before the service comes up. A view holds no data.
DROP VIEW IF EXISTS v_validation_keys;
