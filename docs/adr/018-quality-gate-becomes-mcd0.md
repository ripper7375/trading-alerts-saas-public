# ADR-018: Quality gate becomes MCD0

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.3: The quality gate)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.4

## Decision

MCD0 per timeframe; channel MCDs inherit CAUTIONARY.

## Alternative not chosen

A tier 0 inside every MCD.

## Why

The 4-Quadrant gate had its own PASS / DEFECT scale; as a sensor, its defect reaches every channel MCD on that timeframe as CAUTIONARY.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
