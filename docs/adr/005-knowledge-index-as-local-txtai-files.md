# ADR-005: Knowledge index as local txtai files

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** Before the section series (source: Rev-3 review)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.6
- **Sources (archived):** the review = [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md); file D = [`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md)

## Decision

The Engine 2 index is local txtai files, rebuilt on every deploy.

## Alternative not chosen

pgvector in PostgreSQL (file D).

## Why

The index is versioned with the corpus and rebuilt with each deploy, so a corpus change needs no database migration.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
