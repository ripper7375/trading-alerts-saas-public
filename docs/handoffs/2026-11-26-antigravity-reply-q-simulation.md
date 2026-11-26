# Antigravity Reply: MCD3/SYN Simulation, Finding A (MCD3 Caution) & Finding B (R2 Snapback)

**Date:** 2026-11-26 15:42 +07:00 (`2026-11-26T08:42:00Z`)
**Author:** Antigravity (Computer 1, Advisor)
**In reply to:** [`docs/handoffs/2026-11-26-q-simulation-results-for-review.md`](2026-11-26-q-simulation-results-for-review.md) (`SHA-256` prefix `8f64b9023ed1`)
**Evidence read:** `2026-11-26-q-diagnostic/{simulation.txt,simulation-syn.txt,reply-sweep-checks.md}`, `draft-1.yaml`, `engine.py`, `facts.py`, `mcd1_evaluator.py`, `STACK-D-ARCHITECTURE.md` §3.3–3.4 & §6.6, `2026-10-04-0110-step4-plan.md` §6
**Authority rule:** Recommendations only. Nothing takes effect until **Davin confirms it in chat** to Claude Code (Computer 2). No existing files modified; nothing staged or committed.

---

## Summary Decisions

1. **Proceed with the shadow batch (`MCD0 1.1.0` `A4`, `ADR-100/101`, `main.ts` log filter, `M5 -> most_recent`) now, keeping `M15 = non_b` — while holding `B4 --write` and `B5` (`live`) until Finding B (and Finding A) are resolved.** Starting the sensor-layer changes in `shadow` immediately collects real un-rebuilt `MCD3`/`DISCONTINUITY` and 1-cycle `most_recent` drift data without blocking `draft-2.yaml` design (provided we keep `MCD1` / `M15 = non_b` stable, see #3 below).
2. **Finding A (`SYN` `CAUTIONARY` `77.2%` / `94.5%` via `MCD3` modifier):** By construction (`ADR-061` + `draft-1.yaml` `M3_OVERFLOW`/`M3_TREND_CONFLICT`), `NON_CONSOLIDATED_*` sets `effect: caution` (half preset risk). That is a deliberate trading-risk choice for Davin (`keep` vs `note` on `M3_OVERFLOW` / `SCALPER`), whereas Finding B is a clear rule defect.
3. **Finding B (`R2` forcing `LONG` `78.6%` / `82.0%` in a `-4.31%` week):** **Keep `M15 = non_b` and fix `draft-1.yaml` via `draft-2.yaml` before `B5` (`live`).** Do not blame `M15 = non_b`: gold fell `-161.24` (`-4.31%`) below a 16.5-day corridor, and `M15 most_recent` still hits `MCD1_DOWN_LOWER_BREAKDOWN` `30%` of the week while breaking `MCD0`. The bug sits squarely in `draft-1.yaml`'s `R2_EXHAUSTION_SNAPBACK`.

---

## Detailed Answers (§7)

### 1. Proceed with the shadow implementation batch (`MCD0 1.1.0 A4`, `ADR-100/101`, log filter, M5 switch)?

- **YES — recommend executing in `shadow` now** (once Davin confirms in chat), **with `B4 --write` held.**
  - Why it is safe to deploy the sensor calibration batch first:
    - `simulation.txt` proves `M5 = most_recent` + `A4` solves the `MCD1–MCD3` sensor layer cleanly (`MCD0` any `23.9%`, `MCD1 VALID 96.2%`, `MCD2 VALID 79.3%` / `INVALID 1.7%`, `MCD3 VALID 75.6%` / `INVALID 1.7%`, `NO_MATCH 0`).
    - As `reply-sweep-checks.md` rightly corrects, `M5 = most_recent` still saw `6` window-start step-backs (`82` to `456` slots) that cannot be measured for `DISCONTINUITY` in the filled rebuild — running `most_recent + A4` live in `shadow` is the only way to measure real `MCD3 DISCONTINUITY` and 1-cycle `most_recent` drift over `market_cycle_inputs`.
    - `state_statistics` (`B4`) tracks `MCD1–MCD3`, **not** `SYN`. So authoring `draft-2.yaml` only invalidates `state_statistics` if `MCD1` (`2.1.0`) or `M15` (`non_b`) itself changes; keeping `M15 = non_b` + `MCD1 2.0.1` means clean post-switch `mcd_outputs` and `market_data_point_in_time` rows remain valid for `B4` while `draft-2.yaml` is prepared. _(If Davin instead prefers altering `MCD1` or switching `M15`, hold `B4 --write` until after that change too.)_

---

### 2. Finding A: Half-risk `SYN` (`77.2%` Day Trader / `94.5%` Scalper) via `MCD3` modifier

- **What `simulation-syn.txt` shows:** Even with `MCD0 1.1.0 A4`, `MCD3` is `NON_CONSOLIDATED` in **`1,299 / 1,342` (`96.8%`)** of valid readings (`OVERFLOW 710`, `TREND_CONFLICT 589`). `MODIFIER_CAUTION` is the **sole** cause of `CAUTIONARY` in `763 / 1,062` (`71.8%`) Day Trader and `996 / 1,299` (`76.7%`) Scalper readings.
- **Assessment:** Under `ADR-061` and `2026-10-04-0110-step4-plan.md` §6.1(e), `MCD3` `NON_CONSOLIDATED` was designed to set `CAUTIONARY` (half preset risk; `R1` already exempts `TREND_CONFLICT` via `M3_CONFLICT_EXPECTED_UNDER_R1`). However, `94.5%` half-risk on **Scalper** means half-risk becomes Scalper's de-facto full size because M5 trades rarely wait for 75% nesting across M15.
- **Recommendation for Davin's `draft-2.yaml` review (product/risk call, not a code bug):**
  - Choose explicitly between:
    - **A-keep:** Keep `M3_OVERFLOW`, `M3_TREND_CONFLICT`, `M3_ESCAPE` at `effect: caution` (half-risk whenever M5+M15 are not consolidated; Engine 4 override remains logged), **or**
    - **A-tighten (`recommended if Scalper needs normal sizing`):** Reserve `effect: caution` for `M3_ESCAPE` and `DAY_TRADER` `M3_TREND_CONFLICT` (outside `R1`), and downgrade `M3_OVERFLOW` (historical `< 75%` nesting lag: `501` sole-reason cycles on both profiles) and/or `SCALPER` `M3_TREND_CONFLICT` (`495` sole-reason cycles) to **`effect: note`** (or keep `M3_OVERFLOW` as `caution` on `DAY_TRADER` only and `note` on `SCALPER`).
  - Claude Code can include both counts side-by-side when simulating `draft-2.yaml`.

---

### 3. Finding B: `M15 = non_b`, `draft-2.yaml` (persistent break vs spike), and pre-B4 / pre-B5 gates

- **Keep `M15 = non_b`:**
  - Gold dropped `-4.31%` (`3740.25 -> 3579.01`), so M15 staying below a 16.5-day `non_b` channel (`MCD1_DOWN_LOWER_BREAKDOWN`, `MCD1` own bias = **`SHORT`**) is coherent macro information. Switching `M15` to `most_recent` still hits `MCD1_DOWN_LOWER_BREAKDOWN` `30%` of the week (`408` cycles, hitting the same `R2` rule bug) while failing `MCD0` targets and distorting `MCD1` (`100% DOWN`, `-53°`).
- **Root causes in `draft-1.yaml` (why `draft-2.yaml` is needed before `B5` `live`):**
  1. **Bug B1 (`SCALPER` hijacked by `MCD1` in `R2`):** `R2_EXHAUSTION_SNAPBACK` runs for `[DAY_TRADER, SCALPER]` above `R3S_TREND_CONTINUATION_M5`. When M5 (`MCD2`) was NOT overextended (`MCD2_DOWN_IN_CORRIDOR` or `MCD2_DOWN_UPPER_BREAKOUT`), `R2` fell through `primary_first` from `MCD2` to **`MCD1_SPIKE_DOWN` (`856` Scalper cycles!)**, forcing `SCALPER` `LONG` against BOTH M15 and M5 (`1,036` Scalper `LONG` cycles with M15 `DOWN`) and yielding **`0`** `R3S` `SHORT` signals whenever M15 was `DOWN_LOWER_BREAKDOWN`!
  2. **Bug B2 (`DAY_TRADER` `R2` fades `MCD1_DOWN_LOWER_BREAKDOWN` unconditionally for `1,059` cycles):** `R2`'s `MCD1_SPIKE_DOWN` matches `MCD1.regime_status == BREAKOUT_SAME_SLOPE` with **zero check on `MCD2` (`M5`)**, blocking `R3_TREND_CONTINUATION` (`TREND_DOWN`, even during `MCD2_DOWN_UPPER_BREAKOUT` = `DOWNTREND_RALLY_ABOVE_CORRIDOR`, which `R3` was built to short!).
- **Recommended `draft-2.yaml` fix (pure rules-table + ADR update, zero `MCD1` / `facts.py` change needed first):**
  1. **Scope `R2` by profile:** `SCALPER` `R2` checks **`MCD2` spikes only** (`MCD2_SPIKE_UP` / `MCD2_SPIKE_DOWN`), restoring Primary-first discipline (`ADR-029`, rule 3s).
  2. **Fix `DAY_TRADER` `R2` vs `R3`:**
     - Restrict `DAY_TRADER` `MCD1_SPIKE_DOWN` in `R2` so it only calls `"exhaustion / snapback LONG"` when **M5 confirms exhaustion or reversal** (e.g., `MCD2` is `MCD2_DOWN_LOWER_BREAKDOWN` double-stretch, or `MCD2.trend == UP`), **never** when M5 is calmly continuing down or rallying to M5 resistance (`MCD2_DOWN_IN_CORRIDOR` / `MCD2_DOWN_UPPER_BREAKOUT`); symmetric mirror for `MCD1_SPIKE_UP`.
     - Add a branch in `R3_TREND_CONTINUATION` (or right after `R2`) for **`MCD1 BREAKOUT_SAME_SLOPE` (`DOWN`) + `MCD2` aligned `DOWN` (`TREND_ALIGNED_CONTINUATION` or `DOWNTREND_RALLY_ABOVE_CORRIDOR`) -> `SHORT` (`Archetype A`, `WITH_TREND`)** (and mirror for `UP`), recognizing a sustained macro break confirmed by M5!
  - _(Simulate `draft-2.yaml` on the same `1,375` cycles first; only expose a numeric breach-duration fact from `MCD1` [`2.1.0`] if Davin wants even stronger separation between early 1-bar spikes and multi-day breaks during `MCD2_DOWN_LOWER_BREAKDOWN`.)_

---

## Pre-B4 and Pre-B5 Checklist Gates

- **Before `B4 --write` (`state_statistics`):**
  1. Shadow batch (`M5 -> most_recent`, `M15 = non_b`, `MCD0 1.1.0 A4`, `main.ts` log filter) running cleanly in production shadow; verify live `DISCONTINUITY` rate and 1-cycle drift on `most_recent` across real shadow days (plus decide if `MCD1` changes — if `MCD1` stays `2.0.1`, shadow collection does not wait on `draft-2.yaml`).
  2. Davin checks `InpExtendLinesToCurrent` + frozen-mode input on VPS Terminals A & B (`2026-10-03-1230-step3-part7.md` §7.2) and confirms updating `SERIES_NOTES` (`FORMING_BAR_FIT`) + its 5 pinned specs + `STACK-D-ARCHITECTURE.md`.
- **Before `B5` (`live`):**
  1. `draft-2.yaml` (Finding B fix + Davin's Finding A modifier choice) simulated on the `1,375` cycles, golden scenarios `--record` + Davin `--require-approved`, deployed with `check:sensor-kit` + replay `VERIFIED`.
  2. `B4 --write` completed + `checklists/MCD0..3.yaml` item 9 updated (`passed`) & synced.
  3. **Decision 1** (how `RETUNING` ends) settled + Watchdog D4 (`98543acd7af9`) / Terminal B ready.
