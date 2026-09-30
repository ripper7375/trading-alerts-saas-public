# ADR-003: Per-MCD windows and 1 day of OHLC instead of the 54-bar rule

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** Before the section series (source: Rev-3 review)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.3 rule 4, §5.5
- **Sources (archived):** the review = [`STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md`](../../davintrade-stack-d-and-e/archive/STACK-D-ARCHITECTURE-REVIEW-AND-RECOMMENDATIONS.md)

## Decision

The fixed 54-bar rule is dropped: each MCD reads its own window, and the model gets one day of M5 + M15 OHLC.

## Alternative not chosen

Keep one fixed 54-bar window for everything.

## Why

Each MCD has its own window (for example MCD1 N_micro = max(96, 5% of T_EDT)); the model gets one day of price context instead of 54 bars × 103 columns.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
