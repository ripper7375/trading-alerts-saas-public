# ADR-021: MCD3 reads MCD1 and MCD2 readings

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.6: MCD3’s trend inputs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.5

## Decision

Reads MCD1 / MCD2 readings from the same cycle.

## Alternative not chosen

Recompute independently.

## Why

Recomputing the trend lets MCD3 drift from MCD1 and MCD2, and synthesis would count the same evidence twice.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
