# Migration Order — Ad-hoc Session — Alert worker: catch a failed watch reload (F4 of the operation-service pool deadline)

> **Status: CONFIRMED** — drafted by the Executor on 2026-10-24 from finding **F4** of the
> [P-operation evidence report](../handoffs/2026-10-24-operation-pool-deadline-evidence.md) (§6) and its
> [inventory](../handoffs/2026-10-24-operation-pool-deadline-evidence/inventory-d6.md) (section D).
> **APPROVED by Davin in chat on 2026-10-24**, **CONFIRMED by the Executor on 2026-10-24** (entry criteria below). There was no separate Advisor DRAFT step: Davin's approval of the
> Executor's recommendations stands in for it, and every decision below is settled as proposed.
>
> **CONFIRM note (Executor, 2026-10-24).** Davin's sign-off, as given in chat, verbatim:
>
> - **"APPROVED. D1 of adhoc-alert-worker-reload-catch is explicitly approved (catch and log a failed watch reload, stale cache until the next alerts:changed or restart is accepted); D2 to D5 as proposed. Worker restart policy: not checked. Confirm the order and execute it, but do not commit or push."**
> - **Runtime fact stated by Davin:** the restart policy of the worker was **not checked** (by him either); the order records "restart policy of the worker: not checked".
> - **Instruction:** execute, **do not commit or push** (the order's step 7 already says commit only if Davin asks).
>
> Re-verified fresh before any edit: `HEAD` = `c4e3a494` (the P-operation commit, a descendant of `ed4ca861`); `alert-worker.service.ts` and `alert-worker.service.spec.ts` unchanged since this draft (blob hashes `2fcd20f9…` and `077b3cc7…`, and
> `git diff ed4ca861 HEAD -- operation-service/src/alert-engine` is empty); tree clean apart from the second-wave plan (untracked since before the wave). Baselines are in Deviations.
> **D1 is marked ⚠ NEEDS EXPLICIT SIGN-OFF.** It does not touch money, auth, secrets or CORS, but it replaces a loud failure (the worker process ends and restarts) with a quiet one
> (a log line, and a watch cache that may be stale until the next change), so it changes what happens to alert delivery when the database is slow or down.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** failure-handling fix, one statement
(closest to `TEMPLATE-PORT.md`, dial **Low**) · **Status:** EXECUTED and verified locally, NOT committed · **Generated:** 2026-10-24 (Executor) · **Basis:** `main` @ `c4e3a494` (`ed4ca861` plus the P-operation commit) ·
**Flags touched:** none · **Estimated time:** ~1 h (one statement; the proof is a unit case and a child-process probe).

**Source:** F4 of the P-operation evidence report. **Related order:** [`adhoc-nest-pool-deadline-operation`](adhoc-nest-pool-deadline-operation.migration-order.md) (the pool deadline that creates the trigger).

## Facts the Executor verified against live code (`ed4ca861`)

- **The defect.** `operation-service/src/alert-engine/alert-worker.service.ts:80-82`:
  `this.subscriber.on('message', (channel) => { if (channel === 'alerts:changed') void this.reload(); });`. `reload()` (`:90-106`) awaits `this.prisma.drawingAlert.findMany(...)`; if that rejects,
  the promise returned by `reload()` is discarded by `void` and nobody handles the rejection. The handler itself is synchronous, so `try/catch` around it would not help.
- **Consequence.** Node's default for an unhandled rejection is to throw it as an uncaught exception and end the process. Probe on this machine (Node v24.22.1, 2026-10-24): a script with the same shape
  (`void reload()` in an `EventEmitter` handler, `reload()` rejecting with "timeout exceeded when trying to connect") exits with code **1** and prints the error. The rule has been the default since Node 15, and
  `engines` is `>=20`. A search of `operation-service/src` (non-spec), `@nestjs/core`, `@opentelemetry/sdk-node` and `bullmq` found **no `unhandledRejection` handler**; `otel.ts` registers only `SIGTERM` and `SIGINT`.
- **Why the pool deadline matters.** Today a saturated pool makes `reload()` wait (no deadline), so it does not reject for that reason; it rejects only on a real database error. With
  `connectionTimeoutMillis: 2_000` (the P-operation unit) a wait over 2 s rejects it. The worker has its own pool of 10 and the alert fire queue runs with concurrency 10 by default (`alert-worker.service.ts:66`),
  so a burst of fires can hold the whole pool while an `alerts:changed` message arrives.
- **What a crash does today.** `main-worker.ts:51` ends with `process.exit(1)` only for a failed bootstrap; an unhandled rejection later ends the process the same way. `railway.json` sets `restartPolicyType: ON_FAILURE`;
  `railway.toml` declares the worker as its own service; which file Railway uses for the worker was **not checked**. On restart `start()` runs `await this.reload()` again, so a crash is a crude, whole-process way to refresh the watches
  (and it also drops the price subscription and the BullMQ fire worker for the restart time).
- **State kept on failure.** `reload()` builds a new map and assigns `this.cache = next` only after the query and the loop succeed (`:95-104`), so a failed reload leaves the previous cache intact.
- **The other floating promise next to it is safe.** `void this.handlePrice(...)` (`:78`): `handlePrice` parses inside `try`, evaluates inside `try` and logs `evaluation error:` (`:123-127`). A search for `void <call>(` and for
  message handlers across `operation-service/src` (non-spec) finds no other floating promise that touches the database. `start()` awaits its own `reload()` (`:73`), so a failed reload at boot fails the bootstrap loudly (exit 1) as it should.
- **Tests today.** `alert-worker.service.spec.ts` (`077b3cc7…`, 8 tests) mocks `ioredis` with `on = jest.fn()`; no test calls the registered `message` handler. The handler is reachable from `on.mock.calls`.
- **Logger.** The class already has `private readonly logger = new Logger(AlertWorkerService.name)` and logs errors as `this.logger.error('evaluation error:', error)` (`:126`).

## Decisions taken

> **Proposed by the Executor; to be settled by the Advisor and approved by Davin.**

1. **D1 (⚠ NEEDS EXPLICIT SIGN-OFF) — catch the rejection and log it; change nothing else.** Replace the discarded promise with
   `this.reload().catch((error) => this.logger.error('watch reload failed:', error))` (Prettier will lay it out over a few lines; it is one statement). The previous cache stays in use.
   **The trade-off Davin is signing:** a failed reload no longer ends the process. The worker keeps evaluating prices against the **previous** watch cache, so an alert created, changed or deleted since the last good reload is not
   reflected until the **next** `alerts:changed` message or the next restart, and the only signal is the log line `watch reload failed:`. There is no retry. _Rejected:_ swallowing without a log (hides it);
   a retry with back-off or a periodic reload (a design of its own, more than one statement, and it needs its own stale-cache test); ending the process on purpose (what happens today, by accident);
   a process-wide `unhandledRejection` handler (it would also hide unrelated bugs). _Undo:_ low (put `void this.reload()` back).
2. **D2 — `start()` is unchanged.** The awaited `await this.reload()` at boot keeps failing the bootstrap (exit 1). A worker that cannot load its watches at start must not run empty.
3. **D3 — sequencing with the P-operation unit.** The pool deadline is what makes the rejection reachable under saturation, so this fix should be **in the same push as the P-operation unit, or before it**, never after.
   Recommended: a separate commit, pushed together (the plan's "one unit per push" rule exists so a regression can be attributed; this change is part of making that unit safe, and its own log line tells the two apart).
4. **D4 — proof is three layers, each labelled:** (a) one new unit case in `alert-worker.service.spec.ts` that drives the registered `message` handler with a rejecting `reload` (_mock_);
   (b) a child-process probe against the **compiled** service (`dist/alert-engine/alert-worker.service.js`) with `ioredis` and the other collaborators replaced by stubs, run before and after: exit code 1 before, the process alive after (_installed-runtime probe_, not a database fixture);
   (c) the existing P-operation fixture is not extended. A passing mock is not accepted as the proof.
5. **D5 — no other floating promise is touched.** F1 to F3 and F5 of the same report, the awaited `reload()` in `start()`, and the pool value are out of scope.

## Invariants (must not change)

- `start()`, `stop()`, `onModuleDestroy()`, the subscriptions (`prices:*`, `alerts:changed`), the topology of two dedicated Redis connections, and `reload()`'s own query and cache assignment.
- A successful `alerts:changed` reload replaces the cache exactly as before.
- `handlePrice` and its `evaluation error:` logging.
- `ALERT_USE_QUEUE`, `ALERT_FIRE_CONCURRENCY`, `EVAL_ON_FINAL_BAR_ONLY` behaviour.
- No schema, migration, generated-client, lockfile or `package.json` change; no environment variable or flag.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `git log -1` is `ed4ca861` or a descendant; `operation-service/src/alert-engine/alert-worker.service.ts` and `alert-worker.service.spec.ts` unchanged since this draft (blob hashes `2fcd20f9…` and `077b3cc7…`); the tree is clean apart from this order and whatever the P-operation unit's commit status makes of it. _(HEAD `c4e3a494`; both files unchanged, `git diff ed4ca861 HEAD -- operation-service/src/alert-engine` is empty; tree clean apart from the second-wave plan.)_
- [x] Davin's D1 sign-off recorded verbatim in the CONFIRM note (it is **not** covered by a general approval of the order). _(Recorded in the CONFIRM note.)_
- [x] Baselines recorded in Deviations before any edit, in `operation-service/`: `npx tsc --noEmit`, `npm test` (counts and skipped; with the P-operation unit present: 65 suites, 697 tests: 689 passed, 8 skipped), `npm run build`.
- [x] `operation-service/dist/` is current for the probe (`npm run build` after the baseline). _(Rebuilt after the baseline; line 62 of the compiled file still held `void this.reload()`.)_
- [x] Davin states whether the alert worker is deployed as its own Railway service and under which restart policy, or that he cannot. Without it the order records "restart policy of the worker: not checked". _(Davin: "Worker restart policy: not checked".)_
- [x] `.claude/architecture/environment-gotchas.md` re-read (absolute paths or a subshell; CRLF working copy; Python on PATH is the Store stub).

## Ordered steps (each carries its verification)

1. **Probe the unmodified service first.** A scratch script outside the repo (kept in the evidence folder) loads `dist/alert-engine/alert-worker.service.js` with `Module._load` stubs for `ioredis` (an `EventEmitter` with `psubscribe`, `subscribe`, `quit`, `on` that resolve),
   a Prisma stub whose `drawingAlert.findMany` resolves `[]` once and then rejects with `new Error('timeout exceeded when trying to connect')`, and stubs for the queue and the dispatcher. It calls `start()`, emits `message` / `alerts:changed` on the subscriber, and keeps the process alive with a timer.
   _Verify:_ exit code **1** with the error on stderr (the "before" observation: it proves the probe can see the defect).
2. **Write the unit case first and watch it fail.** In `alert-worker.service.spec.ts`: after `start()`, take the handler registered for `'message'` from `on.mock.calls`, make the next `findMany` reject with a pool-timeout-shaped error, call the handler with `'alerts:changed'`, wait a tick, and assert that
   `Logger.prototype.error` was called with `'watch reload failed:'` and that the previous watches are still in use (a price event for a watched level still fires `enqueueFire`). A second assertion: a `message` on any other channel does not call `findMany` again.
   _Verify:_ the case fails on the unmodified code (the logger is never called).
3. **Apply D1.** Edit `alert-worker.service.ts:80-82` as in D1. _Verify:_ `npx tsc --noEmit`; `npx jest src/alert-engine/alert-worker.service.spec.ts`.
4. **Probe again.** Rebuild, rerun the step 1 script. _Verify:_ the process stays alive for the whole probe window (for example 3 s), stderr holds the `watch reload failed:` line, and a second, successful `alerts:changed` message replaces the cache (the stub's `findMany` resolving a row).
5. **Mutation check:** back to `void this.reload()` (unit case and probe fail); `.catch(() => undefined)` (the logger assertion fails); log with `warn` instead of `error` (fails); log and rethrow inside the `catch` (the probe fails: exit 1 again). Restore byte-identical (sha-256).
6. **Full verification** in `operation-service/`: `npx tsc --noEmit`, `npm test` (baseline plus the new cases), `npm run build`; `npx prettier --check --end-of-line auto` on the changed files only; `git diff --stat` shows only `alert-worker.service.ts` and `alert-worker.service.spec.ts`.
7. **Close.** A short evidence report `docs/handoffs/2026-10-xx-alert-worker-reload-catch-evidence.md` (the probe output before and after, the unit case, versions, the stale-cache trade-off restated); state entry per `session-lifecycle.md`; Deviations.
   **Commit only if Davin asks,** by explicit paths; suggested message `fix(operation-service): catch a failed alert watch reload instead of ending the worker`. No push or deploy by the Executor.

## Rollout and observation (after the push, Davin's call; with or before the P-operation push, D3)

- Watch for the log line `watch reload failed:` and for **worker restarts** (a restart count above the baseline is the symptom this order removes). If the line appears, the worker is running on a stale cache until the next `alerts:changed` or restart; that is the moment to decide whether a retry design is wanted.
- **Revert criteria:** the log line appears in normal traffic (it means reloads fail for a reason other than a rare saturation), or an alert is reported as not firing after a change.

## Done when

- The `message` handler cannot leave an unhandled rejection: the probe shows exit code 1 before and a live process after; the unit case failed before and passes after; every mutant is killed.
- `tsc`, `npm test` and `build` are green in `operation-service/`; counts and skips reported; only the two files above changed.
- **Not claimed:** that watches are never stale (D1 accepts staleness until the next event); a retry; anything about the other floating promises or the other flagged rows of the P-operation report; production behaviour.

## Rollback

Put `void this.reload()` back and redeploy `operation-service` (and the worker service if it is separate). This restores the crash on a failed reload; nothing to reconcile for data.

## Out of scope

F1 (`/auth/refresh`), F2 (`DELETE /drawings/:id`), F3 (`DELETE /users/sessions`) and F5 (fire concurrency 10 against pool 10) of the P-operation report; the awaited `reload()` in `start()`; a retry or periodic reload; a process-wide `unhandledRejection` handler;
the pool value; `main-worker.ts`; the HTTP process.

## Deviations

_(filled during execution, never deleted)_

- **Baselines before any edit (2026-10-24, `operation-service/`, HEAD `c4e3a494`):** `npx tsc --noEmit` exit 0; `npx jest` (= `npm test`) **65 suites (64 passed, 1 skipped), 697 tests: 689 passed, 8 skipped (the gated pool spec), 0 failed**
  (30.4 s); `npm run build` exit 0; `dist/alert-engine/alert-worker.service.js` was current (`void this.reload()` at line 62). Node v24.22.1.
- **Hashes before any edit (git blob):** `alert-worker.service.ts` `2fcd20f9…`, `alert-worker.service.spec.ts` `077b3cc7…`; sha-256 of the service file `dd50158f09f33f66b5ea068371b15be523b554d0338debd2484e949d557c4867`.
- **Restart policy of the worker: not checked** (Davin's statement; neither he nor the Executor checked it).
- **Executed 2026-10-24; evidence in [the report](../handoffs/2026-10-24-alert-worker-reload-catch-evidence.md).** Steps 1 to 6 done in order; step 7's state entry written; **no commit, push or deploy** (Davin said not to).
- **Basis line corrected:** the draft said "plus the uncommitted P-operation unit"; that unit was committed as `c4e3a494` before this order was confirmed, so the basis is `c4e3a494`.
- **Step 1 (probe, before).** On the unmodified compiled service the child process **exited 1** at the first rejected reload, with the error on stderr and the stack through `AlertWorkerService.reload` called from the `message` listener
  (`dist/alert-engine/alert-worker.service.js:62`). This is the process-level observation the P-operation report only had from a generic script.
- **Probe script changed after the "before" run (cosmetic and additive):** assertions on the cache and the call counts, and stripping of colour codes from the summary, were added; they act only after the first rejection, which the unmodified service never survives, so the "before" exit 1 does not depend on them. The "after" output is from the final script.
- **Step 2 (unit cases).** Two tests, not one: the draft's case (log, previous watches kept, another channel ignored) and a second one (the next successful reload replaces the cache after a failure). Both failed on the unmodified code ("Number of calls: 0" for the logger); the 8 existing tests passed.
  The cases read the private `cache` through a cast, because the class has no accessor; a price-event assertion (the draft's wording "a price event still fires `enqueueFire`") was **not** used: it would need the evaluator and a state store behind the stubs, and the cache size shows the same fact more directly.
- **Step 3 (apply D1).** `alert-worker.service.ts:80-86`; a one-statement change that Prettier lays out over four lines inside a new `if` block. `tsc` exit 0; worker spec 10 of 10.
- **Step 4 (probe, after).** The process lives to the end; the error is logged at `ERROR`; the old cache (1 key) survives; another channel does not reload; the next successful reload replaces the cache (0 keys).
- **Step 5 (mutation).** Seven mutants instead of four (W5 the catch clears the cache, W6 the guard flipped, W7 the log text changed were added); all killed by the unit spec; W1, W4, W5, W6 also by the probe; W2, W3 and W7 (log wording) survive the probe by design, the unit spec kills them. Source and dist restored byte-identical.
- **Step 6 (verification).** `tsc` 0; `jest` 65 suites (64 passed, 1 skipped), 699 tests (691 passed, 8 skipped, 0 failed), baseline plus 2; `nest build` 0; prettier clean on the two changed files; code diff `alert-worker.service.ts` +5/-1, spec +93.
- **Not done:** no comment next to the change; nothing for F1 to F3 and F5 (D5); no retry (D1).
