# ADR-004: Two-panel chart in private R2

- **Status:** Settled
- **Date:** 2026-09-11
- **Section:** Before the section series (source: 10–11 Sep chart manifests)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.2
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

Engine 3 is a 2-panel M5 / M15 PNG, in overlay and standard variants, stored in private R2.

## Alternative not chosen

A 3-panel chart (file A).

## Why

One image carries both timeframes; the variant (overlay or standard) follows the trader's tier and toggle. Recorded from the 10–11 Sep chart manifests.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
