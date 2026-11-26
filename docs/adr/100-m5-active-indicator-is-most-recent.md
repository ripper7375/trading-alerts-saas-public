# ADR-100: The M5 active indicator is most_recent

- **Status:** Settled (Davin, 2026-11-26). The production setting was **switched on 2026-11-26**: M5 `most_recent` from slot 1795704000 (14:40Z), with the web flag left off (see "The switch").
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
2. Read `ACTIVE_INDICATOR_FROM_GATEWAY` on the web app. When it is `true`, the switch also changes the channel the user's chart shows. Davin read its production value on 2026-11-26: not `true`.
3. The switch is a production write through the admin route, effective from a future slot. It starts new MCD2 and MCD3 statistics series, whose configuration includes M5.

## The switch (2026-11-26)

- Davin ordered the switch with `ACTIVE_INDICATOR_FROM_GATEWAY` left unset and wrote it through the admin route: M5 `most_recent`, effective slot 1795704000 (14:40:00Z). M15 stays `non_b`.
- A read-only database check at 15:43Z over the 13 READY slots from 14:40Z to 15:40Z passed 12 of 12 checks: MCD0 evaluator `1.1.0`; the readings name M5 `most_recent` and M15 `non_b`; no `NO_SETTING`, `NO_STATS_AT_SLOT`, `EVALUATOR_ERROR` or guard replacement; every flag `shadow`; 4 MCD and 2 SYN readings per cycle. Output: [verify-result](../handoffs/2026-11-26-m5-switch/verify-result-2026-11-26T1543Z.txt).
- While the flag is off the web chart overlay does not follow the setting (it takes the request's variant, default `best_fit_a`), so the web chart and the sensors can name different M5 indicators until the [Step 2 cutover](../runbooks/deploy-stack-d-step2.md) §7, which waits for the write-key decision of §1.5. The images of the VPS renderer were not checked.

## Known limits

- The measurement is one week of a market that fell. On M15 `non_b` MCD1 read a lower breakdown on 1,059 of the 1,375 cycles, and the draft rules (`draft-1`, row `R2_EXHAUSTION_SNAPBACK`) answered many of them with a LONG snapback. That is a rule question, open, to be settled in a new rules version before any `live` flag.
- `most_recent` does not remove the `DISCONTINUITY` risk of MCD3: its window start moved earlier on 6 cycles of the week (`best_fit_a`: 4).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
