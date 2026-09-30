# ADR-029: Precedence ladder

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.5: Precedence)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.3
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

File A’s ladder; derived sensors modify, don’t vote.

## Alternative not chosen

All sensors vote equally.

## Why

File A's ladder: a lower rung, such as an oscillator, must never reverse a higher one, such as primary-timeframe structure.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
