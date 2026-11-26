# ADR-101: MCD0 1.1.0, new fit and geo bounds, and R-squared on M5 only

- **Status:** Settled (Davin, 2026-11-26: the values of variant A4, and the keying of the R-squared rule to the timeframe, accepted as built). Built on 2026-11-26; **not deployed** when this was written.
- **Date:** 2026-11-26
- **Section:** 2 · Sensors (MCDs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.4
- **Supersedes:** [ADR-019](019-r-squared-threshold-per-model.md). **Amends** the thresholds MCD0 applies under [ADR-018](018-quality-gate-becomes-mcd0.md), whose decision (a gate MCD; channel MCDs inherit CAUTIONARY) does not change.
- **Evidence:** `docs/handoffs/2026-11-26-q-diagnostic/` (`sweep.txt`, `simulation.txt`): 1,375 shadow cycles of 19 to 25 November 2026

## Decision

MCD0 evaluator **1.1.0** (a MINOR version, development standard §14):

| Parameter                             | 1.0.0              | 1.1.0                |
| ------------------------------------- | ------------------ | -------------------- |
| R-squared floor, Model A / Model B    | 0.70 / 0.65        | 0.00 / 0.00          |
| Timeframes on which R-squared applies | M5 and M15         | M5 (`r2_timeframes`) |
| Fit ratio                             | 1.50 to 3.20       | 1.25 to 3.20         |
| Geo ratio                             | 0.60 to 1.65       | 0.50 to 2.00         |
| Coverage, absolute skew, flat band    | ≥ 60, ≤ 1.50, ≤ 5° | unchanged            |

On M15, `R2_A` and `R2_B` are not applied and are listed in `details.M15.skipped`; the R-squared values are still reported. States, pillar ids, reason codes and commentary templates do not change. The flag stays `shadow`.

**The rule follows the timeframe, not the indicator** (accepted by Davin, 2026-11-26). The reason given for skipping R-squared concerns the M15 `non_b` channel (a straight line through older centroids, judged on fit, symmetry, coverage and skew). The build keys it to the timeframe, because no rule may assume a particular indicator (Section 1, rule 6). If M15 is set to another candidate, R-squared stays skipped there: revisit this decision only if M15 leaves `non_b`.

## Alternative not chosen

| Variant                                                       | M5 flagged | M15 flagged | Either    | Why not                                                                |
| ------------------------------------------------------------- | ---------- | ----------- | --------- | ---------------------------------------------------------------------- |
| 1.0.0 as deployed, M5 `best_fit_a`                            | 89.5%      | 89.2%       | 97.0%     | Almost every channel reading CAUTIONARY                                |
| 1.0.0 with M5 `most_recent`                                   | 58.2%      | 90.3%       | 91.5%     | The same                                                               |
| New bounds, R-squared floor 0.00 on both timeframes           | 20.8%      | 44.2%       | 53.2%     | M15 `non_b` has a negative R-squared on 44.2% of readings              |
| New bounds, 0.70 / 0.65 kept, flat band widened to 30°        | 24.5%      | 3.1%        | 27.5%     | A 30° "flat" channel contradicts the 5° sideways band of MCD1 and MCD2 |
| **Chosen:** new bounds, floor 0.00 on M5, no R-squared on M15 | **20.8%**  | **3.1%**    | **23.9%** |                                                                        |

Rates are shares of the 1,365 cycles in which both rows could be read.

## Why

The target Davin set was 10% to 25% flagged per timeframe, 15% to 35% on either. The chosen variant meets it on M5 and on "either"; M15 at 3.1% is below it and was accepted, because raising it needed bounds placed inside a narrow cliff of the week's values. Per day, the "either" rate ran from 0.0% to 50.2%, so one week is thin evidence.

## Consequences

- A new MCD0 statistics series starts (arch §2.8). The checklists' item 9 stays `pending`.
- Fewer `MCD0_DEFECT` marks: more channel readings are VALID, and fewer SYN readings pre-set half risk through the gate ([ADR-061](061-defect-flag-halves-the-pre-set-risk.md)). The draft rules are unchanged, so a reading the rules get wrong now carries full pre-set risk more often. This must be settled (a new rules version) before any `live` flag.
- On M15 a channel that explains no variance is caught only by coverage, fit ratio, geo ratio or skew.
- Golden scenarios 01 to 03 of the engine changed; Davin approved them again on 2026-11-26. The web app's sensor-board test and its recorded stand-in evaluation run read those scenarios and ship in the same commit as this version.
- The 600-token size test (T12) passed on Computer 1 with 548 tokens (reported by Davin, 2026-11-26); the build machine has no `tiktoken`.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
