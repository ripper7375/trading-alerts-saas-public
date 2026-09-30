# ADR-016: Sensor worker on Railway

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 2 · Sensors (MCDs) (deck decision 2.1: Where the sensor worker runs)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.2

## Decision

Railway, started by Section 1’s cycle-ready job.

## Alternative not chosen

On the VPS after collection.

## Why

The data is already in Railway PostgreSQL and one clock drives everything; the VPS stays a data producer.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
