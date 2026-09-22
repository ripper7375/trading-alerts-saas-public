-- ============================================================
-- Migration: 20260922000000_add_market_data_v6_sr2_levels
--
-- Onboards the 15th MQL5 indicator, S-R-AutoCalibration_v2_29, into the
-- backend-stack-c v6 pipeline. It is a replica of the 14th
-- (SupportAndResistantAutoCalibration_v2_29, migration
-- 20260916000000_add_market_data_v6_sr_levels): the same Freedman-Diaconis IQR
-- clustering, run as a second, independently anchored calibration window, and
-- exported per bar relative to that bar's own close:
--   sr_9..sr_12  = nearest supports    BELOW close (sr_9 closest)
--   sr_13..sr_16 = nearest resistances ABOVE close (sr_13 closest)
-- A slot that resolved no level is NULL, never 0 -- the collector's
-- PRICE_LEVEL_COLUMNS guard coerces the indicator's 0.0 sentinel to NULL
-- before it is ever staged.
--
-- TWO TABLES, eight columns each:
--
--   market_data_v6             the live, upserted table. Contract 95 -> 103.
--   market_data_point_in_time  the append-only snapshot lane (69 -> 77). The
--                              14th indicator's sr_1..sr_8 are snapshotted
--                              because ArrayLevels is resolved once and then
--                              re-bucketed against every exported bar -- a
--                              look-ahead. The 15th inherits that code, so it
--                              inherits the look-ahead; leaving it out would
--                              give one of the two S&R lanes no honest history.
--
-- The DDL below is byte-identical to `prisma migrate diff` between the previous
-- and current prisma/market-data/schema.prisma (column order included -- Prisma
-- emits them alphabetically). Nothing else differed, which is also the proof
-- that the accompanying comment-only edits to both schemas carry no DDL.
--
-- NO indicator_statistics change: the 15th indicator's statistic file is
-- ingested as source 'sr2_levels', but `source` is a plain TEXT column and the
-- ten sr_* calibration columns already exist (20260920000000). The CLOSED enum
-- lives in the gateway contract/DTO only, and widens to 12 in the same release.
--
-- PURELY ADDITIVE -- sixteen NULLABLE columns, no default, no rename, no
-- backfill, nothing else touched. ADD COLUMN without a default is a
-- catalog-only change in PostgreSQL, so no existing row is rewritten. Rows
-- written before this lands simply read NULL, i.e. "no level resolved" -- the
-- same reading as a live unresolved slot.
--
-- ============================================================
-- ROLLOUT ORDER -- the same order as the 14th indicator, for the same reasons.
--
-- APPLY THIS MIGRATION FIRST, BEFORE railway-gateway DEPLOYS. railway-gateway
-- auto-deploys on push to main.
--
--   * market_data: the contract sets "additionalProperties": false and the
--     NestJS pipe sets forbidNonWhitelisted: true, so sr_9..sr_16 posted to an
--     un-updated gateway 400 on EVERY row, and the push worker quarantines each
--     one to rejected_rows.jsonl AND stamps synced_at -- recoverable only by
--     hand via replay_quarantine.py.
--   * indicator statistics: the `source` enum is CLOSED and the POST is
--     BATCHED, so one 'sr2_levels' element sent to an un-updated gateway 400s
--     the whole batch and quarantines all twelve sources' snapshots with it.
--   * point-in-time: a gateway whose SNAPSHOT_COLUMNS names sr_9..sr_16 against
--     a database without them fails every snapshot insert. Contained (the
--     write is wrapped and cannot fail the market_data upsert) but every bar it
--     misses is gone for good -- the honest value exists only once.
--
-- The reverse order is harmless by comparison: a gateway whose DTO has the
-- columns but whose database does not fails the Prisma upsert with a 5xx and
-- the worker retries until this lands.
--
-- So: (1) this migration -> (2) railway-gateway deploy -> (3) only then the
-- VPS (updated collector + push worker, which widen xauusd.db themselves on
-- start) -> (4) attach the .ex5 to XAUUSD M5 + M15.
-- ============================================================
--
-- This migration has been authored, NOT applied, per this repo's standing rule
-- that the Executor never applies a schema migration to a live database --
-- left for Davin's own review/apply step. NOTE `prisma migrate deploy` applies
-- EVERY pending migration in history order, not just this one -- run
-- `prisma migrate status` first and confirm this is the only one pending.
-- ============================================================

-- AlterTable
ALTER TABLE "market_data_v6" ADD COLUMN     "sr_10" DOUBLE PRECISION,
ADD COLUMN     "sr_11" DOUBLE PRECISION,
ADD COLUMN     "sr_12" DOUBLE PRECISION,
ADD COLUMN     "sr_13" DOUBLE PRECISION,
ADD COLUMN     "sr_14" DOUBLE PRECISION,
ADD COLUMN     "sr_15" DOUBLE PRECISION,
ADD COLUMN     "sr_16" DOUBLE PRECISION,
ADD COLUMN     "sr_9" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "market_data_point_in_time" ADD COLUMN     "sr_10" DOUBLE PRECISION,
ADD COLUMN     "sr_11" DOUBLE PRECISION,
ADD COLUMN     "sr_12" DOUBLE PRECISION,
ADD COLUMN     "sr_13" DOUBLE PRECISION,
ADD COLUMN     "sr_14" DOUBLE PRECISION,
ADD COLUMN     "sr_15" DOUBLE PRECISION,
ADD COLUMN     "sr_16" DOUBLE PRECISION,
ADD COLUMN     "sr_9" DOUBLE PRECISION;
