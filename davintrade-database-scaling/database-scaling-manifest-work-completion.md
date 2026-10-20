# Database Scaling Study (PostgreSQL & Cache Quick Wins) Manifest — Work Completion Report

**Date:** 2026-10-20 (one session)
**Status:** Units 1–3 of the quick-win batch are code complete, verified, committed, and pushed to
`origin/main` (`a76b6347..1cc08d52`). The Advisor reports a live smoke test of the two public routes
(HTTP 200, no SQL errors, Vercel cache HIT — §4.2). The PRO routes behind Unit 3 have not been
exercised on production yet (§4.2). Unit 4 (B3, `indicator_statistics`) is **deferred by decision**, not
by oversight (§7). The study's recommendation A (narrow channel projection) was **already on `main`**
before the session began (§1.1). Nothing was applied to production by the Executor: no migration, no
DDL, no index change, no production query.
**Type:** Ad-hoc session (Davin-requested directly in chat, one unit at a time) — outside the
phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Each unit followed the
order lifecycle `PRE-DRAFT` (Executor) → `DRAFT` (Advisor, Antigravity) → `APPROVED` (Davin) →
`CONFIRMED` (Executor, after re-verifying code and baseline) → executed. Recorded in three ad-hoc entries
in `.claude/state/current-state.md`, all dated 2026-10-20 (Unit 1's has since been rotated into
`history/2026-10-sessions.md`, as the session-lifecycle protocol requires).

> **Scope note:** this document covers the first batch of the study in this folder,
> [`database-scaling-study-2026-10-20/database-scaling-study/FINAL-RECOMMENDATIONS-2026-10-20.md`](database-scaling-study-2026-10-20/database-scaling-study/FINAL-RECOMMENDATIONS-2026-10-20.md):
> **C** (share concurrent cache fills) and **B** (find the newest row per group in PostgreSQL instead of
> in the application), the monolith only. It does not cover the study's second wave (§7), any schema,
> migration or index change, or anything in `railway-gateway/`, `operation-service/` or `money-service/`.
> The study itself is an assessment written outside this repository (against commit `c6dccff1`, in a
> separate dirty checkout); nothing in its folder was modified.

---

## 1. What was done

Five pieces of work, each verified before the next began: a feasibility check of the study against the
live code, then three implementation units (each its own order, its own evidence, its own commit).

### 1.1 Starting point — the pull, and the feasibility check of the study

- **The pull was blocked, and nothing was overwritten.** `git pull --ff-only origin main` aborted
  because five of the working tree's uncommitted state files (`environment-gotchas.md`,
  `current-state.md`, `history/2026-10-sessions.md`, `history/index.md`, `waiting-on.md`) were also
  changed in the 59 incoming commits. HEAD stayed `ca891802` and all 8 local changes were intact.
  `git stash` is banned in this repository and a local commit would have broken the fast-forward, so
  neither was used. The checkout was then synchronised outside this session; per the report Davin brought
  back, the earlier uncommitted Stage B0 drafts were preserved on the branch `b0/plan-draft` (`a88076bf`)
  and `main` fast-forwarded to `a76b6347` (the commit that added the study). Verified by the Executor
  afterwards: branch, HEAD, a clean tree, and `b0/plan-draft` present.
- **The study was checked against the live code, not taken as written.** Its 23 reviewed source files were
  hashed against `origin/main`: **21 are byte-identical; the 2 that changed are exactly the files of
  recommendation A** (`app/api/market-data/channel/route.ts` and
  `operation-service/src/market-data/market-data.service.ts`). Commits `b0191c18` and `e4d23dd7`
  (2026-10-19), made after the study's base commit, had already added the explicit `select` to both
  branches (and guard tests). **A was therefore not built; the study's own "next unit" was stale.**
- **The study's SQL claims were reproduced on this checkout** with its offline compiler probe (a fake
  driver, no network), Prisma 7.9.1: the three "latest per group" `distinct` reads are sent with **no
  `DISTINCT` and no `LIMIT`** (`ORDER BY … OFFSET` only) and de-duplicated in the application; a bare
  channel read selects 106 columns, a named one 5.
- **Additions from the live code** (each later confirmed by measurement, §1.3): `DISTINCT ON` saves only the
  transfer, not the database's reading of every row; the existing tests pin the old call shape
  (`distinct: [...]` assertions) and cannot prove SQL equivalence, so a gated real-PostgreSQL spec is
  needed; no prune job for `currency_gold_indices` or `indicator_statistics` exists in source, so history
  grows without a bound in code.
- **Production facts supplied by Davin and the Advisor** (read-only queries in Railway; not re-measured by
  the Executor): `currency_gold_indices`, `indicator_statistics` and `market_data_v6` hold **0 rows**;
  PostgreSQL is **17.11**; the primary key, `UNIQUE (index_name, bar_time)` and
  `(index_name, bar_time DESC)` exist physically on `currency_gold_indices`. So nothing in the batch can
  show a measured benefit in production yet.
- **Direction taken (Davin and the Advisor):** C first (Unit 1), then B1 (Unit 2) and B2 (Unit 3), each
  under the rule of **one SQL statement per lookup** (the market pool is `max: 5`); B3 deferred.

### 1.2 Unit 1 — share concurrent cache fills (study item C)

- **New** `lib/cache/single-flight.ts` — `singleFlight(key, load)`: a module-level map of pending runs.
  Callers that ask for the same key while a run is pending share that one run; the entry is removed the
  moment the run settles. It keeps nothing (no TTL, no negative caching), has no logging or counter, and
  is process-local (not a lock across instances).
- **Edited** the three cache-aside routes so the whole `get cache → load → set cache` sequence runs once
  per key per warm process: the public snapshot (`app/api/market/currency-gold-indices/route.ts`), the
  public history (`…/history/route.ts`, key per timeframe) and the PRO comparison
  (`app/api/market/currency-index-pro/comparison/route.ts`, key per index and timeframe, placed **below** the
  401/403/400 checks so an anonymous or FREE caller can never join a PRO fill).
- **Invariants held:** TTLs (`CACHE_TTL.SHORT` = 60 s), cache keys, `lib/cache/cache-manager.ts`, response
  bodies and headers, the Redis fall-through, per-index failure isolation. No request or abort signal
  reaches a shared loader, so one cancelled browser request cannot cancel work another caller needs.
- **Decisions (Advisor, in the order):** one generic helper in `lib/cache/`; wrap the whole sequence, hit
  path included; results shared by reference (read-only; the routes only serialise them); a rejection
  reaches every joiner and frees the key; no counter or logging.
- **Not claimed:** any speed-up. It helps only where concurrent misses land on the same warm instance (the
  monolith runs on Vercel; instance sharing is unverified), and never across processes.
- **Left alone, noted:** the loaders swallow a database error and the routes cache the empty result for
  60 s (existing behaviour); the monolith Redis singleton that stops reconnecting after ten retries.

### 1.3 Unit 2 (B1) — the currency & gold snapshot: newest bar per index in one statement

- **Edited** `lib/currency-gold-indices/queries.ts`. The first of the two reads in
  `getCurrencyGoldIndexSnapshots()` was Prisma's `distinct` (the whole history of every index to the
  application on each fill). It is now **one constant raw statement** through `marketPrisma.$queryRaw`: a
  recursive walk over the distinct `index_name` values (one index seek each), then
  `LATERAL … ORDER BY bar_time DESC LIMIT 1` per name, ordered by name. Every index name in the table is
  still found, listed or not. The sparkline read, the mapping, the empty early return and the degrade are
  unchanged; there is no bind parameter.
- **Four statements were measured** on a scratch PostgreSQL (§1.5) at three volumes — **S0** today's
  statement, **S1** `DISTINCT ON`, **S2** a `LATERAL` over the nine listed names, **S3** the chosen
  recursive walk. At the largest volume (2,010,241 rows):

  | Statement | Shared buffers | Server time | Equal to reference |
  | --------- | -------------- | ----------- | ------------------ |
  | S0        | 324,118        | 3,339 ms    | yes                |
  | S1        | 324,118        | 3,468 ms    | yes                |
  | S2        | 39             | 0.29 ms     | **no** (9 of 10)   |
  | S3        | **96**         | **0.62 ms** | yes                |

  S1 returns 10 rows instead of 2,010,241 (394 bytes instead of 146 MB) but reads exactly as much as S0: its
  plan is a `Unique` over a full ordered index scan. S3's work does not grow with the history (96 buffers at
  both 662k and 2.0M rows); it also held on an empty table, a single group, and a table whose visibility map
  had not been built (131 buffers).

- **S2 was rejected** by the order's rule, not for speed: it silently drops an index name that is in the table
  but not in `ALL_INDEX_NAMES` (the unlisted single-row `ZZ1X` in the fixture), and the Advisor ruled that
  dynamic name discovery must be preserved.
- **Decisions (Advisor):** lookup only (the sparkline read is already bounded to one session); never drop an
  unlisted name; the scratch version note (§1.5); B1 before B2.

### 1.4 Unit 3 (B2) — the PRO session bars: newest bar per requested index in one statement

- **Edited** `lib/currency-index-pro/queries.ts` — `getTodaysSessionBarsForIndices()`, behind the PRO chart,
  screener and detail routes (per the study, whose source hashes matched, the chart and screener hooks poll about
  every 30 s per open cockpit, with no server-side cache). Its first read (`where index_name in (…)` + `distinct`) sent every historical row of the
  requested indices to the application. It is now **one constant statement**: the requested names, made
  distinct, each with a `LATERAL … ORDER BY bar_time DESC LIMIT 1` seek, ordered by index name (the chart route
  reads the first `Map` entry). The names are **one bound `text[]` parameter**; the driver adapter accepts it,
  so the approved `Prisma.join` fallback was not needed. An empty request now returns an empty `Map` without
  a database call. The bars read, the `Map` construction, the degrade and the three routes are unchanged.
- **Measured** the same four statements for three filters (the eight FX names the chart and screener send, the
  one name the detail route sends, and a hostile mix: a repeated name, a name with no rows, an unlisted name in
  the table). At 2,010,241 rows:

  | Filter | S0 buffers | S1 buffers | S2 buffers | S3 buffers |
  | ------ | ---------- | ---------- | ---------- | ---------- |
  | FX8    | 287,918    | 287,918    | **35**     | 69         |
  | ONE    | 35,526     | 35,529     | **7**      | 12         |
  | MIXED  | 36,401     | 36,401     | **18**     | 32         |

  Server time for FX8: about 2.9 s, 3.0 s, **0.29 ms**, 0.63 ms. All four equal the independent reference for
  every filter and volume.

- **Chosen: S2.** In B2 the caller's names _are_ the filter, so the per-name statement is semantically exact
  (the reason S2 was rejected in B1 does not apply). It had the lowest buffers for every filter and was within
  2× of S3 each time (1.97×, 1.71×, 1.78×), so the Advisor's tie-break also preferred it.
- **Decisions (Advisor):** S2 when within 2× of S3; a separate copy of the SQL (B1's code and tests untouched);
  `Prisma.join` approved only as a fallback; the early return for an empty request.

### 1.5 The evidence method (shared by Units 2 and 3)

- A hidden scratch **PostgreSQL 18.1** (the local binaries; `initdb --locale=C`, a high port, a data
  directory in the session scratchpad, started with a hidden `Start-Process`, never touching Davin's own
  service on port 5432), with the table created from Prisma's own DDL
  (`prisma migrate diff --from-empty --to-schema …`) and the same three indexes as production. **Production
  is 17.11 and Docker is not installed**, so no 17 server was available; none of the statements filters a
  later index column without the leading one (the only case where 18's btree skip scan applies), so the
  plans should match — not proven. Each server was stopped by its PID and its data deleted afterwards.
- **Synthetic data**, loaded in the engine's arrival order (time order across indices, so the heap is not in
  index order): V0 11,809 rows, V1 662,401 (about a year), V2 2,010,241 (about three years); nine listed
  indices (CHFX stale by 40 days, XAUX's session opening 60 s later) plus the unlisted single-row `ZZ1X`.
- **Method:** after `VACUUM (ANALYZE)`, `EXPLAIN (ANALYZE, BUFFERS)` five times per statement and volume
  (median), a text plan, and an end-to-end `psql` run for rows and bytes. The primary metric is **shared
  buffers touched (hit + read)**, which does not depend on what was cached. Equality is an md5 of each
  candidate's rows against an independent reference (the row at each index's `max(bar_time)`).
- Scripts, DDL, results and every text plan are kept with the hand-offs
  (`docs/handoffs/2026-10-20-b1-explain/`, `…/2026-10-20-b2-explain/`) so the numbers can be reproduced.

### 1.6 What the work found along the way

- **The study's first pick was already shipped** (§1.1), and its suggested `DISTINCT ON` fix turned out to
  change the transfer but not the database's work (§1.3). The measurement, not the study's reasoning, chose
  the final statement.
- **A real test gap, found by the mutation check and fixed (Unit 3).** The first version of the B2 gated spec
  gave every bar of an index the same session open. This helper's lookup returns only `index_name` and
  `session_open_bar_time`, so picking the _oldest_ bar instead of the newest (mutant M1), dropping the ordering
  (M2) or dropping `LIMIT 1` (M3) changed nothing the spec could see. (B1 was not affected: its lookup also
  returns `bar_time` and `value`.) Two tests with a session that rolls over each day were added and the larger
  fixture now uses per-day sessions; the same mutants are then killed. The spec went from 12 to 14 tests.
- **A harness bug, caught because even the unmutated control "failed" (Unit 2).** The gated half of the first
  mutation run did not start (a `--testMatch` quoting problem under `cmd.exe`); the unit half was valid. It was
  fixed and the gated half re-run (control 9 of 9). One mutant printed no summary because its failure diff was
  huge; it was run alone (8 of 9 tests failed).
- **Equivalent mutants, not test gaps:** reordering columns inside the B1 lateral subquery (the outer query picks
  them by name; a real swap with aliases is killed), dropping B1's final `IS NOT NULL` filter (a `NULL` name
  matches no bar), and in B2 dropping the `DISTINCT` over the requested names (the `Map` de-duplicates by key)
  and passing the caller's own array instead of a copy (nothing mutates it). The unit tests that pin the
  statement text kill the B2 pair.
- **Root `tsc --noEmit` does not type-check `__tests__/`** (already recorded in
  `.claude/architecture/environment-gotchas.md`). The touched tests were checked with the throwaway-tsconfig
  method it describes; the only error is `@jest/globals` not resolving, which every existing test shares.
- **`next build` rewrites `next-env.d.ts`** (quote style only); it was restored after each build so no
  unrelated change reached a commit.

---

## 2. Files changed

| File                                                                                                                                                | Change                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/cache/single-flight.ts`                                                                                                                        | **Added (Unit 1).** `singleFlight(key, load)`, 41 lines                                                                          |
| `app/api/market/currency-gold-indices/route.ts`, `…/history/route.ts`, `app/api/market/currency-index-pro/comparison/route.ts`                      | **Unit 1.** The get → load → set sequence wrapped per key                                                                        |
| `__tests__/lib/cache/single-flight.test.ts`                                                                                                         | **Added (Unit 1).** 8 tests                                                                                                      |
| `__tests__/helpers/async-helpers.ts`                                                                                                                | **Added (Unit 1).** `deferred()` and `flushPromises()` for tests that hold a promise open                                        |
| `__tests__/api/currency-gold-indices{,-history}.test.ts`, `__tests__/api/currency-index-pro-comparison.test.ts`                                     | **Unit 1.** 12 concurrency tests (3 + 3 + 6) added to the existing suites                                                        |
| `lib/currency-gold-indices/queries.ts`                                                                                                              | **Unit 2.** The latest-bar lookup: Prisma `distinct` → one `$queryRaw` statement; header comment rewritten                       |
| `__tests__/api/currency-gold-indices.test.ts`                                                                                                       | **Unit 2.** Rewritten for the new call shape (16 → 18 tests); the Unit 1 concurrency counts changed with it                      |
| `__tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts`                                                                                   | **Added (Unit 2).** Gated real-PostgreSQL spec, 9 tests, 354 lines                                                               |
| `lib/currency-index-pro/queries.ts`                                                                                                                 | **Unit 3.** The lookup of `getTodaysSessionBarsForIndices()`: `distinct` → one `$queryRaw` statement; doc comment rewritten      |
| `__tests__/lib/currency-index-pro/session-bars.test.ts`                                                                                             | **Added (Unit 3).** Helper unit test, 9 tests                                                                                    |
| `__tests__/lib/currency-index-pro/session-bars.pg.spec.ts`                                                                                          | **Added (Unit 3).** Gated real-PostgreSQL spec, 14 tests, 405 lines                                                              |
| `__tests__/api/currency-index-pro-{chart,screener,detail}.test.ts`                                                                                  | **Unit 3.** Lookup moved to `$queryRaw`; "not called" on 401/400/403; one wiring test each                                       |
| `docs/migration-orders/adhoc-market-cache-single-flight.migration-order.md`                                                                         | **Added (Unit 1).** The order, 6 recorded deviations; status wording updated in later commits                                    |
| `docs/migration-orders/adhoc-currency-snapshot-latest-per-index.migration-order.md`                                                                 | **Added (Unit 2).** The order, 8 recorded deviations                                                                             |
| `docs/migration-orders/adhoc-pro-session-bars-latest-per-index.migration-order.md`                                                                  | **Added (Unit 3).** The order, 9 recorded deviations                                                                             |
| `docs/handoffs/2026-10-20-b1-explain.md` + `docs/handoffs/2026-10-20-b1-explain/` (`gen.sql`, `cgi-ddl.sql`, `bench.cjs`, `results.json`, 12 plans) | **Added (Unit 2).** The evidence report and its reproducible inputs and outputs                                                  |
| `docs/handoffs/2026-10-20-b2-explain.md` + `docs/handoffs/2026-10-20-b2-explain/` (`bench-b2.cjs`, `results.json`, 36 plans)                        | **Added (Unit 3).** The evidence report; reuses B1's generator and DDL                                                           |
| `.claude/state/current-state.md`, `.claude/state/history/2026-10-sessions.md`, `.claude/state/history/index.md`                                     | Three session entries added on top, the oldest rotated into history each time, the "Where the project stands" bullets, index row |
| `davintrade-database-scaling/database-scaling-manifest-work-completion.md`                                                                          | **Added.** This manifest                                                                                                         |

**Three feature commits, 79 distinct files** (89 file entries across the commits: 13 + 25 + 51, because the
state files and the earlier orders were touched more than once; 54 of the 79 are benchmark plans, scripts,
inputs and results), **+4,461 / −119 lines net**, plus this manifest. Production code touched:
**`lib/cache/single-flight.ts` (new), 3 routes, and 2 query modules** — 234 changed lines (+187 −47); tests
+1,558 −58; the rest is evidence and records.

---

## 3. Test verification

| Check                                                                            | Result                                                                                                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline before Unit 1 (`npx tsc --noEmit`; `npm run test:ci`)                   | exit 0; **562 suites passed, 5 skipped (567); 18,691 tests passed, 315 skipped (19,006)**                                                                            |
| Unit 1 — after (`tsc`; `npm run lint`; `test:ci`; `npm run build`)               | all exit 0; lint 0 errors (the 5 existing warnings, none in these files); **563 suites, 18,711 tests passed** (+1 suite, +20: 8 helper, 12 concurrency); 315 skipped |
| Unit 1 — mutation check                                                          | helper: 3 of 4 mutants killed, the 4th is an equivalent defensive guard; routes: **6 of 6** killed; files restored byte-identical (sha-256)                          |
| Unit 2 — baseline re-run before editing                                          | exit 0 / exit 0; 563 suites, 18,711 tests passed                                                                                                                     |
| Unit 2 — after (`tsc`, lint, `test:ci`, build)                                   | all exit 0; **563 suites, 18,713 tests passed** (+2: the unit file went from 16 to 18 tests)                                                                         |
| Unit 2 — gated spec `latest-per-index.pg.spec.ts` on the scratch PostgreSQL 18.1 | **9 of 9**; compares the new function with the old Prisma `distinct` version over eight data shapes and counts statements (2 for a filled table, 1 for an empty one) |
| Unit 2 — mutation check (10 mutants + a corrected column swap)                   | every non-equivalent mutant killed by the unit suite, the gated spec, or both; 2 equivalent (column reorder, final `IS NOT NULL`); restored byte-identical           |
| Unit 3 — baseline re-run before editing                                          | exit 0 / exit 0; 563 suites, 18,713 tests passed                                                                                                                     |
| Unit 3 — after (`tsc`, lint, `test:ci`, build)                                   | all exit 0; **564 suites, 18,725 tests passed** (+1 suite, +12: 9 helper, 3 wiring); 315 skipped                                                                     |
| Unit 3 — gated spec `session-bars.pg.spec.ts` on the scratch PostgreSQL 18.1     | **14 of 14** (12 first, 14 after the fixture gap of §1.6); also counts statements (none for an empty request, one when nothing is found, two otherwise)              |
| Unit 3 — mutation check (12 mutants)                                             | every mutant killed by at least one suite; the first run exposed the fixture gap (§1.6); restored byte-identical                                                     |
| Type-check of the touched tests (throwaway tsconfig, three times)                | no error in any added line; only the shared `@jest/globals` resolution error                                                                                         |
| Pre-push gate on the three commits (`pnpm run type-check`, then `test:quick`)    | **564 suites passed (5 skipped), 18,725 tests passed (315 skipped), 0 failed** in 288 s                                                                              |
| `node scripts/agents/check-operating-docs.mjs`                                   | 23 broken-link findings, all in `docs/codex/`, pre-existing, none in a file touched here                                                                             |

**Net over the session:** 562 → 564 suites and 18,691 → 18,725 passed tests (+34 = 20 + 2 + 12), with 315
skipped before and after, 0 failed at every checkpoint. The two gated specs (9 + 14 tests) are **not** part of
`test:ci` (the root Jest configuration collects only `*.test.ts`); they run against a scratch server with
`CYCLE_PG_URL` (localhost) and `CYCLE_PG_ALLOW_WIPE=yes`, and are skipped otherwise.

This machine skips 5 suites and 315 tests where the 2026-10-19 state entry (a cloud run) skipped 1 and 27 — the
same 19,006-test total; not investigated.

---

## 4. Live verification

### 4.1 By the Executor — scratch PostgreSQL only

Everything above ran against a throwaway local PostgreSQL 18.1 with synthetic data (§1.5), the real Prisma
client and driver adapter, and the shipped statement text. **No production database, Redis, deployed service or
browser was touched by the Executor**, and no preview server was started (the change has no UI).

### 4.2 By the Advisor, reported — production

Reported by Davin (not observed by the Executor): after the push, the Advisor ran a live smoke test of
`https://www.davintrade.app/api/market/currency-gold-indices` and its history route — **both HTTP 200, zero SQL
errors, Vercel cache HIT confirmed.** The snapshot route exercises Unit 1 and Unit 2 (it calls B1's helper) on
production's PostgreSQL 17.11; the history route exercises Unit 1 only (its query is unchanged). The tables are
empty, so the new statement ran against 0 rows.

**Not exercised:** Unit 3. Its routes (PRO chart, screener, detail) sit behind a PRO session, so that smoke test
could not reach them; they run the new statement the first time a PRO user opens the cockpit (expected result on
empty tables: an empty response). The Executor did not check the Vercel build, the Railway rebuilds that every
push to `main` triggers, or the GitHub Actions runs (several workflows are recorded as failing on every push
since 2026-10-09).

---

## 5. What Davin needs to do

Nothing is required to finish this batch. Optional, in order of value:

- [x] **Commit and push** Units 1–3 — **done** (`6eca87f4`, `bfef7e74`, `1cc08d52`, pushed together).
- [x] **Smoke-test the public routes after the deploy** — done by the Advisor (§4.2).
- [ ] **One logged-in PRO page load** (the cockpit, which calls chart and screener) and a glance at the Vercel
      logs for an SQL error — the first production run of B2's statement.
- [ ] **A real plan, once the tables hold rows:** `EXPLAIN (ANALYZE, BUFFERS)` of the B1 and B2 statements in
      Railway. The scratch plans show work done on synthetic data, not production latency.
- [ ] **Look at the benefit when ingestion starts:** concurrent loaders per key and origin database calls for
      Unit 1; handler time for the three PRO routes for Unit 3. Nothing is measurable on empty tables.
- [x] **Commit and push this manifest** — done on Davin's word, in the commit that follows the three above.
- [ ] _(Optional)_ The three state entries say the push was "ordered, outcome in `git log origin/main`", written
      before the push ran. A docs-only follow-up could say "pushed"; it was not worth another full-suite push on
      its own.

---

## 6. Git history

Landed as three scoped commits on `main` and pushed to `origin/main` (`a76b6347..1cc08d52`):

| Commit        | Summary                                                                                    | Size                                      |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `6eca87f4`    | `perf(market): share one in-flight fill per cache key on the three market cache routes`    | 13 files, +705 −29                        |
| `bfef7e74`    | `perf(market): fetch newest bar per currency/gold index via loose index scan in one query` | 25 files (12 are text plans), +1,401 −101 |
| `1cc08d52`    | `perf(market): fetch latest session open per requested index via per-name lateral seek`    | 51 files (36 are text plans), +2,395 −29  |
| _this commit_ | `docs(database): add the database-scaling quick-win batch work-completion manifest`        | 1 file                                    |

Every commit passed the repository's pre-commit hook (`lint-staged`: `eslint --fix` + `prettier --write` on
the staged files). Commits were made with explicit paths, as the order of each unit required, and only on
Davin's word; the push ran the repository's pre-push gate first (type-check and the whole Jest suite,
§3). A commit cannot name its own hash, so each state entry and order status line that said "not committed" or
"not pushed" was corrected in the next commit (Unit 1's in `bfef7e74`, Unit 1's and Unit 2's status lines in
`1cc08d52`).

---

## 7. Explicitly out of scope

- **B3 — `indicator_statistics` (`lib/indicator-statistics/queries.ts`)** — **deferred by Davin and the
  Advisor**: the table holds 0 rows, and its `ORDER BY … captured_at DESC` does not match the all-ascending
  unique index, so a loose scan over `(symbol, timeframe, source)` needs its own measurement and probably an
  index, which is a DDL order Davin applies himself.
- **Study item A (narrow channel projection)** — already on `main` before the session (§1.1).
- **The study's second wave** — a shared PRO raw-market snapshot (needs a decided freshness budget), the
  ID-only gateway upsert return, Redis background recovery, finite NestJS pool-acquisition deadlines,
  duplicate-index consolidation, the point-in-time insert memo and alert-reload coordination. Several touch
  `railway-gateway/` (the ingest path "must never blip") or money/ingestion correctness and need their own
  orders.
- **Any schema, migration, index or DDL change**, and any production operation — none was made.
- **A shared function for the B1 and B2 SQL** — they are two near-identical statements in two modules (kept
  separate by the Advisor's ruling so B1's code and tests stayed untouched); extracting one is a small order of
  its own.
- **`frontend/`, `seed-code/`, and the separate stacks** — not touched.
