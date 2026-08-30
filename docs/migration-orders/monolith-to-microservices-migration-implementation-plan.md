# Monolith → Microservices Migration: Implementation Plan & Blueprint

**Purpose:** The execution blueprint for migrating the Trading Alerts SaaS from the Next.js
monolith to the target microservices architecture. Foundation document:
`docs/migration-orders/migration-stack-analysis.md` (the per-file stack split). This plan
sequences the seven outstanding workstreams into dependency-correct phases and gives Claude Code
concrete, verifiable steps for each.

**Audience:** Claude Code (implementation agent) and the project owner (Davin).

**Session-by-session execution:** see the companion
`docs/migration-orders/monolith-to-microservices-migration-session-playbook.md` — it divides these phases into
discrete Claude Code sessions with per-session tasks, "done when" checks, and human-approval
points. Each session runs from a **migration order** (`docs/migration-orders/` — shared rules
in `00-SKELETON-AND-RULES.md`, six template variants, chained: each session drafts the next
session's order, which is confirmed against the live codebase before execution).

**How to use this document:**

- Work phases strictly in order unless a step is explicitly marked parallelizable.
- Every phase has entry criteria (don't start without them) and exit criteria (don't advance
  without them).
- `🚩 FLAG` markers denote decisions or facts the author was not certain about. Claude Code MUST
  re-examine each flag against the live codebase/registry/docs before acting on it, and record
  the resolution in the Decision Log (§11).
- This document does not replace the source documents — it sequences them. When detail is
  needed, follow the reference pointers into the source docs.

**Compiled:** 2026-07-11

---

## 1. The Seven Workstreams and Their Recommended Order

The user-defined workstreams (numbered as given, NOT in execution order):

| #   | Workstream                    | Summary                                                                                                                           |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | API-CLIENT                    | Rewrite the broken `lib/api/index.ts` unified API client (fix deliberately deferred — see flags in `migration-stack-analysis.md`) |
| 2   | HYBRID JWT AUTH               | Convert NextAuth session-centric auth to hybrid (dual) JWT auth spanning Next.js (Vercel) and NestJS (Railway)                    |
| 3   | FRONTEND REDESIGN             | Redesign frontend stack (UI components, pages, layouts, client logic) to catch up with backend stacks                             |
| 4   | NEXT.JS 16 UPGRADE            | Upgrade frontend from Next.js v15.5.7 → v16.2.10, applying the bundle-size/font/streaming optimization docs                       |
| 5   | NESTJS TRANSLITERATION        | Transliterate backend stacks from Next.js API routes/lib to NestJS v11.1.28 (backend only)                                        |
| 6   | NON_MARKET_DATA PRISMA SCHEMA | Design and build the `non_market_data` Prisma schema and connect it to PostgreSQL                                                 |
| 7   | RAILWAY POSTGRESQL            | Design and develop PostgreSQL in Railway cloud                                                                                    |

### Recommended execution order

```
EXECUTION ORDER (workstream numbers in parentheses)

Phase 0  Foundations & contracts          (prerequisite to everything)
Phase 1  Railway PostgreSQL design        (7)
Phase 2  non_market_data Prisma schema    (6)
Phase 3  Hybrid JWT authentication        (2)
Phase 4  NestJS backend transliteration   (5)   ← the long middle; strangler cutover
Phase 5  Next.js 16 upgrade               (4)   ← may run in PARALLEL with Phase 4
Phase 6  Frontend redesign                (3)   ← 12 sessions (6-1, 6-1b, 6-2…6-8, 6-10…6-12)
Phase 7  API client rewrite               (1)   ← LAST, per the deferral flags
Phase 8  Decommission & final verification

Track CC Cross-cutting engineering (§13)        ← runs ALONGSIDE all phases;
         environments/CI-CD, observability,       CC-A/CC-I start in Phase 0,
         resilience, queues, DR, workflow         CC-B/CC-C gate Phase 4 cutovers
```

### Why this order (dependency rationale)

**7 before 6:** The Prisma `non_market_data` schema needs a database to point at. The database
topology decision (one instance/two roles in Phase 1 vs. physically separate databases in
Phase 2, per `money-service-migration-blueprint.md` §5.1/§6) determines datasource URLs, role
grants, and pooling. Provision and design the Railway PostgreSQL layout first.

**6 before 2 and 5:** Both the auth work and the NestJS services consume the new schema:

- The chosen JWT strategy stores **refresh tokens in Prisma** (per
  `SUMMARY_hybrid-jwt-based-authentication-clarification-and-implementation.md`) — that's a
  `non_market_data` model. The schema must exist before the auth service can persist tokens.
- Every transliterated NestJS module injects a Prisma client generated from the split schema.
  Transliterating against the old monolith schema and then re-pointing would double the work.

**2 before 5:** Auth is the cross-cutting concern of the entire backend split. Every NestJS
controller needs a working `JwtAuthGuard` before it can serve a single protected route, and the
frontend must be able to obtain/refresh a JWT before any route cutover. The auth documents'
own recommended sequence agrees: _Prisma foundation → public endpoint redesign → system-wide
OpenAPI → build NestJS Stack A → build Next.js 16 frontend_. Note the deliberate inversion of
`migration-stack-analysis.md`'s "defer `lib/auth/*`, migrate last" advice — that advice applies
to _lift-and-shift of the existing NextAuth session code_, which is indeed risky to move.
Building the **new JWT issuance/verification layer** first (as a thin, additive service) is
different: it doesn't move `lib/auth/*`, it wraps it. NextAuth keeps running on Vercel during
the entire transition; the JWT bridge is added alongside it. Full retirement of session-based
auth still happens near the end (Phase 4 exit / Phase 8).

**5 before 3:** The frontend redesign's stated purpose is to "match current backend stacks" —
you can't design against APIs that don't exist yet. The NestJS services (and their OpenAPI
contracts from Phase 0) are the specification the redesigned frontend consumes.

**4 in parallel with 5 (but before 3):** The Next.js 16 upgrade touches framework plumbing
(build config, streaming, fonts, bundle splitting), not feature surface — it has no dependency
on the backend split and can proceed while NestJS work is underway. It must, however, land
**before** the redesign (3) so new UI is built once, on v16, using v16 idioms (and because
`money-service-migration-blueprint.md` §5.4 already assumes "Vercel, Next.js 16" as the
frontend consolidation target).

**1 strictly last:** `migration-stack-analysis.md` flags this explicitly (twice — appendix
`lib/api/` entry + Migration Readiness Notes): `lib/api/index.ts` is broken, has zero real
consumers, and hybrid auth (2), the `non_market_data` split (6), and the NestJS refactor (5)
each reshape what "correct" means for it (auth headers, base URLs, response shapes). Fixing it
earlier would mean fixing it three times. The redesigned frontend (3) also determines who the
client's real consumers are. Rewrite it only when everything it wraps is stable.

---

## 2. Phase 0 — Foundations & Contracts (prerequisite to all workstreams)

**Goal:** Freeze the ground truth every later phase builds on. No compute or data moves here.

### Steps

0.1 **Read the reference implementation.** `railway-gateway/` is the working proof of the
target pattern (NestJS 11 on Railway: controller → service → Prisma, `ApiKeyGuard`,
BullMQ worker, Railway deploy via `railway.toml`). Per `migration-stack-analysis.md`,
anyone doing migration work reads it first. Extract from it: project layout, Prisma
service wiring, guard pattern, health-check pattern, deployment config.

0.2 **Contract-first OpenAPI.** Write/collect the OpenAPI spec for every endpoint the frontend
consumes today. Source checklist: the 99 `app/api/**/route.ts` files in
`migration-stack-analysis.md`'s FRONTEND appendix + the partial specs in
`docs/open-api-documents/`. Per the money blueprint §4.1 the NestJS services must be
**drop-in replacements**: same paths, same JSON shapes, so frontend cutover is only a
base-URL swap. - 🚩 FLAG: The existing OpenAPI files cover only parts 02/03/04/07/15. Claude Code must
inventory the remaining routes (auth, alerts, drawings, user, admin, affiliate,
disbursement, dlocal, stripe, cron, webhooks) and generate specs from the live route
handlers, not from stale design docs. Per the auth docs, only PUBLIC (inter-service +
frontend-facing) endpoints belong in the system-wide OpenAPI document.

0.3 **Decide service topology names.** Target services on Railway: `operation-service`
(CORE, 72 files), `money-service` (BUSINESS FUNCTION, 71 files), plus existing
`railway-gateway` (ingest, untouched). Frontend stays on Vercel. `mt5-service` (Contabo
Flask) and `backend-stack-c` are SEPARATE_STACK — out of scope, do not touch.

0.4 **Environment/secret inventory.** Enumerate all env vars across `vercel.json`, `.env*`,
`docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`. Produce a
per-service secret matrix (who needs `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`/JWT
keys, `STRIPE_*`, `DLOCAL_*`, `RISE_*`, `SVC_TOKEN`, `RESEND_API_KEY`, `CRON_SECRET`).

0.5 **Baseline test green.** Run the full existing Jest/e2e suites and record the pass state.
Every later phase's regression gate is "no worse than this baseline."

0.6 **Version pinning.** - 🚩 FLAG: Target versions given as Next.js **16.2.10**, NestJS **11.1.28**, and Prisma
**7.8.0**. Claude Code must verify these exact versions exist on the npm registry at
implementation time (`npm view next@16.2.10 version`, `npm view @nestjs/core versions`,
`npm view prisma@7.8.0 version`) and pin the nearest stable if they don't. - **Prisma upgrade is its own workstream step**, not just a pin: the currently installed
Prisma is outdated (a Prisma 5-era setup — `scripts/test-prisma5-upgrade.ts` suggests
even the 5.x upgrade was only prepared, not necessarily landed). The upgrade to 7.8.0
is executed as Phase 2 step 2.0 (before any schema splitting) — see 🚩 F19 for the
required breaking-change audit across the 5→6→7 major boundaries.

0.7 **Open the cross-cutting track (§13).** Stand up CC-A (staging environments + per-service
CI skeleton) and CC-I (local dev compose) now — every later phase assumes they exist.

### Exit criteria

- OpenAPI spec covering all public endpoints, committed to `docs/open-api-documents/`.
- Secret matrix and service topology documented.
- Baseline test results recorded.
- Staging environment (CC-A) and local dev stack (CC-I) operational.
- All Phase 0 flags resolved in the Decision Log.

---

## 3. Phase 1 — Railway PostgreSQL Design & Provisioning (Workstream 7)

**Goal:** A designed, provisioned, and reachable PostgreSQL layout on Railway that all later
phases target. This phase implements infrastructure only — no application data moves yet.

### Design (from the existing plans — do not reinvent)

Two logical data domains (per `migration-stack-analysis.md` "Database Architecture" section):

1. **`market_data_v6`** — already flowing: EA → Contabo SQLite → `railway-gateway` → Postgres
   `market_data_v6` table. Source of truth schema: root `prisma/schema.prisma`
   (`model MarketDataV6`). **Do not redesign this.**
2. **`non_market_data`** — everything else (User/Account/Session/Subscription/Alert/
   Notification/Drawing/DrawingAlert/SystemConfig + the 10 money models). Today undivided in
   the one shared schema/instance.

Target Railway layout, phased per `money-service-migration-blueprint.md` §5.1 and §6:

- **Stage A (this phase):** ONE Railway PostgreSQL instance hosting both domains, with
  **role-level discipline**:
  - `money_svc` role — ALL privileges on the 10 money tables (AffiliateProfile, AffiliateCode,
    Commission, Payment, Subscription, SystemConfig(+History), FraudAlert,
    AffiliateRiseAccount, PaymentBatch, DisbursementTransaction, RiseWorksWebhookEvent,
    DisbursementAuditLog), SELECT on nothing else.
  - `core_app` role — no privileges on money tables (temporary read-only grant on
    Subscription during transition, revoked at cutover).
  - `gateway_ingest` role — write access to `market_data_v6` only (formalizes what
    `railway-gateway` already does).
  - PgBouncer in front, transaction-pooling mode. Railway services get steady pools (10–20);
    Vercel serverless functions go through the pooler.
- **Stage B (deferred — trigger-based, not calendar-based):** physically separate `money-db`
  Railway instance, migrated via `pg_dump`/restore with checksum-verified freeze window, per
  blueprint §6. **Do not execute Stage B in this phase.** Its triggers (blueprint §6) are
  operational (load, compliance), not part of this migration's critical path.

### Steps

1.1 Locate where the monolith's Postgres lives today and how `railway-gateway` connects. - 🚩 FLAG: `migration-stack-analysis.md` says the shared app DB is "wherever the Next.js
monolith's DB is hosted today" — the actual host (already Railway? Vercel Postgres?
elsewhere?) is not stated in the docs read for this plan. Claude Code must determine it
from live env vars/Railway dashboard first. If the shared DB is **already** the Railway
instance `railway-gateway` writes to, this phase is role/pooling work only — no data
relocation. If it is hosted elsewhere, add a migration sub-step: provision Railway
Postgres, `pg_dump`/restore full database during a maintenance window, re-point the
monolith's `DATABASE_URL`, verify row counts/checksums, keep the old instance as
read-only fallback for 7 days.
1.2 Provision/confirm the Railway PostgreSQL instance; enable automated backups; record
connection strings for direct and pooled access.
1.3 Create the three roles with the grants above; write the grant script as a committed,
idempotent SQL file (e.g. `prisma/roles/roles.sql`).
1.4 Deploy PgBouncer (Railway template or sidecar) in transaction mode; verify Prisma works
through it (note: Prisma + PgBouncer transaction mode requires `pgbouncer=true` connection
flag and disables some features — verify migrations run against the DIRECT url, runtime
against the pooled url).
1.5 Smoke-test: connect as each role, verify grants enforce the §5.1 "no cross-domain
joins/writes" rule at the database level.

### Exit criteria

- Railway Postgres reachable; backups on; roles and PgBouncer live; grant script committed.
- `railway-gateway` still ingesting market data without interruption (its write path must
  never break during this phase).
- Monolith still fully functional against the (possibly re-homed) database.

---

## 4. Phase 2 — `non_market_data` Prisma Schema (Workstream 6)

**Goal:** A dedicated, authoritative Prisma schema for the non-market domain, connected to the
Phase 1 database, consumed later by both NestJS services.

### Steps

2.0 **Upgrade Prisma to v7.8.0 FIRST — in isolation, before any splitting.** One variable at a
time: land the version upgrade as its own commit/deploy against the _unchanged_ monolith
schema, get the full test baseline green, and only then start carving the schema. Doing
the upgrade and the split together makes every regression ambiguous. - Sequence: bump `prisma` + `@prisma/client` to 7.8.0 → regenerate the client → run
`prisma migrate diff` to confirm the migration history is still coherent → full test
suite vs. the Phase 0.5 baseline → deploy to staging → production. - Update `railway-gateway`'s Prisma at the same version only when it's next touched
(Phase 8.2 schema-dedup) — different services may run different client versions against
the same database in the interim; that's safe, just log it. - 🚩 FLAG (F19): the 5.x→7.8.0 jump crosses **two major versions** and is
post-knowledge-cutoff for this plan's author. Claude Code MUST read the official Prisma
6 and 7 upgrade guides at implementation time and audit this codebase against them
before editing — expected areas of breakage to check: generated client output
path/import style (ESM), `previewFeatures` that graduated or were removed, changed
`datasource`/`directUrl`/PgBouncer connection semantics (re-verify Phase 1.4 through the
pooler), middleware → client-extensions migration if `$use` is present, changed
`Decimal`/JSON typings in money code, minimum Node version on Railway/Vercel, and
whether Prisma 7's multi-file schema support changes the recommended resolution of F5.

2.1 **Split the schema file.** From root `prisma/schema.prisma`, carve out every model except
`MarketDataV6` into the new `non_market_data` schema. Recommended layout:

    ```
    prisma/
    ├── market-data/schema.prisma      # MarketDataV6 only (stays aligned with railway-gateway copy)
    └── non-market-data/schema.prisma  # User, Account, Session, Subscription, Alert,
                                       # Notification, Drawing, DrawingAlert, SystemConfig(+History),
                                       # Payment, FraudAlert, AffiliateProfile, AffiliateCode,
                                       # Commission, AffiliateRiseAccount, PaymentBatch,
                                       # DisbursementTransaction, RiseWorksWebhookEvent,
                                       # DisbursementAuditLog
    ```

    - 🚩 FLAG: Exact model census must be taken from the live `prisma/schema.prisma`, not from
      this list — the stack-analysis doc's model list may be incomplete (e.g. RAG dual-memory
      models from migration `20260214000000_rag_dual_memory`, SystemConfigHistory, login
      history/session-tracking models). Claude Code: enumerate all models in the live schema
      and assign each to market/non-market explicitly; anything ambiguous goes in the
      Decision Log.
    - 🚩 FLAG: Whether to use two Prisma **schema files** against one database (multi-schema /
      multi-client) vs. Postgres **schemas** (`market_data`, `non_market_data` namespaces) vs.
      keeping one file with role-enforced boundaries — the source docs mandate the role split
      but not the file layout. Recommended default: two Prisma schema files, two generated
      clients (`@prisma/client-market`, `@prisma/client-nonmarket`), same instance, since it
      matches the eventual two-service reality. Claude Code should validate this against
      Prisma's current multi-client ergonomics before committing.

2.2 **Add auth-support models** needed by Phase 3 (per the auth summary doc's "Prisma for
refresh tokens" recommendation): `RefreshToken` (userId, hashed token, expiresAt,
revokedAt, device metadata) and any JWT key-rotation bookkeeping table if JWKS-with-rotation
is chosen.

2.3 **Migration discipline.** Baseline the new schema against the existing database
(`prisma migrate diff` / `db pull` first — the tables already exist; the first migration
must be a no-op baseline, NOT a create). All migrations run via the direct (non-pooled)
connection.

2.4 **Cross-domain FK audit.** Per blueprint §5.1 rule 3 ("opaque references only"), find FKs
between money tables and User; convert to plain indexed columns (drop the FK constraint,
keep the column + index). Document each drop.

2.5 **Wire the monolith to the split clients** (mechanical, behavior-preserving): `lib/db/
    prisma.ts` becomes two client singletons; imports updated. Monolith still deploys as one
app — this is a code-level split only.

2.6 Regenerate types; run full test baseline; `prisma/seed.ts` split accordingly.

### Exit criteria

- Prisma 7.8.0 live in production on the monolith (step 2.0), baseline tests green, F19
  breaking-change audit documented in the Decision Log.
- `non_market_data` schema file authoritative, baselined, migration history clean.
- Monolith runs entirely on the split clients with baseline tests green.
- Refresh-token model in place (unused as yet).
- `railway-gateway/prisma/schema.prisma` unchanged and still consistent with the market-data
  schema file (note the known debt: hand-synced duplicate — leave as-is for now, log it).

---

## 5. Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2)

**Goal:** JWT-based auth that works identically for (a) Next.js SSR → NestJS calls, (b)
browser → NestJS calls, and (c) service → service calls — per the three hybrid-auth study docs
in `backend-stack-a/hybrid-authentication-for-backend-stack-a/`.

### Architecture decisions (pre-made by the study docs; re-validate, don't re-litigate)

- **Pattern:** NestJS is the auth provider ("Pattern 1" in
  `JWT-BASED-FOR-HYBRID-AUTHENTICATION-ARCHITECTURE.md`): NestJS `/auth/login|register|refresh`
  issues JWTs; Next.js stores the JWT in an **httpOnly, secure, sameSite=lax cookie** via a
  Next.js API route; SSR reads the cookie and forwards `Authorization: Bearer`; browser calls
  send the same token; every backend service verifies the signature statelessly.
- **Tokens:** short-lived access token (~15 min) + refresh token (~30 d) persisted in
  **Prisma** (not Redis) — per the summary doc's cost/perf analysis. Redis stays for queues/
  cache/rate-limit only, never on the auth critical path.
- **One JWT system for all user types** (traders, affiliates, admins) — role/tier in claims,
  `RolesGuard` per service.
- **Service-to-service:** dedicated `SVC_TOKEN` (per money blueprint §4.3), never user JWTs.
- 🚩 FLAG: The summary doc recommends **OpenAuth** as the primary reference (80% match) over
  Better Auth, and mentions reference docs (`auth-migration-recommendation.md`,
  `auth-migration-strategy.md`, `auth-implementation-roadmap.md`) that were not found/read
  while writing this plan. Claude Code: locate and read those three docs if they exist in the
  repo; verify OpenAuth's current state/maintenance before adopting it as a dependency vs.
  hand-rolling with `@nestjs/jwt` + `passport-jwt` (which the money blueprint's simpler
  "NextAuth issues JWTs, Nest validates same secret" bridge implies). These are two DIFFERENT
  strategies — bridge (keep NextAuth, share secret/JWKS) vs. replace (NestJS issues all
  tokens). Recommended resolution: **bridge first** (money blueprint §4.2 — lowest risk,
  NextAuth keeps working), **replace later** (full Pattern 1) once operation-service is live.
  Claude Code must confirm this two-step approach or collapse to one step if the codebase
  makes the bridge trivial to skip.
- 🚩 FLAG: Signing algorithm/key distribution: shared `NEXTAUTH_SECRET` (HS256) is the
  blueprint's Phase-1 answer; JWKS (RS256/EdDSA) is better once ≥2 services verify tokens.
  Decide when the second verifier appears; plan for key rotation either way.

### Steps

3.1 **Auth bridge (additive, no user-visible change):** set NextAuth `session.strategy='jwt'`
(verify current setting in `lib/auth/auth-options.ts`); ensure the NextAuth JWT carries
`sub`, `email`, `role`, `tier` claims; stand up a minimal NestJS `auth` module (inside the
Phase 4 operation-service skeleton) with `JwtAuthGuard` verifying that same token.
3.2 **Token endpoints:** implement `/auth/login`, `/auth/register`, `/auth/refresh`,
`/auth/logout` (revoke refresh token), `/auth/me` in NestJS, reusing the validated logic
from `lib/auth/*` (password verify, 2FA via `lib/auth/two-factor.ts`, lockout rules).
Per the reuse analysis in the summary doc: ~70% of existing auth files carry over as-is,
~25% adapted (forms point at new endpoints; session helpers swap `getServerSession()` for
JWT verification), ~5% replaced (`[...nextauth]/route.ts`, `auth-options.ts` — replaced
only at the final cutover, not in this phase).
3.3 **Next.js side:** cookie-set API route (`app/api/auth/set-token`), middleware guard
checking token presence on protected matchers, silent-refresh loop (~14 min interval),
SSR fetch helpers that forward the bearer token.
3.4 **CORS:** NestJS `enableCors` allowing only the Vercel origins + localhost dev, with
`credentials: true`.
3.5 **2FA, email verification, password reset** flows re-pointed to NestJS endpoints —
UI pages themselves are 100% reusable per the summary doc.
3.6 **Tests:** port `__tests__` auth coverage; add token-expiry/refresh/revocation e2e; verify
a protected route via (a) SSR path, (b) browser path, (c) service path.

### Exit criteria

- A protected NestJS endpoint returns 200 with a valid JWT from all three call paths and 401
  otherwise; refresh + revocation proven.
- NextAuth still functional on Vercel (no regression) — dual running.
- All auth flags resolved in the Decision Log.

---

## 6. Phase 4 — Backend Transliteration to NestJS (Workstream 5)

**Goal:** The 143 BACKEND files (72 CORE → `operation-service`, 71 BUSINESS FUNCTION →
`money-service`) transliterated from Next.js API routes/lib modules to NestJS v11 services on
Railway, cut over via the strangler pattern with per-slice rollback. **Backend only — no UI
code is transliterated.**

### Ground rules

- Template: `railway-gateway/` (structure, guards, Prisma service, `railway.toml`, health
  module) + the money blueprint's §5.2 skeleton.
- Porting mechanics (blueprint §5.2 notes): framework-free `lib/*` service layers become
  `@Injectable()` services with constructor-injected Prisma; route handlers become thin
  controllers; Vercel crons → `@nestjs/schedule` `@Cron()` (same UTC expressions from
  `vercel.json`); webhooks get raw-body parsing (HMAC needs exact bytes); long work → BullMQ
  on Railway Redis.
- Contract fidelity: every migrated endpoint must match the Phase 0 OpenAPI spec byte-for-byte
  in shape (drop-in replacement; frontend cutover = base-URL swap behind an env flag).
- Verification per slice: 48h shadow-run (call old+new, diff responses) for read APIs; webhook
  replay with recorded signed payloads; ported Jest suites green before each cutover.

### 4A — money-service (has its own dated blueprint; follow it)

Execute `davintrade-part-12-17-18-19-stack/money-service-migration-blueprint.md` Phase 1 as
written: Phase 0 prerequisites (§4, largely satisfied by this plan's Phases 0–3), skeleton
(§5.2), Railway deploy (§5.3), then the 5-slice strangler cutover (§5.5):

1. 8 cron jobs → Nest scheduler (rollback: restore `vercel.json` crons)
2. RiseWorks + dLocal webhooks (rollback: repoint provider dashboard URLs)
3. Read APIs — dashboards/reports/admin lists (rollback: flip env flag)
4. Write APIs + Stripe webhook (rollback: flip back)
5. Tier-update event path money → core (rollback: re-enable direct read)

Exit per §5.6: 30 days on Railway, error rate <0.1%, zero cross-domain table access (verified
by role grants + query logs), crons on schedule, core reads tier only from its own data.

### 4B — operation-service (CORE, 72 files; no dedicated blueprint — sequence below)

Migration order by self-containment (per `migration-stack-analysis.md` readiness notes):

1. **`lib/alert-engine/*` (9 files) first** — already an independent worker
   (`scripts/alert-worker.ts`, own docker-compose service, `railway-worker.json`) with a
   narrow interface (Redis pub/sub in, BullMQ dispatch out). Port as the operation-service's
   first module + worker process; closest to "already migrated."
2. Shared infra modules: `lib/redis`, `lib/cache`, `lib/logger`, `lib/errors/*`,
   `lib/monitoring` → Nest providers/interceptors.
3. Domain modules, each = one strangler slice with the same flag/shadow-run mechanics:
   alerts (`app/api/alerts/**`), drawings + drawing-alerts (`app/api/drawings/**`,
   `lib/drawing/*`), notifications, tier (`app/api/tier/**`, `lib/tier*`,
   `middleware/tier-check.ts` → Nest guard), user/profile/2FA/sessions (`app/api/user/**`),
   market-data channel proxy (`app/api/market-data/channel`), websocket delivery.
   - 🚩 FLAG: `lib/websocket/server.ts` + `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md` +
     `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md` — real-time delivery (socket adapter, BullMQ
     scaling) has its own spec docs not fully digested into this plan. Claude Code must read
     both before porting the websocket/notification delivery path and decide whether Socket.IO
     lives in operation-service or a separate gateway process.
4. **Auth cutover last within 4B:** retire `app/api/auth/[...nextauth]` in favor of the
   Phase 3 NestJS auth endpoints; replace `lib/auth/auth-options.ts`; frontend switches
   login/register forms to the NestJS endpoints (the ~5–10 line changes per form noted in the
   auth summary doc). This is the point where session-based NextAuth actually retires.
5. Email rendering (`emails/*` CORE subset, `lib/email/email.ts`) — server-rendered
   React-email templates move with their calling service.

### Cross-cutting during Phase 4

- Each `app/api/**/route.ts` that migrates becomes a deleted route + frontend env-flag swap
  (roadmap step 5: `fetch(NEXT_PUBLIC_API_URL + ...)`). Track per-route status in a cutover
  table committed to the repo.
- `SHARING` (56 files): extract `types/*` into an `@trading-alerts/types` package when the
  second consumer (first NestJS service) appears — the roadmap's own recommendation. Build
  scripts/CI updated per service.
  - 🚩 FLAG: package registry/workspace mechanics (npm workspace vs. private registry vs.
    git submodule) not specified anywhere — Claude Code picks the lightest option that works
    with Vercel + Railway builds (likely a pnpm/npm workspace monorepo or a simple published
    package) and records it.
- 🚩 FLAG: NestJS "v11.1.28" — pin per Phase 0.6 verification. `railway-gateway` already runs
  NestJS 11.x; keep all three Nest services on the identical minor version. Both new services
  are built on Prisma **7.8.0** from day one (the monolith is already on it after Phase 2.0);
  `railway-gateway` catches up at Phase 8.2.

### Exit criteria

- All 143 BACKEND files retired from the Next.js monolith; both services live on Railway with
  the §5.6-style stability window met.
- Monolith's `app/api/**` reduced to only routes that intentionally remain (if any — e.g.
  cookie-set helper from Phase 3).
- ~~NextAuth fully retired; JWT auth is the only auth system.~~ **Amended, Session 4B-22
  (`DECISION-LOG.md` F59), Davin via Antigravity Advisor, 2026-08-04:** Credentials, 2FA,
  registration, email verification, password reset, and user sessions migrated to JWT via
  operation-service; OAuth intentionally retained on NextAuth via a narrow provider shim per F56
  (Google/Twitter/LinkedIn — operation-service has no OAuth support, and building it or dropping
  OAuth login were both explicitly rejected). This is a deliberate, permanent architectural
  decision, not a phase-exit exception awaiting later cleanup.

---

## 7. Phase 5 — Next.js 15.5.7 → 16.2.10 Upgrade (Workstream 4)

**Runs in PARALLEL with Phase 4** (no shared files with the backend transliteration — it
touches framework config and FRONTEND-stack files only). Must complete **before Phase 6**.

### Steps

5.1 **Pre-upgrade baseline:** record bundle sizes (`bundle-size-optimization/
    bundle-size-loading-optimization/bundle-size-analysis-report-31122025.md` methodology),
Lighthouse/CWV numbers, and build times.
5.2 **Upgrade:** `next@16.2.10` (pin per Phase 0.6 flag), React/TypeScript/ESLint peer deps,
run `npx @next/codemod` suite for 16.x breaking changes. - 🚩 FLAG: Next.js 16 breaking-change list (async request APIs, caching-default changes,
middleware/runtime changes, removed config options) is post-knowledge-cutoff for this
plan's author. Claude Code MUST fetch the official Next.js 15→16 upgrade guide at
implementation time and enumerate the actual breaking changes against this codebase
before editing anything.
5.3 **Apply the prepared optimization docs** (they were written for exactly this moment): - `bundle-size-optimization/bundle-size-loading-optimization/bundle-optimization-
      architecture.md` + `-implementation.md` (+ the ready-made Claude Code prompt in that
folder) — code-splitting, dynamic imports, vendor chunking. - `bundle-size-optimization/next-js-refactoring-for-bundle-size-reduction/*` — client→
server component conversions per the 01012026 refactoring guide. - `frontend/FONT-OPTIMIZATION-IN-NEXTJS.md` — `next/font` self-hosting strategy. - `frontend/STREAMING-IN-NEXTJS.md` — streaming SSR/Suspense boundaries on dashboard and
charts routes. - `frontend/STEP-4-FRONTEND-OPTIMIZATION-{GUIDE,README,ROADMAP}.md` — the umbrella
checklist; treat its roadmap as the sub-task list for this phase.
5.4 **Regression gates:** `.github/workflows/bundle-monitor.yml` thresholds; full test suite;
visual smoke of all route groups; verify `vercel.json` (remaining crons, headers) still
valid on 16.

### Exit criteria

- Production build on 16.2.10 deployed to a Vercel preview, all tests green, bundle size ≤
  pre-upgrade baseline (target: improved per the optimization docs), no CWV regression.

---

## 8. Phase 6 — Frontend Redesign (Workstream 3)

**Goal:** Close the frontend↔backend feature gap: redesign/extend UI components, pages,
layouts, and client-side logic to fully support the now-live NestJS backend capabilities.

**Entry:** Phase 4 services live (their OpenAPI contracts are the spec); Phase 5 done (build on
v16 idioms — Server Components by default, streaming, server actions where appropriate).

### Steps

6.1 **Gap analysis (the redesign backlog is not enumerated anywhere — build it first).**

~~🚩 FLAG: The user states frontend "features and functionalities are in shortage to support
backend stacks" but no document read for this plan enumerates WHICH features are missing.~~
**AMENDED 2026-08-10 — the flag is discharged; the enumeration now exists.** A full sweep of
`app/**/page.tsx` (57 files), `app/api/**/route.ts` (122 endpoints), both NestJS services'
controllers, all 21 OpenAPI specs, all 33 Prisma models, and every internal `href` produced:

- `docs/files-completion-list/ui-page-gap-analysis.md` — the report (4 user-type workflows;
  Section A code-backed gaps: 18 MODIFY + 12 NEW; Section B UX gaps: 22 NEW; Section C
  structural findings).
- `docs/files-completion-list/ui-page-gap-register.xlsx` — 90-row page register, 32 orphaned
  endpoints/models, 14 dead internal links.

Session 6-1's job is therefore re-scoped from _performing_ the census to **independently
re-verifying it against live code, extending it, assigning each row a target session, and
obtaining Davin's triage** (build / internal-only / out-of-scope). The mechanical method is
unchanged and still binding: an endpoint counts as a gap when it has no UI consumer, or a
consumer that exposes only a subset of its capability. `lib/api/index.ts` does not count as a
consumer (known-broken by design until Phase 7).

The seed list originally proposed here has been superseded by the real findings. The five
candidate gaps it named resolved as: MTF overlay — **already built and correctly PRO-gated**;
V8 variant selection UI — **built** (`/api/market-data/channel` consumed via `useMtfOverlay`);
disbursement batch lifecycle — **built**, but the provider config still offers MOCK/RISE with no
WISE option; affiliate report views — 4 of 5 admin report endpoints have pages,
`reports/code-flows` has none, and the affiliate's own `code-inventory` endpoint has no page;
realtime notification UX — the bell exists but links to `/notifications`, **which does not
exist**. Three further classes were found that this plan never anticipated: pages rendering
**fabricated data in production**, a **missing route** (`/api/geo/detect`) that two components
already call, and **no 404 page** alongside 14 dead internal links.
6.2 **Information architecture pass:** reconcile the three parallel shells (`app/(dashboard)`,
`app/admin`, `app/affiliate`) — shared layout primitives, nav, and role-gated entry from
the unified JWT claims (role/tier now in the token, not a session lookup).
6.3 **Design-system consolidation:** extend `components/ui/*` (22 primitives) to cover the
redesign backlog before building pages; keep single-source tokens (`tailwind.config.ts`).
6.4 **Client-side data layer:** replace ad-hoc `fetch()` calls in hooks/components with a thin
typed layer generated from the OpenAPI specs (interim — the full unified client is
Phase 7; don't hand-build what Phase 7 replaces. Acceptable interim: openapi-generated
types + small per-domain fetch wrappers).
6.5 Build/redesign pages per the gap matrix, in backend-slice order (alerts/charts/drawings →
notifications → settings/user → admin → affiliate → payments), each behind the same env
flags used in Phase 4 cutovers.
6.6 A11y + responsive audit on changed surfaces; update `__tests__/components/*`.

> **Note on numbering below.** Steps `6.7a`–`6.7c` are _plan steps_, not session numbers. They
> are lettered deliberately: a step numbered "6.9" would collide with the retired **session**
> number 6-9. Their owning sessions are named explicitly in each step.

**6.7a (added 2026-08-10) Mock-data hotfix — owned by Session 6-1b; runs immediately after 6.1,
before any redesign.**
Three pages ship fabricated data to real users today: `/settings/billing` (mock invoice array,
mock usage stats, a cancel dialog wired to nothing — while `GET /api/invoices`,
`GET /api/subscription` and `POST /api/subscription/cancel` all exist unconsumed),
`/admin/fraud-alerts/[id]` (`MOCK_ALERT` — an admin makes fraud decisions on invented data), and
`/admin` (fabricated activity feed). Removing fabricated data is a correctness fix, not a
redesign, and must not wait on the redesign queue. PORT variant, low dial: bind the real
endpoints, change nothing visual.

**6.7b (added 2026-08-10) Public / marketing surface — owned by Session 6-10.**
`app/(marketing)/layout.tsx` links to 10
non-existent pages and `components/auth/register-form.tsx`'s consent checkbox links to `/terms`
and `/privacy`, which exist only behind auth. The app also has **no `app/not-found.tsx`**, so
every dead link renders an unstyled framework default. `/disclaimer` is compliance-relevant for
a trading product — gated on F63 (legal copy ownership).

**6.7c (added 2026-08-10) Admin system operations — owned by Session 6-11.**
Four backend capabilities have zero UI:
the 5 MT5 terminal admin endpoints (`part-06-flask_mt5_openapi.yaml`), the 8 cron endpoints
(no run history or failure visibility), `OutboxEvent` (live in production, unobservable), and
`SystemConfigHistory` (no audit view). The `flask-api` outage found at Session 4B-18d was
invisible in-product — this is the session that fixes that class of blindness.

### Exit criteria — ✅ ALL MET, Phase 6 CLOSED 2026-08-11

| Criterion                                            | Status | Verified                                                                                                                                                                                        |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gap matrix fully triaged                             | ✅     | 59 rows, all `BUILT` / `VERIFIED` / `OUT_OF_SCOPE`. One row (A2-12) was wrongly marked `BUILT`; found by independent re-audit, corrected, then genuinely built in the 2026-08-11 ad-hoc repair. |
| All redesigned surfaces live; component tests green  | ✅     | 57 → **85 pages**. Note: no surface used a `MIGRATE_UI_*` flag — the anticipated flag convention was never exercised; component tests plus Davin's review were the gate.                        |
| No page renders hardcoded or mock data               | ✅     | Scanned all 85 `page.tsx` — zero mock/hardcoded data constants (was 3 pages).                                                                                                                   |
| Zero dead internal links; `app/not-found.tsx` exists | ✅     | Every internal `href` resolves against the live route tree (was 14 dead). `not-found.tsx` + `global-error.tsx` both present.                                                                    |
| F61, F62, F63 resolved                               | ✅     | F61 Session 6-8, F62 Session 6-2, F63 Session 6-10. F11 resolved Session 6-12.                                                                                                                  |
| `app/test-api/page.tsx` deleted                      | ✅     | Confirmed absent.                                                                                                                                                                               |

**Open by decision, not oversight:** B2-13 `/welcome` (ticketed `OUT_OF_SCOPE`); the
`operation-service` Railway deploy for the new security-alerts endpoints (escalated per
`EXECUTOR-PROTOCOL.md` §7 — flag defaults off, monolith fallback serves the feature); and the
standing no-live-authenticated-browser-check gap (`CLAUDE.md` Waiting-on #117, open since 6-1b).

Full evidence: `docs/files-completion-list/ui-page-gap-register.xlsx`, sheet `verification`.

---

## 9. Phase 7 — API Client Rewrite (Workstream 1) — DELIBERATELY LAST

**Goal:** Rewrite `lib/api/index.ts` (the unified Stack A/Stack B API client) now that
everything it wraps is stable. This honors both flags in `migration-stack-analysis.md` (the
appendix `lib/api/` entry and the Migration Readiness Notes pointer): the file is known broken
(PUT vs PATCH on alerts, wrong notification read path, PATCH vs PUT on preferences, phantom
market-data path shape), has zero real consumers, and was deferred precisely until hybrid auth

- `non_market_data` split + NestJS refactor landed. They have now landed.

### Steps

7.1 Re-read the appendix flag's mismatch list; confirm each against the **new** NestJS routes
(several mismatches may have dissolved — e.g. the NestJS alerts controller defines its own
verb set; the client must match the Phase 0/4 OpenAPI spec, which is now the only truth).
7.2 Rewrite the client **generated rather than hand-maintained**: typed methods per service
(`operationApi`, `moneyApi`, optionally `gatewayApi`), JWT bearer injection from the Phase 3
token layer, base URLs from env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MONEY_API_URL`).

> ⚠️ **AMENDED 2026-08-11.** This step originally read "generated **from the OpenAPI specs**."
> That is not possible as written: the 21 specs in `docs/open-api-documents/` describe the
> **monolith's `/api/*` surface**, while `operationApi`/`moneyApi` must wrap **107 NestJS service
> routes** (`operation-service` 62, `money-service` 45) that no spec documents. Evidence:
> `docs/open-api-documents/OPENAPI-DRIFT-REPORT-pre-phase-7.md`. **Session 7-1 Step 0 is now a
> scope decision for Davin** — (a) hand-author the service specs, (b) emit them from the running
> services via `@nestjs/swagger` (both already define DTO classes; a generated spec cannot drift
> from its code — evaluate first), or (c) narrow Phase 7 to the monolith surface only, defensible
> if the browser-never-calls-services invariant holds (F45/F30). Register the outcome as a flag.
> Also note: `operation-service` sets **no** global prefix while `money-service` uses `/v1` —
> the generated client must encode this, and no current spec records it.
> 7.3 Migrate the Phase 6 interim per-domain fetch wrappers onto the unified client; delete the
> unguarded `app/api-test/page.tsx` debug page or gate it to admin+dev.
> 7.4 Rewrite the 2 test files (`stack-a-client.test.ts`, `stack-b-client.test.ts`) against
> recorded real responses (contract tests), not blanket `fetch` mocks — the old suites'
> 36/36 pass was meaningless per the flag.
> 7.5 Update/retire the 3 stale design docs
> (`backend-stack-a/api-client-between-frontend-and-stack-b/api-client-{design,maintenance-

    and-updates,testing}.md`) — they predate the V8 single-symbol redesign.

### Exit criteria

- Every frontend data access goes through the unified client; zero direct `fetch()` to
  API base URLs outside it (lint rule to enforce); contract tests green against live services.

---

## 10. Phase 8 — Decommission & Final Verification

> **AMENDED 2026-08-20 (Advisor, PROPOSED).** Phase 8 is **split**. **8.1 + 8.2 run early** —
> after Phase 10 and before Phase 11 — while the surface they delete is still fresh. **8.3–8.6
> run last**, after Phase 15, so the full-system e2e, load test and documentation close-out cover
> the AI, market-comments, support-chat and mobile stacks as well. Step numbering is unchanged.
>
> **8.1 gains three entry criteria:** the carry-forward money sessions 4A-13/4A-14/4A-15 CLOSED
> (F60/F49/F47/F50 — the dLocal write path and the Stripe webhook are still monolith-native and
> would be deleted out from under live traffic), Phase 9-10 CLOSED, and flag **F65** resolved
> (it defines what "migrated" means for a route the browser still calls).
> **8.2 must run before Session 13-1** — Stack E adds generation logic to the very
> `market_data_v6` schema 8.2 deduplicates.
> **8.3 journeys are extended** with: draw→line-alert→fire; AI quad-retrieval → streamed answer →
> trade-setup card; comment generated → socket → Panel 3; support-chat round trip; mobile push
> received. **8.4** adds the AI token-cost path under load and socket fan-out with the comments
> feed live. **8.6** closes F1–F74 (not F1–F19) and re-estimates F12 against the new roadmap.
>
> Full sequencing: `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md`.

8.1 Delete migrated `app/api/**` routes from the monolith (except intentional keepers);
remove the `frontend/` transitional mirror's dLocal slice per money blueprint §5.4
("mirror pattern dissolves"); empty `vercel.json` crons.
8.2 Resolve the `railway-gateway` schema-duplication debt: point it at the shared
market-data schema/types package (or generate its Prisma client from the same file).
8.3 Full-system e2e: EA→gateway→Postgres ingest; login/refresh/2FA; alert create→fire→notify
(websocket + email); Stripe + dLocal checkout (test mode); affiliate conversion →
commission → disbursement batch (mock provider); tier gating on charts.
8.4 Load test (`.github/workflows/load-test.yml`) against the split architecture; confirm
PgBouncer pool behavior under Vercel burst.
8.5 30-day stability window (mirrors money blueprint §5.6) across BOTH services; then decide
on Database Stage B (physical money-db split) per the blueprint §6 triggers — explicitly
OUT of this migration's scope.
8.6 Documentation sweep: regenerate `migration-stack-analysis.md` ("regenerate via the
categorization script if the codebase changes significantly" — it will have), update
architecture diagrams, close the Decision Log.

---

## 11. Decision Log & Flag Register (Claude Code: resolve each before/at its phase)

| #   | Phase   | Flag                                                                                                                                                                                                                  | Resolution required                                                                                                                                                                                                                                                                                   |
| --- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 0.2     | OpenAPI coverage incomplete (only parts 02/03/04/07/15 exist)                                                                                                                                                         | Generate specs from live route handlers; PUBLIC endpoints only                                                                                                                                                                                                                                        |
| F2  | 0.6     | Exact versions `next@16.2.10`, NestJS `11.1.28` unverified (post-cutoff)                                                                                                                                              | Verify on npm; pin nearest stable; align all Nest services                                                                                                                                                                                                                                            |
| F3  | 1.1     | Current host of the monolith's shared Postgres unknown                                                                                                                                                                | Inspect live `DATABASE_URL`/Railway; add relocation sub-step only if needed                                                                                                                                                                                                                           |
| F4  | 2.1     | Model census may exceed the doc's list (RAG dual-memory, history tables)                                                                                                                                              | Enumerate live schema; assign every model explicitly                                                                                                                                                                                                                                                  |
| F5  | 2.1     | Prisma file-layout strategy (2 schema files vs pg schemas vs 1 file) unmandated                                                                                                                                       | Default: two schema files/two clients; validate Prisma ergonomics                                                                                                                                                                                                                                     |
| F6  | 3       | OpenAuth vs NextAuth-bridge vs hand-rolled `@nestjs/jwt`; missing reference docs (`auth-migration-{recommendation,strategy}.md`, `auth-implementation-roadmap.md`)                                                    | Locate/read the 3 docs; recommended: bridge first, replace later                                                                                                                                                                                                                                      |
| F7  | 3       | HS256 shared secret vs JWKS/RS256 + rotation timing                                                                                                                                                                   | Decide at second-verifier moment; plan rotation either way                                                                                                                                                                                                                                            |
| F8  | 4B      | Websocket/realtime delivery architecture (socket adapter, BullMQ scaling) not digested                                                                                                                                | Read `PHASE-5-DELIVERY-AND-REALTIME-SPEC.md` + `SCALING-BULLMQ-AND-SOCKET-ADAPTER.md` before porting                                                                                                                                                                                                  |
| F9  | 4       | `@trading-alerts/types` packaging mechanics unspecified                                                                                                                                                               | Choose workspace/registry approach compatible with Vercel+Railway builds                                                                                                                                                                                                                              |
| F10 | 5.2     | Next.js 16 breaking-change list unknown to plan author                                                                                                                                                                | Fetch official 15→16 upgrade guide at implementation time                                                                                                                                                                                                                                             |
| F11 | 6.1     | Frontend feature-gap backlog not enumerated anywhere — **enumeration delivered 2026-08-10** (`docs/files-completion-list/ui-page-gap-analysis.md` + `ui-page-gap-register.xlsx`); flag now awaits Davin's triage only | Session 6-1 re-verifies the census against live code, assigns each row a target session, and obtains the build / internal-only / out-of-scope triage                                                                                                                                                  |
| F61 | 6.8     | `GET /api/geo/detect` is called by `app/(marketing)/pricing/page.tsx:155` and `components/payments/CountrySelector.tsx:69` but **the route does not exist** — 404 on every pricing load                               | Build the route, or delete both call sites and fall back to manual country selection. Affects checkout conversion. Owner: Davin. Due 6-8                                                                                                                                                              |
| F62 | 6.2     | Admin IA split across two incompatible trees: `app/(dashboard)/admin/*` (15 pages, guarded, has nav) and `app/admin/*` (8 pages, **no `layout.tsx` at all**). 19 of 23 admin pages unreachable from the admin nav     | Merge into one tree with one shell/guard/nav, or keep two and cross-link. Structurally hard to undo — decide before any admin surface is rebuilt. Owner: Davin. Due 6-2                                                                                                                               |
| F63 | 6.8     | Public legal pages (`/terms`, `/privacy`, `/disclaimer`) do not exist; the registration consent checkbox links to two of them. `/disclaimer` is compliance-relevant for a trading product                             | Davin supplies real legal copy, or 6-10 ships reviewed placeholders. Blocks Session 6-10. Owner: Davin                                                                                                                                                                                                |
| F12 | general | Sizing: money blueprint says ~7–9 weeks for its Phase 1 alone; whole-plan duration not estimated here                                                                                                                 | Estimate per phase after F1–F5 resolve; treat any dates as provisional                                                                                                                                                                                                                                |
| F13 | CC-B    | Tracing/observability backend not chosen (needs Railway+Vercel-friendly OpenTelemetry sink)                                                                                                                           | Evaluate current options (e.g. Grafana Cloud, Axiom, Sentry) at implementation time; pick one, wire OTel SDK in both Nest services + Next.js                                                                                                                                                          |
| F14 | CC-C    | Money→core tier-update path: direct internal call vs transactional outbox                                                                                                                                             | Recommended: outbox (event row written in same DB tx, relayed via BullMQ) — verify against blueprint slice 5 mechanics before building                                                                                                                                                                |
| F15 | CC-E    | Redis topology: one shared Railway Redis vs per-service instances                                                                                                                                                     | Default: one instance, per-service key prefixes + separate BullMQ queue namespaces; split only on measured contention                                                                                                                                                                                 |
| F16 | CC-D    | Public URL scheme + API versioning (`api.<domain>/v1` vs per-service subdomains) unspecified in any source doc                                                                                                        | Decide before first Phase 4 cutover — the OpenAPI spec and frontend env vars must encode it once, not twice                                                                                                                                                                                           |
| F17 | CC-A    | Staging data strategy (seeded synthetic vs anonymized production subset)                                                                                                                                              | Decide before slice 1 shadow-runs; money data must never be copied to staging unmasked                                                                                                                                                                                                                |
| F18 | CC-G    | RPO/RTO targets never stated for this SaaS                                                                                                                                                                            | Owner decision (Davin): set targets, then verify Railway backup cadence + restore rehearsal meets them                                                                                                                                                                                                |
| F19 | 2.0     | Prisma upgrade to **7.8.0** crosses two majors (5→6→7); breaking-change list post-cutoff for plan author                                                                                                              | Verify 7.8.0 on npm (F2-style); read official Prisma 6 & 7 upgrade guides; audit client output/ESM, removed previewFeatures, PgBouncer/`directUrl` semantics, `$use`→client extensions, Decimal/JSON typings in money code, Node minimums; re-verify pooler (1.4) and F5 layout choice under Prisma 7 |

---

### Flags added 2026-08-20 (F65–F74) — Phases 9–15

| #       | Phase | Flag                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Resolution required                                                                       |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **F65** | 9     | BFF boundary: does the browser keep calling monolith `app/api/**`, or eventually call the services directly? §10's 8.1 assumes the latter; F45/F30 and Session 7-1's server-only `lib/api/index.ts` assume the former                                                                                                                                                                                                                                      | Session 9-0 — NEEDS EXPLICIT SIGN-OFF; gates 8.1's deletion list and Phase 9's data layer |
| **F66** | 9     | Frontend swap mechanism (big-bang branch vs progressive per-surface) and how far the "Trading Alerts" → "DavinTrade" rename reaches (titles, emails, legal copy, Stripe product names, manifest, OG images)                                                                                                                                                                                                                                                | Session 9-0                                                                               |
| **F67** | 10    | Where the drawing-alert live smoke test runs — never executed; the 2026-07-05 attempt had no Docker, no root and an unreachable Railway Postgres                                                                                                                                                                                                                                                                                                           | Session 10-1                                                                              |
| **F68** | 11    | The Parts 02–33 tier access matrix — redefines FREE/PRO entitlements on a product with paying users                                                                                                                                                                                                                                                                                                                                                        | Session 11-1 — NEEDS EXPLICIT SIGN-OFF; cross-check against live Stripe entitlements      |
| **F69** | 12    | Stack D LLM provider, model and monthly cost ceiling, plus the behaviour when the ceiling is hit                                                                                                                                                                                                                                                                                                                                                           | Session 12-0 — NEEDS EXPLICIT SIGN-OFF (money-adjacent, §7)                               |
| **F70** | 12    | VANNA / txtai runtime host (Contabo next to MT5 vs new Railway service vs in-process) and which DB role reads `market_data_v6` — Phase 1's fences give `core_app` no market-data grant                                                                                                                                                                                                                                                                     | Session 12-0                                                                              |
| **F71** | 13    | Stack E generation mechanism: PL/pgSQL trigger on `market_data_v6` (owned by `railway-gateway`, written by `gateway_ingest`, on the must-never-blip ingest path) vs application-side generation vs a side table                                                                                                                                                                                                                                            | Session 13-0 — NEEDS EXPLICIT SIGN-OFF; entry criterion 8.2 CLOSED                        |
| **F72** | 14    | Contabo chat stack scope: domain + TLS, whether NLLB-200 ships in v1, **what the bot worker uses for AI now that Phase 12 runs AFTER Phase 14** (own minimal LLM call metered via 11-3's `trackAiTokenUsage()` then re-pointed at Phase 12's router · rule-based FAQ + human handoff in v1 · or defer the bot container) — amended 2026-08-30 for the reorder, and socket authentication — the hand-off spec's `client_message` carries no identity at all | Session 14-0                                                                              |
| **F73** | 15    | Mobile distribution (direct APK vs Play Store), FCM project ownership and key storage, iOS via PWA vs paid Apple account                                                                                                                                                                                                                                                                                                                                   | Session 15-0                                                                              |
| **F74** | 11    | Payment currency wiring (language hand-off §6.D, deferred 2026-08-19) — requires per-currency Stripe Price objects, a product-catalog decision                                                                                                                                                                                                                                                                                                             | Session 11-1 — NEEDS EXPLICIT SIGN-OFF                                                    |

---

## 12. Source Document Map

| Topic                                                       | Authoritative source                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-file stack assignment (what goes where)                 | `docs/migration-orders/migration-stack-analysis.md`                                                                                                                   |
| Money-service extraction (scope, slices, DB phases, sizing) | `davintrade-part-12-17-18-19-stack/money-service-migration-blueprint.md`                                                                                              |
| NestJS-on-Railway reference implementation                  | `railway-gateway/` (read first)                                                                                                                                       |
| Stack A link roadmap (8-step module-by-module pattern)      | `monolith-to-microservice-architecture-uionly-stack-a-b-c/microservice-architecture/migration-roadmap-to-link-backend-stack-a-and-frontend-ui-only-stack-together.md` |
| Hybrid JWT auth concept + patterns                          | `backend-stack-a/hybrid-authentication-for-backend-stack-a/JWT-BASED-FOR-HYBRID-AUTHENTICATION-ARCHITECTURE.md`                                                       |
| JWT vs session rationale                                    | `backend-stack-a/hybrid-authentication-for-backend-stack-a/RATIONALES-FOR-JWT-BASED-AUTHENTICATION.md`                                                                |
| Auth decisions (OpenAuth, Prisma refresh tokens, sequence)  | `backend-stack-a/hybrid-authentication-for-backend-stack-a/SUMMARY_hybrid-jwt-based-authentication-clarification-and-implementation.md`                               |
| DB two-domain split                                         | `migration-stack-analysis.md` §Database Architecture + `monolith-to-microservice-architecture-uionly-stack-a-b-c/separation-of-postgresql-to-two-database.md`         |
| Bundle/font/streaming optimization for the v16 upgrade      | `bundle-size-optimization/**`, `frontend/FONT-OPTIMIZATION-IN-NEXTJS.md`, `frontend/STREAMING-IN-NEXTJS.md`, `frontend/STEP-4-FRONTEND-OPTIMIZATION-*.md`             |
| Stack categorization rules                                  | `monolith-to-microservice-architecture-uionly-stack-a-b-c/separation-between-frontend-and-backend/stack-categorization-reference-guide.md`                            |
| Realtime delivery + queue scaling                           | `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md`, `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md`                                                                             |

---

## 13. Track CC — Cross-Cutting Engineering Foundations (added v1.1)

These are not a ninth phase — they run **alongside** Phases 0–8. Without them the migration can
"succeed" per-phase and still produce a fragile distributed system. Each sub-track lists when it
must be live.

### CC-A Environments & CI/CD _(start: Phase 0 · must be live: before first Phase 4 cutover)_

- **Staging environment** mirroring production topology: Railway environment (or project) with
  staging Postgres + PgBouncer + Redis + both Nest services; Vercel preview branch pinned to the
  staging API URLs. Every strangler slice is exercised in staging before its production
  shadow-run — shadow-running against production only is not a substitute (🚩 F17: staging data
  strategy).
- **Per-service CI pipelines.** The 11 existing `.github/workflows/*` are monolith-shaped. Split
  into: monolith/frontend pipeline (existing, trimmed as routes retire), `operation-service`,
  `money-service` pipelines (lint → unit → contract test → deploy). Path-filter triggers so a
  frontend commit doesn't redeploy backends.
- **Continuous contract testing.** The Phase 0 OpenAPI specs become executable: run a
  schema-conformance job (e.g. Schemathesis/Dredd-class tool — pick current best) against each
  service on every PR. This turns "drop-in replacement" from a one-time shadow-run claim into a
  permanently enforced invariant, and catches drift long after Phase 4 ends.
- **DB migration automation with expand/contract discipline.** `prisma migrate deploy` runs as a
  release step against the DIRECT connection, and destructive changes (drop column/table) are
  never shipped in the same release as the code change that stops using them — expand → deploy →
  contract. This is what makes zero-downtime deploys safe once two services share the instance.

### CC-B Observability _(start: Phase 3 · must be live: before first Phase 4 cutover)_

- **Correlation IDs end-to-end.** Generate a request ID at the edge (Next.js middleware),
  propagate via header frontend → service → service, and into BullMQ job payloads so a fired
  alert or webhook can be traced across process boundaries. One shared pino log schema
  (service, requestId, userId-hash, route, latency) across all services.
- **Distributed tracing.** OpenTelemetry SDK in both Nest services and Next.js instrumentation
  (🚩 F13: choose the sink). Without tracing, debugging a 3-service request path degenerates to
  log archaeology — this is the single highest-leverage addition for operating the split system.
- **Alerting baseline.** Extend the money blueprint's thresholds (failed transactions >5/24h,
  webhook silence >24h) to operation-service equivalents: alert-engine queue depth, alert
  dispatch latency, websocket connection error rate, auth failure spike (possible attack),
  Postgres connection saturation via PgBouncer stats, Redis memory. Route to email/Slack.
- **Client-side error tracking** (Sentry-class) on the frontend, tagged with the same
  correlation ID, so UI-visible failures map to backend traces.

### CC-C Resilience & inter-service communication _(design: Phase 0 · enforced: throughout Phase 4)_

- **Explicit timeout/retry/circuit policy** for every network hop. Suggested defaults (tune in
  staging): SSR → service 2s timeout, 1 retry on idempotent GET only; browser → service 10s;
  service → service 3s with exponential backoff ×3; circuit-breaker (or minimum: fail-fast +
  cached fallback) on the frontend data layer so one slow service degrades one panel, not the
  whole dashboard. Codify in the Phase 6 interim fetch wrappers and inherit into the Phase 7
  unified client.
- **Idempotency everywhere writes cross a boundary.** The gateway's upsert-on-natural-key
  pattern is the house style — extend it: idempotency keys on money write endpoints
  (Stripe/dLocal create, batch execute), dedupe tables for all webhook processors (the
  `RiseWorksWebhookEvent` model is the template — verify Stripe/dLocal have equivalents, add if
  not), and BullMQ job IDs derived from business keys so retries never double-fire alerts or
  payouts.
- **Tier-update consistency (money → core).** Blueprint slice 5 ends direct Subscription reads;
  the replacement event path is a classic dual-write hazard (payment committed but tier-update
  call lost). 🚩 F14: use a transactional outbox — event row written in the same Prisma
  transaction as the payment, relayed to core via BullMQ with at-least-once delivery + core-side
  idempotent apply. Reconciliation cron compares Subscription vs User.tier nightly and alerts on
  drift.
- **Graceful shutdown.** Nest `enableShutdownHooks()`, drain BullMQ workers on SIGTERM, close
  Prisma/Redis cleanly — Railway redeploys will otherwise sever in-flight batch payouts.

### CC-D API edge, versioning & security hardening _(decide: Phase 0 · applied: Phase 4 onward)_

- **URL scheme + versioning decided once** (🚩 F16). Recommended: `api.<domain>/v1/...`
  (operation) and `money.<domain>/v1/...` (or one gateway host routing by path) with the `/v1`
  prefix from day one — retrofitting versioning after clients exist is a breaking change by
  definition. Custom domains + TLS on Railway; Vercel env vars carry only these two base URLs.
- **Rate limiting in both services**, not just money: `lib/rate-limit.ts` is filed under
  BUSINESS FUNCTION in the stack analysis, but auth endpoints (login, refresh, register) and
  alert CRUD need it equally. Nest `ThrottlerGuard` backed by Redis, shared config module in
  both services; strictest tiers on `/auth/*`.
- **Uniform hardening:** helmet, class-validator DTOs generated from the OpenAPI spec (requests
  rejected at the edge, not in service code), body-size limits, and the existing
  `dependencies-security.yml` / `security-checks.yml` workflows extended to the two new
  services. Secret rotation procedure documented per service (JWT keys per F7, `SVC_TOKEN`,
  provider keys).

### CC-E Redis & queue topology _(decide: Phase 1 · live: with first queue consumer in Phase 4)_

🚩 F15. Default: **one Railway Redis instance** shared by both services with disciplined
namespacing — `op:*` / `money:*` key prefixes, BullMQ queue names `op.alerts.dispatch`,
`money.disbursement.execute`, etc. Rationale: matches the auth decision that Redis is off the
auth critical path (so load is queue/cache only), keeps cost flat, and the namespace convention
makes a later physical split a config change, not a refactor. Split when monitoring (CC-B) shows
contention, not before. Document queue ownership: exactly one service consumes each queue.

### CC-F Development workflow during the migration _(policy: Phase 0 · enforced: Phases 4–7)_

- **Trunk-based + feature flags** (the env flags already specified per slice) rather than
  long-lived migration branches — a months-long migration branch will rot against ongoing work.
- **The drift-freeze rule:** the moment a slice enters shadow-run, its legacy Next.js
  implementation is change-frozen. Bugfixes during the window must be applied to **both** old
  and new implementations or the shadow-diff becomes noise. New features in a frozen slice wait
  for cutover.
- **The cutover table is the single source of truth** (already mandated in Phase 4): one
  committed markdown/CSV table — route, slice, flag name, shadow-run start, cutover date,
  rollback tested? — updated in the same PR as each cutover.

### CC-G Backup, DR & runbooks _(rehearse: before Phase 1.1 · complete: Phase 8)_

- **Restore rehearsal before anything moves:** take a Railway backup, restore to a scratch
  instance, verify row counts + app boots against it. Do this BEFORE the Phase 1.1 relocation
  (if any) — an untested backup is a hope, not a plan. 🚩 F18: set explicit RPO/RTO targets.
- **Per-service runbooks** committed to `docs/runbooks/`: start/stop/redeploy, env var matrix,
  rollback procedure (per slice during migration; per release after), and incident playbooks
  for the known failure modes — webhook outage (replay procedure), BullMQ backlog, PgBouncer
  pool exhaustion, Contabo→gateway ingest gap (market-data staleness).
- **Dead-letter handling:** every BullMQ queue gets a DLQ + alert; a stuck disbursement must
  page, not silently retry forever.

### CC-H Cost & capacity _(estimate: Phase 1 · verify: Phase 8 load test)_

Enumerate the target monthly Railway bill before committing topology: 2 Nest services (min 1
replica each, always-on) + Redis + Postgres + PgBouncer + existing railway-gateway; plus
Vercel. Use the Phase 8 load test to size replicas/pool numbers instead of guessing. If cost
pressure appears, the correct lever is replica sizing — not merging the services back together.

### CC-I Local development experience _(build: Phase 0 · maintain: throughout)_

One root `docker-compose.dev.yml` that boots Postgres (+ roles script from Phase 1.3),
PgBouncer, Redis, operation-service, money-service, and the Next.js dev server with seeded
non-market data — so any slice can be developed and its shadow-diff reproduced offline. Per
service: `.env.example` kept authoritative (CI check that it stays in sync with the secret
matrix from Phase 0.4). Without this, every contributor (including Claude Code sessions)
re-derives environment setup from scratch and the migration slows to a crawl.

### Where Track CC gates the phases

| Phase gate                                | Must be live first                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Phase 1.1 data relocation (if any)        | CC-G restore rehearsal                                                                     |
| First Phase 4 shadow-run                  | CC-A staging + contract-test CI; CC-B correlation IDs + alerting; CC-F drift-freeze policy |
| First Phase 4 write-API cutover (slice 4) | CC-C idempotency + outbox decision (F14); CC-D rate limits on new endpoints                |
| Phase 6 data layer                        | CC-C timeout/retry policy codified                                                         |
| Phase 8 sign-off                          | CC-G runbooks complete; CC-H verified against load test                                    |

---

**Status:** v1.3 (2026-08-20, PROPOSED) — v1.2's sequencing blueprint + cross-cutting engineering
track + Prisma 7.8.0 upgrade step (2.0), **extended by Phases 9–15 and the Phase 8 split**
recorded in `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md`. Flag register now F1–F74.
Phases 9–15 are product stacks built on the migrated architecture, not migration steps — they
run through the same three-role chain and the same order lifecycle.
