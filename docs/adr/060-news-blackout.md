# ADR-060: News blackout

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.3: News blackout)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.6
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

±15 min around file A’s Tier-1 list (±60 if approximate); other releases warn.

## Alternative not chosen

Warning only.

## Why

File A bans new orders 15 minutes either side of Tier-1 releases, but nothing enforced it; the economic_events lane has been live since 11 Sep.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
