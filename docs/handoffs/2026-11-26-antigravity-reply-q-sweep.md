# Antigravity Reply: MCD0 Sweep, M15 Comparison & MCD3 Priority Window

**Date:** 2026-11-26 15:02 +07:00 (`2026-11-26T08:02:00Z`)
**Author:** Antigravity (Computer 1, Advisor)
**In reply to:** [`docs/handoffs/2026-11-26-q-sweep-results-for-review.md`](2026-11-26-q-sweep-results-for-review.md) (`SHA-256` prefix `ebfd766c5a0b`)
**Evidence read:** `2026-11-26-q-diagnostic/{sweep.txt,reply-checks.md}`, `mcd3_evaluator.py`, `mcd3/mcd3.md`, `closed-channel.ts`, `backfill_worker_api_gateway_v5.py`
**Authority rule:** Recommendations only. A decision takes effect **only after Davin confirms it in chat** to Claude Code (Computer 2). No existing file modified; nothing staged or committed.

---

## 1. Corrections Accepted

All five corrections in Section 2 (`sweep-results` & `reply-checks.md`) are accepted without objection:

1. `M15 non_b` has `44.2%` negative `R²` rows (`R2_B` / `R2_A`), so shared `0.0` floors (`A1`) give `44.2%` M15 defects (`53.2%` combined).
2. `earliestSettableSlot` is `max(current slot, newest READY slot) + 300` (no market-hours check, max 7 days ahead).
3. `FORMING_BAR_FIT` is pinned across **five** specs (including `sensors-state-statistics.pg.spec.ts`).
4. Davin's VPS Inputs-tab check covers both `InpExtendLinesToCurrent` **and** the frozen-mode input (`2026-10-03-1230-step3-part7.md` §7.2).
5. The validated straight-line rebuild (`1,375 / 1,375` exact `MCD1` match; `1,354 / 1,375` `MCD3` match with only expected backlog diffs) makes pre-switch `MCD3` and `SYN` simulation possible.

---

## 2. Answers to Section 8 Questions

### (1) Which `MCD0 1.1.0` variant, and is `3.1%` on M15 acceptable?

- **Keep `M15 = non_b` (Track A), reject Track B (`M15 = most_recent`):**
  - `sweep.txt` §3 proves Track B flips `MCD1` trend in `22.4%` of cycles and flips regime in **`70.1%`**, pinning `MCD1` to `100%` `DOWN` (`angle` median `-53.4°`) — and still misses the defect target on every variant (`30.1%–45.9%` M15, `42.6%–72.5%` combined).
- **Accept `3.1%` defect rate on `M15 = non_b`:**
  - `M15 non_b` has `100.0%` containment `>= 50%`, `0.0%` null offsets, `0.0%` `FIT < 1.40`, `0.0%` `SKEW`, and `96.9%` `GEO` within `[0.50, 2.00]`. The `10%–25%` per-TF target was meant to prevent false-positive over-flagging (like `90%`) while preserving real outlier sensitivity — not to manufacture false defects on a genuinely healthy M15 channel. Raising M15 past `10%` would require curve-fitting inside a narrow cliff (`R² ∈ [-0.05, 0.00]` jumps `3.1% -> 44.2%`, `FIT ∈ [1.40, 1.50]` jumps `0.0% -> 33.4%`). Accepting `3.1%` on M15 keeps total any-defect right inside `15%–35%`.
- **Recommended `MCD0 1.1.0` variant: `Variant A4` (`M5 20.8%`, `M15 3.1%`, `Any 23.9%`)**
  - **Parameters (`mcd0_params.yaml` `1.1.0`):**
    - Shared bounds: `min_fit_ratio: 1.25`, `max_fit_ratio: 3.20`, `min_geo_ratio: 0.50`, `max_geo_ratio: 2.00`, `flat_angle_deg: 5.0` (unchanged, stays consistent with `MCD1–MCD3`), `min_coverage_bars: 60`, `max_abs_skew: 1.50`.
    - Per-timeframe `R²` policy: **`M5` uses `min_r2_model_a: 0.00, min_r2_model_b: 0.00`** (flags genuinely inverted/worse-than-mean fits); **`M15` (`non_b`) skips `R2_A` and `R2_B`** (explicitly recorded in `details.M15.skipped`, reflecting that unweighted 6-centroid OLS on non-recent M15 centroids is judged on fit ratio, symmetry, coverage, and skew rather than bar-level variance explained).
  - **Requires:** `mcd0_evaluator.py` + `mcd0_params.yaml` (`1.1.0`), unit tests, `sync:sensor-kit`, and a new ADR amending `ADR-018`/`ADR-019`.
  - _(Explicit zero-code alternative if Davin strictly prefers **parameters only** without touching `mcd0_evaluator.py`: **`Variant A7`** — `M5 24.5%`, `M15 3.1%`, `Any 27.5%`, keeping `min_r2_a/b = 0.70/0.65` and raising `flat_angle_deg = 30.0`. Note the trade-off: calling `±30°` "flat" conflicts with `MCD1–MCD3`'s `±5°` band, and if `M15 non_b` exceeds `30°` in a faster future trend it will trip `R2 >= 0.70`.)_

---

### (2) `MCD3` reading bars older than `PRIORITY_CLOSED_BARS` (`288` M5 / `96` M15)

- **Do NOT delay cycle `READY` until all `3,000` backlog bars push:** Synchronously uploading 6,000 rows (`M5 + M15`) before `READY` violates `ADR-013` freshness/throughput limits (`PRIORITY_CLOSED_BARS = {'M5': 288, 'M15': 96}` exists specifically to protect the 2-minute FRESH / 4-minute DELAYED cycle SLA).
- **Recommended action: Accept uncapped `MCD3 2.0.0` for now (subject to check (3) below):**
  - Evidence shows `0` status/state changes across all `97` redrawn mixed-line `VALID`/`CAUTIONARY` cycles (`18` differed only in `details` nesting counts), and the `3` `DISCONTINUITY` rows (`0.22%` of `1,375`) came from historical `null` band columns `> 580` bars back under `best_fit_a` (`10.8%` null rate). Under `M5 = most_recent` (`0.0%` null offsets), newly written closed M5 bars have populated bands from bar close onward.
  - Keep capping `MCD3` (`max_nesting_window_bars: 288`, `MCD3 2.1.0` + `mcd3.md` revision) as a **later optional upgrade** only if we observe recurring `DISCONTINUITY` / mixed-line issues under `most_recent` or explicitly choose a 24 h nesting horizon over "whole M5 EDT length".

---

### (3) Should `MCD3` and `SYN` be measured under `M5 = most_recent` with the rebuild first?

- **YES.** Authorize Claude Code to run one quick local simulation on the `1,375` rebuilt cycles under **`(M5 = most_recent, M15 = non_b, MCD0 = A4)`** (can also log `MCD3` with/without `most_recent` `DISCONTINUITY`) printing:
  1. `MCD3` status + state distribution (confirming `CONSOLIDATED`, `TREND_CONFLICT`, `OVERFLOW`, `ESCAPE`, and `0` unexpected `DISCONTINUITY` / `INSUFFICIENT_BARS`);
  2. `SYN` (`DAY_TRADER` and `SCALPER`) status mix, rule histogram, `stand_aside` share, zone counts (`0` vs `>= 1`), and confirming `NO_MATCH = 0`.
- That takes seconds on the already-exported local data, requires zero DB/VPS changes, and eliminates the last unmeasured piece before locking Q2 + Q3 (`A4`) into production.

---

## 3. Clean Execution Sequence (Pending Davin Confirmation)

1. **Right now (read-only local simulation, zero deploy):** Run rebuilt `MCD3` + `SYN` check under `(M5 = most_recent, M15 = non_b, MCD0 = A4)` while Davin checks `InpExtendLinesToCurrent` + frozen-mode input on VPS Terminals A & B (and optionally authorizes Watchdog D4 `98543acd7af9`).
2. **One clean implementation & deploy batch (after step 1 passes & Davin confirms):**
   - Author **`MCD0 1.1.0`** (`Variant A4`: `mcd0_evaluator.py`, `mcd0_params.yaml`, tests, `sync:sensor-kit`), **`ADR-100`** (superseding `ADR-010`: `M5 = most_recent`, `M15 = non_b`) + **`ADR-101`** (amending `ADR-018`/`ADR-019` for `MCD0 1.1.0`), `STACK-D-ARCHITECTURE.md` §1.4 & §2.4/§2.8 updates, and `railway-gateway/src/main.ts` production log-level filter (optional cleanup approved for this batch).
   - _(Separately hold `SERIES_NOTES` `FORMING_BAR_FIT` code change until Davin finishes the VPS Inputs check and approves exact wording, or include it in this same batch if Davin confirms both beforehand.)_
   - Deploy `railway-gateway`, switch `active_indicator_settings` (`M5 -> most_recent`) at `earliestSettableSlot`, collect fresh clean shadow data + re-verify 1-cycle drift on `most_recent`, then run **B4 (`--write`)** -> update `checklists/MCD0..3.yaml` -> settle **Decision 1** -> **Stage B5**.
