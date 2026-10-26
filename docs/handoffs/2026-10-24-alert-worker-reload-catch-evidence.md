# Evidence report: alert worker catches a failed watch reload (F4 of the operation-service pool deadline)

- **Date:** 2026-10-24 · **Executor:** Claude Code · **Basis:** `main` @ `c4e3a494` (working tree, **NOT committed, NOT pushed, NOT deployed**, no migration, no new variable; Davin said not to commit or push).
- **Order:** [adhoc-alert-worker-reload-catch](../migration-orders/adhoc-alert-worker-reload-catch.migration-order.md) (CONFIRMED; **D1 explicitly approved by Davin in chat**, D2 to D5 as proposed; "worker restart policy: not checked").
- **Origin:** finding F4 of the [P-operation evidence report](./2026-10-24-operation-pool-deadline-evidence.md) (§6).
- **The change:** one statement in `operation-service/src/alert-engine/alert-worker.service.ts:80-86`. `void this.reload();` on an `alerts:changed` message becomes
  `this.reload().catch((error) => this.logger.error('watch reload failed:', error));`. Nothing else in the file moved. **No comment was added** (as in the earlier units, so the diff is exactly what was signed off).
- **Raw evidence:** [the evidence folder](./2026-10-24-alert-worker-reload-catch-evidence/) (probe script, probe output before and after, mutation harness and results).

## 1. Needs from Davin

1. **Commit and push when you want them,** with or before the P-operation push (D3 of the order): the pool deadline (`c4e3a494`, local) is what makes this rejection reachable, so the two should be pushed together, as two commits.
   Explicit paths and message in §7. Nothing is pushed; `main` is 7 commits ahead of and 1 behind `origin/main`.
2. **You accepted the stale-cache trade-off (D1).** What it means in operation: after a failed reload the worker keeps running on the previous watch cache, and the only signal is the log line `watch reload failed:`. An alert created, changed or deleted since the last good reload is not reflected until the next
   `alerts:changed` message or a restart. After a push, search the logs for that line: if it ever appears in normal traffic, that is the moment to decide on a retry design (out of scope here).
3. **Restart policy of the worker: not checked** (by you or by me). It matters for the comparison with today (a crash used to refresh the watches by restarting the process); `railway.json` and `railway.toml` still disagree about the services.
4. No `active-tasks.md` items are left.

## 2. Changed and verified

| File                                                              | Change                                                                                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation-service/src/alert-engine/alert-worker.service.ts`      | **+5 / -1 lines**: the `.catch` (Prettier lays the statement out over four lines inside an `if` block)                                                                                        |
| `operation-service/src/alert-engine/alert-worker.service.spec.ts` | **+93 lines, 2 tests**: a failed reload logs and keeps the previous watches (and a message on another channel does not reload); the next successful reload replaces the cache after a failure |
| the order, this report and its folder, state files                | documentation and evidence only                                                                                                                                                               |

No other file under `operation-service/` changed; `package.json`, lockfile, schema and `dist/` (gitignored) are untouched in git. `railway-gateway/`, `money-service/`, the root monolith and every other service were not touched.

### 2.1 Before and after

| Layer                                                             | Unmodified code                                                                                                                                                                                                                                         | Fixed code                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Process probe on the compiled service (_installed-runtime probe_) | **the child process dies with exit code 1** the moment the second `findMany` rejects; the stack runs through `AlertWorkerService.reload` called from the `message` listener (`dist/alert-engine/alert-worker.service.js:62`); the later steps never run | the process **lives to the end** (exit 0): `ERROR [AlertWorkerService] watch reload failed:` with the pool-timeout error on stderr; the old cache (1 key) survives the failure; a message on another channel does not reload; the next successful reload replaces the cache (0 keys) |
| Unit spec (_mock_)                                                | **the 2 new cases fail** (the logger is never called: "Number of calls: 0"); the 8 existing cases pass                                                                                                                                                  | 10 of 10 pass                                                                                                                                                                                                                                                                        |

The probe runs the real compiled `AlertWorkerService` in a child Node process (v24.22.1) with `ioredis` replaced by an `EventEmitter` stub and Prisma, the queue and the dispatcher replaced by stubs: no database, no Redis, no network. It proves the **process-level** consequence (the same Node default that the P-operation report only showed with a generic script); it is not a database fixture and not the production worker.

### 2.2 Mutation check: 7 of 7 killed

Each mutant was applied to the TypeScript source (run against the worker spec) and to the compiled `dist` file (run against the probe), then both were restored byte for byte (sha-256 verified: source `2b3e5d37…`, dist unchanged). Results: [mutation-results.json](./2026-10-24-alert-worker-reload-catch-evidence/mutation-results.json).

| Mutant                              | Unit spec       | Process probe                                                      |
| ----------------------------------- | --------------- | ------------------------------------------------------------------ |
| W1 back to `void this.reload()`     | killed (2 of 2) | killed: the child exits 1                                          |
| W2 silent catch (`() => undefined`) | killed (2 of 2) | survives (the probe checks the process and the cache, not the log) |
| W3 `warn` instead of `error`        | killed (2 of 2) | survives (same reason)                                             |
| W4 log and rethrow                  | killed (2 of 2) | killed: the child exits 1                                          |
| W5 the catch clears the watch cache | killed (2 of 2) | killed: "the old cache survives a failed reload" fails             |
| W6 channel guard flipped (`!==`)    | killed (2 of 2) | killed: the first reload never runs                                |
| W7 log text changed                 | killed (1 of 2) | survives (same reason)                                             |

The three probe survivors are mutants about log wording; the unit spec is the layer that pins the log, the probe is the layer that pins survival and the cache. Neither layer alone is claimed to be enough.

## 3. Verification (`operation-service/`)

| Check                                 | Baseline (before any edit, HEAD `c4e3a494`)                        | After                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                    | exit 0                                                             | exit 0                                                                                                       |
| `npm test` (`jest`)                   | 65 suites (64 passed, 1 skipped), 697 tests: 689 passed, 8 skipped | **65 suites (64 passed, 1 skipped), 699 tests: 691 passed, 8 skipped, 0 failed** (689 + 2)                   |
| `npm run build`                       | exit 0                                                             | exit 0                                                                                                       |
| `prettier --check --end-of-line auto` | n/a                                                                | clean on the two changed `.ts` files                                                                         |
| `git diff --stat` (code)              | n/a                                                                | `alert-worker.service.ts` +5/-1, `alert-worker.service.spec.ts` +93; nothing else under `operation-service/` |

The gated pool fixture of the P-operation unit was not re-run (nothing it covers changed, and the scratch PostgreSQL was stopped); it is skipped in `npm test` as before. No scratch server or other process was started this time (the probe and the harness are short Node processes with hidden windows).

## 4. Unconfirmed and found, not changed

- **Not verified:** production behaviour (nothing deployed); the worker's restart policy and replica count; that the real Redis subscriber delivers `message` events to this listener the way the stub does (the listener registration is the existing `subscriber.on('message', ...)`, unchanged); that a stale cache never matters in practice (D1 accepts it).
- **The "before" probe was run with the first version of the probe script;** assertions (the cache and call-count checks) and the stripping of colour codes were added before the final "after" run. They only act after the first rejection, which the unmodified service never survives, so the "before" result (exit 1) does not depend on them.
- **The unit cases read the private `cache`** through a cast (the class exposes no accessor); they pin behaviour that an accessor-less class can only show that way.
- **Still floating, not touched (D5):** nothing else found. `void this.handlePrice(...)` is fully guarded; no other `void <call>(` in `operation-service/src` (non-spec) touches the database. The awaited `reload()` in `start()` still fails the bootstrap loudly (D2).
- **Not claimed:** that watches are never stale; a retry; anything about F1 to F3 and F5 of the P-operation report; production behaviour.

## 5. Rollout and observation (after the push, with or before the P-operation push)

Search the worker's logs for `watch reload failed:` and watch the worker's **restart count** (an increase above the baseline was the symptom of F4). **Revert criteria:** the log line appears in normal traffic, or an alert is reported as not firing after a change.
**Rollback:** put `void this.reload()` back and redeploy the worker; nothing to reconcile for data.

## 6. State written

`current-state.md` (new entry, the oldest rotated into `history/2026-10-sessions.md`, index row), `waiting-on.md` (F4 line updated), the order (CONFIRM note, Deviations, ticks).

## 7. Commit (only when Davin asks; he said not to this time)

Explicit paths, no `git add -A`:

```
operation-service/src/alert-engine/alert-worker.service.ts
operation-service/src/alert-engine/alert-worker.service.spec.ts
docs/migration-orders/adhoc-alert-worker-reload-catch.migration-order.md
docs/handoffs/2026-10-24-alert-worker-reload-catch-evidence.md
docs/handoffs/2026-10-24-alert-worker-reload-catch-evidence/
.claude/state/current-state.md
.claude/state/waiting-on.md
.claude/state/history/2026-10-sessions.md
.claude/state/history/index.md
```

Suggested message: `fix(operation-service): catch a failed alert watch reload instead of ending the worker`. The second-wave plan stays untracked unless Davin wants it in the history.
