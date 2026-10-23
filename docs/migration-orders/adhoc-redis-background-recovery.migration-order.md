# Migration Order — Ad-hoc Session — Redis background recovery (Unit R of the database-scaling second wave)

> **Status: CONFIRMED** — drafted by the Executor on 2026-10-23 from the feasibility plan
> ([plan](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md), work package 1) and the
> [architecture design](../../davintrade-database-scaling/database-scaling-second-wave-architecture.md) §3.
> **APPROVED by Davin in chat on 2026-10-23**, **CONFIRMED by the Executor on 2026-10-23** (entry criteria below). There was no
> separate Advisor DRAFT step: Davin's approval of the Executor's recommendations stands in for it, and every decision below is
> settled as proposed.
>
> **CONFIRM note (Executor, 2026-10-23).** Davin's sign-offs, as given in chat, verbatim:
>
> - **D1 (⚠ explicit sign-off): "APPROVED. The bounded slow failure trade-off (up to 3 s per Redis command during long outages, in
>   exchange for automatic recovery) is explicitly accepted."**
> - **D2 to D7: "APPROVED as proposed (capped linear delay `Math.min(times * 500, 30_000)`, root client only, real-Redis fixture on
>   random high port, accelerated delay shim, 24 h observation window)."**
> - **Vercel function time limit (D7): "15 seconds standard limit (60s for chat/engine4 routes)."** In the repository, only
>   `app/api/chat/message/route.ts:28` and `app/api/cron/world-gold/route.ts:7` export `maxDuration = 60`; the other routes in this
>   order's table have no `maxDuration`, so Davin's 15 s default is the ceiling used for the T5 route sums.
>
> Re-verified fresh before any edit: `HEAD` = `9b40bf3d`; `lib/redis/client.ts` and `__tests__/lib/redis/client.test.ts` byte-identical to
> the draft (`git diff 9b40bf3d HEAD` empty); tree clean apart from this order, the other two and the plan (all untracked);
> importers of the root helper unchanged (the eight consumers below, no new one); `rate-limit.ts` still has one production caller
> (`validate-discount/route.ts:51`); `redis-server` 8.4.0 at `C:\ProgramData\chocolatey\lib\redis\tools\redis-server.exe` (the
> fixture points at this real binary, not the Chocolatey shim, so a kill by PID leaves no child), none running; baselines in
> Deviations.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving configuration change with one
deliberate behaviour delta under a long outage (closest to `TEMPLATE-PORT.md`, dial **Low**) · **Status:** EXECUTED and verified locally, NOT committed ·
**Generated:** 2026-10-23 (Executor) · **Basis:** `main` @ `9b40bf3d` · **Flags touched:** none · **Estimated time:** ~3 h (one callback;
the real-Redis fixture and the outage-latency table are most of the work).

**Source:** design §3, plan WP1 and findings F1 to F3. Rule that applies: `EXECUTOR-PROTOCOL.md` §5 lists `frontend/` as SEPARATE_STACK, out of scope.

## Facts the Executor verified against live code (`9b40bf3d`)

- **The change site.** `lib/redis/client.ts:51-57`: `retryStrategy` returns `null` when `times > 10`, otherwise `Math.min(times * 500, 30000)`.
  Its comment says "exponential backoff"; the formula is linear. The rest of `REDIS_OPTIONS` (`:40-60`) is not part of this order:
  `connectTimeout` 5,000, `commandTimeout` 3,000, `maxRetriesPerRequest` 3, `enableReadyCheck`, `lazyConnect`; the offline queue is deliberately left on
  (the file's own comment: `enableOfflineQueue: false` rejects commands at once on a cold start).
- **The files the design edits, and the tests, are byte-identical to the design's baseline `de61737e`** (`git diff de61737e HEAD` on
  `lib/redis/client.ts` and `__tests__/lib/redis/client.test.ts` is empty at `9b40bf3d`).
- **What the cutoff does, read in the installed ioredis 5.11.1** (`node_modules/ioredis/built`): when `retryStrategy` returns a non-number the client
  is set to `end` and its queues are flushed (`redis/event_handler.js:187-215`); a command sent to an `end` client is rejected at once with
  "Connection is closed" (`Redis.js:343`); the retry counter resets only when the client becomes ready (`event_handler.js:228`), so the cutoff
  counts _consecutive_ failures. With a number returned, the client reconnects and, on every fourth attempt (`retryAttempts % (maxRetriesPerRequest + 1) === 0`,
  `event_handler.js:204-208`), flushes its queued commands with `MaxRetriesPerRequestError`. `commandTimeout` is applied when the command is issued, offline-queued
  commands included (`Redis.js:352-353`). **Time to the permanent dead state today:** about 27.5 s of back-off, up to about 80 s if packets are dropped
  (11 attempts of the 5 s connect timeout plus the back-off).
- **The existing test pins the cutoff.** `__tests__/lib/redis/client.test.ts:61-76`: `retryStrategy(11)` is expected `null` (`:74`) and `retryStrategy(2)` is expected `1000` (`:75`).
  The mock records constructor arguments only. This test must be rewritten, not just extended.
- **Precedent in the repo.** `operation-service/src/redis/redis.service.ts:16-21` and `money-service/src/redis/redis.service.ts` already use
  `Math.min(times * 500, 30000)` with no cutoff; the operation-service comment records the reason ("left this client … dead after a Redis restart longer than ~27 s").
  Those two, the Bull connections and the dedicated subscriber connections are not touched.
- **Production importers of the root helper** (searched `lib/`, `app/`, `components/`; `getRedisClient` and the helper's other exports) and the failure policy each one has **as read**:

  | Consumer                                        | Policy as read                                                                                                                                                                |
  | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `lib/cache/cache-manager.ts`                    | every function catches: `getCache` → `null`, `setCache`/`deleteCache` swallow and log, `incrementRateLimit` → `{ count: 1 }`                                                  |
  | `lib/idempotency/idempotency-guard.ts`          | `acquireIdempotencyLock` catches, logs, returns `true` (fail open)                                                                                                            |
  | `lib/rate-limit.ts`                             | **no try/catch.** One production caller: `app/api/payments/dlocal/validate-discount/route.ts:51`, inside the route's outer `try`. The other exports have no production caller |
  | `lib/engine4/server/idempotency.ts`             | `claimSubmission` catches → `UNGUARDED` (fail open); `completeSubmission` and `releaseSubmission` catch and never throw; claim 120 s, done 86,400 s                           |
  | `lib/drawing/invalidate.ts`                     | `publishAlertsChanged` is a no-op without `REDIS_URL`, catches, never throws                                                                                                  |
  | `lib/fx/shared-rate-store.ts`                   | its own 500 ms `Promise.race` (`REDIS_TIMEOUT_MS`), catches, warns; the race does not cancel the Redis command                                                                |
  | `lib/world-gold/fx.ts`                          | reads through its own `bounded()` wrapper and catches (`:285-294`)                                                                                                            |
  | `app/api/market/currency-gold-indices/route.ts` | mentions the singleton in comments only; reaches Redis through `cache-manager`                                                                                                |

- **`frontend/lib/redis/client.ts` has the same cutoff** but is a frozen copy from the initial `frontend/` commit (`0c443de0`), is not in the file list of
  `scripts/sync-frontend.sh`, and `frontend/` is SEPARATE_STACK (`EXECUTOR-PROTOCOL.md` §5). Not part of this order.
- **Fixture tools on this machine:** a real `redis-server` 8.4.0 (Chocolatey shim); Node 24.12 (CI runs 22); Docker is absent.
  The root Jest config collects only `**/__tests__/**/*.test.ts(x)` (`jest.config.js:124`), so a gated `*.redis.spec.ts` is not part of `test:ci`
  (precedent: the `*.pg.spec.ts` specs of the first batch).
- **Already softening an outage:** the first batch's `singleFlight` shares each cache fill per key per warm instance, and the public market routes also sit behind Vercel's CDN cache.

## Decisions taken

> **Proposed by the Executor; all seven APPROVED by Davin on 2026-10-23 as proposed, D1 with the explicit sign-off quoted in the CONFIRM note.**
> None touches money, auth semantics, secrets or CORS _as written_, but the helper sits under payment-adjacent guards (the idempotency
> lock, the validate-discount rate limit), hence the ⚠ on D1.

1. **D1 ⚠ NEEDS EXPLICIT SIGN-OFF (plan D1) — accept a bounded slow failure in exchange for automatic recovery.** Today an outage longer than about 30 to 80 s
   leaves the process with a permanently dead client whose commands fail instantly. After this order the client keeps reconnecting (delay capped at 30 s) and **each command
   issued during the outage waits up to 3 s (`commandTimeout`) before rejecting.** Sequential awaits add up (a cached market route does `get` and `set` around its loader; an engine4 submit
   does claim and complete). After Redis returns, the next reconnect attempt comes within 30 s. This is not a new failure mode (every instance already behaves this way for the first
   30 to 80 s of any outage), but it becomes persistent for the length of the outage. _Rejected:_ leaving the dead client; a circuit breaker or cool-down in this order (a lifecycle
   redesign the design excludes); lowering `commandTimeout` (changes a caller-visible policy); `enableOfflineQueue: false` (breaks the cold start). _If the measured table (step 5) is unacceptable:_
   stop, and open a separate circuit-breaker design rather than widening this patch. _Undo:_ low (revert).
2. **D2 — the change is the retry callback and its comment only:** `(times: number): number => Math.min(times * 500, 30_000)`, comment corrected to "capped linear delay, no retry-count cutoff". The delays
   are 500 ms at retry 1, 5,500 ms at retry 11, 30,000 ms from retry 60. No other option, no new client, no reconnect loop, no `connect()` per request. _Undo:_ low.
3. **D3 (plan D3) — scope is the root client only.** `frontend/lib/redis/client.ts` (SEPARATE_STACK, stale), the two Nest providers, Bull and the subscriber connections stay untouched.
   `disconnectRedis()` keeps its known limitation (it forgets the singleton only after `quit()` succeeds); not repaired here and not described as repaired.
4. **D4 (plan D5) — the proof is a gated real-Redis fixture, not a mock alone.** A new `__tests__/lib/redis/client-recovery.redis.spec.ts`, skipped unless `REDIS_FIXTURE_BIN` names a `redis-server`
   binary (no fallback to `REDIS_URL`, ever). The spec starts its own server on a random high port bound to 127.0.0.1 with persistence off, uses random key prefixes, never `FLUSHALL`, and stops the
   server by its own PID in `finally`. Each launch is announced to Davin before it runs. _Rejected:_ a hand-written RESP stub (would not exercise the real handshake and ready check), a mocked-callback test alone (cannot show socket recovery).
5. **D5 — accelerating the retries without hiding the policy.** A `jest.mock('ioredis')` shim wraps the options' **real** `retryStrategy` and divides only the delay it returns (for example by 100). A reinstated
   cutoff still returns `null` through the wrapper, so the fixture still catches it. `connectTimeout` and `commandTimeout` stay real. Not a replacement callback.
6. **D6 (plan D7) — rollout:** one push, one unit. A 24 h observation window on normal traffic before the next unit's push. **No production Redis outage is staged.** The monolith deploys on Vercel by push to `main`;
   Railway also rebuilds the three services (Watch Paths unset) with no source change. Confirm the live Vercel build (a push is not proof of a deploy).
7. **D7 (plan D8) — ordering:** first of the three orders; independent of the other two at runtime. Davin supplies the monolith's Vercel function time limit (plan tier or `maxDuration`) so the route sums in step 5 can be judged.

## Invariants (must not change)

- `getRedisClient()`, the lazy `redis` proxy, `isRedisConnected`, `getRedisStatus`, `disconnectRedis`, the `globalThis` reuse outside production, and the "one client per scope" rule; a `close` or `error`
  event never constructs a second client.
- `connectTimeout` 5,000, `commandTimeout` 3,000, `maxRetriesPerRequest` 3, `enableReadyCheck`, `lazyConnect`, the offline queue left on.
- Every consumer's key, TTL, expiry, fingerprint and error handling in the table above. No new fail-open or fail-closed rule is invented; where a consumer has no handling (`checkRateLimit`), the actual result is recorded, not assumed.
- No new environment variable or feature flag; no change to `package.json`, lockfiles, schema or any other service.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `git log -1` is `9b40bf3d` or a descendant; `lib/redis/client.ts` and `__tests__/lib/redis/client.test.ts` are unchanged since this draft (re-run `git diff 9b40bf3d HEAD` on both); tree clean apart from this order and the other two. _(HEAD `9b40bf3d`, both diffs empty, the only untracked files were the order, the other two and the plan.)_
- [x] Re-grep for new importers of the root helper (`grep -rn "lib/redis\|getRedisClient" lib app components`) and update the consumer table above; any consumer not in it gets a row before the fixture is written. _(no new importer; the eight rows stand.)_
- [x] Baselines recorded in Deviations before any edit: `npx tsc --noEmit`, `npm run lint`, `npm run test:ci` (the last known 564 suites and 18,725 tests are from 2026-10-20 and **predate the billing sessions**; take fresh counts). _(Deviations 2.)_
- [x] `redis-server --version` prints 8.x; the chosen port is free; no redis-server of ours is left running. _(8.4.0; the spec picks and probes a random port itself; `tasklist` showed none before and after every run.)_
- [x] Davin's D1 sign-off is recorded verbatim in the CONFIRM note; the Vercel function time limit (D7) is recorded. _(CONFIRM note above.)_
- [x] `.claude/architecture/environment-gotchas.md` re-read for the shell-working-directory drift (use absolute paths or a subshell) and the Windows process-start notes. _(read; the drift still happened once, see Deviations 9.)_

## Ordered steps (each carries its verification)

1. **Say what runs, then write the fixture first and watch it fail.** Announce the hidden `redis-server`. Write `client-recovery.redis.spec.ts` (cases below) and run it against the **unmodified** client.
   _Verify:_ T1 fails because the client reaches `end` after retry 11 and a later command rejects with "Connection is closed". Record the attempt count and the message in Deviations. This proves the fixture can see the bug.
2. **Apply D2.** Edit the callback and its comment in `lib/redis/client.ts`. _Verify:_ `npx tsc --noEmit`.
3. **Unit tests.** Rewrite `client.test.ts:61-76`: delays at retry 1 → 500, 2 → 1,000, 10 → 5,000, 11 → 5,500, 60 → 30,000, 10,000 → 30,000; every result finite, never `null`.
   Keep every other assertion (5 s, 3 s, 3 retries, lazy, ready check, offline queue not disabled, singleton, dev hot reload, production isolation, quit/forget/recreate). Add: a `close` or `error` event handler
   does not construct a second client. _Verify:_ `npx jest __tests__/lib/redis/client.test.ts --coverage=false`.
4. **Fixture cases** (`jest.setTimeout(120_000)`; refuse any URL whose host is not 127.0.0.1):
   - **T1 Recovery.** Stop the server for more than 12 reconnect attempts (record the count), restart it on the same port: the **same client object** answers `PING`, `SET` and `GET`; `getRedisStatus()` is `ready`; no process restart.
   - **T2 Cold start.** The first lazy command, issued while the server is still starting, succeeds within the existing command budget.
   - **T3 No reply.** `CLIENT PAUSE` makes the server stop answering: the command rejects within about 3 s. Afterwards the paused write is observed to have been applied, which documents that a timeout is not a cancellation.
   - **T4 Intentional close.** After `disconnectRedis()` there are no reconnect attempts and the next getter builds a fresh client. If a graceful `quit` cannot finish, `disconnect()` runs in `finally`.
   - **T5 Outage latency table.** With the client in the reconnecting state past attempt 11, time each helper: `getCache`, `setCache`, `checkRateLimit`, `acquireIdempotencyLock`, `claimSubmission`, `completeSubmission`, `releaseSubmission`, `publishAlertsChanged`, `readSharedUsdRates`, `writeSharedUsdRates`, and the world-gold read. Sum the route paths
     (market cache route, validate-discount, engine4 submit). **Flag any path with more than two sequential Redis awaits.**
   - **T6 Policy preserved, during the outage and after recovery.** Cache get → `null`; cache set swallowed; idempotency lock → `true` with a logged error; engine4 → `UNGUARDED`; publish never throws; FX store honours its 500 ms race;
     `checkRateLimit` → record the actual result; after recovery normal results, with the `NX`/`EX` claim TTLs read back from real keys equal to `CLAIM_SECONDS`, `DONE_SECONDS` and the default 30 s.
     _Verify:_ `REDIS_FIXTURE_BIN=<path> npx jest --coverage=false --testMatch "<root>/__tests__/lib/redis/client-recovery.redis.spec.ts"` (quote the glob carefully; the first batch hit a `cmd.exe` quoting problem), all cases green. Then confirm `npm run test:ci` does not collect the spec (its suite count must equal the baseline plus the unit-test changes only).
5. **Report the T5 table to Davin** (and every flagged path) before any commit. Davin's call per D1.
6. **Mutation check** with the fixture enabled: reinstate `times > 10 → null` (T1 and the delay test must fail); drop the 30,000 cap (the delay test fails); change `commandTimeout` (the options test fails);
   make the shim multiply instead of divide (T1 stops being fast, so a timeout fails it). Restore byte-identical (sha-256).
7. **Full verification:** `npx tsc --noEmit`, `npm run lint`, targeted Jest, `npm run test:ci` (counts equal baseline plus the new tests, 0 failed), `npm run build` (restore `next-env.d.ts` if it was rewritten), type-check of the touched tests with the
   throwaway tsconfig from the gotchas file, `npx prettier --check` on **the changed files only** (never a directory). `git diff --stat` shows only the files named here.
8. **Stop the fixture** by PID, delete its temp directory, confirm no `redis-server` of ours is left.
9. **Close.** Evidence report `docs/handoffs/2026-10-xx-redis-recovery-evidence.md` (T5 table, attempt counts, labels: _mock_, _installed-driver_, _real fixture_, _deployment observation_); state entry per `session-lifecycle.md`; fill Deviations.
   **Commit only if Davin asks,** by explicit paths, suggested message `fix(redis): keep reconnecting the root client after a long outage`. No push or deploy by the Executor.

## Done when

- The callback has no cutoff and the unit test shows the delays above; T1 to T6 pass against a real `redis-server`; the fixture failed on the unmodified client (step 1).
- Every invariant above holds (shown by the tests and the diff); the consumer table has no unexplained row; the T5 table is delivered to Davin and D1 stands.
- `tsc`, lint, targeted tests, `test:ci` and `build` are green; counts reported.
- **Not claimed:** any speed-up; recovery in production (none staged); that a suspended or terminated serverless instance recovers (it needs an active runtime and a reachable, valid endpoint); a repair of every terminal `end` state, of
  credential or configuration failures, or of the `disconnectRedis()` quit limitation.

## Rollback

Revert the commit and redeploy the monolith. No key, cache flush or data migration is involved. The old retry cutoff returns.

## Out of scope

U and P (the other two orders), the Nest Redis providers, Bull, `frontend/`, a circuit breaker or any lifecycle redesign, any change to a consumer's policy, a Redis client upgrade, alert-reload coordination.

## Deviations

_(filled during execution, never deleted; full evidence in [the evidence report](../handoffs/2026-10-23-2317-redis-recovery-evidence.md))_

1. **No separate Advisor DRAFT step.** Davin approved the Executor's recommendations directly in chat on 2026-10-23 (D1 with the explicit sign-off, D2 to D7 as proposed); the
   CONFIRM note records his words. Nothing in the decisions was changed.
2. **Baselines before the first edit (2026-10-23, `9b40bf3d`):** `npx tsc --noEmit` exit 0; `npm run lint` exit 0, 0 errors, 5 warnings; `npm run test:ci` **exit 1**: 593 of 598 suites
   (592 passed, **1 failed**, 5 skipped), 20,581 tests (20,265 passed, **1 failed**, 315 skipped). The failing suite is `__tests__/lib/email/i18n/templates.test.ts` ("isolates Latin and numeric values in a
   right-to-left message"): it expects `GST` in an Arabic date and this machine prints `غرينتش+4`. It failed before any edit; the S4 session on 2026-10-21 had the suite green and Node here is now v24.22.1 (the order said 24.12),
   so a Node/ICU update is the likely cause. **Not touched** (out of scope); it is why `test:ci` exits 1 here, before and after.
3. **Step 1 (fixture against the unmodified client):** 5 failed, 3 passed. The client gave up after **11** attempts (the callback returned `null` at the 11th), its status was `end`, and the first command after the restart was rejected in 0 ms with
   **"Connection is closed."** T2, T3 and T4 pass on the unmodified client (they do not depend on the cutoff). While writing the fixture I also found that `checkRateLimit` returns `{ success: true, remaining: NaN }` rather than throwing
   (a pipeline reports errors as results), in the dead state and in the outage alike; recorded, not changed.
4. **Fixture differs from the order's text in four places, all on purpose.** (a) The measured part of **T5 runs with the real retry delays**, not the accelerated shim: with delays divided by 100 the client would flush its offline queue
   (`MaxRetriesPerRequestError`, every 4th attempt) within milliseconds and report latencies far below 3 s; so the shim accelerates only up to attempt 11 and the divisor becomes 1 from attempt 12 (T2 also uses real delays). (b) `REDIS_FIXTURE_BIN` points at the real
   `redis-server.exe`, not the Chocolatey shim, so a kill by PID cannot orphan a child. (c) T5 includes three route-level rows (market cache, engine4 submit twice, validate-discount) made by running the real helpers in the route's order, database left out. (d) T6 gained a case the order
   did not list: **commands that timed out during the outage are still sent when the client reconnects** (observed, pinned; evidence report §6).
5. **World-gold read measured without a provider key** (the fixture deletes `CURRENCYBEACON_API_KEY`; `next/jest` loads the repo's `.env` files, which could carry one), so it stops at the first store read (605 ms). Its three-step refresh path is flagged by reading the code (at most 1.8 s of Redis wait).
6. **Fixture bugs fixed before the final runs (mine, not product behaviour):** the console spy was installed after the outage suite's `beforeAll` had already run, and the shared `afterEach` disconnected the outage suite's client after its first test. Both were visible as red T6 cases on the first fixed-client run and
   corrected; the sockets are now awaited to `end` before the server is stopped, and a 5 s timer in the alerts check was made cancellable (Jest had reported an open handle).
7. **Mutation check:** the order's four mutants plus one (M5, constant 500 ms delay): **5 of 5 killed**, files restored byte-identical (sha-256). M2 (cap dropped) was killed by the delay test alone, as predicted.
8. **Type-check of the touched tests** (throwaway tsconfig, deleted) reports one error, `client.test.ts:146` (`process.env['NODE_ENV'] = 'production'`, read-only property). The line is unchanged from `HEAD` (line 114 there), so it predates this order; left alone (scope).
9. **Shell working directory drifted once** (a `cd` inside one command, inside `node_modules`); noticed from the environment notice and reset; every later command used an absolute path or a subshell.
10. **`consumer table`:** no unexplained row. One addition for the reader: `lib/world-gold/fx.ts` also uses the root client for the refresh lock and the observation publish, not only the read; all three are inside the file's own 600 ms race.
11. **Step 5 delivered; D1 stands.** The T5 table (up to 3.0 s per Redis call during an outage, 6.0 s worst route, no flagged path beyond the world-gold refresh's 1.8 s) was reported to Davin, who answered in chat on 2026-10-24: "D1 stands: I accept the T5 table (up to 3.0 s per Redis call, 6.0 s worst route). Do not commit yet; I will ask when I want it." Nothing is committed.

## Next-session handoff (PRE-DRAFT notes for the following order, not a plan)

- Next order in the sequence: [`adhoc-gateway-upsert-id-only-returning`](adhoc-gateway-upsert-id-only-returning.migration-order.md) (independent), then [`adhoc-nest-pool-deadline-operation`](adhoc-nest-pool-deadline-operation.migration-order.md).
- Whatever T5 shows may justify a separate circuit-breaker design; that is Davin's call, not part of this order.
