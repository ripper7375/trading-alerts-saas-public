# ADR-100: The M5 active indicator is most_recent

- **Status:** Settled (Davin, 2026-11-26). The production setting is **not switched yet**: the switch is a separate step that Davin orders.
- **Date:** 2026-11-26
- **Section:** 1 · Market data & chart
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4
- **Supersedes:** [ADR-010](010-active-indicator-setting-per-timeframe.md). Its mechanism is restated below and does not change.
- **Evidence:** read-only diagnostic and sweep over the 1,375 shadow cycles of 19 to 25 November 2026, in `docs/handoffs/2026-11-26-q-diagnostic/`

## Decision

One admin setting per timeframe, effective from a slot and logged. MCDs, renderer and UI read it; detection from data stays only as a cross-check. The values are **M15 `non_b`** (unchanged) and **M5 `most_recent`** (was `best_fit_a`).

## Alternative not chosen

Stay on `best_fit_a` on M5, or take `best_fit_b`; or take `most_recent` on both timeframes.

## Why

| M5 setting    | MCD2 readings that were INVALID |
| ------------- | ------------------------------- |
| `best_fit_a`  | 50.8%                           |
| `best_fit_b`  | 62.8%                           |
| `most_recent` | 1.7%                            |

The commonest reason on `best_fit_a` was containment below the 50% floor. The floor stays.

On M15, `most_recent` read every cycle of the week as a downtrend (median angle −53°), gave MCD1 another regime than `non_b` in 70.1% of the cycles and another trend in 22.4%, and left MCD0 outside its flag-rate target on every set of bounds tried (30.1% to 45.9% of M15 readings flagged). So M15 stays `non_b`.

## Before the setting is switched

1. MCD0 1.1.0 ([ADR-101](101-mcd0-1-1-0-thresholds-and-r2-per-timeframe.md)) is deployed first. Under 1.0.0, M5 `most_recent` was flagged on 58.2% of readings.
2. Read `ACTIVE_INDICATOR_FROM_GATEWAY` on the web app. When it is `true`, the switch also changes the channel the user's chart shows. Its production value has not been read.
3. The switch is a production write through the admin route, effective from a future slot. It starts new MCD2 and MCD3 statistics series, whose configuration includes M5.

## Known limits

- The measurement is one week of a market that fell. On M15 `non_b` MCD1 read a lower breakdown on 1,059 of the 1,375 cycles, and the draft rules (`draft-1`, row `R2_EXHAUSTION_SNAPBACK`) answered many of them with a LONG snapback. That is a rule question, open, to be settled in a new rules version before any `live` flag.
- `most_recent` does not remove the `DISCONTINUITY` risk of MCD3: its window start moved earlier on 6 cycles of the week (`best_fit_a`: 4).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
