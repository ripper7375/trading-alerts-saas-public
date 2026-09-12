# Active / Hot-Standby MT5 Terminal — Work Completion Report

**Status:** **PARTIALLY DELIVERED — code and documentation BUILT, COMMITTED and PUSHED
(2026-09-12/13); the physical terminals DO NOT EXIST.** Parts 1 (the stale-export guard) and
2 (the promote runbook + blueprint updates) are complete and verified. Part 3 (building
terminals A / B / S on the VPS) is an administrator task requiring the VPS console and has
not been started. **Nothing here has been exercised against a real promote** — the guard is
unit-tested against synthetic stale directories only.
**Type:** Ad-hoc session (Davin-requested directly in chat) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded as one `CLAUDE.md`
ad-hoc entry dated 2026-09-12.

> **Scope note:** this document covers the **operational mechanism** by which an administrator
> retunes EDT indicator configurations and puts the result in front of users. It is not a new
> data lane and adds no tables, endpoints or user-facing features. It sits directly on the v6
> pipeline — see
> [`DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`](DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md),
> whose §8.1 / §8.3 / §12 / §13 this work amended. Architecture design:
> [`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`](ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md).
> Procedure: [`docs/runbooks/mt5-terminal-promote.md`](../../../docs/runbooks/mt5-terminal-promote.md).

---

## 1. What was built

### 1.0 How the design arrived — the correction is the design

Davin opened by proposing a Blue-Green Deployment strategy for Stack C, with the standard
load-balancer diagram, motivated by the real need to retune EDT configurations continuously
as markets form new centroids.

**The first assessment was half right.** What held: blue-green as drawn does not map, because
Stack C is a _producer_ with no inbound traffic — there is no load balancer to flip; and the
real problem is not downtime (there is none) but **mutation without provenance**, since the
centroid/SSA window re-anchors to the live bar each pass, so retuning on the production
terminal silently rewrites ~3,000 bars of history in place with no record.

**What was wrong:** the initial answer assumed both terminals would push simultaneously, and
built an elaborate symbol-namespacing design around the `(symbol, timeframe, timestamp)`
upsert key to keep two live writers apart. **Davin's own framing was simpler and correct —
only one terminal ever feeds the collector; the other pushes nothing.** Because the collector
takes a single `--export-dir`, the standby's files sit on disk ignored, the comparison happens
visually in MetaTrader, and the database is never involved. None of the namespacing was needed.

In that alternating form it **genuinely is blue-green**, with `--export-dir` as the load
balancer. The earlier rejection of the pattern was wrong and is retracted. Davin also settled
the vocabulary (**"standby"**, not "working silently"), refined to **hot standby** — a cold one
is precisely the failure mode §1.2 addresses, so the word states the requirement.

### 1.1 The finding that shaped the design — the export directory is a shared bus

Found while writing the design document, before any code was written.

`C:\MT5\MQL5\Files` is not the price lane's private input. **Four independent lanes read from
it:** price (13 indicators × M5/M15), fit statistics (10 `_Statistic.txt`), the economic
calendar, and the currency & gold index engine. Lane 4 runs in a separate OS process with its
own service and its own `CGI_EXPORT_DIR` variable — which **defaults to the same path**
(`currency_gold_index_engine.py:83`).

A standby carrying only the 13 EDT indicators would therefore **silently stop economic-calendar
capture**: `stage_economic_events()` returns `(0, 0)` when the file is absent
(`export_collector_validator_v2.py:529-532`), best-effort by design so that a calendar failure
can never reject a price row. Correct for its purpose — and it means no error anywhere.

Resolved with a **three-terminal topology** rather than the obvious two:

| Terminal       | Carries                                          | Alternates? |
| -------------- | ------------------------------------------------ | ----------- |
| **A** (EDT)    | 26 EDT indicator attachments + calendar exporter | Yes         |
| **B** (EDT)    | identical to A                                   | Yes         |
| **S** (static) | 8 × `OHLCV_{SYMBOL}_M5.txt` exporters            | **Never**   |

Lane 4 decouples for **zero code change**, since `CGI_EXPORT_DIR` is already an independent
variable on an independent service. The calendar exporter goes on both A and B — it is
parameterless, so both produce identical output and it rides along with a promote harmlessly,
avoiding a `--calendar-dir` argument. Only the genuinely tunable surface alternates.

`MT5Renderer` is unaffected: it reads the database via `MTF_DB_PATH`, not the export directory.

### 1.2 Part 1 — the stale-export guard (a real gap in live code)

`validate_cycle`'s completeness check was **relative only** (`export_collector_validator_v2.py:708-719`):
it verified that all per-bar sources agreed with _each other_ on the newest bar, never that the
bar was current.

A directory frozen by a shut-down terminal is stale in every source by the **same** amount, so
the sources agree perfectly and **the cycle validated clean** — the collector logs success, the
push worker drains, nothing is rejected, while the newest bar silently stops advancing and the
alert engine's `findFirst({ orderBy: { timestamp: 'desc' } })` keeps evaluating a frozen bar.
It looks like a quiet market.

Added an absolute freshness assertion rejecting the cycle when the newest bar lags the
scheduled slot by more than `MAX_BAR_LAG_MULTIPLIER × TF_SECONDS[tf]` (2× → 600s M5 / 1800s
M15), logged through the existing `log_failure()` path so it reaches `validation_failures` and
`rejected_rows.jsonl` like any other rejection.

Three deliberate choices, each recorded in the code rather than only here:

- **Sibling, not nested.** The absolute check sits beside the relative one rather than inside
  it, so a directory that is both stale _and_ internally inconsistent reports both reasons —
  otherwise the operator fixes one problem and only then discovers the second.
- **`cycle_time` is a REQUIRED parameter**, deliberately not defaulted to `None`. A silent
  "skip the check" path is exactly how this guard would stop running unnoticed after a future
  refactor adds a second call site. The one existing call site was updated in the same change.
- **The threshold was derived, not picked.** A legitimate cycle already lags: the collector
  runs every 300s against a 900s M15 bar, plus up to 195s of retries
  (`MAX_ATTEMPTS_PER_CYCLE` × `RETRY_WAIT_SEC`). Worst honest cases are ~495s M5 / ~1095s M15
  against limits of 600 / 1800. **The M5 margin is a deliberate 105s** — a false rejection
  self-heals on the next cycle, a missed detection is silent, so erring tight is the correct
  direction. The looser `TF_SECONDS + 600` alternative was tabled in the design doc for Davin
  to overrule; he did not.

### 1.3 Part 2 — the promote runbook and blueprint updates

`docs/runbooks/mt5-terminal-promote.md`, following the existing `rotate-postgres-credentials.md`
convention: four preconditions, the two `nssm` commands, how to verify the collector is reading
the terminal you intended, what users see, rollback, the standby-discipline rule, and a ranked
gotchas section.

Two things stated plainly rather than glossed:

- **A promote is not instantaneous.** `promote_cycle`'s `INSERT OR REPLACE` resets `synced_at`
  on all ~6,000 in-window rows, so the whole window re-pushes at 500 rows per 30s — roughly
  **5–6 minutes**. Because selection is **oldest-first**, the chart repaints left-to-right and
  **the newest bars at the right-hand edge change last**.
- **Rollback is another forward switch, not a restore.** The history rows are overwritten a
  second time; the intermediate values are not retained anywhere and cannot be recovered.

Blueprint amended in five places: §0.5 (three reference rows), §8.1 (three-terminal topology
replacing the single-terminal line), §8.3 (standby parity, calendar-on-both, terminal S),
§12 item 10 (the staleness gap, recorded as BUILT), §13 item 6 (the physical build as remaining
work).

---

## 2. Files changed

| File                                                  | Change                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `export_collector_validator_v2.py`                    | `MAX_BAR_LAG_MULTIPLIER` constant; absolute freshness check; `cycle_time` now a required param |
| `test_stale_export_guard.py`                          | **Added.** 9 standalone tests (no pytest infra in this stack)                                  |
| `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`             | **Added.** The design document, incl. §9 written for the executive-deck translation            |
| `docs/runbooks/mt5-terminal-promote.md`               | **Added.** The promote procedure                                                               |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`         | §0.5, §8.1, §8.3, §12 item 10, §13 item 6                                                      |
| `active-standby-terminal-manifest-work-completion.md` | **Added.** This document                                                                       |
| `CLAUDE.md`                                           | One ad-hoc session entry, dated 2026-09-12                                                     |

**6 files touched** (4 added, 2 modified), plus `CLAUDE.md`. The collector diff is **+46/−2** —
the entire behavioural change is one comparison and one required parameter.

Not committed and not this session's artifact:
`ACTIVE-STANDBY-TERMINAL-Executive-Summary.pptx`, which appeared in this folder during the
session — Davin's own Claude Cowork output generated from the design document.

---

## 3. Test verification

| Suite                                       | Result                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `test_stale_export_guard.py` (new)          | **9/9 passing**                                                                                     |
| `test_economic_events.py`                   | **Green**, unaffected                                                                               |
| `test_push_economic_events.py`              | **Green**, unaffected                                                                               |
| `python -m py_compile` + module import      | Clean                                                                                               |
| `sqlite_schema_v6_xauusd.sql` applied fresh | **87 `market_data` columns** — schema untouched, no drift                                           |
| Repo-wide `validate_cycle` caller audit     | Only `v2_28_.../export_collector_validator_v1.py` — legacy, not in the v6 flow, correctly untouched |

The 9 tests are not all equal in value. `test_uniformly_stale_directory_is_rejected` is the
load-bearing one — it reproduces the exact state a promote to a cold standby produces. The
others pin the threshold's edges (`exactly_at_limit`, `one_second_over_limit`,
`threshold_scales_with_timeframe`, `worst_legitimate_retry_lag_still_passes`) so the guard
cannot later be widened into uselessness, plus the interaction cases
(`relative_and_absolute_failures_are_reported_independently`,
`no_completeness_flag_disables_the_freshness_check`, `cycle_time_is_required`).

Staged fixture rows are built by introspecting `PRAGMA table_info` rather than hard-coding
columns — these staging tables have already gained columns twice (the `best_fit_a`/`b` split,
the 2026-09-09 MQL5-only refactor), and a test that hard-codes them breaks for reasons
unrelated to what it tests.

---

## 4. Mutation verification — proving the guard is load-bearing

This stack ships no UI, so there is no browser check to run. The equivalent proof that the
tests are real is a mutation check: disable the guard and confirm the tests actually fail.

**Result: disabling the comparison (`if lag > max_lag:` → `if False and lag > max_lag:`) fails
4 of 9 tests**, including `test_uniformly_stale_directory_is_rejected` with the exact expected
message ("uniformly stale export directory was accepted"). The 5 that still pass are correct to
— they cover fresh directories, the inclusive boundary, the worst legitimate lag, the
`--no-completeness` skip, and the required-parameter check, none of which the mutation touches.

**The harness could not leave the file modified.** The restore ran unconditionally rather than
only on success, and was verified **byte-exact by sha256 before and after** — per this repo's
own recorded lesson that a crashed mutation harness leaving the target mutated is a genuinely
dangerous failure mode.

---

## 5. What you still need to do

### 5.1 Build terminals A / B / S — **NOT DONE, and the whole design is inert without it**

Requires the VPS console; a development session cannot attach charts, set anchors, or compile
in MetaEditor. Same boundary as every MT5-side item in this stack's history.

- Three **separate MT5 installations / data folders**, so the three `MQL5\Files` paths are
  genuinely distinct. A shared data folder collapses the design back into the current situation,
  silently.
- **A and B:** 13 EDT indicators on XAUUSD M5 + 13 on M15, anchors set, plus
  `EconomicCalendarExport_v2_29.mq5`. A and B must be interchangeable, or a promote changes more
  than the tuning that was intended.
- **S:** `ohlcvexportlightweight_v2_29.mq5` on 8 M5 charts — EURUSD, USDJPY, GBPUSD, AUDUSD,
  NZDUSD, USDCAD, USDCHF, XAUUSD. The XAUUSD chart here is deliberately separate from A/B's.
- Point `CGI_EXPORT_DIR` at **S, permanently**. Set the individual NSSM property — **do not
  re-run `install_services.bat`**, which would overwrite the live services' real credentials
  with the file's placeholder values.

### 5.2 Rehearse one promote before relying on it

During a **market close**, following `docs/runbooks/mt5-terminal-promote.md`, and confirm the
rollback path (§5 of that runbook) before it is ever needed in anger. Until this happens, the
procedure is written but unproven.

### 5.3 Confirm the M5 threshold margin in practice

The guard allows 600s of lag on M5 against a worst legitimate case of ~495s — a 105s margin,
chosen deliberately tight. If real cycles ever start being rejected with "stale export
directory" while the terminal is demonstrably healthy, the threshold is too tight: widen
`MAX_BAR_LAG_MULTIPLIER` to 3, or switch to the `TF_SECONDS + 600` rule tabled in
`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md` §4.3. This cannot be settled without live data.

### 5.4 Smaller, non-blocking follow-ups

- **Blueprint §8.1 carries a stale line** — the directory listing still says
  `collector/ ... + the 4 calc .py`, obsolete since the calc stack was parked 2026-09-09. It
  sits inside a block this session edited and was deliberately left alone to keep the diff
  honest to scope. Worth a line from whoever next edits §8.
- **The Decision Layer's BLOCKED banner may over-block §3.1.** It blocks drift re-scoring on
  the grounds that it needs parameters other than those compiled into the `.mq5` — but §3.1 as
  written re-scores **the currently active config**, which _is_ the compiled one, and its
  substrate (`indicator_statistics`) has been live since 2026-09-09. On that reading drift
  _detection_ is unblocked today, and only §3.2's `top_alternative_preview` genuinely is not.
  Raised as a reading to confirm, **not** a settled correction, since it narrows a blocker that
  file states categorically. Davin or the Advisor's call.
- **The executive-summary deck is untracked.** `ACTIVE-STANDBY-TERMINAL-Executive-Summary.pptx`
  sits in this folder but was not committed — it is Davin's own Claude Cowork output, and he did
  not ask for it to be versioned. There is precedent for tracking decks here
  (`V2.29-Data-Pipeline-Architecture-Summary.pptx` is tracked), so add it if that is wanted.

---

## 6. Git history

| Commit     | Scope                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `08df516a` | `fix(stack-c)`: the stale-export guard + 9 tests                                    |
| `98a84e89` | `docs(stack-c)`: architecture design, promote runbook, blueprint §0.5/8.1/8.3/12/13 |
| `f6df4685` | `docs(ad-hoc)`: this manifest + the `CLAUDE.md` session entry                       |
| _(this)_   | `docs(ad-hoc)`: rename this file `active-stanby` → `active-standby`                 |

All pushed to `origin/main`. The pre-push hook ran the full monolith suite on `f6df4685`:
**196/196 suites, 2636/2636 tests**, matching the existing baseline exactly — zero regressions,
as expected for a change confined to Stack C's own Python collector.

> **Note on the third commit:** `CLAUDE.md` already carried an **uncommitted entry from an
> earlier session that day** (the Currency Index PRO production-migration verification, left
> for Davin's review under this repo's log-first-defer-commit pattern). Because both entries
> live in the same file, that entry is committed alongside this session's. It is prior,
> completed, already-reported work — not something introduced here.

---

## 7. Explicitly out of scope

- **Any version history for `market_data_v6`.** A promote overwrites shared history rows;
  reconstructing what a chart showed last week remains impossible. Closing that needs a genuine
  version dimension in the schema, far beyond this design.
- **Parameter search.** This validates _one_ candidate configuration assembled by hand. It
  cannot sweep hundreds, which is what `DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` §2.2's
  `param_search` specifies — still blocked on the parked Python calc stack.
- **Automatic drift detection.** Promotion is triggered by the administrator noticing
  staleness. Automating that trigger is Workstream (2) of the decision layer.
- **The two open pipeline issues this touches but does not address** —
  `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` (a promote re-queues ~6,000 rows, which is exactly the
  load that document says has never been measured) and
  `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` (the re-anchoring mechanism that makes a
  retune rewrite history in the first place). Both predate this work and are unchanged by it.

**What it does provide, and should not be undersold:** the decision layer's §2.4 mandates
walk-forward, out-of-sample validation, which the blueprint records as blocked — both because
arbitrary-parameter recomputation is unavailable and because stored history is not point-in-time
honest. A candidate running live on a hot standby is immune to both: MT5 computes it directly,
and every bar it produces arrives genuinely out-of-sample. It is a physical, slow, serial
substitute for the validation half of Workstream (1) — **available today, with no dependency on
the parked calc stack.**
