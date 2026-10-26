# Database Scaling Second Wave Manifest — Work Completion Report

**Date:** 2026-10-24 (executed across 2026-10-23 to 2026-10-24)  
**Status:** Units R, U, P-operation, and F4 of the Database Scaling Second Wave are code complete, verified against local live fixtures, and committed locally to `main` (`d92517d7..d0944271`). P-gateway and P-money are **deferred by decision** (§7). **Nothing is pushed or deployed to production yet** because local `main` currently sits on top of unpushed Manage Subscription S1–S4 commits (`48bf2bcf..9b40bf3d`), whose additive database migration (`20261021000000_add_subscription_management_fields`) must be applied to the production database before any deployment (§5). Nothing was applied to production by the Executor: no migration, no DDL, no schema change.  
**Type:** Ad-hoc sessions (Davin-requested directly in chat, executed one unit at a time in fresh Claude Code sessions per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6, advised by Antigravity). Each unit followed the order lifecycle `PRE-DRAFT` (Executor) → `DRAFT` (Advisor, Antigravity) → `APPROVED` (Davin, with explicit sign-offs for R D1, U D1, and F4 D1) → `CONFIRMED` (Executor, after re-verifying code and live fixtures) → executed. Recorded in dedicated session entries in `.claude/state/current-state.md` and rotated into `history/2026-10-sessions.md`.

> **Scope note:** this document covers the implementation of the second-wave quick wins defined in
> [`davintrade-database-scaling/database-scaling-second-wave-architecture.md`](database-scaling-second-wave-architecture.md) and
> [`davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md`](database-scaling-second-wave-implementation-plan.md):
> **Unit R** (Redis background recovery, root monolith), **Unit U** (live-row upsert returning ID only, `railway-gateway`),
> **Unit P-operation** (finite 2,000 ms pool checkout and connect deadline, `operation-service`), and **Unit F4** (alert worker watch reload rejection catch, `operation-service`).
> It does not cover Unit P-gateway or Unit P-money (§7), any database schema change, or anything in `money-service/` or `frontend/`.

---

## 1. What was done

Five pieces of work, each verified and committed before the next began: a feasibility analysis and preflight, followed by four implementation units (each with its own migration order, live fixture, mutation check, evidence report, and scoped commit).

### 1.1 Starting point — feasibility analysis and decisions D1–D8

- **Feasibility analysis:** Claude Code inspected live driver implementations (`ioredis` 5.11.1, `pg-pool` 3.14.0, `@prisma/adapter-pg` 7.9.1, and Prisma interactive transaction defaults) against `main` at `e02c8b08` / `9b40bf3d`. All three architectural units were confirmed feasible as designed, requiring 1 to 5 lines of production code each.
- **Key preflight findings settled with Davin and the Advisor (Antigravity):**
  - **F1 & D1 (Unit R):** Redis recovery slow-fail vs permanent dead-client trade-off. Previously, after ~30–80 s of Redis outage, the client terminated permanently (`retryStrategy` returned `null`), requiring a process restart. With capped linear retry, each Redis command during an outage waits up to `commandTimeout` (3.0 s) before rejecting. Measured via local real-Redis fixture (T5 latency table) and **explicitly approved by Davin**.
  - **F5 & D2 (Gateway pool deadline):** Design's 5,000 ms candidate contradicted the monolith's 5 s read abort (`lib/active-indicator/gateway-client.ts`). A 5,000 ms pool wait would exhaust 100% of the caller's budget before running a single query. **Approved at 2,000 ms**, matching the other services.
  - **F3 & D3 (Scope):** `frontend/lib/redis/client.ts` was identified as a stale frozen copy with the same cutoff, but `frontend/` is `SEPARATE_STACK` per `EXECUTOR-PROTOCOL.md` §5 and ruled **out of scope**.
  - **F6 & D4 (Unit P-money):** Gated by missing financial authorization and overlapping with billing work. **Held back**.
  - **F7 & D5 (Fixtures):** Approved local test fixtures on random high ports: a real local `redis-server` 8.4.0 (Chocolatey) and scratch PostgreSQL 18.1 clusters (plain and TLS-enabled).
  - **D6 (Gateway install):** In-place `npm ci` approved in `railway-gateway/` with a zero-drift guarantee on `package.json` and `package-lock.json`.
  - **F8 & D8 (Stack D Step 2 ordering):** Ingestion tables (`market_data_v6`, `currency_gold_indices`, `indicator_statistics`) confirmed at 0 rows in production, and `deploy-stack-d-step2.md` not yet run. Unit U production observation ruled as **"pending go-live"**. P-gateway held until Step 2 runs live for at least one trading day.

---

### 1.2 Unit 1 — Unit R: Redis background recovery (root monolith)

- **Production change:** `lib/redis/client.ts`. Replaced `retryStrategy` cutoff (`times > 10 ? null : ...`) with a capped linear delay without cutoff: `(times: number): number => Math.min(times * 500, 30_000)`, and corrected the comment from "exponential backoff" to "capped linear delay, no retry-count cutoff". Delay progression: retry 1 → 500 ms, retry 11 → 5,500 ms, retry 60+ → 30,000 ms.
- **Invariants held:** Singleton instance, lazy connect (`lazyConnect: true`), `connectTimeout: 5000`, `commandTimeout: 3000`, `maxRetriesPerRequest: 3`, ready check enabled, offline queue enabled.
- **Real-Redis verification (T1–T6):** Gated fixture `__tests__/lib/redis/client-recovery.redis.spec.ts` executed against a real local `redis-server` 8.4.0 (random port 55432, persistence disabled, PID-managed):
  - **Unmodified client:** Failed 5 of 8 cases. Client died permanently after 11 attempts in status `end`; subsequent command rejected in 0 ms with "Connection is closed".
  - **Fixed client:** Passed **8 of 8 cases**. Survived 14 reconnect attempts and resumed normal operations (`PING`, `SET`, `GET`) without process restart.
  - **T5 Measured Outage Latency Table (D1):**
    - Market cache routes (`get` then `set` around loader): **6.0 s**
    - Engine4 submit (`claim` then `complete`/`release`): **6.0 s**
    - `validate-discount` (rate-limit pipeline): **3.0 s**
    - FX store and world-gold reads: **0.5 to 0.6 s** (bounded by their internal `Promise.race`)
    - Worst-case route (6.0 s) sits well inside the 15 s Vercel function timeout limit.
- **Unit test & mutation check:** `__tests__/lib/redis/client.test.ts` rewritten (14 tests). All 5 mutants killed. Restored byte-identical by SHA-256.
- **Committed locally:** `d92517d7`.

---

### 1.3 Unit 2 — Unit U: Gateway live-row upsert returns ID only (`railway-gateway`)

- **Production change:** `railway-gateway/src/worker/market-data.processor.ts:70-74`. Added `select: { id: true }` to `this.prisma.marketDataV6.upsert(...)`. The result was already discarded by the caller; the written columns, conflict target, create/update payloads, and job result `{ success: true }` are byte-identical.
- **In-place dependency installation:** Ran `npm ci` in `railway-gateway/`. Hashed before and after: `package.json` and `package-lock.json` stayed strictly byte-identical. Generated Prisma client in `railway-gateway/node_modules/.prisma/client`.
- **Compiled SQL probe:** Real processor executed over a fake driver before and after. Output compared across 299 bound parameters:
  - `RETURNING` clause dropped from **106 columns down to 1 column (`id`)**.
  - Synthetic test row payload shrunk from **495 bytes down to 25 bytes** (a 95% reduction on returned payload width).
  - No statements added or altered.
- **Gated row-parity fixture:** New `railway-gateway/test/market-data.processor.pg.spec.ts` ran the real processor twice (with and without `select`) over a 9-job sequence on a scratch PostgreSQL 18.1 cluster (port 55471):
  - Persisted rows in `market_data_v6` and `market_data_point_in_time` were equal column-for-column across all 20 parity assertions.
  - Point-in-time snapshot, forming bar handling, repeated cycle key updates, and Bull retry semantics preserved.
- **Unit test & mutation check:** `market-data.processor.spec.ts` updated (16/16 tests pass: 12 existing updated + 4 new). Mutation harness killed **7 of 7 mutants**.
- **Committed locally:** `ed4ca861`.

---

### 1.4 Unit 3 — Unit P-operation: Operation-service pool deadline (`operation-service`)

- **Production change:** `operation-service/src/prisma/prisma.service.ts:24`. Added `connectionTimeoutMillis: 2_000` to the `PrismaPg` configuration object. `ssl: { rejectUnauthorized: false }`, URL source, logging, and pool defaults (`max: 10`, `idleTimeoutMillis: 10_000`) remain unchanged.
- **Inventory deliverable (D6):** Documented all 13 read routes, 25 write routes, the outbox consumer, and 6 background worker paths, including all 6 interactive transaction sites.
- **Scratch TLS PostgreSQL verification:** Gated fixture `operation-service/src/prisma/prisma.pool.pg.spec.ts` ran against a scratch PostgreSQL 18.1 cluster configured with mandatory TLS (`ssl=on`, self-signed certificate, port 55471):
  - **Unmodified service:** Failed 3 of 8 cases (an 11th query on a saturated pool waited 3,853 ms; non-responding connect hung past 15 s; `maxWait: 10_000` transaction waited 4,009 ms).
  - **Fixed service:** Passed **8 of 8 cases**:
    - Pool saturation: 11th query failed cleanly at **2,039 ms** (no late insert).
    - Connection failure: rejected cleanly at **2,006 ms**.
    - Interactive transaction under saturation: failed at **2,010 ms** (no orphan backend or transaction left).
- **Outbox consumer spec:** Added test case in `outbox-consumer.service.spec.ts` proving that a checkout failure on user lookup results in an unhandled 5xx with no Redis claim taken and no email sent, allowing the publisher to safely retry.
- **Unit spec & mutation check:** `prisma.pool.spec.ts` (3/3 pass). Mutation harness killed **7 of 7 mutants**.
- **Committed locally:** `c4e3a494` (bundled with PRE-DRAFT order for F4).

---

### 1.5 Unit 4 — Unit F4: Alert worker watch reload rejection catch (`operation-service`)

- **Origin (Finding F4):** During P-operation verification, an unhandled promise rejection hazard was identified in `operation-service/src/alert-engine/alert-worker.service.ts:80-82`. The subscriber handled `'alerts:changed'` with `void this.reload()`. When pool checkout is bounded to 2 s, a saturated pool makes `reload()` reject after 2 s. Because `reload()` was called with `void` without a `.catch()`, Node.js 24 treated this as an unhandled rejection and terminated the worker process (`exit code 1`).
- **Owner decision (D1):** Approved explicitly by Davin. Replaced `void this.reload()` with:
  ```typescript
  this.reload().catch((error) =>
    this.logger.error('watch reload failed:', error)
  );
  ```
  _Trade-off accepted:_ A failed reload no longer crashes the worker process; it logs an ERROR and continues evaluating prices against the previous in-memory watch cache until the next `alerts:changed` event or restart.
- **Child-process probe:** Tested against the compiled service (`dist/alert-engine/alert-worker.service.js`) in a child Node process with stubs for Redis, Prisma, queue, and dispatcher:
  - **Unmodified code:** Exited with `code 1` upon first reload rejection.
  - **Fixed code:** Remained alive, logged `watch reload failed:`, preserved existing watch cache, and successfully replaced cache on subsequent valid event.
- **Unit spec & mutation check:** Added 2 new tests in `alert-worker.service.spec.ts` (10/10 pass). Mutation harness killed **7 of 7 mutants**.
- **Committed locally:** `035c2456`.

---

### 1.6 Evidence methods

- **Real Redis Server 8.4.0:** Executed on Windows via Chocolatey shim on a dedicated high port, verifying actual TCP socket reconnects, connection timeouts, and command timeout boundaries.
- **Scratch PostgreSQL 18.1 with TLS:** Spanned detached clusters via `initdb`, generated OpenSSL self-signed certificates, configured `ssl=on`, and connected via `sslmode=require` with `rejectUnauthorized: false` to exercise the exact production driver path.
- **Fake Driver Compiler Probes:** Used offline Prisma client driver delegates to capture and diff emitted SQL strings and bound parameter arrays without network overhead.
- **Compiled Child Process Probes:** Evaluated NestJS worker runtime error behavior in spawned Node processes to observe unhandled promise rejection exits directly.

---

### 1.7 What the work found along the way

- **The Redis dead-client trap:** An outage exceeding 10 retries (~30–80 s) previously caused permanent client death for the lifetime of the process. The linear backoff completely eliminates this fragility.
- **Prisma interactive transaction defaults:** Prisma 7.9.1 already enforces `maxWait: 2_000 ms` and `timeout: 5_000 ms` by default. Pool deadline primarily protects single queries, batch queries, and connection handshakes.
- **Gateway caller budget alignment:** The monolithic active-indicator client aborts gateway HTTP calls at 5 s. Lowering the gateway pool timeout to 2,000 ms preserves essential headroom.
- **Unhandled rejection in EventEmitter handlers:** Floating promises in event handlers (`void fn()`) are fatal in modern Node.js runtimes. Catching and logging the rejection in Unit F4 prevents container restart loops during transient database contention.
- **Pre-existing email template test failure:** `__tests__/lib/email/i18n/templates.test.ts` failed before and after changes due to local Node v24.22.1 locale formatting outputting Arabic timezone as `غرينتش+4` instead of `GST`. Unrelated to this wave.

---

## 2. Files changed

| File                                                                                   | Change                                                                                             |
| :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Unit R (Redis background recovery)**                                                 |                                                                                                    |
| `lib/redis/client.ts`                                                                  | **Production.** Linear capped retry delay without cutoff (`Math.min(times * 500, 30_000)`)         |
| `__tests__/lib/redis/client.test.ts`                                                   | **Tests.** Rewritten to pin delay schedule and test client singleton preservation (14 tests)       |
| `__tests__/lib/redis/client-recovery.redis.spec.ts`                                    | **Added.** Gated real-Redis fixture (T1–T6, 8 tests, 933 lines)                                    |
| `docs/migration-orders/adhoc-redis-background-recovery.migration-order.md`             | **Added.** Migration order, entry criteria, decisions, and Deviations                              |
| `docs/handoffs/2026-10-23-2317-redis-recovery-evidence.md`                             | **Added.** Evidence report with measured T5 outage latency table                                   |
| **Unit U (Gateway live-row upsert ID only)**                                           |                                                                                                    |
| `railway-gateway/src/worker/market-data.processor.ts`                                  | **Production.** Added `select: { id: true }` to live-row upsert (+1 line)                          |
| `railway-gateway/test/market-data.processor.spec.ts`                                   | **Tests.** Updated exact-argument expectation and added call order assertions (+4 tests, 16 total) |
| `railway-gateway/test/market-data.processor.pg.spec.ts`                                | **Added.** Gated scratch PostgreSQL parity spec (20 assertions across 9-job sequence, 417 lines)   |
| `docs/migration-orders/adhoc-gateway-upsert-id-only-returning.migration-order.md`      | **Added.** Migration order and Deviations                                                          |
| `docs/handoffs/2026-10-24-0531-gateway-upsert-select-evidence.md`                      | **Added.** Evidence report                                                                         |
| `docs/handoffs/2026-10-24-gateway-upsert-select-evidence/*` (10 files)                 | **Added.** SQL probe scripts, before/after SQL dumps, diffs, mutation harness and results          |
| **Unit P-operation (Operation-service pool deadline)**                                 |                                                                                                    |
| `operation-service/src/prisma/prisma.service.ts`                                       | **Production.** Added `connectionTimeoutMillis: 2_000` (+1 line)                                   |
| `operation-service/src/prisma/prisma.pool.spec.ts`                                     | **Added.** Adapter option shape unit spec (3 tests)                                                |
| `operation-service/src/prisma/prisma.pool.pg.spec.ts`                                  | **Added.** Gated scratch TLS PostgreSQL saturation/connect fixture (8 tests, 466 lines)            |
| `operation-service/src/outbox/outbox-consumer.service.spec.ts`                         | **Tests.** Added test case for checkout failure on user read (+1 test)                             |
| `docs/migration-orders/adhoc-nest-pool-deadline-operation.migration-order.md`          | **Added.** Migration order and Deviations                                                          |
| `docs/handoffs/2026-10-24-operation-pool-deadline-evidence.md`                         | **Added.** Evidence report with D6 database path inventory                                         |
| `docs/handoffs/2026-10-24-operation-pool-deadline-evidence/*` (6 files)                | **Added.** D6 inventory markdown, mutation harness and results, fixture before/after JSON dumps    |
| **Unit F4 (Alert worker watch reload catch)**                                          |                                                                                                    |
| `operation-service/src/alert-engine/alert-worker.service.ts`                           | **Production.** Replaced `void this.reload()` with `this.reload().catch(...)` (+5 −1 lines)        |
| `operation-service/src/alert-engine/alert-worker.service.spec.ts`                      | **Tests.** Added reload rejection logger and cache survival tests (+2 tests, 10 total)             |
| `docs/migration-orders/adhoc-alert-worker-reload-catch.migration-order.md`             | **Added.** Migration order and Deviations                                                          |
| `docs/handoffs/2026-10-24-alert-worker-reload-catch-evidence.md`                       | **Added.** Evidence report                                                                         |
| `docs/handoffs/2026-10-24-alert-worker-reload-catch-evidence/*` (5 files)              | **Added.** Child-process probe script, before/after JSON dumps, mutation harness and results       |
| **Shared planning & repository state**                                                 |                                                                                                    |
| `davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md`      | **Added.** Feasibility analysis and implementation plan (265 lines)                                |
| `.claude/state/current-state.md` & `history/2026-10-sessions.md`                       | **Updated.** Rotated session entries for Units R, U, P-op, and F4                                  |
| `.claude/state/waiting-on.md`                                                          | **Updated.** Open blockers, pending observation items, and F4 status                               |
| `.claude/architecture/database-traps.md` & `environment-gotchas.md`                    | **Updated.** Added scratch DB recipes, driver findings, and child process probe notes              |
| `davintrade-database-scaling/database-scaling-second-wave-manifest-work-completion.md` | **Added.** This completion manifest                                                                |

**Summary across the five local commits (`d92517d7..d0944271`):**

- **Production code modified:** Exactly **4 files**, **+8 / −2 lines net**.
- **Test & evidence infrastructure added:** Gated real-server specs, offline compiler probes, child-process probes, mutation harnesses, and evidence records totaling **+9,985 / −72 lines net**.

---

## 3. Test verification

| Unit / Check         | Scope                                  | Verification Result                                                                                                                                                                                      |
| :------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit R**           | Root monolith                          | `tsc` exit 0; `npm run lint` 0 errors (5 baseline warnings); `npm run test:ci` 592/593 suites passed, 20,267 passed (1 failure is pre-existing email template locale issue); `npm run build` exit 0      |
| Unit R Fixture       | Real `redis-server` 8.4.0              | Gated `client-recovery.redis.spec.ts`: **8 of 8 pass** (unmodified failed 5 of 8)                                                                                                                        |
| Unit R Mutation      | `lib/redis/client.ts`                  | **5 of 5 mutants killed**; files restored byte-identical by SHA-256                                                                                                                                      |
| **Unit U**           | `railway-gateway/`                     | `tsc` exit 0; `npm run check:sensor-kit` exit 0; `npm run build` (nest build) exit 0; e2e 8 suites, 156 tests passed; Jest 3,164 tests: 2,670 passed, 489 skipped, 5 pre-existing CRLF baseline failures |
| Unit U SQL Probe     | Fake driver compiler                   | Emitted `RETURNING` columns reduced from **106 to 1**; 299 parameters verified                                                                                                                           |
| Unit U Parity Spec   | Scratch PostgreSQL 18.1                | Gated `market-data.processor.pg.spec.ts`: **20 of 20 parity checks pass**                                                                                                                                |
| Unit U Mutation      | Ingest processor                       | **7 of 7 mutants killed** by unit spec and gated spec; restored byte-identical                                                                                                                           |
| **Unit P-operation** | `operation-service/`                   | `tsc` exit 0; `npm test` 65 suites, 697 tests: 689 passed, 8 skipped, 0 failed; `npm run build` exit 0                                                                                                   |
| Unit P Fixture       | Scratch TLS PostgreSQL 18.1            | Gated `prisma.pool.pg.spec.ts`: **8 of 8 pass** (unmodified failed 3 of 8); saturation cleanly rejected at 2,039 ms; connect timeout rejected at 2,006 ms                                                |
| Unit P Mutation      | `prisma.service.ts`                    | **7 of 7 mutants killed**; restored byte-identical                                                                                                                                                       |
| **Unit F4**          | `operation-service/`                   | `tsc` exit 0; `npm test` 65 suites, 699 tests: 691 passed, 8 skipped, 0 failed; `npm run build` exit 0                                                                                                   |
| Unit F4 Probe        | Compiled service in Node child process | **Alive to completion** with ERROR logged (unmodified exited with `code 1`)                                                                                                                              |
| Unit F4 Mutation     | `alert-worker.service.ts`              | **7 of 7 mutants killed**; restored byte-identical                                                                                                                                                       |
| Prettier formatting  | All touched files                      | Clean on all changed `.ts`, `.tsx`, `.cjs`, and `.md` files                                                                                                                                              |

---

## 4. Live verification & deployment considerations

### 4.1 Local verification

All verification was conducted using real local runtimes and fixtures:

- Real local `redis-server` 8.4.0 (Windows Chocolatey binary) on high ports.
- Real local PostgreSQL 18.1 instances with and without TLS on port 55471.
- No production databases, credentials, or production networks were touched by the Executor.

### 4.2 Production deployment gating & observation status

1. **Production Observation for Unit U is "Pending Go-Live":**
   As verified in `waiting-on.md` and infrastructure records, Stack D Step 2 has not yet been deployed to production, and ingestion tables hold 0 rows. Unit U's production observation must be conducted once Step 2 goes live (observing job success rate and queue lag across 12 consecutive market-open cycles).
2. **24-Hour Observation Window for Units R and P-operation:**
   Following deployment, observe for 24 hours:
   - Monolith: Monitor `Redis client error:`, `Cache get error:`, and Vercel error rates.
   - Operation-service: Monitor `watch reload failed:` log lines and ensure worker restart count remains at baseline.

---

## 5. What Davin needs to do (Checklist before push)

The Database Scaling Second Wave changes are committed locally, but **must not be pushed immediately** due to unpushed billing commits on local `main`:

- [ ] **Acknowledge the Manage Subscription S1–S4 dependency:**
      Local `main` contains commits `48bf2bcf..9b40bf3d` (Sessions S1 to S4). Session S2 introduced database migration `prisma/migrations/20261021000000_add_subscription_management_fields/migration.sql` (6 new columns on `Subscription`), which has **not yet been applied to production**.
- [ ] **Apply the S2 database migration to production FIRST:**
      Before pushing `main` or deploying any service, execute:
  ```bash
  npx prisma db execute --file prisma/migrations/20261021000000_add_subscription_management_fields/migration.sql --config prisma.production.config.ts
  npx prisma migrate resolve --applied 20261021000000_add_subscription_management_fields --config prisma.production.config.ts
  ```
  _(Failure to apply this migration before pushing will cause all `Subscription` queries in production to fail)._
- [ ] **Rebase against `origin/main`:**
      `origin/main` holds commit `dcd4f8d7` (`feat(brand): update favicon and app icons with DavinTrade mascot`). Run:
  ```bash
  git pull --rebase origin main
  ```
- [ ] **Deploy strategy (choose one):**
  - **Option A (Staged deploy):** Push S1–S4 first (`git push origin 9b40bf3d:main`), observe billing rollout, then push the Database Scaling wave (`git push origin main`).
  - **Option B (Combined deploy):** Once the S2 migration is applied to production, push all commits together (`git push origin main`).
- [ ] **Post-deploy monitoring:**
  - Verify Vercel build status for the monolith.
  - Verify Railway deployment IDs and health uptime for `railway-gateway` and `operation-service`.
  - Maintain the 24-hour observation window.

---

## 6. Git history

The work is captured across five local commits on `main` (clean working tree):

| Commit        | Summary                                                                                  | Scope & Impact                                                                                             |
| :------------ | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `d92517d7`    | `fix(redis): keep reconnecting the root client after a long outage`                      | Unit R: `lib/redis/client.ts`, unit test, real-Redis fixture, evidence (9 files, +1,417 −20)               |
| `ed4ca861`    | `perf(gateway): return only the id from the live-row upsert`                             | Unit U: `railway-gateway`, SQL probes, scratch PG parity spec, evidence (20 files, +6,079 −14)             |
| `c4e3a494`    | `fix(operation-service): bound pool checkout and connect to 2 s`                         | Unit P-op: `operation-service`, TLS PG fixture, outbox test, D6 inventory, F4 draft (18 files, +1,758 −16) |
| `035c2456`    | `fix(operation-service): catch a failed alert watch reload instead of ending the worker` | Unit F4: `alert-worker.service.ts`, child-process probe, unit specs, evidence (13 files, +701 −22)         |
| `d0944271`    | `docs: add database scaling second wave implementation plan`                             | Planning: tracked implementation plan document (1 file, +265 lines)                                        |
| _this commit_ | `docs(database): add second-wave database-scaling work-completion manifest`              | Documentation: this work completion report                                                                 |

---

## 7. Explicitly out of scope

- **Unit P-gateway (`connectionTimeoutMillis: 2_000` on `railway-gateway`):** Deferred by decision until Stack D Step 2 has been deployed and observed live in production for at least one full trading day.
- **Unit P-money (`connectionTimeoutMillis: 2_000` on `money-service`):** Deferred pending dedicated flow-by-flow financial transaction review and explicit owner authorization.
- **Circuit breaker / cool-down for Redis:** Excluded from Unit R; measured T5 worst-case outage latency (6.0 s) is bounded safely within Vercel's 15 s timeout limit.
- **`frontend/lib/redis/client.ts`:** Identified as a stale copy with the old cutoff, but excluded as `frontend/` is an independent separate stack (`SEPARATE_STACK`).
- **Alert worker reload retry mechanism:** Catching the rejection in Unit F4 prevents process termination; automated retry logic or periodic cache refresh is deferred unless `watch reload failed:` log frequency indicates need under normal load.
- **Manage Subscription S1–S4 deployment:** S1–S4 are tracked on `main` and belong to a separate deployment pipeline requiring database migration pre-requisites.
