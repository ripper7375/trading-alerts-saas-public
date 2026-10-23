---
type: Concept/TechnicalTraps
severity: high
updated_at: 2026-10-10
source: "Distilled from CLAUDE.md '## Waiting on' and session logs 2026-09-01..09-26; details in state/history/"
tags: [database, prisma, migrations, railway, postgres]
related_docs:
  - ../state/waiting-on.md
  - ../state/history/resolved-waiting-on.md
  - ./infrastructure.md
---

# Database & migration traps

Read before any schema change, migration, or query against a real database.

## Which database is which (settled 2026-09-09)

- **Production:** Postgres in the Railway project **`trading-alerts`**. Public proxy
  `maglev.proxy.rlwy.net:58290`, private address `postgres.railway.internal`.
- **`.env` / `.env.local` point at a staging clone**, `turntable.proxy.rlwy.net:55082`, in a Railway
  project named "postgre for staging". It is the local dev DB and the migration rehearsal target.
  Do not delete it.
- `maglev`/`turntable` are **shared** Railway proxy hostnames; the **port** identifies the service.
  Never infer ownership from a hostname — read the service's Settings → Networking.
- Vercel `DATABASE_URL` is scoped to **All Environments**, so **preview deployments hit production
  data** (open item). `DIRECT_URL` is Production-only.

## Prisma layout

- Two schema files share **one physical database and one migration history** (`LESSONS-LEARNED.md`
  L24): `prisma/market-data/schema.prisma` and `prisma/non-market-data/schema.prisma`. Models with a
  user reference go in `non-market-data` (real FK to `User`).
- `railway-gateway/prisma/schema.prisma` mirrors market-data models **byte-identically**
  (`railway-gateway/test/schema-sync.spec.ts` diffs them). `operation-service/prisma/schema.prisma`
  is a narrower mirror, `prisma generate` only. `types/prisma-stubs.d.ts` duplicates some model
  interfaces — keep it in sync.
- Market-data conventions: business timestamps are `Int` unix UTC, no `@db.VarChar`.
- `prisma.config.ts` loads `.env.local` with `override: true`, so its `DIRECT_URL` beats any
  `DATABASE_URL` you pass on the command line. Production work uses `prisma.production.config.ts`.
- **`market_data_v6.cycle_id` is the collector cycle that LAST wrote the row**, not the one that first saw the bar:
  `promote_cycle()` rewrites every bar of the 3,000-bar window under each new cycle's id and the gateway's upsert
  overwrites it. RETUNING (ADR-015, Option A) relies on this: a row with a `cycle_id` below the promote cycle's
  `market_cycles.m5_collection_cycle_id` still holds pre-promote values. It also assumes collector ids only grow
  (recreating `xauusd.db` restarts them at 1).

## Applying migrations

- **The Executor never applies a migration to a live database.** Author it, verify it, hand it to Davin.
- **`prisma migrate deploy` applies every pending migration in history order**, not just yours.
  Run `prisma migrate status` first. To apply one migration alone:
  `prisma db execute --file <migration.sql>` then `prisma migrate resolve --applied <name>`.
- **A new column on a table the app reads whole is a login outage until the migration is applied** (2026-10-19, `User.deletedAt`).
  Prisma lists every column of the generated client in a `findUnique` with no `select`, so one missing column fails every such read:
  `The column User.deletedAt does not exist in the current database` on the credentials provider, the OAuth `signIn` callback and the
  adapter (the browser sees `/login?error=Callback` after a successful Google or X consent). `main` deploys on push and `next build` does
  not migrate, so **apply the migration to production BEFORE the push** (and say so in the hand-off). Reproduced on a scratch PostgreSQL 18:
  36 earlier migrations applied, the three reads fail, then pass once `20261019000000_add_user_deleted_at` is applied. Apply that one
  migration alone (`prisma db execute --file` then `prisma migrate resolve --applied`, with `--config prisma.production.config.ts`: the
  default config points at the staging clone), never a bare `migrate deploy`.
  **Sign-in no longer depends on it** (built 2026-10-19, uncommitted): every `User` call in `lib/auth/`, `app/api/auth/`,
  `app/api/user/{2fa,password}/`, `lib/security/device-detection.ts` and operation-service's `src/auth/` (plus its two `UsersService`
  calls) names its columns (`lib/auth/user-select.ts`, `operation-service/src/auth/user-select.ts`), and the NextAuth adapter's user
  methods are overridden with a `select`. Held by `__tests__/lib/auth/user-select-guard.test.ts` and
  `operation-service/src/auth/user-select.guard.spec.ts` (a source guard plus sign-in against a database that rejects a bare `User`
  call). **A new `User` read or write in those files must name its columns.** What is NOT covered: 16 other whole-row `User`
  calls in the monolith (Stripe and dLocal webhook handlers, affiliate registration, the crons) still need the migration first.
- **`market_data_v6` reads name their columns too** (2026-10-19, the "fail open" proposal reviewed: only this part was kept, no
  OHLCV fallback). The monolith's channel route and operation-service's channel proxy (the live copy, `MIGRATE_MARKET_DATA_CHANNEL=true`)
  and alert-checker price read had no `select`; every `marketDataV6` read under `app/`, `lib/` and operation-service's `src/` now
  names its columns, held by `__tests__/lib/db/market-data-v6-select-guard.test.ts` and
  `operation-service/src/market-data/market-data-v6-select.guard.spec.ts`. The gateway's reads already did (not guarded by a test); its
  upsert writes every column, so the rollout order below still holds, and a read that USES a new column still needs its migration first.
- **`User.sessionVersion` and `RefreshToken.sessionStartedAt`** (WS-4, migration FILE `20261024000000_add_session_version`, NOT applied):
  apply it **before** any of the three stacks deploys. The monolith's `jwt` callback reads `sessionVersion` at sign-in inside the
  existing `try { … } catch { return token }`, so a deploy first does not fail loudly: sign-in returns a token with no id, tier or role.
  money-service's `User` model was a narrow mirror and now also maps `role`, `isActive`, `deletedAt` and `sessionVersion` (and, since
  WS-8, the read-only `twoFactorEnabled`, a column that already exists), so every
  whole-row `User` call there needs `20261019000000_add_user_deleted_at` too. Checked on a scratch PostgreSQL 18.0 (37 earlier migrations +
  this one, drift against the new schema identical to the baseline) and with each stack's generated client against the real tables;
  the order and its Deviations live in the gitignored security plan (§5 WS-4).
- **A security write raises `User.sessionVersion` and deletes the user's refresh tokens in the SAME transaction** (WS-5, CODE-02B,
  2026-10-23): `lib/auth/session-version.ts` and `operation-service/src/auth/session-version.util.ts` (`withSessionBump`,
  `bumpSessionVersion`, `raiseSessionVersion`, `endAllSessions`) use `user.updateMany({ data: { sessionVersion: { increment: 1 } } })`
  (no row comes back, a missing user does not fail the transaction) and `refreshToken.deleteMany`, and forget the cached snapshot AFTER the
  commit (forgetting inside lets a concurrent read put the old row back for 30 s). Sites: password change and reset, 2FA enable and
  disable, an e-mail change, "log out all", a fraud suspension, a confirmed deletion (and the 24 h worker through `revokeAllUserAccess`), in
  both the monolith and operation-service. **They all need the WS-4 column: deploy the migration first or every one of these writes
  fails.** The caller's own session ends too. A **manual role change (or any SQL that must end sessions)** has no endpoint to do it:
  run `"sessionVersion" = "sessionVersion" + 1` on the `User` row and delete its `RefreshToken` rows in one transaction. A new security
  write needs the same bump; `__tests__/lib/auth/session-version.test.ts`, `operation-service/src/auth/session-version.util.spec.ts` and the
  per-site tests (fake database with a real rollback: `__tests__/helpers/account-db-fake.ts`, `operation-service/test/account-db-fake.ts`)
  hold it. Story and Deviations: the gitignored security plan (§5 WS-5).
- Verify hand-written SQL against Prisma's own DDL:
  `prisma migrate diff --from-empty --to-schema <file> --script` (`--to-schema-datamodel` was
  removed in Prisma 7.9.1). When Docker Desktop is up, replay on a throwaway `postgres:16-alpine`.
- **`prisma migrate diff --script` prints two dotenv "injected env" lines on stdout** in this repo, so a redirect into
  a `.sql` file starts with them. Strip them before the output becomes a migration. `--from-url` no longer exists
  (Prisma 7); use `--from-config-datasource` with a Prisma config.
- **Verifying a migration without Docker:** `npx prisma dev --detach --name <x>` starts an embedded Postgres (use the
  direct TCP URL it prints; the port can differ from `--db-port`). Run the SQL with `pg`, then
  `prisma migrate diff --config <scratch config> --from-config-datasource --to-schema <schema> --script --exit-code`
  (0 = no drift, 2 = drift). Stop it with `prisma dev stop <x>` and `prisma dev rm <x>`. Keep the scratch config
  **outside the repo with only that local URL**: `prisma.config.ts` loads `.env.local`, whose `DIRECT_URL` is the staging
  clone. Worked example: [step 2 part 2](../../docs/handoffs/2026-10-02-0010-step2-part2.md).
  The same embedded Postgres runs the gateway's real-database spec (`railway-gateway/test/cycle-readers.pg.spec.ts`, gated on `CYCLE_PG_URL` and `CYCLE_PG_ALLOW_WIPE=yes`): create the tables
  with `prisma migrate diff --from-empty --to-schema railway-gateway/prisma/schema.prisma --script` (strip the two dotenv lines), apply them with `pg`, run the spec, then stop and remove the instance.
  The `prisma dev` TCP URL printed is `postgres://postgres:postgres@localhost:51214/template1` whatever `--port` you pass.
- **A real Postgres server without Docker** (build step 3 part 2, better evidence than the embedded engine): the installed
  PostgreSQL 18 binaries (`C:\Program Files\PostgreSQL\18\bin`) can run a scratch cluster that has nothing to do with the
  Windows service: `initdb -D <scratchpad>\pgdata -U postgres -A trust -E UTF8 --locale=C`, then start it with `Start-Process`
  on `postgres.exe -D ... -p 55432 -c listen_addresses=127.0.0.1` (detached, hidden window), `psql -h 127.0.0.1 -p 55432 -U postgres -w`,
  `pg_ctl ... stop -m fast` and delete the folder at the end. Never `pg_ctl start` through a tool pipe (see environment-gotchas).
  Worked example and the gated spec that runs on it: [step 3 part 2](../../docs/handoffs/2026-10-03-0050-step3-part2.md).
- **The gateway's own tables on that scratch server** (build step 3 part 3, the loader's gated spec `test/sensors-inputs.pg.spec.ts`): `prisma migrate diff --config <scratch config outside the repo> --from-empty --to-schema railway-gateway/prisma/schema.prisma --script`
  prints a "Loaded Prisma config" banner and an update box before the SQL; keep the text from the first `-- CreateTable`, write it as ASCII (no BOM) and apply it with `psql -v ON_ERROR_STOP=1`. All 15 tables of the gateway schema come out, without the
  hand-written CHECKs of the sensor migration. Run the spec with `CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes`; it wipes the five tables it seeds.
- **A scratch database that has the sensor CHECKs** (build step 3 part 4, `test/sensors-worker.pg.spec.ts`): take the `migrate diff` SQL above, DROP the three blocks that name `mcd_outputs`, `market_cycle_inputs` and `state_statistics` (a script splitting on the `-- CreateTable`,
  `-- CreateIndex` and `-- AddForeignKey` headers), then apply `prisma/migrations/20261003000000_add_sensor_tables/migration.sql` itself, so the three tables and their CHECKs are exactly the migration's (`mcd_outputs_flag_is_shadow_or_live`,
  `mcd_outputs_reason_lists_not_null`, `state_statistics_n_gate`). The worker spec wipes the seven tables it uses and creates one trigger (`sensor_test_boom`, a trigger that refuses a bundle row for the symbol `BOOM`) to show that a failing second statement rolls back the first.
- **The sensor writer uses the ARRAY form of `$transaction([...])`**, not the interactive form: three statements (`mcdOutput.createMany`, `marketCycleInput.createMany`, `marketCycleInput.deleteMany`) in one transaction, which also works behind PgBouncer's transaction pooling. A unit-level fake must make
  the operations lazy (they run only inside `$transaction`) or it cannot tell an atomic write from three separate ones (`test/helpers/sensors-worker-world.ts`).
- **Replay reads the two sensor tables and nothing else** (build step 3 part 5, `src/sensors/replay.ts`, `scripts/replay-cycle.js --db`): two SELECTs per slot with a `select` (`market_cycle_inputs` by `(symbol, cycle_slot)`, `mcd_outputs` by the same two columns), so it works after `market_data_v6`
  has been refit or emptied (the gated spec empties it first). Facts a replay of real rows will meet: bundles are deleted after 90 days and readings never are (`NO_STORED_BUNDLE`); a slot delivered again keeps its FIRST bundle (`skipDuplicates`), so a reading written later from changed data names
  other inputs (`TAMPERED_BUNDLE`, `READINGS_NAME_OTHER_INPUTS`: the finding says so); readings of one slot made under different `retuning_applied` cannot be reproduced by one run (`MIXED_RETUNING`); a laptop reads production through `DATABASE_PUBLIC_URL`, never `railway run`'s private URL.
- **The same statistics source is recorded under two `config_hash` values on M5 and M15 in real data** (replicas v3 and v4: `sr_levels` is `23691bbc…` on M5 and `c6f0b7f9…` on M15; in `market_cycles` the tuning is keyed by timeframe first because of this).
  The MCD kit's bundle keys `config_hash` and `channel_mode` by source only (plan S5), so the sensor inputs loader (`railway-gateway/src/sensors/inputs/tuning.ts`) takes a source's value from the timeframe that USES it, carries an unused source only when both
  charts agree, and refuses the cycle only when both timeframes USE the same source under two tunings (Q13). A future MCD that reads `sr_levels` per timeframe needs a timeframe-keyed hash in the kit (a MINOR change).
- **Prisma cannot see CHECK constraints, and a `String[]` column is nullable.** A hand-written `ALTER TABLE ... ADD CONSTRAINT ... CHECK`
  after Prisma's DDL does not show up as drift (`migrate diff` says "empty migration"), so nothing but a test notices a column added to the
  model without the CHECK (`railway-gateway/test/schema-sync.spec.ts` compares the CHECK with the model for `state_statistics_n_gate` and
  `mcd_outputs_reason_lists_not_null`). `TEXT[]` columns get no `NOT NULL` from Prisma, and adding one by hand IS drift: use a CHECK.
  A unique key over several long column names needs an explicit `map: "..."` (Postgres cuts identifiers at 63 bytes).
  To check drift on a database that holds only some tables, diff it against a subset schema (the real file's header plus its real new block).
- **Rollout order for market-data columns:** apply the migration **before** `railway-gateway`
  deploys (it auto-deploys from `main`). Its DTOs use `forbidNonWhitelisted`, and the push worker's
  400 handler quarantines a row **and stamps `synced_at`**, so rows sent to an un-migrated gateway
  are lost to automatic retry.

- **A Prisma `update` leaves an `undefined` field alone and a `null` clears it, and `state_statistics_n_gate` refuses a row left below n = 30 with a number in it** (build step 3 part 6). The writer
  (`src/sensors/state-statistics.writer.ts`) therefore sends every figure on the update path, `null` included, so a series whose history shrinks (n 35 to 12) loses its numbers instead of failing the CHECK, and it always writes
  `opposing_level_rate` as `null` (step 4 will change that). The writer never reads the table: `state-statistics.reader.ts` is the only reader, and `test/no-direct-state-statistics-reads.spec.ts` scans the code for any other
  (the Prisma delegate `stateStatistic` and `state_statistics` in SQL; DDL is the migration's business). The gated `test/sensors-state-statistics.pg.spec.ts` needs only the sensor migration applied to an empty scratch database
  (`psql -v ON_ERROR_STOP=1 -f prisma/migrations/20261003000000_add_sensor_tables/migration.sql`). The series key is built in TypeScript only (`state-statistics.series.ts`: `MAJOR.MINOR` of the evaluator, the sorted and unspaced
  JSON of `config_hash`); the Python engine treats both as opaque text. DOUBLE PRECISION returns the same JavaScript number it was given (tested), and the engine computes in exact decimals (`Decimal(repr(x))`) and converts at the end.

- **`mcd_outputs.evaluated_at` is when the worker STARTED the job, in whole seconds** (build step 3 part 7): `CycleReadyProcessor.handle` takes `nowSec` once at its start and writes it on every row, so a retried job carries the time of the attempt that succeeded and the database holds no completion time.
  The kit (`scripts/measure-sensors.js`) therefore reports "signal to start" (`evaluated_at - market_cycles.ready_at`, about a second of resolution) exactly and "signal to done" as an estimate (start plus the job's wall time, or the MCDs' summed `duration_ms`). `duration_ms` is the wall time of one MCD inside the Python process; the first MCD of a cycle (MCD0) includes the one-time build of the schema validator.
- **A plan-shape test must not ask the planner about whatever the table holds** (build step 3 part 7, `sensor-tables.pg.spec.ts`): the retention delete's use of `market_cycle_inputs_cycle_slot_idx` now takes the plan of the writer's own `DELETE` in a transaction that is always rolled back (an interactive Prisma `$transaction` rolls back when the callback throws), with the rival
  unique index `(symbol, cycle_slot)` dropped inside it (PostgreSQL 18 can scan it without naming `symbol`: a skip scan) and `SET LOCAL enable_seqscan = off`, so the plan cannot depend on statistics or on the server's version, and it leaves the table, its indexes and its statistics untouched. A separate test reads `pg_indexes.indexdef`.

- **The synthesis tables** (build step 4 part 4, migration FILE `20261004000000_add_synthesis_tables`, NOT applied): `synthesis_readings` (one row per symbol, slot and profile) and `entry_zones` (one per zone, `Z<rank>`), no foreign keys, 25 hand-written CHECKs, a gated spec `railway-gateway/test/synthesis-tables.pg.spec.ts` (55 tests; the same env vars as the sensor spec; it needs only that migration file applied to an empty scratch database).
  Facts a writer and a replay will meet: **the database re-derives the SHA-256 of the canonical texts** (`encode(sha256(convert_to(text, 'UTF8')), 'hex')`, built into PostgreSQL 11 and later, no extension) and checks that the JSONB copy is the same document as the text (`text::jsonb = copy`; key order does not matter), so a writer must hash exactly the text it stores. **A failing CHECK fails the whole `$transaction([...])`**:
  if SYN rows share the cycle's transaction with `mcd_outputs` (decision D9) one bad zone loses the sensor rows too; part 5 must run `syn-output/1`, `zone_problems` and the equivalent of every CHECK before the transaction and leave out SYN rows it cannot vouch for (a refused write rolls back both tables: tested). PostgreSQL reports the FIRST failing CHECK by constraint name (alphabetical), so a test of one constraint must break only that one.
  Prices are DOUBLE PRECISION like the rest of the schema and come back as the same JavaScript number; the two "is the distance" CHECKs use half a cent as tolerance because the stored figures are on a cent grid. `entry_zones` runway columns are all NULL for a zone with no level beyond the entry (D7 e): read that as "no obstacle found". A scratch `prisma migrate diff` against only some tables needs a subset schema: the header (generator and datasource blocks) plus the real new models, saved as `schema.prisma` beside a `prisma.config.mjs` that is just `export default { datasource: { url: '...' } };` (no imports, so it can live outside the repo).

- **The SYN rows join the sensors' transaction, and are judged first** (build step 4 part 5, `src/sensors/synthesis-rows.ts` and `synthesis.writer.ts`; Davin's option (a) for part 4's decision 3). `McdOutputsWriter.writeCycle` asks `SynthesisWriter.prepare` for the rows, then sends the sensors' three statements plus, when there is
  something to write, `synthesisReading.createMany` and `entryZone.createMany` (both `skipDuplicates`) in ONE array `$transaction`; with `SYN` off the array is exactly the three it always was. `prepare` applies the `syn-output/1` schema (Ajv, a byte-identical copy of the engine's schema: `npm run sync:syn-output-schema`), the hashes, the identity of
  slot, profile and rules, and **a TypeScript twin of each of the 25 CHECKs under the same constraint name** (`READING_CHECKS`, `ZONE_CHECKS`); a profile that fails any of it is left out whole (reading and zones) and logged as `SYN_READING_REFUSED <profile> (ENGINE|GATEWAY): ...` (an engine error as `SYN_ENGINE_ERROR`, dropped zones as
  `SYN_ZONES_DROPPED`), and the sensors' rows and the other profile are written. Three specs keep the twin honest: the names against the migration's, the constants (13, 5, half a cent, the three invalidation words) against `zone_params.yaml`, the migration and `zones.py`, and a corpus of rows each damaged one way that the gated
  `sensors-synthesis.pg.spec.ts` gives to the twin and to a real PostgreSQL (whatever the database refuses, the twin refuses first, under the same name). **Do not turn `SYN` on before the migration `20261004000000_add_synthesis_tables` is applied**: with the tables missing, every cycle's transaction fails and takes the sensors' rows with it
  (the job is retried, and then lost).
- **`context_levels` come from `market_data_v6` by one extra query per timeframe**: `contextLevelsFetcher` reads ONE row, by the open time of the bundle's own last bar, with exactly `sr_1` to `sr_16` (`findFirst`; the bars query is untouched, so the 33 bar columns and the "one read per timeframe" rule stand). A level that is NULL stays null (never 0); a non-number is a thrown error; a bar that vanished between the two reads gives no entry.
  The gated scratch database for the SYN flow needs the gateway's tables from `migrate diff` WITHOUT the five tables with CHECKs (`mcd_outputs`, `market_cycle_inputs`, `state_statistics`, `synthesis_readings`, `entry_zones`), then the two migration files applied themselves, in order.
- **The replay and the measurement kit read the SYN tables, and must survive their absence** (build step 4 part 6, `src/sensors/replay.ts`, `measure-synthesis.ts`, `measure-sensors.ts`, `table-missing.ts`): `loadStoredCycle` makes four SELECTs per slot (`market_cycle_inputs`, `mcd_outputs`, `synthesis_readings`, `entry_zones`, each with a `select`), the kit one more (`synthesis_readings`, with `reading_json`); the JSONB copies are never read. **Until the migration `20261004000000_add_synthesis_tables` is applied the two SYN tables do not exist, and both tools must still work on that database**: a failed read whose error says the table is missing (Prisma `P2021`, with `meta.driverAdapterError.cause.kind` `TableDoesNotExist` on the pg adapter, or PostgreSQL's `42P01`, or the message) is "no SYN rows" with a note, and any other error is thrown (`tableIsMissing`; tested on the real driver by renaming each table away). A replay turns `SYN` on only when the cycle has SYN rows, under the flag and rules version stored on them, so the replay of a cycle made with `SYN` off is what it always was. A new column on `synthesis_readings` or `entry_zones` needs the replay's `SYNTHESIS_COLUMNS` / `ZONE_COLUMNS` and its comparison (`ZONE_ROW_KEYS`, `compareSynthesisProfile`), and the kit's `SYNTHESIS_SAMPLE_COLUMNS`; the specs fail until they agree. There is no foreign key, so `entry_zones` rows can outlive their reading row: the replay reports them (STORED_READING_CORRUPT).
- **`economic_events` is append-only and written ON CHANGE, so "newest per `value_id`" needs the right query shape** (build step 5 part 3, `lib/engine4/read/events.ts`). (1) The gateway stores a row only when a release changed, so the newest `captured_at` is the time of the last CHANGE, not of the last export; a quiet calendar ages without any export fault. (2) Filtering rows by `event_time` and THEN taking the newest of what is left (Prisma `findMany` with `distinct`, as `lib/economic-events/queries.ts` does) can return a stale observation of a release that was rescheduled out of the window. For a safety decision, first find the `value_id`s with any observation in the window, then read ALL their observations and keep the newest of each. (3) `event_time` and `captured_at` are Prisma `Int` (32-bit): a query bound beyond 2147483647 (January 2038) is refused by the driver.

- **The Engine 4 tables** (build step 5 part 5, migration FILE `20261010000000_add_engine4_tables`, NOT applied; models in `prisma/non-market-data/schema.prisma`, the migration lives in `prisma/migrations/` like every other one): `user_trade_preferences` (the CURRENT profile, one row per user), `user_trade_preferences_history` (append-only snapshots) and `trade_consent_records` (one append-only row per Accept, Modify, Decline), 32 hand-written CHECKs, one trigger function with four triggers, a gated spec `__tests__/engine4/engine4-tables.pg.spec.ts` (181 tests).
  **Deleting a `User` row:** the current profile is DELETED (`ON DELETE CASCADE`: personal data, no hash); the history and consent rows keep every column and get `user_id` NULL (`ON DELETE SET NULL`). `user_id_hash` (HMAC-SHA-256 of the id, written on insert by `lib/engine4/store/user-hash.ts`) and `key_version` stay, so an old row is recognised with the key of its own version only (D12: a rotation never recomputes an old hash). Nothing cascades into an audit table; a test fails if one does.
  **The trigger** (`engine4_audit_append_only`) refuses UPDATE, DELETE and TRUNCATE of the two audit tables with `restrict_violation` (23001), except one UPDATE: `user_id` from a value to NULL with every other column equal, which is what the `SET NULL` action is. So a hand-written `UPDATE ... SET user_id = NULL` also works, a row can never get an owner back, and **a `User.id` cannot be changed while audit rows name it** (`ON UPDATE CASCADE` would have to rewrite them; ids are cuids). A cleanup of a scratch database must switch the triggers off (`ALTER TABLE ... DISABLE TRIGGER USER`, then ENABLE) or drop the database; `DROP TABLE` is not stopped by a trigger, and that is the rollback.
  Facts a writer and a test will meet: **`ON DELETE RESTRICT` raises 23001, `NO ACTION` raises 23503**; **`TRUNCATE` of the history table alone is refused by PostgreSQL itself (0A000, a foreign key points at it) before any trigger runs**: the `*_no_truncate` triggers are the wall for `TRUNCATE ... CASCADE` and multi-table truncates (tested one at a time with the other switched off); PostgreSQL reports the FIRST failing CHECK by constraint name, so a test of one constraint must break only that one (a side `LONG` also differs from the setup's `BUY`: the test gives the setup the same `LONG`). The eight profile figures are canonical decimal TEXT (the engine's own text; a `NUMERIC(p,s)` would round a trader's number silently), so every bound is a `CASE WHEN <decimal text rule> THEN "x"::numeric ... ELSE TRUE END`: a cast never raises another error and each constraint fails for its own rule only. The consent record keeps the `ValidatedSetup` as the exact text that was hashed; the database re-derives the SHA-256 and checks the JSONB copy, and the three filter columns (`cycle_slot`, `side`, `zone_id`) must equal the setup's own values.
  **Running the gated spec:** the database must hold the non-market schema as it was BEFORE this migration (`prisma migrate diff --from-empty --to-schema <schema at the commit before part 5> --script`, from a scratch config that has a `schema` entry) plus the migration file itself, and nothing else, or the drift test sees extra tables. `CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest --testMatch '**/__tests__/engine4/*.pg.spec.ts' --coverage=false` (the root Jest only collects `*.test.ts`, and `--runTestsByPath` finds nothing on Windows). Without the two variables it is skipped. The drift test shells out to `prisma migrate diff --exit-code` (0 = none, 2 = drift) and has a control that adds a column by hand.
  **Before applying:** `prisma migrate status` first (steps 2, 3 and 4 may still be pending; this migration needs none of them), provision `ENGINE4_AUDIT_HMAC_KEY` (at least 32 characters) and `ENGINE4_AUDIT_HMAC_KEY_VERSION` in Vercel (the stores refuse to write without a key; only `NODE_ENV=test` falls back to a public test key), and apply with `prisma db execute --file ...` then `prisma migrate resolve --applied 20261010000000_add_engine4_tables`.
- **The Engine 4 routes and what they read** (build step 5 part 6, `app/api/engine4/{profile,offer,size,consent}`, off unless `ENGINE4_REPORT2_ENABLED=true`): `market_data_v6.timestamp` is a bar's OPEN time (a closed M5 bar opened at or before `now - 300`; `lib/engine4/read/bars.ts` asks for the 24 hours up to that and `dayRange` applies the same edges again); `synthesis_readings.reading_json` must hash to `reading_sha256` and its `inputs.MCDn.envelope_sha256` and `inputs_sha256` are what `readStructureLevels` is held to (`read/synthesis.ts`); the consent route needs `ENGINE4_AUDIT_HMAC_KEY` and answers 503 without it.
  **One submit, one record is a Redis guard, not a database one:** `trade_consent_records` has no `submission_id` column, so `lib/engine4/server/idempotency.ts` (`SET NX`, the answer kept a day, an id bound to a fingerprint of the request) fails OPEN like `lib/idempotency` when Redis is down, and then two racing presses of one setup write two identical rows (same `setup_sha256`, same action, seconds apart). A guarantee is a `submission_id` column with a unique index on (`user_id_hash`, `submission_id`): a change to the unapplied part 5 migration, Davin's call.
  **Running both gated specs on one scratch database:** `engine4-tables.pg.spec.ts` and `engine4-routes.pg.spec.ts` both wipe the three tables, so run them one after the other (`npx jest -i --testMatch '**/__tests__/engine4/*.pg.spec.ts' --coverage=false`); in parallel 4 of the 181 tables tests fail on rows the other spec deleted. The routes spec creates users `e4-routes-*@example.test` and mocks the session, Redis, the gateway and the market readers (the scratch database has the user schema only).

- **The reply path tables** (build step 7 part 1, migration FILE `20261014000000_add_reply_trace_and_chat_tables`, NOT applied; models in `prisma/non-market-data/schema.prisma`, stores in `lib/platform/`): `request_traces` (one row per answer, written once at the end; the 7-year audit row), `chat_threads` and `chat_messages` (a transcript, 12 months, deletable), 51 hand-written CHECKs, one trigger function with two triggers, a gated spec `__tests__/reply/reply-trace-chat.pg.spec.ts` (121 tests).
  **Deleting a `User`:** the threads are DELETED (`ON DELETE CASCADE`) and their messages with them; the trace rows stay, `user_id` NULL (`ON DELETE SET NULL`), with `user_id_hash` and `key_version` (the Engine 4 key and versions, `ENGINE4_AUDIT_HMAC_KEY`) and every other column unchanged. `request_traces.thread_id` has NO foreign key on purpose: deleting a thread leaves the traces. No raw user id may sit inside a JSONB group or a report (a CHECK, `groups_hold_no_user_id`; use test user ids as long as a cuid or a short one that occurs in a report is refused too).
  **The guard** (`request_traces_guard`, restrict_violation 23001): DELETE refused unless `archived_at IS NOT NULL` (no archive exists yet, so nothing can be deleted yet: decision D17); UPDATE refused unless only `user_id` (a value to NULL, never back), `risk_group`, `report2_json`, `report2_sha256`, `consent_action`, `archived_at` and `archive_ref` change, and an archived row is frozen but for `user_id`; TRUNCATE refused. A cleanup of a scratch database switches the triggers off (`ALTER TABLE "request_traces" DISABLE TRIGGER USER`, then ENABLE), as the spec does. A `User.id` cannot change while traces name it (the cascade would be an UPDATE of a sealed column).
  **A CHECK passes when its expression is NULL**, so a rule that compares a column with a JSONB key (`"tier" = ("request_group"->>'tier')`) would pass when the key is missing: every "follows" rule uses `IS NOT DISTINCT FROM` (`migration-sync.test.ts` fails on a bare `=`, the spec removes a key and expects a refusal). The filter columns (tier, locale, intent, cycle slot, data status, model, units, regenerations, violation counts, total time) are projections of the seven groups and are checked equal to them. PostgreSQL still reports the FIRST failing CHECK by name, so a test of one constraint must break only that one (a USER message of kind REPORT1 breaks two).
  **A `Json?` column is set to NULL by leaving the field out** (a JavaScript `null` is a Prisma error): `TraceCreateData.risk_group` is optional, never null. `prisma generate` for the non-market client (`npm run prisma:generate:non-market-data`) must run after the models change or `tsc` does not see `requestTrace`, `chatThread`, `chatMessage`.
  **Before applying:** `prisma migrate status` first (steps 2 to 5 may still be pending; this migration needs only `"User"`), provision `ENGINE4_AUDIT_HMAC_KEY` and its version in Vercel (the trace writer throws `AuditKeyError` without it), apply with `prisma db execute --file ...` then `prisma migrate resolve --applied 20261014000000_add_reply_trace_and_chat_tables`. **Running the gated spec:** the database must hold the non-market schema as it was BEFORE this migration (`prisma migrate diff --config <scratch config outside the repo> --from-empty --to-schema <schema at the commit before part 1> --script`) plus the migration file itself, nothing else (the drift test); `CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest --testMatch '**/__tests__/reply/*.pg.spec.ts' --coverage=false`.

## Ledger ≠ reality (zero-step baseline rows)

Five `_prisma_migrations` rows in production have `applied_steps_count = 0` (marked applied
without executing, Session 2-3 baselining): `20251227000000_init`,
`20260214000000_rag_dual_memory`, `20260224000000_update_kc_ha_body_columns`,
`20260705000000_add_market_data_v6`, `20260705010000_drop_market_data`. **Check each one's
physical objects instead of trusting the row.**

- `rag_dual_memory`'s 6 tables (`mt5_accounts`, `upload_history`, `jsonl_sessions`,
  `behavioral_drift`, `advice_outcomes`, `compliance_audit`) **do not exist**. When Stack D needs
  them: `prisma db execute --file prisma/migrations/20260214000000_rag_dual_memory/migration.sql`
  against production. Do **not** run `migrate resolve` on it again.
- `market_data_v6` was the same trap; it was created by hand on 2026-09-09.

## `db push` drift (schema ahead of migration history)

At least four features were applied with `db push`/manual SQL and never captured in a migration
(`User.profile`, `MarketingAsset` + its enums, 7 tables/2 enums/4 `User` 2FA columns later
backfilled by `20260904110000_backfill_untracked_tables`, and `market_data_v6`). `migrate status`
cannot see this class — it compares only against tracked history. Diff the live schema against
`schema.prisma` directly. The backfill migration is dated before already-applied ones, so
production lists it as pending; applying it is a no-op that records history.

## Credentials

Rotation procedure and its gotchas: `docs/runbooks/rotate-postgres-credentials.md`. Railway
services do not restart when a referenced variable changes — redeploy them.

## The intake readers' real-database spec (build step 6 part 4)

`__tests__/intake/intake-readers.pg.spec.ts` runs the snapshot reader (`lib/intake/read/snapshot.ts`) and the events reader (`lib/intake/read/events.ts`) on a real PostgreSQL with the real generated market client. The database needs only FOUR migration files, applied themselves, in this order, to an empty scratch database on the scratch cluster of the recipe above (no `migrate diff`, which has no CHECK constraints): `20260910120000_add_economic_events`, `20261002000000_add_cycle_pipeline_tables`, `20261003000000_add_sensor_tables`, `20261004000000_add_synthesis_tables` (`psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/<name>/migration.sql`; none has a foreign key). Run: `CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes npx jest --testMatch '**/__tests__/intake/intake-readers.pg.spec.ts' --coverage=false`; it deletes every row of `entry_zones`, `synthesis_readings`, `mcd_outputs`, `market_cycles` and `economic_events`. Without the two variables it is skipped (23 tests). Three facts it showed:

- **The unique key `(symbol, cycle_slot, mcd_id)` leaves room for ONE row per sensor and cycle, whatever its `flag`**: a `shadow` row and a `live` row of one sensor cannot both exist, so a query for `flag = 'live'` can never be hiding a live row behind a shadow one; the same holds for `(symbol, cycle_slot, profile)` of `synthesis_readings`. A sensor that ran in shadow at a slot simply has no live row there, and the board lists it as ABSENT when the configuration says it should be live.
- **No CHECK covers `mcd_outputs.envelope_sha256`**: the table accepts an envelope whose text does not hash to its stored hash (the `synthesis_readings` CHECKs re-derive both of theirs and refuse). The reader therefore hashes every envelope text itself and lists a sensor whose row fails as ABSENT with a `ROW_UNREADABLE` problem. The `entry_zones` rows can be edited to disagree with the stored `zones_json` within their CHECKs, so the reader compares them and drops the whole reading (`ZONES_MISMATCH`).
- **`pg_indexes` lists the primary key as a UNIQUE INDEX too**: filter `indexname NOT LIKE '%pkey'` when asserting the unique keys.

**`market_data_v6` and the prompt's day of bars** (build step 7 part 2, `lib/reply/read/day-bars.ts`, gated spec `__tests__/reply/day-bars.pg.spec.ts`, 13 tests on PostgreSQL 18.1):

- **A row of `market_data_v6` needs `cycle_id` and `collected_at` besides the OHLC columns** (both NOT NULL, no default): a test insert through the Prisma client without them stops with "Argument `cycle_id` is missing". The unique key `(symbol, timeframe, timestamp)` leaves room for ONE row per bar whatever terminal wrote it (`terminal_id` is not in the key), so a reader never has to choose between two rows of one bar.
- **`timestamp` is a bar's OPEN time (INTEGER, unix seconds); a bar is closed at a slot when `timestamp + period <= slot`.** Both of the reader's queries use the unique index (`EXPLAIN` on 50,000 rows: an Index Only Scan Backward for the newest closable bar, an Index Scan for the window).

- **`ProcessedWebhookEvent` and the two `Commission` unique indexes** (Remediation Tier 2 6.1, migration FILE `20261016000000_add_processed_webhook_events_and_commission_uniqueness`, NOT applied;
  models in `prisma/non-market-data/schema.prisma` and mirrored by hand in `money-service/prisma/schema.prisma`): `Commission` is unique on `(affiliateCodeId, stripeInvoiceId)` and on `clawbackOfCommissionId`
  (NULL never conflicts, so dLocal rows, legacy rows and clawback rows are untouched), and the webhook claim table is keyed `(provider, eventId)` with `completedAt` and a 10-minute lease.
  **Run the two pre-flight queries in the migration header against production first: a duplicate pair is a real double credit and makes the index fail to build** (as one transaction, so nothing changes).
  Facts the real server showed: (1) Prisma prints a `prisma:error` block for every expected unique violation, so a claim that is expected to collide uses `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`, a count of 0)
  and the credit path, which must be a `create` inside a transaction, catches `P2002` (the code arrives intact through the pg adapter, also inside an interactive `$transaction`, which rolls back whole);
  (2) `createdAt` is `TIMESTAMP(3)` WITHOUT time zone, so a lease cutoff computed in JavaScript (UTC) only matches if the row's `createdAt` was written by the same process: the service writes it, not the column default; a raw SQL
  seed must use `now() at time zone 'utc'` (this machine's PostgreSQL session is Asia/Bangkok, UTC+7). The scripts and seeds are in `docs/handoffs/2026-10-16-nestjs-tier0-tier2-proofs/`.
- **`OutboxEvent` has no `updatedAt`**: the publisher stores the time a row was claimed in `processedAt` while it is `PROCESSING` (set on the claim, replaced by the completion time on success, cleared on a failed attempt) and recovers rows
  older than 5 minutes (30 minutes for rows from before the claim time existed). Nothing else reads `processedAt` of a `PROCESSING` row (the admin page only counts statuses).
