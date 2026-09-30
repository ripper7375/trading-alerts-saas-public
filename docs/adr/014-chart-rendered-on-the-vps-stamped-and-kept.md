# ADR-014: Chart rendered on the VPS, stamped and kept

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 1 · Market data & chart (deck decision 1.7: Chart production)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.4

## Decision

Rendered on the VPS, stamped per slot, last good image kept.

## Alternative not chosen

Render on Railway from PostgreSQL.

## Why

The VPS already renders both variants; the stamp and the last good image fix "a chart from another moment" and "no fallback" without moving the renderer.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
