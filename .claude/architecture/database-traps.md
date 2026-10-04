---
type: Concept/TechnicalTraps
severity: high
updated_at: 2026-10-04
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
