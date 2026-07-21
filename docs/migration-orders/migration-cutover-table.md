# Migration Cutover Table — single source of truth for what runs where

**Maintained by the Executor** (updated in the same session as any status change).
One row per slice/route-group. Status flow:
`MONOLITH → BUILT → SHADOW-RUNNING → CUT-OVER → RETIRED` (rollback = back one state).

_(Scaffolded ahead of Session 4A-1 per the playbook, so references resolve from day one.
Rows are added when Phase 4 begins; the two conventions below are fixed now.)_

**Conventions:** flag names `MIGRATE_<SLICE>` env vars; timestamps UTC ISO-8601.

| Slice / route group                                                                                                     | Service       | Session | Flag / mechanism                                    | Shadow start | Diff clean? | Cut over | Rollback tested? | Status   | Notes                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------- | ------- | --------------------------------------------------- | ------------ | ----------- | -------- | ---------------- | -------- | ------------------------- |
| Slice 1: 8 cron jobs                                                                                                    | money-service | 4A-2/3  | Enable Nest scheduler; empty `crons` in vercel.json | —            | —           | —        | —                | MONOLITH | slice 1 of blueprint §5.5 |
| Slice 2: RiseWorks + dLocal webhooks                                                                                    | money-service | 4A-2/3  | Update endpoint URLs in provider dashboards         | —            | —           | —        | —                | MONOLITH | slice 2 of blueprint §5.5 |
| Slice 3: Read APIs (dashboards, reports, admin lists)                                                                   | money-service | 4A-4/5  | Frontend base-URL swap behind env flag              | —            | —           | —        | —                | MONOLITH | slice 3 of blueprint §5.5 |
| Slice 4: Write APIs (Stripe checkout + sub/cancel + invoices, dLocal create, code dist, batch execute) + Stripe webhook | money-service | 4A-6/7  | Same flag; Stripe webhook URL swap                  | —            | —           | —        | —                | MONOLITH | slice 4 of blueprint §5.5 |
| Slice 5: Tier-update event path (money → core)                                                                          | money-service | 4A-8    | Core stops reading Subscription directly            | —            | —           | —        | —                | MONOLITH | slice 5 of blueprint §5.5 |
