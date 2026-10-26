# Migration Order — Ad-hoc Session — operation-service finite pool wait (Unit P-operation of the database-scaling second wave)

> **Status: CONFIRMED** — drafted by the Executor on 2026-10-23 from the feasibility plan
> ([plan](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md), work package 3) and the
> [architecture design](../../davintrade-database-scaling/database-scaling-second-wave-architecture.md) §5.
> **APPROVED by Davin in chat on 2026-10-24**, **CONFIRMED by the Executor on 2026-10-24** (entry criteria below). There was no
> separate Advisor DRAFT step: Davin's approval of the Executor's recommendations stands in for it, and every decision below is
> settled as proposed.
> No item is marked ⚠ for money, auth semantics, secrets or CORS: the order changes **failure timing** under pool saturation, not any
> authorization, token or payment logic. `operation-service` does carry login and two-factor routes; Davin approved D1 as proposed (no elevation).
> The money-service and gateway pool changes are **not** part of this order.
>
> **CONFIRM note (Executor, 2026-10-24).** Davin's sign-offs, as given in chat:
>
> - **D1 to D6: "APPROVED as proposed"**: D1 `connectionTimeoutMillis: 2_000` added to the `PrismaPg` options in
>   `operation-service/src/prisma/prisma.service.ts:21-24`; D2 no catch-and-retry, existing error and outbox paths unchanged; D3 three layers of proof
>   (unit mock, scratch database fixture, inventory deliverable); D4 scratch PostgreSQL 18 with TLS on a random high port, falling back to a
>   driver-level non-TLS fixture only if scratch TLS is not viable (recorded in Deviations); D5 prior orders (Unit R and Unit U) are built, verified and
>   committed locally, and Unit U's production observation is recorded as "pending go-live" and does not block this order; D6 the inventory table for
>   all operation-service database paths.
> - **Runtime facts stated by Davin:** `operation-service` runs **1 replica** on Railway; PgBouncer is **standard Railway managed Postgres**, no
>   settings supplied. The order therefore records **"healthy checkout distribution: not measured"** and rests on the structural arguments of D1 and D6.
>   These are Davin's statements; the Executor has no production access and did not check them.
> - **Scope constraint from Davin:** nothing under `railway-gateway/`, `money-service/`, the root monolith or any other service is touched in this session.
>
> Re-verified fresh before any edit: `HEAD` = `ed4ca861` (a descendant of `9b40bf3d`; the two commits after it are the Redis fix and the gateway
> ID-only upsert, neither touching `operation-service/`); `prisma.service.ts`, `prisma.shutdown.spec.ts`, `outbox-consumer.service.spec.ts`,
> `package.json` and `package-lock.json` of `operation-service` unchanged since `9b40bf3d` (`git diff 9b40bf3d HEAD -- operation-service` is empty);
> tree clean apart from the plan and this order (both untracked). **Prior-order gate (D5), stated honestly:** nothing is pushed (`main` is 6 commits
> ahead of and 1 behind `origin/main`), so no production observation window of Unit R can have elapsed; Davin's D5 statement is the gate, and the
> 24 h windows of this wave are observed after each push, not before this build. Baselines are in Deviations.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving configuration change
(closest to `TEMPLATE-PORT.md`, dial **Low**) · **Status:** EXECUTED and verified locally, NOT committed · **Generated:** 2026-10-23 (Executor) · **Basis:** `main` @ `9b40bf3d` (re-verified at `ed4ca861`) ·
**Flags touched:** none · **Estimated time:** ~3 to 4 h (one line; the TLS-capable scratch database, the saturation fixtures and the caller-budget inventory are the work).

**Source:** design §5, plan WP3 and findings F4 and F7. Precedent in the repo: the root Next pools already set `connectionTimeoutMillis: 5_000` and `max: 5` (`lib/db/prisma.ts:51-53`, `lib/db/market-prisma.ts:40-42`, ticket T1-d).

## Facts the Executor verified against live code (`9b40bf3d`)

- **The change site.** `operation-service/src/prisma/prisma.service.ts:21-24`: `new PrismaPg({ connectionString: process.env['DATABASE_URL'], ssl: { rejectUnauthorized: false } })`. Log level `:25-28`, `$connect()` in `onModuleInit` (`:32-34`),
  `$disconnect()` in `onApplicationShutdown` (`:40-42`, deliberately after the HTTP server drains). The service file, its shutdown spec and `operation-service/package.json` are byte-identical to the design's baseline `de61737e` (`git diff de61737e HEAD` empty at `9b40bf3d`).
- **Installed here** (`operation-service/node_modules`, Prisma client generated): `@prisma/adapter-pg` 7.9.1, `@prisma/client` 7.9.1, `pg` 8.22.0, `pg-pool` 3.14.0. **`pg` is not a direct dependency** of the service (`package.json` lists `@prisma/adapter-pg` and `@prisma/client`),
  so the new tests must not `import 'pg'` and `package.json` must not change. Fixtures use a second `PrismaClient` for monitoring and Node's `net` for the black-hole server.
- **What the setting does, read in the installed sources.** `pg-pool@3.14.0/index.js`: defaults `max` 10 and `idleTimeoutMillis` 10,000 (`:89`, `:98-99`), no default connect timeout; with `connectionTimeoutMillis` set, a checkout that must wait removes its entry from the pending queue and errors
  "timeout exceeded when trying to connect" (`:206-225`), and a brand-new connection that has not connected in time is destroyed and reported as "Connection terminated due to connection timeout" (`:249-283`).
  `@prisma/adapter-pg@7.9.1/dist/index.js:785`: the pool is built lazily as `new pg.Pool(this.config)`, so the option reaches the pool unchanged; interactive transactions acquire through `pool.connect()` (`:717`) and turn a failure into a `DriverAdapterError` (`:740`).
- **What it does not bound:** SQL after checkout; PgBouncer's own queue and locks once the client connection exists; the upstream HTTP aborts; a whole job or request. `$connect()` does not open a physical connection (lazy pool), so `onModuleInit` and the `SELECT 1` health check
  (`operation-service/src/health/health.controller.ts:47`, which catches and reports `down`) keep their meaning; only the checkout stage of that query becomes bounded.
- **Prisma already limits interactive transactions:** 7.9.1 defaults `maxWait` 2,000 ms and `timeout` 5,000 ms (`@prisma/client/runtime/client.js`). operation-service has **6** `$transaction(async …)` sites and none overrides them:
  `users/users.service.ts:820` and `:920`, `alerts/line-alerts.service.ts:121` and `:192`, `alert-engine/dispatcher.service.ts:37`, `account-deletion/account-deletion.worker.ts:162`. A 2,000 ms pool deadline therefore equals Prisma's own start deadline for them
  and adds little there; which error wins that race is not deterministic. The setting mainly changes single statements and batch paths (unbounded today) and whatever happens to a connection that arrives after Prisma has stopped waiting (**unverified: step 7 checks it**).
- **Caller budgets.** `lib/operation-service/client.ts:56,66`: reads abort at 5,000 ms, writes at 15,000 ms; writes are never retried. A 2,000 ms checkout wait leaves nominal headroom in the 5 s read budget; it does not guarantee completion (a route may acquire more than once, do other work first,
  wait behind PgBouncer after connecting, or run slow SQL).
- **Other paths that share this pool:** `outbox/outbox-consumer.controller.ts` (`POST /v1/outbox/events`, called by money-service's publisher, which counts any 2xx as delivered and retries on non-2xx); its service reads the user at `outbox-consumer.service.ts:275`, **before** the Redis claim (`:292`) and **outside** the `try` that starts at `:306`,
  so an acquisition failure there is an unhandled 5xx with no claim taken and no email sent, and the publisher retries (read, not yet exercised: `outbox-consumer.service.spec.ts` has no case where `findUnique` rejects, so step 1 adds one);
  a failure inside `dispatch` releases the claim (`:320-323`). Background paths: `account-deletion` scheduler and worker, `alert-engine` cron scheduler and dispatcher, `email-locale.service.ts`.
- **TLS is forced** by `ssl: { rejectUnauthorized: false }`. Through-service fixtures therefore need a scratch PostgreSQL with TLS on, or the connection fails at the SSL negotiation. `openssl` exists (`C:\Program Files\Git\usr\bin\openssl.exe`), so a self-signed certificate is possible. The service's `DATABASE_URL` is read at construction.
- **Test mechanics.** `operation-service/jest.config.js`: `testRegex: 'src/.*\.spec\.ts$'`, so a gated `*.pg.spec.ts` beside the service is collected by `npm test` and skips itself without its environment variables. No test anywhere mentions `PrismaPg` (the three shutdown specs only spy on exit and kill).
  `prisma.shutdown.spec.ts` can time out under a full parallel run (`LESSONS-LEARNED.md` L24): rerun it alone with `--runInBand` before calling it a regression. The root `tsc` does not cover this package; it has its own `tsc`, Jest and `nest build` (whose `prebuild` builds `packages/types`), and no lint script.
- **Fixture tools:** PostgreSQL 18 binaries (`C:\Program Files\PostgreSQL\18\bin`; production is 17.11, which does not matter for pool behaviour). Start `postgres.exe` with a hidden `Start-Process`, never `pg_ctl start` inside a tool call (gotchas file). Port 55471 was free on 2026-10-23. Davin's own service on 5432 is not touched. Docker is absent.
- **Not measurable from here:** healthy checkout and connect distributions (no production access; the 2026-10-20 manifest records the market tables empty), PgBouncer settings, the operation-service replica count. Each replica has its own pool of up to 10 connections.

## Decisions taken

> **Proposed by the Executor; to be settled by the Advisor and approved by Davin.**

1. **D1 (design §5.1) — `connectionTimeoutMillis: 2_000`, nothing else.** One field added to the existing `PrismaPg` options object; `ssl`, the URL source, the log level and the lifecycle hooks are kept as they are. No `max`, `idleTimeoutMillis`, `maxLifetimeSeconds`, `query_timeout`, `statement_timeout` or transaction option; no shared package; no environment variable or flag.
   2,000 ms is a design choice, not a measured optimum. _Rejected:_ 5,000 ms (consumes the entire 5 s read budget before any SQL runs); raising an upstream timeout or a pool maximum to compensate. _Undo:_ low (remove the field).
2. **D2 — no catch-and-retry and no new error mapping.** A checkout or connect failure follows the existing exception, transaction, job and outbox paths unchanged. An acquisition timeout means one acquisition failed; it does **not** prove the request had no earlier effects.
3. **D3 — the proof is three layers, each labelled:** (a) a unit spec on the exact adapter options (_mock_); (b) a gated spec of the real service against a scratch PostgreSQL (_real fixture_), which also settles Prisma's version-specific behaviour (_installed-driver_); (c) the caller-budget and background-path inventory (a reading of the code).
   Error classes are recorded as observed, never pinned from memory. A passing mock is not accepted as the proof.
4. **D4 (plan D5) — fixtures:** a scratch PostgreSQL 18 with TLS on and a self-signed certificate, hidden, random high port such as 55471, data in the session scratchpad, stopped by PID and deleted afterwards; a Node `net` server for the connect-timeout case. Each launch is announced to Davin before it runs.
   _Fallback if TLS on the scratch server cannot be made to work:_ driver-level fixtures with the same option values over a non-TLS scratch server, recorded as a Deviation with the gap named (the through-service TLS path unproven).
5. **D5 (plan D7, D8) — ordering and rollout.** First of the pool orders. Gate: the Redis order's 24 h window has passed without regression; the ID-only order's production observation is "pending go-live" and **does not block** this order (plan D8). One unit per push; a 24 h observation window before the next unit
   (P-gateway and P-money are not drafted here: they wait for the gateway value, Stack D step 2 live for a trading day, and Davin's money sign-off).
6. **D6 — the inventory is a deliverable, not a formality.** A table of every operation-service database path (monolith-called routes on the 5 s read path with their sequential database awaits, the six interactive transactions, the outbox consumer, the background workers, health) with, for each: the caller budget, what a checkout failure does,
   and whether earlier effects could already exist. Any path where 2,000 ms leaves no room is reported to Davin before commit, and the value is adjusted for this service explicitly rather than by raising an upstream timeout or a pool maximum.

## Invariants (must not change)

- The adapter options other than the one added; the `DATABASE_URL` source; `ssl: { rejectUnauthorized: false }` exactly (and **not** copied to the other services); the log configuration; `onModuleInit` and `onApplicationShutdown` (no earlier `$disconnect`).
- Effective pool shape: `max` 10, idle eviction 10,000 ms (verified empirically in the fixture, not assumed).
- The upstream clients' 5 s and 15 s budgets and the no-write-retry rule; Prisma's interactive-transaction defaults; Bull and cron retry behaviour; the outbox publisher's retry and the consumer's claim-release behaviour; every guard and route in `auth/`, `two-factor/`, `security/`.
- No schema, migration, generated-client, lockfile or `package.json` change.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `git log -1` is `9b40bf3d` or a descendant; `operation-service/src/prisma/prisma.service.ts`, `prisma.shutdown.spec.ts` and `operation-service/package.json` unchanged since this draft (`git diff 9b40bf3d HEAD`); tree clean apart from the three orders. _(HEAD `ed4ca861`; the diff of `operation-service/` is empty; tree clean apart from the plan and this order, untracked.)_
- [x] Prior-order gate (D5) confirmed in writing by Davin: the Redis order's window passed without regression. _(Replaced by Davin's D5 statement in chat: Units R and U are built, verified and committed locally; Unit U's observation is "pending go-live" and does not block. Nothing is pushed, so no production window exists yet; see the CONFIRM note.)_
- [x] Baselines recorded in Deviations before any edit, in `operation-service/`: `npx tsc --noEmit`, `npm test` (counts and skipped), with `prisma.shutdown.spec.ts` rerun alone if it times out; `npm run build` result.
- [x] Versions recorded: `@prisma/adapter-pg`, `@prisma/client`, `pg`, `pg-pool` (still 7.9.1, 7.9.1, 8.22.0, 3.14.0, or the differences stated).
- [x] PostgreSQL 18 binaries and `openssl` present; port 55471 (or another) free; no scratch server of ours left; Davin's service on 5432 not touched. _(PostgreSQL 18.1; port 55471 free at start; Davin's service on 5432, PID 8540, untouched.)_
- [x] Davin supplies, or states he cannot: the operation-service Railway replica count, PgBouncer `max_client_conn`, `default_pool_size`, `query_wait_timeout` and pool mode, and any existing latency or error metrics. Without them the order records "healthy checkout distribution: not measured" and rests on the structural arguments of D1 and D6. _(1 replica; standard Railway managed Postgres, no settings: "not measured".)_
- [x] `.claude/architecture/environment-gotchas.md` re-read (shell drift: use absolute paths or a subshell; `Start-Process` for Postgres).

## Ordered steps (each carries its verification)

1. **Inventory (read only).** Build the D6 table. For the routes, start from the callers of `lib/operation-service/client.ts` in the monolith and follow each to its operation-service controller and service; count sequential database awaits and note every interactive transaction. For the outbox consumer, confirm that a checkout failure at `outbox-consumer.service.ts:275`
   surfaces as a non-2xx with no claim taken, and that a failure inside `dispatch` runs the claim release at `:320-323`. Add **one case** to the existing `operation-service/src/outbox/outbox-consumer.service.spec.ts`: `findUnique` rejects with a pool-timeout-shaped error → `processEvent` rejects, no claim is taken, no email is dispatched. _Verify:_ the table is complete for the six transaction sites, the outbox consumer, the account-deletion and alert-engine paths and health; flagged rows are listed.
2. **Scratch PostgreSQL with TLS.** `initdb` in the scratchpad; make a self-signed certificate and key with `openssl`; start `postgres.exe` with a hidden `Start-Process` on the chosen port with `ssl=on` and the two file settings and `listen_addresses=127.0.0.1`; poll `pg_isready`. _Verify:_ a TLS connection succeeds (`sslmode=require`) and a plain one is not needed.
3. **Write the gated fixture first and watch it distinguish old from new.** New `operation-service/src/prisma/prisma.pool.pg.spec.ts`, skipped unless `OPS_POOL_PG_URL` is a localhost URL **and** `OPS_POOL_PG_ALLOW_WIPE=yes` (it creates and drops one table `pool_fixture_probe` in that database). Its cases are in step 6. Run it against the **unmodified** service.
   _Verify:_ the saturation case does **not** fail at about 2 s: the eleventh query waits until a held connection frees (about 4 s) and then succeeds. Record this as the "before" observation; it proves the fixture can see the difference.
4. **Apply D1.** Add `connectionTimeoutMillis: 2_000` to the options object. _Verify:_ `npx tsc --noEmit`.
5. **Unit spec** `operation-service/src/prisma/prisma.pool.spec.ts`: with `@prisma/adapter-pg` replaced by a spy constructor (its instance carries the shape `PrismaClient` needs), assert the options are exactly `{ connectionString: <env>, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 2000 }`, and in particular that `max`, `idleTimeoutMillis` and `maxLifetimeSeconds` are **absent**.
   _Verify:_ `npx jest src/prisma/prisma.pool.spec.ts`.
6. **Fixture cases**, each using the real `PrismaService`, with `application_name` set in the fixture URL so a second monitoring client can count backends in `pg_stat_activity`; every temporary socket and client is closed in `finally`:
   - **Pool shape.** Ten concurrent `pg_sleep(4)` queries show exactly 10 backends for the application name (effective `max` 10); nothing more connects.
   - **Saturation.** While those ten run, an eleventh query (an `INSERT` into `pool_fixture_probe`) fails after about 2 s. Record the elapsed time, the error class, message and any code; do not pin a code. After the sleepers finish: a fresh query succeeds immediately, backends return to idle, and the probe table holds **no row** from the timed-out insert (no late service of a removed waiter).
   - **Connect timeout.** A `net` server that accepts and never completes the PostgreSQL startup (never sends the TLS answer): a query fails at about 2 s, with "Connection terminated due to connection timeout" or the Prisma-wrapped equivalent. A refused port is only a control (it fails at once and proves nothing about the timer). Close all sockets in `finally`.
   - **Interactive transaction under saturation.** With ten held connections, `$transaction(async tx => …)` with the defaults fails either as Prisma's start timeout or as the pool timeout (record which, and accept both); then a variant with `maxWait: 10_000` fails at about 2 s as the pool timeout. In both: no `idle in transaction` backend and no open `xact_start` remain after the sleepers finish (poll up to 5 s), and the pool recovers.
   - **Not a statement timeout.** A single `pg_sleep(3)` on an idle pool completes normally.
   - **Normal read and write** on an idle pool succeed; shutdown (`$disconnect`) completes with nothing held.
     _Verify:_ `OPS_POOL_PG_URL=… OPS_POOL_PG_ALLOW_WIPE=yes npx jest src/prisma/prisma.pool.pg.spec.ts --runInBand`, all cases green; report the count. Then a plain `npm test` shows the gated spec skipped.
7. **Report the inventory and the observed timings to Davin** (D6) before any commit. Any flagged route is his call.
8. **Mutation check** with the fixture enabled: remove the field (saturation, connect-timeout and unit cases fail); set `20_000` (they fail on elapsed time); set `connectionTimeoutMillis` to `1` (normal read fails or the elapsed assertion fails); add `max: 2` (pool-shape case fails); drop `ssl` (the through-service case fails to connect). Restore byte-identical (sha-256).
9. **Full verification** in `operation-service/`: `npx tsc --noEmit`, `npm test` (counts equal baseline plus the new specs; shutdown spec alone if it flakes), `npm run build`; `npx prettier --check --end-of-line auto` on the changed files only. `git diff --stat` shows only `prisma.service.ts`, the two new specs and the one added case in `outbox-consumer.service.spec.ts`.
10. **Stop the scratch server** by PID, remove its data directory and the certificate, confirm no postgres or node process of ours is left.
11. **Close.** Evidence report `docs/handoffs/2026-10-xx-operation-pool-deadline-evidence.md` (the inventory table, the observed timings and error classes, versions, labelled evidence types, what could not be measured); state entry per `session-lifecycle.md`; fill Deviations.
    **Commit only if Davin asks,** by explicit paths, suggested message `fix(operation-service): bound pool checkout and connect to 2 s`. No push or deploy by the Executor.

## Rollout and observation (after the commit and push, Davin's call)

- One push. Railway rebuilds all three services on every push to `main` (Watch Paths unset); record the operation-service deployment ID and the `uptime` of its health response, because a push is not proof of a deploy.
- Observe 24 h of normal traffic (plan D7): log lines "timeout exceeded when trying to connect" and "Connection terminated due to connection timeout"; 504s from the monolith's operation-service client; 5xx on `POST /v1/outbox/events` and the publisher's retry counts; alert dispatcher and account-deletion worker errors; the `health` database status.
- **Revert criteria:** unexpected acquisition failures in normal traffic, caller failures, retry amplification, or an ambiguous state in any inventory row.

## Done when

- The options object carries `connectionTimeoutMillis: 2_000` and nothing else changed; the unit spec passes; the gated spec passes against a TLS scratch PostgreSQL and **failed to show the bound on the unmodified service** (step 3); every mutant is killed.
- The inventory exists, has been read by Davin, and no flagged row remains open; versions and error classes are recorded as observed.
- `tsc`, `npm test` and `build` are green in `operation-service/`; counts and skips reported.
- **Not claimed:** any throughput gain; that normal checkout times are well under 2,000 ms (not measured); any bound on SQL after checkout, on PgBouncer queueing or on a whole request; that a timed-out acquisition left a request with no effects.

## Rollback

Remove the field and redeploy `operation-service` only. This restores the unbounded wait; it does not repair overload and does not reverse completed business effects. Nothing to reconcile for data. If an ambiguous state was found in the inventory, reconcile it through the existing procedures, never by blindly replaying writes.

## Out of scope

The gateway and money-service pool deadlines (separate orders, separate gates), pool maxima, idle or lifetime settings, statement or lock timeouts, a write-retry layer, Prisma interactive-transaction options, the root Next pools, PgBouncer configuration, alert-reload coordination, and the other two orders.

## Deviations

_(filled during execution, never deleted)_

- **Baselines before any edit (2026-10-24, `operation-service/`, HEAD `ed4ca861`):** `npx tsc --noEmit` exit 0; `npx jest` (= `npm test`) **63 suites, 685 tests passed, 0 skipped, 0 failed**
  (35.5 s; `prisma.shutdown.spec.ts` did not flake); `npm run build` exit 0 (`prebuild` builds `packages/types`; `git status` unchanged afterwards).
- **Versions (unchanged from the draft):** `@prisma/adapter-pg` 7.9.1, `@prisma/client` 7.9.1, `pg` 8.22.0, `pg-pool` 3.14.0. Node v24.22.1 (CI uses 22).
- **Hashes before any edit (git blob):** `prisma.service.ts` `73360124…`, `package.json` `662af8e1…`, `package-lock.json` `6558a834…`, `prisma.shutdown.spec.ts` `f0eb61dd…`,
  `outbox-consumer.service.spec.ts` `79e942c5…`; sha-256 of `prisma.service.ts` `713597f8c178e95c5339f47106578aa69c9c4734a91ac4d1f9bab872fb3fd3e1`.
- **Healthy checkout distribution: not measured** (Davin supplied no PgBouncer settings or latency metrics; standard Railway managed Postgres).
- **Executed 2026-10-24; evidence in [the report](../handoffs/2026-10-24-operation-pool-deadline-evidence.md).** Steps 1 to 10 done in order; step 11's state entry written; **no commit, push or deploy** (Davin has not asked).
- **Step 1 (inventory).** Built as the D6 table ([inventory-d6.md](../handoffs/2026-10-24-operation-pool-deadline-evidence/inventory-d6.md)). It covers 13 read rows, 25 write rows, the outbox consumer, six background paths and all six
  transaction sites. The order said the table starts "from the callers of `lib/operation-service/client.ts` in the monolith"; the monolith routes sit behind `MIGRATE_*` flags (`lib/operation-service/flags.ts`), whose production values are
  not known, so the table is organised by operation-service route with the flag that gates its monolith caller. The outbox case was added as planned (one test, in the existing `at-least-once delivery` block, and it also checks that the retry then sends once).
  **Findings that the draft did not list: F1 to F5 and the budget row** (report §6). F4 is a new failure mode (`void this.reload()` on `alerts:changed`).
- **Step 2 (scratch PostgreSQL).** TLS worked on the first attempt, so the D4 fallback (a non-TLS driver-level fixture) was **not used**. One addition to the draft: `pg_hba.conf` was replaced by `hostnossl ... reject` and `hostssl ... trust`
  (the default `host` lines accept plain connections too, which would have let mutant M5, "drop `ssl`", pass). PostgreSQL 18.1, port 55471, postmaster PID 29456, hidden.
- **Fixture URL has no `sslmode`.** The installed `pg-connection-string` turns `sslmode=require` into `ssl: {}` and that replaces the service's own `ssl` option (installed-driver probe); the fixture relies on the service's `ssl` alone.
- **Step 3 (before-state).** On the unmodified service the fixture failed exactly the three cases about the bound (saturation: waited 3,853 ms and succeeded; black-hole connect: no result in 15 s; `maxWait: 10_000` transaction: waited 4,009 ms and committed)
  and passed five. The draft expected the saturation case to wait "about 4 s": observed 3.85 s. The default-transaction case already failed at 2 s as Prisma's `P2028` on the unmodified service, as the draft predicted.
- **Step 5 (unit spec).** The adapter is replaced by a spy constructor and the real `PrismaClient` accepts its instance, so `@prisma/client` is not mocked. Failed 2 of 3 on the unmodified service, passes 3 of 3.
- **Step 6 (fixture cases).** All the draft's cases are in; eight tests (the draft's "normal read and write" and "shutdown" became two tests, and "pool shape" has a second test for the 10 s idle eviction). Error classes were recorded, not pinned.
  The saturation error is a **plain `Error`**, not a Prisma error (draft: "record the class"). Two timing assertions use a window (1.8 to 3.5 s), so a heavily loaded machine could flake them.
- **Step 8 (mutation).** Seven mutants instead of five (M6 `500`, M7 `idleTimeoutMillis: 60_000` added); all killed by the unit spec and by the fixture; source restored byte-identical (sha-256 `f43d1030…`).
- **Step 9 (verification).** `tsc` 0; `jest` 65 suites (64 passed, 1 skipped), 697 tests (689 passed, 8 skipped, 0 failed), baseline plus 1 + 3 + 8; `nest build` 0; prettier clean on the four changed files; code diff `prisma.service.ts` +1, outbox spec +17.
- **Step 10.** Scratch server stopped by `pg_ctl stop -m fast`, data directory and certificate deleted, nothing of ours left; Davin's service on 5432 untouched.
- **Step 7 (report to Davin) is the closing report of this session;** nothing was committed, so the "before any commit" condition holds. **Open for Davin:** F1 to F5 and the budget row, in particular F4.
- **Not done:** no comment next to the new line (none added, as in Unit U); no change to `alert-worker.service.ts` or any other file for F1 to F5 (D2).

## Next-session handoff (PRE-DRAFT notes for the following order, not a plan)

- Previous orders in the sequence: [`adhoc-redis-background-recovery`](adhoc-redis-background-recovery.migration-order.md), [`adhoc-gateway-upsert-id-only-returning`](adhoc-gateway-upsert-id-only-returning.migration-order.md).
- **P-gateway** (not drafted): value per plan D2 (recommended 2,000 ms: the monolith aborts gateway reads at 5 s, `lib/active-indicator/gateway-client.ts:26`, and `/api/v1/health` runs `SELECT 1` on the same pool); adds the Bull-retry, health and array-form sensor-writer checks; waits until Stack D step 2 has run live for a trading day.
- **P-money** (not drafted): gated on Davin's explicit authorization of that specific change and a flow-by-flow table (plan WP5). Manage Subscription S4 is now committed (`9b40bf3d`), which removes the plan's "uncommitted billing work" concern but not the sign-off.
