# ADR-079: Golden scenarios

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.10: Golden scenarios)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.7
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the reply path's set is 34 scenarios in five families (about 24 is read as a floor), approved through `config/reply/golden/review.md` and `approval.json`, and a model joins only after a live run over them (D25); the decision below is unchanged

## Decision

About 24 cycles you approve; every change replayed.

## Alternative not chosen

A random sample.

## Why

Only an end-to-end replay catches a regression caused by a change in sensors, rules, prompts or models.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
