# Runbook — Deploying build step 3 (sensors, chapter 2): Phase B, the live rollout

**Scope:** putting the sensor worker into production and proving it on real cycles: the migration, the Railway
image, the worker switched on with every MCD off, each MCD switched to `shadow` in dependency order, the
live measurements, five trading days of shadow, certification into `state_statistics`, and the later promotion
to `live`. Also how to switch each part off again.
**Written:** 2026-10-03, at the close of build step 3 Phase A (parts 1 to 7), from the hand-offs
`docs/handoffs/2026-10-0*-step3-part*.md`, the plan `2026-10-02-1707-step3-plan.md` (§4, Phase B) and the code.
**Who:** Davin. The Executor never applies a migration, deploys, enters a sign-in, or touches production.
**Before you start:** the step 2 runbook (`deploy-stack-d-step2.md`) has been done and its live evidence is recorded
(plan decision 6: step 3's Phase B starts after it).

> **Nothing here has been run against production, the Railway image or a real Redis.** Phase A was built and
> tested on fixtures, a scratch PostgreSQL 18.0 and a runtime-only copy of the Python engine. This runbook
> says what to look at and what each answer means. Where a step says "expect", that is the expectation from the
> tests, not an observation. **What is not built yet is listed in §0**, and three steps below cannot be done until
> it is.

## 0. What exists, what does not

| Piece                                                       | State after Phase A                                                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Sensor worker (`railway-gateway/src/sensors/`)              | Built, tested, **off by default** (`SENSOR_WORKER_ENABLED` unset or anything but `true` registers nothing)                  |
| Migration `20261003000000_add_sensor_tables`                | A file. Verified on a scratch PostgreSQL 18.0 with zero drift. **Not applied anywhere**                                     |
| `scripts/replay-cycle.js`                                   | Built (part 5). Read only                                                                                                   |
| `scripts/measure-sensors.js`                                | Built (part 7). Read only. `--redis` was tested against a fake Redis only                                                   |
| `state_statistics` engine, writer, reader                   | Built (part 6)                                                                                                              |
| `scripts/sync-sensor-kit.js`                                | **Built (2026-10-03):** `npm run sync:sensor-kit` / `check:sensor-kit`. 34 files, 252,181 bytes (§2.2)                      |
| **Python 3.11, PyYAML and jsonschema in the Railway image** | **Not done.** `railway-gateway/nixpacks.toml` is a Node-only image today. §2.1                                              |
| **A command that runs the statistics engine**               | **Not built** (part 6, section 5). B4 needs one                                                                             |
| **Point-in-time replay of MCDs into `state_statistics`**    | **Not built.** What exists replays a STORED cycle; B4 needs a loader over `market_data_point_in_time`. §6                   |
| The forming-bar trace (Q12)                                 | **Done in part 7**, read only: the answer is in the forming-bar trace section of the part 7 hand-off. It needs no live data |

## The order at a glance

| #   | Step                                                  | What it proves                                                                                               | Waits on                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| B0  | Migration, image, kit copy, throwaway service         | The tables exist; Python and the engine run in the image; nothing consumes yet                               | Step 2 live evidence (script built)           |
| B1  | Worker on with every MCD off; then one flag at a time | The loader works on production data; each MCD writes one row per cycle; a stored cycle replays byte for byte | B0                                            |
| B2  | Live latency                                          | Per-MCD time against 1 s, the whole cycle against 30 s, on real cycles and the real database round trip      | B1                                            |
| B3  | At least five trading days of shadow                  | The status mix, the MCD0 flag rate, no `EVALUATOR_ERROR`, nothing skipped by accident                        | B1, calendar time                             |
| B4  | Certification                                         | `state_statistics` rows, with n, from the point-in-time history                                              | B3, the two missing tools (§6)                |
| B5  | RETUNING enforced; flags to `live`                    | Every sensor CAUTIONARY during a promote; the sensors enter the board and synthesis                          | Decision 1 (how RETUNING ends); steps 4 and 6 |

**Stop conditions.** Stop, change nothing further, and tell the Advisor if: the migration fails part-way (§1);
`prisma migrate status` shows migrations pending that you did not expect (§1); the throwaway service cannot
import `yaml` and `jsonschema` or does not reproduce the fixtures (§2.3); the worker logs `relation "mcd_outputs"
does not exist` (§1 was not done); any `EVALUATOR_ERROR` row appears in B1 or B3 (§3.3, §5); a replay says
`LOGIC_DIVERGENCE` (§3.4). Do not push into a half-deployed state.

---

## 1. B0a — The migration

`prisma/migrations/20261003000000_add_sensor_tables/migration.sql`: three tables, no foreign keys, three CHECK
constraints. Additive; nothing reads them until the worker is on.

| Table                 | What it holds                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcd_outputs`         | One row per symbol, slot and MCD: the canonical envelope text and its JSON copy, hashes, status, state, bias, flag, RETUNING, timings. No retention |
| `market_cycle_inputs` | The exact input bundle of each cycle, gzipped, for replay. **Kept 90 days**: the worker deletes older ones after each cycle                         |
| `state_statistics`    | Measured figures per MCD state and horizon. **A number cannot be stored below n = 30** (the CHECK `state_statistics_n_gate`)                        |

The other two CHECKs: `mcd_outputs_flag_is_shadow_or_live` (no row for a flag that is `off`) and
`mcd_outputs_reason_lists_not_null`.

**Read-only first** (the same production config as the step 2 runbook §1.3, never the default one):

```bash
npx prisma migrate status --config prisma.production.config.ts
```

`migrate deploy` applies every pending migration in history order. Read the list. This migration depends on no
other pending one, so it can be applied alone:

```bash
npx prisma db execute --file prisma/migrations/20261003000000_add_sensor_tables/migration.sql --config prisma.production.config.ts
npx prisma migrate resolve --applied 20261003000000_add_sensor_tables --config prisma.production.config.ts
```

**Check it (read-only):**

```sql
SELECT to_regclass('public.mcd_outputs'), to_regclass('public.market_cycle_inputs'), to_regclass('public.state_statistics');   -- none NULL
SELECT conname FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace AND contype = 'c'
   AND conname IN ('state_statistics_n_gate', 'mcd_outputs_flag_is_shadow_or_live', 'mcd_outputs_reason_lists_not_null')
 ORDER BY 1;   -- three rows
```

If it fails part-way, the tables are independent and unread: drop whichever exist
(`DROP TABLE state_statistics, market_cycle_inputs, mcd_outputs;`) and stop. **Do this before any image carries
`SENSOR_WORKER_ENABLED=true`**: a worker that meets a missing table fails the job, and the cycle's readings are lost
(the job is retried three times, then dropped).

---

## 2. B0b — The Railway image, the engine copy, and a throwaway service

### 2.1 What the image needs

The gateway is one Nixpacks service, Node only (`railway-gateway/nixpacks.toml`). The worker starts
`python -B -m mcd_worker.cli` once per cycle from the engine folder, so the image needs:

| Need                                    | Value tested in Phase A                                                                                                                       | Note                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Python                                  | 3.11.9, the command `python` (`SENSOR_PYTHON` names another)                                                                                  | The kit was built and tested on 3.11                                                                                                             |
| Python packages                         | PyYAML 6.0.2, jsonschema 4.25.0 (and what jsonschema pulls in: attrs 25.3.0, referencing 0.36.2, jsonschema-specifications 2025.4.1, rpds-py) | **Not** openpyxl or tiktoken: `mcd_common/requirements.txt` lists them for the tests and fixtures, the runner does not import them. Proven below |
| The engine folder (`SENSOR_ENGINE_DIR`) | The 34 runtime files of §2.2, 251,497 bytes                                                                                                   | Not the 12 MB of fixtures, workbooks, tests and concept notes                                                                                    |
| Node dev dependencies (`ts-node`)       | Already installed: `NPM_CONFIG_PRODUCTION=false` in `nixpacks.toml`                                                                           | Only needed to run `scripts/*.js` inside the image                                                                                               |

**How to put Python in a Nixpacks image is not settled and is not in the repo.** Two candidates, both
**unverified here**; B0 proves one on the throwaway service (§2.3) before production sees it:

1. Nixpacks' multi-language support: add the Python provider and a pinned install of the two packages in
   `nixpacks.toml` (check Nixpacks' documentation for the current key names, and pin the versions above with
   `pip`, not the package versions nixpkgs happens to carry).
2. A Dockerfile for the service (Railway prefers it over Nixpacks when present): a Node image plus Python 3.11.
   A larger change; the Node build, `npm run build` and `node dist/main` must stay the same.

Do not edit `nixpacks.toml` on `main` until the throwaway service shows which one works: the gateway auto-deploys
from `main` and carries the whole market-data ingest (step 2 plan, §5).

### 2.2 `sync-sensor-kit.js` (built)

The engine lives under `davintrade-stack-d-and-e/engine-1-5-new/`, outside `railway-gateway/`, and Railway builds the
gateway alone (Root Directory `railway-gateway`). The way across, settled by Davin in part 4 (decision 6, option (a)),
is a copy inside the package, made by a plain-JavaScript script (a `.ts` file under `scripts/` would change the
build's output layout; `test/measure-cycles.spec.ts` guards that), with a test that fails when the copy differs from
the source. It is the same pattern as `scripts/sync-mcd-output-schema.js` and `src/sensors/mcd-output-1.schema.json`.

**The contract, from what the runner opens (proven in Phase A):** copy these files, byte for byte, keeping their
paths, into `railway-gateway/sensors/` and set `SENSOR_ENGINE_DIR` to that folder inside the image:

- `mcd_common/`: `__init__.py`, `budget.py`, `cycle_inputs.py`, `envelope.py`, `preflight.py`, `reason_codes.py`,
  `testing.py`, `wording.py`, `mcd-output-1.schema.json`;
- `mcd0/` to `mcd3/`: `mcdN_evaluator.py`, `mcdN_params.yaml`, `mcdN_registry.yaml`;
- `mcd_worker/`: `__init__.py`, `cli.py`, `cycle_runner.py`, `errors.py`, `flags.py`, `guards.py`,
  `inheritance.py`, `registry.py`, `worker_config.yaml` and `checklists/MCD0.yaml` to `MCD3.yaml`.

**The evidence:** in Phase A these 34 files (251,497 bytes; **the built copy of 2026-10-03 totals 252,181 bytes**) were copied alone into an empty folder, and the three
stored cycles (v1 2026-09-18 20:55, v3 and v4 on 2026-09-28) were run from it with the imports of `openpyxl` and
`tiktoken` made to fail: all 12 envelopes and the three inputs hashes came back **byte for byte equal** to the stored
ones (0.75 to 1.3 s per cycle, including Python's start). The test fixtures (`mcd_worker/fixtures/`, about 1.5 MB) are
**not** in that set; add them to the copy only if you want `replay-cycle.js --fixtures` to run inside the image.
`mcd_worker/statistics/` is not per-cycle runtime; it belongs with B4's tool (§6).

**Rules for the script:** it never writes outside `railway-gateway/sensors/`; it copies an explicit list (a new MCD
folder is a deliberate edit of the list, with a test); it refuses to run if the engine's four `flag:` lines and
`worker_config.yaml` disagree (the engine's own test already pins that); the pin test fails when a file in the copy
differs from its source by one byte, and needs the whole checkout, like six existing gateway specs.

### 2.3 The throwaway service (do this before production)

A second Railway service, from the same repository and Root Directory, with its **own** Postgres and Redis (never
production's, never the staging clone's): the whole point is that nothing here can touch real data.

1. Deploy the image with the Python change and the engine copy, `SENSOR_WORKER_ENABLED` **unset**. Expect the gateway to
   start exactly as before and the log to say nothing about sensors. (The default is off; a test pins that.)
2. From a shell in that service (Railway's shell for the service): `python --version` (3.11.x) and
   `python -c "import yaml, jsonschema; print('ok')"`.
3. `cd` to the engine folder and run the same replay Phase A ran from a copy:
   `node scripts/replay-cycle.js --fixtures --engine-dir <the folder>` (needs the three fixture bundles in the copy,
   §2.2). **Expect `3 cycle(s): 3 VERIFIED`.** Anything else is a stop: say which verdict.
4. Set `SENSOR_WORKER_ENABLED=true` with the committed flags (**every MCD `off`**) and a database that has the §1
   migration. Expect, for a fresh `cycle-ready` job: `every MCD is off in the worker configuration; nothing written`,
   and **no row** in any of the three tables. This runs the loader, the Python bridge and the schema check against the
   throwaway data with no write, and shows the consumer is alive.
5. Leave a job to age past `SENSOR_MAX_JOB_AGE_SECONDS` (600): expect `skipped` in the log and in the job's return
   value, and still no row. This is what drains the backlog that `cycle-ready` has been collecting since the gateway
   shipped (about 288 a day, nothing consumed it): none of those jobs is evaluated.

When 1 to 5 hold, tear the service down. Record in the B0 hand-off which way of adding Python
worked, with the build log's relevant lines.

### 2.4 Production, with the worker still off

Merge the Python image change and the engine copy (`railway-gateway/sensors/`) to `main`; Railway rebuilds. **Leave
`SENSOR_WORKER_ENABLED` unset.** Check the build log, not only that a deploy started (a redeploy can surface a latent
build failure). Then `GET /health` answers, the log shows no sensor line, and the Redis `cycle-ready` jobs still pile
up. Nothing about the gateway has changed for the senders.

---

## 3. B1 — Switch the worker on, then one MCD at a time

### 3.1 The settings

| Variable                     | Value                                             | Notes                                                                                                                               |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SENSOR_WORKER_ENABLED`      | `true`                                            | Exactly the text `true`; `TRUE`, `1` and `yes` leave it off, on purpose                                                             |
| `SENSOR_ENGINE_DIR`          | the copy inside the image (§2.2)                  | The default points at this checkout's folder, which the image does not have                                                         |
| `SENSOR_PYTHON`              | `python` (the default), or the interpreter's name | —                                                                                                                                   |
| `SENSOR_RETUNING_ENFORCED`   | **leave unset (false)** until B5                  | RETUNING is read and recorded on every row, not applied (Davin, Q6). In production the sensors read VALID during a promote until B5 |
| `SENSOR_MAX_JOB_AGE_SECONDS` | 600 (the default)                                 | A job announced longer ago is skipped and recorded                                                                                  |
| `SENSOR_RUNNER_TIMEOUT_MS`   | 30000 (the default)                               | One Python process per cycle; the cycle budget is 30 s                                                                              |
| `SENSOR_WORKER_CONFIG`       | unset                                             | A worker configuration file for a rollback or rehearsal; it must exist inside the image (§7)                                        |

A variable change takes effect when the service is redeployed (Railway may ask you to apply the staged change). The consumer runs **one cycle at a time** (concurrency 1): a slot is 300 s
and a cycle is about a second, so it keeps up; if it ever does not, the kit shows jobs skipped as too old (§4).

### 3.2 First the worker on, every MCD off

Set `SENSOR_WORKER_ENABLED=true` and `SENSOR_ENGINE_DIR`; the committed `worker_config.yaml` still has every flag `off`.
For three or four real cycles expect, per cycle, the log line from §2.3 step 4 and **no row**; the backlog of old jobs
goes by as `skipped`. This is the first time the loader reads production data: if it throws, it throws here with no
effect on any table. Typical causes, each a stop: `relation … does not exist` (§1), `python: not found` or a failed
import (§2.1), a runner timeout.

### 3.3 One flag at a time, in dependency order

The worker refuses to start if a flag is higher than the checklist allows, if a **derived** MCD is higher than an MCD
it reads, or if a **channel** MCD is higher than MCD0. So the order, one commit and one deploy each, a few cycles
between them:

1. **MCD0** (the gate): `shadow`.
2. **MCD1 and MCD2** (independent, both channel MCDs): `shadow`. They may go together.
3. **MCD3** (derived from MCD1 and MCD2): `shadow`.

Each step is **one commit** that sets the flag in `mcd_worker/worker_config.yaml` **and** on the `flag:` line of the
MCD's `mcdN_registry.yaml` (a test fails if the two differ), then `sync-sensor-kit.js` (§2.2), then a push. The
checklists already carry items 1 to 6 as `passed` for all four MCDs, which is all `shadow` needs (Davin, Q7); items 7
to 9 stay `pending` until steps 4 and 6 and B4, and gate `live` only.

**After each step, look at (read-only):**

```sql
SELECT cycle_slot, mcd_id, flag, status, state_code, evaluator_version,
       round(duration_ms::numeric, 1) AS ms, evaluated_at - cycle_slot AS slot_to_start_s
  FROM mcd_outputs WHERE symbol = 'XAUUSD' ORDER BY cycle_slot DESC, mcd_id LIMIT 12;
```

Expect one row per enabled MCD per slot (including INVALID and STALE ones), `flag = shadow`, a `slot_to_start_s` of
about the step 2 `slot to ready` time plus a little, and a sub-second `ms`. Then the kit (§4) on the last dozen
cycles with the MCDs now enabled:

```bash
node scripts/measure-sensors.js --db --last 12 --expect MCD0          # after step 1
node scripts/measure-sensors.js --db --last 12 --expect MCD0,MCD1,MCD2 # after step 2
node scripts/measure-sensors.js --db --last 12 --expect MCD0,MCD1,MCD2,MCD3 --strict   # after step 3
```

What each answer means is in §4.2. Two things specific to B1:

- **Tier 1 on live data.** The MCDs take the active indicator from the setting (step 2's `active_indicator_settings`,
  M5 `best_fit_a`, M15 `non_b` as seeded). A reading that is INVALID with the reason `NO_SETTING`, or CAUTIONARY
  with `DETECTION_MISMATCH`, says the setting path is not working on live data. A mismatch is expected only when you
  change the setting on purpose (step 2's rehearsal, F4).
- **The newest-row question** (step 2, still open unless B0's measurements settled it): the Phase A loader reads closed
  bars only and a stored bundle makes replay immune to it, but whether the last closed bar's values are final is a live
  fact. `measure-cycles.js` (step 2's kit) prints the ages that settle it.

### 3.4 A stored cycle replays byte for byte (the "done when" proof)

From a laptop **at the same commit as the deployed image** (the engine must be the same version, or the answer is
`VERSION_MISMATCH`), with Python 3.11, PyYAML and jsonschema installed, pick three slots a few hours old:

```sql
SELECT DISTINCT cycle_slot FROM mcd_outputs WHERE symbol = 'XAUUSD' ORDER BY cycle_slot DESC OFFSET 40 LIMIT 3;
```

```bash
cd railway-gateway
DATABASE_URL="<DATABASE_PUBLIC_URL>" node scripts/replay-cycle.js --db --slot 1790985600 --slot 1790985900 --slot 1790986200
```

(unix seconds on a five-minute boundary, or `2026-10-03T00:00Z`). It runs two SELECTs per slot, runs the stored bundle
through the engine with the flags and the RETUNING setting stored on the rows, and compares every envelope with the
stored one, text and SHA-256. **Expect `3 cycle(s): 3 VERIFIED`, exit 0.** Do it again a day later: the point of
the stored bundle is that the answer does not depend on the table holding the same columns any more.

| Verdict                                     | Meaning                                                                      | What to do                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `VERIFIED`                                  | Every envelope equal                                                         | Nothing                                                                                           |
| `VERSION_MISMATCH`                          | An evaluator is not the version that wrote the row                           | Check out the commit that is deployed; not a defect                                               |
| `LOGIC_DIVERGENCE`                          | Same version, inputs as stored, another envelope                             | **Stop.** The evaluator, the kit or the runner is not deterministic, or changed without a version |
| `TAMPERED_BUNDLE`, `STORED_READING_CORRUPT` | A stored bundle or row does not hash to its own hash                         | **Stop.** Say which slot and which reason                                                         |
| `NOT_REPLAYABLE`                            | Nothing stored, the bundle is past its 90 days, or the runner gave no answer | Read the cause printed beside it                                                                  |

A slot delivered twice keeps its **first** bundle: a reading written later from changed data reads as
`TAMPERED_BUNDLE` with the reason `READINGS_NAME_OTHER_INPUTS`, and the finding says so.

---

## 4. B2 — Live latency, and the kit (`measure-sensors.js`)

`railway-gateway/scripts/measure-sensors.js` is **read only**: `--db` runs SELECTs against `DATABASE_URL`; `--redis`
runs three read commands (`ZREVRANGE`, `HGET`, `ZCARD`) against `REDIS_URL` and starts no queue (a Bull queue object
promotes delayed jobs; a measurement must not); `--replay N` runs the part 5 replay on the newest N cycles; `--file`
reads a JSON file and touches nothing. Run it from a checkout with `npm install` done (it loads the TypeScript from
`src/` with `ts-node`).

```bash
cd railway-gateway
# the PUBLIC urls: `railway run` would inject the private ones, which only resolve inside Railway
DATABASE_URL="<DATABASE_PUBLIC_URL>" REDIS_URL="<Redis public URL>" \
  node scripts/measure-sensors.js --db --last 288 --redis --replay 3 --expect MCD0,MCD1,MCD2,MCD3
DATABASE_URL="<DATABASE_PUBLIC_URL>" node scripts/measure-sensors.js --db --since 2026-10-06T00:00:00Z --until 2026-10-07T00:00:00Z --json > day.json
node scripts/measure-sensors.js --file test/fixtures/measure-sensors-sample.json      # the format, on a fixture; no database
```

(Check the Redis service's variable name for its public URL in Railway; the kit only reads `REDIS_URL`.)
`--last N` counts **cycles**, not rows. `--jobs jobs.json` takes the outcomes from a file instead of Redis (an array of
what the worker returns for a job). Without a database connection, export the rows with `psql` as step 2's runbook
does for `market_cycles` and read them with `--file`.

### 4.1 What it prints

| Section                   | Means                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status mix per MCD**    | Rows, and VALID, CAUTIONARY, INVALID, STALE as counts and shares; the flag and evaluator version on the rows; the most common reasons on readings that are not VALID                                                                                                                                             |
| **MCD0 flag rate**        | Of the readings that name a state: M5 flagged, M15 flagged, both, either, none. INVALID and STALE MCD0 rows have no state and are counted apart                                                                                                                                                                  |
| **Errors and violations** | `EVALUATOR_ERROR` readings; rows with guard problems by category (`SCHEMA`, `IDENTITY`, `REASONS`, `REGISTER`, `WORDING`, `RAISED`); a **second look** at every stored envelope: Ajv against the schema and a `%` in a free text                                                                                 |
| **Milliseconds per MCD**  | `duration_ms`: count, min, p50, p90, p99, max, mean, and how many are over the **1 s** budget (standard 11.2)                                                                                                                                                                                                    |
| **Seconds per cycle**     | The MCDs summed (a lower bound); **signal to start** = `evaluated_at − ready_at` (whole seconds, about a second of resolution, includes any retry back-off); **signal to done** = start + the job's wall time when `--jobs` or `--redis` gave it, else + the summed times; how many are over the **30 s** budget |
| **Rows per cycle**        | How many cycles have a row for every expected MCD; the ones that do not, with what they lack; READY cycles with no row before the newest reading, and READY cycles after it (in flight, or the worker is behind)                                                                                                 |
| **Jobs**                  | Outcomes Bull kept for the last 100 completed jobs: written, **skipped as too old**, every MCD off; what the written ones were made from; wall time; failed count                                                                                                                                                |
| **Determinism**           | `DETERMINISTIC`, `NOT_DETERMINISTIC` (a `LOGIC_DIVERGENCE`), `STORED_DATA_DAMAGED`, `VERSION_CHANGED` (a deploy, not a defect), `INCONCLUSIVE`, or `NOT_CHECKED` (no replay was asked for)                                                                                                                       |
| **MCD0 inheritance**      | Cycles with a VALID MCD0 defect; the marks `MCD0_DEFECT_<TF>` the rule requires on each channel MCD (MCD1 on M15, MCD2 on M5, MCD3 on both); which are missing, and which are there with no defect behind them                                                                                                   |
| **Findings**              | One line for each thing a person should look at; `--strict` exits 1 when there is one                                                                                                                                                                                                                            |

### 4.2 What to do with it (Davin)

Nothing here decides anything. Save the output. Reading it:

- **`EVALUATOR_ERROR` or a guard problem** is a reading that was replaced by an INVALID one because the evaluator raised
  or its output failed a guard. The shadow stage's gate is **none**. Find the slot, replay it (§3.4), and bring the
  `guard_problems` text to the Advisor: `SELECT cycle_slot, mcd_id, guard_problems FROM mcd_outputs WHERE
cardinality(guard_problems) > 0 ORDER BY 1 DESC LIMIT 20;`
- **Over a budget.** The 1 s and 30 s are "starting values, to measure" (standard 11.2). If real cycles exceed them, that
  is a decision to record (a new decision entry), not a number to edit. Two caveats: the database never holds when a
  cycle was DONE, so signal to done is an estimate (§4.1); and every cycle is a fresh Python process, so MCD0 (the first
  to run) carries the one-time cost of compiling the schema check (about 0.19 s on the scratch machine, against 6 to 27 ms
  for the others).
- **Skipped jobs.** After B1's first hour there should be none except the backlog drained in §3.2. A job skipped as too
  old later means the worker was down, or a cycle took longer than ten minutes to start.
- **Rows per cycle below the expected count** is a cycle that was written without an MCD: a flag changed mid-window
  (use `--since` at the time of the change, or `--expect` for the set you mean) or a failure.
- **MCD0 flags a timeframe on most cycles.** Expect it: on all three real fixtures MCD0 flags both M5 and M15 (plan
  finding S3), so every channel MCD is CAUTIONARY on those slots. Whether that rate is acceptable, and whether MCD0's
  thresholds should change, is Davin's call at B3, as a **new decision entry and a MINOR evaluator version**, never an
  edit (a new version starts a new statistics series).
- **`market_cycle_inputs` footprint.** The 1.1 to 1.7 GB for 90 days that Davin approved is arithmetic on fixtures.
  Measure it live: `SELECT count(*), pg_size_pretty(sum(octet_length(bundle_gz))) AS gzipped,
pg_size_pretty(sum(bundle_bytes)::bigint) AS raw FROM market_cycle_inputs;`, and again after a week.

---

## 5. B3 — At least five trading days of shadow

The MCD development standard's stage 4 ("Shadow"): the MCD runs every cycle, is saved to `mcd_outputs` with the flag
`shadow`, and is not on the board and not in synthesis. **Exit:** at least 5 trading days, no `EVALUATOR_ERROR`,
the status mix reviewed.

Once a day, for the day just ended, and once at the end of the window over all of it:

```bash
DATABASE_URL="<DATABASE_PUBLIC_URL>" REDIS_URL="<Redis public URL>" \
  node scripts/measure-sensors.js --db --since 2026-10-06T00:00:00Z --until 2026-10-07T00:00:00Z --redis --replay 3 --strict
```

(`--strict` makes it exit 1 on a finding, so a scheduled run can mail you.) At the end, for each MCD, have the
status mix, the MCD0 flag rate, the reasons behind CAUTIONARY and INVALID, the time distribution, and zero of:
`EVALUATOR_ERROR`, guard problems, schema failures on the second look, skipped jobs you cannot explain, missing marks.
A weekend has no market and no cycles; a day with fewer cycles than 288 is normal.

When it holds, checklist item 9 stays `pending` (it also needs B4). Record B3's evidence in each MCD's checklist
file, and tell the Advisor.

---

## 6. B4 — Certification into `state_statistics`

Two tools are missing; both are small builder sessions, to be planned with the B3 numbers in hand:

1. **A command that runs the statistics engine** (`mcd_worker/statistics/`): it takes occurrences and closed M5 bars and
   returns rows; `StateStatisticsWriter.writeRows` stores them. No command wires the two (part 6, section 5).
2. **A point-in-time replay of the MCDs:** certification replays each MCD over `market_data_point_in_time`
   (`snapshot_age_bars = 1`, each bar as it stood at its close), not over today's refit `market_data_v6` (ADR-020, §2.7).
   `CycleReplayer` replays a **stored** cycle; this needs a loader that builds a bundle from the point-in-time table, and
   a runner over thousands of slots (the engine did 25,000 occurrences at both horizons in 3.4 s on synthetic data; the
   replay of the evaluators is the cost, about a second per cycle with Python's start).

**Order (plan §4, B4):**

1. **The forming-bar trace is done** (part 7, read only, all seven centroid regression files; its result is in the part 7
   hand-off and in `waiting-on.md`). What remains is the live comparison the plan describes: a point-in-time value for a
   bar against the same bar one cycle later, to see by how much the forming bar moves the fit. Do it first.
2. Replay the point-in-time history through the evaluators; select the occurrences (the open decisions below); call the
   engine; write the rows. A state below n = 30 keeps its count and no figure: the database refuses a number there.
3. Read the counts. **Decisions Davin settled (part 6):** an outcome needs every M5 bar of its window (a closure leaves the
   occurrence out of n); n counts cycle occurrences, ADR-022 as written. **Open, due here:** which readings count as
   occurrences (a CAUTIONARY reading is a state read through a flagged channel; every channel MCD is CAUTIONARY on the
   real fixtures, so "VALID only" would leave MCD1 to MCD3 almost empty; a reading made while RETUNING is enforced is the
   same question). Decide on the real counts, then record it in architecture §2.8.

`opposing_level_rate` stays NULL until build step 4 defines levels and stops. Every series carries
`FORMING_BAR_FIT: UNVERIFIED` until Davin closes that open item with what the trace found.

---

## 7. Rollback

| What to switch off              | How                                                                                                                                                                                                                                             | What it leaves                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **The whole worker**            | Set `SENSOR_WORKER_ENABLED=false` (or delete the variable) and redeploy; the consumer is **not registered**: no queue consumer, no Python, no write. The jobs wait in Redis again, as before step 3                                             | The rows stay (append-only). Nothing is lost. When it is switched on again, jobs older than 10 minutes are skipped |
| **One MCD**                     | Set its flag to `off` in `mcd_worker/worker_config.yaml` and in its `mcdN_registry.yaml`, run `sync-sensor-kit.js`, push. **From the top of the chain down**: the worker refuses to start if an MCD is higher than one it reads                 | Its rows stay; no new ones                                                                                         |
| An MCD that others read         | MCD3 alone can go off. **MCD1 or MCD2 off means MCD3 off too. MCD0 off means MCD1, MCD2 and MCD3 off too.**                                                                                                                                     | Same                                                                                                               |
| One MCD, **without a deploy**   | Point `SENSOR_WORKER_CONFIG` at a worker configuration that has it `off` and that exists inside the image (ship one beside `worker_config.yaml`: `sync-sensor-kit.js` can copy a second file). A variable change redeploys, it does not rebuild | As above. Not available until the script ships that file                                                           |
| RETUNING enforcement (after B5) | Unset `SENSOR_RETUNING_ENFORCED`; the sensors read the cycle as it is again                                                                                                                                                                     | The rows made under enforcement say so (`retuning_applied`), and replay uses it                                    |
| The image (Python)              | Redeploy the previous Railway build. The worker was off in it by default                                                                                                                                                                        | The tables stay                                                                                                    |
| The migration                   | **Leave it.** The tables are additive and unread by old code. Dropping them is a separate decision, and `mcd_outputs` holds the only record of what the sensors read                                                                            | —                                                                                                                  |

**What a rollback does not undo:** rows already written. `mcd_outputs` is append-only and has no retention; a bad shadow
reading is not deleted, it is superseded by a later version (a new evaluator version starts a new series). Stored bundles
older than 90 days are deleted by the worker after each cycle (only while it runs).

**A failure that is not a rollback:** if the Python interpreter is missing or cannot be found or opened (`ENOENT`, `EACCES`,
`ENOTDIR`), or the runner refuses its request or its configuration (exit 2), the job is **discarded at once and not
retried**: the same input would fail the same way. If the runner crashes or times out, or the database is down or a table
is missing, the job fails and is retried three times (2 s, then 6 s). In every one of these cases **nothing is written and
nothing is invented** for that slot (the kit lists READY cycles with no row). A cycle whose READY row never becomes
readable (or cannot be trusted) is a different case: it is written as STALE rows for every enabled MCD. The gateway's ingest is a different Bull queue and a different handler: a failing sensor
job does not stop a market-data row from landing.

## 8. B5 — After step 6: RETUNING enforced, then `live`

Two separate switches, in this order. Neither is part of the shadow stage.

1. **`SENSOR_RETUNING_ENFORCED=true`** (decision 1 first: how RETUNING ends; step 2's session B found it could last days with
   the real push worker, not hours). Rehearse a promote first (`docs/runbooks/mt5-terminal-promote.md`): expect RETUNING,
   every sensor CAUTIONARY with `RETUNING`, then FRESH again. "During a promote every sensor reports CAUTIONARY" is done
   when that is seen live; it is met on fixtures only until then.
2. **A flag to `live`** needs **all nine** checklist items passed for that MCD: the dispatch-matrix entry and playbook chunk
   (item 7, step 6), the synthesis rows (item 8, step 4) and the measured statistics (item 9, B4). Whether a gate such as
   MCD0 needs items 7 and 8 at all is Davin's to decide in steps 4 and 6. Each flag change is a commit that records its
   evidence in the checklist, and a **decision entry** (standard stage 7, "Go live", **Davin approves**).

## What this runbook does not cover

The prompt side, the board and synthesis (steps 4 to 7); the two missing tools of §6; the Python-in-Nixpacks choice of
§2.1; how many Railway replicas run the worker (it assumes one, concurrency 1); the push worker's real throughput.
