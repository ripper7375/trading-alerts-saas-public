# Batch 8 — Admin: Core (Users, Fraud, System, Login, Settings, API, Errors)

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.
> This is one of three Admin sub-batches (6, 7, 8) — they partition `/admin/*` between them
> with no overlap; you only need this one's rows.

## Scope

15 pages: the admin executive dashboard, user management, fraud monitoring, system health
monitors, admin login/settings, API usage, error logs, the broadcast-notification page (no
Codebase-1 counterpart), and the admin-sidebar status nav card.

## Rows

| No. | Page Name                                     | Route                            | Codebase 1 file                                                                                               | Codebase 2 file                                                                                                  |
| --- | --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 12  | Admin API Usage & Rate Limits                 | `/admin/api-usage`               | `app/(dashboard)/admin/api-usage/page.tsx`                                                                    | `app/admin/api-usage/page.tsx`                                                                                   |
| 23  | Admin System Error Logs                       | `/admin/errors`                  | `app/(dashboard)/admin/errors/page.tsx`                                                                       | `app/admin/errors/page.tsx`                                                                                      |
| 24  | Admin Fraud Alert Detail                      | `/admin/fraud-alerts/[id]`       | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`                                                            | `app/admin/fraud-alerts/[id]/page.tsx`                                                                           |
| 25  | Admin Fraud Alerts                            | `/admin/fraud-alerts`            | `app/(dashboard)/admin/fraud-alerts/page.tsx`                                                                 | `app/admin/fraud-alerts/page.tsx`                                                                                |
| 26  | Admin Login Portal                            | `/admin/login`                   | `app/admin/login/page.tsx`                                                                                    | `app/admin/login/page.tsx`                                                                                       |
| 27  | Admin Settings - Affiliate Program            | `/admin/settings/affiliate`      | `app/(dashboard)/admin/settings/affiliate/page.tsx`                                                           | `app/admin/settings/affiliate/page.tsx`                                                                          |
| 28  | Admin - System Config History                 | `/admin/system/config-history`   | `app/(dashboard)/admin/system/config-history/page.tsx`                                                        | `app/admin/system/config-history/page.tsx`                                                                       |
| 29  | Admin - Cron / Job Monitor                    | `/admin/system/jobs`             | `app/(dashboard)/admin/system/jobs/page.tsx`                                                                  | `app/admin/system/jobs/page.tsx`                                                                                 |
| 30  | Admin - Outbox Event Monitor                  | `/admin/system/outbox`           | `app/(dashboard)/admin/system/outbox/page.tsx`                                                                | `app/admin/system/outbox/page.tsx`                                                                               |
| 31  | Admin - MT5 Terminal Health                   | `/admin/system/terminals`        | `app/(dashboard)/admin/system/terminals/page.tsx`                                                             | `app/admin/system/terminals/page.tsx`                                                                            |
| 32  | Admin User Detail                             | `/admin/users/[id]`              | evidence → `prisma/non-market-data/schema.prisma`; locate page at `app/(dashboard)/admin/users/[id]/page.tsx` | `app/admin/users/[id]/page.tsx`                                                                                  |
| 33  | Admin User Management                         | `/admin/users`                   | `app/(dashboard)/admin/users/page.tsx`                                                                        | `app/admin/users/page.tsx`                                                                                       |
| 34  | Admin Executive Dashboard                     | `/admin`                         | `app/(dashboard)/admin/page.tsx`                                                                              | `app/admin/page.tsx`                                                                                             |
| 91  | Admin Sidebar - System Status Navigation Card | `/status` (via `/admin` sidebar) | evidence → `app/(dashboard)/admin/layout.tsx`                                                                 | `app/status/page.tsx` (the sidebar card lives in the admin nav component, e.g. `components/admin/admin-nav.tsx`) |
| 94  | Admin - Broadcast Notification                | `/admin/notifications/broadcast` | **No C1 counterpart ("Proposed / Pending Creation")**                                                         | `app/admin/notifications/broadcast/page.tsx` — Rule 2 only                                                       |

(Same `(dashboard)/admin/...` vs plain `admin/...` route-group note as Batches 6–7 — not a
Rule-1 gap.)

## Batch-specific notes

- Row 34 (`/admin`, the executive dashboard) is the entry point for the whole admin surface —
  audit it first; its metrics/quick-link set often mirrors what's in the admin sidebar nav
  (row 91), so fixing both together is more efficient than treating them as unrelated.
- Row 91 is specifically about the **sidebar nav card** that links to `/status`, not the
  `/status` page's own content (that page itself is Batch 4's row 84 — if you find the
  status page's _content_ is wrong, note it here for cross-reference but the actual fix
  belongs in Batch 4; if the _admin sidebar's card/link_ is wrong, that's this batch's fix).
- Row 94 has no Codebase-1 page to match (proposed but never built there) — Rule 1 N/A,
  Rule 2 only. It's a genuinely new DavinTrade admin capability.
- Row 26 (`/admin/login`) is a separate, protected superuser login gate distinct from the
  regular `/login` covered in Batch 1 — don't assume it shares a component with the regular
  login form without checking; if it does share one, a fix here could affect Batch 1's rows,
  so flag that dependency explicitly in your findings.
- `components/admin/admin-nav.tsx` and `components/admin/admin-stats.tsx` are the two shared
  admin components most rows in this batch (and Batches 6–7) render through — if either of
  the other two Admin batches already fixed something in these files, `git log`/`git diff`
  them first before assuming they're still in their original state.

## Findings

_(Append here per row: what was wrong, what changed, file(s) touched.)_
