# Evidence report: operation-service pool checkout and connect deadline (Unit P-operation, database-scaling second wave)

- **Date:** 2026-10-24 · **Executor:** Claude Code · **Basis:** `main` @ `ed4ca861` (working tree, **NOT committed, NOT pushed, NOT deployed**, no migration, no new variable).
- **Order:** [adhoc-nest-pool-deadline-operation](../migration-orders/adhoc-nest-pool-deadline-operation.migration-order.md) (CONFIRMED; D1 to D6 approved as proposed by Davin in chat; 1 replica and "standard Railway managed Postgres, no settings" stated by Davin).
- **Plan:** [second-wave implementation plan](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md), work package 3.
- **The change:** one production line, `operation-service/src/prisma/prisma.service.ts:24`, `connectionTimeoutMillis: 2_000` added to the `PrismaPg` options. Nothing else in the file moved.
- **Inventory (D6):** [inventory-d6.md](./2026-10-24-operation-pool-deadline-evidence/inventory-d6.md). **Raw evidence:** [the evidence folder](./2026-10-24-operation-pool-deadline-evidence/).

## 1. Needs from Davin

1. **Read the five flagged rows (§6) and say whether any changes the plan.** The one that matters most is **F4**: the alert worker calls `void this.reload()` when it receives `alerts:changed`; with the deadline, a pool wait of more than 2 s makes `reload()` reject, that is an unhandled rejection, and Node 24 ends the process on it (probe: exit code 1; no `unhandledRejection` handler exists in the service, Nest, OpenTelemetry or BullMQ). Today the same wait just waits. This is the only **new failure mode** found. The order's D2 says no catch-and-retry, so I did not change `alert-worker.service.ts`; the fix is a `.catch` on that call, drafted as [adhoc-alert-worker-reload-catch](../migration-orders/adhoc-alert-worker-reload-catch.migration-order.md) (PRE-DRAFT, not executed; its D1 needs your explicit sign-off because it trades a loud crash for a possibly stale watch cache).
2. **Say whether 2,000 ms stays.** Three-await read routes (the notifications list, and the profile and 2FA-status reads for a user found only by e-mail) can wait 3 x 2,000 ms in the worst case against the monolith's 5,000 ms read abort (§6, Note 1). That is no worse than today (the wait is unbounded today), so I left the value as you approved it; a lower value is your call.
3. **Commit and push when you want them** (explicit paths and message in §9; the order says no push or deploy by the Executor). `main` is already 6 commits ahead of `origin/main` and 1 behind. After a push record the operation-service deployment ID and the `uptime` of its `/health`; Railway rebuilds every service on every push to `main`, and a push is not proof of a deploy.
4. **Production observation is not done.** Nothing is pushed, so no window exists. After the push observe 24 h (§9). The healthy checkout distribution is **not measured** (no production access; no PgBouncer settings).
5. **Say if you want a one-line comment** next to `connectionTimeoutMillis: 2_000`. None was added (as in Unit U), so the diff is exactly the line you signed off.
6. **The worker process.** `railway.toml` declares `operation-service-worker` (`start:worker`) beside `operation-service`; it has its own pool with this deadline. You stated 1 replica for `operation-service` only; whether the worker is deployed, and with how many replicas, is not on record.

## 2. Changed and verified

| File                                                                    | Change                                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `operation-service/src/prisma/prisma.service.ts`                        | **+1 line**: `connectionTimeoutMillis: 2_000,`                                                                                         |
| `operation-service/src/prisma/prisma.pool.spec.ts` (new)                | unit spec, 3 tests: the exact adapter options, the absent keys, `DATABASE_URL` read at construction (_mock_)                           |
| `operation-service/src/prisma/prisma.pool.pg.spec.ts` (new, gated)      | real-fixture spec, 8 tests; skipped unless `OPS_POOL_PG_URL` is a localhost URL and `OPS_POOL_PG_ALLOW_WIPE=yes` (_real fixture_)      |
| `operation-service/src/outbox/outbox-consumer.service.spec.ts`          | **+1 test**: a pool-timeout-shaped rejection of the user read fails the delivery with no claim and no e-mail, and the retry sends once |
| the order, `inventory-d6.md`, this report, `.claude/` state and gotchas | documentation only                                                                                                                     |

No schema, migration, generated-client, lockfile or `package.json` change (`git status` shows only the files above). `railway-gateway/`, `money-service/`, the root monolith and every other service were not touched.

## 3. Evidence, by type

Every result is labelled. A passing mock is **not** accepted as the proof (D3): the proof is the gated fixture, and it was first shown to fail on the unmodified service.

| Layer               | What it shows                                                                                                                                                                                                        | Type                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Unit spec (3 tests) | the adapter receives exactly `{ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 2000 }`; `max`, `min`, `idleTimeoutMillis`, `maxLifetimeSeconds` and the statement options are absent | _mock_                               |
| Gated fixture (8)   | the real `PrismaService`, adapter and pool against PostgreSQL 18.1 that accepts TLS only (TLSv1.3 confirmed, plain connections rejected by `pg_hba.conf`)                                                            | _real fixture_                       |
| `sslmode` probe     | `pg-connection-string` parses `sslmode=require` to `ssl: {}`, and `pg`'s `ConnectionParameters` then ignores the service's own `ssl` option (so the fixture URL has no `sslmode`)                                    | _installed-driver probe_             |
| Unhandled rejection | a Node 24.22.1 script with the same shape as `void this.reload()` in an event handler ends with exit code 1 and the error on stderr                                                                                  | _Node probe_ (not the worker itself) |
| Inventory (D6)      | every operation-service database path, its awaits, its failure result and its earlier effects                                                                                                                        | _reading of the code_                |
| Mutation check      | seven mutants of `prisma.service.ts`, each run against the unit spec and the fixture                                                                                                                                 | _real fixture_ and _mock_            |

### 3.1 The fixture sees the difference (before and after)

The fixture ran twice with the same assertions: on the **unmodified** service (step 3 of the order) and on the fixed one. Raw output: [fixture-before-unmodified.json](./2026-10-24-operation-pool-deadline-evidence/fixture-before-unmodified.json), [fixture-after-fixed.json](./2026-10-24-operation-pool-deadline-evidence/fixture-after-fixed.json).

| Case                                                      | Unmodified service (before)                                                           | Fixed service (after)                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Eleventh query while ten are held (`pg_sleep(4)`)         | **waits 3,853 ms, then succeeds**; its `INSERT` lands (1 row)                         | **fails at 2,039 ms** with a plain `Error`, "timeout exceeded when trying to connect", no code; **0 rows**; next query 1 ms; ten idle backends |
| Connection that never completes (TCP accepted, no answer) | **no result within 15 s** (hung; 1 connection accepted)                               | **fails at 2,006 ms**, plain `Error`, "Connection terminated due to connection timeout"                                                        |
| Refused port (control)                                    | fails at once, 29 ms, `P2010` "Can't reach database server"                           | the same, 7 ms (proves nothing about the timer)                                                                                                |
| Interactive transaction, defaults, pool full              | fails at 2,011 ms, Prisma's `P2028` "Unable to start a transaction in the given time" | fails at 2,016 ms, the same `P2028` (Prisma's own deadline wins both times)                                                                    |
| Interactive transaction, `maxWait: 10_000`, pool full     | **waits 4,009 ms, then commits** (1 row)                                              | **fails at 2,010 ms**, plain `Error`, pool timeout; 0 rows                                                                                     |
| After each transaction case                               | 0 backends `idle in transaction` or holding `xact_start`                              | the same                                                                                                                                       |
| Ten busy queries: backends                                | exactly 10, all over TLS, still 10 after 500 ms                                       | the same                                                                                                                                       |
| Idle backends evicted after                               | 10,065 ms                                                                             | 10,058 ms                                                                                                                                      |
| One `pg_sleep(3)` on an idle pool                         | 3,067 ms, succeeds (no statement timeout)                                             | 3,054 ms, succeeds                                                                                                                             |
| `$connect()`, then shutdown                               | 0 backends after `$connect()` (the pool is lazy); shutdown 2 ms, 0 backends           | the same; shutdown 1 ms                                                                                                                        |
| Normal write and read, idle pool                          | 56 ms and 2 ms, over TLS                                                              | 54 ms and 2 ms, over TLS                                                                                                                       |

Result of the runs: **unmodified 5 passed, 3 failed** (saturation, connect timeout, the `maxWait: 10_000` transaction: exactly the three cases that are about the bound); **fixed 8 of 8 passed** (46 s). The five cases that pass in both are the invariants: the pool is lazy, normal traffic works, a statement is not timed, `max` is 10 and idle eviction is 10 s.

Four things the fixture settled that the order had left open:

1. **The late waiter.** On the unmodified service the Prisma start deadline (`P2028`) already fires at 2 s for an interactive transaction, and the order could not say what happens to the pool waiter Prisma gave up on. Observed: nothing leaks on either side (no `idle in transaction` backend, no row), so there is no hidden late transaction to fear. The deadline does not change the default transaction case; it changes it only when `maxWait` is raised.
2. **Error classes** are plain `Error` for both pool timeouts (no Prisma class, no `code`), and `P2028` for the transaction start. They were recorded, not pinned in the spec; the spec asserts only the elapsed window (1.8 to 3.5 s) and the absence of side effects.
3. **The race** for a default transaction was won by Prisma twice out of two (before and after). It is not claimed to be deterministic.
4. **A checkout failure reaches the monolith as HTTP 500**, not 504 or 503: the catch-all filter maps anything that is not an `HttpException` to "Internal server error" and logs the stack (which carries the pool message).

### 3.2 Mutation check (step 8): 7 of 7 killed

Each mutant was applied to `prisma.service.ts`, run against the unit spec and the fixture (`mutate-prisma-service.cjs`, hidden children, restore and sha-256 check after every mutant). Results: [mutation-results.json](./2026-10-24-operation-pool-deadline-evidence/mutation-results.json).

| Mutant                              | Unit spec       | Fixture                                                                                                                   |
| ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| M1 remove `connectionTimeoutMillis` | killed (2 of 3) | killed: saturation, connect timeout, transaction (3 failed, 5 passed)                                                     |
| M2 `20_000`                         | killed (1 of 3) | killed: the same three                                                                                                    |
| M3 `1`                              | killed (1 of 3) | killed: all 8 (a connection cannot open in 1 ms)                                                                          |
| M4 add `max: 2`                     | killed (2 of 3) | killed: pool shape, saturation, transaction                                                                               |
| M5 drop `ssl`                       | killed (2 of 3) | killed: 7 of 8 (the TLS-only server refuses; only the black-hole connect case still passes, as it does not depend on TLS) |
| M6 `500`                            | killed (1 of 3) | killed: saturation, connect timeout, transaction (elapsed below 1.8 s)                                                    |
| M7 add `idleTimeoutMillis: 60_000`  | killed (2 of 3) | killed: idle eviction only                                                                                                |

M6 and M7 are two mutants beyond the order's five. The source was restored byte for byte after the run (sha-256 `f43d1030…`, the fixed file; the file before this session was `713597f8…`).

## 4. Verification (`operation-service/`, HEAD `ed4ca861` plus the working tree)

| Check                                       | Baseline (before any edit)                | After                                                                                                                            |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                          | exit 0                                    | exit 0                                                                                                                           |
| `npm test` (`jest`)                         | 63 suites, 685 tests, 0 skipped, 0 failed | **65 suites (64 passed, 1 skipped), 697 tests: 689 passed, 8 skipped (the gated spec), 0 failed**; 685 + 1 outbox + 3 unit = 689 |
| `npm run build` (`prebuild` + `nest build`) | exit 0                                    | exit 0                                                                                                                           |
| `prettier --check --end-of-line auto`       | n/a                                       | clean on the four changed `.ts` files                                                                                            |
| `git diff --stat` (code)                    | n/a                                       | `prisma.service.ts` +1, `outbox-consumer.service.spec.ts` +17; two new specs; nothing else under `operation-service/`            |
| `package.json`, lockfile, schema            | n/a                                       | unchanged (`git status`)                                                                                                         |

`prisma.shutdown.spec.ts` did not flake in the full run. The gated spec run alone prints Jest's "did not exit one second after the test run" hint but exits 0, and `--detectOpenHandles` reports no handle; the plain `npm test` skips it. Versions (unchanged): `@prisma/adapter-pg` 7.9.1, `@prisma/client` 7.9.1, `pg` 8.22.0, `pg-pool` 3.14.0; Node v24.22.1 (CI uses 22); PostgreSQL 18.1 on the scratch server (production is 17.11; pool behaviour does not depend on it). The first "before" run used the fixture file before Prettier reformatted it (whitespace only).

## 5. The inventory (D6) in short

Full table: [inventory-d6.md](./2026-10-24-operation-pool-deadline-evidence/inventory-d6.md): 13 read rows and 25 write rows (a row groups routes of the same shape), the outbox consumer, and 6 background paths, including all six interactive transaction sites (`users.service.ts:820` and `:920`, `line-alerts.service.ts:121` and `:192`, `dispatcher.service.ts:37`, `account-deletion.worker.ts:162`). Findings:

- The outbox consumer: `outbox-consumer.service.ts:275` is before the Redis claim and outside the `try`; a checkout failure there is a 500 with **no claim and no e-mail**, the publisher retries, and the new unit case proves it (the claim release inside `dispatch` was already covered by existing tests).
- Of the six transaction sites, none changes behaviour from the deadline: the start fails as `P2028` at about 2 s either way.
- Reads: no route has more than three sequential checkouts; the busiest are three-await routes (Note 1 of the inventory).

## 6. Flagged rows (the order says: report to Davin before any commit; the order's D2 forbids a code change here)

| ID     | Path                                                                                          | What happens with the deadline                                                                                                                                                  | New in kind?                                                  |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **F4** | `AlertWorkerService`, `void this.reload()` on `alerts:changed` (`alert-worker.service.ts:81`) | a pool wait over 2 s rejects `reload()`; nobody catches it; Node ends the worker process (restart policy `ON_FAILURE`). At start-up the awaited `reload()` exits 1 the same way | **Yes: the only new failure mode.** Today the call just waits |
| F1     | `POST /auth/refresh`                                                                          | the old refresh token is revoked before the new one is issued and the user is read; a failure in between loses the session (the user logs in again)                             | No (any database error does it); the deadline adds a trigger  |
| F2     | `DELETE /drawings/:id`                                                                        | the drawing is deleted, then its `PRICE_TOUCH_LINE` alerts; a failure between leaves orphan alerts that count against the quota; a retry answers 404                            | No; same remark                                               |
| F3     | `DELETE /users/sessions`                                                                      | sessions are marked inactive before their `Session` rows are deleted; a retry finds none active, so the rows stay (whether anything reads `Session` was **not verified**)       | No; same remark                                               |
| F5     | alert fire worker concurrency (default 10) = pool max 10                                      | a burst can hold the worker's whole pool; fires retry (BullMQ, 5 attempts), but the reload and cron reads can wait                                                              | No                                                            |
| budget | three-await GET routes                                                                        | 3 x 2 s can exceed the 5 s read abort in the worst case                                                                                                                         | No (today the wait is unbounded)                              |

Informational: `getPreferences` answers 200 with defaults on any error (now also on a checkout timeout); `fetchXauusdPriceFromGatewayPipeline` falls back to the Flask price service on any error; `EmailLocaleService` falls back to English and UTC; `requestDeletion` swallows a failed user read after committing the request. Each swallows errors today.

## 7. Unconfirmed and found, not changed

- **Not verified:** production behaviour (nothing deployed); the healthy checkout distribution (no data); PgBouncer behaviour (the fixture talks to PostgreSQL directly); the worker's deployment and replica count; which `MIGRATE_*` flags are on in production; whether any code reads the `Session` table (F3); the production `ALERT_FIRE_CONCURRENCY`; that a production `DATABASE_URL` carries no `sslmode` (if it did, it would replace the service's `ssl` option, per the probe); money-service's publisher behaviour on a non-2xx (carried from the order, not re-read: out of scope).
- **F4's rejection** was shown with a Node probe of the same pattern, not by running the worker against a failing database.
- **Found, not changed:** `railway.json` (`startCommand: npm run start`) and `railway.toml` (two services, one `start:worker`) disagree about how many services this codebase becomes; which one Railway uses was not checked. `console.log` noise ("prisma:error ...") from the service's own error log level appears in the gated spec output.
- **Not claimed (the order's list):** any throughput gain; that normal checkout times are well under 2,000 ms; any bound on SQL after checkout, on PgBouncer queueing or on a whole request; that a timed-out acquisition left a request with no effects (F1 to F3 show rows where effects can exist).

## 8. Rollout and observation (after a push, Davin's call)

One push for this unit. Record the operation-service deployment ID and the `uptime` in `/health`. Observe 24 h of normal traffic: log lines with "timeout exceeded when trying to connect" and "Connection terminated due to connection timeout" (they are in the stack field of the 500 log, not in the response body); 504s from the monolith's operation-service client; 5xx on `POST /v1/outbox/events` and the publisher's retry counts; alert dispatcher and account-deletion worker errors; **worker restarts** (F4); the `/health` database status. **Revert criteria:** unexpected acquisition failures in normal traffic, caller failures, retry amplification, worker restarts, or an ambiguous state in any inventory row. **Rollback:** remove the field and redeploy `operation-service` only; this restores the unbounded wait and reverses no completed business effect.

## 9. Commit (only when Davin asks)

Explicit paths, no `git add -A`:

```
operation-service/src/prisma/prisma.service.ts
operation-service/src/prisma/prisma.pool.spec.ts
operation-service/src/prisma/prisma.pool.pg.spec.ts
operation-service/src/outbox/outbox-consumer.service.spec.ts
docs/migration-orders/adhoc-nest-pool-deadline-operation.migration-order.md
docs/migration-orders/adhoc-alert-worker-reload-catch.migration-order.md
docs/handoffs/2026-10-24-operation-pool-deadline-evidence.md
docs/handoffs/2026-10-24-operation-pool-deadline-evidence/
.claude/state/current-state.md
.claude/state/waiting-on.md
.claude/state/history/2026-10-sessions.md
.claude/state/history/index.md
.claude/architecture/environment-gotchas.md
.claude/protocols/verification-checklist.md
```

Suggested message: `fix(operation-service): bound pool checkout and connect to 2 s`. The plan (`davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md`) has been untracked since before this session; include it only if you want it in the history.

## 10. Cleanup

The scratch PostgreSQL 18.1 (postmaster PID 29456, hidden, `127.0.0.1:55471`) was stopped with `pg_ctl stop -m fast`; its data directory and the self-signed certificate and key were deleted; no `postgres.exe` of ours and no Jest or harness process is left; your PostgreSQL service on 5432 (PID 8540) was not touched.
