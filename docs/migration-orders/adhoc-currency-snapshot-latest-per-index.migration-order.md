# Migration Order — Ad-hoc Session — Currency & gold snapshot: latest bar per index in one statement (Unit 2, B1 of the PostgreSQL/cache quick-win study)

> **Status: CONFIRMED** — drafted by the Executor, upgraded to DRAFT by the Advisor (Antigravity) on 2026-10-20,
> **APPROVED by Davin in chat on 2026-10-20**, **CONFIRMED by the Executor on 2026-10-20** (entry criteria below).
> Decisions taken are settled by the Advisor below; none touches money, auth semantics, secrets or CORS.
>
> **CONFIRM note (Executor, 2026-10-20):** this order file is untracked, like the Unit 1 order was; Davin's chat message
> ("APPROVED … proceed to mark the order CONFIRMED and execute Unit 2 (B1)") is treated as his live approval of this named file.
> Re-verified fresh before any edit: `HEAD` `6eca87f4` (one commit ahead of `origin/main`, nothing behind); no code file
> modified (the working tree holds only this order, the Unit 1 order and `current-state.md`, all documentation); the helper
> `lib/currency-gold-indices/queries.ts` and its test are unchanged since the draft; `npx tsc --noEmit` exit 0; `npm run test:ci`
> exit 0: **563 suites passed, 5 skipped (568); 18,711 tests passed, 315 skipped (19,026)**. Davin's production facts (PostgreSQL
> 17.11; both indexes present) are taken as given. **Q3 outcome:** Docker is not installed on this machine, so the scratch server
> is the local PostgreSQL **18.1**; production is 17.11. None of the four statements filters a later index column without the
> leading one (the only case where 18's btree skip scan applies), so the plans should be the same; the benchmark report states
> the version and this limit.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving query
refactor with a measured choice, `TEMPLATE-PORT.md` posture (dial **Low**) plus a scratch-database evidence step ·
**Status:** EXECUTED, verified, committed locally (not pushed) · **Generated:** 2026-10-20 (Executor drafted, Advisor upgraded) · **Basis:** `main` @ `6eca87f4` (Unit 1 committed locally,
not pushed) · **Flags touched:** none · **Estimated time:** ~3 h (split at the evidence step if it runs long).

**Source:** `davintrade-database-scaling/.../FINAL-RECOMMENDATIONS-2026-10-20.md`, item **B**, first helper. Direction from
Davin and the Advisor (2026-10-20): build B1 now; **one SQL statement** for the lookup (the market pool is `max: 5`,
`lib/db/market-prisma.ts:42`); compare `DISTINCT ON` against a single-round-trip per-index seek / `LATERAL` join with
`EXPLAIN` on a scratch PostgreSQL before choosing.

## Facts the Executor verified against live code (`6eca87f4`)

- `getCurrencyGoldIndexSnapshots()` (`lib/currency-gold-indices/queries.ts:56-116`) runs two statements, one after the other:
  (1) `findMany({ orderBy: [index_name asc, bar_time desc], distinct: ['index_name'], select: 5 fields })` for the newest bar
  of every index; (2) one `OR`-clause `findMany` for each index's bars from its own `session_open_bar_time` on (a bounded
  read: at most one session, about 288 rows per index). Only (1) is in scope.
- **Prisma 7.9.1 sends (1) with no `DISTINCT` and no `LIMIT`**: `SELECT id, index_name, bar_time, value, change_pct,
session_open_bar_time FROM currency_gold_indices ORDER BY index_name ASC, bar_time DESC OFFSET $1`, then removes the
  duplicates in the application. The whole history of every index crosses the driver. Re-run on this checkout with the
  study's offline probe (fake driver, no network): confirmed.
- Only caller: the snapshot route, behind the Redis cache and, since Unit 1, one fill per process. The fill therefore runs
  at most about once a minute per instance. **B1 is future-proofing: the table holds 0 rows today (reported by Davin) and the
  PRO routes (B2) query every 30 s per open cockpit.** Whether B1 or B2 pays first is for the Advisor.
- Table (`prisma/migrations/20260911120000_add_currency_gold_indices`): `index_name TEXT`, `bar_time INTEGER`, `value` and
  `change_pct` `DOUBLE PRECISION`, `session_open_bar_time INTEGER`, all NOT NULL; `UNIQUE (index_name, bar_time)` and
  `INDEX (index_name, bar_time DESC)`. Types come back from the driver as JavaScript numbers; there is no bigint column.
- Nine index names are known (`ALL_INDEX_NAMES`, same file); the table can hold only what the engine pushes.
- Precedent for raw SQL on the market client: `lib/world-gold/store.ts` (`marketPrisma.$queryRaw` as a tagged template).
- Tests that pin the old shape: `__tests__/api/currency-gold-indices.test.ts:71-84` (asserts `distinct` and `orderBy`), and
  every test in that file that queues the first `findMany` value (`:86-172`, the route block from `:175`), including the three
  concurrency tests added in Unit 1 (their `findMany` counts of 2 and 4 change). No other suite calls this helper.
- Root `tsc --noEmit` does not type-check `__tests__/` (environment-gotchas). Check touched tests with the throwaway
  tsconfig described there.
- The scratch tooling exists: PostgreSQL **18.1** binaries (`C:\Program Files\PostgreSQL\18\bin`: `initdb`, `postgres`, `psql`,
  `pg_isready`); the gated-spec convention (`__tests__/reply/day-bars.pg.spec.ts`: `CYCLE_PG_URL` on localhost plus
  `CYCLE_PG_ALLOW_WIPE=yes`, skipped otherwise); the rule for starting a scratch server (hidden `Start-Process`, never `pg_ctl
start` inside a tool call).
- **Verified by Davin on live Railway production (2026-10-20):**
  - PostgreSQL version is **17.11** (`SHOW server_version;` -> `17.11 (Debian 17.11-1.pgdg13+2)`).
  - Both physical indexes exist: `currency_gold_indices_index_name_bar_time_key` (`UNIQUE (index_name, bar_time)`) and `currency_gold_indices_index_name_bar_time_idx` (`INDEX (index_name, bar_time DESC)`).

## Decisions taken

> Settled by the Advisor (Antigravity). None touches money, auth semantics, secrets or CORS; no item needs explicit sign-off.

1. **D1 (ex-P1) — scope:** replace only statement (1); statement (2) stays as-is (lookup only). It keeps the change targeted and preserves single-statement pool constraints since statements run sequentially.
2. **D2 (ex-P2) — the lookup is ONE statement,** run through `marketPrisma.$queryRaw` as a tagged template with a typed row
   interface; table and column names are literal text in the SQL, never interpolated; no `$queryRawUnsafe`.
3. **D3 (ex-P3) — statements measured:** compare S0, S1, S2, and S3 on scratch PostgreSQL. Because production is PostgreSQL 17.11 (which lacks btree skip scan for plain `DISTINCT ON`), S2/S3 (LATERAL index seeks) are expected to show significant buffer reductions over S1 at V1/V2.
4. **D4 (ex-P4) — volumes and method:** V0 (~13k), V1 (~675k), V2 (~2.0M) synthetic rows as proposed.
5. **D5 (ex-P5) — decision rule:**
   - Must strictly satisfy result equality against reference S0 (after de-duplication).
   - Reject any statement that silently drops unlisted index names (see Q2 below).
   - Pick lowest median shared-buffer count at V2; if within 2x, pick the simpler.
6. **D6 (ex-P6) — behaviour preserved exactly:** return type `CurrencyGoldIndexSnapshot[]`, `index_name` ascending order, same degrade and logging behavior on error.
7. **D7 (ex-P7) — proof of equality:** gated spec in `__tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts` under `CYCLE_PG_URL`.

**Advisor determinations on open questions:**

- **Q1 (Scope): LOOKUP ONLY.** Replace statement (1) only. Statement (2) remains bounded by `session_open_bar_time`.
- **Q2 (Unlisted names): NO to dropping unlisted names.** Do not silently ignore index names outside `ALL_INDEX_NAMES`. Candidate must preserve full dynamic discovery (favoring S1 or S3). S2 may be benchmarked for comparison, but S3 or S1 is preferred for correctness.
- **Q3 (Postgres version): Production is PostgreSQL 17.11.** The Executor may run scratch tests using Docker `postgres:17-alpine` if available, or the local 18.1 binaries while keeping in mind that Postgres 17 lacks native skip-scan for S1. Note the version in the benchmark report.
- **Q4 (Order): Keep B1 first.** B1 establishes the `$queryRaw` single-statement pattern and gated spec framework. B2 will immediately follow using the proven pattern.

## Invariants (must not change)

- The helper's exported types, return values, ordering and degrade behaviour (P6); the snapshot route and its headers.
- Cache keys, TTLs, `lib/cache/*` (Unit 1 is not edited). No schema, migration or index change; nothing touches production.
- No second concurrent statement per call: at most one pool connection is held at a time.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `main` clean; `git log` shows `6eca87f4` or a descendant; the helper file and its test unchanged since this draft. _(HEAD `6eca87f4`; only documentation uncommitted.)_
- [x] **Davin ran these read-only statements in Railway's Query Editor (2026-10-20):** - `SHOW server_version;` -> `17.11 (Debian 17.11-1.pgdg13+2)` - `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'currency_gold_indices';` -> verified `currency_gold_indices_pkey`, `currency_gold_indices_index_name_bar_time_key` (`UNIQUE (index_name, bar_time)`), and `currency_gold_indices_index_name_bar_time_idx` (`INDEX (index_name, bar_time DESC)`).
- [x] `npx tsc --noEmit` clean; `npm run test:ci` baseline recorded in Deviations (last: 563 suites passed, 5 skipped;
      18,711 tests passed, 315 skipped). _(re-run fresh today: exit 0 and exit 0, the same counts; see the CONFIRM note.)_
- [x] PostgreSQL 18.1 binaries present; a free high port; no scratch server left from an earlier session. _(`initdb`, `postgres`,
      `psql`, `pg_isready` present; port 5432 is Davin's own service and is not touched; the scratch server will use 55471.)_
- [x] `.claude/architecture/database-traps.md` read for the section on plan-shape tests and the DDL derivation. _(lines 76 and 129 to 130.)_

## Ordered steps (each carries its verification)

1. **Say what runs, then start the scratch server.** One hidden `postgres.exe` on a high port with its data directory in the
   scratchpad (never `pg_ctl start` in a tool call; `Start-Process -WindowStyle Hidden`, poll `pg_isready`). Create the table
   from Prisma's own DDL: `prisma migrate diff --from-empty --to-schema prisma/market-data/schema.prisma --script` with a
   scratch config outside the repo. _Verify:_ `\d currency_gold_indices` shows the unique index and the descending index.
2. **Load V0, V1, V2** (P4) and `VACUUM (ANALYZE)`. _Verify:_ row counts per index, one stale index, one single-row index.
3. **Measure S0 to S3** (P4). Write `docs/handoffs/2026-10-xx-b1-explain.md` with a summary table and the trimmed plans.
   _Verify:_ each candidate's result equals S0's after de-duplication, per volume.
4. **Apply the decision rule (P5).** Record the choice and why in the hand-off. If rule (d) fires, stop here.
5. **Implement** the chosen statement in `lib/currency-gold-indices/queries.ts` (P2, P6), updating the file's header comment
   (it still says `distinct` is used). _Verify:_ `npx tsc --noEmit`.
6. **Tests.** Rewrite `currency-gold-indices.test.ts` for the new call shape (the first value now comes from `$queryRaw`; the
   statement text, the empty early return, the mapping, the degrade; the Unit 1 concurrency tests' counts become one `$queryRaw`
   plus one `findMany`); add the gated spec (P7). _Verify:_ the unit suite green; the gated spec green on the scratch server
   (report its count); the touched tests type-checked with the throwaway tsconfig.
7. **Mutation check** of the new code with the gated spec running: drop `ORDER BY`, flip `DESC`, drop `LIMIT 1` or the
   `DISTINCT ON` key (whichever the chosen statement has), change the result mapping. Restore byte-identical (sha-256).
8. **Full verification:** `npx tsc --noEmit`, `npm run lint`, `npm run test:ci` (counts equal baseline plus the new tests, 0
   failed), `npm run build`. `git diff --stat` shows only the files named here (and `next-env.d.ts` restored if the build
   rewrote it).
9. **Stop the scratch server** by PID and delete its data directory; confirm no `postgres` process of ours is left.
10. **Close.** State entry per `session-lifecycle.md`; fill Deviations. Commit only if Davin asks, by explicit paths.
    No push or deploy by the Executor.

## Done when

- The chosen statement, its evidence and its equality proof exist; every invariant holds (tests and diff).
- The hand-off document shows S0 to S3 at V0, V1 and V2 and the decision, including what was NOT shown (production plans).
- All commands in step 8 are green with counts reported; the scratch server is gone.
- **Not claimed:** any production speed-up. Plans on a scratch server with synthetic data show work done, not production latency.

## Rollback

Revert the commit. No schema, data, flag or deploy state is involved.

## Out of scope

B2 (`lib/currency-index-pro/queries.ts`), B3 (`indicator_statistics`, deferred), study items A and C (done), any index or DDL,
the sparkline statement, everything in `railway-gateway/` and `operation-service/`.

## Deviations

_(filled during execution, never deleted)_

1. **Extra deliverable files (small, in-bounds):** the order names one hand-off document; the evidence also needed its inputs and raw
   output to be reproducible, so `docs/handoffs/2026-10-20-b1-explain/` holds `gen.sql`, `bench.cjs`, `cgi-ddl.sql`, `results.json` and the
   twelve text plans next to `docs/handoffs/2026-10-20-b1-explain.md`.
2. **Q3 outcome:** Docker is not installed, so the scratch server was the local PostgreSQL **18.1**, production being 17.11. The
   report says so and why the gap should not matter (no statement filters a later index column without the leading one, the only case
   where 18's skip scan applies). Not proven for 17.
3. **V0 is 11,809 rows, not "about 13k":** the stale index (CHFX) has fewer rows at that size. No effect on the conclusion.
4. **The statement in the code is formatted over several lines;** the benchmark ran it on one line. Same tokens, same semantics; the gated
   spec runs the shipped text against a real PostgreSQL.
5. **Two more unit tests than the order listed** (`returns the snapshots in the order the lookup returned them`; `degrades to empty when the
sparkline read fails after the lookup succeeded`), because the new shape made both worth pinning. 16 tests became 18.
6. **The mutation harness misfired once and was fixed:** the first run's gated half did not start (a quoting problem with `--testMatch` under
   `cmd.exe`, visible because even the unmutated control "failed"); the unit half was valid. The gated half was re-run after the fix
   (control 9 of 9). One more mutant (M3) printed no summary because its diff output was huge; it was run alone and 8 of 9 tests failed.
7. **Two "survivors" are equivalent mutants, not test gaps:** reordering the columns inside the lateral subquery (the outer query picks them by
   name; a real swap with aliases is killed) and dropping the final `IS NOT NULL` filter (a `NULL` name matches no bar, so the lateral join
   discards it). A third, removing the final `ORDER BY`, survives the gated spec (the nested loop already yields names in order) and is killed by
   the unit test that pins the statement text.
8. **Root `tsc` does not check `__tests__/`:** the touched tests were checked with the throwaway tsconfig from the gotchas; the only error is
   `@jest/globals` not resolving, which every existing test shares. `lib/currency-gold-indices/queries.ts` is inside the root run.

**Evidence.**

- Benchmark (hand-off): at V2 (2,010,241 rows) shared buffers S0 324,118 · S1 324,118 · S2 39 · S3 **96**; server time 3,339 ms · 3,468 ms · 0.29 ms ·
  **0.62 ms**; S2 returns 9 rows against the reference's 10 (it drops the unlisted `ZZ1X`) and is rejected; S1 saves only the transfer (10 rows
  against 2,010,241 and 146 MB). S3 chosen under D5; rule (d) did not fire (0.3% of heap pages).
- Gated spec `__tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts`: **9 of 9 on PostgreSQL 18.1**, skipped without
  `CYCLE_PG_URL` and `CYCLE_PG_ALLOW_WIPE=yes`; it compares the new function with the old Prisma `distinct` version over eight data shapes and
  counts the statements (2 for a filled table, 1 for an empty one).
- Mutation checks (10 mutants plus the corrected swap): unit suite kills M1, M2, M3, M5, M6, M8, M10; gated spec kills M1 to M5, M7b, M8, M10;
  every non-equivalent mutant is killed by at least one; file restored byte-identical (sha-256) after every run.
- Before: `tsc` exit 0; `test:ci` exit 0, 563 suites passed (5 skipped), 18,711 tests passed (315 skipped). After: `tsc` exit 0; `npm run lint`
  exit 0 (0 errors, the same 5 existing warnings); `test:ci` exit 0, **563 suites passed (5 skipped), 18,713 tests passed (315 skipped), 0
  failed** (+2); `npm run build` exit 0. The gated spec is not collected by `test:ci`.
- Scratch server stopped by PID, data directory deleted, no process of ours left; port 5432 (Davin's own service) never touched.
  `next-env.d.ts`, rewritten by the build, restored.

**Not done / not claimed:** nothing about production plans or latency; no index or DDL change; B2 and B3 untouched; not pushed or
deployed. (Committed locally on Davin's word after this section was written.)

## Next-session handoff (notes for the following order, not a plan)

- **B2** would reuse the chosen statement with a name filter (`WHERE "index_name" = ANY($1)`) and three columns; its tests are the
  PRO chart, screener and detail suites (the screener test pins the call order at `currency-index-pro-screener.test.ts:120`).
- If the evidence shows the table scan cannot be avoided without an index, that is a DDL order for Davin, applied by him.
