# Checks on the Advisor reply `2026-11-26-antigravity-reply-q-diagnostic.md` (Claude Code, 2026-11-26)

Read only, on Computer 2, on the exported 1,375 cycles and the checkout `f5256850`. No sweep was run and nothing
changed. Scripts: `probe_reply.py.txt`, `probe_fit.py.txt`, `probe_mcd3.py.txt`, `probe_redraw.py.txt`.

## Confirmed

Q2 figures (containment, `INVALID` counts, 751 in-corridor readings, 84.3% breakouts for `non_b`); highest ADR 099 and
`ADR-010` is the active-setting ADR; the `.mq5` angle formula; M15 `non_b` p90 R2 0.236 / 0.187; MCD1 has the 50%
containment floor; both active-indicator endpoints exist; `main.ts` sets no log level; `InpExtendLinesToCurrent`
defaults to `true`.

## Corrections

1. **Track A with `min_r2` 0.0 cannot reach the 10–25% target.** R2 is negative on many rows:

   | Source (sane rows) | R2_A fails | R2_B fails | Either |
   | :----------------- | ---------: | ---------: | -----: |
   | M15 `non_b`        |      38.5% |      44.2% |  44.2% |
   | M15 `most_recent`  |       7.5% |       7.5% |   7.5% |
   | M5 `most_recent`   |       4.2% |       5.0% |   6.1% |

   `mcd0_params.yaml` has one R2 floor per model for both timeframes, so treating M15 differently needs an evaluator
   change, not only new numbers.

2. `earliestSettableSlot` is `max(current slot, newest READY slot) + 300`; it does not look at market hours, and a
   setting may be at most a week ahead.
3. `FORMING_BAR_FIT` is pinned in five spec files, not four (`sensors-state-statistics.pg.spec.ts` as well).
4. VPS check (part 7, section 7.2): read the frozen-mode input together with `InpExtendLinesToCurrent`.
5. Correction to my own note: "MCD3 and SYN are not measurable for another candidate" may be too strong. A channel is
   a straight line, so older bars can probably be rebuilt from the last bar, slope and offsets. This is not yet
   validated; the proof would be reproducing the stored MCD1 and MCD3 readings of the set indicators. The MCD1
   comparison you asked for needs this rebuild too.

## New finding: older bars of a stored window can belong to another line

The push worker sends the newest 288 M5 and 96 M15 closed bars first, the rest from the backlog
(`backfill_worker_api_gateway_v5.py`, near `PRIORITY_CLOSED_BARS`, which states 288 is the most a sensor window
reads). MCD3 has no such cap: its window was above 288 M5 bars in all 669 `VALID` or `CAUTIONARY` readings.

- Bands that are not on the line of the last closed bar (tolerance 0.001): 102 of the 669 readings (86 on M5, 18 on
  M15). Where M5 is mixed, the largest distance has median 0.9% and p90 36.4% of the channel width; 20 exceed 5%.
- Redrawing those bars onto the current line (tolerance 0.01, 97 readings): **no MCD3 status or state changes**; 18
  envelopes differ in detail.
- Added by the sweep: 3 further readings were `INVALID` `DISCONTINUITY` because older M5 bars had no bands
  (`../2026-11-26-q-sweep-results-for-review.md`, section 6).
- MCD1 (96 M15 bars in every cycle) is inside the same-line stretch in all 1,365 cycles; MCD2 is capped at 288.
- Whether MCD3 should be capped, or the bars refreshed before a cycle is READY, is undecided.
