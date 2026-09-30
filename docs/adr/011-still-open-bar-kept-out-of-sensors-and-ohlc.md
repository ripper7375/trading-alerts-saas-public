# ADR-011: Still-open bar kept out of sensors and OHLC

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.4: The still-open bar)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.3

## Decision

Kept out of sensors and OHLC; exposed once as a labelled last price.

## Alternative not chosen

Drop it entirely.

## Why

Collected about 5 seconds after the boundary, the newest row is a stub; a sensor must not fire on a candle that will change before it closes.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
