# ADR-019: R-squared threshold per model

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.4: R² threshold)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.4
- **Sources (archived):** file C = [`STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md); file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

Per model, from file C: A ≥ 0.70, B ≥ 0.65.

## Alternative not chosen

0.65 for both.

## Why

File C is the only document that defines Models A and B; file A quotes a single 0.65 without naming a model.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
