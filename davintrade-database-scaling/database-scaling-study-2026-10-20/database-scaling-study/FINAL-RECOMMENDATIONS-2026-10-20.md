# PostgreSQL and cache: final quick-win assessment

Reviewed: 2026-10-20, Asia/Bangkok. Assessment completed; implementation not started.

The best first batch is **narrow channel projections, database-side latest-row selection, and coalescing existing cache fills**. These are local changes that need no additional infrastructure, schema migration or longer cache lifetime. Priority reflects risk and implementation scope; production benefit still needs measurement.

This assessment supersedes the provisional rankings in the 2026-10-19 README and specialist notes. In particular, shared PRO snapshots with a new TTL are a second-wave option. The earlier TTL examples are not approved freshness budgets.

## Revalidated source and verification

- Source repository: `D:\SaaS Project\trading-alerts-saas-public`, branch `main`, HEAD `c6dccff16d11434ebcf63ff37d9c654fc7766fec`.
- All **23 reviewed source files** match the saved SHA-256 values. The repository remains a dirty checkout with unrelated work; none was modified.
- Reran the installed root-market and gateway Prisma 7.9.1 compiler probes: both exit **0**.
- Independently asserted **10 groups of SQL observations** across the two clients, plus all 23 source-hash matches: exit **0**. SELECT filter/order/limit suffixes and upsert SQL before RETURNING match between the compared probes.
- A separate read-only reviewer supported the top-three ranking and checked semantic and performance-claim limits. Corrections are incorporated here.
- No application changes, live database/Redis access, environment-file reads, migrations, installs, builds, client generation, commits, pushes or deployments.

The probes use a fake driver: statements are compiled, not executed. They establish SQL shape, not result equivalence, actual row counts, query plans, runtime timings or deployed-client parity. See [verification evidence](verification-summary-2026-10-20.json) and [source revalidation](source-revalidation-2026-10-20.json).

## Architecture relevant to the decision

The Next.js application has market and non-market Prisma clients; repository documentation identifies one shared physical PostgreSQL database. Separate generated clients do not mean separate database capacity. Each Next client already has a pool of at most five connections with a five-second acquisition/connect deadline. NestJS operation, money and ingestion services have their own pools. Redis is already used for market caches and service coordination, alongside browser/CDN caches.

Singleton clients, public market caching, visible-tab polling guards, batched index reads and several request/render caches already exist. Adding those features again is not a new win. Runtime pooler endpoints, replica routing, cache hit rates, resource saturation and production workload volumes remain unverified.

## First batch

| Order | Change                           | Scope                                    | Expected work reduction                                                | Risk                                         |
| ----- | -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| A     | Select only channel fields       | Two existing read branches               | Root SQL projection 106 -> 5 columns; less DB-to-app decoding/transfer | Lowest                                       |
| B     | Select latest rows in PostgreSQL | Three independent helpers, one at a time | Transfer one row per group instead of matching history                 | Low to moderate; result parity required      |
| C     | Coalesce existing cache fills    | Three market cache-aside paths           | K overlapping misses -> one fill per key per warm process              | Low when sharing remains local and transient |

### A. Narrow the channel query first

Current source:

- `app/api/market-data/channel/route.ts:213`: whole-row read; lines 219-223 use timestamp and three resolved channel columns.
- `operation-service/src/market-data/market-data.service.ts:87`: equivalent whole-row read; lines 93-97 consume the same four logical values.
- Next forwarding branch: channel route lines 140-156. Active UI caller: `components/charts/mtf/useMtfOverlay.ts:135`.

Add an explicit `select` to each branch, using the already validated/resolved source. The monolith's `channelColumns()` also handles the special `fractal_edt` mapping; do not replace it with unchecked string interpolation. Preserve each branch's current allowed variants and gates.

The offline root-client query changes from 106 SQL columns to five because Prisma includes the ID alongside the four requested fields. For 300 rows, that is 31,800 versus 1,500 selected column values. It is about 95% fewer column values, not a measured byte or latency reduction. The operation-service generated model has only 26 scalar fields, so do not apply the root percentage to that branch; its outgoing SQL was not independently probed in this study.

**Acceptance:** identical public JSON for supported variants, resolved active-source switches, null values, limit/order and failures; unauthorized callers still cannot reach the data. Verify generated SQL is narrow in the installed clients for both branches. No migration is needed; rollback is reverting the projection additions. This does not reduce the number of matching database rows or change write amplification.

### B. Move latest-per-group work to PostgreSQL

Current helpers:

1. `lib/currency-gold-indices/queries.ts:65`: newest currency/gold bar per index.
2. `lib/currency-index-pro/queries.ts:69`: newest session boundary per requested index.
3. `lib/indicator-statistics/queries.ts:55`: newest observation per symbol/timeframe/source.

The installed compiler emits SELECT + ORDER BY + OFFSET, with no SQL DISTINCT or LIMIT. Matching historical rows cross the driver boundary before Prisma deduplicates them. This work grows with retained history even when the final answer stays small.

Start with the currency snapshot helper, using a local parameterized PostgreSQL `DISTINCT ON` query with equivalent ordering. Then verify and change each remaining helper separately. A global preview-feature switch or arbitrary `take` is not the proposed fix.

For example, the currency query keeps `ORDER BY index_name ASC, bar_time DESC`. Preserve the PRO index filter and each index's own session boundary. Statistics must keep the newest observation even when its containment value is null; falling back to an older non-null observation would change behavior.

**Acceptance:** old/new result parity across multiple groups, unequal session opens, missing/stale groups, null values and error cases. Keep selected data types and ordering. Measure rows/bytes returned and inspect an approved non-production plan when implementing. One returned row per group does not imply PostgreSQL avoids scanning or sorting all history. No schema change is inherently required; rollback can revert one helper at a time. Economic-calendar rescheduling logic is outside this batch.

### C. Coalesce concurrent fills without increasing TTL

Current cache-aside callers:

- `app/api/market/currency-gold-indices/route.ts:44-67`
- `app/api/market/currency-gold-indices/history/route.ts:46-69`
- `app/api/market/currency-index-pro/comparison/route.ts:80-108`

They already have Redis caches. Overlapping misses for the same key can each run the same loader before any request populates the cache. A small per-key in-flight Promise map can share the complete get/load/set operation within one process.

The effect is conditional: ten overlapping misses on one key in one process can share one fill. Ten separate serverless processes can still each fill; this is not distributed locking. Public CDN/browser caching may already absorb much of the traffic, so measure origin overlap before claiming a large steady-state improvement.

**Acceptance:** one loader for simultaneous same-key requests, independent different keys, rejected/settled promises always removed in `finally`, successful retry after failure, unchanged empty/error responses and per-index failure isolation. Preserve existing TTLs, auth order and cache keys. One browser cancellation must not cancel work required by another caller. Redis-outage behavior still has to remain bounded; coalescing does not itself fix the ended Redis singleton.

## Second wave and why it is deferred

| Candidate                                    | Opportunity                                                                                                  | Reason to separate it                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared PRO raw market snapshot               | Chart and screener origin requests each repeat two session-bar reads plus one corridor read when data exists | A new server TTL can add to browser cache age; choose the total freshness budget first. Keep user preferences/auth out of shared data and serialize Map entries explicitly |
| ID-only gateway upsert return                | Compiled RETURNING shrinks from 106 columns to one; result currently discarded                               | Tiny code change but protected ingestion scope. Preserve every live update, cycle provenance, snapshots and row/manifest ordering                                          |
| Redis background recovery                    | Next singleton stops reconnecting after ten retries and is retained in ended state                           | Shared rate-limit/idempotency consumers need lifecycle regression checks; retain per-command deadlines                                                                     |
| Nest pool acquisition deadlines              | Three adapters inherit no finite acquisition/connect timeout                                                 | Improves failure containment, not guaranteed normal throughput. Preserve current maxima initially and validate request/job retry behavior; money is sensitive scope        |
| Duplicate-index consolidation                | Source has nonunique indexes alongside matching UNIQUE indexes                                               | Needs physical catalog, dependencies, plans and usage evidence; preserve UNIQUE constraints; requires separate DDL handling                                                |
| PIT insert memo or alert reload coordination | Repeated immutable snapshot inserts and overlapping watch reloads                                            | Ingestion/alert correctness requires stronger tests; a watch reload needs a dirty trailing rerun, not dropped invalidations                                                |

The six-market-query count for chart+screener is a **populated-data origin-request call-graph count**, not measured browser traffic: private HTTP caching may avoid origin requests. Shared snapshot TTL remains undecided. In-flight sharing alone retains no additional cache lifetime.

Higher ingest concurrency, skipping live rewrites, batching row/manifest work, replicas and sharding are not first-batch recommendations. The gateway's single worker and refreshed `cycle_id` support existing ordering and readiness semantics.

## Measurement and rollout checklist

| Change | Measure                                                                             | Must remain equal                                                 | Rollback                  |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| A      | Selected columns, DB-to-app payload bytes, handler p95/p99                          | Channel JSON, source resolution, order/limit and gating           | Revert select additions   |
| B      | Driver-returned rows/bytes, query time, application heap; plan scan/sort separately | Full grouped result, newest/null semantics and session boundaries | Revert one helper         |
| C      | Concurrent loaders per key, origin DB calls, failure recovery                       | TTL, response and auth behavior                                   | Remove coalescing wrapper |

Apply one isolated change at a time with appropriate targeted regression checks. Baseline and compare representative workloads; no numeric production speedup is claimed by this assessment. Keep commits/deployments separate from implementation authorization.

## Handoff

Needs from Davin for this completed assessment: none.

Delivered: ranked recommendations, source evidence, verification limits, acceptance criteria and rollback paths. This report and evidence are outside the source repository because the chat's writable scope is the Codex workspace. No shared repository state was rewritten.

Next unit if implementation is requested: **A, channel projection in both branches**, followed by its targeted parity and SQL checks. Revalidate source before editing and follow current repository ownership/freeze rules. Remaining ideas are not bundled into that first patch.

## Relationship to the two sources

These are applications of the articles' principles to the inspected code: reduce per-query work before adding capacity, reduce demand reaching the storage layer, and contain overlapping cache misses. Their published scale figures do not predict DavinTrade's gains.

- [OpenAI: Scaling PostgreSQL](https://openai.com/th-TH/index/scaling-postgresql/)
- Supplied PDF: _Scaling Memcache at Facebook_ (NSDI 2013), retained at the original user-provided path documented in the checkpoint.
- [Prisma v7 connection pools](https://docs.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [PostgreSQL SELECT / DISTINCT ON](https://www.postgresql.org/docs/current/sql-select.html)
