# ADR-048: Context caps and cut order

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.2: Context caps)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.4

## Decision

Caps as shown; cut history → knowledge → OHLC → details.

## Alternative not chosen

No caps.

## Why

Without caps, cost per message is unbounded and a warning could be squeezed out of the prompt.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
