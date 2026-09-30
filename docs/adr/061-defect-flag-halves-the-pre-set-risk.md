# ADR-061: Defect flag halves the pre-set risk

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.4: Defect flag)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.6
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

CAUTIONARY pre-sets half the risk with the reason; override allowed and logged.

## Alternative not chosen

No change / hard cap.

## Why

File A halves position size on a Cautionary Defect Flag, but Engine 4 never received the flag. The trader keeps the final say, and the record shows it.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
