# ADR-025: Rules decide direction

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 3 · Synthesis & entry zones (deck decision 3.1: Who decides direction)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.2

## Decision

The rules table; the LLM explains and can’t override stand-aside.

## Alternative not chosen

The LLM, guided by playbooks.

## Why

Rules give the same answer for the same data; a model can change direction when an answer is regenerated.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
