# ADR-048: Context caps and cut order

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.2: Context caps)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.4
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the budget is `min(19,600, floor(model budget / (1 + margin)))` and the cut order is the order in which components shrink when the assembled prompt exceeds it (D7): the ten caps already sum to 19,600, so read as "over its total" the order could never fire; the caps and the order are unchanged

## Decision

Caps as shown; cut history → knowledge → OHLC → details.

## Alternative not chosen

No caps.

## Why

Without caps, cost per message is unbounded and a warning could be squeezed out of the prompt.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
