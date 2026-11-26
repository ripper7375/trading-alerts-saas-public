# Antigravity Reply: Q2–Q5 Diagnostic Review & Calibration Plan

**Date:** 2026-11-26 13:55 +07:00 (`2026-11-26T06:55:00Z`)
**Author:** Antigravity (Computer 1, Advisor)
**In reply to:** [`docs/handoffs/2026-11-26-q-diagnostic-results-for-review.md`](2026-11-26-q-diagnostic-results-for-review.md) (`SHA-256` prefix `1d8d1f84a555`)
**Evidence read:** `2026-11-26-b3-evidence/{b3-exit-record,log-scan}.md`, `2026-11-26-q-diagnostic/{q-diagnostic,q4-rules}.txt`, `q_analyze.py.txt`
**Authority rule:** Recommendations only. Nothing here takes effect until **Davin confirms it in chat** to Claude Code (Computer 2). No existing files modified; nothing staged or committed.

---

## 1. Acknowledgment: Stage B3 Closed & Corrections Accepted

- **Q1 (Stage B3 closed):** Accepted. `b3-exit-record.md` (`3 of 3` diverse real cycles `VERIFIED` incl. SYN; `1,375 / 1,375` cycles and `5,500 / 5,500` MCD envelopes matching stored SHA-256) plus `log-scan.md` (`1,375 / 1,375` stored READY cycles having all `4` MCD rows, `2,750 / 2,750` SYN rows, and `0` `guard_problems`) cleanly closes Stage B3 shadow verification despite Railway's burst log rate-limiting. Flags stay `shadow` until Q2–Q5 complete.
- **Section 7 corrections (1–4):** All four accepted (`active_indicator_settings` alone is not a gateway `PROMOTE`; `6` of `7` other M5 candidates had a channel while `fractal` had `0`; Windows PowerShell 5.1 `>` writes UTF-16LE; all `51` `NO_MATCH` were on `20 Nov`).
- **Flagged side finding (no action now):** M5 `fractal` (`2EDTFractalBestFitv5_v2_29.mq5`) had `0.0%` channels on the last closed bar (`1.29%` containment, `model_b_r2` median `-1943.6`). Keep tracked in Stack C backlog so nobody activates `fractal` without inspecting it.

---

## 2. Decisions & Recommendations (Q2 to Q5)

### Q2 — M5 source, `effective_slot`, and ADR change

- **Recommended M5 source:** Switch **M5** from `best_fit_a` to **`most_recent`**.
  - `q-diagnostic.txt` shows `most_recent` beats `non_b` on stability (`98.3%` containment `>= 50%` vs `90.0%`; `p10 = 73.16%` vs `49.98%`; only `1.7%` / `23` `MCD2 INVALID` all on `23 Nov` vs `10.0%` / `138` mostly on `25 Nov`; `0.0%` null offsets) and keeps balanced state diversity (`751` `IN_CORRIDOR` vs `601` breakouts, whereas `non_b` on M5 is `84.3%` breakouts/breakdowns).
  - Prefer **`most_recent`** over `cherry_a` / `cherry_b` (both read manual `InpExcludedCentroids`) and over `non_a` (`non_a` matches `most_recent` only while `InpExcludeRecentCentroids` happens to default to `0`).
- **Which `effective_slot`:** Apply via `POST /api/admin/active-indicator` (or gateway `POST /api/v1/active-indicator`) at **`earliestSettableSlot`** (the next open-market 5-minute UTC boundary `> max(current_slot, newest_ready_slot)` after Davin confirms in chat — wait to push Q2 + Q3's M15 choice, if any, in the same switch window so `MCD3` and `SYN` immediately begin collecting real un-filled window history without double `config_hash` churn).
  - Note: Remember `active_indicator_settings` changes **do not** emit a `PROMOTE` (`retuning.ts`), **do** change `config_hash` (starting a clean `state_statistics` series), and cannot back-date (`effective_slot >= earliestSettableSlot`).
- **ADR & docs update:** Create **`ADR-100`** (`099` is the highest existing ADR) superseding **`ADR-010`** (`Status: Superseded by ADR-100`), and update `docs/STACK-D-ARCHITECTURE.md` §1.4 (`Starting values / active setting: ...`) in the calibration commit once both M5 and M15 settings are settled below.

---

### Q3 — `MCD0 1.1.0` thresholds vs M15 setting, and target flag rate

- **Target flag rate:** **`10%–25%` defect rate per timeframe (`~15%–35%` any-defect across cycles, leaving `~65%–85%` `MCD0_ALL_QUALIFIED`)** so `ADR-061`'s `CAUTIONARY` half-risk flag actually guards weak fits rather than firing continuously.
- **Why Q3 needs one quick (`0`-DB) local threshold sweep before locking numbers:**
  Look closely at the exact mathematical trap exposed in `q-diagnostic.txt` §4 (`lines 97–266`):
  1. Switching M5 to `most_recent` cuts M5 `MCD2 INVALID` from `50.8%` to `1.7%`, yet `MCD0 1.0.0` still flags `M5 most_recent` at `58.2%` (`R2_A 40.5%`, `R2_B 41.8%`, `GEO 30.6%` [`p10=0.535`], `FIT_A 24.0%` [`p10=1.421`], `FIT_B 9.8%`).
  2. **Crucially, `M15 non_b` fails `MCD0 1.0.0` on `90.3%` of cycles (`R2_A 90.3%`, `R2_B 90.3%`, `FIT_A 25.9%`, `FIT_B 33.4%`)**, and its **90th percentile** `R²` is only **`0.236` (`R2_A`) / `0.187` (`R2_B`)** (`p50 = 0.035 / 0.026`), while `FIT_A/B` sit right on the `1.50` cliff (`p25 = 1.497 / 1.482`) despite `100.0%` containment (`p50 = 69.95%`).
     - Why `R² ≈ 0.035` wasn't skipped by `flat_angle_deg = 5.0°`: `2EDTCentroidRegression*.mq5` computes `current_angle = MathArctan((slope / mean_close) * 100 * 100) * 180 / pi`, so gentle OLS-over-6-centroids slopes across ~1,600 M15 bars easily exceed `5°` even when linear trend explains `< 5%` of price variance (`R² ≈ 0`).
     - **Implication:** With `M15 non_b`, any `min_r2 >= 0.25` **still fails `90%` of M15 rows**. Either (Track A) `M15` stays `non_b` and `MCD0 1.1.0` sets `R²` to non-negative / informational for centroid-OLS (`min_r2_a/b = 0.0` or skip), **or** (Track B) M15 switches to `most_recent` (`p25 R² = 0.904 / 0.893`, `100%` containment, `0%` null offsets — while checking `MCD1` states first!). (Note: `M15 best_fit_a/b` only have `78.9%`/`67.0%` containment >= 50, which would create `21%–33%` `MCD1 INVALID`, worse than `non_b`/`most_recent`.)
- **Action before editing `mcd0_params.yaml` (zero DB access needed — runs in seconds on Computer 2's already-exported bundles):**
  Ask Claude Code to extend `q_analyze.py` locally and report two things for Davin's final pick between **Track A** and **Track B**:
  1. **`MCD1` (`M15`) re-run + `regression_angle` quantiles** comparing `M15 non_b` vs `M15 most_recent` (remember `non_b` excludes 3 recent centroids -> longer ~1,591-bar macro horizon vs `most_recent` ~1,037-bar horizon; confirm `MCD1` does not distort macro regimes before considering changing M15!).
  2. **Joint `MCD0` flag-rate matrix (`M5%`, `M15%`, `any%` defect)** on the `1,375` cycles under concrete `MCD0 1.1.0` candidate bounds:
     - **Track A (`M5 = most_recent`, keep `M15 = non_b`):** `min_fit_ratio = 1.25` (clears the `1.48–1.50` cliff on both TFs; keep `max_fit_ratio = 3.20`), `min_geo_ratio = 0.50`, `max_geo_ratio = 2.00`, and test `(min_r2_a, min_r2_b)` at `(0.0, 0.0)` vs `R²` non-blocking / higher `flat_angle_deg`.
     - **Track B (`M5 = most_recent`, `M15 = most_recent`):** `min_fit_ratio = 1.20` (clears M15 `most_recent` `p25=1.41/1.38`), `max_fit_ratio = 3.20`, `min_geo_ratio = 0.50`, `max_geo_ratio = 2.15` (clears M15 `most_recent` `p75=2.095`), and test `(min_r2_a, min_r2_b)` at `(0.40, 0.35)` and `(0.50, 0.45)`.
  - Once those numbers hit the **`10%–25%` per-TF / `~15%–35%` combined** target, Davin approves **one** track -> ship **`MCD0 1.1.0`** (`mcd0_params.yaml`, `mcd0_evaluator.py`, new ADR amending `ADR-018`/`ADR-019`) bundled with the active-indicator switch(es).

---

### Q4 — Keep `draft-1`?

- **YES — keep `draft-1.yaml` unchanged.** `q4-rules.txt` confirms `51 / 51` `20 Nov` `NO_MATCH` cycles (`MCD1_UP_LOWER_BREAKDOWN`) resolve to **`R1_MACRO_COUNTER_TREND_RALLY`** (`SHORT`, `archetype C`) under every centroid candidate once `MCD2` is not `INVALID`. Re-evaluate whether `draft-2.yaml` needs a fallback rule only if residual `NO_MATCH` cycles appear in live shadow after Q2 + Q3.

---

### Q5 — Forming-bar verification & closing `FORMING_BAR_FIT: UNVERIFIED`

- **Assessment:** **Yes — Section 6's consecutive-cycle check is sufficient as the drift measurement**, with clear closure steps:
  - It proved point-in-time capture is exact (`50,952 / 50,952` matches between live bundles at close and `market_data_point_in_time` `snapshot_age_bars = 1` — zero capture leak into B4).
  - It measured honest real-world 1-cycle drift on closed bars under `MODE_DYNAMIC_AUTOFIT` (`17.5%` M5 / `13.2%` M15 differ overall 1 cycle later; `12–14%` M5 / `6.9%` M15 bands change; median `0.0000`, `2.6%–4.2%` move `> 5%` channel width, `p99` `35–84%` M5 / `33–43%` M15).
- **What still needs to happen before changing `SERIES_NOTES = 'FORMING_BAR_FIT: UNVERIFIED'` (`state-statistics.series.ts`):**
  1. **Davin confirms `InpExtendLinesToCurrent = true`** on Terminal A & B on the VPS (`2026-10-03-1230-step3-part7.md` §7.2).
  2. **(Low-cost check after Q2/Q3 switch):** Spot-check the 1-cycle closed-bar drift once on the new M5 `most_recent` shadow cycles (just to confirm OLS over 6 newest centroids does not drift worse than combinatorial `best_fit_a`).
  3. **Record & update in one commit (Part 7 §7.1 resolution):** Document in `STACK-D-ARCHITECTURE.md` §2.8 / Appendix D and `waiting-on.md` that the indicator fit includes `rates_total - 1` (forming bar) while point-in-time capture freezes bar-close values faithfully (`50,952 / 50,952`, median 1-cycle drift `0`, dynamic refit tail measured), keep `t_edt_open_bar_rows = 1`, and update `SERIES_NOTES` in `railway-gateway/src/sensors/state-statistics.series.ts` (plus its 4 pinned specs: `sensors-state-statistics-series.spec.ts`, `sensors-state-statistics-reader.spec.ts`, `sensors-state-statistics-writer.spec.ts`, `sensor-tables.pg.spec.ts`) from `'FORMING_BAR_FIT: UNVERIFIED'` to `'FORMING_BAR_FIT: INCLUDED_MEASURED'` (or Davin's preferred wording) **with Davin's explicit sign-off**, ahead of clean B4 `--write`.

---

## 3. Optional Logging & Watchdog D4 Reminder

1. **Optional `railway-gateway` DEBUG log reduction:** Confirmed in `railway-gateway/src/main.ts` (`NestFactory.create(AppModule)` passes no log-level filter, so `api-key.guard.ts:85` and `market-data.processor.ts:135,140` emit `logger.debug(...)` during ingestion bursts and trigger Railway rate-limit drops). Filtering production logs to `['log', 'warn', 'error']` (with opt-in `LOG_LEVEL=debug`) is a safe cleanup; **bundle it into the single `MCD0 1.1.0` deploy** so Railway does not run an extra rebuild.
2. **Watchdog D4 (`centroid_watchdog.py`, hash `98543acd7af9`):** Independent of Q2–Q5 and ready to deploy on the VPS as soon as Davin confirms it to Computer 2 (webhook stays empty).

---

## 4. Next Action Sequence

1. **Right now (zero DB / zero deploy):** If Davin agrees, authorize Computer 2 to run the **`< 5s` local sweep** on the exported `2026-11-26-q-diagnostic` bundles (comparing `MCD1` on `M15 non_b` vs `M15 most_recent`, plus **Track A** vs **Track B** `MCD0 1.1.0` parameter grid targeting `10%–25%` per-TF defects), while Davin checks `InpExtendLinesToCurrent` on the VPS (and optionally deploys Watchdog D4 `98543acd7af9`).
2. **After Davin picks Track A or Track B:** Ship **`MCD0 1.1.0`** (+ optional `main.ts` log-level filter + `ADR-100` + `sync:sensor-kit`), switch `active_indicator_settings` cleanly (`M5 -> most_recent`, plus `M15` only if Track B), and collect a clean shadow run (`~5` trading days if fresh B4 certification requires full post-calibration history, verifying `MCD3`, `SYN`, `MCD0` flag rate, and 1-cycle drift on `most_recent`).
3. **Then:** Close B4 (`--write`) + update `checklists/MCD0..3.yaml` item 9 -> settle **Decision 1** (`RETUNING`) -> execute **Stage B5** (`SENSOR_RETUNING_ENFORCED`, `live`).
