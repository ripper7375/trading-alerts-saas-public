# ADR-022: Minimum sample before quoting a number

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.7: Minimum sample to quote a number)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.8

## Decision

n ≥ 30 per state and horizon, always shown with n.

## Alternative not chosen

Set after the first replay.

## Why

A number without its sample size misleads; 30 per state and horizon is the minimum before a number is quoted.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
