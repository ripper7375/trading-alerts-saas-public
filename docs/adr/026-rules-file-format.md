# ADR-026: Rules file format

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.2: Rules format)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.3, §3.4

## Decision

Ordered, versioned file; first match wins; no match = NEUTRAL, logged; draft as a start.

## Alternative not chosen

Weighted scoring.

## Why

An ordered, versioned file is readable, testable and traceable to one row; weighted scores hide why a result came out.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
