# ADR-073: Pro quota method

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.4: Pro quota)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.3
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): `PRO_MONTHLY_UNITS` stays unset (the ledger refuses everything) until a measured allowance is set, and a unit is one micro-dollar (D2, D4); the decision below is unchanged

## Decision

Units from your model-spend share and measured cost.

## Alternative not chosen

A fixed token number.

## Why

Ties the quota to margin rather than to a token number that changes with context size and models.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
