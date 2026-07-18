# Migration Order — Locate and migrate market_data_v6 (F3 gap)

> `TEMPLATE-INFRA.md` variant — this session provisions/configures a live system (Postgres schema and data migration). Read `00-SKELETON-AND-RULES.md` §4 first. **Creativity dial: Low** (the goal is an exact 1:1 copy of the `market_data_v6` database into the `maglev` instance).
> **Status: DRAFT** — drafted by the Advisor (Claude Cowork) to resolve the F3 scope gap discovered in Session 1-1.

**Session:** 1-2b · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:** INFRA
· **Status:** DRAFT · **Generated:** 2026-07-18 · **Flags touched:** F3 (finalizes database locations) · **Estimated time:** 30-45m

## Context

- **The F3 Gap from 1-1:** Session 1-1 confirmed the monolith's database is on Railway (`maglev`). However, it also confirmed that `market_data_v6` does NOT exist there. `railway-gateway` is writing to a different, currently unlocated Postgres instance.
- **The Plan §3 target:** We need **ONE** Railway PostgreSQL instance hosting **both** domains so we can set up roles in Session 1-3.
- **Playbook scope:** This is an ADHOC session inserted into the playbook to locate the missing database, dump its schema and data, and restore it into the unified `maglev` instance. After the restore, we repoint `railway-gateway` to use the unified instance.

## Entry criteria

- [ ] Railway CLI access to the `trading-alerts` project (where `maglev` lives).
- [ ] Davin has provided the `DATABASE_URL` currently used by `railway-gateway` in production (this might require checking the Vercel/Railway project that hosts `railway-gateway`).

## Ordered steps

_(each step = change → immediate verification → rollback note; stage before production)_

1. **Locate the source:** Extract the host, port, and credentials from the `railway-gateway` `DATABASE_URL`. Connect to it (via `psql` or Prisma studio) to verify it actually contains the `market_data_v6` schema and data.
   _Verify:_ Confirmed non-empty `MarketDataV6` tables.
   _Rollback:_ N/A.
2. **Dump the source:** Perform a `pg_dump` of the `market_data_v6` schema and its data from the source database to a local file.
   _Verify:_ Dump file size is > 0 and contains `CREATE TABLE` and `COPY` statements.
   _Rollback:_ Delete local dump file.
3. **Restore to unified target:** Perform a `pg_restore` (or `psql < dump.sql`) to import the `market_data_v6` data into the `trading-alerts` `maglev` database.
   _Verify:_ Connect to `maglev`, confirm `market_data_v6` schema and row counts exactly match the source.
   _Rollback:_ `DROP SCHEMA market_data_v6 CASCADE;` on the target.
4. **Repoint railway-gateway:** Update the `DATABASE_URL` environment variable for `railway-gateway` in its production environment to point to `maglev`.
   _Verify:_ Monitor `railway-gateway` logs to ensure ingest continues without errors. Run a quick query on `maglev` to ensure new records are arriving.
   _Rollback:_ Revert `DATABASE_URL` to the old source.

## Rules specific to this variant

- **Nothing dashboard-only.** Document the `pg_dump` and restore commands used in the Deviations/Lessons learned if they differ from standard.
- **Never break the always-on paths:** The `railway-gateway` ingest might drop a few records during the `DATABASE_URL` swap. This is acceptable for market data if it's brief, but coordinate the swap timing with Davin.
- Secrets: No connection strings in git. Use `.env.local` or environment variables for the migration execution.

## Done when

- [ ] `market_data_v6` exists on the `maglev` database.
- [ ] Row counts match the original source.
- [ ] `railway-gateway` is successfully writing new data to the `maglev` database.

## Rollback

The restore is reversible by dropping the newly imported schema/tables from `maglev`. Repointing the gateway is reversible by changing its `DATABASE_URL` back.

## Deviations

_(filled during execution)_

## Next-session handoff

The PRE-DRAFT for Session 1-3 already exists (`docs/migration-orders/1-3-roles-pgbouncer.migration-order.md`), but its Entry Criteria is blocked waiting for this session to complete. Once this session closes, 1-3 will be unblocked.
