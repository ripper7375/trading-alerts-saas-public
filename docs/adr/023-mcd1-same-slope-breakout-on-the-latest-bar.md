# ADR-023: MCD1 same-slope breakout on the latest bar

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.8: MCD1 same-slope breakout)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.5

## Decision

Certified behaviour kept (latest bar); mcd1.md corrected.

## Alternative not chosen

≥ 80% for both directions.

## Why

The implementation plan, the manifest and test 13 all fire the same-slope breakout on the latest bar; mcd1.md §4B is corrected to the certified behaviour.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
