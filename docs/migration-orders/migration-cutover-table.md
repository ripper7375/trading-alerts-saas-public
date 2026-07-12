# Migration Cutover Table — single source of truth for what runs where

**Maintained by the Executor** (updated in the same session as any status change).
One row per slice/route-group. Status flow:
`MONOLITH → BUILT → SHADOW-RUNNING → CUT-OVER → RETIRED` (rollback = back one state).

_(Scaffolded ahead of Session 4A-1 per the playbook, so references resolve from day one.
Rows are added when Phase 4 begins; the two conventions below are fixed now.)_

**Conventions:** flag names `MIGRATE_<SLICE>` env vars; timestamps UTC ISO-8601.

| Slice / route group                                               | Service       | Session | Flag / mechanism                             | Shadow start | Diff clean? | Cut over | Rollback tested? | Status   | Notes                     |
| ----------------------------------------------------------------- | ------------- | ------- | -------------------------------------------- | ------------ | ----------- | -------- | ---------------- | -------- | ------------------------- |
| _(example row — delete when first real row lands)_ money crons ×8 | money-service | 4A-2/3  | Nest scheduler on; vercel.json crons emptied | —            | —           | —        | —                | MONOLITH | slice 1 of blueprint §5.5 |
