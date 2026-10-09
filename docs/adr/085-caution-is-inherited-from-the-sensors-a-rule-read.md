# ADR-085: Caution is inherited from the sensors a rule read

- **Status:** Settled (approved by Davin, 2026-10-04, decision D3 of the build step 4 plan, and his ruling of the same day on MCD3's echoes; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.3 (mechanic 4), §3.5

## Decision

A SYN reading is CAUTIONARY when any sensor the matched branch read is CAUTIONARY, or when MCD3 modified the result and is CAUTIONARY, or when MCD3's modifier made it so. It then carries those sensors' reason codes (an MCD0 defect, RETUNING, ...), sensor by sensor, plus `MODIFIER_CAUTION:<MCD3 state>` when the modifier caused it. A branch "reads" the sensors its conditions name. A cycle with no match counts every available sensor as read.

MCD3's `UPSTREAM_CAUTIONARY:MCD1` and `:MCD2` codes repeat what the upstream sensors already say, so they are not carried. The one exception: a CAUTIONARY reading must say why, so when nothing else explains the caution they stay.

## Alternative not chosen

Mechanic 4 read literally: any CAUTIONARY sensor in the cycle makes every reading CAUTIONARY.

## Why

A Scalper's rule 3s reads MCD2 only, so a CAUTIONARY MCD1 should not mark it; the reading says which sensor made it cautious. Consequence, found in the plan (F1): on every real cycle MCD0 flags both timeframes, so every channel sensor is CAUTIONARY and so are all six readings of the three stored cycles. The example of §3.5 showed VALID; it now shows the real CAUTIONARY reading. How often MCD0 flags is the flag-rate question of build step 3, B3, not a defect of synthesis.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; the rule is code (`engine.py`) and a rules-version question; update STACK-D-ARCHITECTURE.md in the same change.
