# ADR-012: Freshness thresholds

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.5: Freshness thresholds)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4

## Decision

Ready ≤ 2 min normal, ≤ 4 min with retries; STALE after 10 min.

## Alternative not chosen

Decide only after measuring.

## Why

Downstream sections need a definite status; 10 minutes matches the VPS stale-export guard of 600 s. Starting values, to confirm on the first real cycles.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
