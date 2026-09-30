# ADR-013: Newest bars pushed first

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.6: Push ordering)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4

## Decision

Newest-first lane built now; throughput measured alongside.

## Alternative not chosen

Measure first, change later.

## Why

Oldest-first pushing delays the newest bars most when there is a backlog (demand about 800 rows a minute against a likely 375–600 capacity; the open issue gives 375–750; unmeasured).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
