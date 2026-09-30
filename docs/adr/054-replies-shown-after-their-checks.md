# ADR-054: Replies shown after their checks

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.8: Show after checks)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.11

## Decision

Checked reply shown whole, with progress stages; ≤ 15 s p90.

## Alternative not chosen

Stream, then retract.

## Why

Showing a wrong number and then retracting it is worse for a trader than a few seconds' wait.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
