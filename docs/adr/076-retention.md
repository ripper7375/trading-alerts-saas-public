# ADR-076: Retention

- **Status:** Settled
- **Date:** 2026-09-30
- **Section:** 7 · Platform & governance (deck decision 7.7: Retention)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §7.5
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): a database trigger refuses to delete a trace that has not been archived and no archive exists yet (D17); a message lives 12 months from its own time and a trader's delete removes the thread at once, naming what survives (D18); the decision below is unchanged

## Decision

7 years for audit rows; transcripts 12 months, deletable.

## Alternative not chosen

7-year transcripts.

## Why

One figure for everything that shows what a trader was told and chose; full transcripts are not needed for that, because the trace keeps both reports.

## Note

Needs review by counsel in each target market before launch.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
