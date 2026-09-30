# ADR-082: MCD development standard

- **Status:** Proposed (awaiting Davin's approval)
- **Date:** 2026-09-30
- **Section:** 2 · Sensors (MCDs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.9, §2.13; [MCD-DEVELOPMENT-STANDARD.md](../MCD-DEVELOPMENT-STANDARD.md)

## Decision

Every MCD (MCD0–MCD15) is specified, built, tested and switched on according to
`docs/MCD-DEVELOPMENT-STANDARD.md`. The conventions it marks [new] become binding: the input bundle
(evaluators as pure functions), reason codes, the state-code format, the registry and parameter
files, semantic versioning, the shadow period and the size and time budgets. The architecture keeps
one registry row per MCD (§2.13); each MCD's content stays in its own spec.

## Alternative not chosen

Keep the MCD hand-off report's workflow as it is (Excel source, "latest" statistics row, the
pre-envelope output template, `UNIDENTIFIED` / `…_INVALID` outcomes) and settle conventions MCD by
MCD.

## Why

Up to fifteen sensors will be built at different times, in different sessions. Without one standard
each would re-decide naming, failure handling and versioning, and the hand-off report predates the
architecture's rules on closed bars, slots, the envelope and the status scale.

## Note

Once approved, add a banner to `engine-1-5-new/HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md` pointing to the
standard, as was done for the nine superseded documents.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update
STACK-D-ARCHITECTURE.md and the standard in the same change.
