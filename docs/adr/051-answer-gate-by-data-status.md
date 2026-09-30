# ADR-051: Answer gate by data status

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.5: Answer gate)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.3
- **Sources (archived):** the review = [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md)

## Decision

The status table as shown; mismatched chart dropped; every reply stamped.

## Alternative not chosen

Answer anyway, add a banner.

## Why

Stale data, or a chart from another moment, must not reach an answer as if it were current (review D1).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
