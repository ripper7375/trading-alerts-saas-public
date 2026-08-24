# Migration Order — Session 8-2 — Gateway Deployment & Schema Dedup

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (INFRA variant:
> the end-state, grants, and names are fixed by the plan; the deployment approach is flexible).
> **PRE-DRAFTed by the Executor at Session 8-1's close (2026-08-24)**, upgraded to **DRAFT by the
> Advisor / Antigravity (2026-08-24)** per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A" and `00-SKELETON-AND-RULES.md`.
> **MANDATORY INVARIANT (`EXECUTOR-PROTOCOL.md` §5):** The ingest path must **NEVER BLIP**. Each step
> below explicitly states how ingest continuity is preserved without interruption.

**Session:** 8-2 · **Phase:** 8A (Decommission, part 2 — final session of Phase 8A) · **Variant:** INFRA · **Status:** CONFIRMED  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-24 (Advisor / Antigravity) · **Approved:** 2026-08-24 (Davin) · **Confirmed:** 2026-08-24 (Executor)  
**Flags touched:** none (INFRA deployment & schema dedup; no runtime feature flag needed).  
**Estimated time:** ~2–3h (staged deployment on `postgre for staging`, initial production deployment as a new service, live ingest verification).  
**Target components:** `railway-gateway/` (package.json, Prisma schema, NestJS config), `money-service/src/main.ts` (deferred CORS comment cleanup), `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md`.

---

## Decisions taken

> Four technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> Items touching production deployment of the live market data ingest pipeline carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **Schema Source-of-Truth & Deduplication Architecture**
   - **Chosen:** Establish `prisma/market-data/schema.prisma` (root monolith) as the single authoritative source of truth for the physical PostgreSQL `market_data_v6` table migrations. Retain `railway-gateway/prisma/schema.prisma` as the service-local definition for generating its isolated `@prisma/client` (`railway-gateway/node_modules/.prisma/client`), and add an automated schema drift test (`railway-gateway/test/schema-sync.spec.ts`) that asserts byte-for-byte model equivalence across the 79 fields, indices, and constraints.
   - **Rejected:** Creating a complex shared monorepo npm package under `packages/*` for a single-table schema (adds packaging overhead and Docker build friction without operational gain), or symlinking files (fails in standard Railway Docker builds).
   - **Why:** Maintains service build isolation for Railway deployments while programmatically guaranteeing zero schema drift between the monolith migration manager and the gateway writer.
   - **How hard to undo:** Trivial — plain test and schema comment convention.

2. **Prisma Version Alignment to Monorepo Standard (`7.9.1`)**
   - **Chosen:** Upgrade `railway-gateway`'s `prisma` and `@prisma/client` dependencies from `^6.19.2` to **`7.9.1`**, matching the exact pinned version used across the rest of the monorepo (`operation-service`, `money-service`, monolith). Verify that `railway-gateway`'s schema conforms to Prisma 7 syntax and that `prisma generate` compiles cleanly.
   - **Rejected:** Pinning to `7.8.0` (outdated playbook placeholder) or leaving `railway-gateway` on Prisma 6.
   - **Why:** Prevents multi-version engine drift and aligns driver/engine behavior across all services connecting to the shared PostgreSQL database.
   - **How hard to undo:** Dependency version change in `package.json`.

3. **Initial Gateway Deployment & Staging-First Verification Protocol `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Execute a strict staging-first pipeline for this initial `railway-gateway` deployment:
     1. Deploy `railway-gateway` to the **`postgre for staging`** Railway project first (initial staging deployment).
     2. Send synthetic market data test vectors (`gateway_contract_market_data.schema.json`) to staging `railway-gateway`'s `POST /api/v1/market-data` and verify idempotent upsert into staging `market_data_v6`.
     3. Davin provides explicit live authorization (`EXECUTOR-PROTOCOL.md` §7) before deploying to production.
     4. Deploy `railway-gateway` to the production Railway project (`trading-alerts`) as a new microservice.
     5. Verify production `railway-gateway` `GET /health` returns `200 OK`, and verify successful test vector ingest into production `market_data_v6`.
   - **Rejected:** Deploying directly to production without staging validation.
   - **Why:** Safely introduces the new `railway-gateway` service into the production Railway infrastructure after proving it in staging.
   - **How hard to undo:** Plain removal/deletion of the newly deployed Railway service.

4. **Residual Cleanup & Phase 11 Handover Generation**
   - **Chosen:** Clean up the stale `NEXT_PUBLIC_MONEY_API_URL` CORS comment in `money-service/src/main.ts:35` (deferred from Session 8-1), and author the Phase 11 Handover Prompt (`docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md`) to formally unblock Phase 11 (Tier Matrix & Access Control).
   - **Rejected:** Leaving stale architectural comments or deferring handover creation.
   - **Why:** Keeps codebase documentation accurate and fulfills Phase 8A exit requirements.
   - **How hard to undo:** Plain file edits.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A":
"8-2 — Gateway deployment & schema dedup. Deploy railway-gateway to `postgre for staging`, point at shared market-data schema, align Prisma to repo standard, verify ingest."

This is Phase 8A's second and final session, closing Phase 8A (Decommission) in full and satisfying the mandatory prerequisite for **Session 13-1** (which attaches a PL/pgSQL trigger to the deduplicated `market_data_v6` schema) and unblocking **Phase 11** (Tier Matrix Decision & Types).

---

## Ingest Safety & Deployment Strategy (`EXECUTOR-PROTOCOL.md` §5)

To guarantee safe deployment of the new gateway service:

1. **Isolation in Staging:** Steps 1–3 run locally and on the staging Railway project (`postgre for staging`). Zero production network requests or database connections are touched.
2. **Initial Deployment Footprint:** Because `railway-gateway` is being deployed to Railway for the first time, no existing live container or running process is interrupted.
3. **No Database Schema Alterations:** This session makes zero DDL changes to the live `market_data_v6` table. The Prisma 7 client generates against the existing table schema.
4. **Immediate Health & Ingest Verification:** Post-deploy health check (`GET /health` → `200 OK`) and test vector upsert confirm gateway readiness.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 8-1 (Deletion Sweep) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [x] **Railway CLI authenticated**: `railway whoami` succeeds and `postgre for staging` is accessible.
- [x] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 150/150 suites, 2176/2176 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 532/532 tests (one `prisma.shutdown.spec.ts` timeout under concurrent 3-suite load, isolated re-run clean in 24.6s — the same benign flake as L24/8-1's CONFIRM).
- [x] **Blast-radius confirmed**: `railway-gateway` is not deployed to any Railway project in this account today (verified live across all 5 projects at CONFIRM) — this is a first deployment, not a redeploy; zero live production processes are interrupted by construction.
- [x] **Davin present and available** for Step 4 production deploy sign-off — given live in chat at CONFIRM, ahead of reaching Step 4.

---

## Ordered Steps

_(each step = change → immediate verification → rollback note)_

### Step 1: Align Prisma Version & Add Schema Drift Test in `railway-gateway`

- **Action:**
  1. In `railway-gateway/package.json`:
     - Update `"@prisma/client": "7.9.1"` and `"prisma": "7.9.1"` in dependencies/devDependencies.
  2. Run `npm install` in `railway-gateway/` and `npm run prisma:generate`.
  3. Create automated contract test `railway-gateway/test/schema-sync.spec.ts` asserting `railway-gateway/prisma/schema.prisma` matches `prisma/market-data/schema.prisma` field-for-field.
  4. In `money-service/src/main.ts:35`: clean up the stale `NEXT_PUBLIC_MONEY_API_URL` CORS comment.
- **Safety Guarantee:** Local files only; zero production impact.
- **Verify:** Run `pnpm --filter railway-gateway test` (all tests pass, including schema sync).
- **Rollback:** `git checkout -- railway-gateway/ money-service/src/main.ts`.

### Step 2: Build & Local Validation

- **Action:**
  - In `railway-gateway/`: run `npm run build` (`nest build`).
  - Run full monorepo test suites: monolith `test:ci`, `operation-service`, `money-service`, and `railway-gateway`.
- **Safety Guarantee:** Local build only; zero production impact.
- **Verify:** `railway-gateway/dist/main.js` builds cleanly with exit code 0.
- **Rollback:** None.

### Step 3: Deploy & Verify on Staging (`postgre for staging`)

- **Action:**
  - Link and deploy `railway-gateway` to Railway project `postgre for staging`.
  - Execute synthetic test vector payload against staging `POST /api/v1/market-data`.
- **Safety Guarantee:** Targeted entirely at staging infrastructure; production pipeline runs untouched.
- **Verify:**
  - Staging `railway-gateway` `GET /health` returns `200 OK`.
  - Staging `market_data_v6` table records the test row upsert.
- **Rollback:** Remove service deployment via Railway CLI/dashboard.

### Step 4: Production Deployment `⚠ NEEDS EXPLICIT SIGN-OFF`

- **Action:**
  - Davin provides live authorization (`EXECUTOR-PROTOCOL.md` §7).
  - Deploy `railway-gateway` service to production Railway project (`trading-alerts`).
- **Safety Guarantee:** Deploys as a new service alongside existing microservices; zero existing services touched.
- **Verify:**
  - Production `railway-gateway` `GET /health` returns `200 OK`.
- **Rollback:** Remove service in Railway project if health check fails.

### Step 5: Live Ingest Proof & Health Verification

- **Action:**
  - Send authenticated test market data payload to production `railway-gateway` `POST /api/v1/market-data`.
  - Query production `market_data_v6` table to confirm the row upsert landed successfully.
  - Verify Redis `prices:XAUUSD:M5` and WebSocket channel continue streaming uninterrupted.
- **Safety Guarantee:** Isolated test payload verification; zero regression to existing feeds.
- **Verify:** Ingest HTTP endpoint returns `201 Created` with valid payload response, test row present in DB.
- **Rollback:** Remove service deployment if errors occur.

### Step 6: Session Close-Out & Phase 11 Handover Generation

- **Action:**
  - Author `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md`.
  - Update `CLAUDE.md`: Current entry Session 8-2 CLOSED SUCCESSFUL, Phase 8A **CLOSED SUCCESSFUL**.
  - Update `migration-stack-analysis.md`: Add Session 8-2 entry.
- **Safety Guarantee:** Documentation updates only.
- **Verify:** Git working tree clean, all 3 monorepo suites green.
- **Rollback:** None.

---

## Rules specific to this variant

- **Never break the always-on ingest:** Staging must succeed before production is touched.
- **Nothing dashboard-only:** All configurations and schema sync rules committed in repository.
- **Zero DDL migrations on production during this session:** The physical database schema is unchanged.

---

## Done when

- [ ] `railway-gateway` Prisma upgraded to `7.9.1` and schema sync test passing.
- [ ] `railway-gateway` deployed and verified on `postgre for staging`.
- [ ] `railway-gateway` deployed to production with zero ingest downtime.
- [ ] Ingest verified live via `market_data_v6` row count and Redis feeds.
- [ ] Stale CORS comment in `money-service/src/main.ts` cleaned up.
- [ ] `HANDOVER-PROMPT-phase-11.md` authored.
- [ ] Phase 8A declared **CLOSED SUCCESSFUL**.
- [ ] Baseline test suites 100% green.

---

## Rollback

- **Staging:** `railway rollback` on `postgre for staging`.
- **Production:** `railway rollback` to previous container deployment.
- **Code:** `git revert` Step 1 commits.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

**CONFIRM-time findings (2026-08-24):**

1. **L3 recurrence:** at CONFIRM, committed HEAD (`c2fc1135`) held this order at `Status: PRE-DRAFT`
   with 3 unresolved "Decisions needed" and stub Ordered Steps/Rollback; the working copy was
   already rewritten to `APPROVED` with a full Decisions-taken section, zero corroborating record
   in `DECISION-LOG.md` or `CLAUDE.md`, and no intermediate commit for either transition. Surfaced
   directly rather than trusted; Davin confirmed live in chat it is authentic.
2. **Order's original zero-blip framing contradicted live infrastructure — corrected before
   CONFIRM, not after.** The as-drafted Decision 3/Steps 3–5 assumed `railway-gateway` was already
   deployed and live in production, requiring a rolling zero-downtime redeploy. A live audit of all
   5 Railway projects in this account (`prisma-migration`, `postgre for staging`, `trading-alerts`,
   `zoological-motivation`, `feisty-amazement`) found **no service named `railway-gateway`/`gateway`
   anywhere** — consistent with `migration-cutover-table.md`'s own Slice 12 note (2026-08-02) that
   this was "a separate, still-open question," and with `railway-gateway/README.md`'s own framing of
   deployment as a not-yet-done "operator runbook." `migration-stack-analysis.md`'s claim that it's
   "already deployed" (dated 2026-07-11) is stale. Davin confirmed live: this is genuinely an
   initial deployment; live alert-relevant price data flows via Redis channels directly today,
   `market_data_v6` has not yet received live Railway Gateway writes. The Advisor updated Decision
   3/Steps 3–5 accordingly before this order reached CONFIRMED; re-verified consistent at CONFIRM.
3. **Secret exposure, not repeated:** checking Railway CLI link state, `cat ~/.railway/config.json`
   printed this environment's real Railway `accessToken`/`refreshToken` into the session transcript
   (`LESSONS-LEARNED.md` L4 territory — a different credential than L4's own `railway variables`
   case, same handling: disclosed to Davin immediately, not reproduced, rotation is his call).
4. **Step 1's own verify command is wrong, corrected at execution:** the order says
   `pnpm --filter railway-gateway test`, but `railway-gateway` is not a pnpm workspace member
   (`pnpm-workspace.yaml` lists only `packages/*` and one `seed-code/` path) — used
   `cd railway-gateway && npm test` instead, matching how `operation-service`/`money-service` are
   run elsewhere in this protocol.
5. **Prisma 7 requires a driver adapter; `railway-gateway`'s schema/PrismaService needed real code
   changes beyond the version bump, not just `package.json`.** `prisma generate` failed outright
   (`P1012`: `datasource.url` no longer supported in schema files). Removed `url` from
   `railway-gateway/prisma/schema.prisma`'s datasource block (matching the monolith's own schema)
   and added `@prisma/adapter-pg@7.9.1` + a `PrismaPg` adapter in `railway-gateway/src/prisma/
prisma.service.ts`, mirroring money-service's own established pattern exactly (no `ssl` override —
   money-service's own comment documents PgBouncer's internal listener rejecting TLS outright).
   In scope: Decision 2 itself says "verify... `prisma generate` compiles cleanly."
6. **First staging deploy attempt failed: wrong upload source.** `railway up --service
railway-gateway` was run from the repo root (a stale shell cwd from Step 2's baseline runs), so it
   uploaded and tried to build the whole monorepo instead of `railway-gateway/`. Fixed by chaining
   `cd` into the same command; re-run confirmed the correct directory via a literal `pwd` in the
   same invocation.
7. **Second attempt failed for a real reason: Prisma 7.9.1 requires Node ≥20/22.12/24, and
   `railway-gateway/package.json` had no `engines` field** — Nixpacks defaulted to Node 18.20.5 and
   `npm ci` hard-failed on Prisma's own preinstall check. The other three services all declare
   `"engines": {"node": ">=20.0.0", "npm": ">=9.0.0"}`; added the identical field to
   `railway-gateway/package.json`. A direct, necessary consequence of Decision 2's own Prisma bump,
   not scope creep.
8. **Third attempt failed for a real reason: `railway-gateway` had no `postinstall` script, so
   Railway's `npm ci` never ran `prisma generate`** — `nest build` failed with `TS2305: Module
"@prisma/client" has no exported member 'PrismaClient'` (5 errors, everywhere the generated
   client is referenced). Latent since `railway-gateway` had never actually been built on Railway
   before (first deployment, per Decision 3). `operation-service`/`money-service` both already run
   `"postinstall": "prisma generate"`; added the identical script. Verified locally end-to-end
   (`rm -rf node_modules/.prisma && npm run postinstall && npm run build && npm test`) before
   redeploying — 3/3 suites, 23/23 tests, clean build.
9. **First live health check (staging) surfaced a real Redis connectivity defect, not a deploy
   config gap: `railway-gateway`'s own `BullModule.forRoot({ redis: { host, port, password } })`
   (separate `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` fields) could not reach Railway's managed
   Redis reliably** — `GET /api/v1/health` intermittently returned `degraded` (`redis`/`queue`:
   `"Reached the max retries per request limit (which is 20)"`) or hung past 20s with zero bytes
   received, while `database: up` (30ms) proved the Postgres side and the variable-reference
   mechanism both worked correctly. `operation-service` — the only other Redis consumer live on
   this Railway account — exclusively builds every Redis client from a single `REDIS_URL`, never
   separate host/port/password fields. Switched `railway-gateway/src/app.module.ts`'s
   `BullModule.forRoot` to `redis: process.env['REDIS_URL']` (Bull's own `redis` option accepts a
   connection string), updated `.env.example` and `test/local-e2e-harness.md` to match, and
   re-pointed the staging service's variable from `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` to a
   single `REDIS_URL` reference. A real, pre-existing code defect in never-before-deployed code —
   not scope creep, and squarely inside Decision 3's own "verify ingest" mandate.

---

## Next-session handoff

- **Next session:** `11-1` — Tier matrix decision + types/config (Phase 11, first of 3 sessions).
- **Prerequisite:** Session 8-2 CLOSED SUCCESSFUL (Phase 8A closed).
- **Handover Prompt:** `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md` (authored in Step 6).
