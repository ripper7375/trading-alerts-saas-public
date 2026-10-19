# Read-only PostgreSQL hot-path audit

Scope: existing dirty checkout at `D:/SaaS Project/trading-alerts-saas-public`, as assigned. No repository edits, live database access, network, installs, generation, `.env` reads or configuration imports. Read root AGENTS, binding non-negotiables and database-traps. The code observations below concern reachable current entrypoints; deployed flags/traffic/row counts were not checked.

## 1. Select only the channel columns; restrict unused upsert returns (very low risk)

- `app/api/market-data/channel/route.ts:213-223` reads entire market rows for up to 1,000 bars then consumes only timestamp plus the 3 columns already resolved through `channelColumns(variant)` at line 211.
- The feature-flag branch at lines 140-156 forwards to `operation-service/src/market-data/market-data.service.ts:87-97`, which repeats whole-row selection. Fix both branches, using the _resolved_ active source for the monolith, not the raw requested variant. The service checks variant membership before query.
- Reachability: `components/charts/mtf/useMtfOverlay.ts:134-147` calls the Next route, including repeated cycle checks via lines 139-142. `operation-service/src/market-data/market-data.controller.ts:33-46` delegates after auth; `operation-service/src/app.module.ts:57` registers the module. The corresponding migration flag is read at `lib/operation-service/flags.ts:91-92`. Runtime value unknown.
- `railway-gateway/src/worker/market-data.processor.ts:70-74` awaits an upsert but discards its result. Add `select: { id: true }`; keep the full existing create/update payload and unique key.
- Offline compiler probe against _both_ installed generated market and gateway clients, Prisma 7.9.1, confirms: bare channel query selects 106 SQL columns; explicit 4 logical fields produces 5 SQL columns (Prisma adds `id`). Whole upsert returns 106 columns, `select: {id: true}` returns just 1. The generated operation-service model has 26 scalar fields, so its branch also benefits, by less than the monolith.
- Benefits are fewer DB-to-app values, deserialization and heap work. The approximately 95% (106 to 5) / 99% (106 to 1) column-count reductions are **not measured latency, byte or PostgreSQL CPU reductions**. SELECT still reads the same matching rows and upsert still writes the same data.
- Checks before implementation completion: response equality for every variant, null values, ordering and limit; active-indicator switch; auth/tier rejection still before data access; SQL capture shows narrow projection; gateway duplicate/cycle tests still pass, `cycle_id` and `collected_at` continue updating. Rollback is reverting the `select` additions, no migration.

## 2. Latest-per-group `distinct` currently ships full history to application (high value, local query change)

- `lib/currency-gold-indices/queries.ts:65-75`: newest per index, five selected fields. Called by public cached route `app/api/market/currency-gold-indices/route.ts:62` on a cache miss.
- `lib/currency-index-pro/queries.ts:69-74`: newest session-open per requested index. Called by PRO screener/chart/detail at `app/api/market/currency-index-pro/screener/route.ts:96`, `chart/route.ts:65`, `detail/route.ts:89`.
- `lib/indicator-statistics/queries.ts:55-72`: newest per symbol/timeframe/source, called by `app/api/market/indicator-statistics/route.ts:53`.
- Exact outgoing SQL captured with a fake adapter contains **neither DISTINCT nor LIMIT**, just SELECT + ORDER BY + OFFSET 0. Thus ordinary Prisma ordered distinct is applied after the matching historical rows cross the driver boundary. PRO only restricts index names; it does not bound history. This is proven for this installed client, not inferred from memory.
- Source market schema and installed generated schema lack `nativeDistinct`; generated index config has `previewFeatures: []`. Do not propose a blind global preview switch or assume it supports these orderBy shapes.
- Local low-surface remedy: parameterized tagged `$queryRaw` with PostgreSQL `DISTINCT ON (index_name)` and the _same_ `ORDER BY index_name ASC, bar_time DESC`, and analogous `(symbol,timeframe,source)` + captured_at DESC for statistics. Preserve the selected types, filters, source order, empty/error behavior. Preserve all existing grouping keys: an arbitrary `take` can silently remove a group with an old newest row.
- A small result set will now cross the boundary: e.g. one row per actual index instead of N historical rows. PostgreSQL may still scan/sort historical entries; this alone does **not** promise an index seek or O(groups) execution. Existing unique keys provide correctness/tie resolution; query-plan/index work is separate.
- Tests: compare old/new output on multiple groups, duplicate observations, missing/stale groups and differing session opens; PRO index subset and unknown/missing data; capture generated SQL; use scratch EXPLAIN only if implementation is subsequently authorized. No live DB was accessed. Rollback a helper at a time.
- Economic-calendar readers also use distinct but have rescheduling correctness subtleties documented in database-traps. Do not bundle them with this quick win.

## 3. Second wave: memoize successful immutable point-in-time snapshot keys

- `railway-gateway/src/worker/market-data.processor.ts:76` calls PIT insertion after every live upsert. `:95-99` explicitly states every in-window bar is re-queued every cycle and the immutable duplicate insert runs thousands of times per bar; `:111-129` rebuilds then `createMany(skipDuplicates:true)` every time. `point-in-time-snapshot.ts:8-10` describes the roughly 3,000-bar overlapping window.
- A bounded process-local positive cache keyed `(symbol,timeframe,timestamp)` can remember _only successful_ PIT inserts (or duplicate count=0, which confirms existence), and skip duplicate PIT attempts. LRU/size eviction and restart simply cause another safe DB check. Never cache a failed insert; never mark a forming bar (buildSnapshot returns null); always execute live upsert and cycle provenance refresh unchanged. No production PIT deletion path found in source, but if one is introduced, retention/invalidation must account for the memo.
- Conditional potential: a warmed overlapping window changes two row-level Prisma calls to one for duplicate closed bars, close to half the row-path calls. Not measured traffic/time; cold start still does both. Unlike omitting live rewrites, the immutable write-once contract makes a positive memo possible.
- Classify below first-wave read projection/query fixes because it changes ingestion optimization state and telemetry must retain first-seen truth. Required tests: first close is frozen; changed later payload updates LIVE but not PIT; failed first PIT insert retries; forming-to-closed transition still writes; cap/eviction/restart allow safe retries; missing table remains logged/best effort. Feature-gated rollout/rollback by disabling the memo.

## 4. Secondary watch-cache reload query reduction

- `operation-service/src/alert-engine/alert-worker.service.ts:81` launches an unawaited reload on each `alerts:changed`; `:91-94` fetches all active drawing-alert rows plus full drawing and full alert relations.
- `operation-service/src/alert-engine/watches.ts:21-72` only consumes drawing-alert configuration and drawing geometry/user/symbol/timeframe fields; it never consumes the included `alert` object. Remove `alert: true` first while retaining the relation predicate `where: { alert: { isActive: true } }`; optionally select only fields in `DrawingAlertRow`. This is a small low-risk query payload reduction, especially if Prisma emits a separate relation query (not probed here).
- Burst coalescing is possible but needs a dirty flag/serial trailing reload: pure singleflight that discards invalidations during an in-flight read can leave stale watches. Treat this as later work, never use an arbitrary long TTL for active watch correctness.
- Registered via main-worker.ts:40-44, where worker.start is called, with publisher paths `operation-service/src/drawings/drawings.service.ts` and `src/alerts/line-alerts.service.ts`. Production worker count and update volume unknown, so gains may be small today.

## Evidence scripts

`query-sql-probe.cjs` requires only the installed generated Prisma client from an explicit repo-relative path. Its fake SqlDriverAdapter has no pg library or socket path: queryRaw records SQL then returns an empty result. It never imports source DB singletons, Prisma config or dotenv. It writes reports only next to itself in the approved workspace.

- Default root client: `node <workspace>/work/db-audit/query-sql-probe.cjs` (initial run exit 0; report from initial version was `query-sql-probe.json`, current script writes `query-sql-probe-market.json`).
- Gateway client: `node <workspace>/work/db-audit/query-sql-probe.cjs railway-gateway/node_modules/.prisma/client gateway` (exit 0, `query-sql-probe-gateway.json`).
- This proves SQL generation/projection/transfer shape, not live indexes, row counts, query timings, DB load, cache hit rate or deployed feature flags. No repo tests run because there are no implementation changes and mutation/generation was out of scope.

## Avoid for quick wins

- Do not increase `market-data-sync` concurrency: deliberate single wildcard handler `market-data.processor.ts:34-50` orders manifest verification behind its row jobs. Two named loops or parallel rows violate that barrier.
- Do not skip unchanged live bars: database-traps explains why `cycle_id` must reflect the latest collector promote and why fitted channels are rewritten.
- Do not batch live upserts, change schemas, add replicas/shards, remove writes, alter money/auth/dedupe, or change consistency contracts in the first patch.
- Notifications have sequential count/list/count (operation service :78-90; monolith route :103-128). Promise.all changes latency only, not DB work, and increases simultaneous pressure; the unread-total duplicate can be reused only when filters exactly coincide. Lower value than the findings above.
