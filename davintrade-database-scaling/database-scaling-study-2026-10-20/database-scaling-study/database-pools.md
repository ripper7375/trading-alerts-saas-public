# Read-only database clients, pools and index audit

Audit date: 2026-10-19 (Asia/Bangkok). Checkout: `D:\SaaS Project\trading-alerts-saas-public`, branch `main`, HEAD `c6dccff16d11434ebcf63ff37d9c654fc7766fec`. The working tree contains numerous unrelated modifications and deletions. Nothing in the repository was written, restored, generated, installed or executed. No database, deployed service or network endpoint was contacted; no environment file or secret contents were read. This report is source inspection, not runtime capacity evidence.

Read repository instructions: `AGENTS.md`, `.claude/rules/non-negotiables.md`, `.claude/architecture/database-traps.md`; relevant current-state, blockers and infrastructure sections. Source takes precedence over stale deployment notes.

## Architecture found in current source

- Root Next.js has two generated Prisma 7.9.1 clients, one for each schema: `lib/db/prisma.ts:3`, `lib/db/market-prisma.ts:3`; generators at `prisma/non-market-data/schema.prisma:1` and `prisma/market-data/schema.prisma:1`. Both use the same `process.env['DATABASE_URL']` variable (`lib/db/prisma.ts:43`, `lib/db/market-prisma.ts:35`). The project explicitly records one physical PostgreSQL database and one migration history at `.claude/architecture/database-traps.md:31`; this is not a database shard split.
- Both root clients already lazily construct the adapter only if no cached global client exists, and cache the client for development hot reload (`lib/db/prisma.ts:41,65,67`; `lib/db/market-prisma.ts:33,54,57`). Production relies on module reuse within each process. They are not created once per request in source.
- Root pools are already bounded: `connectionTimeoutMillis: 5_000`, `idleTimeoutMillis: 30_000`, `max: 5` (`lib/db/prisma.ts:51`, `lib/db/market-prisma.ts:40`). An instance using both pools can hold at most ten client connections; this does not mean ten active PostgreSQL backend connections behind transaction pooling.
- All three Nest services provide one globally scoped `PrismaService` per Nest application (`railway-gateway/src/prisma/prisma.module.ts:4`, `operation-service/src/prisma/prisma.module.ts:5`, `money-service/src/prisma/prisma.module.ts:5`). The services do not instantiate Prisma per request.
- The Nest adapters set the connection string but no max/idle/acquisition settings: `railway-gateway/src/prisma/prisma.service.ts:23`, `operation-service/src/prisma/prisma.service.ts:21`, `money-service/src/prisma/prisma.service.ts:28`. Operation also configures TLS; money and gateway intentionally do not. Do not blindly unify their TLS settings.
- All three services already disconnect during `onApplicationShutdown`, after HTTP drain, rather than `onModuleDestroy`: gateway `:37`, operation `:40`, money `:42`. Their main files enable shutdown hooks (gateway `src/main.ts:25`, operation `src/main.ts:36`, money `src/main.ts:71`). Do not propose the completed lifecycle change again.
- Operation can run a separate process using `NestFactory.createApplicationContext(AppModule)` (`operation-service/src/main-worker.ts:28`), so a worker has its own Prisma pool even though it shares the source module. Count processes and replicas, not merely services.
- Source includes an existing PgBouncer deployment configuration: `infra/pgbouncer/pgbouncer.ini:20` transaction mode, `:21` max_client_conn=100, `:22` default_pool_size=20. The latter is not a global PostgreSQL backend cap; pooling is by database/user. Historical deployment evidence is recorded at `docs/migration-orders/1-3b-pgbouncer.migration-order.md:130` and role-preserving CRUD checks at `:134`. Current endpoints and live settings were not verified in this audit. Comments disagree on precisely where operation-service's URL points; see `money-service/src/prisma/prisma.service.ts:18`. Adding another pooler is not a justified quick win.

## Verified installed driver defaults

The services use Prisma's node-pg driver adapter, not the pre-v7 Rust pool. Read actual installed dependencies, without executing them:

- `operation-service/node_modules/pg-pool/index.js:89`, `money-service/node_modules/pg-pool/index.js:89`, `railway-gateway/node_modules/pg-pool/index.js:89`: `this.options.max = this.options.max || this.options.poolSize || 10`.
- Each corresponding file `:98-99`: undefined `idleTimeoutMillis` becomes 10,000 ms.
- Each corresponding file `:206-208`: when `connectionTimeoutMillis` is absent/falsy, a pending pool acquisition is queued with no timer. At `:250`, the TCP connection establishment timeout is likewise installed only if that setting is truthy. Thus current source has no finite driver acquisition/connect deadline, equivalent to an unset/zero timeout, not a default five-second timeout.
- Root installed `node_modules/@prisma/adapter-pg/dist/index.js:777` stores the supplied config, and `:785` constructs `new pg.Pool(this.config)`. It does not supply an adapter timeout behind the application's back. Root installed pg-pool (`node_modules/.pnpm/pg-pool@3.10.1_pg@8.16.3/node_modules/pg-pool/index.js:89,98,198,242`) has the same defaults.

## Recommendation 1: finite service pool acquisition/connect deadlines

Priority: immediate candidate, small implementation scope, primarily overload/failure containment. Start with operation-service and railway-gateway; money-service needs its applicable review because it participates in payment processing. Candidate lines are each service's adapter constructor above. A five-second acquisition/connect deadline matches the existing root policy, but select the final value against the caller/job budgets and cold-start behavior.

Retain `max: 10` initially, explicitly if desired; do not reduce it to five on intuition. There is no evidence here that reducing pool concurrency improves throughput, nor that present max values saturate PostgreSQL. An explicit finite wait bounds how long a starved caller remains in the pending acquisition queue; it is not a SQL execution timeout and does not cancel an already running query. It cannot guarantee a request's total wall time because an earlier SQL operation or retry can take additional time.

Expected benefit: finite failure latency when the pool is full or new connections cannot establish, limiting indefinitely accumulating waiters and reducing caller/resource pile-up. No normal-path query-count reduction or measured throughput increase is claimed.

Validation proposed, not executed: source/config assertion analogous to the existing root test `__tests__/lib/db/pool-config.test.ts:59`; isolated driver behavior test with a saturated pool and unavailable endpoint; verify normal queries and startup within budget, graceful shutdown still drains, HTTP errors retain contract, and queue failures use the existing bounded retry policy. Under a controlled load test compare p95 acquisition wait, timeout/error rate, jobs delayed/retried, DB CPU/I/O and PostgreSQL/PgBouncer connection counts. Do not add immediate retries to a timeout or automatically replay payment work without its idempotency guarantee.

Risk: genuine slow cold starts or transient load may now surface errors sooner. Rollback: restore only the adapter timeout setting and redeploy the affected service. No schema/data change is required. Nothing was implemented.

## Recommendation 2: record a connection budget before tuning pool sizes

Priority: small read-only operational follow-up, prerequisite to any max-connections tuning, not a performance fix with a predicted gain. Inventory which deployed processes use PgBouncer, which use direct PostgreSQL, process/replica counts, the pooler limits and PostgreSQL `max_connections`/reserved headroom. Do not print credentials while doing it. Where every Next instance imports both root clients, its upper-bound client capacity is `10 * N`; add `10 * (operation HTTP processes + operation worker processes + money processes + gateway processes)` for the current Nest defaults. This is a connection-capacity expression, not observed open connections or backend count.

Evidence: root max settings, separate generated clients and separate operation worker above. Historical pooler architecture already exists, so first verify and measure rather than introduce a second layer. A future metrics change could expose pool wait/total/idle counts and acquisition latency without SQL parameters or user data. Actual pg-pool getters exist in the installed implementation (`root .pnpm pg-pool index.js:463,467,475`). No code change or default reduction is proposed before those measurements.

## Recommendation 3: duplicate-index consolidation, second wave only

Priority: investigate after runtime inventory, not an immediate low-risk recommendation to execute. Two exact duplicate index-key lists appear in both schemas and migration SQL:

1. `market_data_v6`: `@@unique([symbol,timeframe,timestamp])` plus nonunique `@@index` in `prisma/market-data/schema.prisma:179-180`, mirrored in `railway-gateway/prisma/schema.prisma:169-170` and `operation-service/prisma/schema.prisma:434-435`. The migration creates the unique B-tree at `prisma/migrations/20260705000000_add_market_data_v6/migration.sql:118` and nonunique B-tree at `:121`.
2. `market_data_point_in_time`: corresponding pair at `prisma/market-data/schema.prisma:328-329`, gateway mirror `:318-319`, migration `prisma/migrations/20260920000000_add_market_data_point_in_time/migration.sql:101,105`.

The UNIQUE index must stay: the gateway upsert uses the natural key (`railway-gateway/src/worker/market-data.processor.ts:70-73`) and point-in-time creation uses `skipDuplicates` (`:116-118`) to preserve first observation. Removing uniqueness changes correctness, not just speed.

Why investigate: one unique B-tree can normally serve the equality/range/time-order accesses of an identical nonunique B-tree, so redundant index maintenance and storage may be removable. The live row is rewritten every cycle by design; do not 'optimize' away those updates or change worker ordering (`market-data.processor.ts:32-43,84-99`). The newer day-bars reader already asks for narrow columns and indexed ranges (`lib/reply/read/day-bars.ts:148-164`).

Limits: current physical presence, actual definitions, validity, sizes and access plans must be checked with `pg_catalog`/`pg_indexes`, because this repo explicitly has migration-ledger-versus-physical-schema discrepancies. Check constraints/dependencies, predicates, included columns, sort/opclass/collation and actual query plans, plus pg_stat_user_indexes. Zero observed scans alone is insufficient evidence to drop an index. Inserts and non-HOT updates which create index entries could maintain one rather than two same-key indexes; ordinary reads/SQL-call count are unchanged, HOT updates already avoid such index work, and ON CONFLICT DO NOTHING does not insert into either duplicate. No percentage write/WAL gain is justified from source alone.

Proposed validation: separate migration review; retain unique indexes; compare EXPLAIN plans of representative symbol/timeframe windows and reverse newest-row lookups; compare index size, write/WAL/DB CPU, ingestion delay and query p95 before/after in a suitable rehearsal environment. Use an owner-approved operational plan; schema edits alone would not remove a physical index. Rollback entails recreating the nonunique index, potentially expensive, so schedule rather than calling it cost-free.

`currency_gold_indices` also has an ascending unique key and a descending nonunique time index (`prisma/market-data/schema.prisma:627-628`, gateway `:617-618`), but these are not byte-identical definitions. Do not include it in an automatic duplicate-index drop list; validate the actual equality/order query shapes first.

## Explicit exclusions and uncertainty

- No recommendation to add generic sharding, distributed databases, replicas or a new PgBouncer without workload/capacity evidence. Schema separation and service decomposition currently do not isolate physical database CPU/I/O.
- No recommendation to parallelize the gateway's main ingestion worker: concurrency=1 protects row/manifest ordering, not merely performance.
- No claim that the application's deployed versions match this checkout. Blocker docs say root pool bounds were locally committed but deployment unverified; historical notes may lag source.
- No runtime assertions on physical indexes, grants, replica lag, connection saturation, query frequency, row counts, autovacuum or bloat. All require authorized evidence gathering later.
- No tests/build/generation were run under the read-only audit constraint. The shell reads and searches completed; one initial Git query encountered safe-directory ownership checks and was retried with command-local safe.directory only, without changing Git config.
