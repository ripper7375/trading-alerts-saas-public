# ADR-008: Cycle key is the 5-minute slot time

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.1: Stack D cycle key)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.3

## Decision

Slot time of the M5 collection (UTC); collection cycle ids kept as provenance.

## Alternative not chosen

Reuse collection cycle_id (per timeframe and attempt).

## Why

A collection cycle_id exists per timeframe and per attempt, so it cannot say which M5 rows, M15 rows, statistics and chart belong together. The slot time can.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
