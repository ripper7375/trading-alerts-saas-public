# V2.29 Data Pipeline — Updated Architecture Summary

**Purpose:** source material for a presentation deck. Replaces a previous deck built on the
79-column / 12-indicator / 5-stage design.
**As of:** 2026-09-09. **Symbol/timeframes in scope:** XAUUSD, M5 and M15 only.
**Audience:** stack-development team and stakeholders.

> **Note for whoever builds the deck:** each numbered section below is intended to become one
> slide. Each gives the headline message, the visual to draw, and speaker-note detail. Section 1
> is the "what changed" opener; sections 2–8 are the architecture; 9–11 are status and risk.
> ASCII diagrams are sketches of intent — redraw them properly as boxes and arrows.

---

## 1. What changed (opening slide)

Five things changed versus the previous deck. Everything else is unchanged.

| | Previous deck | Current |
| --- | --- | --- |
| MQL5 indicators | **12** | **13** |
| `market_data` columns | **79** | **87** |
| Pipeline stages | **5** (COLLECT → ADJUST → VALIDATE → **CALCULATE** → PROMOTE) | **4** (COLLECT → ADJUST → VALIDATE → PROMOTE) |
| Who calculates the indicators | MT5 **and** a Python calc stack | **MT5 only** |
| Indicator fit quality (R², MSE, containment…) | **Written to disk every minute, read by nobody** | Captured into a new **append-only** table |

Two of these (12→13, 79→87) came from splitting the `best_fit` centroid variant into
`best_fit_a` / `best_fit_b` on 2026-09-03. The rest are the 2026-09-09 work.

**One-line story for the slide:** *"MQL5 now computes every value; the pipeline transports it —
and, for the first time, records how good each fit actually was."*

**Speaker note:** the fifth row is the one worth dwelling on. The indicators have always written
`_Statistic.txt` companion files describing how well each line fits the data; nothing had ever
read them, so each was overwritten a minute later and lost forever. That history cannot be
reconstructed after the fact (see §5b), which is why capture had to start now rather than when
something needs it.

---

## 2. Physical topology (no component moved)

Same machines, same services as before. The only addition is a **second, parallel lane** through
them for statistics — drawn below the price lane.

```
┌─ Contabo Windows VPS ──────────────────┐        ┌─ Railway ──────────────────────┐
│                                        │        │                                │
│  MT5 Terminals ──► Indicator Text      │        │   NestJS API ──► Pgbouncer     │
│       │            Exports (13 .txt)   │        │   Gateway           │          │
│       │                   │            │        │    ▲    ▲           ▼          │
│       │              ★ collector       │        │    │    │        Postgres      │
│       │                   ▼            │        │    │    │   ┌────────────────┐ │
│       └──────────────► SQLite ──► Push ─┼────────┼────┘    │   │ market_data_v6 │ │
│                      (xauusd.db)  Worker│        │         │   │ indicator_     │ │
│                           │             │        │         │   │   statistics ◄─┼─┤
│  Statistic Exports ───────┘             │        │         │   └────────────────┘ │
│  (10 _Statistic.txt) ──► statistics ────┼────────┼─────────┘                      │
│                          outbox         │        │                                │
└─────────────────────────────────────────┘        └────────────────────────────────┘

★ = Cross-verification + timestamp adjustment
```

**Speaker note:** the star previously also implied "and calculation." It no longer does — the
collector validates and forwards, nothing more.

**The design rule behind the second lane:** it shares nothing with the price lane except the
collector process and the API key. Separate staging table, separate outbox, separate HTTP route,
separate queue, separate processor, separate reject file. **Statistics are valuable; price data is
load-bearing** — so a failure in the statistics lane must never be able to delay or reject a
price row. This was proven by test, not just intended: with the statistics endpoint pointed at a
dead port, the `market_data` drain is completely unaffected.

---

## 3. The pipeline — now 4 stages

```
MT5 TERMINAL (XAUUSD M5 / M15 charts)
13 MQL5 indicators compute every value ──► auto-export .txt to MQL5/Files/  (every minute)
                                   │
                                   ▼  (13 .txt files)
PYTHON COLLECTOR & VALIDATOR  (export_collector_validator_v2.py)
  Stage 1  COLLECT   → read all 13 .txt into 13 raw_* staging tables
                       ** EVERY exported column is staged, not a subset **
  Stage 2  ADJUST    → snap timestamp to the bar grid (now a no-op — see §7)
  Stage 3  VALIDATE  → cross-check symbol / timeframe / close (±0.01) across sources
                       any mismatch → reject the WHOLE cycle, retry (max 3)
  Stage 4  PROMOTE   → merge onto the OHLCV per-bar spine into market_data (87 columns)
                                   │
                                   ▼  (rows WHERE synced_at IS NULL)
PYTHON PUSH WORKER (backfill_worker_api_gateway_v5.py) ──► HTTP POST ──► Railway Gateway
```

**Plus one side path, only for cycles that passed VALIDATE:**

```
10 _Statistic.txt ──► parse ──► indicator_statistics outbox ──► batched POST ──► own queue
                                (append-only; see §5b)                           + processor
```

It hangs off the *end* of a successful cycle rather than sitting inside the four stages, and it is
wrapped so that any failure in it is a logged warning — never a rejected cycle. Statistics describe
a cycle; they are not a precondition for one.

**The removed stage:** CALCULATE used to sit between VALIDATE and PROMOTE, running four Python
modules that recomputed the derived layer. It is gone (see §9).

**Speaker note — why PROMOTE got simpler:** it used to merge two sources (staged admin columns +
freshly calculated columns). It is now a straight copy, because everything already arrived from
MT5.

---

## 4. Who calculates what (the core change)

**Before:** MQL5 computed a stable "admin layer" (SSA, crossings, fractal maps, OHLCV, ZigZag
pivots); Python recomputed the "derived layer" (centroid baselines/EDTs, fractal & support/
resistance lines, ZigZag metrics, z-score body set).

**Now:** MQL5 computes all 83 data fields and exports them. Python adds only 4 provenance fields.

| Source (13 total) | Exports |
| --- | --- |
| 7 centroid variants (`best_fit_a/b`, `cherry_a/b`, `most_recent`, `non_a/b`) | `Base_FL`, `UOEDT`, `LOEDT`, `horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa`, `crossing` — **8 × 7 = 56 fields** |
| Fractal EDT | `Fractal_Best_FL`, `Fractal_UOEDT`, `Fractal_LOEDT` |
| Resistance line | `Best_Resistance` |
| Support line | `Best_Support` |
| OHLCV | `open`, `high`, `low`, `close`, `volume` — the per-bar spine |
| ZigZag | pivot type + point + 9 segment metrics — **11 fields** (sparse: pivot events, not per-bar) |
| Z-Score candle | `body_direction`, `body_size` (=\|z\|), `body_classification` |
| **Pipeline adds** | `cycle_id`, `collected_at`, `calculated_at`, `synced_at` |
| | **= 87 columns** |

**Why this was possible:** the indicators were *already exporting* all of these columns. The
collector simply wasn't reading the calculated ones. Nothing new had to be built in MQL5.

**What it buys:** one implementation per indicator, no transliteration to keep faithful, no
certification to maintain, and no way for the database to disagree with the chart the trader sees.

**What it costs:** MQL5 values are admin-fixed — parameters are compiled in. There is no way to ask
"what would this look like with different parameters?" See §9.

---

## 5. Data retention — two different jobs (worth its own slide)

This is the most commonly misunderstood part. **SQLite and PostgreSQL are not mirrors.**

| | SQLite (`xauusd.db`, on the VPS) | PostgreSQL (`market_data_v6`, Railway) |
| --- | --- | --- |
| Role | Working buffer + outbox | Permanent archive |
| Size | **Capped: 3000 bars per timeframe** (~6000 rows) | **Uncapped — grows forever** |
| Old rows | **Deleted** once confirmed synced | Kept permanently |
| In time terms | ~2.2 weeks of M5, ~6.5 weeks of M15 | Everything since day one (~100k rows/year) |

**Why the cap:** MT5 only ever re-exports its newest 3000 bars. A bar older than that will never be
recalculated or re-sent, so keeping it on the VPS serves no purpose — it is already safe in
Postgres. The prune trigger deletes it, but **only if `synced_at IS NOT NULL`** — the sync
guarantee always beats retention.

**The life of a bar:**

```
born in MT5
   ↓
enters SQLite; updated in place every cycle while MT5 keeps recalculating it  (~2 weeks for M5)
   ↓
pushed to Postgres repeatedly during that time — UPSERT on (symbol, timeframe, timestamp)
   ↓
falls out of MT5's 3000-bar window
   ↓
deleted from SQLite  →  lives in Postgres permanently, frozen at its last recalculated value
```

**Speaker note:** indicators are not continuous series. Fractal, centroid, EDT, SSA and EMA-SSA are
*recalculated* across the whole window on every pass, so the newest values overwrite the older
values in the row with the same timestamp. That is what the UPSERT is for.

---

## 5b. Append-only vs mutable — the idea behind the new table

This is the conceptual heart of the statistics work, and it makes a good standalone slide because
the two tables are deliberate opposites.

| | `market_data_v6` | `indicator_statistics` (new) |
| --- | --- | --- |
| Keyed by | `(symbol, timeframe, timestamp)` — **which bar** | `(symbol, timeframe, source, captured_at)` — **which fit, and when we looked** |
| Re-sending the same key | **Overwrites.** Newest fit wins | **Cannot happen.** A new observation is a new key |
| Therefore | **Mutable** — always shows the latest view | **Append-only** — keeps every view ever taken |
| A correction is | an UPDATE | a **new row** with a later `captured_at` |
| Right for | live charts and alerting | history, drift detection, backtesting |

**The one-line version:** *`market_data` answers "what does this bar look like now?"
`indicator_statistics` answers "what did we believe, and when did we believe it?"*

**Why this matters more than it sounds.** Because `market_data` overwrites, a bar's stored value
is whatever the last recalculation produced — the honest, point-in-time value is computed and then
destroyed (this is exactly the look-ahead problem in §10b). The new table cannot suffer that,
because nothing is ever overwritten. Every row is stamped with the moment it was observed, so a
series of rows for one line shows *how the fit evolved*, not just where it ended up.

**Enforced by the key, not by a trigger or a policy.** There is no "please don't update this"
convention to remember or violate — the schema makes overwriting structurally impossible, which is
the only kind of guarantee worth putting on a slide. A push retry re-delivers the same key with
byte-identical content, so retries are safe and duplicates are impossible.

**Retention:** the statistics outbox on the VPS prunes after 7 days, and **only rows already
confirmed synced** — same sync-beats-retention rule as the price lane. In Postgres it is kept
permanently.

**Configuration is stored once, not per row.** Indicator parameters are compiled into the `.mq5`
and change only on redeploy, so repeating them on every row would duplicate an identical blob
roughly a million times a year. They are hashed into a small `indicator_configs` table instead —
which turns a storage saving into a **feature**: a *new hash appearing* is itself the "someone
reconfigured this indicator" signal, with the exact date it started.

---

## 6. Cadence and volume

| Event | Frequency |
| --- | --- |
| MT5 overwrites the 13 `.txt` exports | **every minute** (at second :59) |
| Collector ingests M5 | **every 5 minutes** (at :05 past the boundary) |
| Collector ingests M15 | **every 15 minutes** |
| Rows re-queued per cycle | all ~3000 in-window bars for that timeframe |

**Why export every minute but read every 5?** Two different jobs:
- The **read** cadence matches the data — an M5 bar only closes every 5 minutes, so reading more
  often would just re-read the same bar.
- The **write** cadence serves recovery. If a cycle is rejected because sources disagree, the
  collector waits `RETRY_WAIT_SEC = 65` — deliberately just over one minute — so a brand-new
  export set is guaranteed to have landed. Three attempts cost ~2 minutes and still fit inside the
  5-minute slot. If exports were 5-minutely, three retries would take 15 minutes and collide with
  the next cycle.

---

## 7. The timestamp fix (a good story slide)

**The problem, as it stood for a long time:** cross-source validation couldn't pass, because each
indicator's exported timestamps carried a different constant sub-bar offset. This was documented as
needing "a dedicated raw→adjusted timestamp-conversion stack" and was the **#1 gating item before
production**.

**It was never that.** It was a one-line bug, identical in all 13 indicators:

```mql5
datetime gmt_offset = TimeCurrent() - TimeGMT();     // WRONG
```

`TimeCurrent()` returns the time of the **last received tick**, not the clock. So the offset
silently absorbed "seconds since the last tick" — and because it is computed once per export and
subtracted from every bar time, that lag was stamped on **every row** as a constant phase.

**The evidence** (measured in the captured export archive, `timestamp % 300`):

| ohlcv | cherry_a | cherry_b | fractal | non_a | non_b | best_fit | zigzag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 206 | 240 | 288 | 189 | 43 | 81 | 4 | 76 |

One constant per file, differing exactly as "how quiet was the market when I clicked export"
predicts. Captures taken during an active session show only 2–3 seconds. Meanwhile the underlying
data was provably fine: aligned by sequence, **every source's closes matched OHLCV 100%**.

**The fix**, applied to all 16 sites across the 13 indicators:

```mql5
long _srv_off = (long)TimeTradeServer() - (long)TimeGMT();
datetime gmt_offset = (datetime)((long)MathRound(_srv_off / 3600.0) * 3600);
```

`TimeTradeServer()` advances with the clock instead of lagging to the last tick; rounding to the
hour removes any residue, since broker offsets are always whole hours.

**A second bug fixed alongside it:** ZigZag wrote its "unconfirmed live pivot" row using the export
wall clock as the timestamp, so that row could never sit on the bar grid. It now uses the current
bar's open time.

> ⚠ **These fixes are inert until all 13 indicators are recompiled in MetaEditor and the `.ex5`
> redeployed to the VPS.**

---

## 8. Downstream — what this means for Stack D / E

**Good news:** the entire existing downstream contract is unchanged. `market_data` is still 87
columns with identical names and types, so the gateway JSON contract for it, both Prisma schemas'
`MarketDataV6` model, the generated DTO and `operation-service` were **untouched** by the
calculation-split removal. Only the *source* of the values changed.

**What is new is additive, alongside it — nothing was altered.** The statistics path adds its own
JSON contract, its own generated DTO, two new Prisma models and two new tables
(`indicator_statistics`, `indicator_configs`). Its migration is **purely additive** — it does not
touch `market_data_v6` in any way — and was applied on 2026-09-09. `operation-service` is not
involved at all: nothing reads the new tables yet, by design. Populating the series comes first;
an API surface is only worth building when something actually consumes it.

**But the column positions shift.** If the Engine 1.5A/B/C design refers to columns by position:

| | Previous deck | Current |
| --- | --- | --- |
| Base columns | 79 | **87** |
| MCD01-10 | Cols 80–89 | **Cols 88–97** |
| FREQ54 | Cols 90–99 | **Cols 98–107** |
| JSONB54 Narrative | Col 100 | **Col 108** |
| Conf_Score | Col 101 | **Col 109** |
| WACS54 | Col 102 | **Col 110** |
| **Prisma total** | **102** | **110** |

**Speaker note:** if the Engine 1.5 design refers to columns *by name* rather than position, this
is a non-issue. Worth confirming.

---

## 9. What was parked, and why it matters

The four Python calc modules and their certification harness were **archived, not deleted**, in
`calculation-split-between-mt5-and-python-PENDING-PROJECT/`, with a document covering the design,
what it cost to park, two open bugs to fix before any revival, and how to restore it.

**The one real capability given up:** arbitrary-parameter recomputation. MQL5 exports one fixed,
admin-configured parameterization; it cannot answer *"what would this look like with
`min_touches=4`?"* without editing the `.mq5`, recompiling and redeploying.

**The other thing that looked lost has since been recovered.** Parking the calc stack also
appeared to give up the statistics substrate — R², MSE, variance ratio, skewness, kurtosis,
containment, touch counts — because it reaches only the `_Statistic.txt` companion files and never
`market_data`. That is what the new capture path (§5b) is for: rather than recomputing those
numbers downstream, the pipeline now **records the ones MT5 already produced, at the moment it
produced them.** Recomputing later would have been worse than not having them, because it would
inherit the look-ahead contamination in §10b — a statistic computed after the fact describes a
line refitted with data the trader never had.

**Consequence for the Decision Layer — now half unblocked, and this is the useful nuance for the
slide:**

| Decision Layer component | Needs | Status |
| --- | --- | --- |
| `fitness_scorer` (its build order starts here) | the statistics substrate | **Unblocked** — the data now flows and accumulates |
| `param_search` | arbitrary-parameter recomputation | **Still blocked** — needs the calc stack revived |

So the blueprint's **BLOCKED banner stands**, but the blocker has narrowed from two independent
causes to one. The scoring formulas themselves were deliberately left *out* of MQL5 and belong
downstream: weights and thresholds are tuning parameters, and baking them into `.mq5` would mean
recompiling 13 indicators and redeploying to the VPS for every weight change, where downstream
they are pure arithmetic on numbers already exported.

---

## 10. Open issues (risk slide)

Neither is caused by this change; both predate it. Both are documented in full, with the
measurements to take before acting.

**a. Push-worker throughput may not keep up** —
`PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`
Every cycle re-queues all ~6000 in-window rows (correct — MT5 recalculates the whole window), and
the worker POSTs **one row per HTTP request** at 500 per cycle plus a 30-second sleep. Demand is
~800 rows/min against a likely capacity of 375–600. Because rows are selected oldest-first, the
symptom would be **the newest bars arriving late or never** — not a crash, and no data loss.
*Status: arithmetic only, never observed in production. Measure before changing anything.*

**b. Historical values are not point-in-time (look-ahead bias)** —
`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`
The centroid/SSA fitting window re-anchors to the live bar on every pass, so a bar's row is
refitted for ~3000 bars before it freezes. The stored value for bar T was therefore computed using
price action from up to ~2 weeks *after* T. **Harmless for live alerting and charts** (they want
the newest fit — that is the feature); **invalid for backtesting, walk-forward or fitness
scoring.** ~56 of the 83 data fields drift; OHLCV and the z-score triple are genuinely causal and
safe. This is a second, independent blocker on the Decision Layer.
*Status: mechanism verified, magnitude never measured.*
**Partially addressed as of 2026-09-09, not solved:** the new append-only table (§5b) is immune to
this by construction — each row is stamped with when it was observed and is never overwritten — so
from now on the statistics series *is* point-in-time honest. That does **not** retroactively fix
`market_data_v6`, and it does not fix the price/level columns at all. It does mean the drift is
now measurable directly, by comparing rows for the same line at different `captured_at` values,
instead of needing the capture-a-week-apart experiment.

**Related nuance:** the export includes the still-forming bar, so the newest row in
`market_data_v6` is always an incomplete candle until the next cycle overwrites it.

---

## 11. Action items (closing slide)

| # | Action | Owner | Blocking? |
| --- | --- | --- | --- |
| 1 | **Recompile the 10 statistic-emitting indicators and redeploy all 13 `.ex5` to the VPS** — see the warning below | Davin | **Yes** — the statistic blocks are inert until this happens |
| 2 | Deploy the updated collector + schema, restart `MT5Collector`. Its `migrate_raw_tables()` widens the existing `xauusd.db` automatically on first start (`market_data` untouched), and the same restart creates the statistics outbox | Davin | Yes |
| 3 | Confirm a real green end-to-end cycle against the live terminal — for **both** lanes: price rows landing in `market_data_v6`, and statistics rows landing in `indicator_statistics` | Davin | Yes |
| 4 | ✅ **Done 2026-09-09** — apply the `indicator_statistics` migration to PostgreSQL | Davin | — |
| 5 | Measure push-worker throughput (§10a) | — | No |
| 6 | Measure historical drift magnitude (§10b) — now measurable directly from the statistics series once it has some depth | — | No |
| 7 | Decide Decision Layer direction: revive the calc stack for `param_search`, or redesign around admin-fixed values. `fitness_scorer` is no longer blocked either way (§9) | Davin | No |

> ⚠ **The `.ex5` binaries currently on disk are a build behind, and in a way that hides itself.**
> All 13 were compiled on 2026-09-09 at ~13:45 — that build **does** include the timestamp fix
> (§7, sources edited 12:03). The EDT Quality Metrics blocks were then added at 14:52–14:54 to the
> **10 statistic-emitting indicators**, after that compile. So those 10 binaries carry the
> timestamp fix but **not** the statistic blocks. (The 3 that are current — ZigZag, OHLCV, Z-Score
> — emit no statistics, so they are correctly unaffected.)
>
> **Why this matters more than a normal stale build:** deploying as-is would look successful.
> Timestamps would be correct, cycles would validate, and statistics rows *would* be created — with
> every new field empty, because the old-format files don't contain them. The failure is silent.
> Recompile those 10 before deploying.

---

## Appendix — verification performed

For anyone asking "how do we know this works":

- The refactored pipeline was run end-to-end against **real captured MQL5 exports**, producing
  3000 promoted bars, then every promoted value was compared field-by-field against its source
  `.txt`: **192,024 comparisons, 0 mismatches**, all 79 data columns covered (the other 4 are the
  positional validation keys, checked by the validator itself).
- The staging-schema migration was tested against a database built from the *previous* schema with
  real data in it: 38 columns added, existing values preserved, second run a no-op.
- The push worker's own built-in contract guard passes against the new database, and a real POST
  payload has exactly the 87 contract fields — no missing, no extra.
- Downstream suites confirmed unchanged: monolith 171/171 suites · 2416/2416 tests,
  railway-gateway 31/31 + 17/17 e2e, operation-service 43/43 · 401/401.
- The MQL5 changes **cannot be compiled or tested here** — they were verified by inspection only.
  That is why action item 1 exists.

**For the statistics path specifically:**

- **Append-only proved, not assumed:** two consecutive cycles were run with one indicator's R²
  deliberately changed in between. Result: 20 rows rather than 10, the first cycle's value
  **unchanged**, and the new value recorded as a separate row. Re-staging the same `captured_at` is
  idempotent, so a push retry cannot create a duplicate.
- **Isolation proved:** with the statistics endpoint pointed at a dead port, the push swallows the
  failure and leaves rows queued for retry — nothing lost, and the `market_data` drain is
  untouched. This is the property that makes the second lane safe to add at all.
- **Parser** tested against the real captured `_Statistic.txt` files. Those pre-date the new
  blocks, so the new fields correctly read as *missing* rather than as zero — the distinction that
  matters, since an R² of 0.0 is a real measurement and a missing one is not.
- **Config hashing:** an unchanged indicator configuration produces a stable hash across cycles, so
  a new hash genuinely means a reconfiguration rather than noise.
- **A design flaw was caught during this verification and fixed:** the schema declared both a
  unique constraint and a plain index on the *same* four columns. Postgres already backs a unique
  constraint with an index on exactly those columns, so the second was duplicated write cost on a
  table meant to grow ~1M rows/year and never be updated. Removed.
- **Not verified:** a live MT5 → PostgreSQL round trip, which is gated on action item 1 — the new
  statistic blocks are not emitted until the recompiled `.ex5` is deployed.
