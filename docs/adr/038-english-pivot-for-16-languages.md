# ADR-038: English pivot for 16 languages

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 4 · Intake, routing & knowledge (deck decision 4.3: Language handling)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.3

## Decision

English pivot with a trading glossary; answer in the user’s language.

## Alternative not chosen

Multilingual embeddings.

## Why

One corpus and one index serve all 16 languages, and the English embedding model works on the pivot text; the glossary keeps trading terms stable.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
