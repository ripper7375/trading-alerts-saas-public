# ADR-006: Charts rendered on a schedule

- **Status:** Settled
- **Date:** 2026-09-11
- **Section:** Before the section series (source: R2 manifest §8)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.2

## Decision

Charts are rendered on a schedule, never on demand.

## Alternative not chosen

Render a chart per request.

## Why

Rendering on demand cannot meet the retrieval budget of under 120 ms (R2 manifest §8).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
