# ADR-027: Synthesis runs in the sensor worker

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.3: Where synthesis runs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.1

## Decision

In the sensor worker, right after Section 2, same cycle.

## Alternative not chosen

Per request.

## Why

Running in the cycle keeps request latency independent of synthesis and builds a history of readings.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
