# ADR-055: Models at launch

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.9: Models at launch)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.10
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the registry holds six candidates and no model is `passed` until a LIVE evaluation run for the current fingerprint exists and `eval-gate.test.ts` is green; a stand-in run is never evidence; the launch pair is named after S1 and S2 (D1, D25); the fixed answer carries ids, statuses and state codes and no sensor sentence (D20); the decision below is unchanged

## Decision

One default + one fallback, both passing the suite.

## Alternative not chosen

All six at launch.

## Why

Six unevaluated models were too many variables at launch.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
