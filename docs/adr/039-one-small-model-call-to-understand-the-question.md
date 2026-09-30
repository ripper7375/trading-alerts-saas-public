# ADR-039: One small model call to understand the question

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 4 · Intake, routing & knowledge (deck decision 4.4: How to translate)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.2

## Decision

One small model call returning language, English text, intent, symbols, timeframes.

## Alternative not chosen

txtai translation models.

## Why

One structured call keeps language detection, translation, intent and scope detection to one round trip.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
