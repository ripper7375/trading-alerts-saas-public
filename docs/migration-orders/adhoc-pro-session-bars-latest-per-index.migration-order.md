# Migration Order — Ad-hoc Session — PRO session bars: latest bar per requested index in one statement (Unit 3, B2 of the PostgreSQL/cache quick-win study)

> **Status: CONFIRMED** — drafted by the Executor, upgraded to DRAFT by the Advisor (Antigravity) on 2026-10-20,
> **APPROVED by Davin in chat on 2026-10-20**, **CONFIRMED by the Executor on 2026-10-20** (entry criteria below).
> Decisions taken are settled by the Advisor below; none touches money, auth semantics, secrets or CORS.
>
> **CONFIRM note (Executor, 2026-10-20):** this order file is untracked, like the earlier two; Davin's chat message ("APPROVED … proceed
> to mark the order CONFIRMED and execute Unit 3 (B2)") is treated as his live approval of this named file. Re-verified fresh before any
> edit: `HEAD` `bfef7e74` (two commits ahead of `origin/main`, nothing behind); no code file modified (the working tree holds only this
> order and a one-line pointer in `current-state.md`); `lib/currency-index-pro/queries.ts` and the three route tests unchanged since the
> draft; `npx tsc --noEmit` exit 0; `npm run test:ci` exit 0: **563 suites passed, 5 skipped (568); 18,713 tests passed, 315 skipped
> (19,028)**. The Advisor's answers are followed as written: S2 is preferred when within 2x of S3; a separate copy of the SQL; `Prisma.join`
> only if the adapter cannot bind a `text[]`; an early return for an empty request. As in B1 the scratch server is the local PostgreSQL
> **18.1** (production 17.11, Docker not installed) and the report says so.

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving query
refactor with a short measured check, `TEMPLATE-PORT.md` posture (dial **Low**) · **Status:** EXECUTED, verified, committed ·
**Generated:** 2026-10-20 (Executor drafted, Advisor upgraded) · **Basis:** `main` @ `bfef7e74` (Units 1 and 2 committed locally at the time of writing) ·
**Flags touched:** none · **Estimated time:** ~2.5 h.

**Source:** `davintrade-database-scaling/.../FINAL-RECOMMENDATIONS-2026-10-20.md`, item **B**, second helper. Direction from
Davin and the Advisor (2026-10-20): apply the B1 pattern (one SQL statement, seek per index plus `LATERAL ... LIMIT 1`)
to `lib/currency-index-pro/queries.ts`; one statement for the lookup (the market pool is `max: 5`).

## Facts the Executor verified against live code (`bfef7e74`)

- `getTodaysSessionBarsForIndices(indexNames)` (`lib/currency-index-pro/queries.ts:65-113`) runs two statements, one after the
  other: (1) `findMany({ where: { index_name: { in: [...indexNames] } }, orderBy: [index_name asc, bar_time desc], distinct:
['index_name'], select: { index_name, session_open_bar_time } })`; (2) one `OR`-clause `findMany` for each index's bars from
  its own session open (bounded: at most one session). It returns a `Map<string, { sessionOpenBarTime, bars }>`. Only (1) is in scope.
- As in B1, **Prisma 7.9.1 sends (1) with no `DISTINCT` and no `LIMIT`** (the study's offline probe, case
  `pro-session-latest-distinct-ordered`: `SELECT id, index_name, session_open_bar_time FROM currency_gold_indices WHERE index_name
IN ($1,$2) ORDER BY index_name ASC, bar_time DESC OFFSET $3`). The `IN` list narrows to the requested indices but not to their
  newest bar: every historical row of those indices crosses the driver.
- Three callers, all behind a PRO session check and with no server-side cache: `chart/route.ts:65` (the 8 FX index names),
  `screener/route.ts:96` (the same 8), `detail/route.ts:89` (one name). Per the study (source hashes matched) the chart and screener hooks poll
  every 30 s per open cockpit, so this statement runs about four times a minute per PRO viewer. **It is the hottest of the three
  helpers once data flows; today the table holds 0 rows (Davin).**
- **Map order matters in one place:** `chart/route.ts:73` reads `[...barsByIndex.values()][0]` for the session boundary, i.e. the first
  entry; today that is the alphabetically first index present, because statement (1) is ordered by `index_name`.
- No helper-level test exists (`__tests__/lib/currency-index-pro/` holds math, pairs, performance, signals). The helper is covered only
  through the three route suites, which mock `marketPrisma.currencyGoldIndex.findMany` for every read:
  `currency-index-pro-chart.test.ts` (mock at the top, `beforeEach` queues `findMany` -> `[]`), `-screener.test.ts`
  (`beforeEach` at `:38`; the dual-timeframe test at `:104-182` queues the lookup as the FIRST value and the bars as the SECOND) and
  `-detail.test.ts` (`beforeEach` at `:45`). Each also asserts `findMany` was NOT called for a 401 or 403.
- **Reusable from B1 (committed):** the evidence method and scripts in `docs/handoffs/2026-10-20-b1-explain/` (`gen.sql`, `cgi-ddl.sql`,
  `bench.cjs`), the gated-spec pattern in `__tests__/lib/currency-gold-indices/latest-per-index.pg.spec.ts` (real client through
  `jest.mock`, the old function kept as reference, statement count through `$on('query')`), and the scratch tooling (PostgreSQL 18.1
  binaries; Docker is not installed).
- **Verified by Davin on production (2026-10-20):** PostgreSQL 17.11; the primary key, `UNIQUE (index_name, bar_time)` and
  `(index_name, bar_time DESC)` all exist.

## Decisions taken

> Settled by the Advisor (Antigravity). None touches money, auth semantics, secrets or CORS. No schema change.

1. **D1 (ex-P1) — scope:** replace only statement (1); statement (2), the `Map` construction, the degrade and the three routes stay. _Undo:_ low.
2. **D2 (ex-P2) — the lookup is ONE constant-text statement** through `marketPrisma.$queryRaw` as a tagged template with a typed row interface;
   table and column names literal; the requested names are the only bound value. Selected columns: `index_name`, `session_open_bar_time`.
3. **D3 (ex-P3) — statements measured:** measure S0, S1, S2, and S3 for the 8-name filter and 1-name filter at V1 and V2.
   In B2, `indexNames` is an explicit caller-supplied filter, so S2 (`unnest` + `CROSS JOIN LATERAL`) is semantically exact and avoids recursive CTE overhead. S3 remains a valid alternative if closer in performance.
4. **D4 (ex-P4) — decision rule:**
   - Must strictly satisfy result equality against reference over requested names.
   - Lowest median shared-buffer count at V2 wins.
   - If S2 and S3 are within 2x, pick S2 for its structural simplicity (no recursion overhead for an explicit input array), unless S3 demonstrates clear operational advantages.
5. **D5 (ex-P5) — behaviour preserved exactly:** the `Map` type and shape; **entries in `index_name` ascending order**; one entry per distinct requested name found; same degrade and error handling; statement (2) unchanged.
6. **D6 (ex-P6) — binding the names:** bind as array parameter (`${indexNames}` as `text[]`). If the adapter does not support array binding, `Prisma.join` is approved as the standard safe fallback.
7. **D7 (ex-P7) — proof of equality:** gated spec in `__tests__/lib/currency-index-pro/session-bars.pg.spec.ts` covering FX names, single name, absent names, stale rows, and empty request.
8. **D8 (ex-P8) — tests:** new helper unit test `__tests__/lib/currency-index-pro/session-bars.test.ts` plus updates to chart, screener, and detail route suites.

**Advisor determinations on open questions:**

- **Q1 (Pattern choice S2 vs S3):** Because `indexNames` is an explicit input filter, S2 is semantically exact and doesn't drop anything the caller asked for. If S2 and S3 are within 2x, **S2 is preferred for simplicity**, but the benchmark results will guide the final pick.
- **Q2 (Code location): Separate copy** in `lib/currency-index-pro/queries.ts`. Do not modify B1's committed code or tests.
- **Q3 (Array binding fallback): APPROVED.** If the driver adapter cannot bind `text[]`, `Prisma.join` is fully approved.
- **Q4 (Empty request): Early return `if (indexNames.length === 0) return new Map();`** is approved; it preserves identical behavior while saving an unnecessary database roundtrip.

## Invariants (must not change)

- The helper's exported signature and return value, per P5; the three routes, their auth order, headers and bodies.
- Statement (2), the corridor and preference reads, `lib/cache/*`, B1's helper and its tests. No schema, migration or index change;
  nothing touches production.
- At most one pool connection held by the lookup at a time; the lookup is one statement.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] `main` clean; `git log` shows `bfef7e74` or a descendant; `lib/currency-index-pro/queries.ts` and the three route tests unchanged
      since this draft. _(HEAD `bfef7e74`; only documentation uncommitted.)_
- [x] `npx tsc --noEmit` clean; `npm run test:ci` baseline recorded in Deviations (last: 563 suites passed, 5 skipped; 18,713 tests
      passed, 315 skipped). _(re-run fresh: exit 0 and exit 0, the same counts.)_
- [x] The B1 evidence folder is present (`gen.sql`, `cgi-ddl.sql`, `bench.cjs`); PostgreSQL 18.1 binaries present; port 55471 free; no
      scratch server left; Davin's own service on 5432 is not touched. _(all present; port 55471 has no listener.)_
- [x] `.claude/architecture/database-traps.md` read for the plan-shape and DDL-derivation notes (as in B1). _(read in the B1 session of today; unchanged.)_

## Ordered steps (each carries its verification)

1. **Say what runs, then start the scratch server** (one hidden `postgres.exe`, data in the scratchpad, never `pg_ctl start` in a tool
   call), create the table from `cgi-ddl.sql`, load V0, V1, V2 with `gen.sql`. _Verify:_ row counts and the three indexes.
2. **Measure S0 to S3** for the 8-name and 1-name filters (a copy of B1's `bench.cjs` with the filter, saved in a new folder
   `docs/handoffs/2026-10-xx-b2-explain/`), write `docs/handoffs/2026-10-xx-b2-explain.md` with the table, the version note and the
   limits. _Verify:_ each candidate equals the independent reference, per volume and filter.
3. **Apply the decision rule (P4).** Record the choice. If rule (d) fires, stop.
4. **Implement** in `lib/currency-index-pro/queries.ts` (P2, P5, P6) and update the doc comment of the function (it still describes "one
   `distinct` query"). _Verify:_ `npx tsc --noEmit`.
5. **Tests (P7, P8).** New unit file, route-suite updates, the gated spec. _Verify:_ the affected suites green; the gated spec green on the
   scratch server (report its count); the touched tests type-checked with the throwaway tsconfig.
6. **Mutation check** with the gated spec running: drop or flip the ordering, drop `LIMIT 1`, break the name walk or the filter, drop the
   `DISTINCT`, change the mapping. Restore byte-identical (sha-256).
7. **Full verification:** `npx tsc --noEmit`, `npm run lint`, `npm run test:ci` (counts equal baseline plus the new tests, 0 failed),
   `npm run build`; restore `next-env.d.ts` if the build rewrote it; `git diff --stat` shows only the files named here.
8. **Stop the scratch server** by PID, delete its data directory, confirm no process of ours is left.
9. **Close.** State entry per `session-lifecycle.md`; fill Deviations. Commit only if Davin asks, by explicit paths. No push or deploy.

## Done when

- The chosen statement, its evidence and its equality proof exist; every invariant holds (tests and diff).
- The hand-off shows the candidates at V0, V1, V2 for both filters, the decision, and what was NOT shown (production plans, latency).
- All commands in step 7 are green with counts reported; the scratch server is gone.
- **Not claimed:** any production speed-up. Scratch plans show work done, not production latency.

## Rollback

Revert the commit. No schema, data, flag or deploy state is involved.

## Out of scope

B1 (done), B3 (`indicator_statistics`, deferred), study items A and C (done), the shared PRO snapshot cache (second wave), any index or DDL,
statement (2) of the helper, `getLatestCorridor`, everything in `railway-gateway/` and `operation-service/`.

## Deviations

_(filled during execution, never deleted)_

1. **Extra deliverable files (small, in-bounds):** besides the hand-off document, `docs/handoffs/2026-10-20-b2-explain/` holds `bench-b2.cjs`,
   `results.json` and the 36 text plans (B1's `gen.sql` and `cgi-ddl.sql` are reused from its own folder, not copied).
2. **Scratch server again PostgreSQL 18.1** (production 17.11, Docker not installed); the same caveat as B1, stated in the report.
3. **More than the order asked for:** V0 was measured as well as V1 and V2 (a sanity volume), and a third filter was added to the two
   in the order, a deliberately hostile request (a repeated name, a name with no rows, an unlisted name that is in the table).
4. **Decision D4:** S2 won both ways: it had the lowest median buffers at V2 for every filter (35, 7 and 18 against S3's 69, 12 and 32) and it
   was within 2x of S3 each time (1.97x, 1.71x, 1.78x), so the Advisor's tie-break also chose it. Chosen: S2.
5. **The array binding worked first time:** the requested names go in as one `text[]` parameter and the driver adapter accepts it, so the
   approved `Prisma.join` fallback (Q3) was not needed. The early return for an empty request (Q4) is in and tested.
6. **The mutation check found a test gap, which is fixed.** The first gated spec had every bar of an index share one session open, and this
   helper's lookup returns only `index_name` and `session_open_bar_time`, so picking the OLDEST bar instead of the newest (M1), dropping the
   ordering (M2) or dropping `LIMIT 1` (M3) changed nothing the spec could see (B1 was not affected: its lookup also returns `bar_time` and
   `value`). Two tests with a session open that changes every day (and an index that rolls over at a different moment, and one that stopped
   before the end of the day) were added and the larger-table test now uses per-day sessions. Re-run: M1, M2 and M3 killed. The gated spec went from 12 to 14 tests.
7. **Two survivors are equivalent in behaviour, not gaps:** dropping the `DISTINCT` over the requested names (the `Map` de-duplicates by
   key, so nothing observable changes) and passing the caller's own array instead of a copy (nothing mutates it). The unit tests that pin the
   statement text and the copy kill both. Three mutants survive the unit suites by nature (a wrong comparison, a wrong column, a dropped
   filter: they need a real database) and are killed by the gated spec.
8. **Root `tsc` does not check `__tests__/`:** the touched tests were checked with the throwaway tsconfig from the gotchas; the only error is
   `@jest/globals` not resolving, which every existing test shares.
9. **Route tests:** besides moving the lookup value to `$queryRaw` and asserting it is not called on a 401, 400 or 403, each of the three
   suites got one wiring test (the names the route passes: the eight FX indices for chart and screener, the one requested index for detail).
   The new helper unit test has 9 tests. The function's doc comment was rewritten (it described "one `distinct` query").

**Evidence.**

- Benchmark (hand-off): at V2 (2,010,241 rows), eight FX names: shared buffers S0 287,918 · S1 287,918 · S2 **35** · S3 69; server time about 2.9 s,
  3.0 s, **0.29 ms**, 0.63 ms; one name: 35,526 · 35,529 · **7** · 12; the hostile mix: 36,401 · 36,401 · **18** · 32. All four equal the independent
  reference for all three filters at all three volumes. S1 saves only the transfer.
- Gated spec `__tests__/lib/currency-index-pro/session-bars.pg.spec.ts`: **14 of 14 on PostgreSQL 18.1** (skipped without `CYCLE_PG_URL` and
  `CYCLE_PG_ALLOW_WIPE=yes`); it compares the new function with the old Prisma `distinct` version, entry by entry and in order, and counts statements
  (none for an empty request, one when nothing is found, two otherwise).
- Mutation checks (12 mutants): units kill M1 to M5, M7, M9, M10, M11; the gated spec kills M1 to M3, M5 to M8, M10 to M12; every mutant is
  killed by at least one suite; file restored byte-identical (sha-256) after every run.
- Before: `tsc` exit 0; `test:ci` exit 0, 563 suites passed (5 skipped), 18,713 tests passed (315 skipped). After: `tsc` exit 0; `npm run lint` exit 0
  (0 errors, the same 5 existing warnings); `test:ci` exit 0, **564 suites passed (5 skipped), 18,725 tests passed (315 skipped), 0 failed** (+1 suite,
  +12 tests: 9 helper, 3 wiring); `npm run build` exit 0. The gated spec is not collected by `test:ci`.
- Scratch server stopped by PID, data directory deleted, no process of ours left; port 5432 (Davin's own service) never touched.
  `next-env.d.ts`, rewritten by the build, restored.

**Not done / not claimed:** nothing about production plans or latency; no index or DDL change; B3 untouched; not deployed. (Committed on Davin's word, and a push of the three local commits to `origin/main` ordered, after this section was written.)

## Next-session handoff (notes for the following order, not a plan)

- **B3** (`lib/indicator-statistics/queries.ts`) stays deferred: its `ORDER BY ... captured_at DESC` does not match the all-ascending unique
  index, so a loose scan over `(symbol, timeframe, source)` needs its own measurement and possibly an index (a DDL order for Davin, applied
  by him).
- If B1 and B2 end up with two near-identical SQL texts, a shared function is a refactor for its own small order, not part of this one.
