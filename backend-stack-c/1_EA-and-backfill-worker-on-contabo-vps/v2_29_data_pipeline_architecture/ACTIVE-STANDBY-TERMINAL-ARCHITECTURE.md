# Active / Hot-Standby MT5 Terminal Architecture

> **Status:** Design — approved in principle (Davin, 2026-09-12), not yet built.
> **Scope:** How an administrator retunes EDT indicator configurations against live
> market conditions and puts the result in front of users, without interrupting
> service and without corrupting the data users already depend on.
> **Audience:** Stack-development team, and the source document for an executive
> summary deck. §9 is written specifically for that translation.
> **Depends on:** `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` (the v6 pipeline this
> sits on). Every file path and line number below was verified against live code on
> 2026-09-12, not reconstructed from documentation.

---

## 0. The one-paragraph version

Indicator configurations go stale as markets form new centroids, so an administrator
must retune them continuously. Today that retuning happens **on the live terminal**,
which means the numbers users are looking at change underneath them with no warning
and no record. The fix is to run **two MT5 terminals**: one **active** (feeding the
production pipeline) and one **hot standby** (running and exporting, but ignored). The
administrator tunes the standby, confirms it visually in MetaTrader, then **promotes**
it with a single configuration change — after which the two swap roles and the cycle
repeats. Users see the updated analysis appear over about five minutes with no outage.
The demoted terminal keeps running as the rollback. Three pieces of work make this
safe: a small code guard against a silently stale standby, a written promote
procedure, and the physical terminal build.

---

## 1. The problem

### 1.1 What happens today

The administrator changes an indicator's parameters or anchors on the production
terminal. Because the centroid/SSA fitting window re-anchors to the live bar on every
pass, the indicator does not merely start producing new values going forward — it
**recomputes roughly 3,000 bars of history** (~2.2 weeks of M5) and the pipeline
promotes all of them. `market_data_v6` upserts on `(symbol, timeframe, timestamp)`
(`prisma/market-data/schema.prisma:151`), so the new values overwrite the old ones in
place.

Net effect: the chart a user is watching silently redraws, the values behind any
analysis change, and **nothing anywhere records that it happened or what the previous
values were**.

### 1.2 What "interruption" actually means here

Worth being precise, because it determines what the solution has to do.

There is **no outage** today. The service never becomes unavailable during a retune.
The problem is not downtime — it is **mutation without provenance or control**. The
administrator cannot evaluate a candidate configuration against live market data
without first imposing it on every user, and cannot undo it except by tuning again.

A design that only prevented downtime would solve a problem this system does not have.

---

## 2. The model

### 2.1 Active and hot standby, alternating

| Role            | State                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Active**      | Running. Its exports feed the pipeline. Users see its output.      |
| **Hot standby** | Running, charts attached, exporting to disk. **Nothing reads it.** |

The administrator tunes the standby and judges it **visually, inside MetaTrader** —
which is how EDT anchors are assessed anyway. The database is not involved in the
comparison. When satisfied, the standby is **promoted**: it becomes active, the
previous active becomes the new hot standby, and the cycle repeats indefinitely.

**"Hot" is load-bearing vocabulary.** A cold standby — terminal closed, charts
detached — is the principal failure mode of this design (§4). The word states the
requirement.

### 2.2 What the switch physically is

The collector accepts a single `--export-dir` argument
(`export_collector_validator_v2.py:894`, wired at `install_services.bat:54`). It reads
one directory and only one. Promotion is therefore a change to that one argument:

```
nssm set MT5Collector AppParameters "C:\Scripts\collector\export_collector_validator_v2.py --export-dir <STANDBY_FILES_DIR> --db C:\Scripts\database\xauusd.db --timeframes M5,M15"
nssm restart MT5Collector
```

Nothing else changes: same database, same push worker, same gateway, same schema, no
migration, no application-code deployment.

```
  Terminal A (active)  --> A\MQL5\Files --+
                                          |  --export-dir   +--------------+
                                          +---------------->| MT5Collector |--> SQLite --> Push Worker --> Gateway --> Postgres --> users
                                          |  (points at ONE)+--------------+
  Terminal B (standby) --> B\MQL5\Files --+
                           (written, but nobody reads it)

  PROMOTE = move the arrow from A to B, restart the collector.
```

### 2.3 Where the blue-green analogy holds, and where it breaks

**Holds:** two identical environments, one live and one prepared; an instant
single-action cutover; the previous environment retained as the fallback.

**Breaks in two places, and both matter:**

1. **There is no load balancer and no user traffic to route.** Users never contact the
   MT5 terminals. Stack C is a _producer_ that pushes rows into the gateway. The
   collector's `--export-dir` is the switch, and it selects a _data source_, not a
   _traffic destination_.
2. **Rollback is not a restore.** In classic blue-green, reverting sends traffic back
   to an untouched environment and the previous state returns intact. Here, promoting
   B overwrites the shared history rows; promoting A again overwrites them a second
   time. The effect is reversible, but **the intermediate values are not retained**.
   Rollback lives in the _terminal_, not in the data.

---

## 3. The export directory is a shared bus — the finding that shapes this design

The single most consequential fact in this document, and not visible from the topology
diagram in the existing architecture deck.

### 3.1 Four consumers, one folder

`C:\MT5\MQL5\Files` is not the price lane's private input. **Four independent lanes
read from it:**

| #   | Lane                  | Reader                          | Files consumed                                    |
| --- | --------------------- | ------------------------------- | ------------------------------------------------- |
| 1   | Price (alerts/charts) | `MT5Collector`                  | 15 indicator `.txt` × M5/M15                      |
| 2   | Fit statistics        | `MT5Collector`                  | 10 `_Statistic.txt`                               |
| 3   | Economic calendar     | `MT5Collector`                  | `EconomicCalendar.txt`                            |
| 4   | Currency & gold index | `DavinTradeCurrencyIndexEngine` | 8 × `OHLCV_{SYMBOL}_M5.txt` (7 FX pairs + XAUUSD) |

Lane 4 runs in a **separate OS process with its own service, its own SQLite file and
its own environment variable** — `CGI_EXPORT_DIR`, which defaults to the _same_ path
(`currency_gold_index_engine.py:83`;
`install_currency_gold_index_engine_service.bat:40`). It was deliberately isolated at
every other layer, but it shares this one input folder.

### 3.2 What a naive switch would break — silently

Move the collector to a standby carrying only the 15 EDT indicators and:

- **Lane 3 stops.** `stage_economic_events()` returns `(0, 0)` when the file is absent
  (`export_collector_validator_v2.py:529-532`) — best-effort by design, so a calendar
  failure can never reject a price row. Correct for its purpose; it also means the
  calendar simply stops being captured with **no error anywhere**.
- **Lane 4 survives the collector switch** (different service, different variable) —
  but if the administrator later closes or rebuilds whichever terminal Lane 4 happens
  to point at, Lane 4 stops just as quietly, because an absent index row renders as
  nothing by design.

Neither failure raises an alarm. Both would surface days later as "the calendar stopped
updating" with no obvious link back to the promote.

### 3.3 Two options

**Option A — everything alternates.** Both terminals carry the full export surface:
30 indicator attachments (15 × M5, 15 × M15) + the calendar exporter + 8 currency-index
OHLCV charts = **39 attachments across 11 charts, twice.** (Counts updated 2026-09-22 for
the 15th indicator; this line read 35 when written, for 13 indicators.)

- _For:_ one switch moves everything; no ambiguity about which terminal serves what.
- _Against:_ a heavy, error-prone manual build repeated per terminal, and it churns two
  lanes that have no reason to change. The calendar and OHLCV exporters are **generic
  dumpers with no tunable parameters** — there is nothing about them to retune, so
  alternating them buys nothing.

**Option B — only the tunable surface alternates. RECOMMENDED.**

| Terminal       | Carries                                          | Alternates? |
| -------------- | ------------------------------------------------ | ----------- |
| **A** (EDT)    | 30 EDT indicator attachments + calendar exporter | Yes         |
| **B** (EDT)    | 30 EDT indicator attachments + calendar exporter | Yes         |
| **S** (static) | 8 × `OHLCV_{SYMBOL}_M5.txt` exporters            | **Never**   |

- Lane 4 is decoupled for free: point `CGI_EXPORT_DIR` at terminal S. **Zero code
  change** — it is already an independent environment variable on an independent
  service.
- The calendar exporter sits on **both** A and B. It is parameterless, so both produce
  identical output and it rides along with the switch harmlessly. This avoids adding a
  `--calendar-dir` argument to the collector.
- Only the 30 EDT attachments — the genuinely tunable surface — participate in the
  alternation.

_Cost:_ a third MT5 terminal (~300–500 MB RAM). _Benefit:_ the two lanes that must not
be disturbed by a retune become structurally incapable of being disturbed by one, which
matches the isolation philosophy Lane 4 was built on in the first place.

### 3.4 Unaffected by the switch

`MT5Renderer` reads the **database** (`MTF_DB_PATH`, `mtf_render_upload_worker.py:65`),
not the export directory. Chart rendering to Cloudflare R2 needs no change and no
consideration during a promote.

---

## 4. Part 1 — the stale-export guard (code)

### 4.1 The gap

The collector's completeness check is **relative, not absolute**
(`export_collector_validator_v2.py:708-719`):

```python
if check_completeness:
    missing = [s for s in PER_BAR_SOURCES if not keys[s]]
    if missing:
        reasons.append(f"no staged rows from: {', '.join(missing)}")
    elif ohlcv:
        latest = max(ohlcv.keys())
        stale = [s for s in PER_BAR_SOURCES if latest not in keys[s]]
        if stale:
            log_failure(conn, cycle_id, 'timestamp', {...})
            reasons.append(f"latest bar {latest} missing in: {', '.join(stale)}")
```

It verifies that all 13 sources **agree with each other** on the latest bar. It never
compares that bar against the current cycle slot.

### 4.2 The failure this permits

Promote to a standby whose terminal was shut down, and all 13 files are _uniformly_
stale. They agree with one another perfectly, so **the cycle validates clean**:

- the collector logs success,
- the push worker drains normally,
- no rejection is written to `rejected_rows.jsonl`,
- **the newest bar simply stops advancing**, and
- the alert engine's `findFirst({ orderBy: { timestamp: 'desc' } })`
  (`operation-service/src/alert-engine/alert-checker.service.ts:109`) keeps evaluating
  a frozen bar.

The system reports healthy while alerts silently assess stale prices. It looks like a
quiet market. This is the principal risk the alternating design introduces, because the
standby is precisely the terminal most likely to have been closed.

### 4.3 The fix

Add an absolute freshness assertion in the same block. `TF_SECONDS = {'M5': 300,
'M15': 900}` already exists (`export_collector_validator_v2.py:51`), so the rule is one
comparison: reject the cycle when `cycle_time - latest` exceeds a per-timeframe
threshold, logged through the existing `log_failure()` path
(`export_collector_validator_v2.py:648`) so it lands in `validation_failures` and
`rejected_rows.jsonl` like every other rejection.

**Threshold — the one number to confirm before merging.** A legitimate cycle can
already lag, for two compounding reasons: the collector runs every 300 s
(`CYCLE_INTERVAL_SEC`) while an M15 bar only advances every 900 s, and a cycle may
retry up to 3 times at 65 s (`MAX_ATTEMPTS_PER_CYCLE`, `RETRY_WAIT_SEC`) = 195 s.

| Candidate rule             | M5 limit | M5 legit. worst case | M5 margin | M15 limit | M15 legit. worst case | M15 margin |
| -------------------------- | -------- | -------------------- | --------- | --------- | --------------------- | ---------- |
| `2 × TF_SECONDS`           | 600 s    | 495 s                | **105 s** | 1800 s    | 1095 s                | 705 s      |
| `TF_SECONDS + 600` _(alt)_ | 900 s    | 495 s                | 405 s     | 1500 s    | 1095 s                | 405 s      |

`2 × TF_SECONDS` is the simpler rule and detects a dead standby within ~10 minutes of a
promote, but leaves only 105 s of headroom on M5. `TF_SECONDS + 600` gives a uniform
405 s margin on both timeframes at the cost of slower detection. **Recommendation:
`2 × TF_SECONDS`, with the M5 margin explicitly accepted** — a false rejection is
self-healing (the next cycle retries) whereas a missed detection is silent, so erring
tight is the correct direction.

### 4.4 Verification

- Unit test: a synthetic export directory with all sources uniformly stale must be
  **rejected**; a fresh one must pass; a cycle at the exact threshold boundary must
  pass on both M5 and M15.
- Mutation check: remove the new comparison and confirm the stale-directory test fails,
  proving the test exercises the guard rather than passing incidentally.
- Regression: `test_economic_events.py`, `test_push_economic_events.py`, and a full
  collector cycle against the existing golden archive must be unchanged.

---

## 5. Part 2 — the promote procedure (runbook)

To be written as `docs/runbooks/mt5-terminal-promote.md`, following the existing
convention in `docs/runbooks/` (`contabo-chat-stack.md`,
`rotate-postgres-credentials.md`).

### 5.1 Preconditions — all four, before touching anything

1. The standby terminal is **running**, charts attached, indicators drawing.
2. Its `MQL5\Files` directory contains fresh exports — newest bar within one bar period
   of now. (After §4 ships, the guard enforces this; before it ships, check by hand.)
3. The administrator has visually confirmed the new configuration on the standby's own
   charts.
4. The **currently active** terminal is healthy, so it is a viable rollback.

### 5.2 The switch

The two commands in §2.2. Collector downtime is a service restart — seconds. The push
worker is untouched and keeps draining throughout, so there is no user-visible gap.

### 5.3 What users see

Not instantaneous, and worth setting expectations precisely. On the next cycle,
`promote_cycle`'s `INSERT OR REPLACE` resets `synced_at` on all ~6,000 in-window rows,
so the whole window re-pushes at 500 rows per 30 s cycle — roughly **5–6 minutes**.

Because row selection is **oldest-first**, the chart repaints **left to right**: the
oldest bars update first and **the newest bars at the right-hand edge change last**. No
blank chart, no error state, no interruption — a progressive repaint that completes
from the far edge inward.

### 5.4 Rollback

Re-run §2.2 pointing back at the previous terminal. It is still running with its old
configuration and current exports, so it resumes immediately.

Understand what this is: **another forward switch, not a restore.** The history rows
are overwritten a second time. The effect is reversed; the intermediate values are gone.

### 5.5 The standby discipline rule

**Do not begin tuning the newly demoted terminal until the newly promoted one is
confirmed good.** Between the promote and that confirmation, the demoted terminal is
the only rollback that exists. Once the new active is confirmed, the demoted terminal
becomes the next tuning target.

Stated as a cycle:

```
  A active, B standby
        |
        | admin tunes B, confirms visually in MetaTrader
        v
     PROMOTE  ->  B active, A standby  (A frozen as last-known-good)
        |
        | confirm B good in production
        v
   A released for tuning  ->  admin tunes A  ->  PROMOTE  ->  A active, B standby
        |
        v
      (repeat)
```

### 5.6 Which terminal is active?

`nssm get MT5Collector AppParameters`, or the collector's own startup log line, which
prints `exports=<dir>` (`export_collector_validator_v2.py:909`).

---

## 6. Part 3 — the physical build (administrator's work)

Not executable by the development session — attaching charts, setting anchors and
compiling in MetaEditor all require the VPS console. This is the same boundary that
applies to every MT5-side item in this stack.

### 6.1 Terminal inventory (Option B)

| Terminal | Purpose          | Data folder      | Charts                     |
| -------- | ---------------- | ---------------- | -------------------------- |
| A        | EDT, alternating | separate install | XAUUSD M5, XAUUSD M15      |
| B        | EDT, alternating | separate install | XAUUSD M5, XAUUSD M15      |
| S        | Static exports   | separate install | 8 (7 FX pairs + XAUUSD M5) |

Each terminal needs its **own installation directory / data folder** so that the three
`MQL5\Files` paths are genuinely distinct. A shared data folder defeats the entire
design.

### 6.2 Attachments

**A and B (identical):**

- 15 EDT indicators on XAUUSD **M5**
- 15 EDT indicators on XAUUSD **M15**
- `EconomicCalendarExport_v2_29.mq5` (once)
- Per-indicator anchors set for the windowed indicators — Fractal-Best-Fit and both
  Single-Best lines use fixed `InpStartDateTime` / `InpEndDateTime` and go stale
  (blueprint §12 item 3). **These anchors are a large part of what a retune actually
  changes.**

**S:**

- `ohlcvexportlightweight_v2_29.mq5` on 8 charts: EURUSD, USDJPY, GBPUSD, AUDUSD,
  NZDUSD, USDCAD, USDCHF, XAUUSD — all M5. The XAUUSD chart here is deliberately
  separate from the EDT terminals' XAUUSD charts, to avoid any cross-lane file
  dependency.

### 6.3 Service configuration

- `MT5Collector` — `--export-dir` points at whichever of A / B is active.
- `DavinTradeCurrencyIndexEngine` — `CGI_EXPORT_DIR` points at **S, permanently.**
- `MT5PushWorker`, `MT5Renderer` — unchanged; neither reads the export directory.

> **Caution:** do **not** re-run `install_services.bat` to apply these. Batch files do
> not stop on error, so re-running it re-executes the `nssm set ... AppEnvironmentExtra`
> lines and would overwrite the live services' real credentials with the file's
> placeholder values. Set the individual service properties directly.

---

## 7. What this does not solve

Stated plainly, so the design is not credited with more than it does.

1. **No historical record of superseded values.** Promotion overwrites shared history
   rows. Reconstructing what a chart showed last week remains impossible. Closing that
   would require a genuine version dimension in `market_data_v6` — a schema change well
   beyond this design.
2. **No parameter search.** This validates _one_ candidate configuration that a human
   assembled by hand. It cannot sweep hundreds, which is what
   `DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` §2.2's `param_search` specifies. That
   remains blocked on the parked Python calc stack.
3. **Slow, and serial.** Judging a candidate on live forward data costs real calendar
   time, and only one candidate can be in preparation at a time.
4. **Not an automatic drift detector.** Promotion is triggered by the administrator
   noticing staleness. Automating that trigger is Workstream (2) of the decision layer.

**What it does provide, and should not be undersold:** the decision layer's §2.4
mandates walk-forward, out-of-sample validation, which the blueprint currently records
as blocked — both because arbitrary-parameter recomputation is unavailable and because
stored history is not point-in-time honest. A candidate running live on a standby is
immune to both: MT5 computes it directly, and every bar it produces arrives genuinely
out-of-sample. **This is a physical, slow, but honest substitute for the validation
half of Workstream (1) — available today, with no dependency on the parked calc stack.**

---

## 8. Build order and verification boundary

| #   | Work                                     | Owner | Verifiable by dev session?             |
| --- | ---------------------------------------- | ----- | -------------------------------------- |
| 1   | Stale-export guard + tests (§4)          | Dev   | Yes — synthetic stale export directory |
| 2   | Promote runbook + blueprint updates (§5) | Dev   | N/A (documentation)                    |
| 3   | Build terminals A / B / S (§6)           | Admin | No — requires VPS console              |
| 4   | First rehearsed promote                  | Admin | No — requires 3 to exist               |

1 and 2 can proceed immediately and independently of 3. **A real promote cannot be
verified until 3 is complete**, so the first switch should be rehearsed during a market
close, with the rollback path (§5.4) confirmed before it is ever needed in anger.

Blueprint updates accompanying this work: §8.1 (directory layout for three terminals),
§8.3 (terminal setup), §12 (the staleness gap as a known issue until §4 ships).

---

## 9. Notes for the executive-summary translation

Written for whoever turns this into a presentation deck.

### 9.1 The narrative in four beats

1. **The need** — markets move, indicator configurations go stale, an administrator
   must retune constantly. (§1)
2. **The cost today** — retuning happens on the live system; users' data changes
   underneath them with no record. The issue is _uncontrolled change_, not downtime.
   (§1.2)
3. **The fix** — two terminals, one live and one rehearsing; a single-action switch;
   the old one kept as the undo. (§2)
4. **The catch worth one slide** — the export folder feeds four systems, not one, so
   the switch must be scoped deliberately or two unrelated features stop working
   silently. (§3)

### 9.2 Emphasis guidance

- **Lead with §3.** It is the finding that is not obvious from any existing diagram and
  the one that changes what gets built.
- **Do not describe this as preventing downtime.** There is no downtime today; claiming
  otherwise misrepresents the value.
- **Be honest about rollback.** "The previous terminal is the undo" is accurate. "We can
  restore the previous data" is not.
- **§7 belongs in the deck.** The limits are as decision-relevant as the capability.

### 9.3 Glossary

| Term                 | Plain meaning                                                                         |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Active terminal**  | The MT5 terminal currently feeding live data to users.                                |
| **Hot standby**      | A second terminal, fully running and producing output, that nobody is reading yet.    |
| **Promote**          | Make the standby the active one. A one-line configuration change.                     |
| **EDT indicator**    | The channel-drawing indicators whose settings the administrator tunes.                |
| **Anchors**          | Fixed start/end dates some indicators fit between; they go stale as the market moves. |
| **Export directory** | The folder where MT5 writes its results as text files — the handover point.           |
| **Collector**        | The service that reads those text files, checks them and loads the database.          |
| **Lane**             | One independent data stream (price, statistics, calendar, currency index).            |
| **Upsert**           | Write-or-overwrite: same bar, new values replace old ones.                            |
| **Walk-forward**     | Judging a setup on data that arrived _after_ it was chosen — the honest test.         |
| **Point-in-time**    | A stored value that still reflects what was actually known at that moment.            |
| **Blue-green**       | Two identical environments, one live, switching between them. Partly applies (§2.3).  |

### 9.4 Numbers safe to quote

| Figure                                   | Value                     |
| ---------------------------------------- | ------------------------- |
| Time for users to see a promoted change  | ~5–6 minutes, progressive |
| Service outage during a promote          | None                      |
| Bars rewritten by a configuration change | ~3,000 (~2.2 weeks of M5) |
| Rows re-pushed per promote               | ~6,000                    |
| Terminals required (Option B)            | 3                         |
| EDT attachments per alternating terminal | 30 (15 × M5, 15 × M15)    |
| Code changed to support the switch       | One validation check      |
| Schema migrations required               | None                      |
