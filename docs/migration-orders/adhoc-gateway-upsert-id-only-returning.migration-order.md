# Migration Order — Ad-hoc Session — Gateway live-row upsert returns the ID only (Unit U of the database-scaling second wave)

> **Status: CONFIRMED** — drafted by the Executor on 2026-10-23 from the feasibility plan
> ([plan](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md), work package 2) and the
> [architecture design](../../davintrade-database-scaling/database-scaling-second-wave-architecture.md) §4.
> **APPROVED by Davin in chat on 2026-10-24**, **CONFIRMED by the Executor on 2026-10-24** (entry criteria below). There was no
> separate Advisor DRAFT step: Davin's approval of the Executor's recommendations stands in for it, and every decision below is
> settled as proposed.
>
> **CONFIRM note (Executor, 2026-10-24).** Davin's sign-offs, as given in chat, verbatim:
>
> - **D1 (⚠ explicit sign-off): "APPROVED. The one-line touch of the protected ingest path (`select: { id: true }` added to
>   `railway-gateway/src/worker/market-data.processor.ts:70-74`) is explicitly approved."**
> - **D2 to D7: "APPROVED as proposed (job result stays `{ success: true }`, install in place with `npm ci`, scratch PostgreSQL 18
>   fixture on random high port, 3-layer evidence: unit spec mock, offline SQL probe, and scratch DB row parity spec, no speed claims)."**
> - **Installation approval (plan D6): "APPROVED to run `npm ci` in `railway-gateway/`. Ensure `package.json` and `package-lock.json`
>   hashes remain strictly byte-identical."**
> - **Runtime facts stated by Davin:** `railway-gateway` runs **1 replica** on Railway; **Stack D step 2 is NOT live in production**
>   (the ingestion tables are at 0 rows). The D5 observation line is therefore recorded as **"pending go-live"**. These are Davin's
>   statements; the Executor has no production access and did not check them.
>
> Re-verified fresh before any edit: `HEAD` = `d92517d7` (a descendant of `9b40bf3d`; the one commit after it is the Redis fix, which
> touches nothing under `railway-gateway/`); `market-data.processor.ts`, `market-data.processor.spec.ts` and `railway-gateway/package.json`
> unchanged since `9b40bf3d` (`git diff 9b40bf3d HEAD` on them is empty); tree clean apart from the three orders and the plan
> (all untracked); `railway-gateway/node_modules` absent. Hashes before `npm ci` are in Deviations. Baselines are in Deviations.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving refactor, one projection added
(closest to `TEMPLATE-PORT.md`, dial **Low**) · **Status:** EXECUTED and verified locally, NOT committed · **Generated:** 2026-10-23 (Executor) · **Basis:** `main` @ `9b40bf3d` ·
**Flags touched:** none · **Estimated time:** ~2 to 3 h (one line; the install, the SQL comparison and the persisted-row parity spec are the work).

**Source:** design §4, plan WP2 and findings F7 and F8. Direction from the plan: this unit may merge before Stack D step 2 goes live because it is verified on a scratch database; production observation is then recorded as **pending**, never as done.

## Facts the Executor verified against live code (`9b40bf3d`)

- **The change site.** `railway-gateway/src/worker/market-data.processor.ts:70-74` awaits `this.prisma.marketDataV6.upsert({ where: { symbol_timeframe_timestamp: { symbol, timeframe, timestamp } }, create: data, update: data })`
  and discards the result; `:76` then calls `writePointInTimeSnapshot(data)`; `:78` returns `{ success: true }`. The handler is one wildcard `@Process({ name: '*', concurrency: 1 })` (`:50`) dispatching on `job.name`.
  `writePointInTimeSnapshot` (`:111-130`) returns early for a forming bar (`buildSnapshot` is null), writes `createMany({ skipDuplicates: true })`, and catches and logs any failure (warning only).
- **The tested file and the spec are byte-identical to the design's baseline `de61737e`** (`git diff de61737e HEAD` on the processor, its spec and the gateway `package.json` is empty at `9b40bf3d`).
- **The spec that pins the call.** `railway-gateway/test/market-data.processor.spec.ts`: the Prisma double (`:60-64`) resolves the upsert with `{}`; the exact-argument expectation is `:89-99` (`where`, `create: job.data`, `update: job.data`); also pinned:
  the point-in-time write for a closed bar (`:103`), the forming bar upserted but never frozen (`:112`), a failing snapshot cannot fail the row (`:119`), a failing upsert fails the job so Bull retries (`:129`), manifest dispatch (`:135`, `:148`), an unknown job name refused (`:156`),
  and the "one loop" tests (`:167` on) that pin Bull's own source. None of them inspects the order of the two Prisma calls.
- **The model.** `MarketDataV6` has `id String @id @default(cuid())`, `@@unique([symbol, timeframe, timestamp])`, `cycle_id Int`, `collected_at Int`, `createdAt @default(now())` and `updatedAt @updatedAt`, 106 scalar fields (`prisma/schema.prisma`, `@@map("market_data_v6")`).
  `MarketDataPointInTime` has `id` (cuid), the same unique key, `cycle_id Int?` and `createdAt`. The generated columns (`id`, `createdAt`, `updatedAt`) differ between any two runs and are excluded from parity comparisons.
- **The earlier evidence and its limits.** The study's offline compiler probe reported 106 columns in `RETURNING` and 1 with the projection, against the gateway client **at the study's base commit `c6dccff1`, in an external checkout.** That script
  (`database-scaling-study-2026-10-20/database-scaling-study/query-sql-probe.cjs`) hard-codes `D:/SaaS Project/trading-alerts-saas-public`, so it cannot be reused as is: this order writes a small new probe in the session scratchpad on the same pattern (a fake driver whose `queryRaw` returns no rows,
  so Prisma's compiler prints the SQL). **It has not been re-run against this checkout** because the gateway is not installed here (below). It establishes SQL shape only: not transfer bytes, not speed, not write cost.
- **Not installed here.** `railway-gateway/` has **no `node_modules` and no generated Prisma client** on this machine; `operation-service/` and the root do. The generator writes to `../node_modules/.prisma/client` (`prisma/schema.prisma:15-18`), so `npm ci` cannot dirty the tree
  apart from `node_modules`. `postinstall` is `prisma generate`.
- **How the gateway tests run.** `jest.config.js`: `testRegex: 'test/.*\.spec\.ts$'` and the unit run ignores `market-data.e2e-spec.ts`; so a gated `*.pg.spec.ts` under `test/` is collected by `npm test` and skips itself without its environment variables (precedent: `cycle-readers.pg.spec.ts`).
  `tsconfig.json` excludes `test/`, so `tsc --noEmit` does not check specs (ts-jest does when they run). There is **no working lint** (the script finds no files); the checks are `tsc`, the specs, and `prettier --check --end-of-line auto` (gotchas file).
  A gated spec that lands several slots needs `jest.setTimeout(120_000)`; an embedded Postgres closes connections under many parallel writers, so write serially (concurrency 1 is what the processor does anyway).
- **Python.** The gateway's sensor specs need Python 3.11 with `pyyaml==6.0.2` and `jsonschema==4.25.0` and **skip silently** without them. On this machine `python` resolves to the Windows Store alias (it printed no version); a green gateway run must therefore state its skipped-spec count.
- **Scratch PostgreSQL.** PostgreSQL 18 binaries are installed (`C:\Program Files\PostgreSQL\18\bin`; production is 17.11, which does not matter for compiled SQL shape or these row comparisons). Start `postgres.exe` with a hidden `Start-Process` and poll `pg_isready`; **never `pg_ctl start` inside a tool call**
  (it hangs and then dies; gotchas file). Port 55471 was free on 2026-10-23. Davin's own service on 5432 is not touched. DDL comes from `prisma migrate diff --from-empty --to-schema railway-gateway/prisma/schema.prisma --script` with a scratch `prisma.config.mjs` outside the repo (gotchas file; the recipe is also in the header of `test/cycle-readers.pg.spec.ts`).
- **Production state.** The 2026-10-20 manifest records `market_data_v6` at 0 rows, and `infrastructure.md` says the Stack D step 2 runbook has not been run against production. **Not re-checked by the Executor** (no production access). If still true, there is no live ingestion to observe.
- **Replicas.** Concurrency 1 is per worker instance, not a distributed lock (design §4.2). The Railway replica count for `railway-gateway` is not visible from the repo.

## Decisions taken

> **Proposed by the Executor; to be settled by the Advisor and approved by Davin.** None touches money, auth semantics, secrets or CORS.

1. **D1 ⚠ NEEDS EXPLICIT SIGN-OFF — the one-line touch of the protected ingest path.** The change is exactly `select: { id: true }` added to the upsert at `market-data.processor.ts:70-74`. Nothing else in `src/` changes. _Rejected:_ raw SQL, a second lookup,
   `createMany` in place of the upsert, `omit`, any change to the payloads, to the PIT lane, to worker concurrency or to the queue options. _Undo:_ low (revert).
2. **D2 — the result stays unused and the job result stays `{ success: true }`.** Full `create: data` and `update: data` are kept, including `cycle_id` (existing bars are intentionally rewritten; provenance is the latest writing cycle). The live upsert is awaited before PIT processing, as today.
3. **D3 (plan D6) — install in place.** `npm ci` in `railway-gateway/`: it must leave `package.json` and `package-lock.json` unchanged (sha-256 before and after, plus `git status`); `postinstall` generates the client inside `node_modules`.
   _Alternative:_ the scratch-copy method of the gotchas file (written for money-service). In place is simpler here because the generator output is inside `node_modules`.
4. **D4 (plan D5) — fixtures:** a scratch PostgreSQL 18 (hidden, random high port such as 55471, data in the session scratchpad, stopped by PID, directory deleted). Each launch is announced to Davin before it runs.
5. **D5 (plan D8) — ordering and observation.** Second of the three orders; independent of the other two at runtime. It may merge before Stack D step 2 goes live. Until ingestion is live, the rollout comparison the design asks for (job failures, queue lag, cycle readiness, PIT warnings) is recorded as
   **"pending go-live"**, and nothing is claimed about production. Once live, observe at least 12 consecutive market-open cycles (plan D7) before the next unit's push.
6. **D6 — evidence required, in three layers, each labelled:** (a) the unit spec (a _mock_); (b) the compiled SQL and parameters before and after, from the installed gateway client (an _installed-driver probe_); (c) persisted-row and job-outcome parity on a scratch PostgreSQL (a _real fixture_).
   A mock alone is not accepted, and neither is the study's old probe output.
7. **D7 — no speed claim.** Record result width, and decoding or transfer time only if it is measurable on the scratch database. The projection reduces the returned columns; it does not reduce live writes, PIT insert attempts, index maintenance or WAL.

## Invariants (must not change)

- The upsert's `where`, `create` and `update` payloads, byte for byte; `cycle_id` and `collected_at` are written on every delivery; the same natural key never produces a second live row.
- The live upsert is awaited before `writePointInTimeSnapshot`; a rejected upsert fails the job before any snapshot work (Bull then retries per `LANE_JOB_OPTIONS`: 3 attempts, exponential back-off from 2,000 ms, unchanged).
- PIT behaviour: closed-bar immutable insert with `skipDuplicates`, duplicate suppression, forming-bar exclusion, warning-only failure.
- One wildcard handler with `concurrency: 1`; the manifest job path and queue options (`cycle-queues.ts`); a successful row write is not a licence to publish a manifest early.
- Job result `{ success: true }`, the `Failed:` / `Processing:` / `Completed:` log lines, API contracts. No `package.json`, lockfile, schema, migration or generated-client edit.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `git log -1` is `9b40bf3d` or a descendant; `market-data.processor.ts`, `market-data.processor.spec.ts` and `railway-gateway/package.json` unchanged since this draft (`git diff 9b40bf3d HEAD` on them); tree clean apart from the three orders.
- [x] Davin's D1 sign-off is recorded verbatim in the CONFIRM note.
- [x] D3 done: `npm ci` in `railway-gateway/` completed; `package.json` and `package-lock.json` hashes unchanged; `git status` unchanged; `node_modules/.prisma/client` exists; Prisma, `pg` and `@prisma/adapter-pg` versions recorded.
- [x] Baselines recorded in Deviations before any edit: in `railway-gateway/`, `npx tsc --noEmit`, `npx jest` (with the **skipped** count and the reason: Python, gated specs), `npx jest --config ./test/jest-e2e.json`, `npm run check:sensor-kit`.
- [x] PostgreSQL 18 binaries present; the chosen port is free; no scratch server of ours is left; Davin's own service on 5432 is not touched.
- [x] Davin states the gateway's current Railway replica count and whether Stack D step 2 is live (production row counts), so the observation line in D5 can be written truthfully.
- [x] `.claude/architecture/database-traps.md` read for the gateway scratch-database recipe; `environment-gotchas.md` re-read (shell drift: use absolute paths or a subshell).

## Ordered steps (each carries its verification)

1. **Baseline SQL.** In the scratchpad, write a small probe on the pattern of the study's (fake driver, `queryRaw` returning no rows) that loads **`D:/SaaS/railway-gateway/node_modules/.prisma/client`** and compiles the **current** upsert for a representative `MarketDataDto`
   (all 106 fields). Save the statement and its bound parameters. _Verify:_ the statement is `INSERT … ON CONFLICT … DO UPDATE … RETURNING` with 106 columns, as the study reported; if it is not, stop and report.
2. **Apply D1.** Add `select: { id: true }` to the upsert. _Verify:_ `npx tsc --noEmit` in `railway-gateway/`.
3. **After SQL.** Re-run the probe. _Verify:_ the two statements differ **only** in the `RETURNING` list (106 columns to 1); same `INSERT` columns, same `DO UPDATE` assignments, same conflict target, same bound parameters and order; no added statement. Store both outputs next to the evidence report.
4. **Unit spec.** In `market-data.processor.spec.ts` change the expectation at `:89-99` by adding only `select: { id: true }`; keep every other assertion. Add: an invocation-order assertion that the upsert is called before `createMany`
   (`mock.invocationCallOrder`), and that a rejected upsert leaves `createMany` uncalled. _Verify:_ `npx jest test/market-data.processor.spec.ts`.
5. **Gated persisted-row parity spec** `railway-gateway/test/market-data.processor.pg.spec.ts` (follows `cycle-readers.pg.spec.ts`: skipped unless `CYCLE_PG_URL` is a localhost URL **and** `CYCLE_PG_ALLOW_WIPE=yes`; it deletes `market_data_v6` and `market_data_point_in_time` rows; `jest.setTimeout(120_000)`).
   It runs the real `MarketDataProcessor` with the real `PrismaService` over a fixed, serial job sequence: a new bar; the same key redelivered; the same key in a **second cycle** with changed indicator values and `cycle_id`; a closed bar (PIT insert); the same closed bar again (PIT duplicate suppressed);
   a forming bar; a bar whose upsert is made to fail. It runs the sequence **twice**, once as shipped and once through a thin delegating wrapper that strips `select` from the upsert arguments, wiping between runs.
   _Verify:_ for both runs, persisted `market_data_v6` and `market_data_point_in_time` rows are equal column for column (excluding `id`, `createdAt`, `updatedAt`), the final live row of the repeated key holds the **second** payload and `cycle_id`, there is exactly one row per natural key,
   the closed bar froze once, the forming bar froze never, and the failing job rejected with no PIT row. Report the test count.
6. **Mutation check** with the gated spec running (parallel copies are faster; run detached if long, per the gotchas file): remove `select`; change it to `select: { symbol: true }`; drop `update: data`; drop `cycle_id` from `update`; swap the order of the upsert and the PIT call;
   drop the `await` on the upsert. Each must be killed by the unit spec, the gated spec, or the SQL diff. Restore byte-identical (sha-256).
7. **Full verification** in `railway-gateway/`: `npx tsc --noEmit`, `npx jest` (report skipped), the e2e config, `npm run check:sensor-kit`, `npm run build`; `npx prettier --check --end-of-line auto` on the changed files only. `git diff --stat` shows only the processor, its spec and the new gated spec.
8. **Stop the scratch server** by PID, delete its data directory and the scratchpad probe's output if not kept, confirm no process of ours is left.
9. **Close.** Evidence report `docs/handoffs/2026-10-xx-gateway-upsert-select-evidence.md` (both SQL statements and their diff, the parity result, versions, labelled evidence types, and the observation line "pending go-live" unless Davin has confirmed otherwise); state entry per `session-lifecycle.md`; fill Deviations.
   **Commit only if Davin asks,** by explicit paths, suggested message `perf(gateway): return only the id from the live-row upsert`. No push or deploy by the Executor.

## Done when

- The upsert carries `select: { id: true }` and nothing else in `src/` differs; the SQL diff shows only the `RETURNING` list; the unit spec and the gated parity spec pass; every mutant is killed.
- Persisted rows and job outcomes are equal with and without the projection (the gated result is reported with its test count and the PostgreSQL version).
- `tsc`, the unit and e2e runs, `check:sensor-kit` and `build` are green; skipped counts reported.
- **Not claimed:** any speed-up or lower write load (the projection narrows the returned row only); production behaviour (ingestion not live as of the 2026-10-20 manifest; the comparison is "pending go-live"); that concurrency 1 holds across replicas.

## Rollback

Revert the commit and redeploy the gateway. Full-row results return; persisted data needs no conversion or backfill. If the commit has been deployed, remember that Railway rebuilds every service on every push to `main` (Watch Paths unset): record the deployment ID and the health `uptime`.

## Out of scope

Raw SQL, batching or skipping live rewrites, higher worker concurrency, the PIT insert memo, manifest or collector scheduling, any schema or migration, the operation and money services, and the other two orders.

## Deviations

_(filled during execution, never deleted)_

**Pre-edit facts (2026-10-24, before any change to `src/` or `test/`):**

- **Install (D3).** `npm ci` in `railway-gateway/` exited 0 (npm 11.19.1, Node v24.22.1). `package.json` sha-256 `929E57D5…B8ECF` and
  `package-lock.json` sha-256 `703E1FF2…996C2` are **identical before and after**; `git status` unchanged (only the three untracked orders/plan);
  `node_modules/.prisma/client` exists (the package's own `postinstall: prisma generate` ran). Installed: `prisma` 7.9.1, `@prisma/client` 7.9.1,
  `@prisma/adapter-pg` 7.9.1, `pg` 8.23.0, `ts-node` 10.9.2, `jest` 29.7.0, `ts-jest` 29.4.11, `typescript` 5.9.3, `bull` 4.16.5. npm 11 printed
  "3 packages have install scripts not yet covered by allowScripts" (`@prisma/engines` postinstall, `prisma` preinstall, `msgpackr-extract`); it did not
  block the client generation and nothing was approved or changed.
- **Baselines (before the edit), in `railway-gateway/`:** `npx tsc --noEmit` exit 0 (no output). `npm run check:sensor-kit` exit 0 ("45 files, 386,017 bytes,
  … byte for byte"). `npx jest --maxWorkers=4`: **exit 1**, 77 suites (62 passed, **12 skipped**, **3 failed**), **3,140 tests: 2,666 passed, 469 skipped, 5 failed**.
  The 12 skipped suites are 10 gated `*.pg.spec.ts` files (no `CYCLE_PG_URL`) and 2 Python-gated ones (`sensors-inputs-runner`, `sensors-replay-synthesis-real`; this machine
  has no usable Python, the Windows Store alias, so they skip silently; identified from the final run's JSON, the baseline run printed counts only). **The 5 failures are not this unit's and predate it:** `sensors-replay.spec.ts` (1: the `replay-cycle.js` shebang
  line must end in `\n`), `sensors-synthesis-rows.spec.ts` (3: `zone_params.yaml`), `sensors-disabled-consumes-nothing.spec.ts` (1: `'CycleReadyProcessor,\n      ],'` is
  not found in `sensors.module.ts`). Each reads a file that `git ls-files --eol` lists as `i/lf w/crlf` in this CRLF checkout, and each matches on `\n`
  (the known CRLF trap, `environment-gotchas.md`). They must read **the same 5, no more**, after the change. `npx jest --config ./test/jest-e2e.json --maxWorkers=2 --forceExit`:
  exit 0, 8 suites, 156 tests passed.
- **Runtime facts are Davin's statements**, not Executor observations: 1 Railway replica; Stack D step 2 not live; ingestion tables at 0 rows (CONFIRM note).
- **Probe approach differs from the order's step 1 wording, on purpose.** The order says "a small probe on the pattern of the study's … compiles the current upsert".
  The probe written for this session (`upsert-sql-probe.cjs`, kept next to the evidence report) does not hand-copy the call: it loads the **real**
  `MarketDataProcessor` from `src/` (ts-node, transpile-only) and runs a row job through it over the same fake-driver idea, answering a statement that has
  `RETURNING` with one synthesised row so the processor goes on to the point-in-time insert and that statement is captured too (the study's empty-result
  probe would stop at the upsert and could not show "no added statement"). `Date.now()` is fixed so the snapshot's `first_seen_at` parameter is identical between runs.

**Deviations from the order's steps (2026-10-24):**

- **Step 3, the parameter comparison.** The order says "same bound parameters and order". Six of the 299 parameters differ between any two runs by nature: `id` (a cuid) in both inserts and
  `createdAt` / `updatedAt` (the clock), which the order itself excludes from parity comparisons. The probe's `diff` maps every `$n` to its column and allows exactly those three names;
  every other parameter is equal. Result: only the `RETURNING` list differs (106 to 1), five events in the same order in both runs.
- **Step 4, the unit spec has four new tests, not two.** The two asked for (invocation order; a rejected upsert leaves `createMany` uncalled) plus: the snapshot waits until a pending upsert has
  settled (a deferred promise, which also kills the dropped-`await` mutant at unit level) and what the upsert resolves with is not the job result (D2).
- **Step 5, the gated spec has a ninth job and a fixed clock.** Besides the order's sequence it runs a closed bar whose snapshot insert the database refuses (a trigger the spec creates and drops),
  which checks the "warning-only" invariant against a real database; the live-upsert failure is also a real database refusal (a second trigger), not a stub. `Date.now()` is fixed
  (`jest.spyOn`) so `first_seen_at` and `snapshot_age_bars` are compared too, instead of being excluded. In the "as shipped" run the processor sees the real client through a recording
  passthrough (arguments untouched), so the spec can state what `select` each call carried and how many fields came back (1 against 106 in the control run).
  The spec's `describe` names and 20 tests are in the evidence report. Prettier reformatted the new file once (`--write`, that file only).
- **Step 6, the mutants.** The six asked for, plus one (U7, swallowing an upsert failure). "Drop `update: data`" was run as `update: {}` and "drop `cycle_id` from `update`" as
  `{ ...data, cycle_id: undefined }`, because deleting the property outright does not compile and a compile error is not a kill. Three detectors per mutant (unit spec, gated spec, the SQL probe
  compared with the accepted output). **First run of the harness: its SQL detector did not count a changed `RETURNING` list as a defect and the diff crashed on one mutant's missing statement;
  both fixed, the whole check re-run, and only the second run is reported.** Result: 7 of 7 killed by the unit spec and by the gated spec, 6 of 7 by the SQL probe (U7 is an error path,
  not SQL shape). The processor was restored after every mutant; final sha-256 `3749fea3…5362`, byte-identical to the accepted source.
- **Added: result width on the real server** (`result-width.json`): 106 fields, 495 data bytes, 926 `DataRow` bytes against 1 field, 25 bytes, 36 bytes, for the probe's short synthetic values. No timing taken (D7).
- **Step 7, `npm run build`** exit 0, the e2e config exit 0 (8 suites, 156 tests), `check:sensor-kit` exit 0, `tsc` exit 0; `npx jest --maxWorkers=4` exit 1 with the same 5 failures as the baseline,
  3,164 tests: 2,670 passed, 5 failed, 489 skipped (13 skipped suites: the baseline's 12 plus the new gated spec). Prettier clean on the changed files.
- **Step 8, cleanup:** the scratch PostgreSQL 18.1 (postmaster PID 14688, port 55471) was stopped with `pg_ctl stop -m fast` and its data directory deleted; no process of ours is left; Davin's own
  service (the 10 `postgres.exe` processes that were already running) was not touched. The probe outputs are kept in `docs/handoffs/2026-10-24-gateway-upsert-select-evidence/`.
- **D1 kept to one line.** No comment was added next to `select: { id: true }`, so the production diff is exactly what Davin signed off. A one-line comment is easy to add if wanted.
- **Not done, by the order:** no commit, no push, no deploy. The D5 production observation is recorded as **pending go-live**.

## Next-session handoff (PRE-DRAFT notes for the following order, not a plan)

- Previous order in the sequence: [`adhoc-redis-background-recovery`](adhoc-redis-background-recovery.migration-order.md). Next: [`adhoc-nest-pool-deadline-operation`](adhoc-nest-pool-deadline-operation.migration-order.md).
- The gateway pool-deadline order (P-gateway) is **not drafted here**: it waits for the gateway timeout value (plan D2, recommended 2,000 ms because the monolith reads the gateway with a 5 s abort) and for Stack D step 2 to have run live for a trading day.
