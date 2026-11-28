---
type: Concept/TechnicalTraps
status: active
severity: high
updated_at: 2026-11-28
source: 'Distilled from DB/migration traps 2026-09-01..10-24; full details in details/database-traps-archive.md'
tags: [database, prisma, migrations, railway, postgres]
related_docs:
  - ./details/database-traps-archive.md
  - ../state/waiting-on.md
  - ../state/history/resolved-waiting-on.md
  - ./infrastructure.md
---

# Database & migration traps (Quick Reference)

Read before any schema change, migration, or real-DB query. Full SQL, CHECKs, and scratch cluster recipes live in
[details/database-traps-archive.md](./details/database-traps-archive.md) (use `Grep`, do not bulk-read).

## Which database is which (settled 2026-09-09)

- **Production:** Railway project `trading-alerts` (`<PROD_DB>`, private `postgres.railway.internal`).
- **Dev / Staging (`.env.local`):** `davintrade-dev-db` (`<STAGING_DB>`) — local dev & migration rehearsal target (all 42/42 migrations applied 2026-11-28); `.env` `DATABASE_URL` points elsewhere (unread).
- `maglev`/`turntable` are shared Railway proxy hostnames; identify the service by **port** (Settings → Networking).
- **Vercel env scopes (verified 2026-11-28, replacing the stale 2026-09-09 note):** both `DATABASE_URL` and `DIRECT_URL`
  are split into separate `Production`, `Preview`, and `Development` Secret entries (`Added`/`Updated Oct 31` on
  `trading-alerts-saas-frontend`). Preview `DATABASE_URL` points to `davintrade-dev-db` (`<STAGING_DB>`), confirmed
  by 2026-11-28 Preview logs and PR #543 tests, not `<PROD_DB>`. `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` is `Production`-only
  (`Added Aug 3`, Secret; unset on Preview/Development).
- **Laptop scripts:** pass `DATABASE_PUBLIC_URL` as `DATABASE_URL` instead of `railway run` (`postgres.railway.internal` is unreachable).

## Prisma layout

- **Two schemas, one DB & migration history:** `prisma/market-data/schema.prisma` and `prisma/non-market-data/schema.prisma`
  (models with FK to `User` go in `non-market-data`). `prisma.config.ts` loads `.env.local` (`override: true`); production uses `prisma.production.config.ts`.
- **Mirrors:** `railway-gateway/prisma/schema.prisma` mirrors market-data byte-identically (`schema-sync.spec.ts`);
  `money-service/prisma/schema.prisma` mirrors `Subscription`, `User`, `Commission`, `ProcessedWebhookEvent` by hand;
  `operation-service/prisma/schema.prisma` is a narrow mirror; `types/prisma-stubs.d.ts` duplicates select interfaces.
- **Explicit `select` guards:** whole-row `User` or `Subscription` reads fail until new-column migrations apply first;
  `lib/auth/*`, `operation-service/src/auth/*`, and `marketDataV6` reads under `app/`, `lib/`, `operation-service/src/` enforce explicit `select` via guard tests.
- **Market-data keys:** timestamps (`timestamp`, `cycle_slot`, `event_time`, `captured_at`) are 32-bit unix UTC `Int` (bar OPEN time; closed when `timestamp + period <= slot`; max `2147483647`).
  `market_data_v6.cycle_id` holds the LAST cycle that wrote the row (`promote_cycle()` rewrites the 3,000-bar window).

## Applying migrations

- **Executor never applies live migrations.** Author, verify on scratch Postgres 18 (not `pg_ctl` piped; see `environment-gotchas.md`), hand to Davin.
- **Apply a single migration without running later/pending ones:** `prisma db execute --file <migration.sql> --config prisma.production.config.ts`
  then `prisma migrate resolve --applied <name> --config prisma.production.config.ts` (never blind `migrate deploy`).
- **Expected `main` CI status (`24/25`, verified 2026-11-28):** `<PROD_DB>` has `41/42` migrations recorded as
  applied; `.github/workflows/check-production-migrations.yml` fails **only** on `20261114000000_add_trendline_context_tables`
  (the sole remaining push-to-`main` failure after Railway `prisma-migration` retired 2026-11-28). This is a
  non-blocking read-only drift heads-up: `TRENDLINE_CONTEXT_ENABLED` is off on `railway-gateway`, so production
  does not query those 3 new tables. **Do NOT apply ad-hoc just to make CI green** — keep pending until
  Trendline Context defects `F1`–`F5` ([review](../../docs/handoffs/2026-11-14-trendline-context-advisor-review.md))
  are resolved and Davin authorizes rollout (`25/25`).
- **Critical rollout ordering:**
  - `User.deletedAt` (`20261019`), `User.sessionVersion` (`20261024`), `Subscription` fields (`20261021`), `AffiliateProfile.paymentDetailsEncrypted` (`20261026`),
    and `MarketData` columns: apply migration **BEFORE** deploying code (`20261024`..`20261026` are already applied in prod per `main` CI checks and on `davintrade-dev-db` as of 2026-11-28).
  - `PAYOUT_DETAILS_CHANGED` (`20261025`, new enum value): apply migration -> deploy readers (`operation-service`, monolith) -> deploy writer (`money-service`) **LAST**.
  - Gateway market-data migrations must apply before `railway-gateway` deploys (`forbidNonWhitelisted` causes 400 quarantine).
  - Stack D tables (`20261002`, `20261003`, `20261004`, `20261010`, `20261014*`): keep flags `off` (`SYN`, `ENGINE4_REPORT2_ENABLED`, `INTAKE_ENABLED`, `REPLY_ENABLED`) until migrations apply and required secrets (`ENGINE4_AUDIT_HMAC_KEY`, `PRO_MONTHLY_UNITS`) are set.
- **CHECK constraints & append-only triggers:** Prisma `migrate diff` ignores hand-written `CHECK`s and triggers (`TEXT[]` nullable needs `CHECK`).
  Use `IS NOT DISTINCT FROM` when comparing nullable/JSONB fields in `CHECK`s. `User.id` cannot update once audit tables (`trade_consent_records`, `request_traces`) reference it (`ON DELETE SET NULL` trigger allows nulling `user_id` only).
- **Array `$transaction([...])`:** use array transactions (not interactive) for PgBouncer transaction-pooling compatibility where required (e.g. sensor/SYN writes).
  For `Prisma.Json?`, omit the field for SQL `NULL` (do not pass JS `null`).

## Ledger ≠ reality (zero-step baseline rows)

Five `_prisma_migrations` rows in prod have `applied_steps_count = 0` (`init`, `20260214000000_rag_dual_memory`, `20260224`, `20260705*`).
Always verify physical tables. **`rag_dual_memory`'s 6 tables do NOT exist** — execute its `migration.sql` directly when Stack D needs them (never `migrate resolve` again).

## `db push` drift (schema ahead of history)

Some historical objects (`User.profile`, `MarketingAsset`, 2FA columns, `market_data_v6`) were pushed manually.
`migrate status` cannot detect `db push` drift; diff live schema against `schema.prisma` directly.

## Credentials & TLS

- Rotation procedure: `docs/runbooks/rotate-postgres-credentials.md`. Railway services must be redeployed after referenced env var changes.
- **Never put `sslmode=` / `sslrootcert=` in URLs passed to custom `PrismaPg({ ssl })` adapters:** `pg-connection-string` replaces the adapter's `ssl` object with `{}` (`SELF_SIGNED_CERT_IN_CHAIN` against Railway certs).

## Spec & query traps

- **`economic_events`:** rows are written ON CHANGE only; resolve Tier-1 safety windows by finding `value_id`s in window first, then reading latest observation per `value_id`.
- **`OutboxEvent` / `ProcessedWebhookEvent`:** `OutboxEvent` reuses `processedAt` for `PROCESSING` lease recovery; `ProcessedWebhookEvent` uses UTC `createdAt` (`now() at time zone 'utc'` in raw SQL) and `createMany({ skipDuplicates: true })`.
- **Gated Postgres specs:** run sequentially (`-i`) when specs wipe shared tables, with `CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes`.
