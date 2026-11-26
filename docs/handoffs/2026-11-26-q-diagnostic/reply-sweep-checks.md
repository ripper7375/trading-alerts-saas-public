# Checks on the Advisor reply `2026-11-26-antigravity-reply-q-sweep.md` (Claude Code, 2026-11-26)

Read only, on Computer 2, on the exported 1,375 cycles. No simulation of `most_recent` MCD3 or SYN was run and
nothing changed. Script: `probe_window.py.txt`.

## Confirmed

Track B figures (MCD1 trend differs 22.4%, regime 70.1%); the M15 `non_b` figures and the two cliffs; A4 and A7 rates
and definitions; MCD1 and MCD2 use a 5 degree sideways band (MCD3 has no angle parameter); ADR-100 and ADR-101 are
free numbers.

## To correct

1. **Switching M5 to `most_recent` does not remove the `DISCONTINUITY` risk.** The case is a window that starts
   further back than one cycle earlier, onto bars that have no bands yet:

   | M5 source     | Window start moved earlier (19 to 25 Nov) | Moved back (time / 5 min) |
   | :------------ | ----------------------------------------: | :------------------------ |
   | `best_fit_a`  |                                  4 cycles | 61 to 938                 |
   | `most_recent` |                                  6 cycles | 82 to 456                 |

   Three of the four `best_fit_a` cases are exactly the three `DISCONTINUITY` readings. The 10.8% null rate quoted in
   the reply is a different thing (statistics offsets in the `SANITY_FAILED` cycles). How many of the six would turn
   `INVALID` cannot be read from the stored bundles. The distances are clock time, market breaks included.

2. **The requested simulation cannot show `DISCONTINUITY` or `INSUFFICIENT_BARS`:** rebuilding fills every older bar
   by construction. It can show MCD3 states and the SYN results on complete data.
3. To simulate, bars older than the bundle are needed: the `most_recent` channel is longer than the stored M5 bars in
   1,045 of 1,375 cycles. Their times can be derived from the stored M15 bars (in a sample of 55 cycles no extra
   times; the only ones not derived are the newest, inside the unfinished M15 bar, which the bundle holds). MCD3 reads
   only time, UOEDT and LOEDT on older M5 bars. The method must first reproduce the stored MCD3 readings from a
   bundle cut short.

## Not addressed in the reply

- MCD1 under the current M15 setting read `LOWER_BREAKDOWN` in all 1,365 cycles. "Healthy channel" rests on MCD0's
  own measures (fit window containment, fit, symmetry); price was outside the channel all week.

## Trade-off to see before choosing A4

R2 floors of 0.0 on M5 let the M5 R2 pillars fail 4.1% and 4.9% of cycles, against 40.7% and 42.0% today.
