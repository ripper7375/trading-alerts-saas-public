---
type: Concept/SessionHistory
status: archived
period: 2026-10-01..2026-10-31
source: .claude/state/current-state.md (rotated entries)
tags: [history, sessions, 2026-10]
---

# Session history — October 2026

Entries rotated out of `current-state.md` by [session-lifecycle](../../protocols/session-lifecycle.md), verbatim, newest first (only the relative link prefixes are adjusted for this folder's depth).

Back to [history index](./index.md).

<!-- session 2026-10-03 step3-part6 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 6 of 7: `state_statistics` and the n >= 30 gate. The Python engine `mcd_worker/statistics/` (`outcomes.py`: the forward move and the adverse excursion of one occurrence at 2 h or 12 h with
> Davin's Q9 (b) arithmetic, in exact decimals, an outcome only when every M5 bar of the window exists; `aggregate.py`: `n`, median and quartiles, **no figure below 30 outcomes**, series by MCD, evaluator `MAJOR.MINOR`, `config_hash` text, state and horizon), and in `railway-gateway/src/sensors/`
> `state-statistics.series.ts` (the key and the row check), `.writer.ts` (an upsert per series in one transaction, `FORMING_BAR_FIT: UNVERIFIED` on every row, explicit nulls, never reads) and `.reader.ts` (**the only reader**: `MEASURED` from 30 with its n, `PROVISIONAL` words below 30), and
> `test/no-direct-state-statistics-reads.spec.ts` (no other file reads or writes the table, 13 roots, TypeScript, JavaScript, Python and SQL). Also recorded Davin's part 5 decisions (all as built) and his Q9 (b) answers. Built on synthetic histories and a scratch PostgreSQL 18.0
> (stopped, data directory deleted); nothing deployed, migrated or committed; no existing source file changed (edits only to the Python mutation tool's lists, one folder pin and the worker README).**
> **Needs from Davin (none blocks part 7):** (1) an outcome needs EVERY M5 bar of the window, a closure leaves the occurrence out of n instead of stretching the window: keep, or require only the two end bars; (2) **n counts cycles, not episodes**: 30 consecutive 5-minute cycles in one state are one 2.5-hour episode with
> overlapping windows; keep ADR-022 as written or count an episode once (a new ADR), before B4; (3) which readings count as occurrences (every channel MCD is CAUTIONARY on the three real fixtures), before B4; (4) record the arithmetic in architecture section 2.8 (I did not edit it);
> (5) the smaller builder's calls in hand-off section 6; then "build step 3, part 7", and commit and push when he decides.
> Hand-off: [part 6](../../../docs/handoffs/2026-10-03-1000-step3-part6.md). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new `mcd_worker/statistics/` (three files), `tests/test_statistics_{outcomes,aggregate,boundaries}.py` and `tests/data/state-statistics.rows.json`; `railway-gateway/src/sensors/state-statistics.{series,writer,reader}.ts`, four unit specs, the gated `sensors-state-statistics.pg.spec.ts`, two helpers;
> `mutation_check.py`, `test_boundaries.py` and the README edited. `mcd_worker` **420** tests (was 310), kit 215, MCD0 to MCD3 124 / 113 / 102 / 134 unchanged; gateway `tsc` clean, `npm test` **51 suites / 1,828 pass** (was 47 / 1,582: +246), 8 suites / 169 skipped, `test:e2e` 7 / 139; **gated specs on PostgreSQL 18.0: 143 of 143 together (replay 22, worker 20, part 2's 33, part 3's 32, part 6's 36)** (the new one 36 of 36: the CHECK refuses n = 29 with each of the six columns and accepts 30, the writer, the reader);
> `prettier --check` clean. **Mutation checks: Python 97 of 97 killed, also without the golden test; TypeScript 131 of 133 killed, 2 equivalent (T16, W11), after eight test gaps were closed; database CHECK 5 of 5 killed.** Three figures recomputed independently with `Fraction` and the standard library's quartiles: equal.
> **Unconfirmed / found:** `abs` in the NEUTRAL excursion is redundant (an equivalent mutant: `a + b = high - low >= 0`); the folder `statistics` shadows the standard library's if Python runs from inside `mcd_worker/`; a Prisma `update` ignores `undefined`, so the writer sends explicit nulls; five gateway specs need the whole checkout; the earlier 129 runner mutants were not re-run;
> nothing ran against production, staging, Redis or a deployed gateway; the effect of closures on n and the real outcomes need B4; there is no command that runs the engine from TypeScript yet (part 7 or B4); the reader and the writer are in no Nest module (no caller yet); `mcd-shadow-*` folders (129) still sit in `%TEMP%`.
> The oldest entry (step 3 part 4) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-03 step3-part5 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 5 of 7: replay and determinism, `railway-gateway/src/sensors/replay.ts` and `scripts/replay-cycle.js` (a stored cycle is run again from its stored bundle,
> with the flags and the RETUNING enforcement stored on its rows, and every envelope is compared with the stored one, text and SHA-256, byte for byte; each cycle ends in `VERIFIED`, `TAMPERED_BUNDLE`, `VERSION_MISMATCH` or `LOGIC_DIVERGENCE`, plus `STORED_READING_CORRUPT` and `NOT_REPLAYABLE` with a cause; a tampered bundle is found before Python runs;
> `--fixtures` replays v1, v3 and v4 in one command; READ ONLY). Also recorded Davin's part 4 decisions (all as built; the engine reaches the Railway image through `sync-sensor-kit.js` at B0, option (a)). Built on fixtures, a fake runner and a scratch PostgreSQL 18.0 (stopped, data directory deleted);
> nothing deployed, migrated or committed; no existing source file changed.**
> **Needs from Davin (none blocks part 6):** (1) the two verdicts added to your four (`STORED_READING_CORRUPT`, `NOT_REPLAYABLE`): keep, or fold; (2) a tampered bundle ends the replay before Python runs: keep, or run anyway; (3) the stored text is sent back through JavaScript's parse and stringify (a fixed point for what the worker stores, shown): keep, or splice the raw text
> (an edit to `python-runner.ts`); (4) flags come from the stored rows through a temporary configuration: keep, or a `--flags` option in `mcd_worker.cli`; (5) fixtures cannot be checked as text (their files are not canonical text): keep, or store canonical copies; (6) `--db` has no host guard (it only reads): whether and when it runs on production (B1, B4);
> (7) part 4's items 9 and 10 stay as built; **before part 6: the reference price for forward moves and the spread statistic (plan Q9 b)**; then "build step 3, part 6", and commit and push when he decides.
> Hand-off: [part 5](../../../docs/handoffs/2026-10-03-0830-step3-part5.md). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new `railway-gateway/src/sensors/replay.ts` (1,244 lines), `scripts/replay-cycle.js` (plain JavaScript, 70 lines), `test/sensors-replay.spec.ts` (137 tests), `test/sensors-replay-details.spec.ts` (44), gated `test/sensors-replay.pg.spec.ts` (22), `test/helpers/replay-world.ts`; no existing source file, kit file, evaluator, schema, migration or `package.json` changed.
> Gateway `tsc` clean, `npm test` **47 suites / 1,582 pass** (was 45 / 1,401: +181), 7 suites / 133 skipped, `test:e2e` 7 / 139; **the four gated specs pass 107 of 107 on PostgreSQL 18.0** (replay 22, worker 20, part 2's 33, part 3's 32); `node scripts/replay-cycle.js --fixtures`: v1, v3 and v4 VERIFIED (about 1 s each);
> kit 215 and `mcd_worker` 310 unchanged (Python untouched); `prettier --check` clean. **Mutation check: 181 mutants, 179 killed by a test, 2 equivalent (C8, W4), none alive** (33 did not compile and were re-run as `@ts-nocheck` variants: 31 killed; three real test gaps and one dead field found and closed).
> **Unconfirmed / found:** JavaScript's round trip is a fixed point for the stored text (three bundles and exotic numbers), but a text holding an integral float like `5.0`, which only a sender other than the worker writes, would be reported as a divergence; the fixture `.bundle.json` files are not canonical text (their SHA-256 is not `inputs_sha256`);
> `kit-runner.ts` leaves a `mcd-shadow-*` folder per Jest process in `%TEMP%` (129 older ones remain); Python's `write_text` writes CRLF on Windows (two files normalised); root `type-check` and `test:ci` not re-run (the root `tsconfig` excludes the gateway and no root file changed); nothing ran against production, the Railway image or a real Redis; live replay time is B1 and B4.
> The oldest entry (step 3 part 3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-03 step3-part4 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 4 of 7: the sensor worker, `railway-gateway/src/sensors/` (a dynamic module that registers nothing unless
> `SENSOR_WORKER_ENABLED` is exactly `true`; the `cycle-ready` consumer: skip and record a job older than 10 minutes (Q11), retry on `CYCLE_NOT_READY` through Bull's back-off and write STALE readings on the last attempt, STALE at once on `INVALID_CYCLE_ROW`; the Python runner bridge;
> the Ajv check of every envelope; ONE transaction per cycle for the `mcd_outputs` rows, the stored bundle and the 90-day cleanup of older bundles), and, in Python, `bundle_canonical_json` in the runner's result (Davin's part 3 decision 3, option a). Also closed part 3: the T8 test,
> the hand-off placeholders, the state files. Built on fixtures, a fake queue and a scratch PostgreSQL 18.0 (stopped; both data directories deleted); nothing deployed, migrated or committed. The one edit to a production source file: `app.module.ts` imports the module (empty while off).**
> **Needs from Davin (none blocks part 5):** (1) a skipped job is recorded in the job's return value and a log line, not a table: keep, or a table (a migration); (2) a cycle that cannot be loaded gets STALE readings with the kit's `DATA_STALE`: keep, or a reason code of its own (a MINOR kit change);
> (3) every MCD off writes nothing, not even a bundle; (4) the retry window is 2 s then 6 s (Bull's `(2^n - 1) x delay`), then STALE, and a READY row that appears later is never evaluated; (5) confirm the three edits to existing files (`app.module.ts`, a script in `package.json`, `.env.example`);
> (6) how the engine reaches the Railway image at B0 (the plan's `sync-sensor-kit.js` is not built); (7) Ajv `strictTypes` is off for the kit's schema, or a PATCH to the schema; (8) `runner_version` stays 1.0.0; (9) part 2's index-use test depends on planner statistics; (10) part 3's decision 6 is still unanswered;
> then "build step 3, part 5" (replay and determinism), and commit and push when he decides.
> Hand-off: [part 4](../../../docs/handoffs/2026-10-03-0548-step3-part4.md). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new `railway-gateway/src/sensors/` (eight files and the schema copy), `scripts/sync-mcd-output-schema.js`, eight unit specs, one gated spec and two helpers under `railway-gateway/test/`; `app.module.ts` (+6 lines), `package.json` (+1 script), `.env.example` (+12 lines);
> `mcd_worker/cycle_runner.py`, `cli.py`, README, three test files and the mutation tool. Gateway `tsc` clean, `npm test` **45 suites / 1,401 pass** (was 37 / 1,160: +241), 6 suites / 111 skipped, `test:e2e` 7 / 139; **the three gated specs pass 85 of 85 on PostgreSQL 18.0** (worker 20, part 2's 33, part 3's 32);
> kit 215, `mcd_worker` **310** (was 298), MCD0 to MCD3 124 / 113 / 102 / 134 unchanged; root type-check exit 0, `test:ci` 257 / 3,453; `prettier --check` clean. **Mutation check: TypeScript 93 of 95 killed by a test, 2 equivalent (P8, Y22); Python 128 of 128.** Part 3's: 92 of 94, 2 equivalent.
> **Unconfirmed / found:** Bull's exponential back-off is `(2^n - 1) x delay` (2 s then 6 s, not 2 s and 4 s); no real Redis ran (the retry rule is shown on a fake queue that follows Bull's source and the explorer's registration in a real Nest graph with a fake queue); Ajv's `strictTypes` refuses the kit's schema;
> part 2's index-use test failed on a table that had held rows (planner statistics), not an index defect (a 26,000-row probe uses `cycle_slot_idx`); `npm run lint` in `railway-gateway/` finds no files (it was so before); nothing ran against production, the Railway image or PgBouncer; live latency is B2; the part 3 session left its scratch data directory on disk (deleted now).
> The oldest entry (step 3 part 2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-03 step3-part3 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 3 of 7, closed: the cycle inputs loader, `railway-gateway/src/sensors/inputs/` (one interface, a fixture source and a
> database source: closed bars only, the whole closed channel (ADR-083), statistics at the slot, the setting at the slot, RETUNING and the tuning from the READY `market_cycles` row, the Q13 refusal), with its specs. Built on fixtures and on a scratch
> PostgreSQL 18.0 (stopped), not on staging or production. Nothing deployed, migrated or committed; no existing source file changed.**
> **Davin's answers (2026-10-03):** (1) the bundle carries what the evaluators read (the last closed bar of each timeframe all 33 candidate columns, every other bar the open time, the close and the active indicator's channel): approved as built; (2) the M15 cover rule stays;
> (3) **option (a): the runner returns `bundle_canonical_json` and the worker stores that exact Python text in `market_cycle_inputs.bundle_gz`** (JavaScript and Python write floats differently); (4) Q13 confirmed as built; (5) the `closed_bars_digest` check is deferred to Phase B's live measurement.
> Decision 6 (M15 left out and STALE when the cycle that collected it is not READY) was not answered: it stays as built.
> Hand-off: [part 3](../../../docs/handoffs/2026-10-03-0215-step3-part3.md). The wrap-up session added three tests for the one real mutation survivor and filled the hand-off; the earlier `active-tasks.md` was deleted.
> **Changed & verified:** new `railway-gateway/src/sensors/inputs/` (nine files), nine specs and four helpers under `railway-gateway/test/`; no existing source file changed. Gateway `tsc` clean, `npm test` **37 suites / 1,157 pass** when part 3 closed (was 29 / 872; 288 new in the unit run, including 3 order tests added in the wrap-up),
> **1,160 pass** after them, 5 suites / 91 skipped (the gated Postgres spec adds 32), `test:e2e` 7 suites / 139 pass; **the gated spec on PostgreSQL 18.0 passes 32 of 32** (the real Prisma client, the real `ActiveIndicatorService`, the real `python -m mcd_worker.cli`; ADR-083 boundaries 49, 48, 47, 288 and 289 rows,
> `N_micro` 96 and 95; rules 2, 5, 6 and 9; Q13 gives INVALID + SANITY_FAILED for all four MCDs). Kit 215, `mcd_worker` 298, MCD0 to MCD3 124 / 113 / 102 / 134 unchanged; root type-check exit 0, test:ci 257 suites / 3,453 pass (the recorded baseline); `prettier --check` clean. Mutation check of the new TypeScript: 92 of 94 mutants killed by a test, 2 equivalent (S3, D2), none alive.
> **Unconfirmed / found:** `python -m mcd_worker.cli` runs nothing with the committed config (every flag is `off`; specs pass `--config`); the same statistics source is recorded under two `config_hash` values on M5 and M15 in real data (`sr_levels`, v3 and v4);
> the bundle footprint at the replicas' channel lengths is about 2.7 GB for 90 days by arithmetic on fixtures (not a live measurement; approved: 1.1 to 1.7 GB); nothing ran against production, the Railway image or a deployed gateway; the scratch server is PostgreSQL 18.0, production's version is not known to me; Python in the Railway image is still B0.
> The oldest entry (step 3 part 1) was rotated into `history/2026-10-sessions.md`; part 2's D1 to D6 are in `history/resolved-waiting-on.md`.

<!-- session 2026-10-03 step3-part2 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 2 of 7: the sensor tables as Prisma models (monolith schema and gateway mirror), type stubs and a migration FILE,
> `20261003000000_add_sensor_tables`: `mcd_outputs`, `market_cycle_inputs`, `state_statistics`, plus three CHECK constraints. NOT applied to any database, nothing deployed, migrated or committed. Verified on a scratch PostgreSQL 18.0 server (started from the installed binaries, now stopped and deleted), not on staging or production.**
> **Needs from Davin (D1 to D6 only edit the unapplied file, so they can wait; D3 before part 4):** (D1) confirm the shapes: `cycle_slot` as unix Int, snake_case `created_at`, `config_hash_key` as the canonical JSON text of the envelope's `config_hash`, the extra columns (`inherited_reasons`, `guard_problems`, runner and Python version,
> `bundle_encoding`, `bundle_bytes`); (D2) keep the JSONB copy of the envelope (1.24 of 3.1 KB per row)?; (D3) **retention for `mcd_outputs` is undecided** (about 1.4 GB a year at four MCDs) and **nothing in the plan owns the 90-day bundle `DELETE`** (recommend part 4); (D4) the six measured columns, `opposing_level_rate` stays NULL until step 4;
> (D5) append-only by key and no `updated_at`, not by trigger; (D6) two CHECKs beyond the n >= 30 gate you asked for (`flag` is shadow or live; the two reason lists are never NULL); then "build step 3, part 3" (the cycle inputs loader), and commit and push when he decides.
> Hand-off: [part 2](../../../docs/handoffs/2026-10-03-0050-step3-part2.md). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `prisma/market-data/schema.prisma` and `railway-gateway/prisma/schema.prisma` (+172 lines each, the block byte-identical; `prisma validate` and `format` clean), `prisma/migrations/20261003000000_add_sensor_tables/migration.sql` (new, Prisma's DDL verbatim plus the CHECKs), `types/prisma-stubs.d.ts` (+65),
> `railway-gateway/test/schema-sync.spec.ts` (56 to **92** tests), `railway-gateway/test/sensor-tables.pg.spec.ts` (new, gated, **33** tests); the diff of the existing files is additions only. On the scratch server: the file applies; `prisma migrate diff` from that database to the schema is **empty, exit 0** (negative control exit 2); an independent `--from-empty`
> derivation gives the same 7 statements; n = 29 with any measured column is refused (23514), n = 30 accepted; the three unique keys, `flag` `off` and NULL reason lists behave (33 of 33 through the real Prisma client, twice). **Mutation check 21 of 21** (the one first-pass survivor, a stub field's type, led to a type test).
> Gateway `tsc` clean, `npm test` **29 suites / 872 pass** (4 suites / 59 skipped), `test:e2e` 7 / 139; root `type-check` and eslint clean, **`test:ci` 257 suites / 3,453 tests pass** (the recorded baseline); `prettier --check` clean.
> **Unconfirmed / found:** Prisma's `migrate diff` cannot see CHECK constraints (two tests compare them with the model) and leaves `TEXT[]` nullable; `retuning_enforced` is not stored (recoverable from observed and applied); measured storage per cycle is 56 to 82 KB (bundles 44 to 69 KB stored, `mcd_outputs` about 3.2 KB a row), 1.1 to 1.8 GB for 90 days of bundles
> (confirms the part 1 estimate); nothing ran against production, the Railway image or a deployed gateway; the scratch server is PostgreSQL 18.0, production's version is not known to me; Docker's engine is still not running. Two tool traps (`pg_ctl start` through a tool pipe, shell cwd drift) are in `environment-gotchas.md`.
> The oldest entry (step 2 session B check and commit) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-03 step3-part1 -->

> **Ad-hoc session (2026-10-03, phase/session unchanged), `main`, NOT committed (HEAD `510c9e21`). Build step 3 (chapter 2, Sensors), session A, part 1 of 7: the Python cycle runner `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/`
> (registry loader and execution order, MCD0 inheritance, upstream wiring, the RETUNING switch off by default, flags and checklists, output guards, a stdin/stdout CLI) with cycle fixtures for v1, v3 and v4. Built on fixtures: no TypeScript,
> no database, nothing deployed, migrated or committed; `mcd_common/` and the four evaluators are untouched.**
> **Needs from Davin:** (1) read Q5 b: I took "only a VALID MCD0 defect propagates" literally, so a CAUTIONARY MCD0 (only possible while RETUNING is enforced) marks nobody; (2) keep or drop my two extra flag rules (no MCD above an MCD it reads,
> no channel MCD above MCD0); (3) a guard failure is saved as INVALID with `EVALUATOR_ERROR`, no new reason code; (4) whether a gate needs checklist items 7 and 8 (dispatch matrix, synthesis rows), or MCD0 can never go `live`;
> (5) whether per-MCD rollback may be a deploy (flags live in the committed `worker_config.yaml`); (6) "build step 3, part 2" (schema, migration file only), and commit and push when he decides.
> Hand-off: [part 1](../../../docs/handoffs/2026-10-02-2359-step3-part1.md). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new package `mcd_worker/` (`registry.py`, `flags.py`, `inheritance.py`, `guards.py`, `cycle_runner.py`, `cli.py`, `worker_config.yaml`, `checklists/MCD0..3.yaml`, README, fixtures, tools);
> `python -B -m unittest discover -s mcd_worker/tests -t .` **298 OK**; the kit **215** and MCD0 to MCD3 **124 / 113 / 102 / 134 (1 skipped)** unchanged; mutation check **122 of 122** (scratch copies only; the checkout proved unchanged by SHA-256);
> `prettier --check` clean; every evaluator reading on v1, v3 and v4 reproduced byte for byte (MCD3 modulo status and reasons, because it reads marked upstream, Q5 a). All four flags are `off`; items 1 to 6 of every checklist are passed, 7 to 9 pending.
> **Unconfirmed / found:** MCD0 calls both timeframes defective on all three real cycles, so every channel MCD is CAUTIONARY on each (MCD3 with four reasons): what B3 must watch; the shared bundle is 0.54 to 1.17 MB of JSON and 41 to 66 KB gzipped
> (about 1.1 to 1.7 GB for 90 days of cycles, an estimate from replicas); one cold CLI cycle takes about 0.9 s on this laptop (0.25 s of it the first-call schema compile), not on the Railway image; nothing ran against production, the VPS or a deployed gateway; Python in the Railway image is still B0.
> The oldest entry (step 2 part 10) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-session-b-and-commit -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, HEAD `8bc80b6c` when it began. Build step 2 (chapter 1): session B's open items recorded, the asterisk damage in architecture §3.4 fixed, and build
> step 2 committed locally (Davin approved the commit) in seven commits by area: Prisma migration, Stack C and VPS, MQL5, gateway, monolith, Stack C documents, docs and state (in that order: each commit builds on the ones before it). NOT pushed, NOT deployed, the part 2 migration NOT applied (it is a file only).**
> Session B ([check](../../../docs/handoffs/2026-10-02-1548-step2-session-b-check.md)) found no defect in what was built; of the nine section 1.8 items, five are met on the evidence it produced (2, 3 on the read path, 5, 6, 8)
> and four wait on something that does not exist yet (1, 4, 7, 9: F1 to F4).
> **Needs from Davin:** (1) **decision 1: how RETUNING ends (session B's P1).** Simulated with the real push worker's code, Option A can leave a promote in RETUNING for about 10 trading days at 100 to 200 rows a minute
> and half a day at 600 (one slot at 800), where the docs say "hours"; the real rate is unmeasured. Options: keep Option A and measure first; Option B (count only what the sensors read, so RETUNING ends one verified manifest
> after the promote); or speed up the push worker first. It does not block the deploy; settle it before step 3 wires the `retuning` flag to CAUTIONARY in production. (2) **P2, the stale statements, wait for decision 1** and
> a small builder session (their text depends on the rule; deliberately NOT fixed in this session): the comment at `backfill_worker_api_gateway_v5.py:913-915`, `docs/STACK-D-ARCHITECTURE.md:255-256` ("5–6 minutes"), and
> "hours" in `docs/adr/015-retuning-during-a-promote.md:36` and `docs/runbooks/mt5-terminal-promote.md:191`. (3) **F1 to F4 wait on live evidence** (none is a defect): F1 a real cycle measured with the kit; F2 the chart
> stamp's enforcement point (`chartMatchesCycle` has no caller until the prompt assembler); F3 a promote rehearsed end to end (a second terminal, step 3's loader reading `retuning`, and P1's duration); F4 the
> indicator switch in one slot for MCD inputs and the UI (step 3's loader; the flag is off). (4) Still open from part 10: the one-step reading of "followed by one verified manifest", a key of its own for writes before
> the flag goes live, ADR-015 amended or superseded, the part 7 and 8 questions, the production and VPS checks, then the deploy in the runbook's order. (5) Push, when he decides.
> **Changed & verified:** `docs/STACK-D-ARCHITECTURE.md` section 3.4 rows 4 and 5 (the state codes are back in backticks; Prettier clean); a search of `docs/STACK-D-*.md`, `docs/MCD-*.md` and `docs/adr/` found no other
> damage (`M\*` is escaped and renders correctly, left as is); walkthrough Part E2 now has the rule that identifiers in Markdown always go in backticks; this file and `waiting-on.md` (session B's items); the commits, made by
> explicit path with no `git add -A`. The test re-run after the commits and the hashes are in this session's hand-off report (`docs/handoffs/`, named `*-step2-commit.md`; written after the commits, so not in them).
> **Unconfirmed / found:** nothing ran against production, the VPS or a deployed gateway; the newest-row question (stub or closing bar) is still unverified; `test_extended_statistics.py` fails the same 15 checks at HEAD (not
> step 2's); six gateway tests read files outside `railway-gateway/` (the whole checkout is needed; a CI job testing the package alone would go red); `npm run build` at the repo root rewrites `next-env.d.ts`, which was kept
> out of the commits; the two other hand-offs session B names (`*-1320-antigravity-advisor-...`, `*-1435-step3-plan.md`) are not in this working tree, so nothing of them was committed; `davintrade-recent-works/stack-d.md`
> has an unrelated uncommitted change (Davin's reading list), left alone. The oldest entry (part 9) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part10 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 10 of 10, the closing part: Option A for RETUNING (the gateway counts
> the window; ADR-015 amended), the `measure-cycles` kit, the deploy-order runbook, and the closing verification. **Build step 2 is complete in code.** Built and tested locally; NOT deployed, the part 2 migration is NOT
> applied, nothing committed. A throwaway embedded Postgres (local, created from the gateway's own schema, stopped and removed) ran the gated specs; no repo migration was run.**
> **Needs from Davin:** (1) **confirm the one-step reading of "followed by one verified manifest"** (the manifest that counts 0 must itself be READY; mine, hand-off decision 1; the extra manifest costs a new column);
> (2) **a key of its own for writes, before `ACTIVE_INDICATOR_FROM_GATEWAY=true`** (part 6); (3) ADR-015 amended in place or superseded by a new number; (4) the production and VPS checks (including which gateway the
> push worker targets), a go for the deploy in the order of `docs/runbooks/deploy-stack-d-step2.md`, and commit and push when he decides; (5) optional: a column for the gateway's count so progress is SQL-visible; (6) approve
> a scratch-venv install of matplotlib, pandas, pytest and boto3 so the three renderer test files can run; (7) after the first measured cycles, confirm or replace the ADR-012 thresholds with a new decision; the part 7
> and 8 questions are still open. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `railway-gateway/src/cycle/retuning.ts` and `src/worker/cycle-manifest.service.ts` (Option A: the window count, the promote lookup, the new `RETUNE_COMPLETE` detail), `src/cycle/measure-cycles.ts`
> and `scripts/measure-cycles.js` (the kit; the script is plain JavaScript on purpose), tests `retuning.spec.ts` (35), `promote-retuning.spec.ts` (57), gated `promote-retuning.pg.spec.ts` (8), `measure-cycles.spec.ts` (77) with
> `helpers/measure-world.ts` and a sample fixture; docs: `docs/runbooks/deploy-stack-d-step2.md` (new), `mt5-terminal-promote.md`, ADR-015, STACK-D 1.6, the contract's description of `repush_rows_unsent` (copy re-synced), blueprint 5.4,
> schema comments; hand-off ([part 10](../../../docs/handoffs/2026-10-02-1300-step2-part10.md)). `railway-gateway`: `tsc` clean, `npm test` **29 passed + 3 gated skipped / 836 + 26 skipped** (was 729 + 24), `npm run test:e2e` **7 / 139**
> (unchanged), the gated specs **8 of 8 twice** (promote) and **7 of 7** (readers) on the throwaway Postgres, `npm run build` clean (`dist/main.js`, no `dist/src`); root: `type-check` clean, `lint` at its baseline (0 errors, 5 old
> warnings), `npm run test:ci` **257 suites / 3,453 passed** (unchanged: no monolith file touched); Python: 12 of the 13 pipeline tests green (`test_extended_statistics.py` fails the same 15 checks as at HEAD), `test_cycle_manifest.py` 47.
> **Mutation check: 74 of 74 Option A mutants killed; the kit's 94 of 94 killed on the final spec** (first pass 87 killed, 1 weak, 6 survived: six real test gaps, now closed).
> **Unconfirmed / found:** the kit has run on a fixture only, nothing ran against production, the VPS or a deployed gateway; **how long RETUNING lasts is unmeasured** (a worker slower than the window leaves the middle of it old for hours,
> by my reading of the code); the window bound is one bar wider than the collector's, which can hold RETUNING one more cycle (pinned by a test); the three renderer test files were NOT run (packages not installed, no download without
> a say), and phase 1 of the parked calculation project cannot run (its mock data folder is missing); `scripts/**/*.ts` is in the gateway's tsconfig, so a `.ts` there would break `node dist/main` (a test guards it); `railway run`
> gives a private database URL a laptop cannot reach; my first mutation harness read every mutant as a crash (cp1252), and killing it mid-mutant left `retuning.ts` mutated until I restored it from the backup (verified by sha256);
> the harness now refuses to start if a source differs from its backup. The oldest entry (part 8) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part9 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 9 of 10: promote and RETUNING (rule 9, ADR-015): the sender's
> `repush_rows_unsent`, and in `railway-gateway/` promote detection, the RETUNING state machine, the `PROMOTE` and `RETUNE_COMPLETE` events and `retuning` on the `cycle-ready` job. Built and tested locally;
> NOT deployed, the part 2 migration is NOT applied, nothing committed. A throwaway embedded Postgres (local, created from the gateway's own schema, then removed) ran the gated specs; no repo migration was run.**
> **Needs from Davin:** (1) **how RETUNING can end on the real pipeline (hand-off, decision 1; it blocks step 3 reading the flag, not part 10).** The collector's `INSERT OR REPLACE` re-queues the whole window every cycle,
> so the order's count (unsent rows older than `slot - 300`) is thousands in every manifest and never 0: a real promote would start RETUNING and nothing would end it. Built as ordered, pinned by a test, and four
> options written up (recommend: the gateway counts window rows still carrying a pre-promote `cycle_id`); (2) confirm deviations 1 to 6 (hand-off section 2), above all that M15 is not compared (an M15-only
> reconfiguration is not detected) and that "verified" is READY with the zero allowed from an unverified cycle; (3) the deploy order: production and VPS checks, then the part 2 migration (it creates `cycle_events`),
> then the gateway, then `backfill_worker_api_gateway_v5.py` alone on the VPS; (4) still open from parts 6 to 8 (a key of its own for writes, the `?slot=` and stamp questions, the part 8 decisions); (5) a go for
> part 10; (6) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** sender `backfill_worker_api_gateway_v5.py` (`unsent_counts`, `repush_rows_unsent` in `build_manifest`), the contract's description of the field (gateway copy re-synced), the four manifest
> fixtures regenerated from the real sender; gateway: `src/cycle/retuning.ts` (new), `manifest-row.ts` (`manifestTuning`), `src/worker/cycle-manifest.service.ts`; tests `retuning.spec.ts`,
> `promote-retuning.spec.ts`, gated `promote-retuning.pg.spec.ts`, helper `promote-world.ts`; blueprint §5.4, the promote runbook (§4 corrected); hand-off
> ([part 9](../../../docs/handoffs/2026-10-02-1134-step2-part9.md)). `railway-gateway`: `tsc` clean, `npm test` **28 passed + 3 gated skipped / 729 + 24 skipped** (was 666 + 18), `npm run test:e2e` **7 / 139** (unchanged),
> the gated specs **6 of 6 three times** (new) and **7 of 7** (readers) on the throwaway Postgres; root: `type-check` clean, `lint` at its baseline (0 errors, 5 old warnings), `npm run test:ci` **257 suites / 3,453 passed**
> (unchanged: no monolith file touched); Python `test_cycle_manifest.py` **47** (was 39), the 11 other Stack C tests green. **Mutation check: 88 of 88 gateway and 15 of 15 Python mutants killed by a failing test**
> (one survivor each found and closed by a test; one equivalent removed). 70 new tests (+6 gated).
> **Unconfirmed / found:** nothing ran on a real `xauusd.db` or a deployed gateway; nothing reads `retuning` yet (the `cycle-ready` job has no consumer until step 3); a sender without the count never ends a RETUNING
> (absent is not zero); a manifest that arrives behind a newer one writes no events; `RETUNE_COMPLETE` is written just before the READY commit (a job that then exhausts its retries could leave a second one later);
> my first M15 rule (compare with the last M15 cycle) fired a second PROMOTE per real promote, found only by the full-sequence test, so M15 is compared with the previous cycle only; a gated spec that lands eight slots
> timed out at Jest's 5 s and the next test's `beforeEach` then failed with a misleading foreign-key error (gotchas file). The oldest entry (part 7) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part8 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 8 of 10: the `symbol_specs` lane (ADR-066, STACK-D §1.4 and §6.9): an MQL5
> exporter, a collector stage, a fourth push lane, and in `railway-gateway/` a contract, DTO, endpoint, queue, processor and reader. Built and tested locally; NOT deployed, the part 2 migration is NOT applied, nothing
> committed. **The exporter was never compiled** (MetaEditor is Davin's). A throwaway embedded Postgres (local, created from the gateway's own schema, then removed) ran one gated spec; no repo migration was run.**
> **Needs from Davin:** (1) the deploy order: the production and VPS checks, then the part 2 migration, **before** the gateway (a job for a missing table is lost after 3 attempts while the sender has already stamped the
> row), then the gateway, then the same three VPS files as part 3 (`MT5Collector` first, then `MT5PushWorker`), then **compile `mq5/SymbolSpecsExport_v2_29.mq5` and attach it to an XAUUSD chart on BOTH terminals A and B**
> ([waiting-on](../waiting-on.md), blueprint 5.7, the promote runbook); (2) confirm the ten deviations from the order (hand-off section 2), above all the exporter's folder (`mq5/`), UTC `captured_at` instead of raw
> `TimeCurrent()`, and `typical_spread` as a 24 h median; (3) the other part 8 decisions (hand-off section 7: the window, `point`/`digits`/`swap_mode` required, a `getSymbolSpecByVersion`, how Section 6 reads the table);
> (4) still open from parts 6 and 7: a key of its own for writes, and the `?slot=`, extra stamp keys and title; (5) a go for part 9 (promote and RETUNING; ADR-015 is Settled); (6) commit and push, when he decides.
> `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `C/mq5/SymbolSpecsExport_v2_29.mq5`, `C/gateway_contract_symbol_specs.schema.json`, the `symbol_specs` table in `sqlite_schema_v6_xauusd.sql`, `stage_symbol_specs` / `parse_symbol_specs_file` /
> `terminal_label` and a hook in `export_collector_validator_v2.py`, `push_symbol_specs` in `backfill_worker_api_gateway_v5.py`; gateway: `src/symbol-specs/` (keys, reader, module, contract mirror),
> `symbol-spec.dto.ts` (hand-written: the generator emits no min/max), `symbol-specs.controller.ts`, `symbol-specs.processor.ts`, both modules, the new queue override in all 6 existing e2e specs; blueprint 5.7, the
> promote runbook; hand-off ([part 8](../../../docs/handoffs/2026-10-02-1100-step2-part8.md)). `railway-gateway`: `tsc` clean, `npm test` **26 passed + 2 gated skipped / 666 + 18 skipped** (was 599 + 7), `npm run test:e2e`
> **7 / 139** (was 6 / 112), the new gated spec **11 passed** on the throwaway Postgres (6 of 6 runs); root: `type-check` clean, `lint` at its baseline (0 errors, 5 old warnings), `npm run test:ci` **257 suites / 3,453
> passed** (unchanged: no monolith file touched); Python `test_symbol_specs.py` 42 and `test_push_symbol_specs.py` 28 PASS, the 10 other Stack C tests green. **Mutation check: 109 of 109 gateway and 80 of 80 Python mutants
> killed by a failing test.** 164 new tests (+11 gated).
> **Unconfirmed / found:** the exporter has never run in MetaTrader (first live check: blueprint 5.7); nothing ran on a real `xauusd.db` or a deployed gateway; nothing imports `SymbolSpecsService` yet; **my first mutation
> harness counted a timeout as a kill** (a mutant that leaves an un-mocked Bull queue hangs jest; fixed, all runs redone, gotchas file); `test_extended_statistics.py` fails 15 checks at HEAD too (not mine); the generated
> DTOs do not enforce their schemas' `pattern`/`minimum`/`minLength` (reported, not changed); the embedded Postgres closes connections under 8 parallel writers (`P1017`), so the race tests use two. The oldest entry
> (part 6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part7 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 7 of 10: the chart stamp and the last good image (rule 8, ADR-014):
> the cycle-driven VPS renderer, the stamp in the image title and in R2 object metadata, the monolith's stamp helpers and the download route's `X-Chart-*` headers, and an additive `?slot=` on
> `GET /api/v1/cycles/current` in `railway-gateway/`. Built and tested locally; NOT deployed, the part 2 migration is NOT applied, no database or bucket touched.**
> **Needs from Davin:** (1) the deploy order of this part: the gateway (with `?slot=`), then the monolith, then the VPS files (`mtf_render_upload_worker.py` and the whole `mtf_render/` package), with `API_GATEWAY_URL` and
> `BACKFILL_API_KEY` added to `MT5Renderer`'s NSSM environment together with the existing entries, and `MT5Renderer` restarted ([waiting-on](../waiting-on.md)); (2) confirm the `?slot=` parameter (hand-off decision 2: called
> plainly the endpoint answers at the gateway's newest READY cycle, a minute behind the VPS, so the picture of slot S would use the setting of S - 300), the two extra metadata keys and headers (decision 3), and the
> four-line title (decision 4); (3) still open from part 6, before anything goes live: **a key of its own for writes** (decision 1, an auth change, so his); (4) a go for part 8 (the `symbol_specs` lane);
> (5) for his advisor: one stale "ADR-015, proposed" left at `docs/MCD-DEVELOPMENT-STANDARD.md:798`; (6) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** VPS folder `v2_29_multi-timeframe-visualisation/`: new `mtf_render/stamp.py`, `data_source.py` (read as of the slot, one indicator per timeframe), `renderer.py` (stamped title), `__main__.py` (flags),
> `mtf_render_upload_worker.py` rewritten (polls `xauusd.db` for the newest validated M5 slot, resolves the indicators from the gateway for that slot with a clean fallback to `RENDER_OVERLAYS`, renders both variants to a temp
> folder, uploads ONLY if every file is a complete PNG, stamps the R2 metadata, prunes at 48 h); monolith: `lib/storage/chart-keys.ts` (`ChartStamp`, `parseChartStamp`, `chartMatchesCycle`, `chartStampHeaders`),
> `lib/storage/r2.ts` (`getChartStamp`), `app/api/chart/download/route.ts` (headers on the 307; an image with no or unreadable stamp is still served); gateway: `?slot=` with `basis: REQUESTED_SLOT` and a new contract fixture;
> hand-off ([part 7](../../../docs/handoffs/2026-10-02-0714-step2-part7.md)). `railway-gateway`: `tsc` clean, `npm test` **23 passed + 1 gated skipped / 599 + 7 skipped** (was 577), `npm run test:e2e` **6 / 112** (was 96);
> root: `type-check` clean, `lint` at its baseline (0 errors, 5 old warnings, none mine), `npm run test:ci` **257 suites / 3,453 passed** (was 255 / 3,357); renderer `pytest` (scratch venv) **118 passed** (was 17), with
> all network access blocked; Prettier clean on every new file. **Mutation check: 176 mutants, 176 killed** (16 real gaps closed). 233 new tests.
> **Unconfirmed / found:** not run against a real `xauusd.db` or a real R2 bucket (first live check: the `uploaded ... slot S` log line, the five `x-amz-meta-*` keys on a HEAD, `X-Chart-Slot` on a download);
> `chartMatchesCycle` has no caller until a prompt builder exists (step 3 or later), so "an image from another slot stays out of the prompt" is only partly met; the newest-row question in waiting-on is still open, so the
> title states the newest M5 candle actually drawn as a fact; a failing `prune` used to mark a good slot failed (fixed); a default argument bound at import defeated a test's patch (gotchas); the pair can be briefly
> mixed if the second upload fails (each object keeps its own true stamp); `RENDER_INTERVAL_SEC` is retired. The oldest entry (part 5) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part6 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 6 of 10: the active-indicator setting (rule 6, ADR-010) in
> `railway-gateway/` and the monolith. Built and tested locally; NOT deployed, the part 2 migration is NOT applied, no database touched, and the monolith side is behind a flag that is OFF
> (`ACTIVE_INDICATOR_FROM_GATEWAY`).**
> **Needs from Davin:** (1) **a key of its own for writes before this goes live** (an auth change, so his): the setter shares the gateway's `API_KEYS` with the VPS push worker (hand-off decision 1; recommend a
> separate list); (2) renderer option handling in part 7, not part 6 (decision 2, recommend); (3) the overlay's refresh cadence, one request per slot while shown (decision 3); (4) the deploy order, now with two new
> monolith env names (`MARKET_GATEWAY_URL`, `MARKET_GATEWAY_API_KEY`, never `NEXT_PUBLIC_`), a monolith key in the gateway's `API_KEYS`, then the flag ([waiting-on](../waiting-on.md)); (5) a go for part 7;
> (6) for his advisor: one stale "ADR-015, proposed" left at `docs/MCD-DEVELOPMENT-STANDARD.md:798`; (7) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** gateway: new `src/cycle/active-indicator/` (`ActiveIndicatorService`: `resolveActiveIndicator`, `resolveAll`, the append-only audited setter that refuses non-future slots, the history; the
> `cycles-current/1` body builder), `GET /api/v1/cycles/current`, `GET` and `POST /api/v1/active-indicator`, `ReaderCycle` timing fields, contract fixtures `cycles-current-{before,after}-flip.json`; monolith: new
> `lib/active-indicator/` (client with a strict contract parser, flag, sources), `app/api/market-data/channel/route.ts` (resolves the indicator from the gateway when the flag is on, also before forwarding to
> operation-service; flag off unchanged, its 13 existing tests pass untouched), `useMtfOverlay` (follows the route, refreshes 90 s after each slot), `app/api/admin/active-indicator/route.ts` (existing `requireAdmin`,
> author from the session, no page); hand-off ([part 6](../../../docs/handoffs/2026-10-02-0536-step2-part6.md)). `railway-gateway`: `tsc` clean, `npm test` **23 passed + 1 gated skipped / 577 + 7 skipped** (was 505),
> `npm run test:e2e` **6 / 96** (was 5 / 67); root: `type-check` clean, `lint` at its baseline (0 errors, 5 old warnings, none mine), `npm run test:ci` **255 suites / 3,357 passed** (was 251 / 3,213), Prettier clean on every
> new file. **Mutation check: 64 mutants, 64 killed** (one real gap closed). 247 new tests.
> **Unconfirmed / found:** a setting effective from slot T flips every consumer when the CYCLE of slot T is READY (about a minute after T), because every consumer asks about its cycle's slot; the renderer (part 7) and the
> sensor loader (step 3) do not follow the setting yet, so the downloaded chart image can differ from the screen after a change; operation-service's port of the channel route does not know `fractal_edt`
> (only with `MIGRATE_MARKET_DATA_CHANNEL` on); a test found that `URLSearchParams.size` is missing in jsdom. Not run: anything deployed, the overlay in a browser (needs a PRO sign-in), a real Postgres for the settings
> table. The oldest entry (part 4) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part5 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 5 of 10: the strengthened landed check and the read
> side in `railway-gateway/` (closed bars, one-day OHLC, statistics at the slot). Built and tested locally; NOT deployed, the part 2 migration is NOT applied, no production or staging database touched.**
> **Needs from Davin:** (1) the deploy order is unchanged: the production and VPS checks, `prisma migrate status`, the part 2 migration, then the gateway, then the three VPS files ([waiting-on](../waiting-on.md));
> (2) **before part 6, hand-off decision 1: where Section 5 reads from** (the monolith cannot import the gateway's readers: recommend the gateway exposes them over HTTP, starting with part 6's
> `GET /api/v1/cycles/current`); (3) confirm decisions 2 to 4 of the hand-off (a statistics row that landed is returned even when the cycle recorded a shortfall for other sources: recommend keep; a newest row the
> gateway rejected now leaves the cycle INCOMPLETE; `lib/indicator-statistics/queries.ts` left alone until step 5); (4) a go for part 6; (5) for his advisor: one stale "ADR-015, proposed" left at
> `docs/MCD-DEVELOPMENT-STANDARD.md:798`; (6) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** the landed check now also requires the newest row's `cycle_id` at or above the manifest's `collection_cycle_id` (new reason `NEWEST_ROW_NOT_CURRENT`); new `src/cycle/read/`
> (`CycleReaderService`: `getClosedBars`, `getOneDayOhlc`, `getStatisticsAtSlot`, `getReadyCycle`, `getNewestReadyCycle`; `ready-cycle.ts`; `read-types.ts`; `CycleReadModule`, not imported by `AppModule`) and
> `src/cycle/closed-bars-query.ts` (the ONE closed-bars query, shared by the manifest service's digest and every reader); six new unit specs, a gated real-Postgres spec, the rule 5 guard
> `no-latest-statistics.spec.ts` (scans 694 files); hand-off ([part 5](../../../docs/handoffs/2026-10-02-0446-step2-part5.md)). `railway-gateway`: `tsc` clean, `npm test` **21 suites passed + 1 gated skipped /
> 505 tests + 7 skipped** (was 15 / 320), `npm run test:e2e` **5 / 67** (unchanged), Prettier clean on every new file (`test/validation.service.spec.ts` already failed it, untouched). **Mutation check: 61 mutants,
> 61 killed** (four real test gaps found and closed). The real Prisma queries ran against a local embedded Postgres through the gated spec: **7 of 7**, and a negative control (READY filter removed) failed it 2 of 7; the instance was removed.
> **Unconfirmed / found:** every reader answers STALE unless the cycle that collected the timeframe is READY (M15 at an M5-only slot: the quarter hour's cycle); the labelled last price is only offered while its row is
> still the version this cycle wrote, and does not exist at all if the newest row turns out to be the closing bar (the VPS query in waiting-on settles it); the sensor worker must retry on `CYCLE_NOT_READY`; the readers do not check
> for a hole inside a window; the guard found one offender, `lib/indicator-statistics/queries.ts` (reported, not changed); Jest here only finds specs under `test/`. Not run: anything deployed, a real cycle,
> root `type-check` (no root file changed). The oldest entry (part 3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part4 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 4 of 10: the gateway side
> in `railway-gateway/` (`POST /api/v1/cycle-manifest`, the landed-row check, `market_cycles`, the `cycle-ready` job). Built and tested locally; NOT deployed, the part 2 migration is NOT applied,
> no production or staging database touched.**
> **Needs from Davin:** (1) the deploy, **in this order**: the read-only production and VPS checks, `prisma migrate status`, apply `20261002000000_add_cycle_pipeline_tables`; then deploy `railway-gateway`
> (a gateway before the migration answers 200 and loses the manifest); then the three part 3 files on the VPS ([waiting-on](.././waiting-on.md)); (2) decision 1 of the hand-off: make the landed check prove
> "this cycle's rows" (the newest row's `cycle_id` at or above the manifest's `collection_cycle_id`), because as built an older copy of a row satisfies it (recommend adding, before the first real cycle);
> (3) confirm the new direct dependency `ajv` 8.18.0 (pinned, already in the lockfile) and keeping the statistics policy (a 30 s grace, then READY with `STATISTICS_SHORTFALL` recorded; recommend keep);
> (4) a go for part 5 (read side); (5) for his advisor: one stale "ADR-015, proposed" left at `docs/MCD-DEVELOPMENT-STANDARD.md:798`; (6) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new `src/gateway/cycle-manifest.controller.ts`, `src/worker/{cycle-manifest.service,cycle-queues}.ts`, `src/cycle/{cycle-manifest.contract,manifest-decision,manifest-row,closed-bars-digest,windows,manifest-thresholds}.ts`
> and a byte-identical in-package copy of the Stack C contract (`npm run sync:manifest-contract`, a test guards it); `MarketDataProcessor` now has ONE wildcard handler with concurrency 1 dispatching on the job name, so a manifest
> runs after the rows queued before it; `package.json` (+`ajv`); one `cycle-ready` queue line in each of the four existing e2e specs; six new unit specs, one e2e spec, fixtures produced by the REAL push worker and a 96-case
> verdict corpus from Python's `jsonschema`; hand-off ([part 4](../../../docs/handoffs/2026-10-02-0156-step2-part4.md)). `railway-gateway`: `tsc` clean, `npm test` **15 suites / 320 tests** (was 9 / 196),
> `npm run test:e2e` **5 / 67** (was 4 / 43), Prettier clean on every new file (`test/validation.service.spec.ts` already failed it, untouched). **Mutation check: 65 mutants, 65 killed** (two real test gaps found and closed:
> `attempts` from M5 only, and an in-memory table that ignored `orderBy`). The real Prisma queries were run once against a local embedded Postgres (ready path, digest recomputed with plain SQL, `skipDuplicates`,
> the conditional update, the range count, JSON columns), then removed.
> **Unconfirmed / found:** Bull adds concurrency across named handlers (a second named handler would mean a second loop), pinned by a spec against Bull's source; the landed check proves presence, not that this cycle's
> upsert landed (decision 1); the digest's canonical form follows TypeScript number formatting (`2650`, not Python's `2650.0`), which a later replay must reproduce; a `cycle-ready` consumer (step 3) must not assume the row is
> READY the instant it picks the job up; no watchdog for a PENDING row whose job exhausted its retries (harmless if part 5 reads only READY rows); `cycle-ready` jobs accumulate in Redis until step 3; the 386 serial row
> requests may still be tight against the 2-minute deadline (part 10). Not run: anything deployed, a real cycle, root `type-check` (no root file changed). The oldest entry (part 2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part3 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 3 of 10: the sender side in
> `backend-stack-c` (newest bars first plus the cycle manifest). Built and tested in the repository; NOT deployed to the VPS, no database touched.**
> **Needs from Davin:** (1) deploy to the VPS: copy `export_collector_validator_v2.py`, `sqlite_schema_v6_xauusd.sql` (required) and `backfill_worker_api_gateway_v5.py`, restart `MT5Collector`
> then `MT5PushWorker`, and after a few cycles run the read-only query in [waiting-on](.././waiting-on.md) to settle whether the newest row is the stub or the bar about to close (until part 4
> ships the gateway endpoint the manifests answer 404 and are retried; prices are unaffected); (2) the production and VPS checks, then apply the part 2 migration before part 4 deploys; (3) a go
> for part 4 (gateway endpoint); (4) low urgency: confirm that a slot superseded before its manifest was built gets none (hand-off §6; recommend keep); (5) for his advisor: one stale
> "ADR-015, proposed" left at `docs/MCD-DEVELOPMENT-STANDARD.md:798`; (6) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `backfill_worker_api_gateway_v5.py` (priority set of at most 386 rows newest first, then statistics and the manifest, then the backlog oldest-first within the 500-row
> budget; manifest outbox and delivery), `export_collector_validator_v2.py` (stamps the OHLCV export file's mtime, the newest bar, the export directory and a finished marker; additive migration),
> `sqlite_schema_v6_xauusd.sql`, new `gateway_contract_cycle_manifest.schema.json` (`cycle-manifest/1`), `cycle_test_support.py`, `test_push_priority_order.py`, `test_cycle_manifest.py`; comment-only
> alignment of both Prisma schemas; hand-off ([part 3](../../../docs/handoffs/2026-10-02-0101-step2-part3.md)). **61 new tests pass (22 + 39)**; the 9 existing Stack C test files give the same results as
> before; `py_compile` clean; `railway-gateway` 9 suites / 196 tests and e2e 4 / 43 unchanged, root `type-check` clean, the part 2 DDL still Prisma's verbatim output. Smoke run on a full 3,000-bar
> world: 386 rows, 1 statistics batch, 1 manifest, 114 rows. **Mutation check: 57 mutants, 56 killed**, the survivor equivalent (two real test gaps found by it were closed).
> **Unconfirmed / found:** `test_extended_statistics.py` already failed 15 checks before this work and still does (it compares real captured sample files); time to ready now includes sending 386 single-row
> requests before the manifest, which may be tight against ADR-012's 2-minute deadline (part 10 measures); exports carry no "Export Time" line by default (`InpIncludeMetadata = false`), so the file's mtime is
> the only export time; the collector is CRLF in the working tree; building a 6,000-row test world took 176 s until the pruning trigger was dropped from the fixtures. Not run: any gateway behaviour (part 4),
> anything on the VPS. The oldest entry (part 1) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part2 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 2 of 10: the four
> additive tables (`market_cycles` with `attempts Int`, `active_indicator_settings`, `symbol_specs`, `cycle_events`) as schema, migration and mirrors.
> The migration is written and NOT applied; no database was touched except a throwaway local one.**
> **Needs from Davin:** (1) the read-only production and VPS checks, then apply `prisma/migrations/20261002000000_add_cycle_pipeline_tables` (after
> `prisma migrate status`; it depends on no other pending migration, so it can be applied alone; steps in [waiting-on](.././waiting-on.md)); (2) confirm or
> remove three `symbol_specs` columns beyond §6.9 (`point`, `digits`, `swap_mode`; recommended keep, hand-off §6); (3) a go for part 3 (sender side), which does
> not need the migration applied; (4) for his advisor: one stale "ADR-015, proposed" left at `docs/MCD-DEVELOPMENT-STANDARD.md:798` (the build manual's two
> lines were fixed this session); (5) commit and push, when he decides. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** four models appended to `prisma/market-data/schema.prisma` and, byte-identical, to `railway-gateway/prisma/schema.prisma`; new
> `prisma/migrations/20261002000000_add_cycle_pipeline_tables/migration.sql` (Prisma's own DDL verbatim, 4 tables, 6 indexes, 2 seed rows); `types/prisma-stubs.d.ts`
> (4 interfaces, 4 delegates); `railway-gateway/test/schema-sync.spec.ts` (22 to 56 tests); `docs/STACK-D-BUILD-USER-MANUAL.md` lines 156 and 646; `database-traps.md`,
> `waiting-on.md`; the hand-off ([part 2](../../../docs/handoffs/2026-10-02-0010-step2-part2.md)). Both schemas validate; the DDL matches `migrate diff` and an independent
> from-empty derivation; **replayed on an embedded Postgres: 11 of 11 checks pass and introspection against the schema is an empty migration** (a negative control
> shows a diff). `railway-gateway`: `tsc` clean, `npm test` **9 suites / 196 tests** (was 162), `npm run test:e2e` **4 / 43** (unchanged); `schema-sync` mutation check
> **14 of 14 killed**. Root: `npm run type-check` clean, ESLint on the stubs clean, `npm run test:ci` **251 suites / 3,213 tests**, identical to the baseline.
> **Unconfirmed / found:** an MT5 export's "Export Time" line is `TimeCurrent()` (the last tick's broker server time), not UTC and not the write moment, so part 3 takes the
> export time from the file's modification time; Docker's engine is not running here, so the replay used Prisma's embedded Postgres (PGlite), not a Postgres 16 server;
> `prisma migrate diff` prints dotenv lines on stdout and `--from-url` is gone in Prisma 7 (both in `database-traps.md`); the stubs file never held the other market models
> (pre-existing). Not run: any gateway behaviour (nothing imports the new models yet). The oldest entry (P6 MCD0) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part1 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1, Market data & chart),
> session A, part 1 of 10: the pure cycle core (slot, closed bar, market hours, data status) in `railway-gateway/src/cycle/`, and ADR-015 recorded
> as Settled. Nothing is wired into the gateway: no deploy effect.**
> **Needs from Davin:** (1) the read-only production and VPS checks before the Part 2 migration is applied: the four §0.5 items and which gateway the
> push worker targets (exact checks in [waiting-on](../waiting-on.md), first two items); (2) a go for part 2 (migration files; `attempts` must be on
> `market_cycles`) or part 3 (sender side), which do not depend on each other; (3) for his advisor: two stale "ADR-015 proposed" mentions left alone
> (`docs/MCD-DEVELOPMENT-STANDARD.md:798`, `docs/STACK-D-BUILD-USER-MANUAL.md` lines 156 and 646); (4) commit and push, when he decides. Nothing else
> blocks. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new `src/cycle/{thresholds,slot,market-hours,data-status}.ts`, `test/{cycle-slot,market-hours,data-status}.spec.ts`,
> `test/helpers/collector-constants.ts`, `test/fixtures/market-hours-parity.json`, `scripts/generate_market_hours_parity.py`; ADR-015, the ADR README and
> the architecture (header, status words, rule 9, §1.6, §1.9, §5.3, §7, Appendix A and D); `waiting-on.md`, `environment-gotchas.md`; the plan and the
> hand-off ([plan](../../../docs/handoffs/2026-10-01-2321-step2-plan.md), [part 1](../../../docs/handoffs/2026-10-01-2347-step2-part1.md)). In
> `railway-gateway/`: `tsc` clean; `npm test` **9 suites / 162 tests** (baseline 6 / 93); `npm run test:e2e` **4 / 43** (unchanged); the Part 1 specs (69
> tests) also pass under `TZ=UTC` and the host zone (UTC+7); the TypeScript gate agrees with the real Python gate at all 1,565 open/close flips and 6 DST
> flips of 2025 to 2027; mutation check **36 of 36 killed** (one gap, a cycle ready exactly at its slot, closed by one test); Prettier clean.
> **Unconfirmed / found:** the newest row at slot time may be the bar about to close, not the new-bar stub (exporters fire at second 59; Part 3 records
> export time and newest bar; [waiting-on](../waiting-on.md)); the forming-bar SSA fit now has line-level evidence (`CherryPickA` 1997-2004), carried
> for stage 5; `railway-gateway` has no working lint (gotchas file); the live status reads STALE for about 6 minutes after the market reopens (literal
> rule 7) and DELAYED for up to 2 minutes before a retried cycle is stored FRESH; where the monolith gets the status function is open until step 7.
> Not run: the monolith suites (no monolith code touched). The oldest entry (P5 MCD0) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Build MCD0: evaluator 1.0.0, tests, fixtures, manifest (Stage 3
> sign-off)" on top of `4ae42610` (Davin's Next.js security update); NOT pushed. MCD task P6 for MCD0 (a fresh independent check that changed
> nothing), then, after Davin's stage-3 sign-off, the two findings closed and the wrap-up.**
> **Needs from Davin:** (1) schedule the kit change for `config_hash` ([waiting-on](../waiting-on.md)): MCD1 to MCD3 still pass a non-string hash
> through; (2) keep or revert the builder addition to F1 (a `config_hash` that is not a mapping is also INVALID + `SANITY_FAILED`); (3) push, when
> he decides; (4) optionally a fresh P6 check of the MCD1 and MCD2 2.0.1 patch; nothing blocks. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `mcd0_evaluator.py` (tier 3 rejects a non-string `config_hash` of an active source and a non-mapping `config_hash`;
> `_evaluate` keeps only string hashes), `test_mcd0_unit_tests.py` (**124 tests**, +5: four for F1, one for F2), spec §5 and §13, plan §9, the
> manifest, the hand-off ([P6 MCD0](../../../docs/handoffs/2026-10-01-1650-mcd0-p6.md)), the kit item in `waiting-on.md` and these state files.
> From `engine-1-5-new/`: MCD0 **124 OK**, MCD1 **113 OK**, MCD2 **102 OK**, MCD3 **134 OK** (1 opt-in skip), the kit **215 OK**; pyflakes and
> Prettier clean; LF, no Thai. P6: no line of A1 to A26 failed except A7 and A9 for a non-string `config_hash` (F1, root cause in the shared kit)
> and a test gap under A21 (F2, a zero statistic reported as 1.0 passed every test); a differential test of 150,000 cycles against an independent
> spec §6 implementation found no mismatch; a fuzz of about 23,000 corrupted bundles raised nothing (661 schema-breaking envelopes, all F1);
> mutation of the evaluator: 382 mutants with one real gap, and 403 after the fixes with none; 92 data-file mutants (7 prose survivors). The
> evaluator stays at 1.0.0 (never live, no fixture output changes).
> **Unconfirmed / found:** the envelope margin is **20 to 30 tokens** for realistic data, not 48 (other setting names and random hashes
> tokenise longer; 600 is crossed only with seven-digit statistics); `Params.from_yaml` accepts `.inf` (kit item); five defensive `int()`
> normalisations are untested (low); the shadow period must still measure the flag rate; the fit-window question reaches MCD0. Not run: the
> legacy tests, `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (P4 (b)) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p5 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `4ae42610`, Davin's Next.js security update). MCD task
> P5 for MCD0 after Davin approved the spec, registry, parameters and plan and answered Q1 to Q5 (routing: Explain only): MCD0 is built at
> evaluator 1.0.0, flag `off`: evaluator, 119 tests, fixtures for v1, v3 and v4, `mcd0_output.json` and the manifest; the architecture §2.13
> row reads `Draft (1.0.0)`.**
> **Needs from Davin:** (1) run **task P6 for MCD0** in a fresh session, then his stage-3 sign-off; (2) what to commit and when (decision (k):
> after P5 is verified, which it now is): uncommitted are ADR-083 settled and its README row, two manifest rows, `mcd0/`, the architecture row,
> three hand-offs and the state files (`package.json` and `pnpm-lock.yaml` were committed by him); (3) optionally a fresh P6 check of the MCD1 and
> MCD2 2.0.1 patch; (4) nothing blocks. The half-up rounding helper now exists in MCD0 to MCD3 and the `T_EDT` helper in three evaluators (a kit
> change for him to schedule). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new in `mcd0/`: `mcd0_evaluator.py` (254 lines, no bar read), `test_mcd0_unit_tests.py` (**119 tests, all pass**),
> `fixtures/` (v1, v3, v4: nine files), `mcd0_output.json`, `mcd0-manifest-work-completion.md` (Appendix A with evidence); status lines and the
> routing row of the spec, plan and registry; `docs/STACK-D-ARCHITECTURE.md` §2.13; the hand-off ([P5 MCD0](../../../docs/handoffs/2026-10-01-1559-mcd0-p5.md))
> and these state files. From `engine-1-5-new/`: MCD0 **119 OK**, MCD1 **113 OK**, MCD2 **102 OK**, MCD3 **134 OK** (1 opt-in skip), the kit **215 OK**,
> legacy **13 OK** each; pyflakes and Prettier clean; LF, no Thai. Largest envelope **552 tokens** (546 valid; budget 600, margin 48), one evaluation
> under 1 ms. Own mutation pass on the verdict logic: **37 of 37 killed** (36 on the first pass; the survivor was a required-fields test that read
> its list from the evaluator, now holding its own copy from spec §3). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> **Unconfirmed / found:** every real reading is `MCD0_M5_M15_DEFECT` under the fixture settings (and `MCD0_M5_DEFECT` with M15 re-set to `non_a`);
> `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are synthetic only, so the shadow period must measure the flag rate; the envelope margin of 48 tokens is
> thin, so a new `details` field must re-measure; the fit-window question reaches MCD0 ([waiting-on](../waiting-on.md), updated); `<slot>.source.md` of
> v3 and v4 carries an absolute workbook path (the open kit item). The oldest entry (P4 (a)) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p4b -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `4ae42610` is Davin's Next.js security update). MCD
> task P4 part (b) for MCD0 after Davin confirmed `mcd0/concept.md` and answered (a) to (k): `mcd0.md`, `mcd0_registry.yaml`,
> `mcd0_params.yaml` (12 parameters) and `mcd0_implementation_plan.md` are written and the work STOPS at the second STOP for his approval.
> No code.**
> **Needs from Davin:** (1) approve or correct the four files and answer spec Q1 to Q5: `last_closed_bar` is `{}`; each model's own skew;
> variance ratio and kurtosis never required; empty rung and no rule rows; **Q5, the trimmed envelope**: the first layout measured 660
> tokens worst case (582 for the real v1 reading) against the 600 budget, so the spec drops `verdict`, `source` and the angle from `details`
> and names the criterion, not the model, in commentary (555 tokens, 561 with RETUNING); the alternative is a higher ceiling for MCD0, as
> for MCD3; (2) then the architecture §2.13 MCD0 row goes from `To build` to `Draft` and P5 follows (evaluator, tests T1 to T13, fixtures
> v1, v3 and v4, manifest); `active-tasks.md` is left in place with STOP 2 and P5 open; (3) commit only after P5 is built and verified
> (decision (k)); `package.json` and `pnpm-lock.yaml` were committed by him in `4ae42610`, so nothing is left to exclude.
> **Changed & verified:** new `mcd0/mcd0.md`, `mcd0_registry.yaml`, `mcd0_params.yaml`, `mcd0_implementation_plan.md`; `mcd0/concept.md`
> (confirmed, and §11 holds his answers); the hand-off ([P4 (b) MCD0](../../../docs/handoffs/2026-10-01-1536-mcd0-p4b.md)) and these state
> files. Scratch (nothing in the repo): the expected reading of every real channel row with the decisions applied (eight real cases, four
> `MCD0_M5_M15_DEFECT` and four `MCD0_M5_DEFECT`); token counts of hand-built envelopes with the kit's counter; a consistency check (the 12
> parameters in spec §6 equal the parameters file loaded through the kit; the registry and the rendered commentary pass the kit's wording
> check). Prettier clean, LF, no Thai. MCD0 has no code, test, fixture or manifest yet, so no suite was run; not run: `test:ci`, `tsc`, lint,
> build.
> **Unconfirmed / found:** the 600-token budget decides the layout (the mandatory part is about 230 tokens, the two `config_hash` entries
> about 90); the margin is about 40 and P5's T12 must confirm it on the built evaluator; no real M5 channel qualifies, so
> `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are synthetic only; the fit-window question reaches MCD0 ([waiting-on](../waiting-on.md)); the
> shared T6 and T10 are overridden in MCD0's tests because it reads no bars (no kit change). The oldest entry (P7 (b)) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p4a -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `dfb17331`). ADR-083 settled (Proposed to Settled) and
> Q1 to Q5 of the MCD2 and MCD1 2.0.1 patch recorded as approved as built; then MCD task P4 part (a) for MCD0: `mcd0/concept.md` (a readback
> of walkthrough Part C4; MCD0 has no board) is written and the work STOPS for Davin to confirm it and answer its open questions.**
> **Needs from Davin:** (1) confirm or correct `mcd0/concept.md`; (2) answer questions (a) to (f) of walkthrough C4 (decision D8) and (g) to (j)
> found while reading (concept §10, each with a recommendation; (a) to (f) are the build user manual §3 suggestions: `window_span_bars` counted
> in closed bars, each model's own MSE, keep the geo gate, skip R² on a flat channel, Model A not applicable for the fractal EDT, variance
> ratio and kurtosis as values in `details`; (g) to (j): tier 1 without bars, one unreadable timeframe makes the whole reading STALE or INVALID,
> sanity checks for MSE and offsets, no containment test); (3) then P4 part (b): `mcd0.md`, registry, parameters and the plan (a second STOP),
> and after his approval P5; `active-tasks.md` is left in place with both STOPs open; (4) what to commit: the ADR-083 and manifest edits and
> `mcd0/` are uncommitted, and `package.json` and `pnpm-lock.yaml` show a Next.js 16.3.3 to 16.3.8 bump (including `overrides`) that is not from
> this session and should stay out of it.
> **Changed & verified:** `docs/adr/083-…md` and its row in `docs/adr/README.md` (Settled); one row in §9 of the MCD2 and MCD1 manifests; new
> `mcd0/concept.md` (176 lines); the hand-off ([P4 (a) MCD0](../../../docs/handoffs/2026-10-01-1519-mcd0-p4a.md)) and these state files. A scratch
> probe (nothing in the repo) computed the four pillars on the 11 real channel rows of the stored fixtures (v1, v3, v4): the literal thresholds
> flag all six active-channel readings (only R² and the fit ratio fail), `channel_width` equals `uoedt_offset - loedt_offset` on all 11, and the
> two MSE readings never differ in verdict on the 8 rows with Model A values. Prettier clean, LF, no Thai on every edited Markdown file. No
> evaluator, test, fixture, spec, registry or parameter was touched, so no suite was run; not run: `test:ci`, `tsc`, lint, build.
> **Unconfirmed / found:** `window_span_bars` counts through the still-open bar (closed bars are one fewer, the ADR-083 fact), and MCD0 becomes a
> new reader of the fit fields whose forming-bar question is still open ([waiting-on](../waiting-on.md), now lists MCD0); the kit's tier-1
> cross-check and the shared T6 need bars, which C4 says MCD0 does not read (question (g)); no real M5 channel qualifies, so two of the four
> states need synthetic bundles. The oldest entry (P7 (a)) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 p7b-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Patch MCD2 and MCD1 to 2.0.1: window
> counts the channel's closed bars (task P7)"; the hash is in `git log`), NOT pushed. MCD task P7 part (b) for MCD2 and MCD1 after
> Davin confirmed the PATCH (evaluator 2.0.1): MCD2's window is `min(T_EDT - 1, 288)` and a channel under 48 closed bars is INVALID +
> `INSUFFICIENT_BARS`; MCD1 requires the channel to hold `N_micro` closed bars (`T_EDT - 1 >= N_micro`), same reason code; no real
> reading changes.**
> **Needs from Davin:** (1) nothing blocks. Q1 to Q5 of the concept sections were not answered one by one, so the build follows the
> recommended answers (floors kept as minimums, parameter `t_edt_open_bar_rows` = 1, ADR-083 drafted, MCD3 note wording): say if any
> should change; (2) settle **ADR-083** (status Proposed); (3) optionally a fresh **P6 check** of the two patched MCDs (a short one);
> (4) next work: **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** both evaluators, params, registries, specs, plans, manifests and `concept.md` sections of MCD1 and MCD2;
> `MCD2` 93 to **102** tests and `MCD1` 105 to **113** (`ShortChannelTests`; three MCD2 tests that pinned the old formula edited, MCD1
> only its register test); `evaluator_version` label `2.0.0` to `2.0.1` in nine stored JSON files (MCD1 and MCD2 fixture envelopes and
> outputs, MCD3's three `upstream.json`: MCD3 T14 needs them equal to the live output); architecture §2.5 and §2.13; ADR-083 and its
> index row; two MCD3 notes (wording); the `waiting-on.md` item moved to resolved; hand-off
> ([P7 (b)](../../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md)). From `engine-1-5-new/`: MCD2 **102 OK**, MCD1 **113 OK**, MCD3
> **134 OK** (1 opt-in skip; the opt-in scan of the 12 real pairings OK), the kit **215 OK**, legacy **13 OK** each; pyflakes and Prettier
> clean. Own mutation pass on the new logic: 14 of 14 killed. The test run after the commit is in the terminal report, not in a file.
> **Unconfirmed / found:** with the floors kept, MCD1 changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`) and MCD2 gains
> VALID readings for `T_EDT` 49 to 288. The fit-window question stays open ([waiting-on](../waiting-on.md)); the parameter makes a
> different answer a one-value change. The "T_EDT helper" is now in three evaluators (a kit change for Davin to schedule). Not run:
> `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD3 P6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 p7a-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `6599c74f` is Davin's). MCD task P7 part (a) for
> MCD2 and MCD1, the short-channel window: the "Change 2026-10-01" section is written in `mcd2/concept.md` and `mcd1/concept.md`
> (PATCH, evaluator 2.0.1, no fixture output moves) and the work STOPS for Davin's confirmation. Also the cosmetic edit on line 168 of
> the MCD3 plan ("(D6 proposal)" to "(Approved)").**
> **Needs from Davin:** (1) confirm the two Change sections and answer **Q1 first: keep the 48-bar (MCD2) and 96-bar (MCD1) floors as
> minimums** (INVALID + `INSUFFICIENT_BARS` for a shorter channel; recommended), because `min(T_EDT - 1, cap)` applied literally drops
> them (a channel of 30 closed M5 bars would read VALID over 29 bars); (2) Q2 to Q5 in the sections, each with a recommendation:
> `t_edt_open_bar_rows` as a parameter, PATCH not MINOR (three MCD2 tests pin the old formula), one decision entry (ADR-083) for both,
> and the wording of two MCD3 notes; (3) what to commit. Then **P7 (b)** (spec, parameters, registry, evaluator, tests, version 2.0.1,
> manifests, architecture §2.5 and §2.13, the draft decision entry, the suites, a fresh P6), then MCD0. `active-tasks.md` is left in
> place with the STOP and part (b) open.
> **Changed & verified:** the two `concept.md` files (84 and 76 added lines, none removed) and one line of
> `mcd3/mcd3_implementation_plan.md`; the hand-off ([P7 (a)](../../../docs/handoffs/2026-10-01-1435-p7a-mcd2-mcd1.md)) and these state
> files. No evaluator, test, spec, registry, parameter, fixture or output was touched. Prettier clean, LF, no Thai. A scratch probe
> (nothing in the repo): the fixtures' `T_EDT` are 314 or more on M5 and 500 or more on M15, so no fixture output moves; the committed
> MCD2 reads INVALID + `DISCONTINUITY` at `T_EDT` 288 and below, MCD1 at 96 and below (as the waiting-on item said). Not run: the test
> suites (no code touched), `test:ci`, `tsc`, lint, build.
> **Unconfirmed / found:** with the floors kept, the MCD1 patch changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`);
> MCD2 gains VALID readings for `T_EDT` 49 to 288. MCD3 reads only the upstream status, trend and angle, so the MCD1 reason-code
> change is invisible to it. The fit-window question stays open ([waiting-on](../waiting-on.md)); the patch does not depend on it. The
> "T_EDT helper" now exists in three evaluators (a kit change for Davin to schedule). The oldest entry (MCD3 P3) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD3: evaluator 2.0.0, tests,
> fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6 for MCD3, a fresh independent check, then
> Davin's stage-3 sign-off and the wrap-up he asked for: one A line failed (A22, envelope over 600 tokens) and Davin decided it (ceiling of
> 670 tokens for this derived sensor); seven test gaps found by the check's own mutation pass are closed. MCD3 is retrofitted, checked,
> signed off and committed: MCD1, MCD2 and MCD3 are done.**
> **Needs from Davin:** (1) next work: the deferred **P7** for the MCD2 and MCD1 short-channel window (a PATCH, now unblocked;
> [waiting-on](../waiting-on.md)); then **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his); (2) nothing else is
> open from this session. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** seven new tests and a T12 ceiling test in `engine-1-5-new/mcd3/test_mcd3_unit_tests.py` (134 tests; each of the
> seven kills the mutant that had survived; the ceiling test runs all ten states with every candidate populated, RETUNING and two upstream
> cautions against 670); `mcd3.md` ("(Approved)" in the §12 worked example, §11 and §13 on the ceiling and the new cases); the manifest (A22 "Pass
> (Approved by Davin: derived dual-horizon ceiling <= 670 tokens)", a P6 paragraph, counts, §8 rows) and the plan; the hand-off
> ([P6 MCD3](../../../docs/handoffs/2026-10-01-1407-mcd3-p6.md)) and these state files. From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **134 OK** (1 opt-in skip; the opt-in full scan of all 12 real pairings OK), the kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier clean. The check itself: a clean-room oracle fuzz on 24,000 bundles (0 differences), its own mutation pass (477 mutants; the 10
> non-equivalent survivors, in 7 groups, are the gaps; all killed now), the schema taken from the standard's Appendix B, its own banned-word
> scan, token sizes re-derived (515, 550, 587; 607 and 611; 656 worst case with every candidate populated; MCD1 392 and MCD2 386 in the same
> case, so the three-sensor worst case is about 1,430 of 2,000). The test run after the commit (the hook left the fixtures untouched) is in
> the terminal report, not in a file.
> **Unconfirmed / found:** `details.populated_candidates` is the cost driver of the envelope size (up to 13 names on live data, about 40
> tokens); the statistics fit windows may include the still-open bar (inherited; [waiting-on](../waiting-on.md)); the kit writes absolute
> workbook paths into `.source.md` for v3 and v4 (open, [waiting-on](../waiting-on.md)); `mcd3_implementation_plan.md` line 168 still says
> "(D6 proposal)" in a column header (left as it is: Davin named only `mcd3.md`). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> The oldest entry (MCD3 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `dde1420e` is Davin's). MCD task P3 for MCD3
> (steps R5 to R10): evaluator 2.0.0 built on the kit with Davin's D10 option A, D6, D7 and Q1 to Q9; 127 tests pass; manifest,
> fixtures, architecture and standard records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a decision on the **envelope size**: the real CAUTIONARY readings are **607 and 611 tokens**, over the
> standard's 600 ("should"); the plain real ones pass (515, 550, 587). Options: accept; shorten templates T01 to T07 (about 35
> tokens); drop the two trend words from `details` (about 15); (2) a fresh session for **P6 on MCD3** (ask it to run its own mutation
> pass), then his stage-3 sign-off; (3) what to commit (this session's files; the P2 files are in `dde1420e`); (4) after the sign-off:
> the deferred **P7** for the MCD2 and MCD1 short-channel window (a task chip is open). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** in `engine-1-5-new/mcd3/`: `mcd3_evaluator.py`, `test_mcd3_unit_tests.py`, `fixtures/` (v1, v4, v3: inputs,
> upstream, envelope, source), `mcd3_output.json`, the manifest, approval lines in the spec, concept, plan, params and registry; plus
> `mcd_common/fixtures/settings_v3.yaml`, architecture §2.5 and §2.13, standard **1.0.4** (PATCH: `<slot>.upstream.json`) and walkthrough
> B3; [the hand-off](../../../docs/handoffs/2026-10-01-0859-mcd3-p3.md). From `engine-1-5-new/`: `python -m unittest discover -s mcd3`
> **127 OK** (1 opt-in skip); the opt-in scan of all 12 real pairings OK; kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**, legacy **13 OK**;
> Prettier and pyflakes clean. Equivalence: ten synthetic scenarios equal to the pre-retrofit evaluator; all 12 real pairings keep their state
> (v3 is a real `MCD3_BEAR_BOTTOM`, 973 of 1037 bars nested). Own mutation pass: 90 mutants, 7 test gaps closed, 3 equivalent.
> **Unconfirmed / found:** real envelopes are larger than the P2 estimate (587, not 533: real prices and two 64-character hashes). The
> kit writes an absolute workbook path into `<slot>.source.md` (v3 and v4 as for MCD1 and MCD2). Replica v3 is now tracked (Davin's
> commit; the blob's SHA-256 matches the fixture). The fit-window question stays open; the MCD2 and MCD1 short-channel window is deferred
> by Davin. Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P6) was rotated into
> `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd3-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (the index holds one staged rename: the MCD3
> board image). MCD task P2 for MCD3 (steps R1 to R4): concept readback, English spec, parameters, registry and plan written;
> stopped at the STOP. P3 has not started and cannot start before D10. Flag `off`; registry status stays `Retrofit`.**
> **Needs from Davin:** (1) **D10**, which EDT stochastic formula is intended (the board reads 0 at UOEDT; the spec and code
> read 0 at LOEDT; only the reported number changes; no default); (2) **D6** (bias per state; the registry holds the walkthrough
> starting points, unapproved) and **D7** (six levels; the zone builder must count a duplicate price once); (3) questions Q1 to
> Q9 of [the spec §14](../../../davintrade-stack-d-and-e/engine-1-5-new/mcd3/mcd3.md) with recommendations, and the readback of
> `concept.md` (the board's two times match no replica; is v1 an acceptable stand-in?); (4) approval of `mcd3.md` and the plan,
> then **P3 for MCD3**; (5) what to commit (the MCD3 P2 files, and replica v3 if Q7); (6) optional: a **P7** task for the MCD2
> and MCD1 short-channel window (below). `active-tasks.md` was left in place (the STOP item is open).
> **Changed & verified:** in `engine-1-5-new/mcd3/`: `legacy/` (evaluator and output byte-identical, tests with one path line
> edited), the board in `concept/` (staged rename), `concept.md`, `mcd3.md`, `mcd3_params.yaml`, `mcd3_registry.yaml`,
> `mcd3_implementation_plan.md`; [the hand-off](../../../docs/handoffs/2026-10-01-0703-mcd3-p2.md). From `engine-1-5-new/`:
> legacy **13 OK** from `legacy/`, kit **215 OK**, MCD1 **105 OK**, MCD2 **93 OK**; params and registry load with the kit,
> wording clean, the spec tables equal the YAML, Prettier clean. All 12 real pairings in replicas v1 to v4 keep their legacy
> state on closed bars; one is a **real consolidated trend** (v3, `MCD3_BEAR_BOTTOM`, 973 of 1037 bars nested). Largest
> envelope estimated at 533 of 600 tokens.
> **Unconfirmed / found:** `T_EDT` counts the forming bar (the band columns exist on exactly `T_EDT` rows ending at the open
> bar, 7 of 7 real channels), so MCD3's window is `T_EDT − 1`; new evidence for the open fit-window item in
> [waiting-on](../waiting-on.md). The committed MCD2 ends INVALID + `DISCONTINUITY` for an M5 channel with `T_EDT` ≤ 288
> (MCD1 at ≤ 96), simulated; no replica triggers it (smallest real `T_EDT` 314); not fixed. Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD1 P3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Retrofit MCD1:
> evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"; the hash is in `git log`), NOT pushed. MCD task P6
> for MCD1, a fresh independent check: no line of A1 to A26 fails (20 pass, A15 not applicable, 5 not yet due);
> three low findings F1 to F3, all closed after Davin granted the stage-3 sign-off. MCD1 is retrofitted, checked,
> signed off and committed.**
> **Needs from Davin:** (1) next work: **P2 for MCD3** (it stops for D7, the levels, and D10, the direction of the EDT
> stochastic); (2) optional: add replica v3 as an MCD1 fixture slot (a real `MCD1_DOWN_LOWER_BREAKDOWN`;
> [the hand-off](../../../docs/handoffs/2026-10-01-0628-mcd1-p6.md) §6a); (3) nothing else is open from this session.
> `active-tasks.md` was deleted (every item done).
> **Changed & verified:** F1 and F2: one test in `engine-1-5-new/mcd1/test_mcd1_unit_tests.py` (105 tests; it kills
> the two mutants that had survived); F3: four `meaning` sentences in `mcd1.md` §7 now equal the registry's;
> architecture §2.5, MCD1 "States" cell: nine codes plus five regime statuses; the manifest and plan updated; the
> hand-off and these state files written. From `engine-1-5-new/`: `python -m unittest discover -s mcd1` **105 OK**,
> MCD2 **93 OK**, the kit **215 OK**, the legacy tests **13 OK** each; Prettier clean. The check itself: its own
> mutation pass (424 mutants, 399 killed, 23 of the 25 survivors equivalent), a clean-room reference fuzzed on 220,000
> bundles (0 differences), every number of the manifest reproduced (365, 356 and 367 tokens; the legacy files equal
> HEAD), the schema taken from the standard's Appendix B, its own banned-word regex. The test run after the commit
> (the hook left the fixtures untouched) is in the terminal report, not in a file.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited; see
> [waiting-on](../waiting-on.md)); five of nine states have synthetic examples only (replica v3 gives a real
> `MCD1_DOWN_LOWER_BREAKDOWN`, not yet a fixture); a break under half a cent reads "0.00 above UOEDT" (left as it is,
> as for MCD2). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD1 P2) was rotated
> into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD1
> (steps R5 to R10): evaluator 2.0.0 built on the kit with Davin's D6 bias and Q1 to Q7; 104 tests pass;
> manifest, fixtures and the architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD1** (an independent check; the first mutation pass
> left two test gaps, now closed, so ask it to run its own), then his stage-3 sign-off; (2) what to commit and
> when ([the hand-off](../../../docs/handoffs/2026-10-01-0544-mcd1-p3.md) §6a: the MCD1 folder, the architecture
> doc, two hand-offs and the state files are uncommitted); (3) optional: the architecture §2.5 "States" cell for
> MCD1 still lists the five regime words (§6b); (4) next work after P6: **P2 for MCD3** (needs D7 and D10).
> `active-tasks.md` was deleted (every item done).
> **Changed & verified:** in `engine-1-5-new/mcd1/`: `mcd1_evaluator.py`, `test_mcd1_unit_tests.py`,
> `fixtures/` (new), `mcd1_output.json`, the manifest, the registry (D6 applied), approvals in the spec, plan,
> parameters and concept; architecture §2.13 (2.0.0, Levels) and §2.5 (baseline). From `engine-1-5-new/`:
> `python -m unittest discover -s mcd1` **104 OK**; MCD2 **93 OK**; the kit **215 OK**; the legacy tests **13 OK**
> each (the `legacy/` evaluator and output are byte-identical to `HEAD`). Mutation pass on a scratch copy: 57 of 57
> killed (two survived the first pass: no test had a window bar closing exactly on a band; closed with a test).
> The three real cycles keep their legacy state (`MCD1_DOWN_UPPER_BREAKOUT`, `MCD1_DOWN_IN_CORRIDOR`,
> `MCD1_SIDEWAYS_LOWER_BREAKDOWN`); legacy and new side by side, every difference explained. Largest envelope 367
> tokens, evaluation about 2.5 ms. Pyflakes and Prettier clean.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited, see
> [waiting-on](../waiting-on.md); MCD1 reads the same three fields and `N_micro` depends on `containment_n`); six of
> nine states are tested with synthetic bundles only (replica batches v2 and v3 not scanned); under D6 two
> same-slope break states take the bias of the break, while the draft synthesis rule 2 reads them as "against the
> spike" (synthesis decides; for the rules review). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> The oldest entry (MCD2 P6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd1-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`. (1) MCD2 closed and committed
> (`ecbb3f94`, "Retrofit MCD2: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). (2) MCD task P2
> for MCD1 (steps R1 to R4): concept readback, English spec, parameters, registry and plan written; stopped at
> the STOP. P3 is not started and the MCD1 files are NOT committed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0457-mcd1-p2.md) §6, **D6
> first** (bias per MCD1 state: no default, the registry holds `DAVIN` for six states), then Q1 to Q7, check the
> English readback (`concept.md`), and approve `mcd1.md` and the plan; (2) say when to commit the MCD1 P2 files;
> (3) keep or change the five lines added to the repo-wide `.prettierignore` (in the MCD2 commit); (4) then **P3
> for MCD1**. `active-tasks.md` is left in place with the STOP item open.
> **Changed & verified:** MCD2: one test for H1 to H3 (93 tests; the four tier-3 mutants die on a scratch
> mirror), standard 1.0.3 (`flag: 'off'` in Appendix C.2), walkthrough C1 "Renamed (D5)", manifest at 93 tests
> with the sign-off, committed by explicit path (31 files). MCD1, in `engine-1-5-new/mcd1/`: `legacy/`
> (byte-identical evaluator and output; one path line edited in the test copy), new `concept.md`,
> `mcd1_params.yaml`, `mcd1_registry.yaml`, rewritten `mcd1.md` and `mcd1_implementation_plan.md`. From
> `engine-1-5-new/`: `python -m unittest discover -s mcd2` **93 OK** (also on the committed tree); the kit
> **215 OK**; the legacy tests **13 OK** for MCD1 and MCD2. Params load through the kit; nine states, wording
> checks, spec against registry and params all clean; Prettier clean. Closed-bar readings keep the legacy
> state on all three real cycles (v1 `non_b`: `MCD1_DOWN_UPPER_BREAKOUT`; v4 `non_b`: `MCD1_DOWN_IN_CORRIDOR`;
> v4 `non_a`: `MCD1_SIDEWAYS_LOWER_BREAKDOWN`), so three of nine states have real examples.
> **Unconfirmed / found:** the pre-commit hook (`lint-staged` + prettier) reformatted the one-line canonical
> JSON fixtures of the first MCD2 commit and broke two replay tests on the committed tree; fixed with
> `.prettierignore` entries, regenerated files and an amend of the local commit (details: hand-off §7, gotchas
> file). The forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> MCD1 reads the same fields. 17 old `lint-staged automatic backup` stashes sit in `git stash list` (not from
> this session, untouched). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry
> (MCD2 P3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 for MCD2: a
> fresh independent check of the retrofit (evaluator 2.0.0) against its manifest. No line of A1 to A26
> fails (20 pass, A15 not applicable, 5 not yet due); three low test-gap findings H1 to H3. Nothing in the
> MCD2 folder or the kit was changed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0430-mcd2-p6.md) §7: sign off
> stage 3 for MCD2 (I would not hold it for H1 to H3) and say whether to add the one short test for H1 to H3;
> (2) the three items still open from the P3 hand-off §6: PATCH the standard to 1.0.3 for `flag: 'off'`, what
> and when to commit, walkthrough C1 "Proposed renames"; (3) next work: **P2 for MCD1** (needs D6 at its STOP).
> **Changed & verified:** nothing in the MCD2 folder, the kit, the standard or the architecture; this report,
> the state entries and two gotchas. From `engine-1-5-new/`: `python -m unittest discover -s mcd2` **92 OK, 0
> skipped**; the kit **215 OK**; the 13 legacy tests OK (from `mcd2/legacy/`). Legacy evaluator and output are
> byte-identical to HEAD; the manifest's legacy baseline, tokens (355, 355, 359, 353), time and SHA-256 values
> all reproduce; output and fixtures validate against the schema taken from the standard; no banned word in any
> code, template or summary; Prettier clean. Own mutation pass on a scratch mirror: 40 mutants, 36 killed; the 4
> survivors are the three gaps H1 to H3 (tier-3 window edges, strict `>` on older bars, raw bars in tier 3);
> direct probes show the evaluator is right in each case.
> **Unconfirmed / found:** a breakout under half a cent reads "0.00 above UOEDT" (accurate, may read oddly;
> hand-off §5); the forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> six states are still tested with synthetic bundles only (replica batches v2 and v3 not scanned); an
> unstaged rename of the MCD3 board image is in the tree (not this work). Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD2 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD2
> (steps R5 to R10): evaluator 2.0.0 built on the kit; 92 tests pass; manifest, fixtures and the
> architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD2**, then **P2 for MCD1**; (2) the standard's
> Appendix C.2 shows `flag: off`, which YAML loads as `false`: PATCH it to 1.0.3? ([the hand-off](../../../docs/handoffs/2026-10-01-0410-mcd2-p3.md)
> §6a); (3) what to commit and when (§6b: P2 and P3 left the MCD2 folder, the architecture doc,
> `docs/handoffs/` and `.claude/state/` uncommitted, plus two staged image renames); (4) optional: walkthrough
> C1 still says "Proposed renames" (§6c).
> **Changed & verified:** `mcd2_evaluator.py`, `test_mcd2_unit_tests.py`, `fixtures/`, `mcd2_output.json`,
> the manifest, the registry (`flag` quoted), approvals in the spec, plan and concept; architecture §2.13
> (2.0.0), §2.5 and §3.4 (renamed regime words). From `engine-1-5-new/`: `python -m unittest discover -s mcd2`
> **92 OK**; the kit **215 OK** (untouched); the 13 legacy tests OK. Mutation pass on a scratch copy: 28 of 28
> killed (one survivor closed with a test). Largest envelope 359 tokens, evaluation about 9 ms.
> Legacy and new side by side: the four real cycles and all nine states keep their state, every difference
> explained. Prettier clean.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited, see
> [waiting-on](../waiting-on.md)); all four real cycles are `IN_CORRIDOR`, so six states are synthetic only
> (the untracked replica batches v2/v3 were not scanned). Not run: `test:ci`, `tsc`, lint, build (no app code
> touched). The oldest entry (Step 0 commit) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P2 for MCD2
> (steps R1 to R4): concept readback, English spec, parameters, registry and implementation plan are
> written; stopped at the STOP. P3 (build) is not started.**
> **Needs from Davin:** (1) approve `mcd2.md` and the plan, and answer Q1 to Q7 ([the hand-off](../../../docs/handoffs/2026-10-01-0343-mcd2-p2.md)
> §6; recommendations are the P3 defaults); (2) check the English readback of the two Thai boards
> (`concept.md` §3), which the builder translated; (3) then **P3 for MCD2**; (4) commit when ready (two
> staged board renames; the rest of the work is untracked or modified).
> **Changed & verified:** in `engine-1-5-new/mcd2/`: `legacy/` (byte-identical evaluator, tests, output; one
> path line edited in the test copy), `concept/` (two images, `git mv`), new `concept.md`,
> `mcd2_params.yaml`, `mcd2_registry.yaml`, rewritten `mcd2.md` and `mcd2_implementation_plan.md`.
> Legacy tests **13 OK** from `legacy/`; kit suite **215 OK** (unchanged); params load through the kit,
> nine states and D6 bias checked, `wording` checks clean on codes, regime words, templates and summaries;
> spec §6 and the params file list the same six parameters; Prettier clean. Closed-bar readings on all
> four real cycles keep the legacy state (v1 and v4, centroid and fractal).
> **Unconfirmed / found:** all four real cycles are `IN_CORRIDOR`, so the other states are synthetic
> only (the untracked replica batches v2/v3 were not scanned); the statistics fit windows may include the
> still-open bar (inherited, see [waiting-on](../waiting-on.md)); architecture §2.5 and §3.4 still name the
> old regime words (Q7). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (the
> P6 re-check) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-step0-g1-g3-commit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Step 0: shared MCD kit
> (mcd_common)" (hash in `git log`), not pushed. G1 to G3 on the kit are fixed with four new tests (215
> pass, 211 before); standard PATCHed to 1.0.2 for the unknown `data_status`; derived words stay allowed.**
> **Needs from Davin:** (1) the commit left out, on purpose, the Stack C `.mq5`/`.ex5` change
> (`InpTolerancePercent` 0.50 to 5.00, not made by this session), the two Advisor docs, the v2 to v4
> generators and raw exports, the other replica batches and the `.pptx` files: say which to commit
> ([the hand-off](../../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md) §6 and §7); (2) G4 (the wrong
> "CRLF" sentence in the fix hand-off) was not in the order and is unchanged; (3) next work: **P2 for
> MCD2** (needs D4 to D7 at its STOP).
> **Changed & verified:** four tests (G1 in `test_shared_checks.py`, G2a and G2b in
> `test_cycle_inputs.py`, G3 in `test_wording_and_budget.py`); a two-line comment in `wording.py`;
> standard §6 and §12 (version 1.0.2); the `market_data_v6_replicated_v4.xlsx` fixture is now committed
> because the kit's tests read it. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests
-t .` **215 OK, 0 skipped**. The five mutants that survived the re-check (G1 twice, G2a, G2b, G3) are
> all killed now, kit restored by bytes. Standard is Prettier-clean; new table cells fit the old widths.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no app
> code touched). The oldest entry (the F1 to F6 fixes) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-p6-recheck-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`, a fresh re-check of the lines changed for F1 to F6: all six fixes hold,
> 211 tests pass and the kit is unchanged. Four small findings G1 to G4 (three test gaps, one wrong
> sentence in the fix hand-off), none blocks P2.**
> **Needs from Davin:** (1) whether to fix G1 to G4 before P2 (recommended: one very short builder step
> for G1 to G3, about four small tests); (2) still open from the fix hand-off: whether derived words
> (`PROBABLE`, `LIKELY`, `SAFETY`) are banned too, and whether to PATCH standard §6 and the §12 T10 row
> for the unknown-status failure; (3) read [the hand-off](../../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md)
> §4.3 and §6; (4) next work: **P2 for MCD2** (needs D4 to D7 at its STOP); (5) commit when ready
> (`mcd_common/` and `docs/handoffs/` are untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off, this entry, and the
> oldest entry rotated into the new `history/2026-10-sessions.md`. From `engine-1-5-new/`:
> `python -m unittest discover -s mcd_common/tests -t .` **211 OK, 0 skipped**. Own probes, 57 checks, all
> pass: F1 to F5, and the P1 "Done when" and Part B2 items on both workbooks and the standard's text.
> Own mutation pass on a scratch copy: 34 mutations on the changed lines, 29 killed, 5 survived (1
> equivalent; the other 4 are G1 to G3).
> **Unconfirmed / found:** G4: the fix hand-off says the kit files are CRLF; measured with Python they
> are LF only, with no mixed endings (do not check line endings with `grep` in Git Bash). The forming bar
> inside the statistics fit windows is still unverified (MQL5 source not checked, see
> [waiting-on](../waiting-on.md)). MCD2's legacy commentary "safely within the EDT corridor" now fails
> T11 (for P2). Not run: `test:ci`, `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-fixes-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. The six P6 findings
> F1 to F6 on the shared kit `mcd_common/` are fixed with Davin's choices for F4 and F5; 211 tests
> pass (192 before).**
> **Needs from Davin:** (1) read [the hand-off](../../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md) §6:
> the F5 inflection list is a little wider than "plural, -ED, -LY" (adds `-ING`, comparatives,
> `CONFIDENT`, `GUARANTEE`), and derived words such as `PROBABLE` or `LIKELY` are still not caught;
> standard §6 does not yet name the new cycle failure; (2) next work: a fresh session for **task P6
> on the kit**, re-checking only the changed lines, then **P2 for MCD2** (needs D4 to D7 at its
> STOP); (3) commit when ready (`mcd_common/` is still untracked).
> **Changed & verified:** F1 `freeze()` now freezes and copies the contents of a `MappingProxyType`;
> F2 preflight docstring and README say the checks can raise on a corrupt bundle and every evaluator
> needs `never_throws`; F3 budget comment says 3.6 MB; F4 `cycle_check` gives INVALID + `SANITY_FAILED`
> for a `data_status` outside the four values (T10 gets a ninth corruption); F5 `BANNED_INFLECTIONS`
> in `wording.py`, whole-word matching kept; F6 two missing tests (earlier upstream reason kept, `-0.0`
> in `details`). From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .`
> **211 OK, 0 skipped**; own mutation pass on a scratch copy: 11 mutations, 11 killed;
> `BANNED_WORDS` still equals standard §7.4; provider cut-offs unchanged (last closed M5 bar 20:50).
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Re-freezing a frozen 3,000-bar bundle now
> costs about 0.7 s (construction and `dataclasses.replace` only, not evaluation). Not run: `test:ci`,
> `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-kit-check -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`: every Part B2 and P1 "Done when" item holds and the kit is unchanged; six
> small findings (F1 to F6), none blocks P2.**
> **Needs from Davin:** (1) F4: what an unknown `data_status` should produce (recommended: INVALID +
> `SANITY_FAILED`); (2) F5: whether the wording check T11 should also catch inflections of the banned
> words, such as `PROBABILITIES` or `graded` (recommended: yes); (3) whether to fix F1 to F6 before P2
> (recommended: yes, a short builder session, then a fresh re-check of those lines); (4) read
> [the hand-off](../../../docs/handoffs/2026-10-01-0015-p6-kit.md) §4 to §6; (5) commit when ready
> (`mcd_common/` is still untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off report and this
> entry. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .` **192 OK, 0
> skipped**. Own scripts: provider cuts v1 at M5 20:50 / M15 20:30 and v4 at 23:10 / 23:00; no live-bar
> or last-price statistics field in any bundle row; schema file equals standard Appendix B and rejects
> an extra top-level field; reason codes, banned words, `CycleInputs` fields and pre-flight order equal
> the standard. Own mutation pass on a scratch copy: 26 mutations, 23 killed, 2 real test gaps (F6),
> 1 equivalent mutant.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked; `window_high`, `window_low`, `window_range`, `breach_*` and `max_excursion_*`
> are the same class, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no
> app code touched).
