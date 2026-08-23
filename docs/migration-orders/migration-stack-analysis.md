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

## Session 4B-22 (Phase 4 Exit Review) — fresh `app/api/**` route census, 2026-08-04

Per that session's own Checklist step 2/3 (walking exit criteria 1-2 against live reality, not
memory). This is a route-file (not lib-file) census — it complements, not replaces, the 143-file
CORE/BUSINESS-FUNCTION appendix below, which is about `lib/*` service-layer files. Full reasoning
and Davin-facing writeup lives in `CLAUDE.md`'s Session 4B-22 Current entry; this is the durable
data backing it.

**Method:** every `app/api/**/route.ts` (122 files) checked for a `MIGRATE_*`/`shouldUseOperationServiceFor*`/
`shouldUseMoneyServiceFor*`/money-service-transport reference (server-side forwarding), plus a
manual check of the auth-bridge pages for client-side ternary route selection (a flag check that
lives in the calling page component, not the route handler, so it doesn't grep-match).

- **1 file deleted outright:** `app/api/auth/register/route.ts` (Session 4B-21, superseded by
  `token-register`, confirmed dead before deleting).
- **~34 files are flag-gated dual-implementation** (old monolith-native route stays as the
  flag-off/rollback path; new route or forwarding call is the flag-on path) — Slice 3 read APIs,
  Slice 4 write APIs (Stripe/dLocal/Admin/Disbursement), Slices 7-11 domain cutovers (alerts,
  drawings, notifications, tier, user/2FA/sessions), Wise recipient routes, and the 4
  client-side-ternary auth pages (forgot-password/reset-password/verify-email/resend-verification).
- **8 files are the bridge's own new-side routes** (`token-login`, `token-register`,
  `token-logout`, `token-refresh`, `token-forgot-password`, `token-reset-password`,
  `token-verify-email`, `token-resend-verification`) — always call `operation-service` directly;
  no flag check needed in the route itself since the flag lives client-side.
- **6 files are dead/orphaned, found this session, not previously flagged anywhere:**
  `app/api/auth/token-2fa-{backup-codes,disable,setup,status,verify-setup,verify}/route.ts` — a
  parallel bridge-prototype path (likely Session 3-4/3-5 era) with **zero UI consumers** (grep
  confirmed), superseded by `/api/user/2fa/*`'s own, different, already-live
  `MIGRATE_USER_2FA` cutover (Session 4B-11 — see that session's own Deviations, which explicitly
  called building these 5 routes "pure duplication — not done" but didn't note these 6 files
  already existed unwired from an earlier session). Harmless (unreferenced), not fixed this
  session (AUDIT variant, no code changes) — worth a small cleanup pass.
- **7 files are orphaned by an external cutover, not a flag:** `app/api/cron/*` — `vercel.json`'s
  `crons` array is empty since Session 4A-3; these route files are never invoked by anything
  anymore (money-service's own `CronsScheduler` runs all 8 jobs). Confirmed no other invocation
  path (grepped `.github/`, `railway*`, `package.json`).
- **1 file is orphaned by an external dashboard repoint:** `app/api/webhooks/dlocal/route.ts` —
  dLocal's own webhook subscription was repointed to money-service's URL directly (Session 4A-5);
  the monolith route stays as documented rollback capability, receiving no real traffic.
- **1 file is intentionally archived-not-deleted:** `app/api/webhooks/riseworks/route.ts` — per
  F42 (RiseWorks archival, not deletion — restorable).
- **1 file is a genuine, permanent, intentional exception matching the plan's own criterion-2
  example ("cookie-set helper from Phase 3"):** `app/api/auth/[...nextauth]/route.ts` (F56, OAuth
  stays on NextAuth indefinitely) and `app/api/realtime/token/route.ts` (the WS-bridge token
  issuer, monolith-side by design since Session 4B-17 — a persistent client socket can't be
  proxied through a route handler the way a REST call can).
- **1 real, unambiguous gap against the plan's own Slice 4 scope, found this session:**
  `app/api/webhooks/stripe/route.ts` is still 100% monolith-native. The plan's own Phase 4
  section (§6, 4A item 4) explicitly scopes Slice 4 as "Write APIs **+ Stripe webhook**" — and
  money-service HAS a fully-built, deployed `StripeWebhookController`/`StripeWebhookService`
  (Session 4A-9) — but Stripe's dashboard webhook subscription was never repointed, no
  `MIGRATE_*` flag exists for it (`lib/money-service/flags.ts` has no stripe-webhook reader), and
  nothing in any session's close-out ever named this as a deliberate exception. This is a real,
  previously-undiscovered gap against the plan's own literal scope — reported to Davin at this
  session's close, not fixed here (AUDIT variant).
- **~64 files were never part of Phase 4's own defined scope in the first place** (cross-checked
  against the plan's own explicit 4A 5-slice list and 4B domain-module list, §6) — most of
  `app/api/disbursement/**` beyond batch-execute, most of `app/api/admin/**` beyond code-dist,
  `app/api/affiliate/{auth,profile}/**`, `app/api/candles/[symbol]`, `app/api/checkout/validate-code`,
  `app/api/config/affiliate`, `app/api/invoices`, `app/api/payments/dlocal/*` (ancillary, non-`create`
  routes), `app/api/subscription` (GET), `app/api/test/seed`. These are correctly "routes that
  intentionally remain" under exit criterion 2's own wording — not because someone decided to
  keep them, but because Phase 4's own plan never targeted them. Worth Davin/Advisor confirming
  this reading is the intended one (vs. some of these being silently-dropped scope), since the
  plan's own text doesn't enumerate them individually.

**Reconciliation:** 1 (deleted) + 34 (flag-gated) + 8 (bridge new-side) + 6 (dead/orphaned) + 7
(cron-orphaned) + 1 (dlocal-webhook-orphaned) + 1 (riseworks-archived) + 2 (permanent exceptions)

- 1 (Stripe webhook gap) + 64 (never-in-scope) − 4 (the auth-bridge pages double-counted in both
  the "34 flag-gated" bucket and needing no separate line) ≈ 122 (rounding artifacts from bucket
  overlap, not independently re-verified to the file — see `CLAUDE.md` for the exact per-bucket
  file lists).

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
<summary><code>(root)/</code> — 2 files (was 3; Session 4B-17 retired 1, 2026-08-02 — backfilled Session 4B-22)</summary>

- `docker-compose.yml`
- `docker-compose.dev.yml` (new, Session 0-5 — CC-I local dev stack: Postgres, Redis,
  Next.js dev server; `mt5-service` intentionally excluded, SEPARATE_STACK; PgBouncer and
  the NestJS services join in later phases)
- ~~`railway-worker.json`~~ — **RETIRED, Session 4B-17** (alongside `scripts/alert-worker.ts`,
  itself already retired Session 4B-3 — this file only ever pointed at that script; the
  `worker:alerts` npm script was dropped in the same commit). This entry was never
  backfilled here until Session 4B-22's Phase 4 exit review found it live-missing from disk
  while the doc still listed it as present.

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

**Session 7-3 update (2026-08-20, RETIRED):** `stackA`/`stackB`, the `api` export, `apiCall`/
`BASE_URL`, and the 6 unused legacy interfaces (`AlertData`, `UserData`, `SubscriptionData`,
`PaymentData`, `SettingsData`, `QueryParams`) described below are **deleted**. `lib/api/index.ts`
now strictly exports the generated-client surface (`createOperationApi`, `createMoneyApi`,
`unwrapOperationApi`, `unwrapMoneyApi`, `getOperationServiceToken`, `getMoneyServiceToken`, and
their generated types). Everything below this note is historical — retained because it documents
the real bugs that justified retiring rather than fixing these exports. Full detail in
`7-3-api-client-contract-tests-and-retirement.migration-order.md` and the new canonical
`docs/architecture/api-client-architecture.md`.

Also this session: deleted `__tests__/lib/api/stack-a-client.test.ts`, `stack-b-client.test.ts`,
and `__tests__/integration/api-client-workflow.test.ts` (exclusively tested the retired exports);
expanded `__tests__/lib/api/generated-clients.test.ts` from 12 to 43 contract tests; prepended a
`HISTORICAL/SUPERSEDED` notice to the 5 legacy design docs in `backend-stack-a/api-client-
between-frontend-and-stack-b/` (kept, not deleted — the bug catalogue below is exactly why); new
file `docs/architecture/api-client-architecture.md` (canonical reference, supersedes those 5).

**Session 7-1 update (2026-08-12):** `stackA`/`stackB` themselves were UNCHANGED and still broken
exactly as described below (re-verified against live routes at Session 7-1's CONFIRM, zero
drift). What changed: `lib/api/index.ts` also gained `operationApi`/`moneyApi`
(`lib/api/generated/`), typed clients generated from `@nestjs/swagger`-emitted specs covering all
107 operation-service/money-service operations. The whole file became server-only (see its own
header). Full detail in `7-1-api-client-reverify-and-generate.migration-order.md`.

**⚠️ Historical — known broken, since retired (originally flagged 2026-07-11):** this "unified
Stack A/Stack B API client" (design docs, now `HISTORICAL/SUPERSEDED`:
`backend-stack-a/api-client-between-frontend-and-stack-b/api-client-{design,
maintenance-and-updates,testing}.md`) had zero real consumers — the only caller in the app was
`app/test-api/page.tsx`, an unguarded debug page (deleted at Session 6-12); every real product
hook/component called its route directly via `fetch()` instead. It was also broken against the
live routes it claimed to wrap: `updateAlert()` sent `PUT` where the route only accepts `PATCH`;
`markNotificationAsRead()` sent `PATCH /api/notifications/{id}` where the route needs
`POST /api/notifications/{id}/read`; `updateSettings()` sent `PATCH /api/user/preferences` where
the route only accepts `PUT`; `stackB.getMarketData()/getOHLCV()` called a path shape
(`/api/market-data/{symbol}`) that didn't match the one real market-data route that exists
(`GET /api/market-data/channel?symbol=&timeframe=&variant=&limit=`, V8 PRO-only). Its own Jest
tests (`__tests__/lib/api/stack-a-client.test.ts`, `stack-b-client.test.ts`) fully mocked `fetch`,
so they passed (36/36) without exercising any of this — no real signal there. Also stale: the
design docs' Stack A/B model (Parts 1-19 deployed / Parts 20-26 future) predated the V8
single-symbol redesign and didn't reflect it. This is exactly the bug catalogue that justified
Session 7-3's Decision 1 (retire, don't fix) — nothing real ever depended on this code.

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
<summary><code>lib/websocket/</code> — 0 files (was 1; Session 4B-17 retired it, 2026-08-02 — backfilled Session 4B-22)</summary>

- ~~`lib/websocket/server.ts`~~ — **RETIRED, Session 4B-17**: `initWebSocketServer` was never
  actually called in production (no custom server wraps `next start`); confirmed dead code via
  grep before deleting. Real-time delivery now lives in `operation-service`'s `RealtimeGateway`
  (Sessions 4B-17/18). This entry was never backfilled here until Session 4B-22's Phase 4 exit
  review found it live-missing from disk while the doc still listed it as present.

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
<summary><code>emails/</code> — 0 files (was 5; Session 4B-19 retired all 5, 2026-08-03 — backfilled Session 4B-22)</summary>

- ~~`emails/index.ts`~~, ~~`emails/payment-confirmation.tsx`~~, ~~`emails/payment-failure.tsx`~~,
  ~~`emails/renewal-reminder.tsx`~~, ~~`emails/subscription-expired.tsx`~~ — **RETIRED, Session
  4B-19** (Email Rendering Port Audit, Option A): confirmed never-wired-up — the live
  email-sending infrastructure was already fully in `operation-service`
  (`subscription-email.util.ts`, Sessions 3-4/4A-11); these were dead React-email templates with
  zero real callers. This entry was never backfilled here until Session 4B-22's Phase 4 exit
  review found the files live-missing from disk while the doc still listed them as present.

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
<summary><code>lib/email/</code> — 1 file (was 6; Session 4B-19 retired 5, 2026-08-03 — backfilled Session 4B-22)</summary>

- `lib/email/subscription-emails.ts` — **KEPT, trimmed**: Session 4B-19 removed 2 confirmed-dead
  functions (never called anywhere); the rest of the file is still live.
- ~~`lib/email/templates/affiliate/code-distributed.tsx`~~,
  ~~`lib/email/templates/affiliate/code-used.tsx`~~,
  ~~`lib/email/templates/affiliate/monthly-report.tsx`~~,
  ~~`lib/email/templates/affiliate/payment-processed.tsx`~~,
  ~~`lib/email/templates/affiliate/welcome.tsx`~~ — **RETIRED, Session 4B-19**, same
  never-wired-up finding as `emails/*` above. This entry was never backfilled here until Session
  4B-22's Phase 4 exit review found the files live-missing from disk while the doc still listed
  them as present.

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
  (GET+POST), `token-2fa-disable/route.ts` — **retired at Session 7-2 (2026-08-20):** zero UI
  consumers ever (superseded by `/api/user/2fa/*` at Session 4B-21); all 6 files + their test
  deleted, see that session's Decision 2.
- `__tests__/api/auth/token-email-flows.test.ts`, `token-2fa-flows.test.ts` — the latter deleted
  alongside its routes at Session 7-2 (above).

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

<details>
<summary><strong>2026-08-10 — Phase 6 UI gap analysis (out-of-band, pre-Session 6-1)</strong></summary>

Not a code-changing session — a full read-only census producing the input evidence for Session
6-1 (F11). Zero files under `app/`, `components/`, `lib/`, `hooks/`, `operation-service/` or
`money-service/` were created, modified or deleted.

- **New:** `docs/files-completion-list/ui-page-gap-analysis.md` — the gap report: complete
  operating workflows for all 4 user types (Admin / Affiliate / PRO / FREE); Section A
  code-backed gaps (18 existing pages to MODIFY, 12 NEW pages, 3 to RETIRE); Section B
  UX/completeness gaps (22 NEW pages); Section C structural findings.
- **New:** `docs/files-completion-list/ui-page-gap-register.xlsx` — 4 sheets: Summary,
  Page Register (90 rows: EXISTING / MODIFY / NEW / RETIRE / UNREGISTERED, with
  Admin/Affiliate/PRO/FREE/Public columns and priority P1–P4), Orphaned Endpoints (32 rows),
  Dead Links (14 rows with file:line references).
- **Method:** enumerated `app/**/page.tsx` (57 files), `app/api/**/route.ts` (122 endpoints),
  `operation-service` + `money-service` NestJS controllers, all 21 OpenAPI specs in
  `docs/open-api-documents/`, all 33 Prisma models, and every internal `href` in `app/` +
  `components/`. Every "no UI consumer" and "mock data" claim re-verified by a second pass at
  file:line before publication.
- **Register reconciliation:** `docs/files-completion-list/ui-pages.xlsx` lists 54 pages; the
  real baseline is **56 distinct routes**. Rows 18 and 18-5 are the same dynamic route
  (`/charts/[symbol]/[timeframe]`), and three Admin detail pages exist in code but were never
  registered: `/admin/affiliates/[id]`, `/admin/fraud-alerts/[id]`,
  `/admin/disbursement/batches/[batchId]`.
- **Consequence for the migration:** `DECISION-LOG.md` F11 enumeration discharged (triage still
  OPEN, due 6-1); F61/F62/F63 registered OPEN; Phase 6 grew from ~9 to 12 sessions in the
  playbook and plan §8 (6-1b, 6-10, 6-11 added; phase exit renumbered 6-9 → 6-12).

</details>

---

<details>
<summary><strong>2026-08-10 — Session 6-1 (Frontend Gap Matrix & Endpoint Mapping, F11)</strong></summary>

Documentation-only session — no code changed. Independently re-verified the 2026-08-10 UI gap
analysis (above) against live code (headline findings + ~40 of ~54 itemized rows, all held
except two trivial corrections and one useful addition — see `phase-6-frontend-gap-matrix.md`'s
own "Corrections found this session") and produced the actual gap matrix artifact.

- **New:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` — every Section A1/A2/B1/B2/C
  row from the source gap analysis, re-verified, assigned a target session (6-1b…6-12), with a
  Triage column awaiting Davin (F11 stays OPEN pending it).
- **Regression baseline re-measured:** `tsc --noEmit` clean; `test:ci` 129/129 suites, 2191/2191
  tests. `eslint app components lib hooks --max-warnings 0` found NOT clean (3 pre-existing
  warnings, unrelated files, `eslint-config-next` version drift since Session 4B-21 — see
  `LESSONS-LEARNED.md`).
- **Consequence:** `DECISION-LOG.md` F11 stays OPEN (matrix delivered, triage pending); F61's
  entry extended with the `lib/geo/detect-country.ts` finding. `6-1b-mock-data-hotfix.migration-
order.md` PRE-DRAFTed (PORT, low dial).

</details>

---

<details>
<summary><strong>2026-08-10 — Session 6-1b (Mock-Data Hotfix, PORT, low dial)</strong></summary>

Fixed all 3 fabricated-data pages plus 1 fabricated field found by the 2026-08-10 UI gap analysis
and re-confirmed by Session 6-1. Monolith-internal only, zero flags, zero new routes.

- **Modified (4 pages + 1 route, 4 commits):** `app/(dashboard)/settings/billing/page.tsx`
  (`mockInvoices`/hardcoded usage stats removed; wired to `GET /api/invoices`,
  `GET /api/subscription`, `POST /api/subscription/cancel`, `GET /api/alerts`; mounts
  `components/billing/invoice-list.tsx`); `app/api/subscription/route.ts` (additive `trial` field
  — `trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial` — so the billing page
  has a real data source for its trial banner); `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`
  (`MOCK_ALERT` removed; wired to the real `FraudAlert` schema, dropping 4 mock-only fields that
  don't exist on the model — `riskScore`/`paymentAttempts`/`previousAlerts`/`userAgent`); `app/
(dashboard)/admin/page.tsx` (mock activity generator removed; panel now shows the 5 most recent
  real `FraudAlert` rows via `GET /api/admin/fraud-alerts`, relabeled "Recent Fraud Alerts");
  `app/(dashboard)/settings/page.tsx` (hardcoded `alerts: 3` replaced with a real
  `GET /api/alerts` count).
- **New:** 4 test files under the newly-created `__tests__/pages/{settings,admin}/` — 15 tests
  total, first-ever test coverage for all 4 pages.
- **Not mounted, deliberately:** `components/billing/subscription-card.tsx` — a real, pre-existing
  undo-doesn't-reactivate bug found while reading it before wiring (`DECISION-LOG.md` F64, new,
  OPEN); the existing hand-rolled cancel-confirmation dialog was kept instead.
- **Regression:** `tsc --noEmit` clean; `eslint --max-warnings 0` — same 3 pre-existing warnings,
  0 new; `test:ci` 133/133 suites, 2206/2206 tests (was 129/129, 2191/2191 — +4 suites/+15 tests).
- **Not done:** live manual check of all 4 pages against a real logged-in session — blocked by
  Session 4B-21's removal of `CredentialsProvider`; carried forward.

</details>

---

<details>
<summary><strong>2026-08-10 — Session 6-2 (IA + Design System + Shared Shells, UI-BUILD)</strong></summary>

F62 resolved and executed (Davin, Option a — merge `app/admin/*` into `app/(dashboard)/admin/*`).
Five ordered steps, one commit each, zero flags, zero backend changes.

- **New:** `app/not-found.tsx`, `app/global-error.tsx` (B1-1/B1-2 — Next.js previously fell back to
  generic defaults for both).
- **Modified:** `app/(dashboard)/settings/page.tsx` (grid now links all 9 real subpages, was 4);
  `components/layout/sidebar.tsx` + `mobile-nav.tsx` (`/analytics`/`/indicators` dead links
  removed); `components/auth/register-form.tsx` (`/affiliate/join` → real `/affiliate/register`);
  `app/(marketing)/layout.tsx` (footer pruned from 4 columns/11 links to 2 columns/4 links —
  Company and Resources columns removed entirely, zero valid destinations remained in either);
  `next.config.js` (new permanent redirect, `/admin/login` → `/login`); `middleware.ts`
  (`/admin/:path*` added to the matcher, no longer excluded now the standalone login page is
  gone); `app/(dashboard)/admin/layout.tsx` (nav expanded 4 → 8 sections).
- **Moved (`git mv`, URLs unchanged):** `app/admin/affiliates/page.tsx`,
  `app/admin/affiliates/[id]/page.tsx`, `app/admin/affiliates/reports/{code-inventory,
commission-owings,profit-loss,sales-performance}/page.tsx`, `app/admin/settings/affiliate/
page.tsx` → their `app/(dashboard)/admin/*` equivalents.
- **Deleted:** `app/admin/login/page.tsx` (replaced by the `next.config.js` redirect);
  `app/admin/` (now empty); `__tests__/app/admin-login.test.tsx` (no equivalent page left to
  test).
- **Deliberately untouched (carve-outs, Davin live at CONFIRM):** `/terms`, `/privacy` (owned by
  `DECISION-LOG.md` F63 / Session 6-10); `/notifications` (owned by Session 6-4, the bell's own
  link).
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  3 pre-existing warnings, 0 new; `test:ci` 132/132 suites, 2202/2202 tests (was 133/133,
  2206/2206 — the -1 suite/-4 tests is exactly the retired admin-login test, zero regressions
  elsewhere); `next build` re-verified clean at session close.
- **Not done:** live browser click-through of the consolidated admin nav and full settings grid
  under a real authenticated session — carries forward the same gap as Session 6-1b's own
  (Waiting-on #117, `CredentialsProvider` removed at Session 4B-21).

</details>

---

<details>
<summary><strong>2026-08-10 — Session 6-3 (Alerts & Charts, UI-BUILD)</strong></summary>

Wires the 3 orphan `/api/tier/*` endpoints into a real UI consumer and builds the missing
`/alerts/[id]/edit` route (A1-11/A2-4). Zero flags, zero backend changes.

- **New:** `app/(dashboard)/alerts/[id]/edit/page.tsx` (server component — session/tier gate,
  direct Prisma read matching `/alerts/page.tsx`'s own convention, `notFound()` for both a
  missing alert and a wrong-owner alert); `app/(dashboard)/alerts/[id]/edit/edit-alert-client.tsx`
  (client wrapper, `PATCH /api/alerts/[id]`); `__tests__/pages/alerts/edit.test.tsx` (7 tests,
  first-ever test in this repo covering an async Server Component page directly).
- **Modified:** `components/alerts/alert-form.tsx` (redesigned to self-fetch
  `GET /api/tier/symbols` + `/combinations` for available symbols/timeframes and
  `GET /api/tier/check/[symbol]` for real-time access validation, replacing its own now-removed
  `availableSymbols`/`availableTimeframes` props — the component had zero live callers before this
  session, so this was a safe, non-breaking redesign; also locks the condition-type selector in
  edit mode, matching the real `updateAlertSchema`'s own `isActive`/`name`/`targetValue`-only
  contract); `app/(dashboard)/alerts/alerts-client.tsx` (Edit button added per alert card, linking
  to `/alerts/${id}/edit`).
- **Found, not fixed (out of scope):** `AlertForm` was completely orphaned before this session —
  `/alerts/new` uses a separate, hand-rolled `create-alert-client.tsx` with its own duplicated
  form fields, never `AlertForm`. Left `create-alert-client.tsx` untouched (out of this order's
  own Surface).
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  3 pre-existing warnings (Session 6-1's own L56 finding), 0 new; `test:ci` 133/133 suites,
  2209/2209 tests (was 132/132, 2202/2202 — +1 suite/+7 tests, exactly this session's own new
  file, zero regressions elsewhere).
- **Not done:** live manual check of the create + edit alert flows under a real authenticated
  session — carries forward the same gap as Sessions 6-1b/6-2 (Waiting-on #117,
  `CredentialsProvider` removed at Session 4B-21). Partial substitute: confirmed the new route
  compiles and runs cleanly under the real Next.js/Turbopack dev server (unauthenticated request
  correctly redirected to `/login?callbackUrl=...`).

</details>

---

<details>
<summary><strong>2026-08-10 — Session 6-4 (Notifications, UI-BUILD)</strong></summary>

Builds the missing `/notifications` page — the bell's own "View all" link (Session 4B-9/4B-17) had
pointed at it since it existed, always 404ing. Zero flags, zero backend changes; all 5
`/api/notifications/*` routes were already live.

- **New:** `app/(dashboard)/notifications/page.tsx` (server component — `getSession()`/redirect,
  mounts the previously-orphaned `NotificationList`); `__tests__/pages/notifications/notifications-page.test.tsx`
  (8 tests, first-ever coverage for `NotificationList`, following `edit.test.tsx`'s own
  async-server-component-page pattern).
- **Modified:** `components/notifications/notification-list.tsx` (wired `useRealtimeSocket`,
  mirroring `notification-bell.tsx`'s own established pattern — re-fetch on push, don't merge the
  payload directly; added an `aria-live="polite"` screen-reader announcement for realtime pushes,
  serving the order's own explicit A11y Standards rule); `middleware.ts` (added
  `/notifications/:path*` to the matcher — found missing while live-verifying Step 3; every other
  `(dashboard)` route already had this edge-level defense-in-depth, mirroring exactly how
  `/admin/:path*` was added at Session 6-2).
- **Found, not a security hole:** the page-level `getSession()` guard already redirected correctly
  before the middleware fix (proven via live dev-server logs) — the gap was a missing earlier
  layer, not an actual bypass.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  3 pre-existing warnings, 0 new; `test:ci` 134/134 suites, 2217/2217 tests (was 133/133,
  2209/2209 — +1 suite/+8 tests, exactly this session's own new file, zero regressions elsewhere).
- **Not done:** live manual click-through of the bell → `/notifications` flow under a real
  authenticated session — carries forward the same gap as every Phase 6 session since 6-1b
  (Waiting-on #117, `CredentialsProvider` removed at Session 4B-21). Partial substitute: confirmed
  the route compiles and runs cleanly under the real Next.js/Turbopack dev server, with the full
  unauthenticated redirect chain (including the middleware fix) proven live via server logs.

</details>

<details>
<summary><strong>2026-08-11 — Session 6-5 (Settings/User, UI-BUILD)</strong></summary>

Builds the missing account-deletion confirm/cancel pages — all 3 `app/api/user/account/deletion-*`
routes were already live (Session 4B-11) but zero pages existed for a user to land on after
clicking an email link. Zero flags, zero backend service changes.

- **New:** `app/(public)/settings/account/delete/confirm/page.tsx` (human-in-the-loop gate — never
  auto-fires `deletion-confirm`); `app/(public)/settings/account/delete/cancel/page.tsx`
  (auto-fires on mount, token-or-session dual mode); `app/(dashboard)/settings/account/account-settings-client.tsx`
  (client half of the account-settings restructure, see Modified); 2 new test files,
  `__tests__/pages/settings/account-deletion.test.tsx` (7 tests) and
  `__tests__/pages/settings/account-settings-page.test.tsx` (6 tests).
- **Modified:** `app/(dashboard)/settings/account/page.tsx` (rewritten from a `'use client'` page
  into a server component — `getSession()` + a direct `prisma.accountDeletionRequest.findFirst`
  read, mirroring the `alerts/[id]/edit` precedent, since none of the 3 real routes exposes a
  side-effect-free status check; passes the result to the new client component); `middleware.ts`
  (exact-pathname allow-list for the 2 new public paths — Davin's live choice among 3 options,
  since the deletion-confirm/cancel APIs are deliberately unauthenticated/optional-auth);
  `app/api/user/account/deletion-request/route.ts` (fixed its own dormant `confirmationUrl`/
  `cancelUrl` construction, which pointed at paths that never existed — currently inert since
  email sending is still a TODO, but would have 404'd every deletion email once wired up).
- **A two-layer auth-gate bug found only by live browser verification, fixed same-session:** the
  middleware allow-list alone wasn't sufficient — `app/(dashboard)/layout.tsx` does its own
  server-side `getServerSession()`+`redirect` on every page it wraps, independent of middleware,
  and the new pages initially lived inside that route group. Relocated both pages to a new
  `app/(public)/` route group (route groups are transparent to the URL, so the URLs themselves are
  unchanged); confirmed live, unauthenticated: both pages 200 OK with correct content,
  `/settings/account` and `/settings/security` both still correctly redirect to `/login`.
- **A fabricated-UI finding, same class as Session 6-1b's own scope:** `settings/account/page.tsx`'s
  "Two-Factor Authentication" section was a dummy `useState` toggle, zero calls to any
  `/api/user/2fa/*` endpoint. The real, fully-wired implementation already exists at
  `settings/security/page.tsx` (gap-matrix row A1-9) — replaced the dummy widget with a "Manage
  2FA" link rather than duplicating that page's logic.
- **Grace-period correction:** the order's own Context text conflated two genuinely different, both
  real deadlines — the 7-day `AccountDeletionRequest.expiresAt` link-expiry window (REQUEST→CONFIRM)
  and the 24-hour execution window (`deletion-confirm/route.ts`'s own live response,
  CONFIRM→execution). Split correctly: pre-confirm/pending-banner copy states 7 days; post-confirm/
  CONFIRMED-banner copy states 24 hours, noting cancellation is still possible during it.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same 3
  pre-existing warnings, 0 new; `test:ci` **136/136 suites, 2230/2230 tests** (was 134/134,
  2217/2217 — +2 suites/+13 tests, exactly this session's own new files, zero regressions
  elsewhere).
- **Not done:** deep interactive click-through of the real 2FA flows on `settings/security` under a
  real authenticated session — same standing gap as every Phase 6 session since 6-1b (Waiting-on
  #117). `operation-service/src/users/users.service.ts`'s own `requestDeletion()` has the identical
  stale URL-construction bug the monolith route was fixed for this session — left for whichever
  future session wires up real deletion-email sending (a backend-service change, out of this
  UI-BUILD session's scope).

</details>

---

<details>
<summary><strong>2026-08-11 — Session 6-6 (Admin, UI-BUILD)</strong></summary>

Closes the 6 ADMIN-surface gap-matrix rows (A1-5, A1-6, A1-14, A1-17/A2-10, A2-5, A2-7). Zero flags
touched.

- **New:** `app/(dashboard)/admin/users/[id]/page.tsx` (server component, direct Prisma reads, 5
  sections — Profile & Account, Subscription & Billing, Security & 2FA, Fraud Alerts, Affiliate &
  Code Info); `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx` (the order assumed
  this existed and only needed wiring — it didn't exist at all); `app/(dashboard)/admin/
disbursement/affiliates/[affiliateId]/page.tsx` (same gap — only a flat list page existed at the
  parent route); 3 new test files, `__tests__/pages/admin/user-detail.test.tsx` (3 tests),
  `__tests__/pages/admin/code-cancel.test.tsx` (5 tests).
- **Modified:** `lib/disbursement/constants.ts`/`providers/provider-factory.ts` (added `WISE` to
  `SUPPORTED_PROVIDERS`/`getDefaultProvider`/`isProviderAvailable` — money-service's own copy had
  this since Session 4A-W6/W7, the monolith's copy was never synced); `app/api/disbursement/
config/route.ts` (added `WISE` to the `available` list); `app/(dashboard)/admin/disbursement/
config/page.tsx` (WISE radio option; fixed a pre-existing bug where `config.provider` was
  typed/rendered as a flat string when the real API returns a nested object); `app/(dashboard)/
admin/disbursement/accounts/page.tsx` (rewritten to `redirect()` to `recipients/page.tsx`, not
  rebuilt — the target page already existed, Session 4A-W3b); `app/(dashboard)/admin/disbursement/
recipients/page.tsx` (gained a Wise-Recipients/RiseWorks-Historical tab switcher);
  `app/(dashboard)/admin/disbursement/layout.tsx` (removed the now-redundant "RiseWorks Accounts"
  nav entry, provider badge/widget now read `getDefaultProvider()`); `app/(dashboard)/admin/
disbursement/page.tsx` (Quick Actions link repointed to `recipients`); `app/(dashboard)/admin/
affiliates/reports/code-inventory/page.tsx` (added a standalone cancel-a-code widget + confirmation
  dialog — no per-code listing UI/API exists anywhere, so this isn't a per-row action);
  `app/(dashboard)/admin/users/page.tsx` (added a "View Details" link per row); `app/(dashboard)/
admin/disbursement/affiliates/page.tsx` (added "View"/"View" links to the new detail page);
  `__tests__/lib/disbursement/constants.test.ts` (updated a pre-existing assertion for the new
  `SUPPORTED_PROVIDERS` array).
- **A factually wrong batch-status vocabulary in the order's own text, caught before any code was
  written:** the order mandated `DRAFTING`/`PENDING_APPROVAL`/`APPROVED`/`PROCESSING`/`COMPLETED`/
  `CANCELLED` — none of `DRAFTING`/`PENDING_APPROVAL` exist anywhere in either Prisma schema. Real
  `PaymentBatchStatus` is `PENDING, QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED`; real
  `WiseBatchGroupStatus` is `NEW, COMPLETED, AWAITING_MANUAL_FUNDING, FUNDED,
MARKED_FOR_CANCELLATION, PROCESSING_CANCEL, CANCELLED`. Davin corrected this live before execution.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — 4
  warnings (3 pre-existing since Session 6-1, 1 new-but-unrelated to this session's own edits — see
  Waiting-on #120), 0 introduced by this session's own edits; `test:ci` **138/138 suites, 2238/2238
  tests** (was 136/136, 2230/2230 — +2 suites/+8 tests, exactly this session's own new files, zero
  regressions elsewhere).
- **Not done:** live authenticated click-through of any of the 5 new/modified admin routes — same
  standing gap as every Phase 6 session since 6-1b (Waiting-on #117); all 5 verified instead via a
  live dev server's unauthenticated redirect chain (clean compile, zero server errors, correct
  `callbackUrl`).

</details>

---

<details>
<summary><strong>2026-08-11 — Session 6-7 (Affiliate, UI-BUILD)</strong></summary>

Closes the 6 AFFILIATE-surface gap-matrix rows (A1-15, A1-16, A2-6, A2-11, B2-19, B2-20). Zero
flags touched.

- **New:** `app/affiliate/dashboard/payouts/page.tsx` (server component, direct Prisma read scoped
  to the caller's own `DisbursementTransaction` rows, real `PaymentBatchStatus`/`WiseTransfer`
  sub-status); `app/affiliate/dashboard/code-inventory/page.tsx` (wires the already-live `GET
/api/affiliate/dashboard/code-inventory`); `app/affiliate/dashboard/statements/page.tsx`
  (client-side monthly aggregation of `commission-report` + CSV export, no new endpoint);
  `app/affiliate/dashboard/resources/page.tsx` (client-side resource hub — referral-link generator
  off the existing `codes` endpoint, FAQ off real `AFFILIATE_CONFIG` values, no new endpoint); 4
  new test files under `__tests__/pages/affiliate/` (23 tests).
- **Modified:** `app/affiliate/dashboard/profile/payment/page.tsx` (rewritten to a transparent
  `redirect()` to `/affiliate/settings/payout` — the legacy PayPal-style payment page is retired);
  `app/affiliate/dashboard/profile/page.tsx` (nav link repointed to the canonical payout page);
  `app/affiliate/settings/payout/page.tsx` (small copy addition linking to the new payouts page);
  `app/affiliate/dashboard/commissions/page.tsx` + `components/affiliate/commission-table.tsx`
  (fixed a genuine pre-existing bug — both read the non-existent `commission.amount` instead of
  the real Prisma field `commissionAmount`, a live crash on any real commission row; added a link
  to the new payouts page); `app/affiliate/dashboard/layout.tsx` (nav entries for all 4 new pages);
  `__tests__/components/affiliate/commission-table.test.tsx` (mock data corrected to the real
  field name, one unrelated pre-existing lint error fixed).
- **A real, previously-invisible production bug found and fixed while touching this exact code
  path, not part of the order's own literal ask:** see `LESSONS-LEARNED.md` L62 — `commission.amount`
  doesn't exist on the real API response (`commissionAmount`, a Decimal serializing as a string);
  every real commission row would have thrown `TypeError` on render, undetected because the only
  existing test mocked the same wrong field name.
- **A factually wrong page-content claim in the order's own text, caught before any code was
  written:** the order's Context section (both PRE-DRAFT and rewritten-APPROVED versions) claimed
  `commissions/page.tsx` "shows only a static 'Ready for payout' string... no reference to real
  models" — the page was already fully live-data-driven; the real gap was narrower (no
  `PaymentBatch`/`WiseTransfer` join existed). Davin resolved the resulting enum-scoping question
  live: `CommissionStatus` stays on the commissions page, `PaymentBatchStatus` moved to the new
  payouts page.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  4 pre-existing warnings, 0 introduced; `test:ci` **142/142 suites, 2261/2261 tests** (was
  138/138, 2238/2238 — +4 suites/+23 tests, exactly this session's own new test files, zero
  regressions elsewhere).
- **Not done:** live authenticated click-through of any of the 6 new/modified affiliate routes —
  same standing gap as every Phase 6 session since 6-1b (Waiting-on #117); all 6 verified instead
  via a live dev server's unauthenticated redirect chain (clean compile, zero server errors,
  correct `callbackUrl`).

</details>

---

<details>
<summary><strong>2026-08-11 — Session 6-8 (Payments / Checkout, UI-BUILD)</strong></summary>

Closes the 4 PAYMENTS-surface gap-matrix rows (F61/A1-7, A1-8, A2-8, A2-9). Resolves
`DECISION-LOG.md` F61. Zero flags touched.

- **New:** `app/api/geo/detect/route.ts` (thin wrapper around the already-live, previously-
  zero-importer `lib/geo/detect-country.ts`, resolves F61); `app/checkout/return/page.tsx`
  (wires the previously-orphaned `GET /api/payments/dlocal/[paymentId]`, real `PaymentStatus`
  vocabulary — PENDING/COMPLETED/FAILED/CANCELLED/REFUNDED, not the order's own paraphrase);
  `app/upgrade/success/page.tsx` (confirms real PRO status via `GET /api/subscription` rather
  than trusting the `upgrade` query param alone); 3 new test files under
  `__tests__/pages/checkout/` (17 tests).
- **Modified:** `app/api/checkout/route.ts` + `money-service/src/stripe/
stripe-checkout.controller.ts` (both `successUrl` constructions repointed from
  `/dashboard?upgrade=success` to `/upgrade/success?upgrade=success` — mirrored identically since
  Stripe checkout write traffic is cut over to money-service in production, Session 4A-10b,
  making the monolith's own copy dead code otherwise).
- **Deliberately NOT modified, per Davin's live Step 2 resolution:**
  `components/payments/DiscountCodeInput.tsx` and `components/payments/PriceDisplay.tsx` — both
  already had working consumers of different, real endpoints (`validate-discount`, `convert`);
  the order's own literal "wire an orphan" instruction for both would have been a behavior change,
  and for `PriceDisplay` would have forced client-side math violating the order's own
  Service-Returned Math Rule. `POST /api/checkout/validate-code` and
  `GET /api/payments/dlocal/exchange-rate` stay genuinely orphaned.
- **A real gap found and escalated mid-session, not part of the order's own literal ask:**
  `app/api/checkout/route.ts`'s `successUrl` construction is dead code in production (forwarded
  to money-service whenever `MIGRATE_WRITE_APIS_MONEY_STRIPE` is on) — asked Davin directly before
  committing Step 4 rather than shipping a fix with zero live effect; his call was to mirror both
  files.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  4 pre-existing warnings, 0 introduced; `test:ci` **145/145 suites, 2278/2278 tests** (was
  142/142, 2261/2261 — +3 suites/+17 tests, exactly this session's own new test files, zero
  regressions elsewhere).
- **Not done:** live authenticated click-through of `/checkout/return`/`/upgrade/success` against
  a real dLocal/Stripe payment — same standing gap as every Phase 6 session since 6-1b
  (Waiting-on #117). Also found, not fixed (out of session scope): `lib/dlocal/
dlocal-payment.service.ts`'s `createPayment` never sends a `return_url`/`success_url` to dLocal,
  so no real dLocal payment flow currently redirects a customer back to `/checkout/return` at all.

</details>

<details>
<summary><strong>2026-08-11 — Session 6-10 (Public / Marketing Surface, UI-BUILD)</strong></summary>

Closes all 12+ PUBLIC/MARKETING-surface gap-matrix rows (B1-3/4/5, B2-1..12). Resolves
`DECISION-LOG.md` F63. Zero flags touched.

- **New:** `app/(marketing)/{terms,privacy,disclaimer,about,docs,blog,changelog,careers,help,
status}/page.tsx` (10 pages — built under `app/(marketing)/` rather than the order's literal
  top-level path citation, to inherit `MarketingLayout`'s header/nav/footer automatically, matching
  the established `/pricing` precedent); `app/affiliate/page.tsx` (public landing, imports
  `MarketingLayout` directly since `app/affiliate/` already has real subroutes and its own
  passthrough layout — a competing `(marketing)/affiliate/` route would collide);
  `app/affiliate/join/page.tsx` (transparent `redirect('/affiliate/register')`);
  `lib/status/check-system-status.ts` (real DB/`operation-service` health/payment-config checks,
  not fabricated status copy); `app/api/status/route.ts` (public JSON monitoring endpoint,
  matching the `app/api/disbursement/health` precedent); `__tests__/pages/marketing/
public-pages.test.tsx` (13 tests).
- **Modified:** `app/(marketing)/layout.tsx` (restored the 4 footer columns Session 6-2 pruned —
  Product/Company/Resources/Legal — now pointing at all 10 built pages, per the file's own comment
  naming this session as the one to do it).
- **Not modified (already correct):** `components/auth/register-form.tsx` — its consent-checkbox
  `/terms`/`/privacy` links already targeted the right paths; only the destination pages were
  missing.
- **CONFIRM found 5 live-state findings the order text didn't reflect**, all resolved live with
  Davin: the footer-restoration gap above; `register-form.tsx:617`'s `/affiliate/join` reference
  was already repointed to `/affiliate/register` at Session 6-2 (built the redirect anyway, for
  bookmarks/external links); `components/layout/footer.tsx`'s dashboard-scoped external status
  link (`https://status.tradingalerts.com`) stays untouched, separate from the new internal
  `/status`; `/terms` adapts the existing, already-reviewed content from `app/(dashboard)/
settings/terms/page.tsx` rather than drafting an independent version; `settings/help`'s stub
  comment (B1-3) reconfirmed present, out of this session's fixable scope (no backend changes).
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  4 pre-existing warnings, 0 introduced; `test:ci` — see this session's own close-out for the final
  count (13 new tests added on top of 6-8's 2278/2278 baseline).
- **Not done:** live click-through of every new page against a real deployed environment — same
  standing gap as every Phase 6 session since 6-1b (Waiting-on #117).

</details>

<details>
<summary><strong>2026-08-11 — Session 6-11 (Admin System Operations, UI-BUILD)</strong></summary>

Closes all 4 ADMIN-SYSTEM-OPERATIONS gap-matrix rows (B2-14/15/16/17). Zero flags touched, no
`DECISION-LOG.md` flag applies.

- **New:** `lib/admin/system-jobs.ts` (the real 8-job cron registry, ids matching money-service's
  `CronTriggerController` route segments exactly); `app/api/admin/system/terminals/route.ts` +
  `app/(dashboard)/admin/system/terminals/page.tsx` (B2-14, live flask-api reachability check with
  an honest `not_configured`/`restricted`/`offline`/`degraded`/`online` discriminant);
  `app/api/admin/system/jobs/[jobId]/trigger/route.ts` + `app/(dashboard)/admin/system/jobs/
page.tsx` (B2-15, re-scoped at CONFIRM to money-service's real `CronTriggerController` — see
  this session's own close-out for the full finding); `app/api/admin/system/outbox/retry/
route.ts` + `app/(dashboard)/admin/system/outbox/page.tsx` +
  `components/admin/system/retry-failed-events-button.tsx` (B2-16, real `OutboxEvent` groupBy
  counts + FAILED-row retry); `app/(dashboard)/admin/system/config-history/page.tsx` (B2-17,
  real `SystemConfigHistory` rows or honest empty state); `__tests__/pages/admin/
system-operations.test.tsx` (11 tests) + `__tests__/api/admin-system-operations.test.ts` (10
  tests, beyond the order's own literal Step 5 scope — closes a real coverage gap on the 3 new
  routes).
- **Modified:** `app/(dashboard)/admin/layout.tsx` (4 new `adminNavItems` entries; the hardcoded,
  always-green "All systems operational" sidebar claim replaced with a plain link to the real
  terminals check).
- **CONFIRM found B2-15's own job list and "last run" framing materially wrong** — the monolith's
  8 `app/api/cron/*` routes stopped being scheduled at Session 4A-3 (`vercel.json`'s `crons` is
  empty); neither service persists cron run-history anywhere. Re-scoped live with Davin: honest
  "Managed by Money-Service Scheduler" status, no fabricated timestamps, Run Now forwards to the
  real `CronTriggerController` via the shared `CRON_SECRET`.
- **Regression:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same
  4 pre-existing warnings, 0 introduced; `test:ci` 148/148 suites, 2312/2312 tests (was 146/146,
  2291/2291 — +2/+21, exactly this session's own new files).
- **Not done:** live click-through against a real deployed environment (same standing gap as
  every Phase 6 session since 6-1b, Waiting-on #117); real flask-api live status not
  independently re-verified (last known OFFLINE, Waiting-on #101); whether money-service's own
  `CRON_SECRET` value matches the monolith's is assumed, not verified (Waiting-on #128).

</details>

<details>
<summary><strong>2026-08-11 — Session 6-12 (A11y + Responsive Audit / Phase 6 Exit Review, UI-BUILD)</strong></summary>

Resolves `DECISION-LOG.md` F11 (all 59 gap-matrix rows triaged). Closes Phase 6. No new
modules — a pure audit-and-fix pass across existing Phase 6 surfaces, zero flags touched, no
cutover-table row.

- **Deleted:** `app/test-api/page.tsx` (confirmed zero references anywhere in `app/`,
  `components/`, `__tests__/` before removal).
- **New:** `__tests__/pages/phase-6-exit.test.tsx` (8 tests — first-ever direct coverage for
  `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`; a route-integrity check for the
  `test-api` deletion; `ToastContainer`'s a11y fix).
- **Modified — accessibility (18 fixes, 13 files):** `components/auth/login-form.tsx` (removed
  `tabIndex={-1}` + added `aria-label` on the password toggle — was unreachable by keyboard, not
  just unlabeled), `components/auth/register-form.tsx` (2 toggles), `app/(auth)/reset-password/
page.tsx`, `app/(auth)/forgot-password/page.tsx` (2 toggles), `app/(dashboard)/settings/account/
account-settings-client.tsx` (3 toggles), `app/(dashboard)/settings/security/page.tsx` (2FA
  secret show/hide + copy button), `app/(dashboard)/settings/profile/page.tsx` (photo-upload
  overlay button — was invisible on keyboard focus), `components/notifications/notification-
list.tsx` (delete button), `components/ui/toast-container.tsx` (dismiss button, appears on every
  page), `app/(dashboard)/admin/errors/page.tsx` + `app/(dashboard)/admin/users/page.tsx` +
  `app/(dashboard)/alerts/alerts-client.tsx` (3 filter/search inputs relying on placeholder text
  alone). Regression coverage added directly into the existing `__tests__/components/auth/
{login-form,register-form}.test.tsx` harnesses rather than duplicated in the new file.
- **Modified — responsive (8 fixes, 6 files):** `app/(dashboard)/admin/affiliates/page.tsx` +
  `components/billing/invoice-list.tsx` (`overflow-hidden` → `overflow-x-auto` on 2 tables — was
  clipping content instead of scrolling); `app/(dashboard)/admin/affiliates/page.tsx` (2 more
  grids) + `app/(dashboard)/admin/affiliates/reports/{code-inventory,commission-owings,
profit-loss,sales-performance}/page.tsx` (6 bare `grid-cols-3/4/5` stat-card/filter grids given a
  `grid-cols-1/2` mobile default with `sm:`/`lg:` breakpoints restoring the original count).
- **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again, this time with a
  substantive false claim:** the order arrived modified-but-uncommitted asserting F11 already
  resolved ("all 90 rows triaged") while the live gap matrix still showed every row unfilled
  (footer: "F11 stays OPEN"), and the "90" figure itself was wrong (the real, deduplicated matrix
  has 59 rows — 90 is the raw pre-dedup source register's own count). Reported both findings;
  Davin confirmed live the rewrite was his own authentic authorization, and the real triage then
  landed for real (verified against the file itself, not the claim alone) before CONFIRM.
- **Regression:** `tsc --noEmit` clean throughout; `eslint app components lib hooks
--max-warnings 0` — same 4 pre-existing warnings (unrelated routing-method lint), 0 introduced;
  `test:ci` 149/149 suites, 2322/2322 tests (was 148/148, 2312/2312 — +1/+10, exactly this
  session's own new coverage).
- **Not done:** live click-through against a real deployed environment (same standing gap as
  every Phase 6 session since 6-1b, Waiting-on #117) — this is Phase 6's own last session and
  the gap is now inherited into Phase 7, not closed.

</details>

<details>
<summary>Session 7-1 (API Client Re-verify + Generate) — 12 new files, 5 modified, Phase 7 opens</summary>

- **New — `operation-service`:** `scripts/generate-openapi-spec.ts` (boots the real `AppModule`,
  emits an OpenAPI v3 doc via `@nestjs/swagger`'s `SwaggerModule.createDocument()` — 47 unique
  paths / 62 operations, matching the live controller count exactly).
- **New — `money-service`:** `scripts/generate-openapi-spec.ts` (same pattern, replicates
  `main.ts`'s `setGlobalPrefix('v1', {exclude:['health','health-auth']})` before generating — 43
  unique paths / 45 operations).
- **New — `docs/open-api-documents/generated/`:** `operation-service-openapi.json`,
  `money-service-openapi.json` (committed generator output, regenerate via
  `npm run generate:api-client` at the repo root — never hand-edit).
- **New — `lib/api/generated/`:** `operation-api/{schema.ts,client.ts}`,
  `money-api/{schema.ts,client.ts}`, `index.ts`. `schema.ts` files are raw `openapi-typescript`
  output (`paths` types, do not hand-edit). `client.ts` files export
  `createOperationApi(token)`/`createMoneyApi(token)` (wrap `openapi-fetch`, typed against
  `schema.ts`) and `unwrapOperationApi()`/`unwrapMoneyApi()` (convert openapi-fetch's
  `{data,error,response}` into the established `OperationServiceError`/`MoneyServiceError`
  throw-on-non-2xx convention). Both server-only.
- **New — `__tests__/lib/api/generated-clients.test.ts`:** 12 contract-style tests (prefix
  correctness, path-param substitution, Bearer header attach/omit, `unwrap*` success + error
  mapping including a 500 case).
- **Modified:** `lib/api/index.ts` (re-exports `operationApi`/`moneyApi` + both token helpers;
  `stackA`/`stackB` and their type interfaces kept as-is, now exported, marked `@deprecated`; the
  whole file's header now states it is server-only per `LESSONS-LEARNED.md` L6);
  `docs/open-api-documents/part-05-authentication-openapi.yaml` (removed deleted
  `/api/auth/register`); `docs/open-api-documents/part-19.5-wise-disbursement-openapi.yaml`
  (`/api/wise/recipients/{id}` replaced with the real `POST .../revalidate` operation; both
  `/api/admin/disbursement/batches*` paths lost the `admin` segment and gained a real
  `BatchIdPath` parameter); `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml`
  (category-error notice added; `/dashboard/watchlist` removed — V8 dropped watchlists
  entirely); `package.json` (root — added `openapi-typescript`/`openapi-fetch`, new
  `generate:api-client` script); `operation-service/package.json` +
  `money-service/package.json` (added `@nestjs/swagger`, new `openapi:generate` script).
- **Not done:** consumer rewiring onto `operationApi`/`moneyApi` (explicitly Session 7-2's own
  scope, per this order's own Rules — no existing route handler or UI page call site was touched
  this session); request/response body-schema fidelity in the emitted specs (both services
  validate via Zod, not class-validator, so `@nestjs/swagger` has no decorator metadata to read
  for bodies — documented as a known limitation with a follow-up plan, not silently claimed
  complete; see `CLAUDE.md` Waiting-on #136).

</details>

<details>
<summary>Session 9-1 (Root Shell & Design System, UI-BUILD) — 15 new files, 8 modified, all FRONTEND</summary>

Every file below is **FRONTEND** (stays in the Next.js app) — Phase 9 is a frontend-only swap,
so unlike Phase 7's split above there's no CORE/BUSINESS FUNCTION categorization question here.

- **New — i18n subsystem** (ported from `seed-code/` verbatim, self-contained, no other
  main-repo dependencies): `lib/country-config.ts`, `lib/i18n/locale-resolver.ts`,
  `lib/i18n/get-dictionary.ts`, `lib/i18n/server-locale.ts`, `lib/i18n/dictionaries/*.json` (12
  locale files), `lib/context/locale-context.tsx`.
- **New — shared chrome:** `components/theme-sync.tsx`, `components/providers/client-providers.tsx`
  (composes `LocaleProvider`+`AppearanceProvider` only — support-chat widget deliberately
  deferred to Phase 14, see the order's own Deviation 3), `components/chat-sidebar.tsx`,
  `components/layout/app-header.tsx`, `components/marketing/marketing-navbar.tsx`,
  `components/marketing/marketing-footer.tsx` — all rewritten from seed-code's hardcoded
  `slate-N`/`dark:bg-[hex]` classes onto this repo's own semantic design tokens (the Batch-0
  "Light Clean Mode" fix for the two named files, extended to the two marketing ones too).
- **New — brand assets:** `public/apple-icon.png`, `public/icon-light-32x32.png`,
  `public/icon-dark-32x32.png`, `public/icon.svg` (copied from `seed-code/`, referenced by the
  new `app/layout.tsx` metadata).
- **Modified:** `app/layout.tsx` (ported root-shell structure, DavinTrade metadata, now `async`
  and calls `cookies()`/`headers()` — the whole app is dynamically rendered as of this session,
  see the order's Deviation 6); `app/providers.tsx` (composes `ThemeProvider`→`SessionProvider`
  [preserved]→`ThemeSync`→`ClientProviders`); `app/not-found.tsx`, `app/global-error.tsx` (ported
  from seed-code, already Batch-0 parity-fixed); `app/error.tsx` (rebranded, no codebase-2
  counterpart existed); `app/globals.css` (added `--sidebar*` tokens + `.no-scrollbar`/
  `.animate-marquee` utilities; did NOT touch `--accent`/`--accent-foreground` — already correct
  by design, see Deviation 9); `tailwind.config.ts` (exposed `sidebar.*` colors);
  `middleware.ts` (merged codebase-2's locale-prefix rewrite into the existing real auth gate);
  `next.config.js` (added `https://ipapi.co` to CSP `connect-src`); `public/manifest.json`
  (rebranded name/short_name/description/theme_color, per F66).
- **Not done:** `components/header.tsx` deletion — confirmed the dead file only ever existed in
  `seed-code/` (read-only, do-not-touch), never in the main repo; satisfied by omission, nothing
  to delete here. `components/layout/header.tsx` (a different, still-live file used by the
  current `app/(dashboard)/layout.tsx`) and `chat-panel.tsx`/`market-comments-panel.tsx`/
  `settings/layout.tsx`'s own Light Clean Mode fix are explicitly Session 9-4's/9-5's, not
  ported or touched here. Full detail: the order's own Deviations section
  (`9-1-root-shell-design-system.migration-order.md`).

</details>

<details>
<summary>Session 9-2 (`(marketing)` 12 + `(public)` 2, UI-BUILD) — 7 new files, 15 modified, 1 deleted, all FRONTEND</summary>

All 14 route-map rows (1-2, 3-4, 52-54, 63-64, 66, 69-70, 84-85, 91) shipped. Route-manifest diff
confirmed: zero page files created or dropped beyond this session's own 14 rows.

- **New — landing page composition** (`app/(marketing)/page.tsx`'s prior body,
  `landing-content.tsx`, deleted — see below): `components/landing/ticker-tape.tsx`,
  `components/landing/landing-hero.tsx`, `components/landing/landing-features.tsx`,
  `components/landing/landing-pricing.tsx`. Ported from seed-code's separate `LandingNavbar`/
  `LandingFooter`-wrapped composition, stripped of that inner chrome (the shared
  `(marketing)/layout.tsx` already renders `MarketingNavbar`/`MarketingFooter` once — Decision 3)
  and of seed-code's `useSupportChat()`-wired "Support Centre" input sandbox (`components/
chat-widget/*` deferred to Phase 14 at Session 9-1's own close). `landing-pricing.tsx` grafts
  the main repo's real `useAffiliateConfig()`/`SystemConfig`-backed discount banner + dynamic PRO
  price onto seed-code's hardcoded static figure, per Davin's live call at CONFIRM.
- **New — status refresh:** `components/marketing/status-refresh-button.tsx` — a client island
  that calls `router.refresh()` on the force-dynamic `/status` page, giving the "Refresh Status"
  button a real telemetry reload instead of seed-code's fake timed spinner.
- **New — brand asset:** `public/davintrade-landing-page_home.png` (10.3 MB) — referenced by
  seed-code's `landing-hero.tsx` but never copied into `public/` by any prior session; copied
  as-is (no re-compression, out of this session's scope).
- **Modified — 9 static pages:** `app/(marketing)/{about,blog,careers,changelog,disclaimer,
docs,help,privacy,terms}/page.tsx` — content ported from seed-code, DavinTrade branding, inner
  `MarketingNavbar`/`MarketingFooter` JSX stripped per Decision 3. `/help` additionally drops
  seed-code's `useSupportChat()` "Live AI Support" card (same Phase-14 deferral as the landing
  hero), replaced with a second real `mailto:` channel.
- **Modified — real-data pages:** `app/(marketing)/status/page.tsx` (seed-code's visual layout,
  bound to the real 4-component `getSystemStatus()` — API/Database/Realtime/Payment Gateways —
  not seed-code's 6 fabricated components with hardcoded latency/uptime figures);
  `app/(marketing)/pricing/page.tsx` + `components/pricing/tier-comparison.tsx` (seed-code's
  card layout + billing toggle, bound to `lib/tier-config.ts`'s `PRO_MONTHLY_PRICE` via
  `useLocale().formatCurrency` per Davin's explicit instruction; feature list replaced with the
  real V8 entitlements — seed-code's own list advertised Phase 12/13 AI-chat/quad-RAG features
  not built in this repo; annual-savings badge now computed, not a wrong hardcoded "20%").
- **Modified — layout boundary:** `app/(marketing)/layout.tsx` — now renders `MarketingNavbar`/
  `MarketingFooter` (built Session 9-1) instead of inline "Trading Alerts" chrome. This is the
  one `layout.tsx` this session moves, per the order's own header.
- **Modified — account deletion (restyled, logic preserved):** `app/(public)/settings/account/
delete/{cancel,confirm}/page.tsx` — DavinTrade visuals only; the existing human-in-the-loop
  confirm gate and dual-mode (token-or-session) cancel logic are unchanged. Seed-code's own
  confirm page auto-executes the deletion in a `useEffect` on mount with no confirmation step —
  explicitly NOT ported (Decision 5).
- **Deleted:** `app/(marketing)/landing-content.tsx` (512 lines) — superseded by the
  `components/landing/*` composition above; its own `useAffiliateConfig()`/`useSearchParams()`
  wiring was carried forward into `landing-pricing.tsx`, not dropped.
- **Docs (not stack-analysis targets, listed for completeness):** `frontend-swap-route-map.md`
  (dated addendum correcting rows 3-4's stale target path), this session's own migration order
  (CONFIRMED, Deviations filled).

</details>

<details>
<summary>Session 9-3 (`(auth)` 7 + `welcome`, UI-BUILD) — 1 new file, 16 modified, all FRONTEND</summary>

All 8 route-map rows (65, 67, 71, 72, 88, 89, 90, 95) shipped. Route-manifest diff confirmed: only
`app/(auth)/welcome/` is a new route; zero pages created or dropped beyond this session's own 8 rows.

- **New — onboarding page:** `app/(auth)/welcome/page.tsx` — the 3-step post-registration flow
  (feature intro, real `useAppearance()` accent picker with a persisted `saveSettings()` call,
  workspace launcher). Feature-intro copy replaced seed-code's fabricated Phase-14 chat-widget
  claim with two capabilities live today (price alerts, drawing tools/line alerts). Session-gated
  client-side via `useSession()` (soft redirect to `/login`, not a server-side hard gate), per
  Decision 1.
- **Modified — layout boundary:** `app/(auth)/layout.tsx` — DavinTrade logo header + ambient amber
  backdrop, built from scratch (seed-code has no `(auth)/layout.tsx` of its own). This is the one
  `layout.tsx` this session moves, per the order's own header.
- **Modified — real form components:** `components/auth/{login-form,register-form,
social-auth-buttons}.tsx` — DavinTrade visuals + `useLocale()` translations layered onto each
  component's existing real logic (NextAuth `signIn()`, auth-bridge `token-login`/`token-register`
  fetch branching, referral-code verification, quick-fill test credentials, OAuth provider
  buttons). `social-auth-buttons.tsx` was already real (not mocked) in the main repo prior to this
  session — confirmed by reading both trees directly, not inherited from the roadmap's citation.
- **Modified — auth pages, real logic preserved or restored where seed-code was a mock:**
  `app/(auth)/{login,register,forgot-password,reset-password,verify-2fa,verify-email,
verify-email/pending}/page.tsx`. `verify-2fa` and `forgot-password` restyle the monolith's own
  real implementations rather than porting seed-code's mock prototypes (seed-code's `verify-2fa`
  never called `POST /api/user/2fa/verify`; its `forgot-password` never called any endpoint).
  `reset-password` gained proper `htmlFor`/`id` label association (a real a11y gap in seed-code's
  own markup, fixed). `verify-email`'s success state routes to `/login`, not seed-code's
  `/welcome` — verification runs pre-session, and `/welcome` is `SESSION REQUIRED`.
- **Modified — test infrastructure (regression fix, not new coverage):**
  `__tests__/{app/auth-verify-2fa,app/auth-bridge-endpoint-swaps,components/auth/login-form,
components/auth/register-form}.test.tsx` — wrapped renders in a real `LocaleProvider` (with a
  `localStorage`-seeded `defaultPreferences` to skip its geo-IP fetch) and added the
  `usePathname: () => '/'` stub it needs, after adding `useLocale()` to the components/pages above
  broke all 4 suites (`LESSONS-LEARNED.md` L40's exact failure class, 3rd occurrence). Two
  assertions updated to match this session's own real copy/a11y changes, not reverted.
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, 11 Deviations filled), `LESSONS-LEARNED.md` (L40
  recurrence note).

</details>

<details>
<summary>Session 9-4 (`(dashboard)` core 7 + `/terminal` + `/free`, UI-BUILD) — 12 new files, 12 modified, 6 deleted, all FRONTEND</summary>

All 8 active route-map rows (49, 50, 51, 55/56 retired, 57, 58, 59 retired, 62, 68) shipped, plus a
real, live-verified scope correction: the 5 core pages and `/terminal`/`/free` all moved to
top-level routes (`app/dashboard/`, `app/alerts/`, `app/notifications/`, `app/terminal/`,
`app/free/`) rather than staying under `app/(dashboard)/`. Route-manifest diff confirmed clean via
`git diff --stat` against the session's own start commit: `app/(dashboard)/settings/*` and
`app/(dashboard)/admin/*` show zero diff, `app/(dashboard)/layout.tsx` restored byte-identical to
its pre-session form.

- **New — top-level route + minimal layout pairs:** `app/{dashboard,alerts,notifications,
terminal,free}/layout.tsx` — each a thin auth-gate + `AppearanceProvider` wrapper (no shared
  chrome), matching the pattern the order's own Step 1 originally described for
  `app/(dashboard)/layout.tsx` before live testing found it broke `/settings/*` and `/admin/*`
  (Deviation 13). `app/{terminal,free}/{page.tsx,*-workspace.tsx}` — the 4-panel PRO / FREE
  quantitative workspaces, Panel 1 bound to the real, pre-existing
  `components/charts/trading-chart.tsx` (live Socket.IO OHLCV, drawing toolbar, PRO multi-timeframe
  overlay); Panels 2/3 genuine empty states, zero mock data.
- **New — Stack D/E empty-state + upgrade components:** `components/chat-panel.tsx`,
  `components/market-comments-panel.tsx` (ported from seed-code's mock prototypes as real empty
  states, Decision 2), `components/ui/pro-upgrade-modal.tsx` (ported with its fake in-place
  upgrade-success behavior replaced by a real `/pricing` navigation), `components/ui/resizable.tsx`
  (generic shadcn wrapper, ported verbatim).
- **Modified — 5 core pages relocated + restyled:** `app/{dashboard,notifications}/page.tsx`,
  `app/alerts/{page.tsx,new/page.tsx,new/create-alert-client.tsx,[id]/edit/page.tsx,
[id]/edit/edit-alert-client.tsx,alerts-client.tsx}` — each mounts its own `AppHeader` (matching
  every seed-code source file's real pattern, not a shared-layout mount), all real logic preserved
  byte-for-byte (Prisma-fetched dashboard data, `AlertsClient`'s optimistic toggle/delete/undo,
  `NotificationList`'s pagination/realtime-socket, `PRO`-exclusive `AlertsProUpgrade` gating).
  `CreateAlertClient` consolidated onto the shared `AlertForm` (previously duplicated its own form
  with no tier-endpoint validation).
- **Modified — shared identity/logout fix:** `components/layout/app-header.tsx`,
  `components/chat-sidebar.tsx` — both built Session 9-1 but never mounted anywhere until this
  session; found and fixed two real pre-mount defects (`LESSONS-LEARNED.md` L15) — hardcoded fake
  "Trader User" identity regardless of real session, and a "Log out" that never called `signOut()`.
- **Deleted — orphaned after `/charts` retirement:** `app/(dashboard)/charts/
[symbol]/[timeframe]/trading-chart-client.tsx`, `components/charts/chart-controls.tsx`,
  `components/ui/upgrade-button.tsx` (zero importers left outside the 2 retired page files, which
  now permanently redirect to `/terminal`).
- **Modified — stale nav links:** `components/layout/{sidebar,mobile-nav}.tsx` — `/charts` →
  `/terminal` (2-line fix; both components are now themselves fully orphaned dead code as a direct
  consequence of restoring `app/(dashboard)/layout.tsx`, flagged for Session 9-10's own dead-code
  exit criterion, not deleted this session).
- **Modified — test infrastructure (regression fix, not new coverage):**
  `__tests__/pages/{notifications/notifications-page,alerts/edit}.test.tsx` — `LESSONS-LEARNED.md`
  L40's exact failure class, 4th occurrence, after mounting `AppHeader` broke 9 tests; also updated
  both files' import paths for the route relocation.
- **Known unresolved defect, not a stack-analysis artifact but material to this entry:**
  `DECISION-LOG.md` F77 — `/alerts` and `/alerts/new` duplicate client-side on a genuine reload
  (verified in a real production build), with a confirmed real functional consequence (a
  submitted target price was corrupted). Closed this session per Davin's live direction; owner is
  the next session touching `/alerts` or a dedicated repair session.
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, 16 Deviations filled), `DECISION-LOG.md` (F77 registered),
  `LESSONS-LEARNED.md` (L40 recurrence note, 4th occurrence).

</details>

<details>
<summary>Session 9-5 (`settings/` 11, UI-BUILD) — 13 new files, 0 modified outside test imports, 13 deleted, all FRONTEND</summary>

All 11 route-map rows (73–83) shipped under one new top-level layout boundary,
`app/settings/layout.tsx`. Route-manifest diff confirmed clean via `git diff --stat` against the
session's own start commit: `app/(dashboard)/layout.tsx` and `app/(dashboard)/admin/*` show zero
diff; exactly the 11 rows' own files (mostly detected as git renames) plus the new layout/nav pair
and 5 test-import fixes.

- **New — layout + shared nav:** `app/settings/layout.tsx` (auth gate + `AppearanceProvider` +
  `AppHeader` + shared sub-nav, mounted once — unlike 9-4's per-page `AppHeader` pattern, these 11
  sibling pages genuinely share one shell), `app/settings/_components/settings-nav.tsx` (desktop
  sticky sidebar / mobile horizontal tabs, both always in the DOM per standard Tailwind responsive
  pattern — not a duplicate-render bug), `app/settings/loading.tsx` (retheme of the legacy
  skeleton).
- **New — 11 pages, retheme-only ports preserving all real data logic:** `app/settings/{page,
profile,appearance,help,language,privacy,terms,security/page,security/activity/page}.tsx`,
  `app/settings/account/{page,account-settings-client}.tsx`, `app/settings/billing/page.tsx`. Two
  pages needed more than a retheme: `appearance` (Protected #5) ported near-verbatim from the
  already-DavinTrade-quality legacy version; `help` (Protected #6) ported from seed-code's visual
  design with its chat-widget CTA and fake ticket-submit swapped for real `mailto:` actions
  (Deviation 4 — no chat widget or support-ticket API exists in this repo).
- **Deleted — legacy `app/(dashboard)/settings/*`, all 13 files:** superseded by the top-level
  move; `app/(dashboard)/layout.tsx` (still serving `/admin/*` until 9-8) untouched.
- **Modified — test infrastructure (import-path fix only, zero assertion changes):**
  `__tests__/pages/settings/{account-settings-page,billing,overview,security-activity,
security-login-history-pagination}.test.tsx` — `@/app/(dashboard)/settings/*` → `@/app/settings/*`.
- **Known unchanged dead code, confirmed not touched:** `components/billing/subscription-card.tsx`
  — still unmounted, still carrying F64's original bug; the real live billing page never used it
  (Deviation 1).
- **Known unresolved defects, not stack-analysis artifacts but material to this entry:**
  `DECISION-LOG.md` F21 (backend email/cron stubs, UI now wired) and F64 (billing cancel UI wired,
  reactivation deferred to 9-6), both still OPEN; F77 addendum (same double-render class confirmed
  on `/settings/appearance` and `/login`, likely root-caused to a Suspense-streaming reveal-div
  artifact, confirmed benign).
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, 7 Deviations filled), `DECISION-LOG.md` (F21/F64 updated,
  F77 addendum).

</details>

<details>
<summary>Session 9-6 (Payments flow, cross-boundary, UI-BUILD + PORT) — 0 new, 3 modified, 0 deleted, all FRONTEND</summary>

Route-map rows 60/61/87 restyled to DavinTrade semantic tokens; rows 69/75 re-verified as
consumers, not modified. Route-manifest diff confirmed clean via `git diff --stat` against the
session's own start commit: exactly these 3 files, zero route additions/removals.

- **Modified — retheme-only, zero logic changes:** `app/checkout/page.tsx` (Row 61 — hardcoded
  blue Tailwind literals → `bg-primary`/`text-foreground`/`border-border`/`bg-destructive`
  semantic tokens; all Stripe/dLocal handlers, country detection, and discount-code validation
  byte-for-byte preserved), `app/checkout/return/page.tsx` (Row 60 — the 5-state
  `STATUS_PRESENTATION` map gained real dark-mode variants it never had, plus the correction to
  the actual 5-value `PaymentStatus` vocabulary the order's own draft had wrong), `app/upgrade/
success/page.tsx` (Row 87 — same token swap; the order's assumed "Launch PRO Terminal" button
  does not exist in the live code and was not invented, see this session's own Deviations).
- **New — local dev tooling only, not app code:** `.claude/launch.json` gained a `moneyservice`
  entry; `money-service/.env` created (gitignored, not a stack-analysis artifact) so the real
  Stripe write-path cutover could be exercised locally instead of the frozen monolith fallback.
- **Known unresolved defects, not stack-analysis artifacts but material to this entry:**
  `DECISION-LOG.md` F76 (dLocal method-ID bug, still OPEN, `.env.local` flag confirmed/kept
  `false`) and the newly-registered F78 (`AppHeader` tier-badge staleness after a server-side-only
  tier change, e.g. this session's own webhook-driven upgrade).
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, Deviations 0/1 filled), `DECISION-LOG.md` (F64 → RESOLVED,
  F78 registered, size-gate archival 169KB → 20KB), `history/decisions-archive.md` (F21/F64/F77
  full narrative appended).

</details>

<details>
<summary>Session 9-7a (Affiliate public onboarding, UI-BUILD) — 1 new, 3 modified, 1 deleted, all FRONTEND</summary>

Route-map rows 43/44/48 restyled to DavinTrade tokens and bound to real data; row 47 retired.
Route-manifest diff confirmed clean via `git diff --stat` against the session's own start commit:
exactly these 3 pages + 1 new component + 1 deletion, zero unrelated route changes.

- **New:** `components/ui/slider.tsx` (shadcn wrapper over `@radix-ui/react-slider`, already a
  dependency but never wrapped — needed by Row 48's earnings calculator).
- **Modified:** `app/affiliate/page.tsx` (Row 48 — DavinTrade hero/calculator/benefits; the
  calculator's commission rate and plan price are read live from `useAffiliateConfig()` rather
  than Codebase 2's own hardcoded 30%/$49, matching the pre-existing page's real-data binding),
  `app/affiliate/join/page.tsx` (Row 43 — the legacy 1-line `redirect()` replaced with Codebase
  2's real onboarding content, per Decision 3), `app/affiliate/register/page.tsx` (Row 44 — real
  `POST /api/affiliate/auth/register` wiring, fields mapped 1:1 to `affiliateRegistrationSchema`,
  unauthenticated visitors redirected to `/login?callbackUrl=/affiliate/register`).
- **Deleted:** `app/affiliate/verify/layout.tsx` (Row 47 — the directory held only a passthrough
  layout, no `page.tsx`; already non-functional, zero incoming links confirmed via repo-wide grep
  before removal).
- **Test infra (not stack-analysis targets, listed for completeness):** `jest.setup.js` gained a
  `ResizeObserver` stub (jsdom doesn't implement it; Radix `Slider` calls it on mount) —
  `__tests__/pages/marketing/public-pages.test.tsx` updated per `LESSONS-LEARNED.md` L3 (2 stale
  assertions from the intentional rebrand/redirect-replacement, not a regression).
- **Known unresolved defect, not a stack-analysis artifact but material to this entry:**
  `DECISION-LOG.md` F79 (registered this session) — `affiliate/dashboard/layout.tsx` reads
  `session.user.isAffiliate` from the stale JWT and redirect-traps a freshly-registered affiliate
  back to `/affiliate/register`; owned by Session 9-7b, which owns that file.
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, Deviations filled), `DECISION-LOG.md` (F79 registered),
  `history/decisions-archive.md` (F79 full narrative appended).

</details>

<details>
<summary>Session 9-7b (Affiliate authenticated partner portal, UI-BUILD) — 1 new, 16 modified, all FRONTEND</summary>

Route-map rows 35–42/45/46 restyled to DavinTrade tokens and bound to real data; row 39 confirmed
as a no-op (already a transparent redirect). Route-manifest diff confirmed clean via
`git diff --stat` against the session's own start commit: exactly these pages + 1 new component +
2 test fixes, zero unrelated route changes.

- **New:** `components/affiliate/affiliate-nav.tsx` (shared sticky nav/header mounted by both
  `app/affiliate/dashboard/layout.tsx` and `app/affiliate/settings/layout.tsx`, DavinTrade tokens,
  amber active-route highlighting).
- **Modified — layouts:** `app/affiliate/dashboard/layout.tsx` and `app/affiliate/settings/
layout.tsx` (F79 fix — both now call `requireAffiliate()`'s DB fallback instead of trusting
  `session.user.isAffiliate` from the JWT; both mount `<AffiliateNav />`, replacing duplicated
  inline nav markup).
- **Modified — pages:** `app/affiliate/dashboard/{page,codes,code-inventory,commissions,payouts,
statements,profile,resources}/page.tsx` and `app/affiliate/settings/payout/page.tsx` — DavinTrade
  semantic tokens (`bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`, amber
  accents) applied to page chrome; all existing API/Prisma bindings, pagination, CSV export, and
  Wise recipient logic preserved unchanged. `payouts/page.tsx` stays a Server Component with its
  direct, correctly-scoped `prisma.disbursementTransaction` read; `statements/page.tsx` keeps its
  client-side `commission-report` aggregation (both pre-existing since Session 6-7, confirmed live
  via CONFIRM rather than rebuilt, per Decision 3).
- **Modified — shared components:** `components/affiliate/{stats-card,code-table,commission-table,
wise-recipient-form}.tsx` — same token restyle, zero logic change.
- **Confirmed no-op:** `app/affiliate/dashboard/profile/payment/page.tsx` (Row 39) — already a
  transparent redirect to `/affiliate/settings/payout` (Session 6-7); left untouched.
- **Test infra (not stack-analysis targets, listed for completeness):** `__tests__/components/
affiliate/{commission-table,code-table}.test.tsx` — 3 assertions checking legacy hardcoded color
  names (yellow/blue/gray) updated to match the intentional amber/muted token rebrand, per
  `LESSONS-LEARNED.md` L3/L18; one pre-existing unused-param lint error fixed alongside.
- **Known unresolved defects, not stack-analysis artifacts but material to this entry:**
  `DECISION-LOG.md` F79 (RESOLVED this session) and **F80** (registered this session, OPEN) — a
  pre-existing `lib/auth/auth-options.ts` bug where the credentials `authorize()` callback's
  `FIXED_TEST_ACCOUNTS` upsert silently resets `free-test@trading-alerts.test`'s `isAffiliate` to
  its hardcoded fixture value on every login, discovered live while verifying F79; also unmasked a
  related, separate gap where money-service's own `AffiliateGuard` (Row 46's Wise endpoints)
  trusts the JWT's `isAffiliate` claim directly with no DB-fallback equivalent to F79's fix.
  Neither is a 9-7b file; both are out of scope to fix here (auth-semantics, `EXECUTOR-PROTOCOL.md`
  §7).
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, Deviations filled), `DECISION-LOG.md` (F79 → RESOLVED, F80
  registered), `history/decisions-archive.md` (F79/F80 full narrative appended),
  `LESSONS-LEARNED.md` (L26 merged into L23, L44 added, L43 addendum).

</details>

<details>
<summary>Session 9-8a (Admin core cluster, UI-BUILD) — 2 new, 12 modified, all FRONTEND</summary>

Route-map rows 12/23/28/29/30/31/32/33/34/94 restyled to DavinTrade tokens and bound to real data.
Route-manifest diff confirmed clean via `git diff --stat` against the session's own start commit
(`f828967d`): exactly these 10 rows' files + 1 new page + 1 new supporting component + `lib/auth/
session.ts`, zero unrelated route changes.

- **New:** `app/(dashboard)/admin/notifications/broadcast/page.tsx` (Row 94 — no live counterpart
  existed; ported from codebase 2's composer body with DavinTrade tokens, added to `adminNavItems`,
  submit action shows an honest "preview only, nothing was sent" note rather than codebase 2's own
  fake "successfully delivered" toast), `components/ui/textarea.tsx` (shadcn primitive ported from
  the same seed, not previously in the main repo — needed by the composer's body field).
- **Modified — layout & auth:** `app/(dashboard)/admin/layout.tsx` (DavinTrade sidebar/top-bar
  restyle, Broadcast nav entry added, admin-role check given the same DB-fallback
  `requireAffiliate()` already has for JWT staleness), `lib/auth/session.ts` (`requireAdmin()`
  given the identical DB-fallback — found missing at this session's CONFIRM; without it, a
  freshly-promoted admin would pass the restyled layout but 403 on this session's own job-trigger/
  outbox-retry actions, all 18 admin API routes call `requireAdmin()`).
- **Modified — pages:** `app/(dashboard)/admin/{page,users/page,users/[id]/page,api-usage/page,
errors/page,system/{config-history,jobs,outbox,terminals}/page}.tsx` — DavinTrade semantic tokens
  (`bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`, `bg-primary`/`bg-muted` for
  PRO/FREE tier badges matching `app/settings/page.tsx`'s established convention) applied to page
  chrome; all existing API/Prisma bindings, pagination, filters, and CSV export preserved
  unchanged. All internal `<a href>` navigation converted to `next/link`'s `<Link>`, closing the
  pre-existing `no-html-link-for-pages` warning in `admin/page.tsx` (eslint 4 warnings → 3).
- **Modified — shared component:** `components/admin/system/retry-failed-events-button.tsx` — same
  token restyle, zero logic change.
- **Accepted pre-existing debt, disclosed in-UI (not silently carried forward):** rows 12/23 (`GET
/api/admin/api-usage`, `GET /api/admin/error-logs`) are self-documented mock-data stubs dating to
  the original Dec 2025 release, found at this session's CONFIRM, not flagged by the 9-0 route map.
  Davin accepted keeping the existing bindings rather than scoping a new `ApiUsageLog`/`ErrorLog`
  build into this restyle session; both pages now show an honest banner (driven by each route's own
  `X-Data-Source: mock` response header) rather than presenting generated sample data as live.
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration order
  (CONFIRMED → executed, Deviations filled), `DECISION-LOG.md` (F79's resolved entry archived to
  `history/decisions-archive.md` per the protocol size gate).

</details>

<details>
<summary>Session 9-8b (Admin affiliates cluster, UI-BUILD) — 1 new, 15 modified, all FRONTEND</summary>

Route-map rows 5/6/7/8/9/10/11/24/25/27/96 restyled to DavinTrade tokens and bound to real data.
Route-manifest diff confirmed clean via `git diff --stat` against the session's own start commit
(`086a69c6`): exactly these 10 rows' files + 1 new page + `admin/layout.tsx` (nav item) + 2 API
route files + 2 shared components, zero unrelated route changes.

- **New:** `app/(dashboard)/admin/resources/page.tsx` (Row 96 — no live counterpart existed;
  ported from codebase 2's page body with DavinTrade tokens, bound to the already-shipped
  `GET/POST /api/admin/resources` + `DELETE /api/admin/resources/[id]`; seed's own `AppHeader`/
  `AdminNav` dropped since the admin layout already provides that chrome; seed's fabricated "CDN
  Delivery Status: Edge Optimized" stat card not ported — 3 real stat cards instead of 4).
- **Modified — auth:** `app/api/admin/fraud-alerts/route.ts` + `.../[id]/route.ts` — raw
  `session.user.role !== 'ADMIN'` JWT-only check replaced with `requireAdmin()`'s DB-fallback
  (untouched since Session 2-4, predating 9-8a's fix to the shared helper); PATCH handler's
  `updatedAlertUser` select also given the `tier` field GET already had (found live: Tier field
  showed "Unknown" after any status transition).
- **Modified — pages:** `app/(dashboard)/admin/affiliates/{page,[id]/page}.tsx`,
  `.../affiliates/reports/{code-flows,code-inventory,commission-owings,profit-loss,sales-performance}/page.tsx`,
  `.../fraud-alerts/{page,[id]/page}.tsx`, `.../settings/affiliate/page.tsx` — DavinTrade semantic
  tokens (`bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`, semantic
  `bg-{color}-500/10 text-{color}-500` status badges) applied to page chrome; all existing API
  bindings, pagination, and filters preserved unchanged. Affiliate detail's Suspend/Reactivate/
  Distribute-Codes and fraud-alert detail's Block User moved from native `confirm()`/`prompt()` to
  `<AlertDialog>` confirmations; code-inventory's cancel-code action and commission-owings' Pay
  Commissions action (found mid-restyle, not in the order's own Feeds-on list — a real, working,
  non-money-moving DB-bookkeeping endpoint) got the same treatment.
- **Modified — shared components:** `components/admin/FraudAlertCard.tsx`,
  `components/admin/FraudPatternBadge.tsx` — severity/status colors moved from flat, light-mode-only
  `bg-*-100`/`text-*-800` to theme-reactive `bg-*-500/10`/`text-*-500`, matching Decision 5.
- **Live-verification findings (both fixed inline, neither a §7 escalation):** `money-service` not
  running locally caused a real `ECONNREFUSED` 500 on the first `distribute-codes` click
  (`LESSONS-LEARNED.md` L42 recurrence, started via the existing `moneyservice` launch config,
  succeeded on retry); a self-caught bug in the new resources page's copy-link handler mishandling
  already-absolute Vercel Blob URLs (same fix shape as L30).
- **Test fixes:** `__tests__/components/admin/{fraud-pattern-badge,fraud-alert-card}.test.tsx`
  re-derived to assert the real, intentional new token classes (L3/L18) rather than the legacy
  hardcoded colors they replaced.
- **Docs (not stack-analysis targets, listed for completeness):** this session's own migration
  order (CONFIRMED → CLOSED SUCCESSFUL, Deviations filled), `LESSONS-LEARNED.md` (L42/L43
  recurrence notes, no new lesson — stayed at the cap).

</details>

---

**Compiled:** 2026-07-08 · **Updated:** 2026-08-23 (Session 9-8b, admin affiliates cluster — rows
5/6/7/8/9/10/11/24/25/27/96 shipped, fraud-alerts routes modernized to `requireAdmin()`)
**Status:** Initial version — regenerate via the categorization script if the codebase changes significantly
