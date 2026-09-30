# ADR-028: Two trader-type readings per cycle

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.4: Trader types)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.2

## Decision

Two readings per cycle: Day Trader (M15 + M5) and Scalper (M5).

## Alternative not chosen

One reading for everyone.

## Why

Engine 4 gives Day Traders M15 structure with M5 timing and Scalpers M5 for both; one reading cannot serve both.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
