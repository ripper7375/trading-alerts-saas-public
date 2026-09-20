# S&R Calibrator Indicator Defects + Look-Ahead Bias Mitigation — Work Completion Manifest

**Date:** 2026-09-20
**Trigger:** Davin, a two-part task order — (1) fix the four indicator-side defects recorded in
`ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md` §6.3 and left unfixed when the 14th
indicator was onboarded on 2026-09-16, and (2) address the look-ahead bias documented in
`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`, starting with the §6 magnitude experiment that
document has carried as unrun since 2026-09-09.
**Status:** **Part 1 complete and compiled (0 errors). Part 2 measured and built; migration
authored, NOT applied; gateway NOT deployed.** Nothing about production behaviour has changed yet
— see §6.

---

## 1. What was asked, and what it turned into

### Part 1 — four defects, and one of them was described wrongly

§6.3 listed four indicator-side defects, all flagged as "outside this change's scope" in September.
Three were exactly as described. **The fourth was a real off-by-one with the wrong explanation
attached to it**, and that only surfaced because a real capture was checked before the source was
touched.

§6.3 said: _"The export is 3001 rows, not 3000. The loop runs `shift = MathMin(InpExportBars,
bars-1) ... 0`, inclusive at both ends — 3000 closed bars plus the still-forming bar."_

Counting `engine-1-5-new/SR_Levels_XAUUSD_M15.txt` directly: **3001 data rows against OHLCV's
3000**, with its oldest timestamp exactly **one M15 bar further back** and its newest identical to
the spine's. So the extra row is at the **old** end, not the new one. Every producer exports shift
0 — `validate_cycle()`'s completeness check requires it — so "plus the forming bar" describes the
normal case, not the defect.

That matters because it changes the fix. Dropping shift 0 would have rejected every cycle.

### Part 2 — the experiment had never been run, and two captures were sitting there

`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` §6 says plainly: _"The mechanism is certain; the
magnitude is unknown and might be small enough not to matter"_, and it makes the whole of §7
conditional on measuring it first. The 2026-09-18 frozen-baseline session re-stated that the
experiment "has still never been run. Run it before relying on any of this for backtesting."

**It could have been run at any point since 2026-09-19.** `davintrade-stack-d-and-e/engine-1-5/`
holds a capture from 2026-09-07 and `engine-1-5-new/` one from 2026-09-19 — **12 days apart**, with
overlapping `Non-Recent-B_XAUUSD_M15.txt`, `OHLCV_*`, `ZScore_*` and `ZigZag_*` files. That is
precisely the experiment §6 describes, already on disk.

It yields **2114 overlapping M15 bars**, and the answer is not "a fraction of a tick". §4 below.

---

## 2. Artifacts

### New

| File                                                                           | Role                                                                                                                                                                              |
| :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `measure_indicator_drift.py` (336 lines)                                       | The §6 experiment, as a repeatable tool. Per-column `changed %`, mean/median/p95/max drift, drift as a % of EDT channel width, and a breakdown by bar age. Grid-snaps timestamps. |
| `generate_point_in_time_schema.py` (312 lines)                                 | Emits the `MarketDataPointInTime` Prisma model and its migration **from the collector's own `SOURCES` registry**, so the 69-column list cannot drift by hand. `--check` mode.     |
| `railway-gateway/src/worker/point-in-time-snapshot.ts` (150 lines)             | Pure, I/O-free: `barAgeInPeriods()` and `buildSnapshot()`. The eligibility decision and the column set, separated from the one Prisma call that writes them.                      |
| `railway-gateway/test/point-in-time-snapshot.spec.ts` (283 lines)              | 25 checks. Age boundaries, NULL-vs-zero, column set diffed against **both** Prisma schemas in both directions, and three assertions on the processor source itself.               |
| `prisma/migrations/20260920000000_add_market_data_point_in_time/migration.sql` | One additive `CREATE TABLE` + two indexes. Byte-identical to `prisma migrate diff`'s own output. **Authored, NOT applied.**                                                       |
| `S&R-calibrator-indicator-and-look-ahead-bias-manifest-work-completion.md`     | This file.                                                                                                                                                                        |

### Changed

| File                                                                     | Change                                                                                                                                                                                                                                   |
| :----------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mq5/SupportAndResistantAutoCalibration_v2_29.mq5` (+227/−48)            | All four §6.3 defects. New `InpBackfillBars` input and `SRPriceToString()` helper; `GenerateFilename()` gained a suffix parameter; `OnCalculate()` split into an expensive new-bar path and a cheap per-tick path.                       |
| `test_sr_levels_source.py` (+180/−7)                                     | New §6 group: 9 tests pinning all four fixes. Module docstring's §4 corrected — it still described `sr_levels` as excluded from `STAT_SOURCES`, contradicting a test in the same file since 2026-09-20.                                  |
| `prisma/market-data/schema.prisma` (+176)                                | `MarketDataPointInTime` model, generated. 69 indicator columns + 3 key + 4 provenance.                                                                                                                                                   |
| `railway-gateway/prisma/schema.prisma` (+176)                            | The same model, written from the same generated string rather than edited twice.                                                                                                                                                         |
| `railway-gateway/src/worker/market-data.processor.ts` (+54)              | `writePointInTimeSnapshot()` after the existing upsert. `createMany({ skipDuplicates: true })`, wrapped, never rethrown.                                                                                                                 |
| `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` (+306/−39)             | Status banner with the measurement; §6 rewritten as DONE with the tool and how to repeat it cleanly; §7 re-evaluated option by option; §8 annotated; **new §9** (the snapshot lane + consumer queries) and **§10** (is freezing enough). |
| `ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md` (+76/−11) | §6.3's four entries struck through with what was actually found and done, including the corrected 3001-row explanation.                                                                                                                  |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` (+74/−8)                   | §12 item 8 gains the measurement and the 21-of-69 coverage arithmetic; §13 gains item 9 (snapshot-lane rollout); §13 item 8's stale "statistics capture is deliberately NOT part of this" corrected; Appendix A + 2 rows.                |
| `docs/migration-orders/migration-stack-analysis.md` (+18/−2)             | `market_data_point_in_time` recorded beside `market_data_v6`, with the rollout-order caveat.                                                                                                                                             |

**Not touched, deliberately:** the collector, the push worker, `sqlite_schema_v6_xauusd.sql`, the
gateway contract JSON, and every DTO. Part 2 adds **no wire field** — the snapshot is derived
server-side from the payload the gateway already receives. **Nothing on the VPS changes.**

---

## 3. Design decisions worth carrying forward

### Backfill means a separate file, or it means nothing

`ExportSRData(bool is_backfill)` accepted the flag and never read it, so the Backfill button did
exactly what Export did while printing `"Starting backfill export for N historical bars..."`. The
worst kind of dead code: the log asserts a behaviour that does not exist.

The obvious fix — make backfill export deeper history into the same file — **achieves nothing**,
and the reason is worth recording. `promote_cycle()` merges every source onto the OHLCV spine, and
OHLCV exports 3000 bars with no backfill button of its own. Bars older than the spine are dropped
on promotion. So deeper history in the pipeline file would cost staging I/O, be discarded, and then
be overwritten by the next `:59` auto export.

Deeper history is only meaningful **outside** the pipeline. So `true` writes
`{Prefix}_{Symbol}_{TF}_Backfill.txt`, which `run_cycle()` cannot see because it builds an exact
filename and does not glob — pinned by a test that writes a decoy file into a temp directory and
asserts the polled name does not appear.

The statistic file is **not** rewritten on backfill. It is a snapshot of the current calibration
and, since 2026-09-20, it is ingested into `indicator_statistics`; a manual click landing on the
collector's `:05` read would be a torn read of a live lane, for no gain.

### The intra-bar gate belongs where the cost is — and re-clustering intra-bar would be wrong

```mql5
if (prev_calculated > 0 && rates_total == prev_calculated)
   return rates_total;
```

`rates_total` differs from `prev_calculated` only when a new bar opens, so this returned on every
tick inside a forming bar and the entire body ran at most once per bar. Three live consequences:
`FillBuffers()` never re-slotted `sr_1..sr_8` as price crossed a level; `LevelAbove`/`LevelBelow`
and the point distances — and therefore the `g_stat_*` fields the statistic file publishes — were a
bar stale; and the `MathAbs(lastClose - close[0]) > Point()` branch below it was unreachable, since
by the time control reached it a new bar had opened and the `lastCalculationTime != time[0]` branch
had already fired. Dead code guarding dead code.

**The important part is that the obvious fix — let that branch fire — is also wrong.**
`ArrayLevels` is built from `iFractals`, which needs confirmed bars on both sides, so the forming
bar can never be a fractal. **The level set genuinely cannot change within a bar.** Re-clustering
on a close move would burn CPU on every tick to produce the same answer, and would make the
exported levels change intra-bar, which is worse.

What _can_ change intra-bar is which levels sit above and below the live close. So: expensive path
(three `CopyBuffer` calls over up to `InpExportBars` values, plus the Freedman-Diaconis clustering)
stays new-bar gated; cheap path (re-slotting the resolved `ArrayLevels`, a linear scan of tens of
macro clusters) runs every tick. The pre-existing
`prevLevelAbove != LevelAbove || prevLevelBelow != LevelBelow` condition is a genuine crossing
detector now rather than a new-bar redraw, and reports one — but only when `!new_tag_bar`, since on
a new bar the pair changes for uninteresting reasons.

File exports keep their bar-close guarantee structurally: they run from `OnTimer()` and the
`EXPORT_ALL` broadcast, never from `OnCalculate()`.

### §7 option 2 does not work as written, and saying so is the finding

The open issue proposed: _"Add a column recording how many bars had elapsed when the value was
computed... a backtest could select only rows written at age 0."_

**It cannot.** On a mutable row the column records the age at the time of the _latest_ write, and
every in-window bar is rewritten on every cycle — so after a day every row reads `age ≈ 288`, and
after 3000 refits ~3000. `WHERE bar_age = 0` returns the newest bar and nothing else. Making it
work would mean refusing to update a row once its age exceeds 0, which is exactly the live-zone
behaviour §8 forbids breaking.

**The idea is right; the table is wrong.** Age provenance only means something on a row that is
never rewritten. It is folded into option 1 as `snapshot_age_bars`, where it does real work — see
below.

### `snapshot_age_bars` exists because of a different open issue

A snapshot lane that trusts "first sighting after close" is only honest if the push worker keeps
up. `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` documents ~800 rows/min of demand against a likely
375–600 capacity, with **oldest-first** selection — so under backlog the newest bars arrive late.
Without the column, a backlogged worker would make the snapshot lane silently reproduce the very
bias it exists to remove.

A late row is **recorded, not dropped**: a gap is indistinguishable from "the indicator had nothing
to say", whereas an honest age lets the consumer decide. `1` is the honest value; `0` is never
written (still-forming bar).

### 69 columns, not 95, and the list is generated

Snapshotted: the 7 centroid variants (56), `fractal_*`/`best_resistance`/`best_support` (5), and
`sr_1..sr_8` (8).

Deliberately absent: the OHLCV spine, the causal z-score triple (`InpZScoreLength` is a _trailing_
window), and the 11 `zigzag_*` columns — **all three measured stable** in §4, so duplicating them
costs storage and buys nothing. A consumer joins `market_data_v6` for them, which is safe precisely
because those are the columns that do not move.

The list is **derived** from the collector's `SOURCES` registry through the same
`market_data_column()` that `promote_cycle()` uses. A hand-maintained 69-column mirror across two
Prisma schemas is exactly the drift this repo has been bitten by before — the `best_fit` split
touched ten files, and `schema-sync.spec.ts` exists because of it.

### Where the write goes, and why not the VPS

§8's own constraint: _"it belongs in Postgres, written by the gateway, not accumulated on the
Contabo disk."_ Honoured exactly. The hook is in `MarketDataProcessor`, immediately after the
existing `market_data_v6` upsert, which gives three properties for free:

- **Write-once** via `createMany({ skipDuplicates: true })` — an `INSERT ... ON CONFLICT DO
NOTHING`. Re-delivery is the norm here, not an exception: the push worker retries by design and
  every in-window bar is re-queued every cycle, so this runs thousands of times per bar and must be
  a no-op after the first.
- **It cannot break ingestion.** Wrapped, logged, never rethrown — the same ordering, and the same
  reason, as the collector's own statistics capture.
- **Never the forming bar.** `buildSnapshot()` returns `null` until the bar's period has ended.

Postgres growth: ~384 rows/day (288 M5 + 96 M15) ≈ **140 k rows/year**, one row per bar, never
updated.

---

## 4. What the measurement actually says

Two real MT5 captures, **12 days apart**, **2114 overlapping M15 bars**. Median EDT channel width
over the same bars: **137.13 USD**.

| Column           | bars compared | changed            |    mean \|Δ\| |     max \|Δ\| | mean as % of channel |
| :--------------- | ------------: | :----------------- | ------------: | ------------: | -------------------: |
| `non_b_uoedt`    |           922 | **100.0 %**        | **19.26 USD** | **22.86 USD** |           **14.0 %** |
| `non_b_loedt`    |           922 | 99.9 %             |      3.20 USD |      6.77 USD |                2.3 % |
| `non_b_base_fl`  |           922 | **100.0 %**        |      1.98 USD |      4.73 USD |                1.4 % |
| `non_b_ssa`      |          2114 | **100.0 %**        |     0.057 USD |      5.44 USD |                0.0 % |
| `non_b_ema_ssa`  |          2114 | **100.0 %**        |     0.047 USD |      4.74 USD |                0.0 % |
| `non_b_crossing` |          2114 | 0.71 % **flipped** |             — |        0 ↔ 1 |                    — |

**§6's own decision rule — _"if it is a meaningful fraction of the EDT channel width, it decides
how §7 gets built"_ — is met decisively.** The upper band of a _closed_ bar moves by 14 % of the
channel on average, on every single comparable bar. And `*_crossing` is not a price: it is a
boolean signal flag, and it **flipped on 15 of 2114 bars** — the indicator retroactively deciding a
cross did or did not happen there. That is the exact kind of value a fitness scorer would treat as
ground truth.

**The controls behaved, which is what makes the above trustworthy.** OHLCV was unchanged apart from
~3 bars of genuine broker history revision (max 0.50 USD on a high; a volume revision of 908
ticks). **Confirmed ZigZag pivots moved on 0.0 % of 128 overlapping bars.**
`horiz_high_map`/`horiz_low_map` moved on 0.0 % of their 39/43 comparable bars. Every one of those
is exactly what §2 of the open issue predicts.

### ⚠ One confound, stated rather than buried

`Regression Centroids (Box B)` changed **5 → 7** between the captures — read out of the two
`_Statistic.txt` files, not inferred. So the `base_fl`/`uoedt`/`loedt` figures are a **mixture** of
sliding-window refit and a deliberate reconfiguration, and the two cannot be separated from this
pair of captures.

It does not weaken the conclusion, for two reasons. **`InpRegCentroids` is read at exactly one
place in the indicator** (the regression/centroid selection) and **does not touch the SSA
decomposition** — verified in source, lines 1995–2027 run before the branch at 2072. So `*_ssa`,
`*_ema_ssa` and `*_crossing` are **confound-free**, and they still changed on 100 % of 2114 bars.
And from a backtester's point of view the two mechanisms are the same defect: the stored row was
overwritten with a value that could not have been known at bar close — which §2's own table already
says for the fixed-anchor families ("re-anchoring them rewrites _every_ historical value at once").

A clean re-run needs two captures with no input change between them. The tool is kept for it.

### Two findings about the measurement itself

- **§6's age-gradient prediction could not be tested.** The overlap starts 25 % into the old
  capture's window, so the oldest quartile has **zero** comparable bars. Within the range that does
  exist the direction holds (`uoedt` mean 22.01 in the 50–75 % bin vs 18.40 in the newest quartile),
  but that is partial support. Reported as untestable, not as refuted.
- **`base_fl`/`uoedt`/`loedt` exist on only 922 of 2114 bars — which is exactly the old capture's
  own `Visual EDT Window (Bars): 922`.** A useful internal consistency check on the tooling, and it
  means the drift is not a gentle gradient but a **wholesale repaint of the entire drawn channel**.

### Is freezing the ACTIVE terminal enough? No — 21 of 69

`MODE_FROZEN_LINE` bypasses `PerformClusteringAndEDT()`. **The SSA decomposition runs before that
branch and is unaffected by it** — read in source, not assumed.

| Column group (× 7 variants)                | Frozen mode         | Measured                                     |
| :----------------------------------------- | :------------------ | :------------------------------------------- |
| `*_base_fl`, `*_uoedt`, `*_loedt` (21)     | ✅ frozen           | the largest term — up to 14 % of channel     |
| `*_ssa`, `*_ema_ssa`, `*_crossing` (21)    | ❌ still dynamic    | 100 % of bars; `crossing` flips on 0.71 %    |
| `*_horiz_*_map` (14)                       | ❌ not covered      | 0.0 % over the comparable sample             |
| `fractal_*`, `best_resistance/support` (5) | ❌ other indicators | not measurable — no capture overlap          |
| `sr_1..sr_8` (8)                           | ❌ other indicator  | structurally the strongest look-ahead (§6.3) |

Freezing is the right first move and it is cheap. It is not the fix: **a signal flag still flips
retroactively on a frozen terminal.**

---

## 5. Verification

| Check                                        | Result                                                                                                                                                      |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MetaEditor CLI compile**                   | **0 errors, 0 warnings.** `.ex5` regenerated (59,626 → 63,378 bytes), newer than source.                                                                    |
| **Compiler mutation**                        | An undeclared identifier injected into the new helper's call site → `error 256: undeclared identifier` at the exact line. **Killed.** Restore byte-exact.   |
| MQL5 static (own checker, character scanner) | brace/paren/bracket balance unchanged vs HEAD; every introduced identifier declared; removed identifiers have zero references; declare-before-use. **PASS** |
| `verify_mq5_frozen_identifiers.py`           | **10/10 PASS** — unchanged; confirms nothing in the frozen-mode regions was disturbed                                                                       |
| `test_sr_levels_source.py`                   | **39/39** (was 30; +9 for the four fixes)                                                                                                                   |
| **Indicator mutation harness**               | Each of the four fixes reverted in turn → **6/6 mutations killed**, each by the intended test. Restore verified byte-exact by sha256 in a `finally` block.  |
| All 8 Stack C Python suites                  | green, **zero regressions**                                                                                                                                 |
| `railway-gateway`                            | `tsc` clean; **6/6 suites, 93/93** unit (was 5/5 · 68/68 — +1 suite, +25 tests); **4/4 suites, 43/43** e2e unchanged                                        |
| Monolith                                     | `tsc` clean; `npm run test:ci` **220/220 suites, 2881/2881 tests** — exact baseline match, zero regressions                                                 |
| Prisma                                       | both schemas validate; `MarketDataPointInTime` field lists identical across both copies (asserted by test, both directions)                                 |
| Migration vs. `prisma migrate diff`          | **byte-identical** after comment stripping, including index emission order                                                                                  |
| Generator self-check                         | `generate_point_in_time_schema.py --check` — 69 registry-derived columns present in both schemas; leak check confirms no stable-source column crept in      |
| Real statistic-file round trip               | `SR_Levels_XAUUSD_M15_Statistic.txt` through the real collector parser → **16 fields**, all 10 `sr_*` values present despite the ASCII-hyphen header        |

**The compiler mutation is the one that matters**, and it changed how the compile result is read.
The clean build returned **ExitCode 1** and the mutant returned **ExitCode 0** — so
`MetaEditor64.exe`'s exit code is _not_ a success signal here. Only the log line
`Result: N errors, M warnings` is authoritative. A CI step trusting the exit code would have
reported a broken indicator as green.

**The 3001-row claim was measured, not reasoned.** Before the loop was touched, the real capture
was counted: 3001 SR rows vs 3000 OHLCV, oldest timestamp one bar further back, newest identical.
That is what showed §6.3's own explanation of the defect was wrong, and what proved dropping shift
0 would have rejected every cycle.

### 5.1 Four mistakes of my own, three of them the same shape

**A verifier that agrees with you is worth less than one you have watched fail.**

1. **The first static checker reported the 1100-line baseline as having 2 braces.** It stripped
   comments and literals with regexes, and an unmatched apostrophe swallowed most of the file. A
   checker that is wrong about a known-good file is worse than no checker. Replaced with a
   character scanner, and it now **validates itself against the baseline** — which compiles — before
   reporting anything about the edited file.

2. **Three separate assertions passed because they matched the comment explaining the bug.**
   - `'MathMin(InpExportBars, available_bars - 1)' not in src` — the fix's own comment quotes the
     old expression verbatim to say what was wrong with it.
   - `'"_Backfill"' in src` — survived a mutation that removed the suffix from the _call_, because
     the explanatory comment above it also contains the literal. **Caught only by the mutation
     harness**, which is exactly why it was run.
   - `expect(body).not.toContain('@updatedAt')` — the Prisma model's own comment explains _why_
     there is no `@updatedAt`.

   All three now strip comments first. The shape is worth naming: **when a fix is documented next
   to itself, a source-text assertion will match the documentation.**

3. **The declare-before-use check passed vacuously.** It compared the definition's offset against
   the first regex hit for the name — which is the name _inside_ the definition, seven characters
   later. It now excludes everything inside the definition and carries a self-test.

4. **A `Print()` added to the export path would have logged once a minute per chart.** Caught while
   writing it, not after: 14 indicators × 2 timeframes × 60/hour into the Experts log, when the
   callers already log success. Restricted to the manual backfill, which is the path where the row
   count is actually diagnostic.

### 5.2 Two things corrected in passing, because they now contradict the code

Neither was in scope; both were one-line contradictions sitting in a deployment checklist.

- `test_sr_levels_source.py`'s module docstring §4 still described `sr_levels` as **excluded** from
  `STAT_SOURCES` — while a test in the same file, `test_sr_levels_is_enrolled_in_stat_sources`,
  asserts the opposite.
- `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` §13 item 8 still ended with _"Statistics capture is
  deliberately NOT part of this"_, with the full exclusion rationale. Struck through and replaced
  with the current state **plus the ordering hazard that survives it**: the `source` enum is still
  closed and the POST is still batched, so the gateway must be deployed before the VPS starts
  sending `sr_levels`.

### 5.3 Not verified — stated rather than implied

- **No disposable-Postgres rehearsal.** Docker Desktop's Linux engine would not start (the
  recurring gap). Acceptable here for the same reason the 2026-09-09 session gave: one additive
  `CREATE TABLE` touching no existing row, cross-checked byte-for-byte against `prisma migrate
diff`'s own output.
- **The indicator is compiled but has never run on a live chart.** The intra-bar crossing path, the
  `_Backfill` file and the `_Digits` formatting are verified statically, by mutation and by
  compile — not against real ticks. Attach it to a chart and confirm a fresh
  `SR_Levels_XAUUSD_M5.txt` has exactly 3000 data rows before trusting the export depth.
- **No live round trip for the snapshot lane.** The write path is proven against the real Prisma
  client's types and a mocked processor; no row has ever been inserted into
  `market_data_point_in_time`, because the table does not exist yet.
- **The drift measurement carries the `InpRegCentroids` confound** described in §4. The SSA columns
  are clean; the channel columns are not cleanly attributable.

---

## 6. Deployment Status & Execution Plan

**Current status:** Part 1 is compiled and ready to deploy. Part 2 is code-complete and **inert** —
the table does not exist, the gateway has not been deployed, and `market_data_v6` behaves exactly as
it did yesterday.

### Part 1 — the S&R indicator

1. ✅ **Compiled 2026-09-20 12:42** via `MetaEditor64.exe` CLI — **0 errors, 0 warnings**. Read the
   log's `Result:` line, not the exit code (§5).
2. ⬜ **Transfer `SupportAndResistantAutoCalibration_v2_29.ex5` to the VPS terminal** and reattach
   to XAUUSD M5 + M15.
3. ⬜ **Confirm the export depth changed.** A fresh `SR_Levels_XAUUSD_M5.txt` must have **3000** data
   rows, not 3001, and its newest timestamp must still equal OHLCV's. If the newest row is missing,
   stop — every cycle will be rejected.
4. ⬜ **Optional:** `InpBackfillBars` defaults to `0` (all loaded history). The Backfill button now
   writes `SR_Levels_XAUUSD_{TF}_Backfill.txt`, which the collector ignores.

**No collector, schema or contract change accompanies this.** Part 1 is indicator-side only.

### Part 2 — the snapshot lane. ⚠ ORDER IS LOAD-BEARING

1. ⬜ **Apply the migration to production** (`maglev.proxy.rlwy.net:58290`).
   Run `prisma migrate status` **first** — `migrate deploy` applies _every_ pending migration in
   history order, not just the intended one. This has ridden along unnoticed before.
2. ⬜ **Then** let `railway-gateway` deploy — it auto-deploys from `main`.

Reversing the order corrupts nothing: the snapshot write is wrapped and cannot fail the
`market_data` upsert; it logs a warning and continues. But **every bar missed in between is gone for
good**, because the honest value exists exactly once and there is no backfill for it.

3. ⬜ **Verify it is actually writing**, not merely deployed:

```sql
SELECT snapshot_age_bars, COUNT(*)
FROM   market_data_point_in_time
WHERE  symbol = 'XAUUSD' AND timeframe = 'M15'
GROUP  BY 1 ORDER BY 1;
```

Expect the overwhelming majority at `snapshot_age_bars = 1`. A long tail above 1 means the push
worker is behind — `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`, not a fault in this lane.

4. ⬜ **Tell the consumers.** Backtests, walk-forward validation and the Decision Layer's
   `fitness_scorer` must read `market_data_point_in_time` with `snapshot_age_bars = 1`, never
   `market_data_v6` history. Ready-to-use query in
   `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` §9.

### Still open after this work

- **The ~3000 bars already in `market_data_v6` are not repaired by any of this.** Options 1 and 2
  are prospective only. Only §7 option 3 — offline recomputation — fixes stored history, and it
  needs the parked Python calc stack revived (two open bugs first).
- **Freezing the ACTIVE terminal** (`MODE_FROZEN_LINE`, blueprint §13 item 8) remains worth doing
  and remains insufficient on its own — 21 of 69 columns (§4).
- **A clean drift re-run** with no input change between captures, to separate the sliding-window
  term from reconfiguration.
