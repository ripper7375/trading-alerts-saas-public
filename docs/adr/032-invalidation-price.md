# ADR-032: Invalidation price

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.8: Invalidation)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.6
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

$0.50 beyond the next structural level, never under $13.

## Alternative not chosen

Fixed dollar stops.

## Why

File A domain 4 places stops $0.50 behind structure; Engine 4's minimum stop distance is $13.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
