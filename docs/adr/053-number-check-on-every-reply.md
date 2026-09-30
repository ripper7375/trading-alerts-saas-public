# ADR-053: Number check on every reply

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.7: Number check)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.8

## Decision

Match within $0.05; regenerate once, then flag.

## Alternative not chosen

Prompt instruction only.

## Why

Nothing checked that numbers in a reply came from the data the model was given.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
