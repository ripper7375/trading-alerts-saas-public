# ADR-052: Report 1 as structured JSON

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.6: Report 1 form)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.7
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): "Report 1 JSON or a short answer" is two contracts, `report1.v1` (five keys) and `answer.v1` (four), with the server composing the six sections and copying the direction from the synthesis reading (D9, D10); the decision below is unchanged

## Decision

report1.v1 JSON; direction from synthesis; values by id.

## Alternative not chosen

Free text.

## Why

The model never retypes a price, and direction cannot drift from synthesis.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
