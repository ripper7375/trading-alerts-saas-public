# ADR-075: One trace per answer

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.6: Trace)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.4
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the trace is seven strict groups written once at the end, holds no question text and never the user id (D16); the decision below is unchanged

## Decision

One row per answer; 90 days live, then archived.

## Alternative not chosen

Logs only.

## Why

Answers "why did it say that?" for support and audits.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
