# ADR-050: Metering from actual cost

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.4: Metering)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.6
- **Sources (archived):** file D = [`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md)

## Decision

Units from actual cost; reserve the worst case; tiers set from measurement.

## Alternative not chosen

Tokens × multiplier.

## Why

File D's check only tested remaining > 0, so one message at 10× could cost about 180,000 units; token counts × multipliers ignored caching.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
