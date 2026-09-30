# ADR-036: Routing v1 is a dispatch matrix

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 4 · Intake, routing & knowledge (deck decision 4.1: Routing v1)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §4.5
- **Sources (archived):** file A = [`STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`](../../davintrade-stack-d-and-e/archive/STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md)

## Decision

Dispatch matrix (intent × states) + labelled set; vector routing only if it wins.

## Alternative not chosen

Vector routing as in file A.

## Why

Measurable and explainable; vector routing on raw numeric commentary had thresholds with no basis.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
