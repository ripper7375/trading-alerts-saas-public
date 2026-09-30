# ADR-065: RRR definition

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 6 · Engine 4 & Report 2 (deck decision 6.8: RRR definition)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.7
- **Sources (archived):** file G = [`STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md`](../../davintrade-stack-d-and-e/archive/STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md)

## Decision

Net profit ÷ actual loss, after commission; declared and actual risk shown.

## Alternative not chosen

G’s effective RRR.

## Why

The ratio shown should be exact on real money; file G's example ignored commission and the effect of rounding the lot down.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
