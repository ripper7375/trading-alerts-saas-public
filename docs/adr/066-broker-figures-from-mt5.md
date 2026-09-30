# ADR-066: Broker figures from MT5

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.9: Broker figures)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.9

## Decision

symbol_specs from MT5; spread where it triggers; swap for Day Traders.

## Alternative not chosen

Constants.

## Why

Contract size, lot step, spread and swap differ by broker; MT5 exposes them. Commission is not a symbol property, so it stays the trader's input.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
