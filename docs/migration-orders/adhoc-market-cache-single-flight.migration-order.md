# Migration Order — Ad-hoc Session — Market cache single-flight (Unit 1, item C of the PostgreSQL/cache quick-win study)

> **Status: CONFIRMED** — drafted by the Executor, upgraded to DRAFT by the Advisor (Antigravity) on 2026-10-20,
> **APPROVED by Davin in chat on 2026-10-20**, **CONFIRMED by the Executor on 2026-10-20** (entry criteria below).
> Decisions taken are settled by the Advisor below; none touches money, auth semantics, secrets or CORS.
>
> **CONFIRM note (Executor, 2026-10-20):** this order file is untracked (no git history), the same pattern earlier ad-hoc
> orders hit; Davin's chat message "APPROVED … proceed to re-verify … mark the order as CONFIRMED, and execute Unit 1" is
> treated as his live approval of this named file. Re-verified fresh before any edit: `HEAD` = `origin/main` = `a76b6347`,
> tree clean apart from this file, the three routes and `cache-manager.ts` unchanged since the draft, no keyed in-flight helper
> in `lib/` or `app/` (the only `Map<string, Promise>` is the per-language dictionary load cache in
> `lib/i18n/client-dictionaries.ts:67`, a different thing), `npx tsc --noEmit` exit 0, and `npm run test:ci` exit 0:
> **562 suites passed, 5 skipped (567); 18,691 tests passed, 315 skipped (19,006).**

**Session:** Ad-hoc (outside playbook numbering) · **Phase:** unchanged · **Variant:** behaviour-preserving
refactor, closest to `TEMPLATE-PORT.md` (dial **Low**; confirmed by Advisor) · **Status:** EXECUTED, verified, not committed ·
**Generated:** 2026-10-20 (Executor drafted, Advisor upgraded) · **Basis:** `main` @ `a76b6347` (local checkout equals `origin/main`) ·
**Flags touched:** none · **Estimated time:** ~1.5 h (one helper, three routes, tests).

**Source:** `davintrade-database-scaling/database-scaling-study-2026-10-20/database-scaling-study/FINAL-RECOMMENDATIONS-2026-10-20.md`,
item **C**. Direction from Davin and the Advisor (2026-10-20): do Unit 1 (C) first; B1/B2 later; B3 deferred.

## Facts the Executor verified against live code (`a76b6347`)

- Three cache-aside paths, each `get cache → on miss run the loader → set cache`, with no in-flight sharing:
  - `app/api/market/currency-gold-indices/route.ts:42-76` (key constant, public route).
  - `app/api/market/currency-gold-indices/history/route.ts:41-78` (key per timeframe `M5|M15`, public route).
  - `app/api/market/currency-index-pro/comparison/route.ts:80-109` (`candlesFor`, key per `(index, timeframe)`;
    session + PRO check runs first at `:111-128`).
- TTL is `CACHE_TTL.SHORT` = 60 s (`lib/cache/cache-manager.ts:15`). **This order does not change it.**
- All three loaders (`getCurrencyGoldIndexSnapshots`, `getCurrencyGoldIndexHistory`, `getComparisonCandles`) catch their
  own database errors and return an empty result (`[]`, or an empty series per index for history). The routes then cache
  that empty result for 60 s. That is existing behaviour: **observed, not changed here.**
- Key spaces are bounded: 1 snapshot key, 2 history keys, 18 comparison keys (9 indices × 2 timeframes; the route
  validates both before the loader runs).
- Existing local single-flight idiom to match in style: `lib/world-gold/fx.ts:342-348`, `lib/fx/usd-rates.ts:110-114`
  (one module-level `inflight` promise, cleared in `finally`). No keyed helper exists yet.
- Study item **A** (narrow `select` on the channel reads) is **already on `main`** (`b0191c18`, `e4d23dd7`). Not part of this order.
- Baseline reported by Davin/Antigravity (not re-measured by the Executor): `currency_gold_indices`, `indicator_statistics`
  and `market_data_v6` have **0 rows** in production. **So nothing in this order is measurable in production yet.**

## Decisions taken

> Settled by the Advisor (Antigravity). None touches money, auth semantics, secrets or CORS; no item needs explicit sign-off.

1. **D1 (ex-P1) — one new helper `lib/cache/single-flight.ts`:** `singleFlight<T>(key, load): Promise<T>`, a module-level
   `Map<string, Promise<unknown>>`, entry removed in `finally` only if it is still the same promise. _Rejected:_ a Redis
   lock (cross-process, a second step in the study), a longer TTL, a shared PRO snapshot (second wave). _Undo:_ low (revert).
2. **D2 (ex-P2) — wrap the whole get → load → set** per key, hit path included. _Rejected:_ wrapping only the miss path with a
   cache re-check (more code, same effect here). _Undo:_ low.
3. **D3 (ex-P3) — comparison route:** the flight goes inside `candlesFor`, below the auth and tier checks, keyed
   `(index, timeframe)`. Nothing user-specific enters a key or a shared value. _Undo:_ low.
4. **D4 (ex-P4) — results are shared by reference;** callers must treat them as read-only. All three routes only serialise them
   (`NextResponse.json`), so no copy is made. _Undo:_ low.
5. **D5 (ex-P5) — failure:** a rejection reaches every caller that joined that flight, the entry is removed, nothing is cached
   negatively, and the next request starts a fresh flight. _Undo:_ low.

**Advisor determinations on open questions:**

- **Q1 (Fill counter): NO.** Do not add logging or counter state to `singleFlight`. Keep it pure, minimal, and zero-dependency.
- **Q2 (Location): GENERIC in `lib/cache/single-flight.ts`.** Keep it in `lib/cache/` so PRO routes and future market cache routes can share the same utility.

## Invariants (must not change)

- Response bodies and every response header, including both `Cache-Control` values.
- Cache keys, TTLs and `lib/cache/cache-manager.ts` (not edited).
- Order of checks on the comparison route: 401 → 403 → 400 → data. An anonymous or FREE caller never reaches a flight.
- Per-index failure isolation on the comparison and history routes.
- No `AbortSignal` or request object passes into a shared loader: one browser cancelling must not cancel work another
  caller needs.
- Redis outage behaviour (bounded waits, fall-through to Postgres). `lib/redis/client.ts` is not touched.

## Entry criteria (verified at CONFIRM, not assumed)

- [x] Working tree clean on `main` (or the order's branch); `git log -1` is `a76b6347` or a descendant, and the three routes
      and `lib/cache/cache-manager.ts` are unchanged since this draft (re-grep the anchors above). _(HEAD `a76b6347` = `origin/main`; only this order file untracked.)_
- [x] `npx tsc --noEmit` clean; `npm run test:ci` baseline suite and test counts recorded in Deviations before any edit. _(exit 0 / exit 0; counts in the CONFIRM note and Deviations.)_
- [x] No keyed in-flight helper has appeared meanwhile (`grep -rn "singleFlight\|Map<string, Promise" lib app`). _(none; see CONFIRM note.)_
- [x] Read `.claude/architecture/database-traps.md` (no schema or query change expected; confirm none is needed). _(No schema, query or migration is touched; none needed.)_

## Ordered steps (each carries its verification)

1. **Helper.** Add `lib/cache/single-flight.ts`; add `__tests__/lib/cache/single-flight.test.ts` (new directory).
   Tests: N concurrent same-key calls run the loader once and all get the same value; different keys run independently;
   a rejection reaches all joiners and the key is free again; a retry after failure runs the loader again; a loader that
   throws synchronously becomes a rejection, not an uncaught throw; the map is empty after settle; a later call after a
   success starts a new flight. _Verify:_ `npx jest __tests__/lib/cache/single-flight.test.ts`.
2. **Snapshot route.** Wrap the get/load/set in `singleFlight('market:currency-gold:snapshot', …)`; build the response
   outside the flight. Extend `__tests__/api/currency-gold-indices.test.ts`: concurrent GETs with a deferred `findMany`
   → one latest query and one sparkline query in total; existing tests unchanged and green.
3. **History route.** Same, keyed by timeframe (`…:history:M5|M15`). Extend `…/currency-gold-indices-history.test.ts`:
   same timeframe concurrent → one pair of index reads; M5 and M15 concurrent → independent.
4. **Comparison route.** Wrap `candlesFor`'s body keyed `(index, timeframe)`. Extend
   `__tests__/api/currency-index-pro-comparison.test.ts`: two concurrent PRO requests for the same two indices → one read
   per index; 401/403 requests start no flight; one index failing still serves the other.
5. **Full verification.** `npx tsc --noEmit`, `npm run lint`, the four test files, then `npm run test:ci` (counts equal
   baseline plus the new tests, 0 failed) and `npm run build`. `git diff --stat` shows only the files named here.
6. **Close.** `.claude/state/current-state.md` entry per `session-lifecycle.md`; fill Deviations. **Commit only if Davin
   asks,** by explicit paths, suggested message: `perf(market): share one in-flight fill per cache key on the three market cache routes`.
   No push or deploy by the Executor.

## Done when

- The helper and its tests exist; the three routes use it; all invariants above hold (shown by the tests and the diff).
- `tsc`, lint, targeted tests, `test:ci` and `build` are green; counts reported.
- **Not claimed:** any measured speed-up. With empty tables there is nothing to measure; the effect on origin database calls
  can only be read after ingestion starts, and only where concurrent misses land on the same instance (the monolith runs on
  Vercel; instance sharing is unverified).

## Rollback

Revert the commit. No schema, data, flag or deploy state is involved; the in-flight map holds no persistent state.

## Out of scope

Study items A (done), B1 / B2 / B3, the ended Redis singleton, a shared PRO snapshot TTL, and everything in `railway-gateway/`.
`operation-service`'s channel slice is change-frozen (CC-F) and untouched.

## Deviations

_(filled during execution, never deleted)_

1. **Extra test-support file (small, in-bounds):** `__tests__/helpers/async-helpers.ts` (`deferred()`, `flushPromises()`), not in
   the order's file list. Four test files hold a pending promise open on purpose; one shared helper replaces four copies.
2. **"The map is empty after settle" is checked by behaviour, not by a test-only accessor.** The helper exports nothing but
   `singleFlight` (Advisor's Q1: pure and minimal). The tests show the key is free after a success, after a failure and after a
   synchronous throw (the next call runs its own loader). Same guarantee, no extra API.
3. **Route bodies moved into named functions** (`loadSnapshots`, `loadHistory`, and `fillCandles` under a thin `candlesFor`), so
   the flight wraps one function. The order said "wrap `candlesFor`'s body"; `candlesFor` keeps its signature and its one call site.
   Behaviour is identical: the same checks in the same order, the same warn messages, a cache hit returns the cached value.
4. **One guard in the helper is defensive, not testable.** `if (inFlight.get(key) === request)` cannot differ from an unguarded
   delete: while an entry exists no other run can replace it. Mutation check M4 (guard removed) survives for that reason and is
   equivalent. One test name that claimed otherwise was renamed to what it shows. The guard stays (it is the one `lib/world-gold/fx.ts` uses).
5. **Prettier on the touched files converted their working-copy line endings CRLF → LF.** The index is LF either way, so
   `git diff` is unaffected (6 modified files, +315 −19); no other file was reformatted.
6. **Baseline vs the 2026-10-19 entry:** this machine skips 5 suites and 315 tests (the 10-19 entry, run in a cloud container,
   skipped 1 and 27); the total of 19,006 tests is the same. Not investigated; likely gated specs that need an environment variable.

**Evidence.** Mutation checks, helper: sharing removed → 4 tests fail; key never freed → 6 fail; synchronous throw not converted
→ 1 fails; guard removed → 0 fail (equivalent, item 4). Routes (6 mutants: snapshot direct call; history key without timeframe /
never shared; comparison key without timeframe / without index / never shared): all 6 killed (1 to 3 failures each); every file
restored byte-identical (sha-256).
Before: `tsc` exit 0; `test:ci` exit 0, 562 of 567 suites passed (5 skipped), 18,691 of 19,006 tests passed (315 skipped).
After: `tsc` exit 0; `npm run lint` exit 0 (0 errors, 5 existing warnings in four other files); `test:ci` exit 0, **563 of 568 suites
passed (5 skipped), 18,711 of 19,026 tests passed (315 skipped), 0 failed** (+1 suite, +20 tests: 8 helper, 3 snapshot, 3 history, 6
comparison); `npm run build` exit 0 ("Compiled successfully"; the known "Dynamic server usage" log lines for pages that read the session).
**Not done / not claimed:** no measured speed-up (the tables hold 0 rows); nothing run against Redis, a real database or a browser;
not committed, pushed or deployed (Davin has not asked).

## Next-session handoff (PRE-DRAFT notes for the following order, not a plan)

- **B1** (`lib/currency-gold-indices/queries.ts`) then **B2** (`lib/currency-index-pro/queries.ts`); **B3 deferred.**
- Davin's constraint: **one SQL statement per helper call** (the market pool is `max: 5`, `lib/db/market-prisma.ts:42`);
  `$queryRaw` is acceptable (precedent: `lib/world-gold/store.ts`).
- Executor's note for the Advisor: `DISTINCT ON (index_name)` shrinks the transfer but PostgreSQL may still read every row;
  a single `LATERAL … ORDER BY bar_time DESC LIMIT 1` per known index name can use the `(index_name, bar_time DESC)` index.
  Compare the two with `EXPLAIN` on a scratch PostgreSQL loaded with realistic volume before choosing.
- Tests that pin the old shape and must be rewritten with it: `__tests__/api/currency-gold-indices.test.ts:69-80`,
  `__tests__/api/currency-index-pro-screener.test.ts:120`. An equality proof against a real PostgreSQL needs a gated spec in the
  style of `__tests__/reply/day-bars.pg.spec.ts`.
- B2's three routes (chart, screener, detail) are polled every 30 s per open PRO cockpit with no server cache, so by call
  frequency B2 may matter more than B1 once data flows.
