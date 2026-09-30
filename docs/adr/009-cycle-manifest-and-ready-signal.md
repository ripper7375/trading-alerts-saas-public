# ADR-009: Cycle manifest and ready signal

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.2: Who declares “cycle ready”)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4

## Decision

Push worker sends a manifest; gateway checks it, writes market_cycles, queues the job.

## Alternative not chosen

Gateway infers completeness from arriving rows.

## Why

Only the sender knows what a complete cycle is; the gateway checks the manifest instead of guessing completeness from arriving rows.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
