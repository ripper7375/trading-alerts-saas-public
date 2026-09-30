# ADR-017: MCD output envelope v1

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.2: Envelope v1)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.3

## Decision

As proposed; bias = LONG · SHORT · NEUTRAL · STAND_ASIDE.

## Alternative not chosen

Each MCD keeps its own shape.

## Why

Three output shapes forced a parser per MCD in every consumer; one envelope serves Sections 3, 4, 5 and 7.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
