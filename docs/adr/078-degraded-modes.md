# ADR-078: Degraded modes

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.9: Degraded modes)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.6
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): each of the ten rows has a golden scenario that passes (rows 1 and 6 have two), and the scenario table is held word for word to the table of §7.6 by a test; rows 9 and 10 are decided inside Engine 4 and are held by its worked examples 08 and 09 as well; the decision below is unchanged

## Decision

The table as shown, each row tested.

## Alternative not chosen

Decide per incident.

## Why

Behaviour under failure was defined piecemeal and never tested.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
