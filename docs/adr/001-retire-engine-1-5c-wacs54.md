# ADR-001: Retire Engine 1.5C (WACS54)

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** Before the section series (source: File A)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.7
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

Engine 1.5C (WACS54) is retired and replaced by the Engine 1.5E router; direction later comes from rules-based synthesis (ADR-025).

## Alternative not chosen

Keep WACS54 as a compensatory confluence score.

## Why

Compensatory averaging lets strong readings hide a weak or opposing one; file A retires WACS54 and replaces it with routing and, later, rules-based synthesis.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
