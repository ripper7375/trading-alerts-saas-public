# Checks on the Advisor reply `2026-11-26-antigravity-reply-q-simulation.md` (Claude Code, 2026-11-26)

Read only, on Computer 2, on the checkout `f5256850` and the saved simulation files. Nothing changed.

## Confirmed

Section 1 figures; Finding A counts (763 of 1,062; 996 of 1,299; 501 and 495 sole reasons); `R1` already takes the
MCD3 trend conflict as a note; `non_b` MCD1 states carry bias `SHORT`; `most_recent` M15 would still read
`DOWN_LOWER_BREAKDOWN` in 408 cycles; `R2` `MCD1_SPIKE_DOWN` has no MCD2 condition; no `SHORT` from `R3S` while M15
was `DOWN_LOWER_BREAKDOWN`.

## To correct

1. **"`R2` blocks `R3_TREND_CONTINUATION`" is not so.** `R3` `TREND_DOWN` requires MCD1 regime
   `TREND_ALIGNED_CONTINUATION`; a lower breakdown is `BREAKOUT_SAME_SLOPE`. Without `R2` it would still not fire.
   The new branch the reply proposes is needed for a `SHORT`.
2. **"Scalper `LONG` against both M15 and M5" holds for 573 of the 856 cycles.** M5 (`most_recent`) in those cycles:
   `DOWN_IN_CORRIDOR` 354, `DOWN_UPPER_BREAKOUT` 219, `UP_IN_CORRIDOR` 172, `UP_LOWER_BREAKDOWN` 111 (M5 trend
   `UP` in 283).
3. **`state_statistics` covers MCD0 as well as MCD1 to MCD3** (see `b4-dryrun.txt`). `MCD0 1.1.0` starts a new MCD0
   series, and the M5 switch new MCD2 and MCD3 series (their configuration includes M5).

## What the proposed DAY_TRADER rule would do with the 1,059 `R2` cycles (counted, not simulated)

M5 below its corridor in a downtrend 180, or M5 uptrend 283: `LONG` (463). M5 downtrend inside or above the corridor
573: `SHORT`. MCD2 `INVALID` 23: data check. The same split would apply to the Scalper only for its own branches.

## Before the implementation batch

- **Check the chart flag first.** The M5 setting also drives the user chart overlay when
  `ACTIVE_INDICATOR_FROM_GATEWAY=true` on the web app (`lib/active-indicator/flags.ts`). It is off by default; the
  production value was not read. If it is on, the switch is visible to users, not shadow only.
- The batch edits files outside the Executor's current writable folders (engine, `railway-gateway`, `docs/adr`,
  architecture document), so it needs Davin's explicit go. A merge to `main` deploys the gateway; the setting switch
  is a separate production write that Davin runs.
