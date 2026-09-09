# Append-Only Statistic Capture — End-to-End Scope

**Status:** ✅ **IMPLEMENTED** 2026-09-09, every layer below built and verified. This document is
now the design record for what was built, not a proposal — the scope it describes was approved by
Davin and executed without deviation.
**Migration applied 2026-09-09** by Davin (`npx prisma migrate deploy`) — `indicator_statistics`
and `indicator_configs` now exist. What remains is deployment, not development: the recompiled
`.ex5` and the updated collector/push worker must reach the VPS before any statistic is actually
emitted or sent. See §11.
**Written:** 2026-09-09.
**Covers:** every layer — MT5 indicators → collector → SQLite → push worker → gateway contract →
Railway Gateway (controller/queue/processor) → Prisma → PostgreSQL.

---

## 1. What this is, and what it is not

**Is:** a second, parallel data path that captures each indicator's `_Statistic.txt` — the
fit-quality snapshot it already writes every minute and that nothing currently reads — into an
**append-only** table in PostgreSQL.

**Is not:** any change to `market_data`. That table, its 87-field contract, both Prisma schemas,
the generated DTO and the existing push path are **untouched**. The two paths share nothing but the
collector process and the API key.

**Why it matters:** these files are the *only* source of the fit-quality substrate — R², MSE,
variance ratio, skewness, kurtosis, containment rate, window size, touch counts. **None of it
exists in `market_data` and none of it can be honestly reconstructed later** (see
`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`). It is what
`v2_29_davintrade_decision_layer/DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` §2.1 calls the fitness
substrate, and its §8 build order starts with the component that consumes it.

## 2. The one design decision that defines everything else

`market_data` is keyed by **`(symbol, timeframe, timestamp)`** — *which bar*. Re-pushing the same
bar collides and overwrites. Mutable by design, and correct for live charting.

The statistics table is keyed by **`(symbol, timeframe, source, captured_at)`** — *which fit, and
when it was observed*. `captured_at` is new on every cycle, so a new row never collides with an old
one. **Nothing is ever overwritten.**

That single choice is what makes it point-in-time honest: it records what the model believed at a
moment, permanently, rather than only what it believes now.

---

## 3. Layer-by-layer scope

### 3.1 MT5 indicators — ✅ ALREADY DONE (2026-09-09)

All 10 statistic-emitting indicators now write a complete, comparable field set. No further MQL5
work is required for this feature.

| Source | Blocks emitted |
| --- | --- |
| 7 × centroid | params · `[MODEL A; CROSSINGS]` · `[MODEL B; CLOSE PRICE]` · `[EDT CHANNEL]` |
| `2EDTFractalBestFitv5` | params · resolved line · `[MODEL B; CLOSE PRICE]` · `[EDT CHANNEL]` |
| `SingleBestResistance/Supportv3` | params · resolved line · `[MODEL B; CLOSE PRICE]` |

⚠ Still pending from the earlier session: **these are uncompiled.** They take effect only once
Davin rebuilds all 13 in MetaEditor and redeploys the `.ex5`.

### 3.2 Collector — new parsing + staging

`export_collector_validator_v2.py`. The statistic files sit in the same `MQL5/Files/` directory as
the timeseries exports, named `{prefix}_{SYMBOL}_{TF}_Statistic.txt`.

**New `STAT_SOURCES` registry** — the 10 sources and their block layout, alongside the existing
`SOURCES`.

**New `parse_statistic_file()`** — the format is `Key: Value` lines with `[SECTION]` headers and
blank-line separators. Four real parsing hazards, all seen in actual files:

1. **The files are written `FILE_ANSI`, so the em-dash in section headers is mangled** — real
   captured files contain `[FRACTAL BEST-FIT ? PARAMETERS]`. Match on a section *prefix*
   (`[FRACTAL BEST-FIT`), never the full literal.
2. Keys contain digits and punctuation — `Total 171 Crossings (n)`, `Raw Slope (b)`,
   `Sample (n)`. Split on the **first** `:` only.
3. Two `[MODEL …]` sections both contain a key called `Sample (n)`, `R-Square`, etc. — keys are
   **only unique within a section**, so the parser must be section-aware.
4. Values can be empty (`UOEDT Offset: ` with nothing after it, when the line was not resolved) →
   `None`, never `0`.

**Where it hooks in:** a new step at the end of `run_cycle()`, **only for cycles that pass
VALIDATE**. Rejected cycles produce no statistics row, which conveniently guarantees one row per
`(source, cycle)` and removes any retry-collision question.

**`captured_at`:** use the collector's own `cycle_time` (the 5-minute slot). Deterministic, joins
cleanly to `market_data.timestamp`, and identical across all 10 sources in a cycle so they can be
compared as one observation. Also record `live_bar_ts` — the newest timestamp in that source's
*timeseries* file — which ties the fit to the exact bar it was anchored at. Both are cheap; record
both.

**Failure isolation (important):** a statistics parse/stage failure must **never** reject the cycle
or block the `market_data` path. Wrap in try/except, log, continue.

### 3.3 SQLite — outbox only, NOT append-only here

`sqlite_schema_v6_xauusd.sql` gains one table.

**Critical distinction:** append-only applies to **PostgreSQL**, the archive. On the VPS, SQLite is
a bounded buffer by design (see blueprint §5.3) and must stay that way. So:

- `indicator_statistics` staged with a `synced_at` column, same outbox pattern as `market_data`
- **Deleted once synced and older than a short retention window (suggest 7 days)** — a replay
  buffer, not an archive. Unsynced rows are never deleted, same guarantee as `market_data`.
- Reuses `migrate_raw_tables()`'s idempotent `ALTER TABLE ADD COLUMN` approach for future columns.

### 3.4 Push worker — separate outbox, separate endpoint

`backfill_worker_api_gateway_v5.py` gains a second drain loop.

- Selects `WHERE synced_at IS NULL` from `indicator_statistics`, POSTs to a **new endpoint**, stamps
  `synced_at` on 200/201. Same 400-quarantine poison-row guard.
- **Must not share a failure domain with market_data.** If the statistics endpoint is down, the
  `market_data` drain continues unaffected. Separate quarantine file.
- Volume is ~160 rows/hour versus `market_data`'s thousands, so it should be a **secondary
  priority** in the loop — and note this interacts with
  `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`: do not let statistics consume budget the market-data
  drain already lacks. Batch these (they are small and low-frequency) rather than one POST per row.

### 3.5 Gateway contract — a new schema file

New `gateway_contract_indicator_statistics.schema.json`, mirroring the existing market-data contract
file's structure. Feeds a new generated DTO via the same mechanical generator pattern
(`scripts/generate-market-data-dto.js` → add a sibling, or parameterise it).

**The 87-field market-data contract is not touched.** `dto-contract.spec.ts`'s `toBe(87)` and the
push worker's `assert len(EXPECTED_CONTRACT_FIELDS) == 87` both remain valid.

### 3.6 Railway Gateway — new controller, queue, processor

Follows the existing pattern exactly (`gateway/market-data.controller.ts` →
`market-data-sync` queue → `worker/market-data.processor.ts`):

- `IndicatorStatisticsController` at `POST /api/v1/indicator-statistics`, `@UseGuards(ApiKeyGuard)`
- New Bull queue `indicator-statistics-sync` with the same `attempts: 3` / exponential backoff
- `IndicatorStatisticsProcessor` with **`@Process({ name: 'process', concurrency: 1 })`** — the name
  must match the `queue.add('process', …)` call. The existing processor carries a comment about a
  2026-07-05 audit finding where a mismatched name left jobs failing while the gateway still
  returned 200; do not repeat it.
- Idempotency: `jobId = ${symbol}_${timeframe}_${source}_${captured_at}`, matching the upsert key.
- The processor upserts on that key. Retries deliver identical content, so this is idempotent
  without making history mutable.

### 3.7 Prisma + PostgreSQL — the new model

Added to **both** `prisma/market-data/schema.prisma` (the monolith, which owns the migration) and
`railway-gateway/prisma/schema.prisma` (mirror). ⚠ `railway-gateway/test/schema-sync.spec.ts`
currently only diffs the `MarketDataV6` model — **extend it to cover the new model too**, or the
mirror can silently drift.

`operation-service` needs **no change** — its narrow mirror exists only for the alert-checker's
price lookups.

Migration authored under `prisma/migrations/`, **not applied**, per standing rule. It is purely
additive (`CREATE TABLE`), so unlike the provenance `SET NOT NULL` migration it carries no risk to
existing rows.

---

## 4. The schema

Two tables. Splitting configuration out of the fact table is deliberate — see §5.

```prisma
/// Append-only. One row per (source, timeframe, collection cycle). NEVER updated
/// except by an idempotent re-push of identical content. This is what makes the
/// series point-in-time honest, unlike market_data_v6 which is mutable by design.
model IndicatorStatistic {
  id             String   @id @default(cuid())

  // identity + when observed
  terminal_id    String
  symbol         String
  timeframe      String
  source         String   // best_fit_a | best_fit_b | cherry_a | cherry_b |
                          // most_recent | non_a | non_b | fractal_edt |
                          // resistance | support
  captured_at    Int      // unix — the collector cycle slot
  live_bar_ts    Int      // newest bar in that export; joins to market_data_v6.timestamp
  cycle_id       Int

  // resolved line — all 10 sources
  solution_found Boolean?
  raw_slope      Float?
  anchored_y_int Float?
  regression_angle Float?
  line_origin_ts Int?
  touches        Int?

  // window
  window_start_ts Int?
  window_end_ts   Int?
  window_bars     Int?    // centroids: Observation Window (Box B Bars)
  math_lookback   Int?    // centroids: Math Search Window (Bars)
  crossings_n     Int?    // centroids only

  // [MODEL A; CROSSINGS] — centroids only
  model_a_n         Int?
  model_a_r2        Float?
  model_a_mse       Float?
  model_a_var_ratio Float?
  model_a_skew      Float?
  model_a_kurt      Float?

  // [MODEL B; CLOSE PRICE] — all 10
  model_b_n         Int?
  model_b_r2        Float?
  model_b_mse       Float?
  model_b_var_ratio Float?
  model_b_skew      Float?
  model_b_kurt      Float?

  // [EDT CHANNEL] — centroids + fractal only (single lines have no channel)
  uoedt_offset      Float?
  loedt_offset      Float?
  containment_n     Int?
  containment_count Int?
  containment_rate  Float?

  // which configuration produced this fit (see §5)
  config_hash    String
  config         IndicatorConfig @relation(fields: [config_hash], references: [config_hash])

  createdAt      DateTime @default(now())

  @@unique([symbol, timeframe, source, captured_at])
  @@index([symbol, timeframe, source, captured_at])
  @@index([source, captured_at])
  @@map("indicator_statistics")
}

/// The indicator's input parameters, deduplicated. Config changes rarely, so
/// storing it inline would repeat the same blob ~1M times a year. A row appears
/// the first time a configuration is seen; a NEW config_hash appearing is itself
/// the drift signal the decision layer wants ("someone re-anchored the window").
model IndicatorConfig {
  config_hash String   @id            // sha256 of the normalised params block
  source      String
  params      Json                    // verbatim key/value from the file's params section
  first_seen  Int                     // unix
  createdAt   DateTime @default(now())

  statistics  IndicatorStatistic[]
  @@map("indicator_configs")
}
```

**Why not one wide table with every parameter as a column?** The three source families have
genuinely different parameter sets (centroids: `Regression Centroids`, `Excluded Recent`,
`Time-Decay Lambda`; lines: `Fractal Bars`, `Min Touches`, `Tolerance Type`, `Extend To Current`).
A union would be ~35 mostly-null columns. Metrics stay first-class and indexable; configuration
goes in JSON where its shape can vary.

---

## 5. Volume, and why config is separated

| | |
| --- | --- |
| Sources emitting statistics | 10 |
| M5 cycles | every 5 min → 12/hour |
| M15 cycles | every 15 min → 4/hour |
| **Rows per hour** | (12 + 4) × 10 = **160** |
| **Rows per year** (~115 market-hours/week) | **≈ 960,000** |

Trivial row count for PostgreSQL. But storing the params JSON inline on every row would repeat an
identical ~300-byte blob a million times a year for **no information gain** — the configuration is
compiled into the `.mq5` and changes only when Davin edits and redeploys.

Hence `config_hash` + `IndicatorConfig`. The fact table stays lean numerics, and **a new
`config_hash` appearing is itself a first-class event**: it means the indicator's configuration
changed, which is precisely the drift signal §3.1 of the decision-layer blueprint asks for. That
falls out of the design for free.

**Write every cycle, do not deduplicate identical metrics.** The centroid fits change every cycle
anyway (sliding window), so dedup would rarely fire — and "the fit did not change" is itself
information worth having on the timeline.

---

## 6. Open decisions — RESOLVED (all five built as recommended)

1. **Retention in PostgreSQL.** ~1M rows/year, no pruning proposed. Keep forever, or cap at N
   years? Recommend keep forever initially; it is small and the whole point is history.
2. **SQLite retention window.** Proposed: delete synced rows after 7 days. Longer = bigger replay
   buffer, more VPS disk.
3. **Batch vs single POST.** Recommend batching (10 rows per cycle naturally group into one
   request). This differs from the market-data path's one-row-per-POST and is a good chance to
   prove the batch pattern before applying it there (see the throughput open issue).
4. **Does the monolith need read access now**, or is populating the table enough for this phase?
   Recommend: populate only. No API surface until the decision layer actually consumes it.
5. **Backfill.** There is no history to backfill — statistics have never been captured. The series
   starts empty and accumulates from go-live. Worth stating so nobody expects historical depth.

---

## 7. Effort and sequencing

| Phase | Work | Depends on |
| --- | --- | --- |
| 0 | MetaEditor rebuild of all 13 indicators | — (already required for the timestamp fix) |
| 1 | Contract JSON + generated DTO + Prisma models (both) + authored migration | 0 |
| 2 | Gateway controller + queue + processor + tests | 1 |
| 3 | SQLite table + collector parser/staging | 1 |
| 4 | Push-worker second drain loop | 2, 3 |
| 5 | Deploy VPS + gateway; verify a real green cycle | 4 |

Phases 2 and 3 are independent and can be done in either order. Each is a contained,
independently testable unit — no phase leaves the pipeline broken.

**Actual:** phases 1–4 are complete and verified (§9). Phase 0 (MetaEditor rebuild) and phase 5
(deploy + migration) remain, and both are Davin's — see §10 and §11.

## 8. What must not break

- **`market_data` is untouched.** No change to its 87 fields, its contract, its Prisma models, its
  DTO, or its push path. If this feature is deleted tomorrow, the pipeline is unaffected.
- **Statistics must never block market data.** Separate outbox, separate queue, separate quarantine,
  isolated exception handling in the collector. A statistics failure is a logged warning, not a
  rejected cycle.
- **SQLite must stay bounded.** Append-only belongs in PostgreSQL only; the VPS keeps a short
  replay buffer and prunes synced rows.
- **Append-only means append-only.** The only permitted write to an existing row is an idempotent
  re-push of byte-identical content. If a future requirement wants to *correct* a row, that is a
  new row with a later `captured_at`, not an update.
- **`schema-sync.spec.ts` must be extended** to cover the new model, or the gateway's Prisma mirror
  will silently drift from the monolith's.

## 9. Verification — results

Every item below was executed, not planned. ✅ = passed as written.

- ✅ **Parser** against the real captured `_Statistic.txt` files in
  `mock-data-from-indicators/golden_certification/m5_statistic/` — all three source families,
  plus a synthetic new-format file carrying the FILE_ANSI-mangled em-dash header. The real files
  pre-date the `[EDT CHANNEL]`/`[MODEL B]` additions, so those fields correctly parse to `None`
  rather than to `0` — the distinction that matters, since a `0.0` R² is a real value and a
  missing one is not.
- ✅ **Schema:** applied to a throwaway SQLite DB — `indicator_statistics` has 37 columns,
  `market_data` still has exactly **87**, and every column the collector writes exists in the
  table (checked by diffing the collector's own insert keys against `PRAGMA table_info`, so it
  cannot drift).
- ✅ **Append-only proof:** two consecutive cycles (`captured_at` 1000, then 1300) with one
  source's R² deliberately changed in between. Result: 20 rows, not 10. The first cycle's value
  is **unchanged**, and the second recorded the new value as a separate row — the property the
  whole design exists for. Re-staging the *same* `captured_at` is idempotent (still 20 rows),
  so a retry cannot duplicate.
- ✅ **Config deduplication:** an unchanged indicator configuration yields a stable
  `config_hash` across cycles, and the distinct-hash count stays far below the row count — so a
  *new* hash appearing is a genuine "someone reconfigured this indicator" signal rather than noise.
- ✅ **Payload shape:** every field the push worker sends is present in
  `gateway_contract_indicator_statistics.schema.json`, with all `required` fields populated —
  verified against real staged rows, not a hand-written fixture.
- ✅ **Isolation proof:** with the statistics endpoint dead, `push_statistics()` swallows the
  failure, returns 0, and leaves all rows unsynced for retry — nothing lost, nothing raised into
  the `market_data` drain.
- ✅ **Gateway:** unit **31/31**, e2e **17/17** (both suites), including auth, malformed payload,
  and idempotent re-post returning the same jobId. `schema-sync.spec.ts` extended from 3 to 11
  tests, now covering both new models plus an explicit append-only invariant (the unique key must
  include `captured_at`; the model must have no `@updatedAt`).
- ✅ **Regression, all at baseline, zero drift:** monolith `tsc` clean + `test:ci`
  **171/171 · 2416/2416**; railway-gateway `tsc` clean, **3/3 · 31/31** and **2/2 · 17/17**;
  operation-service **43/43 · 401/401**.
- ✅ **Postgres migration applied** 2026-09-09, after this verification passed. See §11.

### One design fix found during verification

The Prisma models originally declared **both** `@@unique([symbol, timeframe, source, captured_at])`
and `@@index(...)` on the identical column list. Postgres backs a unique constraint with a btree
index on exactly those columns, so the second one was pure duplicated write cost — on a table
designed to grow ~1M rows/year and never be updated. Removed from both schemas and from the
migration SQL; the unique key alone serves the "this indicator over time" read path.

## 10. What was NOT verified, and why

- **A live MT5 → Postgres round trip.** The indicators must be recompiled in MetaEditor and the
  `.ex5` redeployed to the VPS before any of the new `_Statistic.txt` blocks are actually emitted;
  that is Davin's step, and it is already the gating item for the timestamp fix. Everything up to
  that boundary is verified against real captured files.
- **The migration against a disposable Postgres container.** Docker Desktop's Linux engine would
  not come up healthy in this environment (the named pipe answered, the backend did not). Unlike
  the 2026-09-03 `best_fit` **rename** — which genuinely needed a container to prove losslessness
  against real rows — this migration is two `CREATE TABLE`s that touch nothing existing, so the
  risk it would have caught is close to nil. Flagged rather than skipped silently.

## 11. Deployment status

**Done — migration applied 2026-09-09.** `npx prisma migrate deploy` created
`indicator_statistics` and `indicator_configs`. Two side effects of that run worth recording,
because `migrate deploy` applies every pending migration rather than a chosen one:
`20260909000000_market_data_v6_provenance_not_null` and the unrelated
`20260904120000_default_theme_light` were also pending and went in with it. The provenance one is
the only one that carried a caution, and its clean apply is itself the proof it was safe —
`SET NOT NULL` errors out if any row violates it.

**⚠ Confirm which database.** The run resolved `DATABASE_URL` from `.env.local` to
`turntable.proxy.rlwy.net:55082`. Per the 2026-09-01 incident in `CLAUDE.md`, the Postgres
reachable through `.env.local` was then a **separate Railway project named "postgre for staging"**
— production's own URL was internal and had to come from the Railway dashboard. If that is still
true, production is unmigrated and will still reject statistics POSTs.

**Still to deploy (VPS side, nothing here is live yet):**

1. **Recompile the 10 statistic-emitting indicators** and copy the `.ex5` to the terminal — until
   this happens the new `[EDT CHANNEL]` / `[MODEL B]` blocks are not written at all, so there is
   nothing to capture. ⚠ **The binaries on disk are already one build behind:** all 13 were
   compiled 2026-09-09 ~13:45, but the statistic blocks were added at 14:52–14:54, after that
   build. Deploying them would silently produce statistics rows with every new field NULL — the
   parser correctly reads *missing* as NULL rather than 0, so nothing would error and nothing
   would look wrong. Check that a fresh `_Statistic.txt` actually contains an `[EDT CHANNEL]`
   section before trusting a green cycle.
2. Deploy the updated `export_collector_validator_v2.py` + `sqlite_schema_v6_xauusd.sql` and
   restart `MT5Collector` — this creates the statistics outbox on first start.
3. Deploy the updated `backfill_worker_api_gateway_v5.py` (the second drain loop).
4. Confirm a real green cycle in **both** lanes: price rows reaching `market_data_v6`, statistics
   rows reaching `indicator_statistics`.
