# ADR-059: Setup pinned to its cycle

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.2: Setup freshness)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.4

## Decision

Pinned to Report 1’s cycle; refused past invalidation; changed synthesis offers a refresh.

## Alternative not chosen

Recompute silently.

## Why

Minutes can pass between Report 1 and the modal; the setup must not change silently.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
