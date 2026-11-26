# M5 switch to `most_recent`: result

**From:** Claude Code (Executor, Computer 2) · **Date:** 2026-11-26 · **Status:** switched, verified and accepted (2026-11-27)

## 1. Switch

M5 `most_recent` from slot **1795704000** (2026-11-26T14:40:00Z); M15 stays `non_b`. `ACTIVE_INDICATOR_FROM_GATEWAY` unset. Row written 14:30:59Z through the admin route.

## 2. Database check (read only, 15:43Z; [full output](./2026-11-26-m5-switch/verify-result-2026-11-26T1543Z.txt))

13 READY slots, 14:40Z to 15:40Z; 52 MCD rows, 26 SYN rows; every flag `shadow`. **12 of 12 checks pass**: no `NO_SETTING`, `NO_STATS_AT_SLOT`, `EVALUATOR_ERROR` or guard replacement.

| Sensor | Evaluator | `VALID` | `CAUTIONARY` | States                                            |
| ------ | --------- | ------- | ------------ | ------------------------------------------------- |
| MCD0   | 1.1.0     | 13      | 0            | `ALL_QUALIFIED` 6, `M5_DEFECT` 7                  |
| MCD1   | 2.0.1     | 13      | 0            | `DOWN_LOWER_BREAKDOWN` 13                         |
| MCD2   | 2.0.1     | 6       | 7            | `DOWN_IN_CORRIDOR` 13 (before: upper breakout)    |
| MCD3   | 2.0.0     | 6       | 7            | `NON_CONSOLIDATED_OVERFLOW` 13                    |
| SYN    | -         | 0       | 26           | LONG, `R2_EXHAUSTION_SNAPBACK`; zones 3 to 2 each |

**MCD0 flag rate:** M5 7 of 13 (54%), M15 0 of 13. All seven are `FIT_B`, in a row from 15:10Z; they make MCD2 and MCD3 `CAUTIONARY` (`MCD0_DEFECT_M5`).

| Slots (Z)      | M5 failed | `fit_a` | `geo`  |
| -------------- | --------- | ------- | ------ |
| 14:40, 14:45   | none      | 1.3527  | 1.021  |
| 14:50 to 15:05 | none      | 1.343   | 1.0008 |
| 15:10 to 15:40 | `FIT_B`   | 1.3366  | 0.9846 |

## 3. Gateway log (deployment `5352db9b`, since 14:40Z)

The 13 slots written; no `ERROR`, `DEBUG`, `Authorized caller` or error-level line.

## 4. Not shown by this

- 54% is above the 10 to 25% target but covers about one hour and one run of identical fits: not a rate to calibrate on. The `FIT_B` value was not printed.
- The web chart overlay (flag off: default `best_fit_a`) and the VPS renderer images were not checked.

## 5. Acceptance, records and open items

- **Accepted (Davin with the Advisor, 2026-11-27):** the switch to `most_recent` from slot 1795704000.
- **Done (Davin, 2026-11-27):** `MARKET_GATEWAY_API_KEY` is now type `Secret` in Vercel Production; the value is unchanged and `ACTIVE_INDICATOR_FROM_GATEWAY` stays unset.
- **MCD0:** the 1.1.0 thresholds are not adjusted on the first-hour run. `shadow` accumulates over several trading days; the next database check prints `fit_b` beside `fit_a` (the scripts here print `fit_a` only).
- **Records:** ADR-100 status, this report, the [decision note](./2026-11-26-m5-switch-with-flag-off.md), the switch scripts and the check output. The `.claude/state` files are updated locally only.
- **Open gates:** `SYN` and `MCD0` to `MCD3` stay `shadow` until `draft-2.yaml` and Stage B4; the web flag waits for the Step 2 §1.5 write-key decision and a §7 order; no `knowledge-service` build or deploy before `corpus/D2/mcd0.md` is updated and approved.
- **Also open:** Computer 1 to check its git against `origin/main`.
