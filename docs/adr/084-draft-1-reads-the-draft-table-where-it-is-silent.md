# ADR-084: Rules version draft-1 reads the draft table where it is silent

- **Status:** Settled (approved by Davin, 2026-10-04, decision D1 of the build step 4 plan; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.3, §3.4; `engine-1-5-new/mcd_worker/synthesis/synthesis.md` §3

## Decision

`draft-1` is the table of §3.4 as it stands, plus five readings of the places where §3.4 says nothing. They are written into `rules/draft-1.yaml`, which is never edited once approved (a change is a new file, ADR-026).

- **(a) Rule 0.** The trader type's primary sensor (MCD1 for the Day Trader, MCD2 for the Scalper) must be VALID or CAUTIONARY, else STAND_ASIDE with a data reason.
- **(b) An unavailable sensor cannot match.** A branch that names an INVALID, STALE or absent sensor does not hold; the next branch or row is tried. A no-match record lists the sensors that were unavailable.
- **(c) Directions.** Rule 1's breach direction is MCD1's side of the corridor, and "MCD2 trending in that direction" means MCD2's channel trend, at any position in the corridor. Rule 2's "against the spike" is the opposite of the breach. When MCD1 and MCD2 both match rule 2 with different biases, the primary sensor decides. Rows that say Both and name MCD1 apply to the Scalper as written.
- **(d) Rule 4.** Only `MCD2_SIDEWAYS_UPPER_BREAKOUT` (SHORT) and `MCD2_SIDEWAYS_LOWER_BREAKDOWN` (LONG) are edges, with trend relation COUNTER_TREND. Every other range state is STAND_ASIDE.
- **(e) MCD3 modifies, it never votes.** Consolidated in the direction of the result confirms; a `NON_CONSOLIDATED_*` state makes the result CAUTIONARY, except a trend conflict under rule 1, which is a note; consolidated against the result is a note.

## Alternative not chosen

None was put forward for (a) to (e): each is a reading of a silence in §3.4, approved as written. Davin's other option was to edit any item, and every edit is a new rules version and a decision-log entry.

## Why

ADR-025 says rules decide direction, so a case the table does not cover cannot be left to the code's author or to the model. Writing the readings into the rules file makes them reviewable and replayable.

Known consequence, shown by golden scenario 11: a range edge is COUNTER_TREND by (d) even when the edge trade agrees with MCD1's trend, and §6 uses the relation for the style notice and the 2.50 times cap.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; write the change as a new rules version (`draft-2.yaml`); update STACK-D-ARCHITECTURE.md in the same change.
