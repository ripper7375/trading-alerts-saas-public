# Unit R, Redis background recovery: evidence report

**Date:** 2026-10-23 · **Branch:** `main` on `9b40bf3d` · **Order:** [adhoc-redis-background-recovery](../migration-orders/adhoc-redis-background-recovery.migration-order.md)
(CONFIRMED; Davin's D1 sign-off and D2 to D7 approval are quoted in its CONFIRM note) · **Plan:** [work package 1](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md)
· **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT deployed.** No production Redis outage was staged and none is proposed.

## 1. What changed

One production file, one statement: the root client's retry callback in `lib/redis/client.ts`.

```diff
-  retryStrategy: (times: number): number | null => {
-    // Retry with exponential backoff, max 30 seconds
-    if (times > 10) {
-      return null; // Stop retrying
-    }
-    return Math.min(times * 500, 30000);
+  retryStrategy: (times: number): number => {
+    // Capped linear delay (500 ms per attempt, at most 30 s), no retry-count
+    // cutoff. Returning null would end the client for good: ioredis then
+    // rejects every later command with "Connection is closed" and the process
+    // never reaches Redis again after an outage longer than the cutoff.
+    return Math.min(times * 500, 30_000);
```

For attempts 1 to 10 the returned delay is the same number as before; only attempt 11 and later differ (5,500 ms, then 6,000 ... capped at 30,000 ms, instead of `null`).
Nothing else in the file moved: `connectTimeout` 5,000, `commandTimeout` 3,000, `maxRetriesPerRequest` 3, `enableReadyCheck`, `lazyConnect`, the offline queue on, the singleton,
the `globalThis` reuse, the event handlers and `disconnectRedis()` are byte-identical.

| File                                                                       | Change                                                                                                                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/redis/client.ts`                                                      | the callback and its comment (+6 / −6)                                                                                                                                            |
| `__tests__/lib/redis/client.test.ts`                                       | the pinned cutoff replaced by the delay table; a recorded-handler mock; one new test that a `connect`, `error` or `close` event never builds a second client (12 tests became 14) |
| `__tests__/lib/redis/client-recovery.redis.spec.ts`                        | **new**, gated on `REDIS_FIXTURE_BIN`, not collected by `test:ci`; 8 tests, T1 to T6                                                                                              |
| `docs/migration-orders/adhoc-redis-background-recovery.migration-order.md` | CONFIRM note, status, Deviations (untracked file, as the earlier ad-hoc orders)                                                                                                   |

## 2. Environment (as installed)

| Item                  | Value                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ioredis               | 5.11.1 (read in `node_modules/ioredis/built`: `event_handler.js:187-228, 296-308`, `Redis.js:343-353`, `Pipeline.js:234-352`, `Command.js:191-199`)                               |
| redis-server          | 8.4.0, the real binary `C:\ProgramData\chocolatey\lib\redis\tools\redis-server.exe` (not the shim, so a kill by PID leaves no child)                                              |
| Node                  | **v24.22.1** here (the order said 24.12; CI runs 22)                                                                                                                              |
| Fixture               | one server per run on a random port in 20000 to 59999, 127.0.0.1 only, persistence off, no `FLUSHALL`, killed by PID, temp directory deleted; none was left running after any run |
| Vercel function limit | 15 s default; 60 s for the chat and engine4 routes (Davin). In the repository only `chat/message` and `cron/world-gold` export `maxDuration = 60`                                 |

## 3. Results, with their labels

### 3.1 Step 1: the fixture against the UNMODIFIED client (_real fixture_)

`Tests: 5 failed, 3 passed`. T2, T3 and T4 pass (they do not depend on the cutoff); T1, T5 and the three T6 cases fail, which shows the fixture can see the bug.

| Measurement                               | Unmodified client                                 |
| ----------------------------------------- | ------------------------------------------------- |
| Attempts before the client gave up        | **11** (the callback returned `null` at the 11th) |
| Client status after the server returned   | **`end`**, for good                               |
| First command after the restart           | rejected in 0 ms with **"Connection is closed."** |
| Latency of every helper during the outage | 9 to 28 ms (instant failure); route paths 7 ms    |

### 3.2 Step 4: the fixture against the FIXED client (_real fixture_)

`Tests: 8 passed, 8 total` (final run: T1 870 ms, T2 571 ms, T3 5.1 s, T4 543 ms, the outage suite about 22 s). The final form passed twice in a row.

| Case                     | Result                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1 recovery**          | server down for **14 reconnect attempts** (real callback delays 500, 1,000 ... 5,000, **5,500, 6,000, 6,500, 7,000**; the shim divided them by 100), restarted on the same port: status was `reconnecting`, the **same client object** answered `PING`, `SET` and `GET`, `getRedisStatus()` was `ready`, one client was constructed |
| **T2 cold start**        | the first lazy command was issued while the server was not listening: attempt 1 refused, the 500 ms retry connected, `PONG` after 0.5 s (well inside the 3 s budget), real delays                                                                                                                                                   |
| **T3 no reply**          | `CLIENT PAUSE 5000 WRITE`: the `SET` rejected with "Command timed out" after **3,003 to 3,013 ms**; the paused write **was applied** once the pause ended (a timeout is not a cancellation); the connection stayed usable                                                                                                           |
| **T4 intentional close** | after `disconnectRedis()`: zero reconnect attempts in 500 ms, status `end`, `getRedisStatus()` is `not_initialized`, the next getter builds a different client that answers `PING`; every client is `disconnect()`ed in `finally` and the sockets are awaited before the server is stopped                                          |
| **T5 latency table**     | §4                                                                                                                                                                                                                                                                                                                                  |
| **T6 policy**            | §5                                                                                                                                                                                                                                                                                                                                  |

### 3.3 Unit test (_mock_)

`npx jest __tests__/lib/redis/client.test.ts --coverage=false`: **14 passed**. Delays at retry 1, 2, 10, 11, 60 and 10,000 are 500, 1,000, 5,000, 5,500, 30,000 and 30,000;
retries 1 to 1,000 are all finite, positive, at most 30,000 and never `null`; every other assertion of the old file is kept.

### 3.4 Mutation check (_real fixture_ plus _mock_)

A harness in the session scratchpad applied one mutant at a time to a backed-up copy, ran the unit test and the fixture together, and restored the file byte for byte (sha-256 compared after
each mutant and at the end: `client.ts` `9ecb880e...`, the spec `8f6d64ed...` at that time). **5 of 5 killed**, no survivor, no timeout.

| Mutant                                          | Killed by                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| M1 `times > 10 -> null` reinstated              | the delay test, T1, T5, T6 (5 failures)                                                     |
| M2 the 30,000 cap dropped                       | the delay test only (1 failure), as the order predicted                                     |
| M3 `commandTimeout` 3,000 to 4,000              | the options test and T5 (2 failures)                                                        |
| M4 the shim multiplies instead of divides       | T1, T5 and the T6 cases that need the outage (4 failures; 174 s because the waits time out) |
| M5 the delay stays at 500 ms instead of growing | T5, a T6 case and the delay test (3 failures)                                               |

## 4. T5, the outage latency table (_real fixture_, for D1)

Measured in the **reconnecting state past attempt 11**, with the **real** retry delays (attempt 12 returned 6,000 ms) and the **real** 3 s command timeout, three rounds of every helper at once
right after the attempt-12 flush of the offline queue. The route rows run the real helpers one after the other, with the database and other work left out.

| Path (helpers called in this order)                |           Redis calls in a row | Min / median / max (ms) | Result during the outage                                           |
| -------------------------------------------------- | -----------------------------: | ----------------------: | ------------------------------------------------------------------ |
| `getCache`                                         |                              1 |      3004 / 3012 / 3012 | `null`                                                             |
| `setCache`                                         |                              1 |      3004 / 3011 / 3012 | resolves, error logged                                             |
| `checkRateLimit`                                   |                 1 (a pipeline) |      3003 / 3011 / 3012 | **`{ success: true, remaining: NaN }`**, no throw                  |
| `acquireIdempotencyLock`                           |                              1 |      3003 / 3011 / 3012 | `true`, error logged                                               |
| `claimSubmission`                                  |                              1 |      3003 / 3010 / 3012 | `{ state: 'UNGUARDED' }`                                           |
| `completeSubmission`                               |                              1 |      3003 / 3010 / 3012 | resolves                                                           |
| `releaseSubmission`                                |                              1 |      3003 / 3010 / 3012 | resolves                                                           |
| `publishAlertsChanged`                             |                              1 |      3003 / 3010 / 3012 | resolves, error logged                                             |
| `readSharedUsdRates` (own 500 ms race)             |                              1 |         512 / 515 / 527 | `null`                                                             |
| `writeSharedUsdRates` (own 500 ms race)            |                              1 |         513 / 515 / 528 | resolves                                                           |
| `getWorldGoldFx`, no API key (own 600 ms race)     |                              1 |         603 / 605 / 611 | `null`                                                             |
| `getFxAtClose` (own 600 ms race)                   | 1 (stops at the first failure) |         604 / 605 / 611 | resolves                                                           |
| **Market cache route** (get, DB, set)              |                              2 |                    6023 | the route still answers from the database, **6.0 s of Redis wait** |
| **Engine4 submit** (claim, work, complete)         |                              2 |                    6022 | goes ahead unguarded, **6.0 s**                                    |
| **Engine4 submit, failing** (claim, work, release) |                              2 |                    6022 | **6.0 s**                                                          |
| **validate-discount** (`checkRateLimit`)           |                              1 |                    3010 | lets the request through, **3.0 s**                                |

**Before the change, in the dead state,** the same helpers returned the same values in 9 to 28 ms and the route paths in 7 ms (§3.1). The delta of this order is exactly "+3.0 s per Redis call, for the length of the outage".

Against Davin's limits: the worst Redis wait on any route is **6.0 s**, so a market route keeps at least 9 s of the 15 s default for its database read; the engine4 routes have 60 s.

**Paths with more than two sequential Redis awaits (flag).** By reading the code, one: `refreshFx` in `lib/world-gold/fx.ts` (the hourly world-gold refresh behind `getWorldGoldFx`) can wait on a store read, then the
refresh lock, then the observation publish. **Each of the three is wrapped in its own 600 ms race, so the Redis part is at most 1.8 s**, plus the provider fetch (3 s limit) that was already there. The no-API-key
case, which is what the fixture can run offline, stops at the first read (605 ms above). Not measured with a provider key (it would call the network). Every other path in the consumer table has one or two calls.
Helpers with more calls (`trackAiTokenUsage`: three, no `try`; `incrementRateLimit`; `deleteCachePattern`) have **no production caller** (searched `app/`, `lib/`).

## 5. T6, the failure policy of every consumer (_real fixture_)

| Consumer                                          | During the outage (asserted)                                                                                                                                                              | After recovery (asserted)                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cache-manager` get / set                         | `null` / swallowed, `Cache get error:` and `Cache set error:` logged                                                                                                                      | value round trip, TTL 56 to 60 s read from the key, a missing key is `null`                                                                                           |
| `idempotency-guard`                               | `true` (fail open), `[Idempotency] Redis lock check failed` logged                                                                                                                        | first `true`, repeat `false`, TTL read back 28 to 30 s (the default 30)                                                                                               |
| `lib/rate-limit.ts` `checkRateLimit`              | **no handling; the pipeline reports each command's error as a result, so nothing throws and the helper returns `success: true` with `remaining: NaN`** (also true of the old dead client) | limit 3: `true, true, true, false`, remaining `2, 1, 0, 0`                                                                                                            |
| `engine4/server/idempotency`                      | `claimSubmission` is `UNGUARDED`; complete and release never throw; guard failure logged                                                                                                  | claim `CLAIMED` with TTL = `CLAIM_SECONDS` (120), repeat `IN_FLIGHT`, complete TTL = `DONE_SECONDS` (86,400), repeat `DONE` with the outcome, release removes the key |
| `drawing/invalidate`                              | resolves, `publishAlertsChanged failed:` logged                                                                                                                                           | a subscriber on `alerts:changed` receives the payload                                                                                                                 |
| `fx/shared-rate-store`                            | read `null`, write resolves, both within their own 500 ms race                                                                                                                            | a valid table is written with a TTL of 1,700 to 1,800 s and read back equal                                                                                           |
| `world-gold/fx`                                   | `getWorldGoldFx` `null`, `getFxAtClose` resolves, within the 600 ms race                                                                                                                  | `getWorldGoldFx` is a clean `null` with nothing stored and no key, no error logged                                                                                    |
| `app/api/market/currency-gold-indices` + siblings | reach Redis only through `cache-manager` (above)                                                                                                                                          | same                                                                                                                                                                  |

After recovery a healthy Redis logged nothing (`console.error` not called).

## 6. Things the fixture showed that the order did not list

1. **A command that timed out during the outage is still sent after the client reconnects** (ioredis 5.11.1 `event_handler.js:296-308` re-sends the offline queue without looking at whether
   the command had already been rejected). Observed: after recovery the keys written by the outage's `setCache`, `acquireIdempotencyLock` (TTL 29 s) and `completeSubmission` were present.
   Bounded: every 4th reconnect attempt (`maxRetriesPerRequest` 3 plus one) flushes the queue with `MaxRetriesPerRequestError`, so at most about three attempts' worth of commands survive
   (about two minutes at the 30 s cap). Effect on the consumers, as read: a late cache write gives a value up to that old a fresh TTL; a late idempotency or engine4 claim makes a
   retry of the same key look like a duplicate for the claim's length (the engine4 claim is then followed in the queue by its own complete or release). This also happened in the first 30 to 80 s of every outage before this
   change; the order is that it can now happen after a long outage too. Pinned by T6 so that an ioredis upgrade that changes it is noticed.
2. **`checkRateLimit` fails open with `remaining: NaN`**, in the outage and, before this change, with the dead client. The only production caller (`validate-discount/route.ts:51`) reads `success` only, so the
   anti-enumeration limit is simply not enforced while Redis is down, as it was. Not changed (Davin's invariant: no consumer policy is touched).
3. **`pipeline.exec()` did not reject** on a command timeout or on a closed client in any run (each command's error is returned as its result), which is why item 2 holds; the helpers that use single commands do reject, and their `try` catches it.
4. A teardown `ECONNRESET` seen once in a middle run was the fixture's own (a server killed while a client was still closing); the fixture now waits for `end` before stopping the server.

## 7. Full root verification

| Check                                                | Baseline (before any edit)                                                                | After                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                   | exit 0                                                                                    | exit 0                                                                                                                                                                                             |
| `npm run lint`                                       | exit 0, 0 errors, 5 warnings                                                              | exit 0, 0 errors, the same 5 warnings                                                                                                                                                              |
| `npm run test:ci`                                    | 593 of 598 suites (592 passed, 1 failed, 5 skipped); 20,265 passed, 1 failed, 315 skipped | 593 of 598 suites (592 passed, 1 failed, 5 skipped); **20,267 passed**, 1 failed, 315 skipped (+2 = the two new unit tests; the redis spec is not collected)                                       |
| Redis unit test                                      | 12 tests                                                                                  | 14 tests, all passed                                                                                                                                                                               |
| Redis fixture                                        | n/a                                                                                       | 8 of 8 passed (and 5 of 8 failed on the unmodified client)                                                                                                                                         |
| `npx prettier --check --end-of-line auto`            | n/a                                                                                       | the four changed files pass (never run on a directory)                                                                                                                                             |
| Type-check of the touched tests (throwaway tsconfig) | n/a                                                                                       | one error, `client.test.ts:146` `process.env['NODE_ENV'] = 'production'` (read-only property); **the line is unchanged from `HEAD` (line 114 there)**, so it predates this order and is left alone |
| `npm run build`                                      | n/a                                                                                       | see §8                                                                                                                                                                                             |

**The one failing suite is not from this order.** `__tests__/lib/email/i18n/templates.test.ts` ("isolates Latin and numeric values in a right-to-left message") expects the Arabic e-mail date to end in `GST`;
this machine's Node 24.22.1 prints the zone as `غرينتش+4`. It failed identically in the baseline taken before the first edit, and the S4 session recorded the same suite green on 2026-10-21 (593 passed), so the likely cause is a
Node/ICU update on this machine since then, not the code. Not touched (out of scope). `test:ci` therefore exits 1 on this machine until that is looked at.

## 8. Build and the working tree

`npm run build` (Next.js production build): **exit 0**. It rewrote `next-env.d.ts` (single to double quotes in two import lines); restored with `git restore next-env.d.ts` and the hash matches the pre-build file.

`git status` after everything, the files this session touched and nothing else:

```
 M __tests__/lib/redis/client.test.ts
 M lib/redis/client.ts
?? __tests__/lib/redis/client-recovery.redis.spec.ts
?? docs/handoffs/2026-10-23-2317-redis-recovery-evidence.md
?? docs/migration-orders/adhoc-redis-background-recovery.migration-order.md
?? (also untracked, not from this session's edits: the plan and the other two orders)
```

The close also edits `.claude/state/current-state.md` (a new entry, the oldest rotated), `.claude/state/history/2026-10-sessions.md` and `index.md`, and `.claude/state/waiting-on.md` (one index line); `git status` lists them as modified. No `redis-server` of ours is running; the scratch directories are deleted.

## 9. Not claimed

- Any speed-up. Normal operation is unchanged; the first ten delays are the same numbers.
- Recovery in production. None was staged, and none will be (no production Redis outage).
- That a suspended or terminated serverless instance recovers: reconnecting needs a running runtime and a reachable endpoint with valid credentials.
- A repair of every terminal `end` state, of credential or configuration failures, or of the `disconnectRedis()` limitation (it forgets the singleton only after `quit()` succeeds).
- The Nest providers (`operation-service`, `money-service`), Bull, the subscriber connections and `frontend/lib/redis/client.ts` (a stale copy; `frontend/` is SEPARATE_STACK) are untouched.

## 10. Rollout and rollback

- **Rollout (D6):** one push, one unit; Vercel builds the monolith from `main`, Railway rebuilds the three services with no source change. A push is not proof of a deploy: confirm the live Vercel build.
  Observe 24 h of normal traffic before the next unit's push: the rate of `Redis client error:`, `Cache get error`, `[Idempotency] Redis lock check failed`, and the origin database load behind the market caches.
  A rise in `Redis client error:` lines after a Redis restart is expected now (the client keeps trying, one line per attempt); a **permanent** silence after one is what the change removes.
- **Rollback:** revert the commit and redeploy the monolith. No key, cache flush or data migration is involved; the old cutoff returns.
- **Commit:** only if Davin asks, by explicit paths: `lib/redis/client.ts`, `__tests__/lib/redis/client.test.ts`, `__tests__/lib/redis/client-recovery.redis.spec.ts`, the order file, this report, and the state files.
  Suggested message `fix(redis): keep reconnecting the root client after a long outage`.

## 11. How to run the fixture again

```bash
REDIS_FIXTURE_BIN='C:/ProgramData/chocolatey/lib/redis/tools/redis-server.exe' npx jest --coverage=false --runInBand --testMatch '**/__tests__/lib/redis/client-recovery.redis.spec.ts'
```

It starts its own hidden `redis-server` on a random port and stops it by PID. Allow about 30 s. `REDIS_FIXTURE_REPORT=<file>` appends the evidence lines (the T5 table, the attempt counts) as JSON.
