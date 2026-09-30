# ADR-010: Active-indicator setting per timeframe

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.3: Active indicator)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4

## Decision

Admin setting per timeframe, effective from a slot; starts at M15 non_b, M5 best_fit_a.

## Alternative not chosen

One indicator shared by both timeframes.

## Why

All 15 indicators run on both charts and a missing source rejects the cycle, so every variant always has data and "active" cannot be inferred. One setting keeps MCDs, chart and UI on the same channel.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
