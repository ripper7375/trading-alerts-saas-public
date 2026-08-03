# Monolith → Microservice Migration: Stack Analysis

**Purpose:** A per-file breakdown of the entire current codebase by **migration-target stack**
— which piece of infrastructure each file belongs to once the Next.js monolith is split, per the
architecture already planned in
`monolith-to-microservice-architecture-uionly-stack-a-b-c/`. This is a companion to
`backend-file-inventory.md` and `frontend-ui-file-inventory.md`, not a replacement — see
"How this differs from the existing inventories" below before using it.

**Methodology:** Categorization follows
`monolith-to-microservice-architecture-uionly-stack-a-b-c/separation-between-frontend-and-backend/stack-categorization-reference-guide.md`
(the project's own established rule set — not invented for this doc). Where an existing per-file
categorization already existed
(`frontend-and-backend-categorization-microservice-best-practice-CORRECTED.md`, ~January 2026,
611 files), that ground truth was reused as-is. Every file added or changed since then (~215 of
the 653 total) was categorized fresh by mechanically applying the same rule set. **One override
was applied on top of the ground truth:** `mt5-service/`, `backend-stack-c/`, `railway-gateway/`,
and `frontend/` are tagged `SEPARATE_STACK` regardless of what the ~January 2026 doc said, because
those are already independently deployed services — a distinction that document predates.

**Source data:** the current, fully-reconciled unique file sets from `backend-file-inventory.md`
(500 files) and `frontend-ui-file-inventory.md` (150 files) as of 2026-07-08, unioned (651 total
after de-duplication — some paths appear in both docs' source material), plus 2 net additional
`backend-stack-c/` files added 2026-07-10 (see exclusion note below) for 653 total.

**Known, deliberate exclusions (confirmed 2026-07-10):** this doc's file count is lower than a raw
filesystem scan of the repo would show. Three directories account for nearly all of that
difference, and in every case the missing files are old/superseded content, not current
development targets, so they were left out rather than backfilled:

- **`frontend/`** — 554 files on disk, only 17 appear here. It's a largely stale transitional
  mirror; only the dLocal-payment slice (the 17 listed) is still relevant, so that's all that's
  tracked.
- **`backend-stack-c/`** — ~94–103 files on disk; 49 appear here (2026-07-10: the two active
  `v2_29_data_pipeline_architecture/` and `v2_29_multi-timeframe-visualisation/` subfolders are
  now included in full — 37 + 12 real files, excluding `__pycache__/`/`.pytest_cache/` compiled
  artifacts — while `old-architecture/README.md` and every other older iteration/archive subfolder
  remain excluded as superseded).
- **`mt5-service/`** — 41 real files (excluding `venv/` and `__pycache__/`) on disk, 32 appear
  here. The 9 missing (`app/models/*`, `deploy/*.ps1`, `scripts/generate-types.sh`) are dead
  scaffolding/tooling from the legacy Flask service, already superseded by `market_data_v6` +
  `backend-stack-c/` + `railway-gateway/`.

Also excluded, but not gaps at all: `seed-code/` (13,220 files — vendored reference/template
libraries, never part of the app) and `mt5-service/venv/` (9,856 files — a Python virtualenv),
plus the usual `node_modules/`, `.next/`, `.git/`.

**Net effect:** for the active Next.js monolith + `railway-gateway/` (the parts actually under
migration consideration), this doc is complete. For the three directories above, it's
intentionally a curated subset, not a full inventory — don't treat a low count there as missing
work.

---

## The Five Stacks

| Stack                                                | Count | %     | Deploys to                                                                   | Meaning                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ----- | ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FRONTEND**                                         | 320   | 49.0% | Vercel (Next.js)                                                             | Stays in the Next.js app — pages, layouts, `app/api/**` routes (still edge functions until individually migrated), components, hooks, client-side chart/drawing logic                                                                                               |
| **BACKEND**                                          | 143   | 21.9% | Railway (NestJS, per the roadmap)                                            | Business logic, Prisma, cron/background jobs, email rendering, server-only utilities — candidates to migrate into the NestJS backend module-by-module. **Split below** into CORE and BUSINESS FUNCTION.                                                             |
| &nbsp;&nbsp;└─ **CORE (operation-service)**          | 72    | 11.0% | Railway (future NestJS "core"/operation service)                             | Everything in BACKEND that is _not_ Part 12/17/18/19 business logic: trading alert-engine, auth, drawing persistence, tier gating, shared infra (redis, cache, logging), the shared Prisma schema/migrations                                                        |
| &nbsp;&nbsp;└─ **BUSINESS FUNCTION (money-service)** | 71    | 10.9% | Railway (NestJS "money-service", per `money-service-migration-blueprint.md`) | Files directly implementing Part 12 (Stripe), Part 17 (Affiliate), Part 18 (dLocal), Part 19 (RiseWorks Disbursement) business logic — the exact scope of the money-service extraction blueprint                                                                    |
| **SEPARATE_STACK**                                   | 128   | 19.6% | Already separate (Contabo VPS, Railway, Flask)                               | `backend-stack-c/` (EA + data pipeline + MTF render), `railway-gateway/` (NestJS ingest — see note below), `mt5-service/` (Flask, Part 06), `frontend/` (the transitional UI-only mirror) — **not part of this migration exercise**, already independently deployed |
| **SHARING**                                          | 56    | 8.6%  | Both / neither                                                               | Types, build scripts, CI config, `tsconfig.json`/`package.json`-class config, OpenAPI specs, planning docs                                                                                                                                                          |
| **TEST**                                             | 6     | 0.9%  | Neither                                                                      | Cross-stack e2e/integration tests, test infrastructure                                                                                                                                                                                                              |

**BACKEND split methodology (added 2026-07-11):** every file in BACKEND was checked against
`davintrade-part-12-17-18-19-stack/money-service-migration-blueprint.md` §3 ("Service Boundary —
What Moves, What Stays") and the corresponding `part-12-files-completion.md` /
`part17a1/a2/b1/b2-files-completion.md` / `part-18a/b/c-files-completion.md` /
`part19a/b/c/d-files-completion.md` source docs. A file is BUSINESS FUNCTION only if it implements
Part 12/17/18/19 logic by content (verified by reading imports/behavior, not just by the "Part"
label in `backend-file-inventory.md` — several money files are filed there under cross-cutting
labels like "Part 14" (admin) or "Part 16" (cron) because that's where they landed in the original
build order, not where their business logic belongs). Everything else in BACKEND is CORE.

**Important nuance on `railway-gateway/`:** it's tagged `SEPARATE_STACK` here (already deployed,
out of scope for _this_ migration), but it is simultaneously the **existing proof-of-concept** for
the target BACKEND architecture — a real NestJS service, deployed to Railway, doing exactly what
the roadmap (`migration-roadmap-to-link-backend-stack-a-and-frontend-ui-only-stack-together.md`)
describes for Stack A. Anyone doing migration work should read `railway-gateway/` first as a
working reference implementation, not skip it as "irrelevant."

---

## How this differs from the existing inventories

`backend-file-inventory.md` / `frontend-ui-file-inventory.md` split files by **what they are**
(UI-rendering `.tsx` vs. business logic). This document splits files by **where they'll deploy**
after the monolith split. These axes disagree on a meaningful number of files:

| File                                       | UI-split says (existing docs)                                                  | Migration-stack says (this doc) | Why they differ                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/alerts/route.ts`                  | Backend (`backend-file-inventory.md`, "API routes")                            | **FRONTEND**                    | Next.js API routes are Vercel edge functions — they ship with the Next.js bundle until individually migrated to NestJS; they're not a separate backend today |
| `components/charts/drawing/persistence.ts` | Backend (`.ts` logic module, per the `.tsx`=frontend/`.ts`=backend convention) | **FRONTEND**                    | Runs entirely in the browser (canvas pointer handling, drawing persistence calls) — deploys with the Vercel bundle regardless of file extension              |
| `emails/payment-confirmation.tsx`          | Frontend-eligible by extension, but already tracked as Backend (Templates)     | **BACKEND**                     | Server-side rendered by the email service — `.tsx` here is JSX-as-templating-syntax, not a browser component                                                 |
| `hooks/use-ohlcv-socket.ts`                | Backend (React hooks category, tracked in `backend-file-inventory.md`)         | **FRONTEND**                    | React hooks only run in the browser — the `use-*` naming pattern overrides directory location                                                                |

**Use `backend-file-inventory.md`/`frontend-ui-file-inventory.md`** for "is this file UI or logic."
**Use this doc** for "what happens to this file when we split the monolith."

---

## Migration Readiness Notes

- **`SEPARATE_STACK` (128 files) is the biggest head start** — nearly a fifth of the whole
  codebase is _already_ running as independent services. `railway-gateway/` in particular proves
  the NestJS-on-Railway pattern end-to-end (ingest → validate → queue → Postgres) at production
  quality; the same shape (controller → service → Prisma) is the template for migrating Stack A
  modules.
- **`BACKEND` (143 files) is the actual migration backlog** for the Next.js monolith → NestJS
  split, and it splits cleanly into two independent migration tracks that don't have to happen
  together:
  - **CORE (operation-service, 72 files)** — the trading-alerts product itself. Natural first
    candidates, by self-containment:
    - `lib/alert-engine/*` (9 files) — already runs as an independent background worker
      (`scripts/alert-worker.ts`, its own `docker-compose.yml` service, its own
      `railway-worker.json`) with a narrow, well-defined interface (Redis pub/sub in, BullMQ
      dispatch out). Closest thing to "already migrated" in the CORE list.
    - Defer: `lib/auth/*`, `lib/tier*` — touched by nearly everything else; migrate last once
      session/tier-check patterns are proven in NestJS (an `ApiKeyGuard`-style guard already
      exists as a template in `railway-gateway/src/auth/api-key.guard.ts`, though session-based
      user auth is a different problem than the Gateway's bearer-token machine auth).
    - `prisma/schema.prisma` + its migrations sit here today, but see the Database Architecture
      section below — this file is not exclusively CORE's, it's the entire app's shared schema.
    - `lib/api/index.ts` — **known broken, fix deliberately deferred** (see the flag in the
      appendix below, under `lib/api/`). Don't fix it mid-migration; hybrid auth, the
      `non_market_data` split, and the NestJS refactor will each change what "correct" means for
      this file. Revisit once those land.
  - **BUSINESS FUNCTION (money-service, 71 files)** — Parts 12/17/18/19, and it has its own
    dedicated migration document: `davintrade-part-12-17-18-19-stack/money-service-migration-blueprint.md`.
    That blueprint already specifies the target architecture (NestJS "money-service" on Railway),
    a 5-slice strangler cutover sequence, and a two-phase database plan (see below) — this is
    further ahead than a generic "candidates for extraction" list; it's a concrete, dated plan
    (2026-07-04) with sizing estimates (~7–9 weeks for Phase 1).
    - `lib/disbursement/*`, `lib/affiliate/*` — self-contained business domains with their own
      Prisma models, minimal cross-domain coupling; explicitly called out in the blueprint as the
      "Moves to money-service" core.
    - `lib/stripe/*`, `lib/dlocal/*` — payment providers behind a shared interface already
      (`lib/disbursement/providers/provider-factory.ts`), a natural module boundary.
    - These two tracks can migrate independently and in either order — money-service and
      operation-service don't call into each other's `lib/*` code (per the blueprint's own
      "no cross-domain joins or writes" rule, §5.1) — but they currently **do** share one
      Postgres database, so a DB-role split (§5.1 of the blueprint) has to land before either
      migrates its compute off the monolith. See Database Architecture below.
- **`FRONTEND` (320 files) mostly doesn't move** — this is the end state, not a migration
  backlog. The one action item: `app/api/**/route.ts` routes will need to become
  Railway API calls (`fetch(NEXT_PUBLIC_API_URL + ...)`) as each BACKEND module migrates, per
  roadmap step 5 ("Update frontend to point to Railway API").
- **`SHARING` (56 files)** is the roadmap's own recommendation to extract into an
  `@trading-alerts/types` package (see `stack-categorization-reference-guide.md`'s SHARING
  section) — not yet done; currently just root-level `types/`, config, and scripts duplicated by
  reference rather than by package.

---

## Database Architecture: `market_data_v6` vs `non_market_data`

There are two logically distinct data domains in this system, and — as of 2026-07-11 — they are
at very different points in their own separation-from-the-monolith journey.

### 1. `market_data_v6` — 79-field centroid-regression/EDT schema

This is the trading-data table (OHLCV + the six centroid-regression variants: `best_fit`,
`cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b` — see
`prisma/schema.prisma:924` `model MarketDataV6`). It exists in **two physically separate
databases today**, not one:

| Store                 | Engine               | Location                                           | Authoritative schema file                                                                                                                                                                                                                                    |
| --------------------- | -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local pipeline buffer | SQLite (`xauusd.db`) | Contabo VPS                                        | `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql` — implements the full COLLECT → ADJUST → VALIDATE → CALCULATE → PROMOTE → RETAIN pipeline described in that file's own header comment |
| Shared app database   | PostgreSQL           | Wherever the Next.js monolith's DB is hosted today | `prisma/schema.prisma` (`model MarketDataV6`, line 924) — **this is the source of truth**                                                                                                                                                                    |

`railway-gateway/prisma/schema.prisma` is **not** a third database — its own header comment says
so explicitly: it's a byte-for-byte duplicate of the same `MarketDataV6` model, generated only so
the NestJS ingest service (`railway-gateway/`) can get a typed Prisma client for the one table it
writes to. It targets the _same_ Postgres instance and table as the root schema. Any field change
has to be hand-applied to both files — there's no shared source, which is itself a small piece of
migration debt worth tracking.

**Flow today:** EA/MQL5 exports → Contabo SQLite (local calc + validation) → pushed over HTTPS to
`railway-gateway` → upserted into the shared Postgres `market_data_v6` table (idempotent on
`{symbol}_{timeframe}_{timestamp}`).

### 2. `non_market_data` — everything else (operation + money + other services)

**This is not a separate schema or database yet.** Right now, every model that is _not_
`MarketDataV6` — `User`, `Account`, `Session`, `Subscription`, `Alert`, `Notification`, `Drawing`,
`DrawingAlert`, `SystemConfig` (CORE/operation-service), plus `Payment`, `FraudAlert`,
`AffiliateProfile`, `AffiliateCode`, `Commission`, `AffiliateRiseAccount`, `PaymentBatch`,
`DisbursementTransaction`, `RiseWorksWebhookEvent`, `DisbursementAuditLog` (BUSINESS
FUNCTION/money-service) — lives in the **same** `prisma/schema.prisma` file, in the **same**
Postgres instance, as `MarketDataV6`. There is no `non_market_data`-specific schema file, Railway
deployment, or database instance today. That's exactly what you flagged: it hasn't been built yet.

**What "building it" means, per the plan that already exists:**
`davintrade-part-12-17-18-19-stack/money-service-migration-blueprint.md` §5.1 ("Database
discipline") specifies this as **Phase 1** of the money-service extraction — _not_ a brand-new
database, but a discipline change on the existing shared instance:

1. Two Postgres roles on the **one existing instance**: `money_svc` (ALL on the 10 money tables
   listed above, SELECT on nothing else) and `core_app` (no privileges on money tables).
2. No cross-domain joins or writes enforced at the role-grant level, not just by convention.
3. PgBouncer in front, transaction-pooling mode.

This is the literal meaning of the blueprint's own diagram (§2): `PostgreSQL ◀── Phase 1: one
instance, two roles/schemas`. **Phase 2** (§6, trigger-based — not calendar-based) is what
actually deploys a second, physically separate `money-db` on Railway and migrates the 10 money
tables into it via `pg_dump`/restore with a checksum-verified freeze window. Until Phase 2,
"non*market_data on Railway/PostgreSQL" describes the \_target*, not the current state — today,
all non-market-data models are wherever the monolith's existing Postgres already lives, undivided.

**Net effect on this doc's file split:** the CORE/BUSINESS FUNCTION split above (in "The Five
Stacks") is a **code** split — it's accurate today because `lib/stripe/*`, `lib/disbursement/*`,
etc. are already separate files with no shared logic. It is **not yet** a **data** split — both
tracks currently read/write the one `prisma/schema.prisma`/one Postgres instance. `prisma/schema.prisma`
and its migrations are listed once, under CORE, in the appendix below (a single file can't be
split), with this section as the flag that it's shared, not CORE-exclusive.

---

## Appendix: Full File Listings by Stack

Grouped by top-level directory; expand each to see the files. Counts are the same "approximate,
not perfectly reconciled" caveat as the two source inventories — this is a snapshot for planning,
re-derive it if the codebase has moved on significantly.

### FRONTEND

<details>
<summary><code>(root)/</code> — 5 files</summary>

- `next.config.js`
- `eslint.config.mjs`
- `postcss.config.js`
- `tailwind.config.ts`
- `vercel.json`

</details>

<details>
<summary><code>__tests__/api/</code> — 17 files</summary>

- `__tests__/api/admin-affiliates.test.ts`
- `__tests__/api/affiliate-conversion.test.ts`
- `__tests__/api/affiliate-dashboard.test.ts`
- `__tests__/api/affiliate-registration.test.ts`
- `__tests__/api/cron-jobs.test.ts`
- `__tests__/api/cron/process-pending.test.ts`
- `__tests__/api/disbursement/affiliates.test.ts`
- `__tests__/api/disbursement/audit.test.ts`
- `__tests__/api/disbursement/batches.test.ts`
- `__tests__/api/disbursement/execute.test.ts`
- `__tests__/api/disbursement/health.test.ts`
- `__tests__/api/disbursement/pay.test.ts`
- `__tests__/api/disbursement/reports.test.ts`
- `__tests__/api/notifications.test.ts`
- `__tests__/api/tier.test.ts`
- `__tests__/api/webhooks/dlocal/route.test.ts`
- `__tests__/api/webhooks/riseworks.test.ts`

</details>

<details>
<summary><code>__tests__/components/</code> — 9 files</summary>

- `__tests__/components/admin/affiliate-filters.test.tsx`
- `__tests__/components/admin/affiliate-stats-banner.test.tsx`
- `__tests__/components/affiliate/code-table.test.tsx`
- `__tests__/components/affiliate/commission-table.test.tsx`
- `__tests__/components/affiliate/stats-card.test.tsx`
- `__tests__/components/dashboard/recent-alerts.test.tsx`
- `__tests__/components/dashboard/stats-card.test.tsx`
- `__tests__/components/payments/PlanSelector.test.tsx`
- `__tests__/components/payments/PriceDisplay.test.tsx`

</details>

<details>
<summary><code>app/</code> — 3 files</summary>

- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`

</details>

<details>
<summary><code>app/(auth)/</code> — 9 files</summary>

- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/layout.tsx`
- `app/(auth)/loading.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(auth)/verify-2fa/page.tsx`
- `app/(auth)/verify-email/page.tsx`
- `app/(auth)/verify-email/pending/page.tsx`

</details>

<details>
<summary><code>app/(dashboard)/</code> — 41 files</summary>

- `app/(dashboard)/admin/api-usage/page.tsx`
- `app/(dashboard)/admin/disbursement/accounts/page.tsx`
- `app/(dashboard)/admin/disbursement/affiliates/page.tsx`
- `app/(dashboard)/admin/disbursement/audit/page.tsx`
- `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`
- `app/(dashboard)/admin/disbursement/batches/page.tsx`
- `app/(dashboard)/admin/disbursement/config/page.tsx`
- `app/(dashboard)/admin/disbursement/layout.tsx`
- `app/(dashboard)/admin/disbursement/page.tsx`
- `app/(dashboard)/admin/disbursement/transactions/page.tsx`
- `app/(dashboard)/admin/errors/page.tsx`
- `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`
- `app/(dashboard)/admin/fraud-alerts/page.tsx`
- `app/(dashboard)/admin/layout.tsx`
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/admin/users/page.tsx`
- `app/(dashboard)/alerts/alerts-client.tsx`
- `app/(dashboard)/alerts/loading.tsx`
- `app/(dashboard)/alerts/new/create-alert-client.tsx`
- `app/(dashboard)/alerts/new/page.tsx`
- `app/(dashboard)/alerts/page.tsx`
- `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`
- `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx`
- `app/(dashboard)/charts/loading.tsx`
- `app/(dashboard)/charts/page.tsx`
- `app/(dashboard)/dashboard/loading.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/settings/account/page.tsx`
- `app/(dashboard)/settings/appearance/page.tsx`
- `app/(dashboard)/settings/billing/page.tsx`
- `app/(dashboard)/settings/help/page.tsx`
- `app/(dashboard)/settings/language/page.tsx`
- `app/(dashboard)/settings/layout.tsx`
- `app/(dashboard)/settings/loading.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/settings/privacy/page.tsx`
- `app/(dashboard)/settings/profile/page.tsx`
- `app/(dashboard)/settings/security/page.tsx`
- `app/(dashboard)/settings/terms/page.tsx`

</details>

<details>
<summary><code>app/(marketing)/</code> — 4 files</summary>

- `app/(marketing)/landing-content.tsx`
- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`
- `app/(marketing)/pricing/page.tsx`

</details>

<details>
<summary><code>app/admin/</code> — 8 files</summary>

- `app/admin/affiliates/[id]/page.tsx`
- `app/admin/affiliates/page.tsx`
- `app/admin/affiliates/reports/code-inventory/page.tsx`
- `app/admin/affiliates/reports/commission-owings/page.tsx`
- `app/admin/affiliates/reports/profit-loss/page.tsx`
- `app/admin/affiliates/reports/sales-performance/page.tsx`
- `app/admin/login/page.tsx`
- `app/admin/settings/affiliate/page.tsx`

</details>

<details>
<summary><code>app/affiliate/</code> — 11 files</summary>

- `app/affiliate/dashboard/codes/page.tsx`
- `app/affiliate/dashboard/commissions/page.tsx`
- `app/affiliate/dashboard/layout.tsx`
- `app/affiliate/dashboard/page.tsx`
- `app/affiliate/dashboard/profile/page.tsx`
- `app/affiliate/dashboard/profile/payment/page.tsx`
- `app/affiliate/layout.tsx`
- `app/affiliate/register/layout.tsx`
- `app/affiliate/register/page.tsx`
- `app/affiliate/verify/layout.tsx`
- `app/affiliate/verify/page.tsx`

</details>

<details>
<summary><code>app/api/</code> — 99 files</summary>

- `app/api/admin/affiliates/[id]/distribute-codes/route.ts`
- `app/api/admin/affiliates/[id]/reactivate/route.ts`
- `app/api/admin/affiliates/[id]/route.ts`
- `app/api/admin/affiliates/[id]/suspend/route.ts`
- `app/api/admin/affiliates/reports/code-flows/route.ts`
- `app/api/admin/affiliates/reports/code-inventory/route.ts`
- `app/api/admin/affiliates/reports/commission-owings/route.ts`
- `app/api/admin/affiliates/reports/profit-loss/route.ts`
- `app/api/admin/affiliates/reports/sales-performance/route.ts`
- `app/api/admin/affiliates/route.ts`
- `app/api/admin/analytics/route.ts`
- `app/api/admin/api-usage/route.ts`
- `app/api/admin/codes/[code]/cancel/route.ts`
- `app/api/admin/commissions/pay/route.ts`
- `app/api/admin/error-logs/route.ts`
- `app/api/admin/fraud-alerts/[id]/route.ts`
- `app/api/admin/fraud-alerts/route.ts`
- `app/api/admin/settings/affiliate/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/affiliate/auth/register/route.ts`
- `app/api/affiliate/auth/verify-email/route.ts`
- `app/api/affiliate/dashboard/code-inventory/route.ts`
- `app/api/affiliate/dashboard/codes/route.ts`
- `app/api/affiliate/dashboard/commission-report/route.ts`
- `app/api/affiliate/dashboard/stats/route.ts`
- `app/api/affiliate/profile/payment/route.ts`
- `app/api/affiliate/profile/route.ts`
- `app/api/alerts/[id]/route.ts`
- `app/api/alerts/line/[id]/route.ts`
- `app/api/alerts/line/route.ts`
- `app/api/alerts/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/forgot-password/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/resend-verification/route.ts`
- `app/api/auth/reset-password/route.ts`
- `app/api/auth/verify-email/route.ts`
- `app/api/checkout/route.ts`
- `app/api/checkout/validate-code/route.ts`
- `app/api/config/affiliate/route.ts`
- `app/api/cron/check-expiring-subscriptions/route.ts`
- `app/api/cron/distribute-codes/route.ts`
- `app/api/cron/downgrade-expired-subscriptions/route.ts`
- `app/api/cron/expire-codes/route.ts`
- `app/api/cron/process-pending-disbursements/route.ts`
- `app/api/cron/send-monthly-reports/route.ts`
- `app/api/cron/sync-riseworks-accounts/route.ts`
- `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`
- `app/api/disbursement/affiliates/[affiliateId]/route.ts`
- `app/api/disbursement/affiliates/payable/route.ts`
- `app/api/disbursement/audit-logs/route.ts`
- `app/api/disbursement/batches/[batchId]/execute/route.ts`
- `app/api/disbursement/batches/[batchId]/route.ts`
- `app/api/disbursement/batches/preview/route.ts`
- `app/api/disbursement/batches/route.ts`
- `app/api/disbursement/config/route.ts`
- `app/api/disbursement/health/route.ts`
- `app/api/disbursement/pay/route.ts`
- `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`
- `app/api/disbursement/reports/summary/route.ts`
- `app/api/disbursement/riseworks/accounts/route.ts`
- `app/api/disbursement/riseworks/sync/route.ts`
- `app/api/disbursement/transactions/route.ts`
- `app/api/drawings/[id]/route.ts`
- `app/api/drawings/route.ts`
- `app/api/invoices/route.ts`
- `app/api/market-data/channel/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/[id]/route.ts`
- `app/api/notifications/route.ts`
- `app/api/payments/dlocal/[paymentId]/route.ts`
- `app/api/payments/dlocal/check-three-day-eligibility/route.ts`
- `app/api/payments/dlocal/convert/route.ts`
- `app/api/payments/dlocal/create/route.ts`
- `app/api/payments/dlocal/exchange-rate/route.ts`
- `app/api/payments/dlocal/methods/route.ts`
- `app/api/payments/dlocal/validate-discount/route.ts`
- `app/api/subscription/cancel/route.ts`
- `app/api/subscription/route.ts`
- `app/api/tier/check/[symbol]/route.ts`
- `app/api/tier/combinations/route.ts`
- `app/api/tier/symbols/route.ts`
- `app/api/user/2fa/backup-codes/route.ts`
- `app/api/user/2fa/disable/route.ts`
- `app/api/user/2fa/setup/route.ts`
- `app/api/user/2fa/verify-setup/route.ts`
- `app/api/user/2fa/verify/route.ts`
- `app/api/user/account/deletion-cancel/route.ts`
- `app/api/user/account/deletion-confirm/route.ts`
- `app/api/user/account/deletion-request/route.ts`
- `app/api/user/login-history/route.ts`
- `app/api/user/password/route.ts`
- `app/api/user/preferences/route.ts`
- `app/api/user/profile/route.ts`
- `app/api/user/sessions/[id]/route.ts`
- `app/api/user/sessions/route.ts`
- `app/api/webhooks/dlocal/route.ts`
- `app/api/webhooks/riseworks/route.ts`
- `app/api/webhooks/stripe/route.ts`

</details>

<details>
<summary><code>app/api-test/</code> — 1 file</summary>

- `app/api-test/page.tsx`

</details>

<details>
<summary><code>app/checkout/</code> — 1 file</summary>

- `app/checkout/page.tsx`

</details>

<details>
<summary><code>components/</code> — 1 file</summary>

- `components/theme-toggle.tsx`

</details>

<details>
<summary><code>components/admin/</code> — 14 files</summary>

- `components/admin/FraudAlertCard.tsx`
- `components/admin/FraudPatternBadge.tsx`
- `components/admin/affiliate-filters.tsx`
- `components/admin/affiliate-stats-banner.tsx`
- `components/admin/affiliate-table.tsx`
- `components/admin/code-inventory-chart.tsx`
- `components/admin/commission-owings-table.tsx`
- `components/admin/distribute-codes-modal.tsx`
- `components/admin/pay-commission-modal.tsx`
- `components/admin/pnl-breakdown-table.tsx`
- `components/admin/pnl-summary-cards.tsx`
- `components/admin/pnl-trend-chart.tsx`
- `components/admin/sales-performance-table.tsx`
- `components/admin/suspend-affiliate-modal.tsx`

</details>

<details>
<summary><code>components/affiliate/</code> — 4 files</summary>

- `components/affiliate/code-table.tsx`
- `components/affiliate/commission-table.tsx`
- `components/affiliate/index.ts`
- `components/affiliate/stats-card.tsx`

</details>

<details>
<summary><code>components/alerts/</code> — 4 files</summary>

- `components/alerts/alert-card.tsx`
- `components/alerts/alert-form.tsx`
- `components/alerts/alert-list.tsx`
- `components/alerts/alerts-pro-upgrade.tsx`

</details>

<details>
<summary><code>components/auth/</code> — 3 files</summary>

- `components/auth/login-form.tsx`
- `components/auth/register-form.tsx`
- `components/auth/social-auth-buttons.tsx`

</details>

<details>
<summary><code>components/billing/</code> — 2 files</summary>

- `components/billing/invoice-list.tsx`
- `components/billing/subscription-card.tsx`

</details>

<details>
<summary><code>components/charts/</code> — 35 files</summary>

- `components/charts/chart-controls.tsx`
- `components/charts/drawing/AlertDialog.tsx`
- `components/charts/drawing/AlertsPanel.tsx`
- `components/charts/drawing/DrawingLayer.tsx`
- `components/charts/drawing/StyleEditor.tsx`
- `components/charts/drawing/Toolbar.tsx`
- `components/charts/drawing/alertsApi.ts`
- `components/charts/drawing/engine/DrawingEngine.ts`
- `components/charts/drawing/engine/PointerController.ts`
- `components/charts/drawing/engine/coords.ts`
- `components/charts/drawing/engine/pixelMath.ts`
- `components/charts/drawing/firedMarkers.ts`
- `components/charts/drawing/geometry/channel.ts`
- `components/charts/drawing/geometry/fib.ts`
- `components/charts/drawing/geometry/horizontal.ts`
- `components/charts/drawing/geometry/index.ts`
- `components/charts/drawing/geometry/levels.ts`
- `components/charts/drawing/geometry/trendline.ts`
- `components/charts/drawing/geometry/types.ts`
- `components/charts/drawing/marks/BaseMark.ts`
- `components/charts/drawing/marks/ChannelMark.ts`
- `components/charts/drawing/marks/FibExtensionMark.ts`
- `components/charts/drawing/marks/FibRetracementMark.ts`
- `components/charts/drawing/marks/HorizontalLineMark.ts`
- `components/charts/drawing/marks/TextMark.ts`
- `components/charts/drawing/marks/TrendlineMark.ts`
- `components/charts/drawing/persistence.ts`
- `components/charts/drawing/tierUsage.ts`
- `components/charts/drawing/tools/index.ts`
- `components/charts/drawing/types.ts`
- `components/charts/drawing/useFiredAlertMarkers.ts`
- `components/charts/mtf/MtfToggle.tsx`
- `components/charts/mtf/useMtfOverlay.ts`
- `components/charts/timeframe-selector.tsx`
- `components/charts/trading-chart.tsx`

</details>

<details>
<summary><code>components/dashboard/</code> — 3 files</summary>

- `components/dashboard/recent-alerts.tsx`
- `components/dashboard/stats-card.tsx`
- `components/dashboard/upgrade-prompt.tsx`

</details>

<details>
<summary><code>components/layout/</code> — 4 files</summary>

- `components/layout/footer.tsx`
- `components/layout/header.tsx`
- `components/layout/mobile-nav.tsx`
- `components/layout/sidebar.tsx`

</details>

<details>
<summary><code>components/notifications/</code> — 2 files</summary>

- `components/notifications/notification-bell.tsx`
- `components/notifications/notification-list.tsx`

</details>

<details>
<summary><code>components/payments/</code> — 7 files</summary>

- `components/payments/CountrySelector.tsx`
- `components/payments/DiscountCodeInput.tsx`
- `components/payments/PaymentButton.tsx`
- `components/payments/PaymentMethodSelector.tsx`
- `components/payments/PlanSelector.tsx`
- `components/payments/PriceDisplay.tsx`
- `components/payments/index.ts`

</details>

<details>
<summary><code>components/pricing/</code> — 1 file</summary>

- `components/pricing/tier-comparison.tsx`

</details>

<details>
<summary><code>components/providers/</code> — 2 files</summary>

- `components/providers/theme-provider.tsx`
- `components/providers/websocket-provider.tsx`

</details>

<details>
<summary><code>components/ui/</code> — 22 files</summary>

- `components/ui/alert-dialog.tsx`
- `components/ui/avatar.tsx`
- `components/ui/badge.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/pagination.tsx`
- `components/ui/popover.tsx`
- `components/ui/progress.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/select.tsx`
- `components/ui/separator.tsx`
- `components/ui/sheet.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/switch.tsx`
- `components/ui/tabs.tsx`
- `components/ui/toast-container.tsx`
- `components/ui/upgrade-button.tsx`

</details>

<details>
<summary><code>hooks/</code> — 7 files</summary>

- `hooks/use-alerts.ts`
- `hooks/use-auth.ts`
- `hooks/use-login-tracking.ts`
- `hooks/use-ohlcv-socket.ts`
- `hooks/use-optimistic-mutation.ts`
- `hooks/use-toast.ts`
- `hooks/use-websocket.ts`

</details>

<details>
<summary><code>lib/hooks/</code> — 1 file</summary>

- `lib/hooks/useAffiliateConfig.ts`

</details>

<details>
<summary><code>public/</code> — 1 file</summary>

- `public/manifest.json`

</details>

### BACKEND — split into CORE (operation-service) and BUSINESS FUNCTION (money-service)

_See "Database Architecture: market_data_v6 vs non_market_data" above — the `prisma/` files
below are listed once, under CORE, but are shared with BUSINESS FUNCTION (not yet split by DB
role). Everything else in each list is exclusively that track's own code._

#### CORE (operation-service) — 72 files

<details>
<summary><code>(root)/</code> — 3 files</summary>

- `docker-compose.yml`
- `docker-compose.dev.yml` (new, Session 0-5 — CC-I local dev stack: Postgres, Redis,
  Next.js dev server; `mt5-service` intentionally excluded, SEPARATE_STACK; PgBouncer and
  the NestJS services join in later phases)
- `railway-worker.json`

</details>

<details>
<summary><code>__tests__/alert-engine/</code> — 1 file (was 4; Session 4B-3 retired 3, 2026-08-01)</summary>

- `__tests__/alert-engine/notify-bridge.test.ts` — **KEPT** (tests `notify-bridge.ts`, which stays).
- ~~`detect.test.ts`~~, ~~`evaluator.test.ts`~~, ~~`watches.test.ts`~~ — **RETIRED, Session 4B-3**,
  alongside their now-deleted subjects.

</details>

<details>
<summary><code>__tests__/drawing/</code> — 8 files</summary>

- `__tests__/drawing/alertsApi.test.ts`
- `__tests__/drawing/engine/DrawingEngine.test.ts`
- `__tests__/drawing/engine/pixelMath.test.ts`
- `__tests__/drawing/firedMarkers.test.ts`
- `__tests__/drawing/geometry/geometry.test.ts`
- `__tests__/drawing/marks/newMarks.test.ts`
- `__tests__/drawing/persistence.test.ts`
- `__tests__/drawing/tierUsage.test.ts`

</details>

<details>
<summary><code>__tests__/lib/</code> — 2 files</summary>

- `__tests__/lib/db/prisma.test.ts`
- `__tests__/lib/db/seed.test.ts`

</details>

<details>
<summary><code>lib/</code> — 8 files</summary>

- `lib/candle-data-helpers.ts`
- `lib/csrf.ts`
- `lib/logger.ts`
- `lib/tier-config.ts`
- `lib/tier-helpers.ts`
- `lib/tier-validation.ts`
- `lib/tokens.ts`
- `lib/utils.ts`

</details>

<details>
<summary><code>lib/alert-engine/</code> — 2 files (was 9; Session 4B-3 retired 7, 2026-08-01)</summary>

- `lib/alert-engine/notify-bridge.ts` — **KEPT**, deliberately: `lib/websocket/server.ts` still
  imports `startAlertDeliveryBridge` from it for real-time browser delivery of fired alerts.
  Operation-service's `NotifyBridgeService` publishes to the same `alerts:fired` Redis channel;
  this file is the subscriber half, staying in the monolith until Session 4B-17 (F8 realtime
  decision).
- `lib/alert-engine/types.ts` — **KEPT**, sole dependency of `notify-bridge.ts` above.
- ~~`lib/alert-engine/detect.ts`~~, ~~`dispatcher.ts`~~, ~~`evaluator.ts`~~, ~~`queue.ts`~~,
  ~~`state.ts`~~, ~~`watches.ts`~~, ~~`worker.ts`~~ — **RETIRED, Session 4B-3**: alert evaluation
  now runs exclusively on `operation-service` (`operation-service-worker` Railway service).

</details>

<details>
<summary><code>lib/api/</code> — 1 file</summary>

- `lib/api/index.ts`

**⚠️ Known broken, fix deferred (flagged 2026-07-11):** this "unified Stack A/Stack B API client"
(design docs: `backend-stack-a/api-client-between-frontend-and-stack-b/api-client-{design,
maintenance-and-updates,testing}.md`) has zero real consumers — the only caller in the app is
`app/test-api/page.tsx`, an unguarded debug page; every real product hook/component calls its
route directly via `fetch()` instead. It is also currently broken against the live routes it
claims to wrap: `updateAlert()` sends `PUT` where the route only accepts `PATCH`;
`markNotificationAsRead()` sends `PATCH /api/notifications/{id}` where the route needs
`POST /api/notifications/{id}/read`; `updateSettings()` sends `PATCH /api/user/preferences` where
the route only accepts `PUT`; `stackB.getMarketData()/getOHLCV()` call a path shape
(`/api/market-data/{symbol}`) that doesn't match the one real market-data route that exists
(`GET /api/market-data/channel?symbol=&timeframe=&variant=&limit=`, V8 PRO-only). Its own Jest
tests (`__tests__/lib/api/stack-a-client.test.ts`, `stack-b-client.test.ts`) fully mock `fetch`,
so they pass (36/36) without exercising any of this — no real signal there. Also stale: the
design docs' Stack A/B model (Parts 1-19 deployed / Parts 20-26 future) predates the V8
single-symbol redesign and doesn't reflect it.

**Deliberately not fixed now** — hybrid (dual) authentication, the `non_market_data` Prisma
schema split, and the Next.js→NestJS backend-stack refactor are all in flight and will each
reshape what "correct" looks like here (auth headers, base URLs, response shapes). Since nothing
real depends on this file today, there's no cost to leaving it broken until those land. Revisit
and rewrite `lib/api/index.ts` (and the 3 design docs above, and the 2 test files) **after** those
migrations are complete, not before.

</details>

<details>
<summary><code>lib/auth/</code> — 6 files</summary>

- `lib/auth/auth-options.ts`
- `lib/auth/errors.ts`
- `lib/auth/permissions.ts`
- `lib/auth/session-tracker.ts`
- `lib/auth/session.ts`
- `lib/auth/two-factor.ts`

</details>

<details>
<summary><code>lib/cache/</code> — 1 file</summary>

- `lib/cache/cache-manager.ts`

</details>

<details>
<summary><code>lib/constants/</code> — 1 file</summary>

- `lib/constants/business-rules.ts`

</details>

<details>
<summary><code>lib/db/</code> — 3 files (Session 2-4: +1, market-prisma.ts)</summary>

- `lib/db/prisma.ts` — **Session 2-4:** repointed from `@prisma/client` to
  `.prisma/non-market-client` (bare specifier import — same resolution mechanism
  `@prisma/client`'s own `default.js` uses internally). This is the choke point every
  `import { prisma } from '@/lib/db/prisma'` consumer goes through.
- `lib/db/market-prisma.ts` — **new, Session 2-4.** A second singleton, same
  adapter/pooling pattern as `prisma.ts` but for `.prisma/market-client`
  (MarketDataV6 only). Exists because exactly 2 call sites genuinely query market
  data directly (`app/api/market-data/channel/route.ts`,
  `lib/jobs/alert-checker.ts`) — a case-sensitive grep miss during this session's own
  CONFIRM (`MarketDataV6` the model name vs `marketDataV6` the camelCase client
  property) meant this wasn't caught until `tsc --noEmit` surfaced it mid-execution.
- `lib/db/seed.ts` — Session 2-4: repointed from `@prisma/client` to
  `.prisma/non-market-client`; `cleanupTestData`'s `user.findUnique` include dropped
  `payments`/`fraudAlerts` (unused, and now broken by the FK audit — `alerts` kept,
  also unused but harmless).

</details>

<details>
<summary><code>lib/drawing/</code> — 2 files</summary>

- `lib/drawing/invalidate.ts`
- `lib/drawing/schema.ts`

</details>

<details>
<summary><code>lib/email/</code> — 1 file</summary>

- `lib/email/email.ts`

</details>

<details>
<summary><code>lib/errors/</code> — 3 files</summary>

- `lib/errors/api-error.ts`
- `lib/errors/error-handler.ts`
- `lib/errors/error-logger.ts`

</details>

<details>
<summary><code>lib/jobs/</code> — 0 files (was 2; Session 4B-3 retired both, 2026-08-01)</summary>

- ~~`lib/jobs/alert-checker.ts`~~, ~~`lib/jobs/queue.ts`~~ — **RETIRED, Session 4B-3**: alert
  evaluation now runs exclusively on `operation-service`. Directory is now empty in the monolith
  (the unrelated `frontend/lib/jobs/queue.ts` SEPARATE_STACK mirror copy is untouched).

</details>

<details>
<summary><code>lib/monitoring/</code> — 1 file</summary>

- `lib/monitoring/system-monitor.ts`

</details>

<details>
<summary><code>lib/preferences/</code> — 1 file</summary>

- `lib/preferences/defaults.ts`

</details>

<details>
<summary><code>lib/redis/</code> — 1 file</summary>

- `lib/redis/client.ts`

</details>

<details>
<summary><code>lib/security/</code> — 1 file</summary>

- `lib/security/device-detection.ts`

</details>

<details>
<summary><code>lib/utils/</code> — 3 files</summary>

- `lib/utils/constants.ts`
- `lib/utils/formatters.ts`
- `lib/utils/helpers.ts`

</details>

<details>
<summary><code>lib/validations/</code> — 3 files</summary>

- `lib/validations/alert.ts`
- `lib/validations/auth.ts`
- `lib/validations/user.ts`

</details>

<details>
<summary><code>lib/websocket/</code> — 1 file</summary>

- `lib/websocket/server.ts`

</details>

<details>
<summary><code>middleware/</code> — 1 file</summary>

- `middleware/tier-check.ts`

</details>

<details>
<summary><code>prisma/</code> — 13 files</summary>

- `prisma/migrations/20251227000000_init/migration.sql` — **Session 2-3: baselined
  applied** against production (`resolve --applied`, no SQL executed; live schema
  already matched).
- `prisma/migrations/20260214000000_rag_dual_memory/migration.sql` — **Session 2-3:
  baselined applied**, same basis.
- `prisma/migrations/20260224000000_update_kc_ha_body_columns/migration.sql` —
  **Session 2-3: baselined applied**, same basis.
- `prisma/migrations/20260705000000_add_market_data_v6/migration.sql` — **Session
  2-3: baselined applied**, same basis.
- `prisma/migrations/20260705010000_drop_market_data/migration.sql` — **Session 2-3:
  baselined applied**, same basis.
- `prisma/migrations/20260706000000_drop_watchlists/migration.sql` — **REMOVED,
  Session 2-3** (F20, Davin's live decision, option b: strip-and-orphan). Never
  applied; `Watchlist`/`WatchlistItem` remain live in production, permanently
  orphaned, unreferenced by either new schema file.
- `prisma/migrations/20260720000000_drop_money_user_fk_constraints/migration.sql` —
  **new, Session 2-3.** Hand-written (not `prisma migrate dev`, to avoid its
  shadow-DB diff proposing to drop `market_data_v6` against the partial
  non-market-data schema — see `LESSONS-LEARNED.md` L24). 4
  `ALTER TABLE ... DROP CONSTRAINT ...` statements dropping the FK from
  `Subscription`/`Payment`/`FraudAlert`/`AffiliateProfile` to `User`. Applied to
  production via `migrate deploy`.
- `prisma/roles/roles.sql` — new, Session 1-3: idempotent `money_svc`/`core_app` role +
  grant script (Plan §3 Stage A), applied to production.
- `prisma/roles/roles.rollback.sql` — new, Session 1-3: paired `DROP ROLE`/`REVOKE`
  script, written but not applied.
- `prisma/schema.prisma` — **DELETED, Session 2-4.** Was the single source of truth
  for all consumers through Session 2-3; retired only after every consumer (the
  `lib/db/prisma.ts`/`lib/db/market-prisma.ts` singletons, every direct
  `@prisma/client` importer, and every FK-audit-broken relation call site) was
  repointed/adapted and `npm run test:ci` showed full parity (111/111 suites,
  2046/2046 tests) with Session 2-3's baseline.
- `prisma/market-data/schema.prisma` — new, Session 2-2 (F4/F5); byte-for-byte port
  of `model MarketDataV6` out of the old `prisma/schema.prisma`, own `generator
client` block (`output = "../../node_modules/.prisma/market-client"`). **Session
  2-4: now live** — consumed via the new `lib/db/market-prisma.ts` singleton by the 2
  call sites that genuinely query `MarketDataV6` directly.
- `prisma/non-market-data/schema.prisma` — new, Session 2-2 (F4/F5); byte-for-byte
  port of the other 26 models + all 18 enums, own `generator client` block (`output =
"../../node_modules/.prisma/non-market-client"`), plus one new model: `RefreshToken`
  (minimal 4-field stub; real shape deferred to F6/F7, Session 3-1). Session 2-3 (F20
  FK audit) removed `@relation` to `User` from `Subscription`/`Payment`/
  `FraudAlert`/`AffiliateProfile` (and `User`'s 4 reverse fields). **Session 2-4: now
  live** — consumed via `lib/db/prisma.ts`, the choke point for every other consumer
  in the app; this is also now `prisma.config.ts`'s default `schema`.
- `prisma/seed.ts` — Session 2-1: `new PrismaClient()` → `PrismaPg` driver adapter
  (mandatory in 7.8.0); `ts-node` → `tsx` for the `db:seed` script that runs it.
  **Session 2-4:** repointed from `@prisma/client` to `.prisma/non-market-client`.

</details>

<details>
<summary><code>(root)/</code> — Prisma CLI config, added Session 2-1; multi-schema generate scripts added Session 2-2; repointed off the retired default schema Session 2-4</summary>

- `prisma.config.ts` — new (Session 2-1). Replaces schema.prisma's now-removed
  `url`/`directUrl` fields (Prisma 7 moved datasource config here). Loads `.env` then
  `.env.local`; `datasource.url` = `DIRECT_URL` (CLI/migrate use, per L3) — runtime
  connection string lives in `lib/db/prisma.ts`'s adapter instead (pooled
  `DATABASE_URL`). **Session 2-4:** default `schema` field repointed from the
  now-deleted `prisma/schema.prisma` to `prisma/non-market-data/schema.prisma` (the
  larger of the two split schemas) — only matters for bare `prisma migrate`/`studio`
  invocations with no explicit `--schema` flag; the two split schemas are still
  generated via explicit `--schema=<path>` CLI flags per invocation (see below).
- `package.json` — Session 2-2: added `prisma:generate:market-data` and
  `prisma:generate:non-market-data` scripts (`prisma generate --schema=<path>` each).
  **Session 2-4:** `type-check`, `prebuild`, and `postinstall` now run explicit
  `prisma:generate:market-data` + `prisma:generate:non-market-data` calls (dropping
  the bare `prisma generate` they used to run, which resolved against the now-deleted
  default schema); `db:generate`/`prisma:generate` aliased to run both split-schema
  generates together.

</details>

#### BUSINESS FUNCTION (money-service) — 71 files

<details>
<summary><code>__tests__/lib/</code> — 19 files</summary>

- `__tests__/lib/admin/affiliate-management.test.ts`
- `__tests__/lib/affiliate/code-generator.test.ts`
- `__tests__/lib/affiliate/commission-calculator.test.ts`
- `__tests__/lib/affiliate/registration.test.ts`
- `__tests__/lib/cron/check-expiring-subscriptions.test.ts`
- `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts`
- `__tests__/lib/disbursement/constants.test.ts`
- `__tests__/lib/disbursement/providers/factory.test.ts`
- `__tests__/lib/disbursement/providers/mock.test.ts`
- `__tests__/lib/disbursement/providers/rise/webhook.test.ts`
- `__tests__/lib/disbursement/services/aggregator.test.ts`
- `__tests__/lib/disbursement/services/batch.test.ts`
- `__tests__/lib/disbursement/services/orchestrator.test.ts`
- `__tests__/lib/dlocal/constants.test.ts`
- `__tests__/lib/dlocal/currency-converter.test.ts`
- `__tests__/lib/dlocal/dlocal-payment.test.ts`
- `__tests__/lib/dlocal/payment-methods.test.ts`
- `__tests__/lib/dlocal/three-day-validator.test.ts`
- `__tests__/lib/geo/detect-country.test.ts`

</details>

<details>
<summary><code>emails/</code> — 5 files</summary>

- `emails/index.ts`
- `emails/payment-confirmation.tsx`
- `emails/payment-failure.tsx`
- `emails/renewal-reminder.tsx`
- `emails/subscription-expired.tsx`

</details>

<details>
<summary><code>lib/</code> — 1 file</summary>

- `lib/rate-limit.ts`

</details>

<details>
<summary><code>lib/admin/</code> — 3 files</summary>

- `lib/admin/affiliate-management.ts`
- `lib/admin/code-distribution.ts`
- `lib/admin/pnl-calculator.ts`

</details>

<details>
<summary><code>lib/affiliate/</code> — 9 files (Session 2-4 F22 follow-up: +1, db.ts)</summary>

- `lib/affiliate/code-generator.ts` — Session 2-4 (F22): `getAffiliateConfigFromDB`
  import repointed from `./constants` to `./db`.
- `lib/affiliate/commission-calculator.ts` — same F22 repoint.
- `lib/affiliate/constants.ts` — **Session 2-4 (F22):** the 6 DB-backed config
  functions (`getAffiliateConfigFromDB` and its 5 single-field wrappers) moved out to
  the new `lib/affiliate/db.ts`; this file no longer imports `@/lib/db/prisma` at
  all — now safe for any `'use client'` component to import (it wasn't: this file
  was F22's root cause, tainting `app/affiliate/register/page.tsx`'s client bundle
  with the `pg`/`dns` server-only dependency chain and breaking `npm run build`).
  Keeps only `AFFILIATE_CONFIG`, `CODE_GENERATION`, and types.
- `lib/affiliate/db.ts` — **new, Session 2-4 (F22).** Server-only: the 6 functions
  moved out of `constants.ts`, importing `prisma` from `@/lib/db/prisma`.
- `lib/affiliate/conversion-processor.ts` — same F22 repoint (`getBasePriceUsd`).
- `lib/affiliate/registration.ts`
- `lib/affiliate/report-builder.ts`
- `lib/affiliate/types.ts`
- `lib/affiliate/validators.ts`

</details>

<details>
<summary><code>lib/cron/</code> — 3 files</summary>

- `lib/cron/check-expiring-subscriptions.ts`
- `lib/cron/downgrade-expired-subscriptions.ts`
- `lib/cron/monthly-distribution.ts`

</details>

<details>
<summary><code>lib/disbursement/</code> — 17 files</summary>

- `lib/disbursement/constants.ts`
- `lib/disbursement/cron/disbursement-processor.ts`
- `lib/disbursement/providers/base-provider.ts`
- `lib/disbursement/providers/mock-provider.ts`
- `lib/disbursement/providers/provider-factory.ts`
- `lib/disbursement/providers/rise/amount-converter.ts`
- `lib/disbursement/providers/rise/rise-provider.ts`
- `lib/disbursement/providers/rise/siwe-auth.ts`
- `lib/disbursement/providers/rise/webhook-verifier.ts`
- `lib/disbursement/services/batch-manager.ts`
- `lib/disbursement/services/commission-aggregator.ts`
- `lib/disbursement/services/payment-orchestrator.ts`
- `lib/disbursement/services/payout-calculator.ts`
- `lib/disbursement/services/retry-handler.ts`
- `lib/disbursement/services/transaction-logger.ts`
- `lib/disbursement/services/transaction-service.ts`
- `lib/disbursement/webhook/event-processor.ts`

</details>

<details>
<summary><code>lib/dlocal/</code> — 5 files</summary>

- `lib/dlocal/constants.ts`
- `lib/dlocal/currency-converter.service.ts`
- `lib/dlocal/dlocal-payment.service.ts`
- `lib/dlocal/payment-methods.service.ts`
- `lib/dlocal/three-day-validator.service.ts`

</details>

<details>
<summary><code>lib/email/</code> — 6 files</summary>

- `lib/email/subscription-emails.ts`
- `lib/email/templates/affiliate/code-distributed.tsx`
- `lib/email/templates/affiliate/code-used.tsx`
- `lib/email/templates/affiliate/monthly-report.tsx`
- `lib/email/templates/affiliate/payment-processed.tsx`
- `lib/email/templates/affiliate/welcome.tsx`

</details>

<details>
<summary><code>lib/fraud/</code> — 1 file</summary>

- `lib/fraud/fraud-detection.service.ts`

</details>

<details>
<summary><code>lib/geo/</code> — 1 file</summary>

- `lib/geo/detect-country.ts`

</details>

<details>
<summary><code>lib/stripe/</code> — 2 files</summary>

- `lib/stripe/stripe.ts`
- `lib/stripe/webhook-handlers.ts`

</details>

### SEPARATE_STACK

<details>
<summary><code>backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/</code> — 37 files</summary>

_(Excludes `__pycache__/*.pyc` — compiled artifacts, not source. All other files under this folder are included.)_

- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/SimpleDataCollector_v2_29_ASYNC_SOCKET.ex5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/centroid_regression.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/data-split-between-mql5-and-python/Python stacks calculation.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/fractal_lines.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/install_services.bat`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionCherryPickB_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/2EDTFractalBestFitv5_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/SingleBestResistanceLinev3_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/SingleBestSupportLinev3_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/ZigZagExportv43_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/ohlcvexportlightweight_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/zscoreohlccandleexport_v2_29.mq5`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/CERTIFICATION.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/README.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/golden_certification.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/golden_certification_report_M15.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/golden_certification_report_M5.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/test_phase1_golden.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/test_phase2_lines.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mql5-to-python-transliteration/test_phase3_centroid.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mt5_api_relay_for_v2_29.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/replay_quarantine.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd_preview.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/zigzag_metrics.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/zscore_candle.py`

</details>

<details>
<summary><code>backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/</code> — 12 files</summary>

_(Excludes `__pycache__/` and `.pytest_cache/` — compiled/test-cache artifacts, not source. All other files under this folder are included.)_

- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/Multi-Timeframe-Visualisation-Architecture-Design.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/__init__.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/__main__.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/data_source.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/fixture.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/renderer.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/requirements.txt`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/src/VISUALISATION_TASK_HANDOFF.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/src/cover-prompt.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/src/mtf_demo.png`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/src/multi-timeframe-visualisation.jpg`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/test_mtf_render.py`

</details>

<details>
<summary><code>frontend/</code> — 17 files</summary>

- `frontend/app/api/payments/dlocal/[paymentId]/route.ts`
- `frontend/app/api/payments/dlocal/check-three-day-eligibility/route.ts`
- `frontend/app/api/payments/dlocal/convert/route.ts`
- `frontend/app/api/payments/dlocal/create/route.ts`
- `frontend/app/api/payments/dlocal/exchange-rate/route.ts`
- `frontend/app/api/payments/dlocal/methods/route.ts`
- `frontend/app/api/payments/dlocal/validate-discount/route.ts`
- `frontend/components/payments/index.ts`
- `frontend/lib/dlocal/constants.ts`
- `frontend/lib/dlocal/currency-converter.service.ts`
- `frontend/lib/dlocal/dlocal-payment.service.ts`
- `frontend/lib/dlocal/payment-methods.service.ts`
- `frontend/lib/dlocal/three-day-validator.service.ts`
- `frontend/lib/jobs/queue.ts`
- `frontend/lib/validations/alert.ts`
- `frontend/types/alert.ts`
- `frontend/types/dlocal.ts`

</details>

<details>
<summary><code>mt5-service/</code> — 32 files</summary>

- `mt5-service/.env.example`
- `mt5-service/Dockerfile`
- `mt5-service/REDIS-PUBLISH-SNIPPET.md`
- `mt5-service/app/__init__.py`
- `mt5-service/app/redis_pub.py`
- `mt5-service/app/routes/__init__.py`
- `mt5-service/app/routes/admin.py`
- `mt5-service/app/routes/indicators.py`
- `mt5-service/app/services/__init__.py`
- `mt5-service/app/services/health_monitor.py`
- `mt5-service/app/services/indicator_reader.py`
- `mt5-service/app/services/mt5_connection_pool.py`
- `mt5-service/app/services/tier_service.py`
- `mt5-service/app/utils/__init__.py`
- `mt5-service/app/utils/constants.py`
- `mt5-service/app/utils/symbol_resolver.py`
- `mt5-service/app/websocket.py`
- `mt5-service/config/mt5_terminals.json`
- `mt5-service/config/mt5_terminals_test.json`
- `mt5-service/docs/symbol-resolution.md`
- `mt5-service/indicators/README.md`
- `mt5-service/requirements-dev.txt`
- `mt5-service/requirements.txt`
- `mt5-service/run.py`
- `mt5-service/tests/conftest.py`
- `mt5-service/tests/mock_mt5_server.py`
- `mt5-service/tests/mt5-mock-server-integration-tests-implementation.md`
- `mt5-service/tests/test_connection_pool.py`
- `mt5-service/tests/test_indicators.py`
- `mt5-service/tests/test_mt5_integration.py`
- `mt5-service/tests/test_redis_pub.py`
- `mt5-service/tests/test_symbol_resolver.py`

</details>

<details>
<summary><code>railway-gateway/</code> — 30 files</summary>

- `railway-gateway/.env.example`
- `railway-gateway/README.md`
- `railway-gateway/docker-compose.yml`
- `railway-gateway/jest.config.js`
- `railway-gateway/nest-cli.json`
- `railway-gateway/package-lock.json`
- `railway-gateway/package.json`
- `railway-gateway/prisma/schema.prisma`
- `railway-gateway/railway.toml`
- `railway-gateway/scripts/generate-market-data-dto.js`
- `railway-gateway/scripts/seed_local_xauusd_db.py`
- `railway-gateway/src/app.module.ts`
- `railway-gateway/src/auth/api-key.guard.ts`
- `railway-gateway/src/gateway/dto/market-data.dto.ts`
- `railway-gateway/src/gateway/gateway.module.ts`
- `railway-gateway/src/gateway/market-data.controller.ts`
- `railway-gateway/src/gateway/validation.service.ts`
- `railway-gateway/src/health/health.controller.ts`
- `railway-gateway/src/health/health.module.ts`
- `railway-gateway/src/main.ts`
- `railway-gateway/src/prisma/prisma.module.ts`
- `railway-gateway/src/prisma/prisma.service.ts`
- `railway-gateway/src/worker/market-data.processor.ts`
- `railway-gateway/src/worker/worker.module.ts`
- `railway-gateway/test/dto-contract.spec.ts`
- `railway-gateway/test/jest-e2e.json`
- `railway-gateway/test/local-e2e-harness.md`
- `railway-gateway/test/market-data.e2e-spec.ts`
- `railway-gateway/test/validation.service.spec.ts`
- `railway-gateway/tsconfig.json`

</details>

<details>
<summary><code>operation-service/</code> — 17 files (new, Session 3-1)</summary>

CORE service (see line ~114 above) — NestJS 11.1.28 (not railway-gateway's 10.4.15, F2).
Scaffolded this session: auth bridge only (`JwtAuthGuard` verifying NextAuth's JWE session
token, F6/F7). Alert-engine/drawing-persistence logic is later-phase BUILD work, not yet
ported. Not yet deployed to Railway (staging-target question open, see the order's
Deviations) — code-complete and locally verified only.

- `operation-service/.env.example`
- `operation-service/jest.config.js`
- `operation-service/nest-cli.json`
- `operation-service/package-lock.json`
- `operation-service/package.json`
- `operation-service/prisma/schema.prisma` (generate-only, zero models this session — see
  order Deviations)
- `operation-service/railway.toml` (committed as-code, not yet applied to Railway)
- `operation-service/src/app.module.ts`
- `operation-service/src/auth/jwt-auth.guard.spec.ts`
- `operation-service/src/auth/jwt-auth.guard.ts`
- `operation-service/src/auth/next-auth-jwt.util.ts`
- `operation-service/src/health/health.controller.ts` (`/health`, `/health-auth`)
- `operation-service/src/health/health.module.ts`
- `operation-service/src/main.ts`
- `operation-service/src/prisma/prisma.module.ts`
- `operation-service/src/prisma/prisma.service.ts`
- `operation-service/tsconfig.json`

</details>

<details>
<summary><code>operation-service/src/auth/</code> — 10 new files + 4 modified (Session 3-2, token endpoints)</summary>

`/auth/{register,login,refresh,logout,me}` — additive only, not yet called by anything
live (Session 3-3 wires the Next.js side). F23 (RefreshToken hardened: hashed-at-rest +
revocable) and F24 (issues NextAuth-compatible JWEs) both resolved by Davin,
`DECISION-LOG.md`. Of the order's 6-file candidate port list, only 2 were actually
needed (`errors.ts` full port, `auth-options.ts`'s `authorize()` logic copied into
`auth.service.ts`) — `two-factor.ts`/`session-tracker.ts`/`permissions.ts`/`session.ts`
traced to not being in this session's actual call path; see the order's Deviations.

New:

- `operation-service/src/auth/errors.ts` (full port of `lib/auth/errors.ts`, plus new
  `TwoFactorRequiredError`)
- `operation-service/src/auth/auth-error.filter.ts`
- `operation-service/src/auth/next-auth-jwt-encode.util.ts` (F24 — encode half, mirrors
  `next-auth-jwt.util.ts`'s existing decode half)
- `operation-service/src/auth/refresh-token.service.ts` + `.spec.ts`
- `operation-service/src/auth/auth.service.ts` + `.spec.ts`
- `operation-service/src/auth/auth.controller.ts`
- `operation-service/src/auth/auth.module.ts`
- `operation-service/src/auth/dto/register.dto.ts`
- `operation-service/src/auth/dto/login.dto.ts`
- `operation-service/src/auth/dto/refresh.dto.ts` (reused for both `/refresh` and
  `/logout` — identical `{ refreshToken }` shape)

Modified:

- `operation-service/prisma/schema.prisma` (zero models -> hand-copied narrow `User` +
  `RefreshToken`, see the order's Deviations for the narrow-vs-full-model call)
- `operation-service/src/app.module.ts` (registers `AuthModule`)
- `operation-service/package.json` (added `bcryptjs`, `jsonwebtoken` + their `@types`)
- `prisma/non-market-data/schema.prisma` (`RefreshToken` hardened per F23)

New root migration:

- `prisma/migrations/20260721000000_add_refresh_token_table/` — applied to production
  (Davin-approved). Pure `CREATE TABLE`, not `ALTER` — the table never actually existed
  in production despite the model being declared since Session 2-2 (confirmed via a live
  `pg_tables` query; no prior migration ever created it).

</details>

<details>
<summary>FRONTEND — 11 new files + 1 modified (Session 3-3, Next.js token bridge)</summary>

Additive parallel path alongside `app/api/auth/[...nextauth]/route.ts` (bridge-first,
F6) — `components/auth/login-form.tsx`/`register-form.tsx` still call
`next-auth/react`'s `signIn()` unchanged; a dedicated cutover session (Davin's live
approval) switches real traffic onto this path later. `middleware.ts` is this repo's
first-ever Next.js middleware — additive, not a cutover: it decodes the exact same
cookie `app/(dashboard)/layout.tsx` already reads via `getServerSession`, in the exact
format NextAuth itself uses (F26), so every existing real user's session passes
through it unchanged; local walkthrough evidence in the order's Deviations #6.

New:

- `lib/operation-service/client.ts` (server-only fetch helper — SSR/route-handler
  callers only, never the browser; sidesteps operation-service's CORS entirely)
- `lib/operation-service/cookies.ts` (shared cookie name/attribute constants —
  imported by both route handlers and `middleware.ts`, so Edge-runtime-safe: no
  Node-only APIs)
- `app/api/auth/token-login/route.ts` (cookie-set login; passes through
  `twoFactorRequired` unmodified — same two-step flow the existing NextAuth path uses)
- `app/api/auth/token-refresh/route.ts` (rotates both cookies; clears them on a failed
  rotation)
- `app/api/auth/token-logout/route.ts` (idempotent; clears cookies even if
  operation-service is unreachable)
- `components/auth/token-refresh-provider.tsx` (client-side ~14 min interval, mounted
  in `(dashboard)/layout.tsx`; fire-and-forget, ignores every outcome — a no-op for any
  session that only carries a NextAuth cookie)
- `middleware.ts` (guards `/dashboard`, `/alerts`, `/charts`, `/settings` — deliberately
  excludes `/admin`, see the order's Deviations #2 for the separate `app/admin/login`
  conflict found at build time)
- `__tests__/api/auth/token-login.test.ts`, `token-refresh.test.ts`,
  `token-logout.test.ts`, `__tests__/middleware.test.ts`

Modified:

- `app/(dashboard)/layout.tsx` (mounts `<TokenRefreshProvider />` alongside the
  existing `<LoginTracker />`)
- `.env.example` / `.env.local` (new `OPERATION_SERVICE_URL`, server-only — no
  `NEXT_PUBLIC_` prefix)

</details>

<details>
<summary><code>operation-service/</code> + FRONTEND — Session 3-4 (2FA, forgot/reset-password, verify/resend-email ported; CORS confirmed a non-step, F30)</summary>

`lib/auth/two-factor.ts`, `lib/email/email.ts` (full port, F29), and the
`app/api/auth/{forgot-password,reset-password,verify-email,resend-verification}/route.ts`

- `app/api/user/2fa/{setup,verify-setup,verify,backup-codes,disable}/route.ts` logic all
  ported into new operation-service endpoints. Additive-only, same bridge-first posture as
  every prior 3-x session — none of these are wired into any live frontend form yet. F30
  (CORS): confirmed a non-step, `main.ts`'s `ALLOWED_ORIGINS` left unchanged, since the new
  Next.js routes proxy server-side exactly like Session 3-3's did (no browser ever talks to
  operation-service directly).

**Real gap found and fixed, not scope creep:** `operation-service/prisma/schema.prisma`
(the hand-maintained, generate-only narrow mirror of `prisma/non-market-data/schema.prisma`
— see its own header comment) was missing `resetToken`/`resetTokenExpiry`/
`twoFactorSecret`/`twoFactorBackupCodes`/`twoFactorVerifiedAt` on `User` and had no
`SecurityAlert` model at all. Extended it (narrow subset, same convention as the existing
`User`/`RefreshToken` mirror) rather than switching to the full schema — this is the same
"must be mirrored here by hand" maintenance burden the file's own comment already flags,
now paid down for this session's fields.

New (operation-service):

- `operation-service/src/email/email.util.ts` (full verbatim port of `lib/email/email.ts`,
  F29 — includes templates not yet called by anything in this service, matching how
  `errors.ts` was ported in Session 3-2)
- `operation-service/src/two-factor/two-factor.util.ts` (full verbatim port of
  `lib/auth/two-factor.ts`)
- `operation-service/src/security/geo-location.util.ts` (narrow port of
  `lib/security/device-detection.ts` — only `getGeoLocation`/`formatLocation`, the two
  functions the 2FA security-alert emails actually need)
- `operation-service/src/auth/two-factor.service.ts` + `.spec.ts`
- `operation-service/src/auth/two-factor.controller.ts` (`@Controller('auth/2fa')`)
- `operation-service/src/auth/dto/forgot-password.dto.ts`,
  `reset-password.dto.ts`, `resend-verification.dto.ts`,
  `two-factor-verify-setup.dto.ts`, `two-factor-verify.dto.ts`,
  `two-factor-backup-codes.dto.ts`, `two-factor-disable.dto.ts`
- `operation-service/src/auth/auth.service.email-flows.spec.ts`

Modified (operation-service):

- `operation-service/prisma/schema.prisma` (extended `User` + new narrow `SecurityAlert`
  mirror — see finding above)
- `operation-service/src/auth/auth.service.ts` (+ `forgotPassword`/`resetPassword`/
  `verifyEmail`/`resendVerification`)
- `operation-service/src/auth/auth.controller.ts` (+ 4 new endpoints)
- `operation-service/src/auth/auth.module.ts` (registers `TwoFactorController`/
  `TwoFactorService`)
- `operation-service/src/auth/auth-error.filter.ts` (`RateLimitError` now carries
  `retryAfter` in its JSON body)
- `operation-service/package.json` (added `otplib`, `qrcode` + `@types/qrcode`, `resend`)
- `operation-service/.env.example` (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`/
  `RESEND_REPLY_TO`/`NEXTAUTH_URL`/`TWO_FACTOR_ENCRYPTION_KEY`)

New (FRONTEND):

- `app/api/auth/token-forgot-password/route.ts`, `token-reset-password/route.ts`,
  `token-verify-email/route.ts` (GET), `token-resend-verification/route.ts`
- `app/api/auth/token-2fa-status/route.ts` (GET), `token-2fa-setup/route.ts`,
  `token-2fa-verify-setup/route.ts`, `token-2fa-verify/route.ts` (unauthenticated —
  completes login itself, same as its source route), `token-2fa-backup-codes/route.ts`
  (GET+POST), `token-2fa-disable/route.ts`
- `__tests__/api/auth/token-email-flows.test.ts`, `token-2fa-flows.test.ts`

Modified (FRONTEND):

- `lib/operation-service/client.ts` (`OperationServiceErrorBody` gained an optional
  `retryAfter` field)

</details>

### SHARING

<details>
<summary><code>(root)/</code> — 4 files</summary>

- `.dockerignore`
- `components.json`
- `jest.config.js`
- `tsconfig.json`

</details>

<details>
<summary><code>.github/</code> — 11 files</summary>

- `.github/workflows/api-tests.yml`
- `.github/workflows/bundle-monitor.yml`
- `.github/workflows/ci-nextjs-progressive.yml`
- `.github/workflows/dependencies-security.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/e2e-tests.yml`
- `.github/workflows/load-test.yml`
- `.github/workflows/mt5-pipeline-tests.yml`
- `.github/workflows/openapi-validation.yml`
- `.github/workflows/security-checks.yml`
- `.github/workflows/tests.yml`

</details>

<details>
<summary><code>davintrade-draw-engine-and-line-alerts-stack/</code> — 4 files</summary>

- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`
- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/Drawing-Engine-Line-Alerts-Architecture-Overview.pptx`
- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/PHASE-4-SMOKE-TEST-RUNBOOK.md`
- `davintrade-draw-engine-and-line-alerts-stack/implementation-progress/implementation-progress-files-and-folder-directory.txt`

</details>

<details>
<summary><code>docs/</code> — 12 files (this snapshot predates most of `open-api-documents/`; only
the subset relevant when last taken is listed — see the directory itself for the
current full set, still 21 files across `part-02`…`part-23`, Session 0-3 touched
content not file count)</summary>

- `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md`
- `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md`
- `docs/secret-matrix.md` (new, Session 0-4 — per-service secret/env-var name catalog,
  names only; documents 3 completeness gaps found in `.env.example` vs. live code)
- `docs/migration-test-baseline.md` (new, Session 0-4 — 114 suites / 2075 tests, all
  passed; mocked-vs-integration characterization per L1)
- `docs/open-api-documents/part-02-database-schema-openapi.yaml`
- `docs/open-api-documents/part-03-types-openapi.yaml`
- `docs/open-api-documents/part-04-tier-system-openapi.yaml` (regenerated Session 0-2 — V8 model)
- `docs/open-api-documents/part-07-indicators-tier-openapi.yaml`
- `docs/open-api-documents/part-12-ecommerce-billing-openapi.yaml` (regenerated Session
  0-3 — sole owner of checkout/subscription/invoices/webhooks-stripe/2 subscription
  crons + daily-maintenance; dLocal payment routes removed, now solely in part-18)
- `docs/open-api-documents/part-14-admin-dashboard-openapi.yaml` (regenerated Session
  0-3 — sole owner of all 19 `admin/**` routes, absorbed fraud-alerts from part-18,
  added the `code-flows` gap)
- `docs/open-api-documents/part-15-notifications-realtime-openapi.yaml`
- `docs/open-api-documents/part-17-affiliate-openapi.yaml` (regenerated Session 0-3 —
  fixed a repo-wide missing-`/api`-prefix bug, sole owner of affiliate portal +
  config/affiliate + 3 affiliate-code crons; admin/checkout/disbursement duplicates removed)
- `docs/open-api-documents/part-18-dlocal-payment-openapi.yaml` (regenerated Session
  0-3 — sole owner of payments/dlocal/\* + webhooks/dlocal; fraud-alerts and 2
  subscription crons removed, now solely in part-14/part-12)
- `docs/open-api-documents/part19-disbursement-openapi.yaml` (field-accuracy pass,
  Session 0-3 — scope was already correct sole-owner, no routes moved)
- `docs/open-api-documents/part-21-drawings-openapi.yaml` (new, Session 0-2)
- `docs/open-api-documents/part-22-user-account-openapi.yaml` (new, Session 0-2)
- `docs/open-api-documents/part-23-market-data-channel-openapi.yaml` (new, Session 0-2;
  extended Session 0-3 with `/api/candles/{symbol}`, a previously undocumented
  unauthenticated leftover-domain route)

</details>

<details>
<summary><code>scripts/</code> — 18 files (was 19; `alert-worker.ts` retired Session 4B-3, 2026-08-01)</summary>

- `scripts/archive-docs.sh`
- `scripts/check-coverage.js`
- `scripts/check-sync-needed.js`
- `scripts/collect-metrics.sh`
- `scripts/deploy-part20.sh`
- `scripts/health-check-ui.js`
- `scripts/health-check-ui.sh`
- `scripts/monitor-mt5-pipeline.ts`
- `scripts/rollback-to-part6.sh`
- `scripts/run-all-tests.sh`
- `scripts/setup-e2e.sh`
- `scripts/sync-frontend.sh`
- `scripts/test-mt5-deployment.ts`
- `scripts/test-prisma5-upgrade.ts`
- `scripts/validate-file.js`
- `scripts/validate_sqlite.py`
- `scripts/verify-alignment.sh`
- `scripts/verify-build-orders.sh`

</details>

<details>
<summary><code>packages/types/</code> — 14 files (new, Session 4B-1, F9 resolution)</summary>

- `packages/types/package.json` (exports geometry/alert-engine/validations subpaths + root barrel;
  `typesVersions` for classic-resolution consumers, e.g. `operation-service` — `LESSONS-LEARNED.md` L39)
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts` (root barrel)
- `packages/types/src/geometry/index.ts` (barrel, hoisted from `components/charts/drawing/geometry/index.ts`)
- `packages/types/src/geometry/types.ts` (`Anchor`, `AlertLevel`, `DrawingStyle`, `DrawingType`, `LineStyle`, `MarkSnapshot`)
- `packages/types/src/geometry/channel.ts` (`channelLevels`)
- `packages/types/src/geometry/fib.ts` (`fibRetracementLevels`, `fibExtensionLevels`)
- `packages/types/src/geometry/horizontal.ts` (`horizontalValue`)
- `packages/types/src/geometry/trendline.ts` (`trendlineValueAt`)
- `packages/types/src/geometry/levels.ts` (`levelsForMark` — the F9 cross-stack wrinkle this
  package exists to resolve; single source of truth for the monolith's chart UI AND, from Session
  4B-2, `operation-service`'s ported alert engine)
- `packages/types/src/alert-engine/types.ts` (`Direction`, `PriceEvent`, `AlertWatch`, `FireEvent`,
  hoisted from `lib/alert-engine/types.ts`)
- `packages/types/src/validations/alert.ts` (`SYMBOLS`/`TIMEFRAMES`/`CONDITION_TYPES` + Zod schemas,
  hoisted from `lib/validations/alert.ts`)

`components/charts/drawing/geometry/*.ts` (7 files) and `lib/alert-engine/types.ts` /
`lib/validations/alert.ts` (2 files) all became thin re-export shims pointing here — not deleted,
since several files import individual geometry submodules directly by relative path (see this
session's own Deviations). `operation-service` consumes this package via a `file:../packages/types`
dependency (its Railway deploy-time resolution is an open follow-up, not yet a workspace member).

</details>

<details>
<summary><code>operation-service/src/alert-engine/</code> + <code>src/redis/</code> + <code>src/main-worker.ts</code> — 27 new files (Session 4B-2, alert engine BUILD)</summary>

Ports the monolith's `lib/alert-engine/*` (9 files) + `lib/jobs/{alert-checker,queue}.ts` +
`lib/validations/alert.ts` + `scripts/alert-worker.ts` into `operation-service` as an
`@Injectable()` NestJS domain module + a standalone worker entrypoint. Zero production traffic cut
over this session (cutover is Session 4B-3) — SOURCE files untouched, byte-identical, become
CC-F change-frozen once 4B-3's mirror-run starts.

- `src/redis/redis.service.ts` + `redis.module.ts` (new — operation-service had no shared Redis
  provider before this session; mirrors `lib/redis/client.ts`'s `getRedisClient()` connection
  options as a `@Global()` NestJS singleton)
- `src/alert-engine/validations/alert.ts` (+ `.spec.ts`, 28 tests) — re-exports
  `@trading-alerts/types/validations` (File 1/13)
- `src/alert-engine/types.ts` — re-exports `@trading-alerts/types/alert-engine` (File 2/13)
- `src/alert-engine/detect.ts` (+ `.spec.ts`, 9 tests) — pure cross/touch detection, unchanged
  (File 3/13)
- `src/alert-engine/state.ts` — `AlertStateStore` (Redis + in-memory impls), unchanged (File 4/13)
- `src/alert-engine/watches.ts` (+ `.spec.ts`, 4 tests) — imports `levelsForMark`/`MarkSnapshot`
  directly from `@trading-alerts/types/geometry`, zero math duplication (File 5/13)
- `src/alert-engine/evaluator.ts` (+ `.spec.ts`, 7 tests) — pure orchestration, DI'd state/dispatch
  (File 6/13)
- `src/alert-engine/notify-bridge.service.ts` (+ `.spec.ts`, 3 tests) — publisher half only
  (subscriber stays in the monolith web process until 4B-17/F8); built ahead of File 7 since
  dispatcher depends on it (File 11/13)
- `src/alert-engine/dispatcher.service.ts` (+ `.spec.ts`, 4 tests) — `@Injectable()`, `PrismaService`
  - `NotifyBridgeService` injected; also the CC-B pino/correlation-ID integration point (File 7/13)
- `src/alert-engine/alert-queue.service.ts` (+ `.spec.ts`, 3 tests) — BullMQ wrapper, queue renamed
  `op.alerts.fire` (CC-E); worker start is explicit (`startWorker()`), never auto-invoked (File 8/13)
- `src/alert-engine/alert-checker.service.ts` (+ `.spec.ts`, 20 tests) — `@Injectable()` periodic
  checker; 0.5%/XAUUSD-gateway-fallback/isActive invariants preserved exactly (File 9/13)
- `src/alert-engine/alert-cron.scheduler.ts` (+ `.spec.ts`, 5 tests) — `@Interval(60_000)` replaces
  the `setInterval` loop; `isRunning` guard preserved; new `active`/`enable()` gate prevents
  double-scheduling across the HTTP and worker processes sharing one module graph (File 10/13)
- `src/alert-engine/alert-worker.service.ts` (+ `.spec.ts`, 8 tests) — two dedicated Redis
  connections (subscriber + ops), matching source's topology exactly; `start()`/`stop()` explicit,
  `OnModuleDestroy` drains automatically via `enableShutdownHooks()` (File 12/13)
- `src/alert-engine/alert-engine.module.ts` — registers all the above; imported into the shared
  `app.module.ts` (File 12/13)
- `src/alert-engine/alert-engine.logger.ts` — pino + per-fire correlation IDs, scoped to the
  dispatch path only (CC-B); first pino usage anywhere in this monorepo (File 12/13)
- `src/main-worker.ts` — standalone worker entrypoint (`NestFactory.createApplicationContext`),
  `app.enableShutdownHooks()`; the only code path that calls `AlertWorkerService.start()`/
  `AlertCronScheduler.enable()` (File 12/13)

**Modified:** `operation-service/prisma/schema.prisma` (additive: `Alert`, `Notification`,
`DrawingAlert`, `Drawing` — the latter two not in the order's own Step 0 list, found while porting
File 12 — and a narrow-subset `MarketDataV6`), `operation-service/src/app.module.ts` (registers
`RedisModule` + `AlertEngineModule`), `operation-service/package.json` (adds `bullmq`,
`@nestjs/bullmq`, `@nestjs/schedule`, `pino`), `operation-service/.env.example` (`MT5_API_URL`,
`ALERT_USE_QUEUE`, `EVAL_ON_FINAL_BAR_ONLY`, `ALERT_FIRE_CONCURRENCY`).

Full test suite: 21/21 suites, 177/177 tests (was 11/11, 86/86 at 4B-1's close). `nest build` /
`tsc --noEmit` clean. Monolith unchanged, `tsc --noEmit` clean, `test:ci` 122/122 suites, 2138/2138
tests (identical to the pre-session baseline).

</details>

<details>
<summary><code>operation-service/src/{otel.ts,common/,cache/}</code> + <code>money-service/src/{otel.ts,redis/,common/,cache/}</code> — 26 new files (Session 4B-4, shared infra & observability, F13)</summary>

INFRA session (F13 Option C: OTel SDK + OTLP HTTP exporter + Pino correlation logging + shared
`CacheService` + `AllExceptionsFilter`) — zero production traffic behavior change, all additive
providers/middleware. F13 RESOLVED.

**operation-service (12 new files):**

- `src/otel.ts` — `initOtel(serviceName)`, `NodeSDK` + `getNodeAutoInstrumentations`
  (HTTP/Express/ioredis; no Prisma instrumentation available in the installed auto-instrumentations
  version, see the order's own Deviations #2); silent (no exporter wired) when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, matching both services' real production today
- `src/common/context/log-context.ts` — shared `AsyncLocalStorage` correlation-ID store +
  active-OTel-span trace/span-ID reader
- `src/common/logging/{pino-instance,logging.service,logging.module}.ts` — single shared root pino
  instance (custom ISO `timestamp` field, `service`/`correlationId`/`traceId`/`spanId` via
  `mixin()`) + `PinoLoggerService implements LoggerService`, wired app-wide via
  `app.useLogger()`
- `src/common/middleware/correlation-id.middleware.ts` (+ `.e2e.spec.ts`, 3 tests) — extracts/
  generates `x-correlation-id`, binds to the AsyncLocalStorage context, registered globally via
  `'/{*splat}'` (Express 5/path-to-regexp v8's wildcard, not the removed bare `'*'`)
- `src/cache/{cache.service,cache.module}.ts` (+ `.spec.ts`, 9 tests) — `get`/`set`/`del`/`ttl`/
  `flushPattern` (SCAN-based, not KEYS) over the existing `RedisService`, `op:cache:` key prefix
- `src/common/filters/all-exceptions.filter.ts` (+ `.e2e.spec.ts`, 3 tests) — global `APP_FILTER`,
  unified error JSON shape; coexists with the pre-existing route-scoped `AuthErrorFilter`

**Modified:** `src/app.module.ts` (registers `LoggingModule`/`CacheModule`, `NestModule.configure()`
for the middleware, `APP_FILTER`), `src/main.ts` + `src/main-worker.ts` (otel import first line,
`bufferLogs`+`useLogger`), `src/alert-engine/alert-engine.logger.ts` (now
`rootPinoLogger.child({name: 'alert-engine'})` instead of its own separate `pino()` root),
`package.json` (+`@opentelemetry/{sdk-node,auto-instrumentations-node,exporter-trace-otlp-http,
resources,semantic-conventions,api}`), `.env.example` (3 OTel vars, commented).

**money-service (14 new files — the same 12 above, plus):**

- `src/redis/{redis.service,redis.module}.ts` — money-service had no shared Redis provider before
  this session; byte-for-byte matches operation-service's own implementation

**Modified:** `src/app.module.ts` (same additions as operation-service, plus registers the new
`RedisModule`), `src/main.ts` (otel import, `bufferLogs`+`useLogger` — no `main-worker.ts` exists
for this service), `src/common/logger.util.ts` (now delegates to `rootPinoLogger` instead of
`console.log`, same call shape for ~20 existing consumers), `src/common/idempotency/
idempotency.store.ts` (+ `.spec.ts`, rewritten) — now injects `RedisService` instead of its own
dedicated connection, collapsing 4 separate per-module Redis connections (admin/disbursement/
dlocal/stripe all separately `provide`d `IdempotencyStore`) into the one shared client,
`package.json` (same OTel deps as operation-service, no `pino` addition needed — already present),
`.env.example` (3 OTel vars, commented).

Test suites: `operation-service` 21/21→24/24 (+3 new spec files), `money-service` 59/59→62/62 (+3
new spec files). `nest build`/`tsc --noEmit` clean both, throughout. Monolith unchanged (`git
status` confirms zero source files touched), `tsc --noEmit` clean.

</details>

<details>
<summary><code>operation-service/src/alerts/</code> — 12 new files (Session 4B-5, Alerts CRUD PORT)</summary>

PORT session — ports `app/api/alerts/route.ts`, `app/api/alerts/[id]/route.ts`,
`app/api/alerts/line/route.ts`, `app/api/alerts/line/[id]/route.ts` (971 lines total) into
`operation-service`. Zero traffic cut over (`MIGRATE_ALERTS_CRUD` not introduced yet — Session 4B-6's
own scope, per `LESSONS-LEARNED.md` L31), zero monolith files touched.

- `alerts.module.ts` — registers `AlertsController`/`LineAlertsController` +
  `AlertsService`/`LineAlertsService`; `PrismaModule`/`RedisModule` are `@Global()`, no explicit
  import needed
- `alerts.controller.ts` + `alerts.service.ts` (+ `.spec.ts` each) — plain (price) alerts:
  `GET/POST /alerts`, `GET/PATCH/DELETE /alerts/:id`. Real ground truth: FREE tier hard-blocked at 0
  alerts, PRO limit 100 (order originally cited wrong numbers, corrected at CONFIRM); `DELETE` is a
  real hard delete (`prisma.alert.delete()`, not the SOURCE's own stale "soft delete" comment); no
  `alerts:changed` Redis publish (SOURCE never does, no live consumer for plain `Alert` rows either)
- `line-alerts.controller.ts` + `line-alerts.service.ts` (+ `.spec.ts` each) — line-touch alerts:
  `GET/POST /alerts/line`, `PATCH/DELETE /alerts/line/:id`. Atomic `Alert`+`DrawingAlert` creation,
  PRO-tier gate on attach/PATCH (DELETE open to all tiers), `alerts:changed` published on
  create/update/delete (real consumer: `AlertWorkerService.reload()`). "Reject TEXT drawings" ported
  as the real, more general `levelsForMark()`-returns-zero-levels check, not a hardcoded type
  comparison
- `alerts.schemas.ts` — route-local plain-alert Zod schemas (3 condition types), deliberately
  distinct from `@trading-alerts/types`'s broader `createAlertSchema`/`updateAlertSchema` (5 condition
  types, used by the alert-engine's own internal validation, Session 4B-2) — two independent
  "create alert" schemas already existed in this codebase; conflating them would have silently
  changed accepted input
- `dto/alert.dto.ts` — type-only re-exports for controller/service signatures

**New shared infra:** `operation-service/src/common/pipes/zod-validation.pipe.ts` — validates a
request body against a canonical Zod schema per-route (`@UsePipes()`), preserving
`AlertAttachZ`/`AlertUpdateZ`'s real default-value/refinement behavior exactly rather than
hand-translating into class-validator decorators; a new, reusable pattern for future sessions.

**`packages/types` (root + `operation-service`'s embedded copy, commit `87242f09`) additive
exports:** `AlertAttachZ`, `AlertUpdateZ`, `ALERT_TIER_LIMITS`, `getAlertLimit()` — hoisted from
`lib/drawing/schema.ts`/`lib/tier-validation.ts` (byte-identical). Found and fixed mid-session:
`operation-service`'s embedded copy has no automated sync from the root package — the root hoist
alone left it stale, manually synced this session (see order Deviations).

Test suites: `operation-service` 24/24→28/28 (+4 new spec files, 42 new tests). `nest build`/
`tsc --noEmit` clean. Monolith unchanged (`git status` confirms zero files touched under `app/`,
`lib/`, `__tests__/`, `components/`), `tsc --noEmit` clean.

</details>

<details>
<summary><code>operation-service/src/drawings/</code> — 6 new files + `app.module.ts` modified (Session
4B-8, Drawings PORT+CUTOVER combined)</summary>

PORT+CUTOVER session (a deliberate deviation from the 3-way split every prior slice used — smaller
blast radius, 2 files, no payment/webhook surface). Ports `app/api/drawings/route.ts` (159 lines) +
`app/api/drawings/[id]/route.ts` (147 lines, 306 total) into `operation-service`, AND wires + cuts
over the monolith side in the same session. `MIGRATE_DRAWINGS=true` in Vercel production —
**CUT-OVER & LIVE, verification partial (create only, see `CLAUDE.md`/cutover table).**

- `drawings.module.ts` — registers `DrawingsController`/`DrawingsService`; `PrismaModule`/
  `RedisModule` are `@Global()`, no explicit import needed, registered in `AppModule`
- `drawings.controller.ts` + `drawings.service.ts` (+ `.spec.ts` each) — `GET/POST /drawings`,
  `PATCH/DELETE /drawings/:id`. Symbol/timeframe access re-implemented locally against
  `@trading-alerts/types/validations`'s `SYMBOLS`/`TIMEFRAMES` (`operation-service` cannot import
  monolith `lib/*` directly) — replicates `lib/tier-validation.ts`'s `canAccessSymbol()`/
  `validateTimeframeAccess()` exact tier-independent V8 logic and exact reason strings, per Davin's
  explicit mid-session instruction. Quota `FREE`: 10, `PRO`: 200 (`DRAWING_LIMITS`, matches
  `lib/drawing/schema.ts` exactly). Parameter-level `ZodValidationPipe` only (L45 rule) — never
  method-level `@UsePipes()`, the exact bug class that broke Alerts CRUD for ~5h in Session 4B-7.
  Publishes `alerts:changed` on update/delete (real consumer: `AlertWorkerService.reload()`)
- `drawings.schemas.ts` — mirrors `lib/drawing/schema.ts`'s `DrawingCreateZ`/`DrawingUpdateZ`
  verbatim (type enum, anchor-count-per-type refinement, `#RRGGBB` style validation)
- `dto/drawing.dto.ts` — type-only re-exports for controller/service signatures

**Monolith side (same session, not split out):** `lib/operation-service/flags.ts` gained
`shouldUseOperationServiceForDrawings()`; both `app/api/drawings/*` route files wired to check it
immediately after existing session auth and forward via `forwardRequestToOperationService()`,
preserving status codes. `app/api/drawings/[id]/route.ts`'s `DELETE` handler's previously-unused
`_request` renamed to `request` (needed by the forwarder) — same safe, zero-risk widening as
Sessions 4A-10a/4B-6.

Test suites: `operation-service` 28/28→30/30 (+2 new spec files, 19 new tests). `nest build`/
`tsc --noEmit` clean. Monolith `test:ci` 120/120 suites, 2129/2129 tests unchanged; `tsc --noEmit`/
`npm run build` clean.

</details>

<details>
<summary><code>lib/operation-service/</code> — 3 new files + 4 modified route files (Session 4B-6,
Alerts CRUD monolith transport)</summary>

PORT/UI-BUILD session — monolith-side flag-check + forwarding layer for the 4 Alerts CRUD routes
ported to `operation-service` in Session 4B-5. Zero traffic cut over (`MIGRATE_ALERTS_CRUD` is set
nowhere; cutover is Session 4B-7).

- `lib/operation-service/flags.ts` (modified) — `+shouldUseOperationServiceForAlertsCrud()`,
  defaults `false`, distinct from the pre-existing `shouldUseOperationServiceForAlerts()` (Slice 6
  evaluation gate, unrelated)
- `lib/operation-service/client.ts` (modified) — `+getOperationServiceToken()` (reads the same
  NextAuth session JWE cookie the F45-class server-side-proxy bridge already forwards elsewhere),
  `+callOperationServiceWithTokenStatus()` (new — surfaces the real response status alongside the
  body, needed so a forwarded `POST /alerts`/`POST /alerts/line` create's `201 Created` survives
  the proxy hop instead of silently becoming `200`)
- `lib/operation-service/write-routes.ts` (new) — `forwardRequestToOperationService()`, a single
  generic proxy for all 4 routes (method/body/`x-correlation-id` forwarded, session token attached
  as Bearer auth), mirrors `lib/money-service/write-routes.ts`'s shape (Session 4A-10a)
- `app/api/alerts/route.ts`, `app/api/alerts/[id]/route.ts`, `app/api/alerts/line/route.ts`,
  `app/api/alerts/line/[id]/route.ts` (all modified) — each handler checks the flag immediately
  after its existing auth check (before any tier/validation/quota logic operation-service's own
  controllers already re-implement), forwards when on, falls through to unchanged Prisma logic
  when off. 3 previously-unused `_request` params renamed to `request` (GET/DELETE on `[id]`,
  DELETE on `line/[id]`) — same safe-widening precedent as Session 4A-10a.

**New test coverage:** `__tests__/lib/operation-service/write-routes.test.ts` (9 tests, the
transport helper itself), 12 new tests added to `__tests__/api/alerts.test.ts` (the 2 plain-alert
routes), and new `__tests__/api/alerts-line.test.ts` (16 tests) — the FIRST test coverage ever
authored against the 2 line-alert server route handlers; CONFIRM found the order's own cited
"Verification" file (`__tests__/drawing/alertsApi.test.ts`) only tests a client-side fetch wrapper
and never imports either handler.

Test suites: monolith 118/118→120/120 (+2 new spec files), 2096/2096→2129/2129 tests. `tsc
--noEmit`/`eslint app components lib hooks --max-warnings 0` clean. `operation-service` unchanged
(`git status` confirms zero files touched).

</details>

<details>
<summary><code>types/</code> — 11 files</summary>

- `types/alert.ts`
- `types/api.ts`
- `types/disbursement.ts`
- `types/dlocal.ts`
- `types/index.ts`
- `types/indicator.ts`
- `types/next-auth.d.ts`
- `types/payment.ts`
- `types/prisma-stubs.d.ts`
- `types/tier.ts`
- `types/user.ts`

</details>

### TEST

<details>
<summary><code>__tests__/</code> — 1 file</summary>

- `__tests__/setup.ts`

</details>

<details>
<summary><code>__tests__/e2e/</code> — 1 file</summary>

- `__tests__/e2e/dlocal-payment-flow.test.ts`

</details>

<details>
<summary><code>__tests__/helpers/</code> — 1 file</summary>

- `__tests__/helpers/supertest-setup.ts`

</details>

<details>
<summary><code>__tests__/integration/</code> — 1 file</summary>

- `__tests__/integration/payment-creation.test.ts`

</details>

<details>
<summary><code>__tests__/types/</code> — 2 files</summary>

- `__tests__/types/disbursement.test.ts`
- `__tests__/types/dlocal.test.ts`

</details>

<details>
<summary><code>money-service/</code> — 17 files (new, Session 4A-1)</summary>

BUSINESS FUNCTION service (see line ~114 above) — NestJS 11.1.28 / Prisma 7.8.0, same pins
as operation-service (F2/F19). Scaffolded and deployed this session: skeleton only — `/health`,
NextAuth JWE auth guard (same F6/F7 bridge, ported from operation-service), Prisma service
authenticating as the `money_svc` role through PgBouncer (proven live in production this
session), Redis wired under the `money.*` namespace (F15, shared instance with
operation-service, not a dedicated one). No domain business logic yet — affiliate/billing/
payments/disbursement/scheduler modules are later BUILD sessions, 4A-4 onward; their folders
were deliberately not pre-stubbed (see the order's Deviations). Prisma schema is still
model-less (generate-only, zero models — same convention operation-service's own
schema.prisma started with). Deployed to Railway (`money-service-production.up.railway.app`);
custom domain (`money.<domain>` per F16) not yet bound (DNS is Davin's action, same
unresolved gap operation-service has always had).

- `money-service/.env.example`
- `money-service/jest.config.js`
- `money-service/nest-cli.json`
- `money-service/package-lock.json`
- `money-service/package.json`
- `money-service/prisma/schema.prisma` (generate-only, zero models this session — same
  as operation-service's own starting point)
- `money-service/railway.toml` (committed as-code; deployed this session, unlike
  operation-service's own railway.toml which was committed a session before its first deploy)
- `money-service/src/app.module.ts`
- `money-service/src/auth/jwt-auth.guard.spec.ts`
- `money-service/src/auth/jwt-auth.guard.ts`
- `money-service/src/auth/next-auth-jwt.util.ts`
- `money-service/src/health/health.controller.ts` (`/health`, `/health-auth`)
- `money-service/src/health/health.module.ts`
- `money-service/src/main.ts` (global `v1` route prefix per F16, excluding `/health`)
- `money-service/src/prisma/prisma.module.ts`
- `money-service/src/prisma/prisma.service.ts` (no `ssl` option — PgBouncer here rejects
  TLS, unlike whatever operation-service's own DATABASE_URL reaches; LESSONS-LEARNED.md L36)
- `money-service/src/queue/queue.constants.ts` (`money:`/`money` key/queue prefixes, F15)

**Gap note (found at Session 4A-6's close, not fixed here):** this block was never
updated after Session 4A-1 — it still lists only the 17 skeleton files, but Sessions
4A-2 (crons) and 4A-4 (webhooks) both added substantial new files
(`src/crons/*`, `src/dlocal/*`, `src/riseworks/*`, `src/disbursement/*`,
`src/affiliate/{affiliate-config.service,affiliate.constants,affiliate.types,
code-generator.service,commission-calculator,conversion-processor.service}.ts` + specs)
that were never recorded in this file, despite `00-SKELETON-AND-RULES.md` §5 requiring
it every session that creates/moves/deletes files. Full regeneration is out of this
session's scope (§5's own carve-out: "full regeneration only at 8.6") — flagging so the
Advisor knows this file undercounts money-service by 2 sessions' worth of files, not
just this session's own addition below.

- `money-service/src/affiliate/affiliate-dashboard.controller.spec.ts` (Session 4A-6)
- `money-service/src/affiliate/affiliate-dashboard.controller.ts` (Session 4A-6 — 4 GET
  routes, `JwtAuthGuard`+`AffiliateGuard`)
- `money-service/src/affiliate/affiliate-read.validators.ts` (Session 4A-6 — read-scope
  subset of `lib/affiliate/validators.ts`)
- `money-service/src/affiliate/affiliate.guard.spec.ts` (Session 4A-6)
- `money-service/src/affiliate/affiliate.guard.ts` (Session 4A-6)
- `money-service/src/affiliate/affiliate.module.ts` (Session 4A-6)
- `money-service/src/affiliate/report-builder.service.spec.ts` (Session 4A-6 — new
  backfill coverage, source never had a test file)
- `money-service/src/affiliate/report-builder.service.ts` (Session 4A-6 — ported from
  `lib/affiliate/report-builder.ts`)
- `money-service/src/admin/` (new directory, Session 4A-6 — 12 files: 3 controllers +
  specs, `AdminAffiliateManagementService` + spec, `AdminGuard` + spec,
  `pnl-calculator.ts` + spec, `admin.module.ts`)
- `money-service/prisma/schema.prisma` (Session 4A-6 — added `Commission.affiliateCode`
  relation + `AffiliateCode.commissions` back-relation)
- `money-service/src/app.module.ts` (Session 4A-6 — wires `AffiliateModule`/
  `AdminModule`)
- `money-service/package.json` (Session 4A-6 — added `zod` as a direct dependency)

- `eslint.config.mjs` (Session 5-3 — ESLint 9 / Next 16 flat config)
- `app/layout.tsx` (Session 5-4 — Google `Inter` font system fallbacks & zero CLS optimization)

</details>

<details>
<summary>FRONTEND — 3 new files + 12 modified + 2 config (Session 4A-7a, money-service Slice 3 read-API transport)</summary>

F45 (server-side proxy, `DECISION-LOG.md`) — mirrors `lib/operation-service/*`'s proven
pattern from Session 3-3 above. Additive: every one of the 12 modified route handlers
still runs its existing monolith auth check + Prisma logic unchanged; the new code only
adds a flag-gated branch that proxies to money-service instead, and the flags
(`MIGRATE_READ_APIS_MONEY_AFFILIATE`/`_ADMIN`) default OFF everywhere, so production
behavior is bit-identical until 4A-7b flips them.

New:

- `lib/money-service/client.ts` (server-only fetch helper, `MoneyServiceError` —
  mirrors `lib/operation-service/client.ts`'s shape exactly)
- `lib/money-service/routes.ts` (server-only cookie read via the existing
  `SESSION_COOKIE_NAME` + typed wrappers for all 12 Slice-3 GET routes)
- `lib/money-service/flags.ts` (`isAffiliateReadApiMigrated()` /
  `isAdminReadApiMigrated()`, both default OFF)

Modified (flag-gated branch added, existing logic otherwise unchanged):

- `app/api/affiliate/dashboard/stats/route.ts`
- `app/api/affiliate/dashboard/codes/route.ts`
- `app/api/affiliate/dashboard/code-inventory/route.ts`
- `app/api/affiliate/dashboard/commission-report/route.ts`
- `app/api/admin/affiliates/route.ts`
- `app/api/admin/affiliates/[id]/route.ts`
- `app/api/admin/analytics/route.ts`
- `app/api/admin/affiliates/reports/code-flows/route.ts`
- `app/api/admin/affiliates/reports/code-inventory/route.ts`
- `app/api/admin/affiliates/reports/commission-owings/route.ts`
- `app/api/admin/affiliates/reports/profit-loss/route.ts`
- `app/api/admin/affiliates/reports/sales-performance/route.ts`

Config:

- `.env.example` (`MONEY_SERVICE_URL`, `MIGRATE_READ_APIS_MONEY_AFFILIATE`,
  `MIGRATE_READ_APIS_MONEY_ADMIN` — following the `OPERATION_SERVICE_URL` pattern)

money-service's own source is unchanged this session (out of scope — see this order's
known-wrinkles list).

</details>

<details>
<summary>Part 19.5 (Wise) additive schema — 5 new tables + 1 new migration + 1 type fix (Session 4A-W2)</summary>

Additive-only production schema migration for the Wise disbursement provider (F42 replaces
RiseWorks). Zero traffic cut over — `DISBURSEMENT_PROVIDER` stays `MOCK` in production until
4A-W7. Real-query grant check found `money_svc` had zero grants on the 5 new tables (predicted
risk, `04-…plan.md` §5); fixed live with Davin's explicit approval (role-grant change,
`EXECUTOR-PROTOCOL.md` §7).

Modified:

- `prisma/non-market-data/schema.prisma` (1023→1236 lines — `DisbursementProvider` gains `WISE`
  - archival comment on `RISE`; 3 back-relations on `AffiliateProfile`/`PaymentBatch`/
    `DisbursementTransaction`; 5 new models + 3 new enums per design §4.1–4.2; archived-block
    banner added per `03-…runbook.md` §2.3)
- `money-service/prisma/schema.prisma` (583→801 lines — same `DisbursementProvider` change; 5
  new models + 3 new enums hand-mirrored as a subset — FKs to the 3 pre-existing shared models
  kept as bare scalars, no relation object, since no money-service code traverses them yet
  (4A-W4+ builds `src/wise/`); FKs _within_ the new Wise set kept as real relations; archived
  banner added above `AffiliateRiseAccount`)
- `types/disbursement.ts` (`DisbursementProvider` union gains `'WISE'` — required by the schema
  enum change to keep `tsc --noEmit` green; both dispatch functions in
  `lib/disbursement/providers/provider-factory.ts` already default to unavailable/throw for any
  unhandled provider, so this is type-only, zero behavior change)

New:

- `prisma/migrations/20260726000000_wise_disbursement_additive/migration.sql` (3 `CREATE TYPE`,
  1 `ALTER TYPE ... ADD VALUE`, 5 `CREATE TABLE`, 19 `CREATE INDEX`, 5 `ADD CONSTRAINT` FK —
  generated via `prisma migrate diff` schema-to-schema, not `migrate dev`, see
  `LESSONS-LEARNED.md` L22; applied via `migrate deploy`)

</details>

---

<details>
<summary><code>money-service/src/wise/</code> — 12 new files (Session 4A-W3a, recipient onboarding backend)</summary>

Wise recipient onboarding module (`money-service/src/wise/`, 10-file order breakdown + 2 test
files placed under `__tests__/` per the order's own explicit target paths for Files 9-10). Zero
traffic cut over — unique paths under `/v1/wise/recipients/*`, nothing points at them from any
frontend yet (4A-W3b builds that next). `DISBURSEMENT_PROVIDER` stays `MOCK` in production;
`POST /v1/accounts` (real recipient creation) is blocked by the configured token's read-only
scope (403, confirmed live) — carried forward as a Waiting-on item, not yet exercised
end-to-end.

New:

- `wise.config.ts` — typed Wise settings via `ConfigService` (`WISE_PROFILE_ID`,
  `WISE_API_TOKEN`, `WISE_ENVIRONMENT`, derived `baseUrl`)
- `wise.constants.ts` — API paths, headers, retry/timeout defaults
- `wise.types.ts` — Wise API payload/response interfaces (mirrors Wise's own `POST /v1/accounts`
  shape, distinct from the controller's public request shape — see F39/F41 entries,
  `DECISION-LOG.md`)
- `wise-api.client.ts` (+ `.spec.ts`, 5 tests) — native-`fetch` HTTP client, exponential
  back-off on 429/5xx, PII body redaction for logs
- `wise-signature.constants.ts` — Wise's published sandbox/production RSA public keys
  (verbatim from `02-…reference.md` §6.5), built ahead of 4A-W5's webhook receiver
- `wise-signature.verifier.ts` (+ `__tests__/wise-signature.verifier.spec.ts`, 6 tests) —
  `crypto.verify('RSA-SHA256', ...)` webhook signature verification
- `wise-recipient.service.ts` (+ `__tests__/wise-recipient.service.spec.ts`, 14 tests) —
  `getAccountRequirements`, `refreshRequirementsOnChange`, `createRecipient` (SHA-256
  `detailsFingerprint` + last-4 `accountTail` only, zero raw PII persisted),
  `getRecipientByAffiliateProfileId`, `deactivateRecipient`, `revalidateRecipient` (added
  mid-session — required by the frozen OpenAPI's `/revalidate` endpoint, absent from the
  order's own File 7/10 method list)
- `wise-recipients.controller.ts` — `/v1/wise/recipients/*` per
  `part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1): `requirements` (get/refresh),
  admin list, create, `me`, `:id/revalidate`, `:id` (DELETE, deactivate — in the OpenAPI spec
  but missing from the order's own endpoint prose, implemented anyway). Guards per F39
  (self-service): `AffiliateGuard` on every affiliate route, `AdminGuard` only on the admin
  list; `:id`-scoped routes verify ownership explicitly
- `wise.module.ts` — wires the above; registered in `app.module.ts`

Modified:

- `money-service/src/app.module.ts` (75→81 lines — `WiseModule` import + registration)

</details>

---

<details>
<summary><code>Wise recipient frontend surface</code> — 10 new files, 3 modified (Session 4A-W3b, monolith UI)</summary>

Server-side proxy layer + affiliate onboarding UI + admin read-only list for Wise recipients,
against `4A-W3a`'s live `money-service` endpoints. Zero backend change — purely additive
monolith routes/components/pages. Ships flag-less (Davin, live) — nothing was gated behind a
`MIGRATE_*`-style flag since F39/F41 are already resolved and no other code reads these routes.

New:

- `lib/money-service/wise-types.ts` — frontend mirror of money-service's `wise.types.ts`
  (`WiseAccountRequirementGroup`, `WiseRequirementsResponse`, `WiseRecipientSummary`,
  `WiseRecipientsAdminList`, `CreateWiseRecipientPayload`) — manually kept in sync, no shared
  package between the two services yet
- `app/api/wise/recipients/requirements/route.ts` (GET, `requireAffiliate()`)
- `app/api/wise/recipients/requirements/refresh/route.ts` (POST, `requireAffiliate()` — not in
  the order's own File 1 route list, added because the Contract section documents it and the
  form's field-refresh interaction needs it)
- `app/api/wise/recipients/me/route.ts` (GET, `requireAffiliate()` — infers the real 204-vs-200
  distinction from `id` presence, since the generic `callMoneyService` wrapper collapses HTTP
  status into a thrown-or-not shape)
- `app/api/wise/recipients/route.ts` (POST for affiliate creation `requireAffiliate()`, GET
  admin list `requireAdmin()`)
- `app/api/wise/recipients/[id]/revalidate/route.ts` (POST, `requireAffiliate()` — **not**
  `requireAdmin()` as the order's own File 1 text said; the live backend guard is
  self-service-only, see `DECISION-LOG.md`'s Session 4A-W3b entry)
- `components/affiliate/wise-recipient-form.tsx` — 2-step schema-driven form (currency/country
  select → dynamic fields from `AccountRequirementGroup[]`), client-side
  minLength/maxLength/validationRegexp validation, graceful 403/500 handling
- `app/affiliate/settings/layout.tsx` — thin auth-check layout (mirrors
  `app/affiliate/dashboard/layout.tsx`); the order's own target path
  (`app/(dashboard)/affiliate/settings/payout`) doesn't exist in the live tree, built at the
  real `app/affiliate/settings/payout` instead, matching F39's recorded URL
- `app/affiliate/settings/payout/page.tsx` — current-recipient status card, embeds
  `WiseRecipientForm`, and a self-service "Re-verify with provider" action (moved here from the
  admin page — see the guard-mismatch finding, `DECISION-LOG.md`)
- `app/(dashboard)/admin/disbursement/recipients/page.tsx` — read-only paginated table
  (affiliate ID, account holder, country, currency, `accountTail`, status, created date), status
  filter — no actions, per F39 and the revalidate-guard finding
- `__tests__/api/wise-recipients.test.ts` (17 tests) +
  `__tests__/components/affiliate/wise-recipient-form.test.tsx` (6 tests) — placed matching this
  repo's real `__tests__/api/*` / `__tests__/components/<area>/*` layout, not the order's own
  suggested `__tests__/lib/money-service/wise-routes.test.ts` path (no such directory convention
  exists here)

Modified:

- `lib/money-service/routes.ts` (164→243 lines — `buildQuery`'s param type widened to accept
  `boolean`, + 6 new Wise recipient wrappers)
- `app/affiliate/dashboard/layout.tsx` (+1 nav entry, "Payout Settings")
- `app/(dashboard)/admin/disbursement/layout.tsx` (+1 nav entry, "Wise Recipients")

</details>

---

<details>
<summary><code>money-service</code> CC-C/CC-D hardening gate — 2 new spec files, 3 modified (Session 4A-W4)</summary>

Audit-only for Stripe/dLocal idempotency (no fixes — that stays 4A-8's job) plus 2 single-line
INFRA fixes on already-cut-over code, per plan §13's CC-C/CC-D money gate closing before 4A-W5
gives money-service its first BullMQ consumer. No Wise-specific code. Full audit matrix and
webhook-dedupe findings live in the order's own Deviations section, not duplicated here.

New:

- `money-service/src/prisma/prisma.shutdown.spec.ts` — proves `app.enableShutdownHooks()` +
  `PrismaService.onModuleDestroy()` fire end-to-end on a real (stubbed-only-at-the-network-edge)
  NestJS shutdown signal, not just via a hand-called hook
- `money-service/src/dlocal/dlocal-webhook.throttle.spec.ts` — real-`ThrottlerGuard` burst test
  proving the route-level `@Throttle()` override actually raises this route's ceiling above the
  app-wide default, with a control route in the same file proving the global default really is
  enforced (not silently inert)

Modified:

- `money-service/src/main.ts` (51→61 lines) — `app.enableShutdownHooks()` added before
  `app.listen()`
- `money-service/src/prisma/prisma.service.ts` — observable log line added to
  `onModuleDestroy()` (was silent)
- `money-service/src/dlocal/dlocal-webhook.controller.ts` (415→425 lines) —
  `@Throttle({ default: { ttl: 60_000, limit: 300 } })` added to `handleWebhook` (Davin present,
  live approval per `EXECUTOR-PROTOCOL.md` §7 — already-cut-over live money route)

`DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session touched shared infra only, no
provider flip, no money moved.

</details>

---

<details>
<summary><code>money-service/src/wise/</code> — Wise webhook receiver + state reducer, 9 new files, 2 modified (Session 4A-W5)</summary>

money-service's first BullMQ queue consumer. `POST /v1/webhooks/wise` verifies (RSA-SHA256),
persists (`WiseWebhookEvent`, dedupe on `deliveryId`), enqueues (`money:wise-webhook`), and a
`@Processor` reduces transfer state changes per the design doc's frozen §5.2 table — the ONLY
code path authorized to set `Commission.status = 'PAID'`. Route is live but production-unsubscribed
(Safety Gate, 4A-W7 cuts over); `DISBURSEMENT_PROVIDER` stays `MOCK`. Full state-table/throttle
corrections vs. the order's own prose live in the order's Deviations, not duplicated here.

New:

- `money-service/src/wise/services/wise-state.mapper.ts` — pure §5.2 table mapper (10 states +
  unrecognised-fallback)
- `money-service/src/wise/services/wise-transfer-state.reducer.ts` — at-most-once reducer
  (staleness guard + atomic `balanceAppliedAt`/`balanceRevertedAt` locks)
- `money-service/src/wise/services/wise-event-handlers.ts` — `transfers#payout-failure` +
  `balances#update` (best-effort funding detection only, no `status` transition)
- `money-service/src/wise/queue/wise-webhook.processor.ts` — first `@Processor`/`WorkerHost`,
  event-type router, `onModuleDestroy` → `worker.close()`
- `money-service/src/wise/controllers/wise-webhook.controller.ts` — `POST /v1/webhooks/wise`,
  explicit `@Throttle()` (not `@SkipThrottle()`), store-then-process per design §5.5
- `money-service/src/wise/__tests__/wise-state.reducer.spec.ts` — mapper + reducer unit suite
- `money-service/src/wise/__tests__/wise-webhook.processor.spec.ts` — processor unit suite
  (beyond the order's own 8-file count — fulfills File 3/8's own verification promise)
- `money-service/src/wise/__tests__/wise-event-handlers.spec.ts` — event-handler unit suite
  (beyond the order's own 8-file count — fulfills File 5/8's own verification promise)
- `money-service/src/wise/__tests__/wise-webhook.replay.spec.ts` — RSA-signed sandbox test-payload
  replay suite (hand-constructed per Davin's Option 2, not captured from Wise's real Simulation
  API — see order Deviations)

Modified:

- `money-service/src/wise/wise.types.ts` — Wise webhook envelope types added
  (`WiseWebhookEnvelope`, `WiseTransferStateChangeData`, `WisePayoutFailureData`,
  `WiseBalanceUpdateData`)
- `money-service/src/wise/wise.module.ts` — `BullModule.registerQueue({ name:
'money:wise-webhook' })`, new controller + 5 new providers wired in

`DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session builds the webhook receiver
only, no provider flip, no money moved, no production Wise webhook subscription.

</details>

---

<details>
<summary><code>money-service</code> — Wise payout engine (isFundable branch), 15 new files, 8 modified (Session 4A-W6)</summary>

Builds the code that **creates** Wise transfer quotes, drafts payout batch groups, and branches
the shared payment orchestrator on `isFundable(provider)` — the reducer built at 4A-W5 stays the
ONLY writer of `Commission.status = 'PAID'`; this session drafts/funds batches and never touches
it. Five order-text-vs-cited-ground-truth mismatches found and corrected (full detail in the
order's own Deviations, also `LESSONS-LEARNED.md` L27's continuing pattern): `WISE_FUNDING_SLA_HOURS`
default (72h, not 24h), `provider-capabilities.ts`'s real interface shape (design §3.3, not the
order's invented one), `wise-quote.service.ts`'s quote direction (F38's binding `targetAmount`, not
design §6.2's superseded `sourceAmount` example), `wise-batches.controller.ts`'s real 7-endpoint
OpenAPI surface (not the order's 3), and two file-location disagreements (`wise/` vs `disbursement/`
for File 1, `crons/` vs `wise/services/` for File 7 — this order's own stated paths were followed).
F43 (funding-SLA alert channel) decided: Resend REST direct, no new dependency.

New:

- `money-service/src/wise/providers/provider-capabilities.ts` — `FundableProvider`/
  `RecipientAwareProvider`/`CapabilityUnavailableError`, `isFundable()` structural type guard
- `money-service/src/wise/providers/wise-payment.provider.ts` — `WisePaymentProvider extends
PaymentProvider implements FundableProvider`; `base-provider.ts` untouched
- `money-service/src/wise/services/wise-quote.service.ts` — quotes by `targetAmount` (F38, platform
  absorbs the fee)
- `money-service/src/wise/services/wise-transfer.service.ts` — batch-group transfer creation;
  `customerTransactionId` persisted via a placeholder `wiseTransferId` (itself, until Wise
  responds) for genuine crash resumability against the schema's required-`@unique` column
- `money-service/src/wise/services/wise-batch-group.service.ts` — `NEW → COMPLETED/
AWAITING_MANUAL_FUNDING → FUNDED` lifecycle; `markFunded`/`completeBatch` both idempotent
- `money-service/src/wise/controllers/wise-batches.controller.ts` — full 7-endpoint
  `/v1/wise/batches*` admin surface (`AdminGuard`), per the frozen OpenAPI
- `money-service/src/crons/wise-reconciliation.service.ts` — hourly: non-terminal `WiseTransfer`
  rows replayed through 4A-W5's reducer as synthetic dedupe-safe events; REQUIRED funding-SLA
  alarm (F43, Resend REST) for `AWAITING_MANUAL_FUNDING` batches past 72h
- `money-service/src/disbursement/payment-orchestrator.service.spec.ts` — did **not exist before
  this session** (Hard Invariant #4 / this order's own Rules assumed it did); built covering both
  the pre-existing Mock/Rise path and this session's new branch — see order Deviations for the
  real `MockPaymentProvider` transactionId-matching bug this surfaced (not fixed, flagged)
- `money-service/src/disbursement/commission-aggregator.service.spec.ts` — also did not exist
  before this session
- 8 more `*.spec.ts` files across `wise/providers/`, `wise/services/`, `wise/__tests__/`,
  `wise/controllers/`, `crons/` — one per File 1–7, plus `wise-payout-engine.spec.ts` (composed
  integration, real DI-wired services) and `wise-payout.e2e.spec.ts` (RSA-signed sandbox test
  payload per Davin's Option 2, same technique as 4A-W5's replay suite)

Modified:

- `money-service/src/disbursement/payment-orchestrator.service.ts` — `isFundable` branch in
  `executeBatch`; fixed the pre-existing (now non-fundable-path-only) `affiliateId` empty-string
  bug (design §3.5(a)) at its source
- `money-service/src/disbursement/commission-aggregator.service.ts` — additive
  `getAllPayableAffiliatesForProvider(provider)`; NOT yet wired into
  `disbursement-processor.service.ts`'s cron call (that file isn't in this order's own file list —
  4A-W7's job)
- `money-service/src/wise/wise-api.client.ts` — `WiseRequestOptions.method` widened to include
  `'PATCH'` (needed for batch-group completion/cancellation, missing since 4A-W3a)
- `money-service/src/wise/wise.config.ts` — `fundingMode` (F37, default `MANUAL`) and
  `fundingSlaHours` (default 72h) getters added
- `money-service/src/wise/providers/provider-capabilities.ts` — `PrepareBatchInput.paymentBatchId`
  added (needed to correlate with `WiseBatchGroup.paymentBatchId`, missing from design §3.3's own
  sketch)
- `money-service/src/wise/wise.module.ts` — `WiseBatchesController` + `WisePaymentProvider` and its
  3 new services registered, `WisePaymentProvider` exported
- `money-service/src/crons/crons.module.ts` / `crons.scheduler.ts` / `crons.scheduler.spec.ts` —
  new hourly `wise-reconciliation` job (`CRON_ENABLED`-gated, same as every other job); existing
  test's DI wiring updated for the scheduler's new constructor dependency (zero assertions changed)

**NOT touched, deliberately** (design §8.1's own file-inventory table names these, this order's
8-file breakdown does not): `disbursement.types.ts`, `disbursement.constants.ts`,
`providers/provider-factory.ts` — wiring a `'WISE'` case into the plain factory function needs real
DI-construction surgery (`WisePaymentProvider` has 7 injected collaborators a bare `new` can't
resolve), genuinely 4A-W7's own architectural decision, not an additive same-session fix.

`base-provider.ts` untouched (0 line changes, verified via `git diff --stat`). `DISBURSEMENT_PROVIDER`
stays `MOCK` in production — no provider flip, no money moved. Full suite: 44/44 suites, 366/366
tests (was 33/33·326/326 at 4A-W5's close). Monolith `tsc --noEmit` clean.

</details>

---

<details>
<summary><code>money-service</code> + monolith — Slice 4 Hardening Gate: idempotency + Transactional Outbox (F14), 8 new files, 12 modified (Session 4A-8)</summary>

Step 1's file list was re-scoped before execution (order named nonexistent money-service
controllers; the real audited gaps are monolith Next.js routes, see the order's own Deviations).
`OutboxEvent` needed the same two-schema treatment as 4A-W2's Wise models (not itemized in the
order's own file list either) — migration applied to production, `money_svc` grants verified live.

New:

- `lib/idempotency/idempotency-guard.ts` — Redis SET-NX-EX lock, fail-open on Redis errors
  (monolith-side dedupe guard for dLocal create / admin code distribution)
- `money-service/src/common/idempotency/idempotency.store.ts` + `idempotency.interceptor.ts` —
  reusable 24h-TTL response cache keyed on `Idempotency-Key`; not attached to any route yet
  (money-service has no write endpoints until 4A-9)
- `money-service/src/outbox/outbox.service.ts` — atomic `OutboxEvent` write via the caller's own
  transaction client (F14)
- `money-service/src/outbox/outbox-publisher.cron.ts` — polls every 5s, exponential backoff
  within an attempt, dead-letters after 5 attempts across ticks; **gated OFF**
  (`OUTBOX_PUBLISHER_ENABLED`) — real delivery target is Slice 5 (4A-11/12), not built
- `prisma/migrations/20260727000000_outbox_event_additive/` — applied to production
- Matching `*.spec.ts` for every file above, plus `__tests__/lib/idempotency/idempotency-guard.test.ts`

Modified:

- `lib/stripe/stripe.ts` / `app/api/checkout/route.ts` — optional Stripe SDK `idempotencyKey`,
  derived from a 60s window bucket; omitted entirely (not `undefined`) when absent, so existing
  callers see zero behavior change
- `app/api/payments/dlocal/create/route.ts` — idempotency lock before `Payment.create`; also
  fixed `providerPaymentId`'s `''` placeholder to a random UUID (the column is `@unique`
  table-wide, not per-user — found while touching this exact line)
- `lib/admin/code-distribution.ts` / `app/api/admin/affiliates/[id]/distribute-codes/route.ts` —
  idempotency lock in `distributeCodesAdmin`, `DuplicateDistributionError` → 409
- `money-service/prisma/schema.prisma` + `prisma/non-market-data/schema.prisma` — `OutboxEvent`
  model + `OutboxEventStatus` enum, mirrored (money-service is the only reader/writer)
- `money-service/src/dlocal/dlocal-webhook.controller.ts` — outbox write inside the existing
  tier-upgrade transaction, guarded by the existing `alreadyCompleted` replay flag
- `money-service/src/crons/subscription.service.ts` — `downgradeExpiredSubscriptions` was NOT
  previously transactional; now wrapped in `$transaction` for the atomic outbox write (deliberate
  behavior change, see order Deviations)
- `money-service/src/riseworks/riseworks-webhook.controller.ts` — added the same route-level
  `@Throttle` override dLocal/Wise already have (CC-D audit gap found, zero live traffic)
- `money-service/src/dlocal/dlocal.module.ts`, `crons/crons.module.ts` — new providers registered

`money-service`: 49/49 suites, 400/400 tests (was 45/372 at session start). `nest build` clean.
Monolith `tsc --noEmit` clean (both Prisma clients regenerated). `DISBURSEMENT_PROVIDER` untouched
— this session hardened shared infra and the Outbox pattern only.

</details>

<details>
<summary><code>money-service</code> — Slice 4 write-API PORT (Stripe, dLocal create, admin code dist, disbursement execute), 21 new files, 8 modified (Session 4A-9)</summary>

New:

- `money-service/src/stripe/stripe.service.ts` + `.spec.ts` — checkout session creation,
  subscription cancellation, webhook event construction (`ConfigService`-backed)
- `money-service/src/stripe/stripe-checkout.controller.ts` + `.spec.ts` — `POST /v1/stripe/checkout`
- `money-service/src/stripe/stripe-subscription.controller.ts` + `.spec.ts` —
  `POST /v1/stripe/subscriptions/cancel`
- `money-service/src/stripe/stripe-webhook.controller.ts` + `.spec.ts` — `POST /v1/webhooks/stripe`
- `money-service/src/stripe/stripe-webhook.service.ts` + `.spec.ts` — ported from
  `lib/stripe/webhook-handlers.ts` (order's own SOURCE list omitted this file; found and
  re-scoped live with Davin, see the order's Deviations)
- `money-service/src/stripe/stripe.module.ts` — new feature module, registered in `AppModule`
- `money-service/src/dlocal/currency-converter.service.ts` + `.spec.ts` — ported from
  `lib/dlocal/currency-converter.service.ts` (a second direct dependency the order's file list
  omitted)
- `money-service/src/dlocal/payment-methods.service.ts` + `.spec.ts` — ported from
  `lib/dlocal/payment-methods.service.ts`
- `money-service/src/dlocal/dlocal-payment.controller.ts` + `.spec.ts` —
  `POST /v1/payments/dlocal/create`
- `money-service/src/admin/admin-code-distribution.service.ts` + `.spec.ts` — reuses
  `CodeGeneratorService` (4A-2)
- `money-service/src/disbursement/controllers/disbursement-batches.controller.ts` + `.spec.ts` —
  `POST /v1/disbursement/batches/:batchId/execute`
- `money-service/src/disbursement/disbursement.module.ts` — new feature module, registered in
  `AppModule`

Modified:

- `money-service/src/dlocal/dlocal-payment.service.ts` — added `acquireCreatePaymentLock` (4A-8's
  30s Redis lock); existing `createPayment`/`generateSignature` (4A-4) untouched
- `money-service/src/admin/admin-affiliates.controller.ts` — added
  `POST /v1/admin/affiliates/:id/distribute-codes`
- `money-service/src/admin/admin.module.ts` — new providers (needed immediately, not deferred to
  the module-glue step, since this controller was already live in `AppModule`)
- `money-service/src/dlocal/dlocal.module.ts` — `DlocalPaymentController` + `IdempotencyInterceptor`/
  `IdempotencyStore` registered
- `money-service/src/app.module.ts` — `StripeModule`/`DisbursementModule` imported
- `money-service/prisma/schema.prisma` — `User` model gained `trialStatus`/`trialConvertedAt`/
  `trialCancelledAt`/`hasUsedFreeTrial` + `TrialStatus` enum (additive, `prisma generate` only —
  fields already exist in the monolith's real schema and shared Postgres table)
- `money-service/package.json` — `stripe@^14.10.0` added (pinned to match the monolith's own
  version after an initial unpinned install grabbed v22.3.2, an 8-major gap — see order Deviations)

`money-service`: 59/59 suites, 506/506 tests (was 49/49, 400/400 at 4A-8's close). `nest build`
clean. Monolith untouched (zero files changed), `tsc --noEmit` clean. `DISBURSEMENT_PROVIDER` and
all 4 new `MIGRATE_WRITE_APIS_MONEY_*` flags untouched/unflipped — zero production traffic reaches
any new route this session.

</details>

<details>
<summary>FRONTEND — 2 new files + 5 modified (Session 4A-10a, money-service Slice 4 write-API transport)</summary>

Monolith-side write transport, mirroring 4A-7a's Slice-3 read transport pattern (F45 server-side
proxy). Every one of the 5 modified route handlers still runs its existing monolith auth check
unchanged; the new code only adds a flag-gated branch that forwards the raw request to
money-service's already-full-4A-9-PORTed controller instead, and all 4 flags
(`MIGRATE_WRITE_APIS_MONEY_STRIPE`/`_DLOCAL`/`_ADMIN`/`_DISBURSEMENT`) default OFF everywhere, so
production behavior is bit-identical until 4A-10b flips them.

New:

- `lib/money-service/write-routes.ts` (`forwardWriteRequestToMoneyService()` — forwards raw
  request body + `Idempotency-Key` header with the caller's session token as Bearer auth, reusing
  `routes.ts`'s `getMoneyServiceToken()`)
- `__tests__/lib/money-service/write-routes.test.ts` (11 tests — flag defaults/env reads, token
  forwarding, `Idempotency-Key` propagation, bodyless-request handling, method override, error
  propagation)

Modified:

- `lib/money-service/flags.ts` — 4 new `shouldUseMoneyServiceFor*Write()` readers
  (Stripe/dLocal/Admin/Disbursement), all default `false`
- `app/api/checkout/route.ts` (flag-gated branch added, existing logic otherwise unchanged)
- `app/api/subscription/cancel/route.ts` (flag-gated branch added; `POST()` gained a `request`
  parameter it previously didn't take)
- `app/api/payments/dlocal/create/route.ts` (flag-gated branch added, existing logic otherwise
  unchanged)
- `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (flag-gated branch added, existing
  logic otherwise unchanged)
- `app/api/disbursement/batches/[batchId]/execute/route.ts` (flag-gated branch added; unused
  `_request` param renamed to `request`)

Monolith `test:ci`: 121/121 suites, 2133/2133 tests (was 120/120, 2122/2122 at 4A-9's era close).
`tsc --noEmit`/`eslint app components lib hooks --max-warnings 0` clean. `money-service`
unchanged this session (transport-only BUILD, no money-service source touched).

</details>

<details>
<summary><code>operation-service</code> + <code>money-service</code> — Slice 5 outbox email worker, receiving side BUILT, 10 new files + 2 modified (Session 4A-11)</summary>

Zero production traffic — `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL` stay unset/false
in every environment; cutover is 4A-12.

New (`operation-service`):

- `operation-service/src/email/subscription-email.util.ts` + `.spec.ts` — ported 5 of
  `lib/email/subscription-emails.ts`'s 8 functions verbatim (cancellation, payment-failed,
  payment-receipt, subscription-canceled, affiliate-commission); dropped 2 (dead-in-monolith
  upgrade template, out-of-event-scope renewal reminder)
- `operation-service/src/outbox/svc-token.guard.ts` + `.spec.ts` — mirrors money-service's
  `CronSecretGuard` shape, activates F31
- `operation-service/src/outbox/dto/outbox-event.dto.ts` — `class-validator` DTO matching
  money-service's `deliver()` body shape; `eventType` deliberately untyped-enum so an unrecognized
  future value reaches the service's own no-op branch instead of a 400
- `operation-service/src/outbox/outbox-consumer.service.ts` + `.spec.ts` — dispatches by
  `eventType`; `COMMISSION_CREDITED` deliberately skipped (see `DECISION-LOG.md` F50)
- `operation-service/src/outbox/outbox-consumer.controller.ts` + `.spec.ts` —
  `POST /outbox/events` (corrected from the order's own `/v1/outbox/events` — this service has no
  global `/v1` prefix), `SvcTokenGuard`-protected
- `operation-service/src/outbox/outbox.module.ts`

Modified:

- `operation-service/src/app.module.ts` — `OutboxModule` imported
- `money-service/src/outbox/outbox-publisher.cron.ts` — `deliver()` now sends
  `Authorization: Bearer <SVC_TOKEN>` alongside the existing `Content-Type` header
- `money-service/src/outbox/outbox-publisher.cron.spec.ts` — 1 new assertion added, 8 existing
  cases unchanged
- `money-service/.env.example` / `operation-service/.env.example` — documented `SVC_TOKEN`,
  `OUTBOX_PUBLISHER_ENABLED`, `OUTBOX_PUBLISHER_TARGET_URL` (doc-only)

`operation-service`: 11/11 suites, 86/86 tests (was 7/7, 56/56). `money-service`: 59/59 suites,
507/507 tests (was 506/506). `tsc --noEmit`/`nest build` clean both services.

</details>

<details>
<summary><code>operation-service/src/notifications/</code> — 6 new files + `app.module.ts` modified
(Session 4B-9, Notifications PORT+CUTOVER combined)</summary>

PORT+CUTOVER session (same combined shape as Session 4B-8 — small blast radius, 3 files, no
payment/webhook surface). Ports `app/api/notifications/route.ts` (196 lines) +
`app/api/notifications/[id]/route.ts` (179 lines) + `app/api/notifications/[id]/read/route.ts`
(144 lines, 519 total) into `operation-service`, AND wires + cuts over the monolith side in the
same session. `MIGRATE_NOTIFICATIONS=true` in Vercel production — **CUT-OVER & LIVE, verification
partial (GET/POST mark-all-read only, see `CLAUDE.md`/cutover table).**

- `notifications.module.ts` — registers `NotificationsController`/`NotificationsService`;
  `PrismaModule` is `@Global()`, no explicit import needed, registered in `AppModule`
- `notifications.controller.ts` + `notifications.service.ts` (+ `.spec.ts` each) —
  `GET/POST /notifications`, `GET/DELETE /notifications/:id`, `POST /notifications/:id/read`.
  Three response-shape corrections against real SOURCE rather than the order's own paraphrase
  (`LESSONS-LEARNED.md` L27): `markAllRead` returns `{success,updatedCount,message}` not
  `{success,count}`; `markRead`'s already-read branch has no `success` key; ownership mismatches
  throw 403 (matching SOURCE and the established Drawings/Alerts convention), not a blanket 404.
  Parameter-level `ZodValidationPipe` on the query DTO only (L45 rule)
- `notifications.schemas.ts` — mirrors `app/api/notifications/route.ts`'s `querySchema` verbatim
  (status/type filters, page/pageSize bounds); no body-validation schema needed (none of the 3
  SOURCE routes take a request body)
- `dto/notification.dto.ts` — type-only re-export for controller/service signatures
- `notifications.http-status.e2e.spec.ts` — real `Test.createTestingModule`+`supertest` e2e spec
  added mid-session after a live bug was found (see below)

**Monolith side (same session, not split out):** `lib/operation-service/flags.ts` gained
`shouldUseOperationServiceForNotifications()`; all 3 `app/api/notifications/*` route files wired
to check it immediately after existing auth and forward via `forwardRequestToOperationService()`,
preserving status codes. `app/api/notifications/route.ts`'s `POST` (mark-all-read) gained a
`request: NextRequest` parameter it previously didn't have at all (not a `_request`→`request`
rename — a genuinely new parameter, needed for forwarding). Closed an L28-class gap: no test file
existed for `[id]/route.ts` or `[id]/read/route.ts` before this session — added
`__tests__/api/notifications-id.test.ts` + `__tests__/api/notifications-id-read.test.ts` (18 new
tests). `__tests__/api/notifications.test.ts`'s own `MockURL` class gained a `.search` getter
(needed by the new `new URL(request.url).search`-based forwarding call).

**Live cutover incident, found and fixed same-session (new `LESSONS-LEARNED.md` L43):** NestJS's
`@Post()` defaults to `201`; both ported POST handlers (mark-all-read, mark-one-read) shipped
returning `201` instead of SOURCE's `200`, found only via operation-service's real Railway HTTP
logs during the live smoke test (invisible to the client-side response body and to every
controller-construction unit test). Fixed with explicit `@HttpCode(200)` on both handlers,
redeployed, re-verified live and independently via a fresh Railway log line.

Test suites: `operation-service` 30/30→33/33 (+3 new spec files, 28 new tests). `nest build`/
`tsc --noEmit` clean. Monolith `test:ci` 122/122 suites, 2150/2150 tests (was 120/120, 2129/2129 at
4B-8's close — +2 suites/+21 tests); `tsc --noEmit`/`eslint --max-warnings 0` clean.

</details>

<details>
<summary><code>operation-service/src/tier/</code> + <code>src/auth/tier.guard.ts</code> — 7 new files +
`app.module.ts` modified (Session 4B-10, Tier PORT+CUTOVER combined)</summary>

PORT+CUTOVER session (same combined shape as Sessions 4B-8/4B-9 — small blast radius, 3 read-only
files, no payment/webhook surface). Ports `app/api/tier/symbols/route.ts` (118 lines) +
`app/api/tier/check/[symbol]/route.ts` (124 lines) + `app/api/tier/combinations/route.ts`
(145 lines, 387 total) into `operation-service`, AND builds new reusable tier-gating
infrastructure, AND wires + cuts over the monolith side in the same session.
`MIGRATE_TIER=true` in Vercel production — **CUT-OVER & LIVE, verification COMPLETE (all 3
endpoints, not partial — see `CLAUDE.md`/cutover table).**

- `tier.module.ts` — registers `TierController`/`TierService`; no `PrismaModule` import needed
  (this domain reads no database state at all — pure config/constants), registered in `AppModule`
- `tier.controller.ts` + `tier.service.ts` (+ `.spec.ts` each) — `GET /tier/symbols`,
  `GET /tier/check/:symbol`, `GET /tier/combinations`, all `JwtAuthGuard`-only (none of the 3
  SOURCE routes enforce tier gating — V8: FREE/PRO get identical XAUUSD/M5/M15 data), explicit
  `@HttpCode(200)` on every handler
- `tier.schemas.ts` — locally re-defines `lib/tier-config.ts`'s constants
  (`FREE_SYMBOLS`/`PRO_SYMBOLS`/`FREE_TIMEFRAMES`/`PRO_TIMEFRAMES`/`canAccessSymbol`), since
  `operation-service` cannot import monolith `lib/*` directly. Deliberately matches
  `tier-config.ts`'s `canAccessSymbol(symbol, tier)` semantics, NOT `lib/tier-validation.ts`'s
  differently-ordered, differently-scoped function of the same name (already used by
  Drawings/Alerts) — the 3 SOURCE tier routes only ever import from `tier-config.ts`
- `dto/tier.dto.ts` — type-only re-export for controller/service signatures
- `../auth/tier.guard.ts` (+ `.spec.ts`) — new `@RequireTier()`/`TierGuard`
  (`SetMetadata`+`Reflector`, the standard NestJS roles-guard shape — a genuinely new pattern for
  this codebase). Reusable infrastructure for FUTURE tier-gated endpoints in other domains; unused
  by any of `TierController`'s own 3 handlers, since none of them gate by tier

**Monolith side (same session, not split out):** `lib/operation-service/flags.ts` gained
`shouldUseOperationServiceForTier()`; all 3 `app/api/tier/*` route files wired to check it
immediately after existing auth and forward via `forwardRequestToOperationService()`. 2 of 3
route files (`symbols`, `combinations`) gained a genuinely new `request: NextRequest` parameter
they previously didn't have at all (not a `_request`→`request` rename — only
`check/[symbol]/route.ts` had one to widen). Closed an L28-class gap: `check/[symbol]/route.ts`
had zero test coverage anywhere in the repo before this session — added 5 new tests for it plus 3
forwarding tests (one per route). Hit and fixed a Jest module-hoisting trap while updating
`__tests__/api/tier.test.ts`: a class-based `OperationServiceError` mock alongside the file's
pre-existing static top-level route imports threw a TDZ `ReferenceError` (Babel hoists ES imports
above same-file class declarations regardless of textual order) — fixed by switching to per-test
dynamic `await import(...)`, matching `__tests__/api/notifications.test.ts`'s own convention.

Test suites: `operation-service` 33/33→36/36 (+3 new spec files, 14 new tests). `nest build`/
`tsc --noEmit` clean. Monolith `test:ci` 122/122 suites, 2157/2157 tests (was 122/122, 2150/2150 at
4B-9's close — +7 tests); `tsc --noEmit` clean, `npm run build` clean.

</details>

---

<details>
<summary><code>operation-service/src/users/</code> — 6 new files + `app.module.ts`/`auth.module.ts`/
`prisma/schema.prisma` modified, all 14 `app/api/user/*` monolith route files modified (Session
4B-11, User Profile/2FA/Sessions/Account Deletion PORT+CUTOVER combined)</summary>

PORT+CUTOVER session (same combined shape as Sessions 4B-8/4B-9/4B-10). Ports all 14
`app/api/user/*` route files (2,060 lines, 19 real endpoints) into a new `UsersModule`:

- `users.controller.ts` (+ `.spec.ts`) — 19 handlers across profile/preferences/password/
  sessions/login-history/2FA/account-deletion. Guards applied per-method, not at class level — 3
  handlers (`POST /user/2fa/verify`, `POST /user/account/deletion-confirm`,
  `POST /user/account/deletion-cancel`) carry no `JwtAuthGuard` at all, matching SOURCE's own
  unauthenticated-by-design behavior (mid-login 2FA challenge, public email-link token flow, and a
  dual-mode anonymous-token-or-session flow respectively). A dedicated guard-metadata test
  (`Reflect.getMetadata(GUARDS_METADATA, ...)`) proves this directly, not just delegation coverage.
- `users.service.ts` (+ `.spec.ts`) — profile/preferences/password/sessions/login-history/
  account-deletion business logic ported directly; all 6 2FA methods are thin delegates to the
  pre-existing `TwoFactorService` (built Session 3-4 for operation-service's own native login
  flow) rather than reimplemented, reusing its already-verified crypto/bcrypt scheme.
- `users.schemas.ts` + `dto/user.dto.ts` — Zod schemas for profile/preferences/password/
  deletion-confirm/deletion-cancel; 2FA bodies reuse the existing `TwoFactorService`'s own
  class-validator DTOs rather than duplicating them.
- `users.module.ts` — imports `AuthModule` (now exports `TwoFactorService`) for DI.
- `operation-service/prisma/schema.prisma` — 5 new narrow-subset models mirrored (additive,
  generate-only, never migrated — L1): `UserPreferences`, `AccountDeletionRequest`,
  `LoginHistory` (+ `LoginStatus` enum), `UserSession`, and NextAuth's own bare `Session` model
  (needed only for `session-tracker.ts`'s revoke-time `deleteMany` calls). None existed in this
  schema before this session — found missing at CONFIRM, corrected from the APPROVED order's own
  wrong model list (which named 2 nonexistent models and omitted these 5).
- `auth.module.ts` — now `exports: [TwoFactorService]`.

**Monolith side (same session, not split out):** `lib/operation-service/flags.ts` gained 3 new
readers (`shouldUseOperationServiceForUserProfile/User2FA/UserSessions`); all 14
`app/api/user/*` route files wired to check the relevant flag immediately after existing auth and
forward via `forwardRequestToOperationService()` (or a new
`forwardRequestToOperationServiceOptionalAuth()` for the 3 unauthenticated-capable routes, since
the standard forwarder requires a session cookie to forward at all). `lib/operation-service/
client.ts` gained `callOperationServiceWithOptionalTokenStatus()`. 5 safe signature widenings
(`_request`/no-param → `request`).

**A real live bug found by the cutover's own post-flip smoke test, fixed same-session:** the
shared forwarder(s) never propagated `user-agent`/`x-forwarded-for` (only `Authorization` +
`x-correlation-id`) — invisible on every prior cutover slice since none of them read those
headers; 4B-11 is the first that does (session device-tracking, IP/location in security-alert
emails). Fixed by wiring the already-existing-but-unused `forwardedRequestContext()` helper
(`client.ts`) into both forwarders. Not a security/auth-identity issue — only descriptive
metadata was ever wrong.

Test suites: `operation-service` 36/36→38/38 (+2 new spec files, 53 new tests). `nest build`/
`tsc --noEmit` clean. Monolith `test:ci` 122/122 suites, 2158/2158 tests (was 122/122, 2157/2157 at
4B-10's close — +1 test, the new header-forwarding regression test); `tsc --noEmit` clean,
`eslint --max-warnings 0` clean.

</details>

<details>
<summary><code>operation-service/src/realtime/</code> — 3 new files, `app.module.ts`/`package.json`
modified, 1 new monolith route + 1 new hook + 2 monolith consumers modified + 6 files deleted
(Session 4B-17, Realtime/Websocket Decision & Build, F8)</summary>

PORT/INFRA session. F8 resolved (see `DECISION-LOG.md`): `operation-service`'s existing HTTP
process, real `socket.io`/`socket.io-client`, alert-fired scope only, NextAuth-JWE handshake
auth. No cutover flag — ships dormant/parallel, 4B-18 is the named cutover session.

- `operation-service/src/realtime/realtime.gateway.ts` (+`.spec.ts`, +`.e2e.spec.ts`) — new
  `RealtimeGateway` (`@WebSocketGateway`). `afterInit` attaches `@socket.io/redis-adapter` (3
  dedicated Redis connections via `RedisService.getClient().duplicate()` — never the shared
  client, matching the pub/sub-mode-can't-run-normal-commands rule) and subscribes to
  `alerts:fired` (published by `NotifyBridgeService` since Session 4B-2/3, unconsumed until this
  session). `handleConnection` verifies `socket.handshake.auth.token` as a real NextAuth JWE via
  the same `decodeNextAuthToken` path `JwtAuthGuard` uses, joins `user:<id>`, closing the old
  server's placeholder-auth gap. `deliver()` emits `notification` + `alert_fired` events,
  room-scoped to the firing user. Real e2e spec: genuine `socket.io-client` against a real
  in-process gateway (`app.listen(0)`), real minted JWE, real Redis pub/sub semantics via a
  faithful in-memory double (no live Redis in this environment, same precedent as 4B-2).
- `operation-service/src/realtime/realtime.module.ts` — registered in `app.module.ts`.
- `operation-service/package.json` — `@nestjs/websockets`, `@nestjs/platform-socket.io`,
  `socket.io`, `@socket.io/redis-adapter` (deps, pinned to match the monolith's own versions
  where applicable, L30); `socket.io-client` (devDependency, needed only by the e2e spec — its
  initial omission broke the Railway build, see this session's own Deviations).
- `app/api/realtime/token/route.ts` (new, monolith) — server-side bridge: a persistent
  client-initiated Socket.IO connection can't be proxied through a route handler the way a REST
  call can, so this hands the browser the same session token `getOperationServiceToken()`
  already forwards for REST calls, plus `OPERATION_SERVICE_URL` to connect to. Deliberately not
  a new `NEXT_PUBLIC_*` env var (order's own instruction).
- `hooks/use-realtime-socket.ts` (new) — real `socket.io-client`, auth via handshake payload.
  Replaces `hooks/use-websocket.ts` in both real consumers: `components/charts/drawing/
useFiredAlertMarkers.ts` (chart marker) and `components/notifications/notification-bell.tsx`
  (live badge update, additive to its existing REST-poll fallback).
- **Retired (dead code, order facts #1-#4):** `lib/websocket/server.ts` (`initWebSocketServer`
  never actually called in production — no custom server wraps `next start`, and it spoke
  incompatible Socket.IO framing vs. the raw-WebSocket client anyway), `hooks/use-websocket.ts`,
  `components/providers/websocket-provider.tsx` (fully orphaned duplicate, zero consumers),
  `lib/alert-engine/{notify-bridge.ts,types.ts}` (monolith-side subscriber half — publisher half
  already moved to operation-service at 4B-2/3; `lib/websocket/server.ts` was their only
  remaining importer). `lib/monitoring/system-monitor.ts`'s `checkWebSocket()` rewritten to not
  depend on the deleted file (preserves its always-healthy prior behavior); `checkUserConnection()`
  removed (dead export). Housekeeping: `railway-worker.json` + the `worker:alerts` npm script
  deleted (both pointed at `scripts/alert-worker.ts`, deleted at Session 4B-3).

Test suites: `operation-service` 40/40→42/42 (+2 new spec files, +16 tests: 11 unit + 5 e2e).
`nest build`/`tsc --noEmit` clean. Monolith `test:ci` 123/123→123/123 suites, 2171/2171→2157/2157
tests (net -14, fully accounted for: -24 from 2 deleted test files, +10 from 2 new ones — see
Deviations); `tsc --noEmit` clean, `eslint --max-warnings 0` clean, `npm run build` clean.

Deployed: `operation-service` (`railway up --path-as-root --service operation-service`,
deployment `47b093b1-3e07-4603-ada1-04ecfe1839dd`, genuinely `SUCCESS`) and the monolith
(`vercel --prod --archive=tgz --yes`). Live-verified via a real Engine.IO handshake response
(`GET /socket.io/?EIO=4&transport=polling`), independent of `railway logs` (unreliable for this
deployment this session, every flag combination tried returned empty).

</details>

<details>
<summary><code>lib/email/*</code>, <code>emails/</code> — 10 files deleted, 1 file trimmed
(Session 4B-19, Email Rendering Port Audit & Verification, PORT/VERIFY-RETIRE Option A)</summary>

VERIFY-RETIRE-shaped close (Option A selected by Davin over porting the dead code or skipping the
session). Audit found the live, real email-sending infrastructure was already fully ported to
`operation-service` in Sessions 3-4 (`email.util.ts`, F29) and 4A-11 (`subscription-email.util.ts`,
5 of 7 email types) — nothing left to genuinely PORT. What remained in the monolith was dead or
never-finished code:

- **Deleted:** `emails/index.ts`, `emails/payment-confirmation.tsx`, `emails/payment-failure.tsx`,
  `emails/renewal-reminder.tsx`, `emails/subscription-expired.tsx` — React Email components for a
  dLocal-payment-flow email feature that was built but never wired to any real caller (zero
  consumers anywhere in `app/`, `lib/`, `components/`).
- **Deleted:** `lib/email/templates/affiliate/{welcome,code-distributed,code-used,
monthly-report,payment-processed}.tsx` — React Email components for an affiliate-notification
  feature that was also built but never finished; the only reference anywhere was a single
  commented-out call in `lib/affiliate/registration.ts:124`.
- **Trimmed (not deleted):** `lib/email/subscription-emails.ts` (865→612 lines) — removed
  `getUpgradeEmailTemplate`/`sendUpgradeEmail` and `getRenewalReminderEmailTemplate`/
  `sendRenewalReminderEmail` (zero callers anywhere, confirmed dead). The file's other 5
  functions stay — still imported by `app/api/subscription/cancel/route.ts` and
  `lib/stripe/webhook-handlers.ts`.

Test suites: `operation-service` 42/42 (unchanged, not touched). Monolith `test:ci` 123/123
suites, 2157/2157 tests (unchanged from 4B-18d's baseline, zero regressions); `tsc --noEmit`
clean, `eslint --max-warnings 0` clean.

Note: the file-inventory table/lists compiled 2026-07-08 (e.g. the `emails/*.tsx` row and the
`lib/email/templates/affiliate/*` list further up this document) were not edited in place to
remove these now-deleted paths — consistent with this document's own "regenerate via the
categorization script" note and every prior session's practice of appending a new `<details>`
block rather than hand-editing the original compiled inventory.

</details>

<details>
<summary>Auth Cutover BUILD & UI Rewire — 5 new files, 5 modified
(Session 4B-20, PORT/UI-BUILD hybrid, Option B for OAuth, DECISION-LOG.md F56)</summary>

Zero traffic cutover — `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` defaults unset/`false` everywhere. F56
resolved Entry Criterion 0 (Option B: narrow OAuth-only `[...nextauth]` shim kept indefinitely,
credentials/2FA/registration/sessions cut to operation-service) and the rollout mechanism
(client-readable flag).

- **New:** `app/api/auth/token-register/route.ts` — the one genuinely-missing bridge route
  (mirrors `token-login`'s shape exactly: CSRF/origin validation, `forwardedRequestContext()`,
  `OperationServiceError` handling; sets no cookies, matching SOURCE — registration never logs
  the user in immediately).
- **New:** `lib/auth/auth-bridge-flag.ts` — `isAuthBridgeEnabled()`, the client-readable flag
  reader (bracket-notation `process.env['NEXT_PUBLIC_AUTH_BRIDGE_ENABLED']`, matching this
  repo's own existing live precedent in `hooks/use-ohlcv-socket.ts`).
- **New:** `__tests__/api/auth/token-register.test.ts` (8 tests), `__tests__/components/auth/
login-form.test.tsx` (5 tests), `__tests__/components/auth/register-form.test.tsx` (4 tests) —
  no test file previously existed for either UI component (L28-class gap, closed).
- **Modified:** `operation-service/src/auth/auth.service.ts` — `register()` now actually calls
  `sendVerificationEmail()` on the non-auto-verify path, closing a real gap open since Session
  3-2 (the method generated/stored a `verificationToken` but never emailed it — F27 had correctly
  deferred `/auth/register` routing until email-sending was ported, and nothing had revisited
  this specific method since). Log-and-continue on send failure, matching the monolith SOURCE's
  own non-fatal handling. `operation-service/src/auth/auth.service.spec.ts` updated to mock
  `../email/email.util` and cover the new call + failure path (+3 tests).
- **Modified:** `components/auth/login-form.tsx` / `register-form.tsx` — both flag-gated to call
  the `token-login`/`token-register` bridge routes instead of `next-auth/react`'s
  `signIn('credentials', ...)` / the monolith's own `/api/auth/register`, when
  `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED === 'true'`. Default path (flag off) is byte-for-byte
  unchanged. `lib/auth/auth-options.ts`, `components/auth/social-auth-buttons.tsx`, and
  `middleware.ts` are confirmed untouched (`git diff --stat`) — OAuth and the cookie/middleware
  bridge are both fully unaffected.
- **Modified:** `.env.example` — documents `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=false`.

Test suites: `operation-service` 42/42 suites, 381/381 tests (was 380/380 — +1). Monolith 126/126
suites, 2174/2174 tests (was 123/123, 2157/2157 — +3 suites, +17 tests). `tsc --noEmit` clean both
sides; `eslint app components lib hooks --max-warnings 0` clean (0 errors, 0 warnings).

</details>

---

**Compiled:** 2026-07-08 · **Updated:** 2026-08-03 (Session 4B-20, Auth Cutover BUILD & UI Rewire)
**Status:** Initial version — regenerate via the categorization script if the codebase changes significantly
