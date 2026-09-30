# ADR-040: Sensor board on every request

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 4 · Intake, routing & knowledge (deck decision 4.5: Sensor board)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.4

## Decision

Synthesis line + every sensor, unavailable ones listed.

## Alternative not chosen

Only routed sensors.

## Why

A warning from a sensor outside the routed set must never disappear; every sensor costs about 30–50 tokens as one line.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
