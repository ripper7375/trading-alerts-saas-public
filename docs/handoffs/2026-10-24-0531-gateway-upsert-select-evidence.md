# Unit U, gateway live-row upsert returns the id only: evidence report

**Date:** 2026-10-24 · **Branch:** `main` on `d92517d7` (a descendant of the order's basis `9b40bf3d`) · **Order:** [adhoc-gateway-upsert-id-only-returning](../migration-orders/adhoc-gateway-upsert-id-only-returning.migration-order.md)
(CONFIRMED; Davin's D1 sign-off, D2 to D7 approval and the `npm ci` approval are quoted verbatim in its CONFIRM note) · **Plan:** [work package 2](../../davintrade-database-scaling/database-scaling-second-wave-implementation-plan.md)
· **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT deployed.** No migration, no schema, `package.json` and `package-lock.json` untouched.
**Production observation: pending go-live** (Davin: Stack D step 2 is not live, the ingestion tables are at 0 rows; 1 Railway replica for `railway-gateway`).

## 1. What changed

One production line, the projection on the live-row upsert in `railway-gateway/src/worker/market-data.processor.ts`:

```diff
     await this.prisma.marketDataV6.upsert({
       where: { symbol_timeframe_timestamp: { symbol, timeframe, timestamp } },
       create: data,
       update: data,
+      select: { id: true },
     });
```

The result was never read and still is not; the job still returns `{ success: true }`; `create` and `update` are unchanged (so `cycle_id` and `collected_at` are still rewritten on every delivery); the upsert is still awaited before `writePointInTimeSnapshot`.
No comment was added next to the line, so that the production diff is exactly the one line Davin signed off.

| File                                                                              | Change                                                                                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `railway-gateway/src/worker/market-data.processor.ts`                             | `select: { id: true }` (+1)                                                                                                                                    |
| `railway-gateway/test/market-data.processor.spec.ts`                              | the exact-argument expectation gains `select`; four new tests (+43); 12 tests became 16                                                                        |
| `railway-gateway/test/market-data.processor.pg.spec.ts`                           | **new**, gated on `CYCLE_PG_URL` (localhost only) and `CYCLE_PG_ALLOW_WIPE=yes`; 20 tests; skipped in `npm test`                                               |
| `docs/handoffs/2026-10-24-gateway-upsert-select-evidence/`                        | **new**: the SQL before and after (`.json` and `.sql.txt`), the diff, the result-width measurement, the mutation results, and the three scripts that made them |
| `docs/migration-orders/adhoc-gateway-upsert-id-only-returning.migration-order.md` | CONFIRM note, status, Deviations, checkboxes (untracked file, as the earlier ad-hoc orders)                                                                    |

## 2. Environment (as installed)

| Item             | Value                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install (D3)     | `npm ci` in `railway-gateway/`, exit 0 (npm 11.19.1, Node v24.22.1). sha-256 of `package.json` `929E57D5…B8ECF` and `package-lock.json` `703E1FF2…996C2`: **identical before, after the install, and at the end of the session**; `git status` unchanged by it |
| Prisma           | `prisma` 7.9.1, `@prisma/client` 7.9.1 (engine `e922089b…`), `@prisma/adapter-pg` 7.9.1, `pg` 8.23.0; generated client at `railway-gateway/node_modules/.prisma/client`                                                                                        |
| Test tools       | `jest` 29.7.0, `ts-jest` 29.4.11, `ts-node` 10.9.2, `typescript` 5.9.3, `bull` 4.16.5                                                                                                                                                                          |
| Scratch database | **PostgreSQL 18.1** (`C:\Program Files\PostgreSQL\18\bin`), a private cluster on 127.0.0.1:55471 started hidden with `Start-Process`, data in the session scratchpad; production is 17.11 (does not matter for compiled SQL shape or row comparisons)          |
| Tables           | the gateway's 18 tables from `prisma migrate diff --from-empty --to-schema railway-gateway/prisma/schema.prisma --script` through a scratch `prisma.config.mjs` outside the repo; no sensor CHECKs (not needed here)                                           |
| Python           | none usable (`python` is the Windows Store alias), so the Python-gated sensor specs skip silently                                                                                                                                                              |

## 3. Results, with their labels

### 3.1 Baselines before any edit

| Check                                    | Result                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                       | exit 0, no output                                                                                         |
| `npm run check:sensor-kit`               | exit 0 (45 files, 386,017 bytes, byte for byte)                                                           |
| `npx jest --maxWorkers=4`                | exit 1: 77 suites (62 passed, 3 failed, 12 skipped); **3,140 tests: 2,666 passed, 5 failed, 469 skipped** |
| `npx jest --config ./test/jest-e2e.json` | exit 0: 8 suites, 156 tests                                                                               |

The 5 failures are not this unit's: each reads a file that `git ls-files --eol` lists as `i/lf w/crlf` in this CRLF checkout and matches on `\n` (the known trap): `sensors-replay.spec.ts` (1, the `replay-cycle.js` shebang), `sensors-synthesis-rows.spec.ts` (3, `zone_params.yaml`), `sensors-disabled-consumes-nothing.spec.ts` (1, `sensors.module.ts`).
The 12 skipped suites are 10 gated `*.pg.spec.ts` files (no `CYCLE_PG_URL`) and 2 Python-gated ones (`sensors-inputs-runner`, `sensors-replay-synthesis-real`).

### 3.2 The compiled SQL, before and after (_installed-driver probe_)

`upsert-sql-probe.cjs` loads the **real** `MarketDataProcessor` from `src/` (ts-node, transpile-only) over the gateway's own generated Prisma 7.9.1 client with a **fake driver**: no network, no PostgreSQL. Prisma's compiler prints the SQL; the fake driver records each statement and answers one with `RETURNING` with a synthesised row, so the processor goes on to its snapshot step and that statement is captured too.
One closed M5 bar with a value in every one of the 103 contract fields (the table has 106 columns: those plus `id`, `createdAt`, `updatedAt`); `Date.now()` fixed. It shows SQL shape and parameters only.

| Event (same five, same order, in both runs) | Before                                                                                                                                                                | After                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1 `queryRaw`, the live upsert               | `INSERT INTO market_data_v6 (106 columns) … ON CONFLICT ("symbol","timeframe","timestamp") DO UPDATE SET (104 assignments) RETURNING` **106 columns**, 213 parameters | the same text up to `RETURNING`; `RETURNING "public"."market_data_v6"."id"` **1 column**, 213 parameters |
| 2 `startTransaction`                        | (the snapshot's `createMany` runs in a transaction)                                                                                                                   | unchanged                                                                                                |
| 3 `executeRaw`, the snapshot                | `INSERT INTO market_data_point_in_time (86 columns) … ON CONFLICT DO NOTHING`, 86 parameters                                                                          | unchanged                                                                                                |
| 4, 5 `COMMIT`, `commit`                     | as is                                                                                                                                                                 | unchanged                                                                                                |

`node upsert-sql-probe.cjs diff before after` (output in `sql-diff.txt`): **299 bound parameters compared; the SQL before `RETURNING` is identical in both statements; the only statement whose `RETURNING` list changed is the upsert, 106 to 1; no statement added.**
Six parameters differ, and each is a column that is generated fresh on every run: `id` (a cuid) in both inserts, and `createdAt` / `updatedAt` (taken from the clock; the upsert uses `updatedAt` twice). The diff allows exactly those three column names and nothing else, by mapping every `$n` to its column.
This reproduces the study's 106-to-1 finding against **this** checkout's installed client (the study's own script was never re-run: it hard-codes another machine's path).

### 3.3 Unit spec (_mock_)

`market-data.processor.spec.ts`: **16 of 16 pass** (12 existing, 4 new). The one changed assertion is the exact-argument expectation, which gains `select: { id: true }`; every other existing assertion is untouched. New:

- a rejected upsert fails the job before any snapshot work (`createMany` not called);
- the live row is written before the snapshot (`mock.invocationCallOrder`);
- the snapshot step waits until a pending upsert has settled (a deferred promise);
- what the upsert resolves with is not the job result (`{ success: true }` whatever it returns).

### 3.4 Persisted-row and job-outcome parity (_real fixture_, PostgreSQL 18.1)

`market-data.processor.pg.spec.ts` runs the real `MarketDataProcessor` with the real `PrismaService` over one fixed, serial sequence of nine jobs **twice** on emptied `market_data_v6` and `market_data_point_in_time`: once as shipped, once through a thin delegating view that strips `select` from the upsert's arguments (the call as it was). The sequence: a new closed bar; the same key redelivered; the same key in a second cycle with changed indicator values and `cycle_id`; a second closed bar (M15) and its redelivery; a forming bar and its next-cycle delivery; a bar whose live upsert the database **refuses**; a closed bar whose snapshot insert the database **refuses**. The two refusals are real: two triggers the spec creates on the scratch database and drops afterwards.

**Result: 20 of 20 pass** (it is skipped, 20 tests, without the two variables; it ran on the unmutated code twice, once as written and once after prettier reformatted it, and passed both times; the mutation runs below are the proof that it can fail).

| What is proved                                                                                                                                                  | Result  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| shipped: every upsert carried `select: { id: true }` and came back with **1 field**; control (select stripped): the same upserts came back with **106 fields**  | pass    |
| persisted `market_data_v6` rows equal, column for column, with and without the projection (excluding `id`, `createdAt`, `updatedAt`)                            | pass    |
| persisted `market_data_point_in_time` rows equal (excluding `id`, `createdAt`); the clock is fixed, so `first_seen_at` and `snapshot_age_bars` are compared too | pass    |
| every job's outcome equal, and the logged warnings equal                                                                                                        | pass    |
| per run: exactly one live row per natural key, none for the refused bar                                                                                         | pass ×2 |
| per run: the repeated key holds the **second** payload and `cycle_id` 2 (all 103 fields compared)                                                               | pass ×2 |
| per run: a closed bar froze once with its **first** payload (`cycle_id` 1, every `SNAPSHOT_COLUMNS` value), age 12 and 8 bars; its redelivery froze nothing     | pass ×2 |
| per run: the forming bar is rewritten in place (cycle 3) and never frozen                                                                                       | pass ×2 |
| per run: the refused live upsert rejects the job, no live row, no snapshot                                                                                      | pass ×2 |
| per run: the refused snapshot insert does not fail the row: `{ success: true }`, the row lands, no snapshot, exactly one warning                                | pass ×2 |
| per run: every job that was not refused resolves with `{ success: true }`                                                                                       | pass ×2 |

### 3.5 Result width (_real fixture_)

The exact compiled statements and parameters of 3.2 were executed through `pg` on a second scratch database of the same cluster, and the returned row measured in PostgreSQL's text format (`measure-result-width.cjs`, `result-width.json`). Width only; **no time was taken**.

| Statement           | Fields returned | Data bytes | `DataRow` message bytes |
| ------------------- | --------------- | ---------- | ----------------------- |
| before (full row)   | 106             | 495        | 926                     |
| after (`select id`) | 1               | 25         | 36                      |

The same numbers on the insert path and on the conflict-update path. They belong to the probe's synthetic payload, whose values are short (`1.5`, `s_<name>`); real indicator values are longer, so a real row is wider than 495 bytes. This is what the upsert RETURNS; what it WRITES (rows, index entries, WAL) is the same, as 3.4 shows.

### 3.6 Mutation check (_mock_, _real fixture_, _installed-driver probe_)

Each mutant was applied to the processor on its own and judged by three detectors: the unit spec, the gated spec on the scratch database, and the SQL probe compared with the accepted "after" output (a changed `RETURNING` list counts as a defect there). After every mutant the source was restored from a backup and its sha-256 checked.

| Mutant                                                                     | Unit spec         | Gated spec        | SQL probe                                  |
| -------------------------------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------ |
| U1 remove `select`                                                         | killed (1 failed) | killed (2 failed) | killed (`RETURNING` list differs)          |
| U2 `select: { symbol: true }`                                              | killed (1 failed) | killed (2 failed) | killed (`RETURNING` list differs)          |
| U3 drop `update: data` (as `update: {}`, so the mutant compiles)           | killed (1 failed) | killed (4 failed) | killed (10 statements instead of 5)        |
| U4 drop `cycle_id` from the update (`{ ...data, cycle_id: undefined }`)    | killed (1 failed) | killed (4 failed) | killed (SQL and parameter types differ)    |
| U5 swap the order: snapshot before the live upsert                         | killed (3 failed) | killed (2 failed) | killed (first statement is the snapshot's) |
| U6 drop the `await` on the upsert                                          | killed (3 failed) | killed (4 failed) | killed (4 statements instead of 5)         |
| U7 swallow an upsert failure (`.catch(() => undefined)`), beyond the order | killed (2 failed) | killed (2 failed) | survived (an error path is not SQL shape)  |

**7 of 7 killed by the unit spec and by the gated spec; 6 of 7 by the SQL probe** (U7 is invisible to it, as expected). The final source sha-256 is `3749fea3…5362`, byte-identical to the accepted one. A first run of the harness had a flawed SQL detector (a changed `RETURNING` list was not counted, and the diff crashed on one mutant); it was fixed and the whole check re-run, and the table above is that second run.
U6 also shows a Prisma fact: a Prisma call is lazy, so an upsert that is not awaited is never sent at all (the statement count went from 5 to 4).

## 4. Full verification in `railway-gateway/` (after the change)

| Check                                     | Result                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                        | exit 0                                                                                                                                                          |
| `npm run check:sensor-kit`                | exit 0                                                                                                                                                          |
| `npx jest --maxWorkers=4`                 | exit 1, **the same 5 failures as the baseline and no other**: 78 suites (62 passed, 3 failed, 13 skipped); **3,164 tests: 2,670 passed, 5 failed, 489 skipped** |
| `npx jest --config ./test/jest-e2e.json`  | exit 0: 8 suites, 156 tests                                                                                                                                     |
| `npm run build` (`nest build`)            | exit 0 (`dist/` is gitignored)                                                                                                                                  |
| `npx prettier --check --end-of-line auto` | clean on the processor, both specs and the new evidence files (formatted with `--write` on the new files only)                                                  |

Against the baseline: +1 suite (the gated spec, skipped), +24 tests = **+4 passed** (the unit tests) **+20 skipped** (the gated spec); passed 2,666 to 2,670, skipped 469 to 489, failed 5 to 5. The 13 skipped suites are the 10 gated and 2 Python-gated ones of the baseline plus the new gated spec.
There is no working lint in this package (the script finds no files), as before.

## 5. The working tree

`git status` shows the processor and its spec modified, the new gated spec, the new evidence folder, the order and the plan; `git diff --stat`: processor +1, unit spec +43. `package.json`, `package-lock.json`, the schema, the migrations and the generated client are untouched. Nothing under `operation-service/`, `money-service/` or the monolith was read or changed.
Scratch cleanup: the scratch PostgreSQL (postmaster PID 14688, port 55471) was stopped with `pg_ctl stop -m fast`, its data directory deleted, nothing of ours is left listening, and the 10 `postgres.exe` processes that remain are Davin's own service (the same ids as before the session). No Jest or probe process is left.

## 6. Found, not changed

- **The snapshot insert runs in its own transaction.** The probe shows `createMany({ skipDuplicates: true })` as `startTransaction`, `INSERT … ON CONFLICT DO NOTHING`, `COMMIT`: three events for each closed-bar delivery, almost all of them a no-op after the first. This is the "PIT insert memo" the order leaves out of scope; the numbers here are a starting point for it.
- **The checkout's CRLF breaks five existing specs** (3.1). They were red before this session and are the same five after it. A line-ending clean-up of those files, or `.gitattributes`, is a separate decision.
- **`npm` 11 says three packages have install scripts "not yet covered by allowScripts"** (`@prisma/engines`, `prisma`, `msgpackr-extract`). Nothing was approved. The package's own `postinstall` ran and generated the client; if a later npm turns that warning into a block, `prisma generate` would have to be run by hand.

## 7. Not claimed

- **Any speed-up, lower latency, or lower database load.** The projection narrows the row the upsert returns (106 fields to 1 here); it does not change what is written: the live row, the snapshot insert attempts, index maintenance and WAL are the same (3.4). No timing was taken.
- **Production behaviour.** Stack D step 2 is not live (Davin), so there is no ingestion to observe: the rollout comparison the design asks for (job failures, queue lag, cycle readiness, snapshot warnings) is **pending go-live**. Davin's statements about the replica count and the row counts were not checked by the Executor (no production access).
- **That concurrency 1 holds across replicas.** It is per worker instance; Railway runs 1 replica for `railway-gateway` today (Davin).
- **That the width numbers in 3.5 are production widths** (synthetic values).

## 8. Rollout and rollback

- **Rollout:** one push. Railway rebuilds every service on every push to `main` (Watch Paths unset), so record the gateway deployment ID and the health `uptime` after it. Once ingestion is live, observe at least 12 consecutive market-open cycles (plan D7) before the next unit's push.
- **Rollback:** revert the commit and redeploy the gateway. Full-row results return; persisted data needs no conversion or backfill.
- **Commit (only when Davin asks), explicit paths:** `railway-gateway/src/worker/market-data.processor.ts`, `railway-gateway/test/market-data.processor.spec.ts`, `railway-gateway/test/market-data.processor.pg.spec.ts`, `docs/handoffs/2026-10-24-gateway-upsert-select-evidence/`, this report, the order, and the state files. Suggested message: `perf(gateway): return only the id from the live-row upsert`. (The plan file and the third order are not part of this unit.)

## 9. How to run it again

```bash
# unit spec, no database
( cd railway-gateway && npx jest test/market-data.processor.spec.ts )

# SQL probe (loads the real processor, no database): <out> is any folder
node docs/handoffs/2026-10-24-gateway-upsert-select-evidence/upsert-sql-probe.cjs run <label> <out>
node docs/handoffs/2026-10-24-gateway-upsert-select-evidence/upsert-sql-probe.cjs diff <before.json> <after.json>
```

The gated spec needs a throwaway PostgreSQL (initdb, `Start-Process postgres.exe -WindowStyle Hidden`, the gateway tables from `prisma migrate diff`), then
`CYCLE_PG_URL=postgres://postgres@127.0.0.1:<port>/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest test/market-data.processor.pg.spec.ts --runInBand`; the recipe is in the spec's header and in `.claude/architecture/database-traps.md`.
`mutate-processor.cjs` and `measure-result-width.cjs` take their scratchpad and database arguments on the command line (their headers say how); they point at `D:/SaaS/railway-gateway` and at a scratch cluster on 127.0.0.1:55471.
