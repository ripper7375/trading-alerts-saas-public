# ADR-072: Free tier

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.3: Free tier)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.3
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the Free tier's recorded example is a golden scenario in 19 locales, shown only when its files are approved and come from a live run (D19); the decision below is unchanged

## Decision

No AI chat; a recorded demo conversation.

## Alternative not chosen

A small Free allowance.

## Why

A full-context answer costs about 18,000 tokens, so a small Free allowance would buy about two answers a month; file A and the deployed UI already restrict AI chat to Pro.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
