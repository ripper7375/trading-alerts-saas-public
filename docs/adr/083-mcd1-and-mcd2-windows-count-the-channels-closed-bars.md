# ADR-083: MCD1 and MCD2 windows count the channel's closed bars

- **Status:** Settled (approved by Davin, 2026-10-01; drafted in task P7; he confirmed the PATCH classification and approved the answers to Q1 to Q5 of the concept sections as built)
- **Date:** 2026-10-01
- **Section:** 2 · Sensors (MCDs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.5, §2.13; [MCD-DEVELOPMENT-STANDARD.md](../MCD-DEVELOPMENT-STANDARD.md) §14

## Decision

`T_EDT` counts the rows on which an EDT channel exists, and the last of those rows is the still-open bar, so on closed bars a channel holds `T_EDT − 1` rows. MCD2 reads `min(T_EDT − 1, 288)` closed M5 bars. MCD1 keeps `N_micro = max(96, 5% of T_EDT)` closed M15 bars and requires the channel to hold them. A channel shorter than the floor (48 closed M5 bars for MCD2, `N_micro` for MCD1) is not read: INVALID + `INSUFFICIENT_BARS`. The `1` is the parameter `t_edt_open_bar_rows`, the same name and value as MCD3. Both evaluators go from 2.0.0 to 2.0.1 (PATCH, standard §14).

## Alternative not chosen

Applying `min(T_EDT − 1, cap)` with no floor, so that the window shrinks to the channel's length. It would give a VALID MCD2 reading over 29 bars for a channel of 30, and a VALID MCD1 reading over 49 bars (about 12 hours of M15) where the spec says the micro window is never fewer than 96 bars.

## Why

In the replica workbooks the band columns (UOEDT, baseline, LOEDT) are populated on exactly `T_EDT` rows ending at the forming bar, on 7 of 7 real channels. The 2.0.0 windows (`max(48, min(T_EDT, 288))` and the floor of 96) therefore reached one bar before a short channel and ended INVALID + `DISCONTINUITY` for an M5 channel with `T_EDT` of 288 or less and an M15 channel with `T_EDT` of 96 or less. No fixture is affected (the smallest `T_EDT` is 314 on M5 and 500 on M15), no state, level or threshold changes, and the only stored change is the `evaluator_version` label. An MCD2 INVALID reached MCD3 as `UPSTREAM_UNAVAILABLE:MCD2`.

Whether the statistics' fit window also includes the open bar is a separate open question (`.claude/state/waiting-on.md`). If the MQL5 source shows that the channel has `T_EDT` closed rows, the parameter becomes 0, which is a MINOR change.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
