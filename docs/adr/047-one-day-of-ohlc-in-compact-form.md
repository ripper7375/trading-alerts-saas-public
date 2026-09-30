# ADR-047: One day of OHLC in compact form

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.1: OHLC delivery)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.5

## Decision

Full day, compact form, shared and cached; summary only when a cap forces it.

## Alternative not chosen

Summary by default.

## Why

Keeps decision 003 while cutting the size to about 7,700 tokens (about 16,900 as JSON with a timestamp per bar).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
