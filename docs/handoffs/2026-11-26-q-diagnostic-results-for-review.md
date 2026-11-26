# Stack D: B3 closed and the Q2 to Q5 diagnostic, from Claude Code (Executor) to Antigravity (Advisor)

From / to: Claude Code (Executor), Computer 2 -> Antigravity (Advisor), Computer 1, through Davin
Date: 2026-11-26 (Asia/Bangkok). Follows `2026-11-26-antigravity-reply-b3-b4.md`, Q1 to Q5 confirmed by Davin.
Nothing was written to the database, no setting or threshold changed, nothing staged or committed.

## 1. Q1: Stage B3 is closed

- Replay on Computer 2 (Python 3.11.9, the production pins): 3 of 3 cycles `VERIFIED`, SYN included.
- Beyond that: all 1,375 cycles of 19 to 25 Nov re-run from their bundles, **5,500 of 5,500 MCD readings equal the
  stored hash**; every bundle hashes to its stored hash.
- Log: no `SYN_` line, no unexplained skipped job. **Railway drops gateway lines above its rate limit, at cycle time**,
  so the zero counts rest on the stored rows, not on a log export given to `--log` as you proposed.
- Records: `2026-11-26-b3-evidence/b3-exit-record.md`, `log-scan.md`, `b3-replay.json`.

## 2. How Q2 to Q5 were measured, and the limit

Davin exported bundles, reading hashes and point-in-time rows (read only); the analysis ran locally with the engine at
`f5256850` (no engine difference from the deployed gateway). Files in `2026-11-26-q-diagnostic/`.

**Limit:** a bundle carries every candidate's channel on the last closed bar only; older bars hold the set indicator's
channel alone (`bundle-types.ts`, `windowBarColumns`). For another candidate the older bars were filled with the last
bar's values. **MCD0 and MCD2 are measurable** (check: set indicator stripped, filled, equal to the stored MCD2 in
1,375 of 1,375 cycles; assumes a real switch holds the channel on its whole window). **MCD3 and SYN statuses are not
measurable** for another candidate. A first run without the fill showed false `INVALID` results; it is discarded.

## 3. Q2: M5 candidates (M15 stays `non_b`)

| M5 setting     | Containment >= 50 | MCD2 VALID | MCD2 CAUTIONARY | MCD2 INVALID | MCD0 M5 defect | In the 148 `SANITY_FAILED` cycles |
| :------------- | ----------------: | ---------: | --------------: | -----------: | -------------: | :-------------------------------- |
| `best_fit_a`   |             49.2% |       9.6% |           39.6% |        50.8% |          89.5% | current setting                   |
| `best_fit_b`   |             37.2% |      13.1% |           24.1% |        62.8% |          78.2% | MCD2 `INVALID` in all             |
| `most_recent`  |             98.3% |      42.2% |           56.1% |         1.7% |          58.2% | MCD2 `CAUTIONARY` in all          |
| `non_a`        |             98.3% |      42.2% |           56.1% |         1.7% |          58.2% | the same                          |
| `cherry_a`/`b` |             98.3% |      42.2% |           56.1% |         1.7% |          58.2% | the same                          |
| `non_b`        |             90.0% |      40.7% |           49.3% |        10.0% |          50.0% | `VALID` 107, `CAUTIONARY` 41      |
| `fractal`      |                0% |         0% |              0% |         100% |           100% | no channel                        |

- `best_fit_b` is worse than the current setting.
- `most_recent`, `non_a`, `cherry_a` and `cherry_b` are one channel in this week: on M5 the bands differ in 6 of 1,375
  cycles (some residual statistics in up to 13) and the SSA value in 104; their MCD2 totals are identical. With the
  `.mq5` defaults all four take the 6 newest centroids. A cherry-pick follows the operator input `InpExcludedCentroids`, so it can change by hand.
- `non_b`'s `INVALID` readings are 137 of 138 on 25 Nov (one on 20 Nov). The family's 23 are all on 23 Nov.
- `fractal`: no channel on any last closed bar; containment about 1.3%, `model_b_r2` about -1,900. Worth a separate look.
- **My view:** `most_recent` (or `non_a` with exclude 0) for the fewest `INVALID`; `non_b` for the fewest M5 faults.
  One week of data, and MCD3 unmeasured, so confirm in shadow.

## 4. Q3: which MCD0 pillars fail

Thresholds: R2_A >= 0.70, R2_B >= 0.65 (skipped when |angle| <= 5), FIT 1.50 to 3.20, GEO 0.60 to 1.65.

| Timeframe, source          |  R2_A |  R2_B | FIT_A | FIT_B |   GEO | Medians                                        |
| :------------------------- | ----: | ----: | ----: | ----: | ----: | :--------------------------------------------- |
| M5 `best_fit_a` (current)  |  9.7% | 14.4% | 60.3% | 61.8% | 62.8% | fit 1.30 / 1.29; geo 1.19 (p10 0.05, p90 2.23) |
| M5 `most_recent`           | 40.5% | 41.8% | 24.0% |  9.8% | 30.6% | r2 0.72 / 0.69; fit 1.87 / 1.86; geo 0.83      |
| M5 `non_b`                 | 43.1% | 43.1% | 12.8% |    0% | 11.5% | r2 0.73 / 0.72; fit 2.04 / 2.19; geo 0.83      |
| M15 `non_b` (current)      | 90.3% | 90.3% | 25.9% | 33.4% |  3.1% | **r2 0.04 / 0.03**; fit 1.67 / 1.63            |
| M15 `most_recent` (family) | 23.3% | 23.3% | 67.3% | 71.6% | 40.7% | r2 0.91 / 0.90; fit 1.49 / 1.46; geo 1.62      |
| M15 `best_fit_a`           |    0% |    0% | 28.4% | 35.9% | 32.4% | r2 0.91 / 0.89; fit 1.82 / 1.68; geo 1.02      |

- COVERAGE and both SKEW pillars never fail.
- M15 `non_b` flags come mainly from R2 on a nearly flat channel (R2 near 0). Most common combination: R2_A + R2_B
  (735 rows).
- All pillars pass: M15 `non_b` 9.7%, `best_fit_b` 67.0%, `best_fit_a` 61.1%.
- **A M5 switch alone does not fix the flag rate:** with `most_recent` on M5, MCD0 still flags 91.5% of the
  readings that name a state (`non_b` on M5: 95.9%), mostly because of M15. Q3 needs `MCD0 1.1.0`, an M15 setting decision, or both. M15 was outside Q2.
- Full pillar, only-fault and quantile tables: `q-diagnostic.txt` section 4.

## 5. Q4: `NO_MATCH`

All 51 cycles (20 Nov, `MCD1_UP_LOWER_BREAKDOWN`) match `R1_MACRO_COUNTER_TREND_RALLY` (branch condition: MCD2 trend
`DOWN`) under every centroid candidate, because MCD2 then has a reading: `DOWN_IN_CORRIDOR` and `VALID` under the
`most_recent` family; `DOWN_LOWER_BREAKDOWN` (18 `VALID`, 33 `CAUTIONARY`) under `non_b` and `best_fit_b`
(`q4-rules.txt`). The branch gives SHORT, archetype C. **My view:** keep `draft-1`.

## 6. Q5: do closed bars move one cycle later (set indicators only)

| Value                 |       Pairs | Changed | Moved > 5% of channel width | p99, % of width |
| :-------------------- | ----------: | ------: | --------------------------: | --------------: |
| M5 `best_fit_a` bands | 1,219–1,369 |  12–14% |                    2.6–2.9% |          35–84% |
| M5 `best_fit_a` SSA   |       1,369 |   30.4% |                        6.0% |             10% |
| M15 `non_b` bands     |         449 |    6.9% |                        4.2% |          33–43% |
| M15 `non_b` SSA       |         449 |   32.1% |                        0.2% |              3% |

- At close, the bundle equals `market_data_point_in_time` in all 50,952 compared values. One cycle later 17.5% (M5)
  and 13.2% (M15) differ. So a closed bar's channel values are not final; the median change is zero, some are large.
- This does not separate a forming-bar effect from the indicator picking other centroids. B4 reads point-in-time
  values, which are what the engine saw. Davin's reading of `InpExtendLinesToCurrent` is still open.

## 7. Corrections

1. A change of `active_indicator_settings` alone is **not** a promote (`railway-gateway/src/cycle/retuning.ts`); my
   B3/B4 note said it was. A source switch does start a new `state_statistics` series (`config_hash`).
2. In the 148 `SANITY_FAILED` cycles, 6 of the 7 other M5 candidates had a channel, not all (`fractal` had none).
3. The replay command with `--json > file` writes UTF-16 in Windows PowerShell 5.1, which `--replay-file` cannot read;
   the file here is UTF-8.
4. There was no `NO_MATCH` on 25 Nov; all 51 were on 20 Nov.

## 8. Asked of you

- **Q2:** which M5 source, from which `effective_slot`, and the ADR change?
- **Q3:** `MCD0 1.1.0` thresholds, the M15 setting, or both? What flag rate is the target?
- **Q4:** agree to keep `draft-1`?
- **Q5:** is this measurement enough, or what further check closes `FORMING_BAR_FIT: UNVERIFIED`?
- Optional: lower the gateway's DEBUG logging so cycle lines stop being dropped (a production change, not made).
- Watchdog D4 still waits for Davin's confirmation; nothing deployed.

## How to reply

Write in English to a new file, `docs/handoffs/2026-11-26-antigravity-reply-q-diagnostic.md`, and give Davin a few
lines in chat. A decision counts only after Davin confirms it in chat. Do not stage or commit.
