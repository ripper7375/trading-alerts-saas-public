# ADR-049: Prompt order for caching

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.3: Prompt order)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.4

## Decision

Static rules → shared cycle block → user part, cached where supported.

## Alternative not chosen

One prompt per request.

## Why

The cycle block is identical for everyone of a trader type in a cycle, so providers that cache can serve it cheaply.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
