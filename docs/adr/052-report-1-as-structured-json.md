# ADR-052: Report 1 as structured JSON

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.6: Report 1 form)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.7

## Decision

report1.v1 JSON; direction from synthesis; values by id.

## Alternative not chosen

Free text.

## Why

The model never retypes a price, and direction cannot drift from synthesis.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
