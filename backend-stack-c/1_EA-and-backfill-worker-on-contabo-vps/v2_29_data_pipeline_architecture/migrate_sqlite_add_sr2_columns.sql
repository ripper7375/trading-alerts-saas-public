-- ============================================================================
-- One-off SQLite migration: add the 15th indicator's 8 columns to market_data
-- Target: xauusd.db on the VPS (C:/Scripts/database/xauusd.db by default)
-- Added 2026-09-22 alongside S-R-AutoCalibration_v2_29.
-- ============================================================================
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The same gap migrate_sqlite_add_sr_columns.sql closed for the 14th indicator.
-- sqlite_schema_v6_xauusd.sql is re-run by open_db() on every collector start,
-- but every CREATE in it is `IF NOT EXISTS`, a silent no-op against a database
-- that already has the table. So adding sr_9..sr_16 to the market_data DDL does
-- NOT widen an existing xauusd.db.
--
-- Without the columns, promote_cycle()'s INSERT names sr_9 and SQLite raises
--   OperationalError: table market_data has no column named sr_9
-- which is uncaught in run_cycle() -- the collector crash-loops on the first
-- validated cycle after deployment.
--
-- BELT AND BRACES
-- ---------------
-- The collector's migrate_market_data() performs exactly these ALTERs
-- automatically on every start, derived from the SOURCES registry (it needed no
-- change for this indicator -- enrolling 'sr2_levels' in SOURCES is what makes
-- it add these eight). This file is the belt: run it by hand BEFORE starting the
-- updated collector if you would rather widen the database as an explicit,
-- reviewable step than have the service do it on boot.
--
-- The new staging table raw_sr2_levels needs NO step here: it is new, so the
-- schema file's CREATE TABLE IF NOT EXISTS genuinely creates it on the next
-- collector start.
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
-- PREREQUISITE: the 14th indicator's columns (sr_1..sr_8). If this database
-- predates 2026-09-16, run migrate_sqlite_add_sr_columns.sql first, or simply
-- start the updated collector, which adds all sixteen.
--
-- USAGE
-- -----
--   sqlite3 C:/Scripts/database/xauusd.db < migrate_sqlite_add_sr2_columns.sql
--
-- Verify afterwards (expect 103):
--   sqlite3 C:/Scripts/database/xauusd.db "SELECT COUNT(*) FROM pragma_table_info('market_data');"
-- ============================================================================

-- sr_9..sr_12: nearest supports BELOW each bar's close (sr_9 closest)
ALTER TABLE market_data ADD COLUMN sr_9 REAL;
ALTER TABLE market_data ADD COLUMN sr_10 REAL;
ALTER TABLE market_data ADD COLUMN sr_11 REAL;
ALTER TABLE market_data ADD COLUMN sr_12 REAL;

-- sr_13..sr_16: nearest resistances ABOVE each bar's close (sr_13 closest)
ALTER TABLE market_data ADD COLUMN sr_13 REAL;
ALTER TABLE market_data ADD COLUMN sr_14 REAL;
ALTER TABLE market_data ADD COLUMN sr_15 REAL;
ALTER TABLE market_data ADD COLUMN sr_16 REAL;

-- The cross-source validation view gains an sr2_levels branch. Dropping it here
-- is optional -- the schema file DROPs and recreates it on every collector
-- start -- but doing it now keeps a hand-migrated database self-consistent
-- before the service comes up. A view holds no data.
DROP VIEW IF EXISTS v_validation_keys;
