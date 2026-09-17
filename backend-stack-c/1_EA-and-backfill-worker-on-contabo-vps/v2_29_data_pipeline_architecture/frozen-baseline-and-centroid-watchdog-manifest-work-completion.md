# Frozen Baseline & Centroid Watchdog — Work Completion Manifest

**Date:** 2026-09-18
**Spec:** `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`
(`ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT`)
**Status:** **Code complete, verified & compiled (.ex5 built 2026-09-18), NOT deployed.** Production behaviour is unchanged
until `.ex5` binaries are copied to terminals and a terminal is switched — see §5.

---

## 1. What was asked, and what it turned into

Two pillars: freeze the ACTIVE terminal's baseline/EDT so it stops repainting
history (Pillar 1), and build a daemon that tells the administrator when a new
centroid forms so nobody has to watch MetaTrader (Pillar 2).

Both are built, following the spec's own §6.3 build order. **Nine points in the
specification were contradicted by the live code**; each was resolved in favour of
the code and is recorded, with the reasoning, in the spec's new §8. Three of those
would have shipped a broken feature rather than a rough one:

- **The trigger was inverted.** §5.1.4 reads `centroids[centroid_count-1]` as the
  latest centroid. The array is sorted **descending** by bar index, so that is the
  **oldest** one. As specified, the watchdog would never fire on a new centroid
  forming, and would instead fire when an ancient one dropped out of the window.
- **The LOEDT sign was backwards.** §3.1/§5.1.3 subtract the offset. The live
  convention is signed-and-added (`g_stat_loedt_offset = min_below_intercept -
base_c`, which is **negative**, and that negative number is what `[EDT CHANNEL]`
  exports). Subtracting it draws the lower band **above** the baseline and exports
  `loedt > base_fl` — which downstream reads as a support level above price.
- **The debounce did not debounce.** §5.2's sample code counts wall-clock seconds
  and never removes a candidate that disappears. So a flickering centroid — the
  exact thing the feature exists to filter — would still confirm after 600s, and a
  candidate seen once on a Friday evening would "mature" over a weekend during
  which no bar closed.

A fourth is worth stating because it constrains what is possible rather than what
is correct: **§5.3's promote script cannot switch a terminal into frozen mode.**
MetaTrader exposes no supported way for an outside process to change a running
indicator's inputs. The shipped tooling generates the presets and then verifies
that a human loaded them; it does not claim the step it cannot do.

---

## 2. Artifacts

### New

| File                                                                    | Role                                                                                                           |
| :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `centroid_watchdog.py`                                                  | Pillar 2. Read-only standby watcher, debounce automaton, alert dispatch (generic/Discord/Telegram). 704 lines. |
| `test_centroid_watchdog.py`                                             | 35 tests over the automaton, parsing, impact analysis, state and staleness.                                    |
| `install_centroid_watchdog_service.bat`                                 | NSSM installer, deliberately separate from `install_services.bat`.                                             |
| `active-standby-terminal-operation-for-admin/generate_frozen_preset.py` | Captures an approved line into MT5 `.set` presets; `--verify` proves a terminal really is frozen.              |
| `frozen-baseline-and-centroid-watchdog-manifest-work-completion.md`     | This file.                                                                                                     |

### Changed

| File                                                                         | Change                                                                                                                                                                                                                                                                      |
| :--------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mq5/2EDTCentroidRegression*_v2_29.mq5` (all 7)                              | `[CENTROIDS_DETAIL]` + `[FROZEN_SNAPSHOT]` export blocks; `ENUM_PROJECTION_MODE` + 5 frozen inputs; `ProjectFrozenChannel()`; `ResetCentroidDetail()`; `OnInit` pre-flight. **The certified clustering path is untouched** — frozen mode is a branch taken _instead_ of it. |
| `export_collector_validator_v2.py`                                           | 6 `Frozen *` labels added to `STAT_CONFIG_LABELS`, so a promotion mints a new `config_hash`. No parser change was needed.                                                                                                                                                   |
| `active-standby-terminal-operation-for-admin/promote_terminal.bat`           | Menu `[4]`/`[5]`; a FROZEN pre-flight that runs before the confirmation prompt.                                                                                                                                                                                             |
| `active-standby-terminal-operation-for-admin/OPERATIONAL_RUNBOOK_{EN,TH}.md` | New §8: the freezing workflow, the watchdog, troubleshooting.                                                                                                                                                                                                               |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`                                | New §5.6; §0.1/§0.5 manifest rows; §12 item 8 amber; §13 item 8 (deployment).                                                                                                                                                                                               |
| `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`                            | Status → PARTLY ADDRESSED, with the scope stated precisely.                                                                                                                                                                                                                 |
| `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`          | Status banner + §8 implementation record.                                                                                                                                                                                                                                   |

---

## 3. Design decisions worth carrying forward

**The anchor is a TIME, not a bar index.** The regression is fitted in bar-index
space, but MetaTrader deepening history shifts every index in the array. Measured:
freezing the index instead moves the whole channel **72.60 USD** the first time
500 bars load. The verification deliberately proves the rejected design _fails_
that check — a check that passes either way proves nothing.

**`InpFrozenAnchorPrice` is a price, not an intercept.** It is the baseline value
at the anchor bar (`Anchored Y-Int`), not the regression's `c`, which is the price
at bar index 0 and is thousands of dollars from the market. Renamed from the
spec's `InpFrozenIntercept` precisely so nobody pastes the wrong number.

**Frozen mode still computes statistics.** The spec draws three buffers and stops.
But `ExtSlope`/`ExtIntercept`/`ExtAngle` and both fit models are written only
inside the clustering routine, so the ACTIVE terminal would have pushed an
all-NULL `indicator_statistics` row every cycle — silently regressing a shipped,
append-only capability. Written by a separate self-contained routine, so the
certified dynamic path is byte-for-byte untouched. Those frozen statistics are
also the natural drift signal: R² and Containment against a line that is no longer
being refitted answer "is the approved line still describing this market?".

**The debounce counts closed bars from MT5's own clock.** A new `Live Bar TS (UTC)`
export line is the reference. Wall-clock time advances over a weekend; bar time
does not, and bar time is what is being measured.

**Seeding is not politeness, it is correctness.** Without it, every restart of the
service announces the centroid the administrator has been looking at all week.

**One alert, not fourteen.** All 7 variants watch the same market, so a real regime
change confirms in most of them within one cycle.

**Promotion is recorded for free.** The five `Frozen *` keys are configuration, so
`indicator_configs` now holds a permanent, append-only record of every promotion.
The `Snapshot *` keys are deliberately excluded — they drift every cycle and would
mint a new hash each time, burying the signal.

---

## 4. Verification

| Check                                                           | Result                                                                                                                                                                           |
| :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python `py_compile`, 5 modules                                  | clean                                                                                                                                                                            |
| MQL5 static, 7 files, three passes                              | brace/paren balance vs HEAD, declaration-before-use, scope, arity, dynamic path reachable, frozen blocks outside the certified routine, LOEDT additive everywhere — **all pass** |
| MQL5 identifier resolution (`verify_mq5_frozen_identifiers.py`) | every identifier the inserted code REFERENCES is declared in the file it landed in — **all pass** (added after it failed; see §4.1)                                              |
| Frozen projection maths                                         | formula extracted from the `.mq5`, not retyped; immutability, history-deepening stability, sign convention, promotion round-trip (max error 4.6e-13) — **13/13**                 |
| `test_centroid_watchdog.py`                                     | **35/35**                                                                                                                                                                        |
| Watchdog mutation check                                         | **8/8 killed**; restore byte-exact by sha256, run unconditionally                                                                                                                |
| Watchdog end-to-end                                             | real process, real files, state across process restarts — **22/22**                                                                                                              |
| Preset generator                                                | refusals for pre-upgrade / bad sign / unresolved line / stale export / partial set, `--verify` both ways — **22/22**                                                             |
| `promote_terminal.bat`                                          | labels, paren balance, delayed expansion, ordering, `cmd` parse — **all pass**                                                                                                   |
| Collector compatibility                                         | every staging column and `config_hash` unchanged by both new sections — **all pass**                                                                                             |
| Full promotion cycle                                            | real collector + real `promote_cycle()`: frozen repaints **0 of 44** historical bars; dynamic repaints **44 of 44**, largest move **3.29 USD** — **22/22**                       |
| All existing Python suites                                      | **112 tests, zero regressions**                                                                                                                                                  |

The last two are the ones that matter. The promotion-cycle test walks the whole
administrator workflow — centroid forms → watchdog debounces → alert → presets
generated → verify refuses → presets loaded → verify passes → collector promoted —
and then asserts at the database level that re-exporting the same historical bars
after 8 new ones arrive leaves `base_fl`/`uoedt`/`loedt` byte-identical. The
dynamic contrast case in the same harness proves the problem it fixes is real.

### 4.1 A compile failure this verification did not catch, and the check added for it

**5 of the 7 indicators failed to compile in MetaEditor on the first attempt.**
The static checks above all passed, and they were all beside the point: they
verified that the insertion POINTS were sound — anchors unique, braces balanced,
new blocks outside the certified routine — and never asked whether the
identifiers the inserted code _consumes_ are declared in the file it landed in.

`ProjectFrozenChannel()` was written against the reference file the spec names
(`BestFitNonMostRecentA`) and the other six were treated as structurally
identical. They are not:

| Identifier            |      BestFit A/B       | CherryPickA | CherryPickB | MostRecent | NonRecent A/B |
| :-------------------- | :--------------------: | :---------: | :---------: | :--------: | :-----------: |
| visual lookback input | `InpCFLVisualLookback` |  `InpEDT…`  |  `InpEDT…`  | `InpEDT…`  |   `InpEDT…`   |
| `g_stat_excluded`     |        declared        |      —      |      —      |     —      |   declared    |
| `g_stat_lambda`       |        declared        |  declared   |      —      |     —      |       —       |

That is precisely why BestFit A/B compiled and the other five did not.

**Fixed two different ways, for two different reasons.** The visual-lookback
input has no common name, so it is per-file — resolved by reading each file's own
declaration rather than hard-coding a mapping, since a hard-coded map is the same
assumption that caused the failure. `g_stat_excluded` and `g_stat_lambda` were
dropped from **all seven**, including the two that compiled: those variants have
no such concept (CherryPick excludes by a string-index array, MostRecent does not
exclude, the WLS lambda is a BestFit-family feature), both are declared `= 0`
where they exist and MT5 re-runs `OnInit` when inputs change, so omitting the
assignment leaves exactly the value it was setting. Declaring the missing globals
was rejected — it would invent state to satisfy a line of code. This also restores
the property that made the scripted edit reviewable: the routine is now
byte-identical in all 7 (one sha256, normalising only the lookback name).

**The check is now automated rather than written down.**
`verify_mq5_frozen_identifiers.py` resolves every identifier referenced by the
inserted regions against what each file declares. It reproduces MetaEditor's
output exactly — same files, same identifiers, matching counts.

⚠ **Its first draft did not.** A permissive regex for comma-declaration lists
(`double ExtCen0[], ExtCen1[];`) swallowed the right-hand side of
`int drawStartIdx = rates_total - InpCFLVisualLookback;` and registered all three
words as declarations — so the checker silently absolved the very identifier it
was written to catch, while correctly flagging the other two. Worth recording:
a verifier that agrees with you is worth less than one you have watched fail.

**Two of my own test expectations were wrong and were corrected, not worked
around.** A bar-6 alert I had flagged as a duplicate was the M15 lane confirming on
its own (3× slower) clock — correct behaviour, now asserted explicitly. And a
"sliding window dropout" fixture placed a new centroid one bar from a known one,
inside the drift-tolerance window; that suppression is deliberate (a known
centroid's own centre of mass drifts by about a bar between polls, and without it
it would re-alert forever), so the trade-off now has its own test rather than
being quietly widened away.

---

## 5. Deployment Status & Execution Plan

**Nothing here changes production yet.** `InpProjectionMode` defaults to
`MODE_DYNAMIC_AUTOFIT`, the watchdog is not installed, and no terminal has been
switched. Deployment follows blueprint §13 item 8. In order:

1. ✅ **Recompile all 7 centroid indicators in MetaEditor.** [COMPLETED 2026-09-18]
   - All 7 centroid indicators were successfully recompiled in MetaEditor on Windows with **0 errors and 0 warnings**.
   - All 7 `.ex5` binaries (`BestFit A/B`, `CherryPick A/B`, `MostRecent`, `NonRecent A/B`) are newly generated, fully verified, and committed to git.

2. ⏳ **Deploy `.ex5` Binaries to Terminal A and Terminal B:**
   - Copy all 7 newly compiled `.ex5` files from `backend-stack-c/.../mq5/` to:
     - `C:\MT5-A\MQL5\Indicators\`
     - `C:\MT5-B\MQL5\Indicators\`
   - Restart MT5 instances or right-click Navigator and select **Refresh**.
   - **Sanity Verification:** Check a newly exported `{prefix}_{SYMBOL}_{TF}_Statistic.txt` in `MQL5\Files`. Confirm that both `[CENTROIDS_DETAIL]` and `[FROZEN_SNAPSHOT]` blocks are actively populated.

3. ⏳ **Install & Start Centroid Watchdog Service:**
   - On Contabo VPS, ensure `ADMIN_ALERT_WEBHOOK_URL` is set in the environment or service definition.
   - Run `install_centroid_watchdog_service.bat` as Administrator.
   - Verify service starts cleanly via NSSM/Windows Services (`nssm status CentroidWatchdog`).
   - Expect 14 "seeded" lines in logs and zero spurious alerts on startup.

4. ⏳ **Freeze the ACTIVE Terminal:**
   - Run `promote_terminal.bat` and select menu `[4]` to generate `.set` preset files with captured line parameters.
   - Manually load the `.set` preset files into the active MT5 chart indicators.
   - Select menu `[5]` (`--verify`) to prove to the promotion tool that the active terminal is actively frozen.

5. ⏳ **Rehearse Promotion & Rollback During Market Close:**
   - Execute a complete Active/Standby switchover via `promote_terminal.bat` (select target terminal `[1]` or `[2]`).
   - Confirm collector restarts cleanly and streams frozen parameters.
   - Test immediate rollback back to the original terminal to verify rollback insurance remains 100% operational.

**Also not verified:** the watchdog has never seen a real centroid form, no alert
has ever been delivered to a real webhook, and every number in §4 comes from
synthetic exports driven through real code.

**Out of scope, deliberately.** Freezing covers the 7 centroid variants' channel
fields (~21 of the ~56 drifting columns). `fractal_*`, `best_resistance`,
`best_support` and the per-variant `horiz_*_map`/`ssa`/`ema_ssa` columns still
rewrite — `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` now says so explicitly.
Freezing from today forward also does nothing about the ~3000 bars of history
already stored; sizing that still needs the magnitude experiment in that
document's §4, which has never been run.
