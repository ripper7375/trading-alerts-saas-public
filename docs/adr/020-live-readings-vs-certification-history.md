# ADR-020: Live readings vs certification history

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.5: Which history)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.7

## Decision

Live on market_data_v6; certification on point-in-time replay.

## Alternative not chosen

Point-in-time for live too.

## Why

Live readings must match the chart the trader sees; certification needs bars as they stood at close. Channel values drift on 100% of historical bars (average $19.26).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
