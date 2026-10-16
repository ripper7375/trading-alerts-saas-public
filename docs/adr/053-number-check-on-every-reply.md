# ADR-053: Number check on every reply

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.7: Number check)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.8
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the one regeneration is shared by the schema retry and the number and wording checks (D11), and the exempt classes are identifiers, timeframes, small counts and ordinals not next to `$`, `%`, `:` or a decimal point, and the dates of the stamp (D13); the decision below is unchanged

## Decision

Match within $0.05; regenerate once, then flag.

## Alternative not chosen

Prompt instruction only.

## Why

Nothing checked that numbers in a reply came from the data the model was given.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
