---
type: Concept/TechnicalTraps
severity: high
updated_at: 2026-09-26
source: "Distilled from CLAUDE.md '## Waiting on' and session logs 2026-09-01..09-26; details in state/history/"
tags: [database, prisma, migrations, railway, postgres]
related_docs:
  - ../state/waiting-on.md
  - ../state/history/resolved-waiting-on.md
  - ./infrastructure.md
---

# Database & migration traps

Read before any schema change, migration, or query against a real database.

## Which database is which (settled 2026-09-09)

- **Production:** Postgres in the Railway project **`trading-alerts`**. Public proxy
  `maglev.proxy.rlwy.net:58290`, private address `postgres.railway.internal`.
- **`.env` / `.env.local` point at a staging clone**, `turntable.proxy.rlwy.net:55082`, in a Railway
  project named "postgre for staging". It is the local dev DB and the migration rehearsal target.
  Do not delete it.
- `maglev`/`turntable` are **shared** Railway proxy hostnames; the **port** identifies the service.
  Never infer ownership from a hostname — read the service's Settings → Networking.
- Vercel `DATABASE_URL` is scoped to **All Environments**, so **preview deployments hit production
  data** (open item). `DIRECT_URL` is Production-only.

## Prisma layout

- Two schema files share **one physical database and one migration history** (`LESSONS-LEARNED.md`
  L24): `prisma/market-data/schema.prisma` and `prisma/non-market-data/schema.prisma`. Models with a
  user reference go in `non-market-data` (real FK to `User`).
- `railway-gateway/prisma/schema.prisma` mirrors market-data models **byte-identically**
  (`railway-gateway/test/schema-sync.spec.ts` diffs them). `operation-service/prisma/schema.prisma`
  is a narrower mirror, `prisma generate` only. `types/prisma-stubs.d.ts` duplicates some model
  interfaces — keep it in sync.
- Market-data conventions: business timestamps are `Int` unix UTC, no `@db.VarChar`.
- `prisma.config.ts` loads `.env.local` with `override: true`, so its `DIRECT_URL` beats any
  `DATABASE_URL` you pass on the command line. Production work uses `prisma.production.config.ts`.
- **`market_data_v6.cycle_id` is the collector cycle that LAST wrote the row**, not the one that first saw the bar:
  `promote_cycle()` rewrites every bar of the 3,000-bar window under each new cycle's id and the gateway's upsert
  overwrites it. RETUNING (ADR-015, Option A) relies on this: a row with a `cycle_id` below the promote cycle's
  `market_cycles.m5_collection_cycle_id` still holds pre-promote values. It also assumes collector ids only grow
  (recreating `xauusd.db` restarts them at 1).

## Applying migrations

- **The Executor never applies a migration to a live database.** Author it, verify it, hand it to Davin.
- **`prisma migrate deploy` applies every pending migration in history order**, not just yours.
  Run `prisma migrate status` first. To apply one migration alone:
  `prisma db execute --file <migration.sql>` then `prisma migrate resolve --applied <name>`.
- Verify hand-written SQL against Prisma's own DDL:
  `prisma migrate diff --from-empty --to-schema <file> --script` (`--to-schema-datamodel` was
  removed in Prisma 7.9.1). When Docker Desktop is up, replay on a throwaway `postgres:16-alpine`.
- **`prisma migrate diff --script` prints two dotenv "injected env" lines on stdout** in this repo, so a redirect into
  a `.sql` file starts with them. Strip them before the output becomes a migration. `--from-url` no longer exists
  (Prisma 7); use `--from-config-datasource` with a Prisma config.
- **Verifying a migration without Docker:** `npx prisma dev --detach --name <x>` starts an embedded Postgres (use the
  direct TCP URL it prints; the port can differ from `--db-port`). Run the SQL with `pg`, then
  `prisma migrate diff --config <scratch config> --from-config-datasource --to-schema <schema> --script --exit-code`
  (0 = no drift, 2 = drift). Stop it with `prisma dev stop <x>` and `prisma dev rm <x>`. Keep the scratch config
  **outside the repo with only that local URL**: `prisma.config.ts` loads `.env.local`, whose `DIRECT_URL` is the staging
  clone. Worked example: [step 2 part 2](../../docs/handoffs/2026-10-02-0010-step2-part2.md).
  The same embedded Postgres runs the gateway's real-database spec (`railway-gateway/test/cycle-readers.pg.spec.ts`, gated on `CYCLE_PG_URL` and `CYCLE_PG_ALLOW_WIPE=yes`): create the tables
  with `prisma migrate diff --from-empty --to-schema railway-gateway/prisma/schema.prisma --script` (strip the two dotenv lines), apply them with `pg`, run the spec, then stop and remove the instance.
  The `prisma dev` TCP URL printed is `postgres://postgres:postgres@localhost:51214/template1` whatever `--port` you pass.
- **Rollout order for market-data columns:** apply the migration **before** `railway-gateway`
  deploys (it auto-deploys from `main`). Its DTOs use `forbidNonWhitelisted`, and the push worker's
  400 handler quarantines a row **and stamps `synced_at`**, so rows sent to an un-migrated gateway
  are lost to automatic retry.

## Ledger ≠ reality (zero-step baseline rows)

Five `_prisma_migrations` rows in production have `applied_steps_count = 0` (marked applied
without executing, Session 2-3 baselining): `20251227000000_init`,
`20260214000000_rag_dual_memory`, `20260224000000_update_kc_ha_body_columns`,
`20260705000000_add_market_data_v6`, `20260705010000_drop_market_data`. **Check each one's
physical objects instead of trusting the row.**

- `rag_dual_memory`'s 6 tables (`mt5_accounts`, `upload_history`, `jsonl_sessions`,
  `behavioral_drift`, `advice_outcomes`, `compliance_audit`) **do not exist**. When Stack D needs
  them: `prisma db execute --file prisma/migrations/20260214000000_rag_dual_memory/migration.sql`
  against production. Do **not** run `migrate resolve` on it again.
- `market_data_v6` was the same trap; it was created by hand on 2026-09-09.

## `db push` drift (schema ahead of migration history)

At least four features were applied with `db push`/manual SQL and never captured in a migration
(`User.profile`, `MarketingAsset` + its enums, 7 tables/2 enums/4 `User` 2FA columns later
backfilled by `20260904110000_backfill_untracked_tables`, and `market_data_v6`). `migrate status`
cannot see this class — it compares only against tracked history. Diff the live schema against
`schema.prisma` directly. The backfill migration is dated before already-applied ones, so
production lists it as pending; applying it is a no-op that records history.

## Credentials

Rotation procedure and its gotchas: `docs/runbooks/rotate-postgres-credentials.md`. Railway
services do not restart when a referenced variable changes — redeploy them.
