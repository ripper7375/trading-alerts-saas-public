# ADR-057: Follow-ups and chat history

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.11: Follow-ups)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.11
- **Sources (archived):** file D = [`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md)

## Decision

Cached cycle block; changes stated; 10 messages + summary.

## Alternative not chosen

Resend all; 20 messages.

## Why

Resending the full context every turn multiplied cost; file D said 20 messages in one place and 10 in another.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
