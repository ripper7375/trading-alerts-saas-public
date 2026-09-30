# ADR-043: Retrieval query built from context

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 4 · Intake, routing & knowledge (deck decision 4.8: Retrieval query)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.7

## Decision

Built from intent template + state codes + English question.

## Alternative not chosen

The raw message.

## Why

Chatty wording steers retrieval off course; the seed RAG design builds the query from context.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
