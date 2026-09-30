# ADR-067: Chat-typed setups pre-fill the modal

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.10: Chat-typed setups)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.10

## Decision

Extracted values pre-fill the modal; one validator.

## Alternative not chosen

Compute from chat.

## Why

One validator serves both paths, and nothing is computed from free text without the trader confirming each value.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
