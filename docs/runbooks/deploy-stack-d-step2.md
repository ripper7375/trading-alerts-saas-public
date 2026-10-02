# Runbook — Deploying build step 2 (market data and chart, chapter 1)

**Scope:** putting everything build step 2 built into production, in the one order that is safe:
the database migration, the gateway, the monolith, the VPS files, then the verification, then the
cutover of the active-indicator flag.
**Written:** 2026-10-02, at the close of build step 2 (parts 1 to 10), from the hand-offs in
`docs/handoffs/2026-10-0*-step2-part*.md` and the plan `2026-10-01-2321-step2-plan.md`.
**Who:** Davin. The Executor never applies a migration, deploys, enters a sign-in, or touches the VPS.
**Time:** about two hours of work, plus the wait for the first real cycles (an hour is enough to see
the first ten) and about 30 minutes for the symbol-specs exporter to warm up.
**Outage:** none planned. Every change is additive; an old VPS keeps working against the new gateway,
and the new gateway keeps working with the old VPS.

> **Nothing here has been run against production or the VPS.** Everything was built and tested
> locally (the gateway also against a throwaway embedded Postgres). The first live run is yours; this
> runbook says what to look at and what each answer means. Where a step says "expect", that is the
> expectation from the tests, not an observation.

## The order at a glance

| #   | Step                                     | Why here                                                                                                                                                                         |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Read-only checks                         | They decide which earlier migrations are still pending and **which gateway the VPS talks to**                                                                                    |
| 2   | Migration `20261002000000_…`             | **Before** the gateway: the gateway answers 200 to a manifest or a symbol-spec and then fails the job for a missing table; the sender has already stamped the row, so it is lost |
| 3   | Gateway (`railway-gateway`)              | Auto-deploys from `main`; additive; the 103-field row contract is untouched                                                                                                      |
| 4   | Monolith (Next.js) with the flag off     | Nothing changes for users while `ACTIVE_INDICATOR_FROM_GATEWAY` is not `true`                                                                                                    |
| 5   | VPS files, then the MQL5 exporter        | Collector first (it widens `xauusd.db`), then push worker, then renderer. The gateway must already have the endpoints, or every manifest answers 404 (harmless, but noisy)       |
| 6   | Verify, and measure                      | Four push lanes, the stamp, the admin endpoint, the cycle numbers                                                                                                                |
| 7   | Cutover: `ACTIVE_INDICATOR_FROM_GATEWAY` | Last, and only after the write-key decision (§7)                                                                                                                                 |

**Stop conditions.** Stop, change nothing further, and tell the Advisor if: the push worker targets the
**staging** gateway (§1.1); `prisma migrate status` shows migrations pending that you did not expect
(§1.4); the migration fails part-way (§2); the gateway logs `relation "…" does not exist` after the
deploy (§3). Do not push into a half-deployed state.

---

## 1. Pre-deploy checks (read-only)

Nothing in this section changes anything. Record each answer in
`docs/STACK-D-ARCHITECTURE.md` §0.5 afterwards (the four "documents disagree" rows) and move the
matching item in `.claude/state/waiting-on.md` to `history/resolved-waiting-on.md`.

### 1.1 Which gateway does the VPS push worker target? (blocks everything)

There are **two** `railway-gateway` services: production (project `trading-alerts`) and a second one
still running in the staging project since 2026-08-24. If the VPS pushes to staging, the migration and
the deploy below go to the wrong place and "a real cycle" proves nothing.

On the VPS, in an elevated PowerShell:

```powershell
nssm get MT5PushWorker AppEnvironmentExtra
```

Read `API_GATEWAY_URL` and compare its host with the production service's public domain in Railway
(Settings → Networking). **The output also contains `BACKFILL_API_KEY`: do not paste it into a chat,
a ticket or a file.** If the host is the staging gateway, stop here.

### 1.2 The four "documents disagree" items (§0.5)

| Item                     | Check (read-only)                                                                                                                                                                                                   | If it is not as expected                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Point-in-time migration  | `SELECT to_regclass('public.market_data_point_in_time');` and `SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at DESC LIMIT 8;`                                   | A NULL means the table is missing: the gateway in `main` already writes each bar's snapshot to it, so apply `20260920000000_add_market_data_point_in_time` first |
| `indicator_statistics`   | `SELECT count(*) FROM information_schema.columns WHERE table_name = 'indicator_statistics';` and `SELECT column_name FROM information_schema.columns WHERE table_name = 'market_data_v6' AND column_name = 'sr_9';` | The plan expects 50 statistics columns once the extended migration is applied and `sr_9` once `sr2` is; record what you find                                     |
| Timestamp-fix deployment | The `.ex5` file dates on terminals A and B, and one fresh export's bar time against the chart                                                                                                                       | Source fixed 2026-09-09; the `.ex5` may predate it                                                                                                               |
| Frozen-mode binaries     | The `.ex5` dates and the frozen input on each of the 7 centroid indicators' Inputs tabs                                                                                                                             | One document says 7 compiled on 18 Sep, another that 5 of 7 failed to compile                                                                                    |

These do not block parts of the build, but they decide which migrations are pending, and the next check
needs them.

### 1.3 Which database is the gateway's

The gateway's `DATABASE_URL` is the production Postgres in `trading-alerts`. Your local `.env` and
`.env.local` point at a **staging clone** (`turntable.proxy.rlwy.net:55082`). Run every Prisma command
below that touches a database with `prisma.production.config.ts`, never with the default config: a plain
`prisma migrate deploy` against the default one succeeds, prints "All migrations have been successfully
applied" and touches nothing production reads (it has misled three sessions). The production config
reads only `.env.production.local`: copy `.env.production.local.example` to it, paste Railway →
`trading-alerts` → Postgres → Variables → `DATABASE_PUBLIC_URL` (never `postgres.railway.internal`: it
only resolves inside Railway), and **delete the file when you are done**, it holds a live credential.
The header of `prisma.production.config.ts` has the same steps.

### 1.4 `prisma migrate status`

```bash
npx prisma migrate status --config prisma.production.config.ts
```

**`migrate deploy` applies every pending migration in history order**, not only the one you want. Read
the list first. The Step 2 migration depends on none of the other pending ones, so it can be applied
alone (§2). If anything else is listed as pending that you did not expect, stop and ask.

### 1.5 Decisions you may want to settle first (none blocks the migration or the gateway)

- **A key of its own for writes** (part 6 hand-off, decision 1). As built, `POST /api/v1/active-indicator`
  accepts any key in the gateway's `API_KEYS`, and that list includes the push worker's key. Settle it
  **before the flag goes live (§7)**.
- The part 7 and part 8 questions: the `?slot=` parameter on `GET /api/v1/cycles/current`, the two extra
  stamp keys (`overlay-m15`, `overlay-source`), the image title, the exporter's folder (`mq5/`), UTC
  `captured_at`, `typical_spread` as a 24-hour median. All are built as the hand-offs describe; none is
  needed for the deploy.

---

## 2. Migration

`prisma/migrations/20261002000000_add_cycle_pipeline_tables/migration.sql`: four additive tables, no
foreign keys, two seed rows.

| Table                       | What it holds                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `market_cycles`             | One row per slot: state, status, timings, collector cycle ids, terminal, hashes, `retuning`, the digest |
| `active_indicator_settings` | The active channel indicator per timeframe, append-only. Seeds M15 `non_b` and M5 `best_fit_a` (slot 0) |
| `symbol_specs`              | Broker figures (contract size, volume limits, tick size, typical spread, swaps), append-only versions   |
| `cycle_events`              | `PROMOTE` and `RETUNE_COMPLETE` rows, unique on `dedupe_key`                                            |

It was checked against Prisma's own DDL (`prisma migrate diff`, no drift) and replayed on a local
embedded Postgres. It has not touched any shared database.

**Apply it alone:**

```bash
npx prisma db execute --file prisma/migrations/20261002000000_add_cycle_pipeline_tables/migration.sql --config prisma.production.config.ts
npx prisma migrate resolve --applied 20261002000000_add_cycle_pipeline_tables --config prisma.production.config.ts
```

(If, and only if, `migrate status` shows nothing else pending, `npx prisma migrate deploy --config
prisma.production.config.ts` does the same in one step.)

**Check it (read-only):**

```sql
SELECT to_regclass('public.market_cycles'), to_regclass('public.active_indicator_settings'),
       to_regclass('public.symbol_specs'),  to_regclass('public.cycle_events');   -- all four not NULL
SELECT timeframe, source, effective_slot, set_by FROM active_indicator_settings ORDER BY timeframe;
-- expect: M15 / non_b / 0 / migration   and   M5 / best_fit_a / 0 / migration
```

**If it fails part-way:** the tables are independent and nothing reads them yet, so drop whichever were
created (`DROP TABLE cycle_events, symbol_specs, active_indicator_settings, market_cycles;`) and stop.
Do not deploy the gateway.

---

## 3. Gateway (`railway-gateway`)

**What it adds** (all additive): `POST /api/v1/cycle-manifest`, `GET /api/v1/cycles/current` (with the
optional `?slot=`), `GET` and `POST /api/v1/active-indicator`, `POST /api/v1/symbol-specs`; two Bull
queues, `cycle-ready` and `symbol-specs-sync`; the cycle and symbol-spec processors; promote detection
and RETUNING. One new direct dependency, `ajv` 8.18.0 (exact); no new environment name; the same
`API_KEYS` as the other lanes.

**Deploy:** merge and push to `main` (Railway builds the package alone from Root Directory
`railway-gateway`; **Watch Paths are still unset**, so every push to the monorepo rebuilds it). Before
you push, confirm it builds: `npm run build` in `railway-gateway/`. A redeploy can surface an unrelated
latent build failure; check the build log, not only that a deploy started.

**Verify:**

- `GET /health` answers.
- The Railway logs show the application starting with no `relation "market_cycles" does not exist`
  (that means §2 was not applied: fix it before anything else sends a manifest).
- With a key from `API_KEYS`, `GET /api/v1/cycles/current` answers. Before any manifest has arrived it
  has no cycle (`cycle` is null) and `activeIndicators.basis` is `WALL_CLOCK`, with the two seeded
  settings in `byTimeframe`; that is the expected "empty" answer, not an error.
- `GET /api/v1/active-indicator` (same key) shows the two seeded rows.

**Things to know:**

- **Add the monolith's key now or later:** put a key for the monolith in the gateway's `API_KEYS` (or
  the separate list of §1.5) before §7. Names only are in `docs/secret-matrix.md`; the values are yours
  and never go in the repo.
- **`cycle-ready` jobs have no consumer until build step 3.** They wait in Redis (about 288 a day, small
  payloads). Nothing is wrong; step 3's sensor worker will drain them.
- A manifest job that exhausts its three retries (a database outage longer than the backoff) leaves its
  `market_cycles` row PENDING for good; the readers ignore PENDING rows. The measurement kit counts them.

---

## 4. Monolith (Next.js)

Deploy the app with the feature flag **off**. Set in Vercel (Production), as server-only variables,
**never `NEXT_PUBLIC_`**:

| Name                            | Value                                                                 |
| ------------------------------- | --------------------------------------------------------------------- |
| `MARKET_GATEWAY_URL`            | Base URL of the **production** `railway-gateway`                      |
| `MARKET_GATEWAY_API_KEY`        | The monolith's key (one of the gateway's keys, §3)                    |
| `ACTIVE_INDICATOR_FROM_GATEWAY` | `false` (or leave it unset: only the exact string `true` turns it on) |

**What ships:** the channel route behind the flag, `useMtfOverlay`, `app/api/admin/active-indicator/route.ts`
(admin only, no page), `getChartStamp` and `chartMatchesCycle` in `lib/storage/`, and the `X-Chart-*`
headers on the chart download. With the flag off the channel route behaves exactly as before.

**Verify:** the live build is the new one (a push is not proof of a deploy: check Vercel). Signed in as
an administrator, `GET /api/admin/active-indicator` shows the trail and the earliest slot you may name
(it needs `MARKET_GATEWAY_URL` and the key, so it also proves the monolith reaches the gateway). A PRO
chart download still redirects (307) to a presigned URL exactly as before; the `X-Chart-*` headers
appear only once an image carries a stamp (§6).

---

## 5. VPS files

**Do not run `install_services.bat` to apply any of this.** Batch files do not stop on error, so
re-running it re-executes the `nssm set … AppEnvironmentExtra` lines and overwrites the live services'
real credentials with the file's placeholders (`.claude/architecture/infrastructure.md`). Copy files and
restart services one at a time.

Source folder (in the repo): `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/`. The
`DEPLOY_TO_CONTABO_VPS_READY/` package is older and has no schema file: **do not use it**.

| File (from `v2_29_data_pipeline_architecture/` unless stated)                                                                                            | To (on the VPS)                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `export_collector_validator_v2.py`                                                                                                                       | `C:\Scripts\collector\`                                |
| `sqlite_schema_v6_xauusd.sql` (**required beside the collector**: it creates the outbox tables from it)                                                  | `C:\Scripts\collector\`                                |
| `backfill_worker_api_gateway_v5.py`                                                                                                                      | `C:\Scripts\backfill\`                                 |
| `v2_29_multi-timeframe-visualisation/mtf_render_upload_worker.py`                                                                                        | `C:\Scripts\renderer\`                                 |
| `v2_29_multi-timeframe-visualisation/mtf_render/` (the whole package: `__init__`, `__main__`, `data_source`, `fixture`, `overlays`, `renderer`, `stamp`) | `C:\Scripts\renderer\mtf_render\`                      |
| `mq5/SymbolSpecsExport_v2_29.mq5` (an EA; never compiled by the Executor)                                                                                | each terminal's `MQL5\Experts` (A and B), then compile |

Keep a copy of each file you overwrite (`name.py.pre-step2`) so a rollback is a copy back.

**Optional, cheap:** `xauusd.db` is a replay buffer and an unsynced outbox row is the one thing a
destroy of this VPS loses. Before the collector restarts, stop `MT5Collector`, copy
`C:\Scripts\database\xauusd.db` to `xauusd.db.pre-step2`, then continue. The collector's migration is
additive (new nullable columns, the `cycle_manifests` and `symbol_specs` tables).

### 5.1 The renderer needs two more environment variables

`nssm set … AppEnvironmentExtra` **replaces the whole value**. Read the current one first, then set it
again with everything it had **and** the two new names (the push worker's own values):

```powershell
nssm get MT5Renderer AppEnvironmentExtra        # contains the R2 secrets: read it, do not paste it
nssm set MT5Renderer AppEnvironmentExtra R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=davintrade-renders MTF_DB_PATH=C:\Scripts\database\xauusd.db API_GATEWAY_URL=… BACKFILL_API_KEY=…
```

Without the two new names the renderer still works: it falls back to `RENDER_OVERLAYS` and says so in
the stamp. `MTF_DB_PATH` stays what it is today, the collector's `xauusd.db`, which the renderer only
reads. Never point a test harness or any other read-only consumer at that path with a wrong-shaped
table: it silently stops the collector from promoting cycles (`infrastructure.md`).

### 5.2 Restart order

1. `nssm restart MT5Collector` (it widens `xauusd.db` and creates the new tables). Either order of the
   next two is safe: a worker that meets an old database switches newest-first and the manifest off and
   says so once.
2. `nssm restart MT5PushWorker`.
3. `nssm restart MT5Renderer`.

### 5.3 The symbol-specs exporter, on **both** terminals

Compile `SymbolSpecsExport_v2_29.mq5` in MetaEditor and attach it to **one XAUUSD chart on terminal A
and one on terminal B**. It needs about 30 minutes after being attached (30 spread samples taken while
quotes are live). If it is on only one terminal, promoting to the other stops the broker figures
refreshing with **no error** (`mt5-terminal-promote.md`, gotchas).

---

## 6. Verification

Give it an hour. Every check below is read-only. **"Expect" is the expectation from the tests, not an
observation.**

### 6.1 The four push lanes, in the push worker log

`C:\Scripts\logs\push_worker.log`:

| Lane              | Log line                                                                                       | Gateway side                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Prices + manifest | `✅ Pushed N rows`, `🧾 Manifest built for slot S`, then `🧾 Manifest for slot S acknowledged` | `market_cycles` gains a row per slot                             |
| Statistics        | `📊 Pushed N statistic snapshot(s)`                                                            | `indicator_statistics` rows at each slot                         |
| Economic calendar | `📅 Pushed N economic event(s)`                                                                | `economic_events` (unchanged lane, listed to see it still works) |
| Symbol specs      | `🧮 Pushed 1 symbol spec(s)` (about 30 min after §5.3)                                         | `symbol_specs` gets a row                                        |

`⚠️ Manifest for slot S not delivered (HTTP 404) — will retry` means the gateway does not have the
endpoint yet (§3 not done, or the VPS points at another gateway: §1.1). It retries for an hour and
never quarantines; prices are unaffected.

### 6.2 Cycles are being declared ready

```sql
SELECT slot, state, data_status, ready_at - slot AS slot_to_ready_s, attempts, retuning, terminal_id
FROM market_cycles WHERE symbol = 'XAUUSD' ORDER BY slot DESC LIMIT 12;
```

Expect one row per 5-minute slot, `READY`, `FRESH`, a `slot_to_ready_s` of about a minute or a little
more, `retuning` false, `terminal_id` the folder name of the terminal the collector reads (`MT5-A`).
Statistics at the slot: `SELECT timeframe, count(*) FROM indicator_statistics WHERE captured_at = <slot> GROUP BY 1;`
should equal the manifest's `statistics_count` (3 for M5 on an M5-only slot).

### 6.3 The newest-row question (settles an open item)

Is the newest row at slot time the stub of the bar that just opened, or the bar about to close? It is
**unverified** (`waiting-on.md`). Read-only, on the VPS, once the new collector has run a few cycles:

```sql
-- sqlite3 C:\Scripts\database\xauusd.db
SELECT cycle_time, timeframe, attempt, export_mtime - cycle_time AS export_vs_slot_sec,
       cycle_time - newest_bar_ts AS slot_minus_newest_sec
FROM collection_cycles WHERE status = 'validated' AND export_mtime IS NOT NULL
ORDER BY cycle_time DESC LIMIT 30;
```

For M5, `slot_minus_newest_sec` of **0** is the stub of the bar that just opened (the document's reading);
**300** is the bar that closes at the slot, and a negative `export_vs_slot_sec` says it was exported
before the boundary. The measurement kit (§6.6) prints the same two numbers from the gateway's side
(`newest M5 bar age at the slot`, `M5 export written, vs slot`); they should agree. If it is 300, bring
it to the Advisor: the options are in the plan, §2 finding 1.

### 6.4 The chart stamp

After the renderer has run one cycle: `MT5Renderer`'s log has `uploaded … slot S, overlay M5 x / M15 y (setting)`.
The R2 object `xauusd/mtf_render_xauusd_m5_m15_overlay.png` should carry `cycle-slot`, `last-closed-bar`,
`overlay`, `variant` and `rendered-at` as `x-amz-meta-*` (plus `overlay-m15` and `overlay-source`). The
bucket is **private and must stay private**; read the metadata with your own credentials
(`aws s3api head-object` against the R2 endpoint), not by making anything public. Signed in as a PRO user,
`GET /api/chart/download` redirects (307) and its response carries `X-Chart-Slot`. A browser script
cannot read headers of a followed redirect: use `curl -i` or the network tab.
`chartMatchesCycle` has no caller until step 3, so nothing refuses a mismatched image yet.

### 6.5 The active-indicator admin endpoint

As an administrator: `GET /api/admin/active-indicator` returns the trail (the two seed rows,
`set_by: migration`) and the earliest slot you may name. The gateway's `GET /api/v1/active-indicator`
(with a key) shows the same. **Do not write a setting to test it** unless you mean it: a change at slot T
flips the overlay for everyone when the cycle of slot T is ready.

### 6.5a One rehearsal (§1.8 asks for it; terminals A, B and S are still "Not yet" in §0.5)

Switch the indicator at a future slot through the admin route and watch the overlay and the downloaded
chart change at that slot and not before (`/api/market-data/channel` and the image). And, when a second
terminal exists, rehearse a promote during a market close with `docs/runbooks/mt5-terminal-promote.md`:
the first manifest from the new terminal writes a `PROMOTE` row, the cycles are RETUNING, and the count
of pre-promote rows falls (that runbook, §4, has the queries).

### 6.6 Measure real cycles (the kit)

`railway-gateway/scripts/measure-cycles.js` reads `market_cycles` and prints the numbers §1.8 asks for.
It is **read only**: `--db` runs one `SELECT` against the database in `DATABASE_URL`; `--file` reads a JSON
file and touches no database. Run it from a checkout with `npm install` done (it loads the TypeScript
straight from `src/` with `ts-node`).

```bash
cd railway-gateway
# production: the PUBLIC url of the Postgres (Railway -> Postgres -> Variables -> DATABASE_PUBLIC_URL).
# `railway run` would inject the private postgres.railway.internal address, which does not resolve from a laptop.
DATABASE_URL="<DATABASE_PUBLIC_URL>" node scripts/measure-cycles.js --db --last 288      # the newest 288 cycles, a day
DATABASE_URL="<DATABASE_PUBLIC_URL>" node scripts/measure-cycles.js --db --since 2026-10-03T00:00:00Z --until 2026-10-04T00:00:00Z --json > day.json
node scripts/measure-cycles.js --file test/fixtures/measure-cycles-sample.json   # the format, on a fixture; no database
```

Without a database connection, export the rows with `psql` and read the file:

```bash
psql "$DATABASE_PUBLIC_URL" -At -c "SELECT json_agg(t) FROM (SELECT symbol, slot, state, data_status, attempts, manifest_received_at, ready_at, collector_started_at, collector_validated_at, m5_newest_bar_ts, m15_newest_bar_ts, m5_export_at, m15_export_at, retuning, backlog_rows, repush_rows_unsent, terminal_id FROM market_cycles WHERE symbol = 'XAUUSD' ORDER BY slot DESC LIMIT 576) t" > cycles.json
node scripts/measure-cycles.js --file cycles.json
```

What it prints, in seconds, with count, min, p50, p90, p99, max and mean (nearest-rank percentiles):

| Line                                  | Means                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `slot to ready (READY)`               | `ready_at - slot`: the number ADR-012's thresholds (2 min, 4 min with retries) are about                          |
| `slot to manifest received`           | `manifest_received_at - slot`: how long until the manifest arrived (collector plus push worker plus transport)    |
| `gateway: received to ready`          | `ready_at - manifest_received_at`: the gateway's own time (the landed-row check, the digest)                      |
| `collector validated, after slot`     | `collector_validated_at - slot` (VPS clock)                                                                       |
| `manifest after validated (2 clocks)` | `manifest_received_at - collector_validated_at`: crosses two clocks, so it carries any skew between them          |
| `M5 export written, vs slot`          | `m5_export_at - slot`; negative means the export was written before the boundary (the count is flagged `below 0`) |
| `newest M5 / M15 bar age at the slot` | `slot - newest bar's open time`; **0** the stub, **300 (M5)** or **900 (M15)** the bar that closes at the slot    |

Then the same ages as a table of values (the quickest way to read the stub question), the ADR-012
deadlines against what happened (`N of M within`), the RETUNING episodes (how many, how long, whether one
is still on), the status split (`FRESH`, `DELAYED`, `INCOMPLETE`, `PENDING`; `RETUNING` overlaps them) and
the cycles per terminal. A `PENDING` cycle is a manifest whose job exhausted its retries.

**What to do with it (Davin).** Save the output. If the numbers support the ADR-012 starting values (ready
within 2 minutes, 4 with retries, STALE after 10), say so; if not, record a **new decision entry** naming
ADR-012 with the confirmed or replaced values, then change `railway-gateway/src/cycle/thresholds.ts` (one
file, one line each). The thresholds stay unconfirmed until then. Step 3 starts only after live evidence
is recorded (plan, decision 6).

### 6.7 What is still evidence you owe (§1.8)

| §1.8 item                       | Live proof                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| One real cycle, measured        | §6.6 on real cycles                                                                                           |
| Indicator switch in one slot    | §6.5a, one rehearsal                                                                                          |
| Newest bars first under backlog | Throughput, measured live (ADR-013): `backlog_rows` in `market_cycles`, and how fast it falls after a restart |
| A rehearsed promote is visible  | §6.5a, with a second terminal                                                                                 |
| Chart stamp enforced            | The "stays out of the prompt" half is step 7's; here only that the stamp is on the image (§6.4)               |

---

## 7. Cutover

Only now, and only when §6 looks right and the write-key decision (§1.5) is made.

1. Set `ACTIVE_INDICATOR_FROM_GATEWAY=true` in Vercel (Production). **A server environment variable
   change takes effect on a new deployment**: redeploy.
2. Check: `/api/market-data/channel` resolves the indicator from the gateway (the channel route answers
   with the setting's source for the timeframe), the overlay follows it, and the admin `GET` still shows
   the trail. With `MIGRATE_MARKET_DATA_CHANNEL=true` the route resolves the setting first and forwards
   the indicator to `operation-service`, which does not know `fractal_edt`: with the fractal EDT active
   that path answers 400. That flag defaults off; leave it off.
3. To change the indicator later: `POST /api/admin/active-indicator` as a signed-in administrator with
   `{ "timeframe": "M5", "source": "cherry_a", "effectiveSlot": <a future slot, unix seconds, a multiple of 300>, "reason": "…" }`.
   "At T" means when the cycle of slot T becomes READY (about a minute after T), and the overlay shows it
   at its next refresh, within 90 seconds after.

**Rollback:** set `ACTIVE_INDICATOR_FROM_GATEWAY` to `false` and redeploy: the route returns to the
request's `variant` (default `best_fit_a`). The setting rows stay (they are append-only) and harm nothing.

---

## Rollback by layer

| Layer     | How                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flag      | `ACTIVE_INDICATOR_FROM_GATEWAY=false`, redeploy                                                                                                                                 |
| Monolith  | Redeploy the previous Vercel build; the new env names are ignored by the old code                                                                                               |
| VPS       | Copy the `.pre-step2` files back and restart in the same order; the old files ignore the new tables and columns. Remove the exporter from the charts if you want it gone        |
| Gateway   | Redeploy the previous Railway build; the tables stay and are ignored. Manifests then answer 404 and the sender retries for an hour, so roll the VPS back too if it will be long |
| Migration | Leave it. The tables are additive and unread by old code. Dropping them is a separate decision                                                                                  |

## What this runbook does not cover

The sensor worker that consumes `cycle-ready` jobs (build step 3), the prompt side that drops a chart from
another slot (step 7), a second set of terminals, the push worker's real throughput (a measurement, not a
fix), and ADR-015 items 4 and 5 (frozen fit as a quality signal, watchdog alerts as events), which are not
part of step 2.
