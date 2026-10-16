# ADR-047: One day of OHLC in compact form

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.1: OHLC delivery)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.5
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): read the last-price line of the §5.5 example as the close of the last closed M5 bar, labelled with the bar (D6): a forming price has no stored source; the format, the 288 + 96 closed bars and the caps are unchanged

## Decision

Full day, compact form, shared and cached; summary only when a cap forces it.

## Alternative not chosen

Summary by default.

## Why

Keeps decision 003 while cutting the size to about 7,700 tokens (about 16,900 as JSON with a timestamp per bar).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
