# Read-only database audit: cache scope

Date: 2026-10-19 (Asia/Bangkok). Repository: `D:\SaaS Project\trading-alerts-saas-public`. Branch `main`, HEAD `c6dccff16d11434ebcf63ff37d9c654fc7766fec`.

Authorization: root delegated source-only cache audit. No repository writes, runtime calls, database/Redis/network calls, environment-file reads, installs, generators, builds or tests were performed. The only written file is this analysis artifact outside the repository. Existing changes/deletions were preserved. `git diff --numstat -- <12 relevant source paths>` returned no differences at final inspection; SHA-256 values below preserve reviewed source identity.

Read instructions: root `AGENTS.md`, `.claude/rules/non-negotiables.md`, shared-state frontmatter and task-relevant cache/remediation entries, Codex continuity, database-traps routing, collaboration protocol, Next.js remediation log sessions 2/5/8. No nested AGENTS files were found under the reviewed app/lib/service paths. User-scoped read-only authorization takes precedence over repository task/handoff writes; this file is the durable subtask record.

## Recommended order

1. Reuse raw market reads shared by the PRO chart and screener; keep auth and user preferences outside the shared object.
2. Coalesce concurrent fills of existing market caches.
3. Restore monolith Redis background recovery after prolonged outages while retaining bounded request waits.
4. Optional, more correctness-sensitive: serialize/coalesce the alert worker's full watch reloads.

These are code-proven opportunities, not claims about measured production bottlenecks. No traffic, cache-hit, query-duration or EXPLAIN evidence was available. Recommendations 1-3 are the strongest quick-win candidates; item 4 needs alert-specific concurrency verification.

## C1. Share the raw market-window reads used twice by every PRO cockpit

**Evidence and active caller chain**

- `app/pro/currency-index/page.tsx:44` renders `ProCurrencyIndexCockpit`.
- `components/currency-index-pro/pro-currency-index-cockpit.tsx:79-80` mounts both chart and screener hooks.
- Chart hook `components/currency-index-pro/hooks/use-currency-index-chart.ts:22,82-99` polls `/api/market/currency-index-pro/chart` every 30 seconds. Screener hook `components/currency-index-pro/hooks/use-currency-index-screener.ts:22,86-100` independently polls `/screener` every 30 seconds.
- Chart route `app/api/market/currency-index-pro/chart/route.ts:64-67` calls `getTodaysSessionBarsForIndices(FX_INDEX_NAMES)` and `getLatestCorridor()`.
- Screener route `app/api/market/currency-index-pro/screener/route.ts:94-99` makes the same raw market calls for the same eight indices plus a user-preference read.
- `lib/currency-index-pro/queries.ts:69,78` executes two queries for session bars; `:30` executes the latest-corridor query. There is no cache around these functions. `private, max-age=30` (`chart/route.ts:118`, `screener/route.ts:247`) is a browser response cache; it cannot share either endpoint's database results among viewers, nor across the two URLs.

**Amplification**: with populated data, one cockpit polling round starts six market-DB calls for two copies of the same raw bars/corridor, before chart news, screener preferences and any tier fallback. For N active viewers, the raw reads scale with viewers. Browser caching and hidden-tab protection reduce requests but do not remove duplication on origin requests.

**Minimal proposal**: put a normalized, shared raw-market loader below both handlers. Start with in-flight request coalescing (no additional staleness); consider a short, explicitly bounded shared TTL such as 10-15 seconds if measured traffic warrants cross-request reuse. Keep the returned contract (currently a `Map`) intact, with deliberate serialization/reconstruction if stored in Redis. Normalize key index sets. Keep fresh per-request `serverTime` outside the cached object. Keep the source query's two-query batch shape.

**Security/freshness constraints**: authorization must still execute before serving data. Do not globally cache the entire screener response: `screener/route.ts:98` reads `getUserCurrencyIndexPreference(session.user.id)` and `:149-150` applies that user's HRMA/SMMA periods. Cache only non-user raw market bars/corridor; preserve per-user transformations and current tier checks. Additional server TTL plus browser `max-age` adds to possible freshness delay; select the TTL with that combined budget in mind and account for session rollover. In-flight coalescing alone avoids this freshness tradeoff. Errors currently return empty/null values, so distinguish failure from valid emptiness before retaining results for a TTL.

## C2. Coalesce cache-miss refill on the three existing market cache-aside paths

**Evidence and active callers**

- Snapshot route `app/api/market/currency-gold-indices/route.ts:44-67`: read cache, on miss read DB, then set cache.
- History route `app/api/market/currency-gold-indices/history/route.ts:46-69`: same shape, keyed by M5/M15.
- PRO comparison route `app/api/market/currency-index-pro/comparison/route.ts:80-108`: same shape per `(indexName,timeframe)`; auth runs first at `:111-128`; one request can request two indices at `:143-147`.
- TTL is already 60 seconds: `lib/cache/cache-manager.ts:359-360,378-386,407-416`; getters at `:366,389,419` are ordinary `getCache` wrappers. No per-key in-flight map, SET NX refresh guard or lease exists in these routes/cache manager.
- Active clients: snapshot widget `components/market/currency-index-hero-widget.tsx:35` uses hook `components/market/useCurrencyGoldIndices.ts:35-38`; public history hook `components/market/useCurrencyIndexHistory.ts:31-34`; comparison workspace `components/currency-index-comparison/currency-index-comparison-workspace.tsx:250` uses `useCurrencyIndexComparison`, whose `:44-48` refreshes every 60 seconds. `app/pro/currency-index/compare/page.tsx:54` renders that workspace.
- Miss cost: snapshot queries `lib/currency-gold-indices/queries.ts:65,82`; public M15 history reads up to 9,000 M5 rows for each of two indices (`:134,146-155`); PRO comparison reads up to 9,003 rows per index for M15 (`lib/currency-index-comparison/queries.ts:28-41`).

**Amplification**: K overlapping misses for one key each issue the same query/computation before any caller writes a value. A history-key expiry can cause roughly 2K large reads; a comparison-key expiry causes K reads of up to 9,003 rows for that index. CDN and SWR caches already reduce steady traffic but do not guarantee origin fill serialization across cold origins, processes or Redis failures.

**Minimal proposal**: wrap each market-key get/load/set operation with same-process single-flight using a bounded key space and `finally` cleanup. Retain TTL, response shape, cache keys and authorization order. This bounds overlapping fills to one per key per process and also helps during Redis errors. If production has many warm processes, a token-owned short Redis refresh lock can later coordinate processes; it must recheck the cache after acquiring the lock and expire safely. Treat cross-process locking as a second step, not necessary complexity for the first quick win.

**Risks**: never retain rejected promises; do not let one aborted browser request abort shared work needed by another. Same-process coalescing is not global deduplication. A distributed lock must not permanently withhold data after a crashed filler; no stale data should be served indefinitely. Do not describe a refresh lock as strong consistency. The PRO cache contains common market data only; session/tier responses must remain outside it.

## C3. Monolith Redis can stop recovering and leave origin reads on PostgreSQL indefinitely

**Evidence**

- `lib/redis/client.ts:51-55` returns `null` from `retryStrategy` after ten reconnect retries.
- Installed `node_modules/ioredis/built/redis/event_handler.js:187-190` calls `close()` when retryStrategy returns a non-number; `:213` sets status `end`. This was checked directly from installed code, without execution.
- `lib/redis/client.ts:68-71` returns the existing singleton regardless of ended status; there is no automatic replacement/reconnect there.
- Cache reads swallow Redis exceptions and return a miss (`lib/cache/cache-manager.ts:43-55`); writes swallow errors (`:66-77`). All three market cache paths in C2 then read PostgreSQL on subsequent origin requests. Recovery of the Redis service alone does not recreate this ended client; process replacement/restart is the practical recovery in the current code.
- Both NestJS shared providers already use numeric bounded reconnect delay without the give-up branch: `operation-service/src/redis/redis.service.ts:14-23` and `money-service/src/redis/redis.service.ts:10-18`. The shared waiting-on note about money-service giving up is stale compared with live source.

**Minimal proposal**: align the monolith singleton's _background reconnect_ policy with the live NestJS provider's bounded never-give-up delay, while retaining `maxRetriesPerRequest: 3` and `commandTimeout: 3_000` (`lib/redis/client.ts:48-50`). This is a small code change that restores the caching layer after infrastructure recovery; it does not require cached data to become authoritative.

**Amplification**: after a sufficiently long Redis outage, every origin read misses the application Redis cache for the lifetime of that warm process, even after Redis returns. Public CDN caches still provide some protection; they do not repair this client. In the outage itself, existing callers may spend up to 3 s on GET and another up to 3 s on SET, because routes await both sequentially. C2 helps contain DB duplication but does not restore a dead client.

**Risk/scope**: this Redis singleton is also used by `lib/rate-limit.ts`, `lib/idempotency/idempotency-guard.ts`, engine4 idempotency and alert invalidation. Preserve per-request limits, existing fail behavior and key semantics; do not change auth/rate-limit/idempotency policies as a side effect. Verify recovery and request deadlines with a mocked outage/recovery sequence before implementation sign-off. No live outage was induced. A cache-only outage circuit breaker / bounded retained last-success value would be a separate design, with an explicit age limit and no application to balances, grants or sessions.

## C4. Optional: collapse overlapping full watch-cache reloads after mutation bursts

**Evidence and active callers**

- `operation-service/src/main-worker.ts:39-43` gets the worker and calls `start()`; it is an active standalone entrypoint, not an unused provider.
- Worker `operation-service/src/alert-engine/alert-worker.service.ts:75,80-82` subscribes to `alerts:changed` and starts `void this.reload()` for every message.
- `reload():90-104` reads every active drawing alert with its drawing and alert relations, rebuilds all watch objects, then replaces the whole map. There is no in-flight guard/dirty queue at `:38-41` or in reload.
- Publishers are active mutations: `operation-service/src/drawings/drawings.service.ts:117-140` publishes after updates, `:171` after removal; line-alert mutations publish at `operation-service/src/alerts/line-alerts.service.ts:153,220,247`.

**Amplification**: B rapid mutations can start B simultaneous all-active-watch reads and B complete map rebuilds per worker, even though the payload contains symbol/timeframe. Different query completion orders can also allow an older reload to replace the map after a newer reload.

**Minimal proposal**: serialize reloads and mark a pending dirty flag when an invalidation arrives during a load; once the current load finishes, run another immediately if dirty. This prevents concurrent whole-cache reloads and guarantees a final catch-up load. Explicitly log/catch failure from the detached message handler. Avoid time-based stale caching of the alert map.

**Risk**: dropping a message just because a reload is already running can miss an update that committed after that query's snapshot. A one-time single-flight promise alone is therefore insufficient here; the dirty follow-up is necessary. Alerts affect externally visible delivery, so this is lower priority than C1-C3 and needs concurrent mutation/final-state tests, no dropped invalidations and unchanged evaluation semantics. An incremental per-symbol reload is a larger follow-up requiring its own correctness design.

## Existing defenses / non-findings

- Do not recommend adding Redis caching to public index snapshot/history or the PRO comparison route from scratch: it already exists with 60 s TTL. Snapshot/history already set `public, s-maxage=60, stale-while-revalidate=30` (routes `:40` / `:35`); comparison stays `private, max-age=30` after auth (`:152`). Actual CDN behavior was not verified.
- A reusable monolith Redis singleton already exists, including a dev `globalThis` recovery path (`lib/redis/client.ts:15-34`) and bounded command/connect waits (`:48-50`). Dedicated pub/sub and ops connections in the alert worker are intentional, not an accidental duplicate singleton.
- PRO polling already pauses when hidden, prevents overlap within one hook, aborts on unmount and times out after ten seconds (`lib/utils/visible-polling.ts:32,62-78,81-105`). Recommending those existing features would duplicate completed Session 8 work. This does not deduplicate the chart and screener or requests from different users.
- Existing raw market session-bar code already uses two batched reads for eight indices (`lib/currency-index-pro/queries.ts:65-108`); it does not perform one query per index. Snapshot sparkline loading is also one OR-clause query (`lib/currency-gold-indices/queries.ts:79-91`).
- React render deduplication already wraps session/admin checks, appearance, locale, view-as, tutorial detail reads (source and Session 5 log). Route handlers do not gain cross-request caching by merely wrapping functions in `React.cache()`.
- Five admin analytics functions already use `unstable_cache` with `revalidate: 300` and explicit tags (`lib/admin/analytics/{executive:317-320,users:201-204,affiliates:334-337,regional:297-300,revenue:283-286}.ts`). No broad money/admin caching change is recommended.
- World-gold FX already has local in-flight deduplication, a Redis `SET NX` refresh lock, retained-success fallback and retry backoff (`lib/world-gold/fx.ts:281-348`). Stripe price lookup already caches a promise with TTL and removes failures (`lib/stripe/stripe.ts:72-94`). Those features do not cover the index market cache paths.
- NestJS operation/money `CacheService` classes are registered globals, but a search of production source found no injected/imported active consumer beyond module registration. Do not claim missing TTLs in these unused wrappers are a current workload bottleneck.
- Root `deleteCachePattern` uses `KEYS` (`lib/cache/cache-manager.ts:99-105`), but the only internal caller is `invalidateUserSession` and no active production caller of that function was found. It is cleanup debt rather than an evidenced high-impact quick win. NestJS cache wrappers already use SCAN.
- The `frontend/` copy is a documented stale snapshot. Runtime proof in this report follows root `app/`, `components/`, and `lib/`; no duplicate-cache finding is inferred from that snapshot.

## Verification limits and source identity

Read-only inspections succeeded; search commands naming absent paths returned expected path-not-found messages and were narrowed to existing source. No tests were run because the task forbids mutation-prone execution. All performance multipliers above derive from the inspected call graph, not measurements. Production deployment state, cache hit/miss rate, Redis topology, connection counts, DB latency and freshness budgets remain unverified.

SHA-256 at final scoped check:

```text
lib/cache/cache-manager.ts E8D43EDEF3DC0EC39630F749D254A55981254320C80F1583EBED7DFB6722AE3D
lib/redis/client.ts 43F57FD8DC8016779E1A9452227BF4F323675C874839F2027C17E556E31E4258
lib/currency-index-pro/queries.ts 72748D8325F0658B7827DD81D7F391F0E2215DC619733BE346760C61A1634C52
app/api/market/currency-index-pro/chart/route.ts A09958CD15E124103C8079FD151EA3FDC1C783977CB11C54B9D5EAF82EE166C1
app/api/market/currency-index-pro/screener/route.ts 8E2E5390254A5EEA1CB2D84EBACBDC7557E688354891060D68326D81BD8BEB8B
app/api/market/currency-gold-indices/route.ts 604CF506E59B65A4F24F8C8EF18C0893AEA5B51C8574904D34BD9F96FE4701E3
app/api/market/currency-gold-indices/history/route.ts D71D54CF205646F40404D8E14490DBF77CEF5D1807C9BF7775C79F72F52A3837
app/api/market/currency-index-pro/comparison/route.ts F27691A30AE1705FC9BA940C3B1ECE43FDCDAF3ACE8191686CBA49674984512C
operation-service/src/alert-engine/alert-worker.service.ts DD2D38AD55EB99041C7B8EA7FE3A203EC5892C43D4C850484A4F039566BBE24D
operation-service/src/main-worker.ts 2939BB619778BAA1816BC627C4955A86E9416822886D7AB563018612BD7D3932
operation-service/src/drawings/drawings.service.ts 2F668FE22B127C7A7996DD2B32EA3BC158D9823C86B656E5400AC8A035795FA4
operation-service/src/alerts/line-alerts.service.ts F2A56DC08120ADDDEAC9EE1818D6CA656FB0DD6AD9461D0476A01E14AE0060DF
```
