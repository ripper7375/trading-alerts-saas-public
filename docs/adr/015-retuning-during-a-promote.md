# ADR-015: Retuning during a promote

- **Status:** Proposed (adopted provisionally, awaiting confirmation)
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.8: Promote / retune (new))
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.6

## Decision

Cycles RETUNING until the re-pushed window completes; sensors report CAUTIONARY.

## Alternative not chosen

Treat a promote like any other cycle.

## Why

A promote re-pushes about 6,000 rows over 5–6 minutes, oldest first, so the window mixes old and new tuning; readings in that period should say so. Proposed from the active-standby and frozen-baseline manifests.

## Note

The only proposed decision in the log. Confirm it, or record a replacement decision that supersedes it.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
