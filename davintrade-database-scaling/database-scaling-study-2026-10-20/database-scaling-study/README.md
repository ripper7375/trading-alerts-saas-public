# PostgreSQL and cache quick-win study checkpoint

**Assessment completed on 2026-10-20:** see [final recommendations](FINAL-RECOMMENDATIONS-2026-10-20.md). That report supersedes the provisional rankings and TTL examples below and in the specialist notes. All 23 saved source hashes still match; no application changes were made.

Saved: 2026-10-19, Asia/Bangkok.

Status: research saved at the user's request before credits run out. No application changes have been implemented. No production or staging database was contacted. This package preserves findings and evidence for resumption; it is not a deployment approval or a measured performance benchmark.

## Scope and source snapshot

- Repository: `D:\SaaS Project\trading-alerts-saas-public`
- Branch inspected: `main`
- HEAD recorded at entry: `c6dccff16d11434ebcf63ff37d9c654fc7766fec`
- The checkout contained extensive unrelated edits, untracked files and deletions. All were preserved. The reviewed-file hashes are saved in `source-hashes.json`; HEAD alone does not identify uncommitted source.
- Request: inspect PostgreSQL and caches in front of the database/services, applying the two papers' principles to small, high-impact, low-risk improvements.
- Work performed: instruction and architecture review; parallel read-only database/pool, cache and hot-query analysis; offline inspection of SQL compiled by the installed Prisma 7.9.1 clients.
- No source edits, dependency installations, client generation, migrations, deployment, commit or push. No `.env` or credential contents were read.

## Current architecture observed

The Next.js application uses separate market and non-market Prisma clients. Repository architecture states that their schema files share one physical PostgreSQL database and migration history. The Next.js clients each have an independent pool, capped at five connections, with a five-second acquisition/connect deadline and a 30-second idle timeout. A process using both clients can therefore open up to ten client connections; this is a ceiling, not a count of active connections.

The operation, money and ingestion gateway services have their own NestJS Prisma clients. Their adapters currently omit explicit pool limits/timeouts, leaving installed `pg-pool` defaults: maximum ten, idle timeout ten seconds, and no finite acquisition/connect timeout. Their singleton modules and shutdown draining already exist.

Existing cache protections include a Next.js Redis singleton, 60-second Redis caches and public CDN headers for public currency/gold snapshots and history, Redis comparison caching, browser SWR, hidden-tab/non-overlapping polling, React render deduplication and admin analytics caches. Redis is also used for queues and coordination. A shared environment-variable name does not establish that different deployed services use the same Redis instance.

Repository comments/history describe PgBouncer as already configured. Its actual deployed endpoints, service replica counts, PostgreSQL capacity, read-replica routing and current production performance were not verified. Adding infrastructure is not the first recommendation from this source review.

## Recommended implementation order

This order is a provisional assessment, not a claim of measured speedups. Each change should be isolated and reversible.

| Priority | Small change                                                      | Verified opportunity                                                                                           | Risk and practical limit                                                                                                        |
| -------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Select only the channel's needed fields                           | Current root query projects 106 SQL columns; explicit selection projects five, including an ID added by Prisma | Very low: preserve timestamps, variant resolution, nulls, order, limit and access checks; apply to both routing branches        |
| 2        | Move latest-per-group selection into PostgreSQL                   | Three ordered Prisma `distinct` queries compile without SQL DISTINCT or LIMIT                                  | Low to moderate: compare old/new results and preserve exact grouping, filters, order and missing-data behavior                  |
| 3        | Coalesce concurrent fills of existing market caches               | Overlapping misses independently call PostgreSQL                                                               | Low when scoped per key to the existing cache loader; process-local coalescing does not cover the whole fleet                   |
| 4        | Share short-lived raw market reads between PRO chart and screener | Both poll every 30 seconds and repeat the same three market database calls                                     | Adds a freshness bound; cache raw shared data only, after authorization, with explicit serialization                            |
| 5        | Return only an ID from the gateway upsert                         | Its unused RETURNING payload is 106 columns; projected SQL returns one                                         | Small code change, but ingestion is protected: preserve every write and row/manifest ordering; regression verification required |
| 6        | Keep Redis reconnecting after a prolonged outage                  | Current Next.js retry strategy eventually stops and the ended singleton is retained                            | Cross-cutting lifecycle change; retain per-command deadlines and review rate-limit/idempotency consumers                        |
| 7        | Add finite NestJS pool acquisition/connect deadlines              | All three services currently inherit no finite deadline                                                        | Primarily overload resilience; preserve current max initially and validate failure/retry behavior, especially in money paths    |

### 1. Narrow channel projection

Evidence:

- `app/api/market-data/channel/route.ts:213` retrieves whole rows; lines 219-223 use only timestamp and the resolved indicator's three channel values.
- `operation-service/src/market-data/market-data.service.ts:87` repeats the same full-row pattern; lines 93-97 use the four values.
- `components/charts/mtf/useMtfOverlay.ts:135` constructs the active UI request.
- The Next route conditionally forwards to operation-service at lines 140-156. Fixing only the monolith could miss the active deployed branch.

The offline probe confirmed 106 -> 5 projected SQL columns for the root and gateway generated clients. This is approximately 95% fewer selected column values, NOT a measured 95% byte, disk-I/O or latency reduction. The external channel response already contains only points, so the main gain is on database-to-application transfer and decoding. Use the validated/resolved channel column mapping; do not change which indicator is returned.

### 2. Avoid transferring history merely to find the latest rows

Evidence:

- `lib/currency-gold-indices/queries.ts:65`
- `lib/currency-index-pro/queries.ts:69`
- `lib/indicator-statistics/queries.ts:55`

The installed Prisma compiler emits an ordered SELECT with neither DISTINCT nor LIMIT for these calls. Deduplication occurs after all matching history is returned to the application. The current market generator has no `nativeDistinct` preview feature.

Prefer small, local, parameterized PostgreSQL `DISTINCT ON` replacements over changing a global preview feature. For example, the currency query should preserve `ORDER BY index_name ASC, bar_time DESC`, with one latest row per index. The PRO helper must preserve its requested index filter and each index's own session boundary. Indicator statistics must preserve `(symbol, timeframe, source)` grouping and newest `captured_at` semantics, including null containment values.

This can reduce transferred rows from all matching historical observations to the number of groups. PostgreSQL may still scan or sort historical entries; do not promise an index skip scan or a universal latency factor. Validate result equivalence on representative fixtures, then inspect a read-only query plan on an approved test database. No schema change is inherently required for this first step.

### 3. Coalesce existing cache misses

Evidence:

- `app/api/market/currency-gold-indices/route.ts:44-67`
- `app/api/market/currency-gold-indices/history/route.ts:46-69`
- `app/api/market/currency-index-pro/comparison/route.ts:80-108`

Add an in-flight Promise per canonical cache key around miss resolution and cache population; always clear it in `finally`. Concurrent requests in the same warm process then share one fill rather than independently reading PostgreSQL. Preserve existing TTLs and empty/error behavior. Comparison authorization must run before shared-data retrieval. Keep different timeframes and indices separate and preserve per-index failure isolation.

This applies Facebook's stampede-control principle without requiring a new cache service or introducing persistent staleness. It is local coalescing, not a distributed lease and not a global guarantee across Vercel instances. Distributed leases, stale serving and fallback caches are later options if measurements justify them.

### 4. Share PRO raw market data, not personalized responses

Evidence:

- Chart and screener hooks both poll at 30-second intervals: `components/currency-index-pro/hooks/use-currency-index-chart.ts:22,99` and `use-currency-index-screener.ts:22,100`.
- Both are called by the cockpit, and each route loads session bars plus corridor: chart route lines 64-67; screener route lines 95-99.
- `lib/currency-index-pro/queries.ts:69,78,30` performs two session-bar queries and one corridor query when data exists.

The populated-session case therefore repeats six market database calls per browser polling round, before news and preference work. A 15-30 second shared raw snapshot, with miss coalescing, can serve both endpoints and multiple viewers. Actual fleet-wide savings depend on hit rate, traffic, cache-key design and cache availability; no production reduction has been measured.

Keep session/tier checks on every request and user preferences outside the shared value. The helper returns a `Map`, which cannot be JSON-cached directly: serialize entries or a plain object and reconstruct it. Preserve per-index session boundaries, include a cache format version and canonical requested indices in keys, avoid mutable shared arrays, and do not hide data freshness. Begin with a short explicit TTL; a full personalized screener response must not be globally shared.

### 5. Reduce unused gateway RETURNING data

At `railway-gateway/src/worker/market-data.processor.ts:70`, the upsert result is discarded. An added `select: { id: true }` compiles to RETURNING one column instead of 106. The offline probe preserves the same INSERT/ON CONFLICT/UPDATE SQL shape before RETURNING; it does not execute the write.

Preserve the complete live update, `cycle_id`, point-in-time snapshot call and single-worker ordering. Do not batch or increase concurrency as part of this change. Test duplicate delivery, row success/failure and manifest readiness before rollout. This reduces returned data, not MVCC row-version or WAL work.

### 6. Recover cache use after Redis outages

`lib/redis/client.ts:51-55` stops reconnecting after ten retries, while `getRedisClient()` keeps returning the existing ended client at lines 69-71. Installed ioredis behavior confirms that a nonnumeric retry delay stops reconnecting. Cache reads then degrade to PostgreSQL until the process is replaced even if Redis recovers.

Align bounded background reconnect backoff with the service patterns, retaining the three-second command deadline, connection timeout and finite per-command retry behavior. Verify reconnect recovery, no duplicate clients/listeners, cold starts and existing rate-limit/idempotency consumers. Do not introduce unbounded request waits. Operation and money Redis services already reconnect indefinitely; older notes suggesting otherwise are stale.

### 7. Bound service connection acquisition

Set explicit finite acquisition/connect deadlines in the NestJS Prisma adapters, initially retaining the installed max of ten. Five seconds is a candidate consistent with the Next clients, subject to each service's request/job deadline. This bounds queued work during overload; it is not a guaranteed steady-state throughput increase and does not cancel SQL already running.

Determine fleet connection budgets before changing pool maxima. Preserve gateway queue retry/order semantics and handle money-service changes as a separate sensitive scope. See `database-pools.md` for installed-driver line evidence and rollback/verification details.

## Second wave, excluded from the first low-risk batch

- **Duplicate indexes:** schema/migrations show nonunique indexes alongside matching UNIQUE indexes on `market_data_v6` and `market_data_point_in_time`. Verify physical definitions, validity, dependencies, use and plans first; preserve UNIQUE constraints. Index removal is DDL and is not approved or performed here. Savings are not universally proportional to index count, and HOT updates complicate write-amplification estimates.
- **Point-in-time snapshot positive memo:** repeatedly inserted immutable snapshot keys could be remembered only after successful insertion/deduplication, using bounded memory and preserving failure retry. This changes ingestion behavior and needs stronger regression evidence; keep it out of the initial batch.
- **Alert watch reload:** remove the unused loaded alert relation only after result-shape checks. Coalescing invalidation reloads requires serialization plus a dirty follow-up run; naive single-flight could discard an update.
- **Read replicas, sharding, a new cache platform and higher ingestion concurrency:** no current measurements establish these as the best small changes. Gateway concurrency one protects row/manifest ordering.

## Verification already completed

The root agent reran both commands successfully (exit 0):

```text
node work/db-audit/query-sql-probe.cjs
node work/db-audit/query-sql-probe.cjs railway-gateway/node_modules/.prisma/client gateway
```

The supplied probe uses the installed generated Prisma clients and a fake SQL driver with no PostgreSQL connection, `pg` import, network calls or environment/config loading. It records compiled SQL and supplies empty results. Synthetic upserts are compiled only. This verifies outgoing SQL shape; it does not verify execution, query plans, result equivalence under real data, database speed or deployed-client parity.

| Observation                              | Root market client      | Gateway client |
| ---------------------------------------- | ----------------------- | -------------- |
| Ordered distinct latest-currency query   | No SQL DISTINCT / LIMIT | Same           |
| Ordered distinct requested-index query   | No SQL DISTINCT / LIMIT | Same           |
| Ordered distinct latest-statistics query | No SQL DISTINCT / LIMIT | Same           |
| Whole-row channel projection             | 106 columns             | 106 columns    |
| Explicit channel projection              | 5 columns               | 5 columns      |
| Whole-row upsert RETURNING               | 106 columns             | 106 columns    |
| ID-only upsert RETURNING                 | 1 column                | 1 column       |

Application tests, builds, live database checks and performance benchmarks were not run because no implementation was made. Three specialist notes and SQL evidence are included for resumption.

## Resume here

1. Re-read the repository instructions, branch/HEAD/status and relevant blockers. Compare reviewed-file hashes; this is a dirty-checkout snapshot, not an immutable release.
2. Read `database-pools.md`, `cache-review.md`, `query-review.md` and the two SQL evidence JSON files.
3. Keep this task an assessment unless Davin requests implementation. The first implementation candidate is channel projection in both route branches; next investigate local DB-side latest-row selection and existing-cache coalescing.
4. For each accepted change, prove response equivalence, preserve authorization/freshness/ingestion invariants, measure the relevant operation counts and bytes, and retain an isolated rollback.
5. No production migrations, deployments or flag changes are authorized by this checkpoint. No additional confirmation is needed merely to resume read-only analysis.

## Source principles and primary references

The OpenAI case emphasizes reducing primary load, query efficiency, pooling, workload isolation and overload control. The Facebook paper emphasizes independent cache/storage scaling, miss coalescing, failure handling and explicit consistency tradeoffs. These recommendations are our application of those ideas to this repository, not performance claims made by the papers about DavinTrade.

- [OpenAI: Scaling PostgreSQL](https://openai.com/th-TH/index/scaling-postgresql/)
- Facebook: _Scaling Memcache at Facebook_, NSDI 2013; supplied PDF at `D:\SaaS Project\trading-alerts-saas-public\davintrade-database-scaling\nsdi13-final170_update.pdf`.
- [Prisma v7 connection pool configuration](https://docs.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Prisma v7 Client API, nativeDistinct](https://www.prisma.io/docs/orm/v7/reference/prisma-client-reference#nativedistinct)
- [PostgreSQL SELECT / DISTINCT ON](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL unique indexes](https://www.postgresql.org/docs/18/indexes-unique.html)
