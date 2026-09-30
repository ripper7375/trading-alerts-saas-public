# ADR-002: Remove JSONB54 and FREQ54

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** Before the section series (source: Rev-3 review)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.7
- **Sources (archived):** the review = [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md)

## Decision

JSONB54 (storyline) and FREQ54 (MCD frequency counts) are removed; each MCD's own reading carries the state.

## Alternative not chosen

Keep the 54-bar storyline and frequency columns.

## Why

Each MCD now reports its own state in its envelope, so a 54-bar storyline and frequency counts add tokens and a fixed window no MCD uses.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
