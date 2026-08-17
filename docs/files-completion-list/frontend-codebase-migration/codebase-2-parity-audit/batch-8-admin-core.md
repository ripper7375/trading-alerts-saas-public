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

Session date: 2026-08-17. Confirmed Batch 0 (shared shell) already landed. Checked `git log`
on `components/admin/admin-nav.tsx` and `components/admin/admin-stats.tsx` first per this
batch's own note — neither had been touched by Batches 6 or 7 (both still only carry the
original replication/English-localization commits), so both were safe to treat as
untouched. All 15 rows reviewed field-by-field against Codebase 1's real, currently-live
page/component (not just the xlsx evidence pointer). Every fix was re-verified live via the
already-running seed-code dev server (port 3100) using the browser tool — clicked through
the actual flows, not just re-read the diff.

### Row 34 — Admin Executive Dashboard (`/admin`)

**Rule-1 gap found (fixed):** `app/admin/page.tsx` never rendered `<AdminNav />` at all —
every other admin page in this batch (and the other two Admin batches) mounts it, but the
entry point to the entire admin surface did not. Landing on `/admin` left an admin with zero
way to reach Users, Fraud Alerts, API Usage, Errors, Status, Disbursements, Affiliate
Settings, System pages, or Broadcast except by typing a URL directly — a dead end at the
literal front door of the admin section. Confirmed live: before the fix, `read_page` on
`/admin` showed no `/admin/*` nav links at all; after adding `<AdminNav />`, all 11 links
render. Fixed by importing `AdminNav` and mounting it directly under `AppHeader`, matching
the pattern every sibling admin page already uses.

Codebase 1's own dashboard additionally has a "Quick Actions" card (View Errors/View PRO
Users/API Usage/System Status links) and a "System Status & Infrastructure Operations" grid
(Terminals/Jobs/Outbox/Config History links) — once the nav fix above lands, every one of
those destinations is reachable from the persistent top nav on every admin page, so this was
treated as capability-equivalent (different presentation, not a gap) per the master plan §1
philosophy, not rebuilt as a duplicate quick-link grid on the dashboard itself.

**Files touched:** `app/admin/page.tsx`.

### Row 91 — Admin Sidebar/Nav "System Status" card (`/status` via admin nav)

**Rule-1 gap found (fixed):** `components/admin/admin-nav.tsx`'s `links` array was missing
entries for `/status`, `/admin/settings/affiliate`, and `/admin/system/config-history` —
all three pages exist and are otherwise fully built (rows 27, 28, and Batch 4's row 84) but
were unreachable from the primary admin nav bar. Confirmed this wasn't a deliberate
omission: the file already imported `Settings` and `History` icons from `lucide-react` that
were never used anywhere in the component — a strong signal these three links were
originally planned and dropped, the same "cut mid-build" pattern found repeatedly across
this batch (see rows 27, 32 below). Codebase 1's own `(dashboard)/admin/layout.tsx` sidebar
has a `System Status` nav item linking to `/status` (distinct from its lower "Check
terminals & jobs" quick-glance card, which links to `/admin/system/terminals` instead — that
one already has nav coverage in Codebase 2 via the existing "MT5 Fleet" link, so nothing
further was needed there) plus `Affiliate Settings` and `Config History` items — all three
now have direct Codebase-2 nav equivalents.
Fixed: added the three missing entries (`Gauge` icon for System Status, reusing the
already-imported-but-unused `Settings`/`History` icons for the other two), verified live —
all 11 links now render and route correctly, including the previously-missing three.
**Per this row's own scope note:** this fix is only about the nav bar's link coverage, not
`/status`'s own page content — that page's content is Batch 4's row 84 and was not touched
here. **Cross-reference for rows 27/28:** those two pages themselves were already fully
built and did not need their own nav-reachability fix beyond this one shared-component
change.

**Files touched:** `components/admin/admin-nav.tsx`.

### Row 33 — Admin User Management (`/admin/users`)

**Rule-1 gaps found (fixed):**

- `components/admin/user-table.tsx` had **no way to reach `/admin/users/[id]` at all** —
  grepped the whole codebase for any `admin/users/` link/route reference outside the detail
  page's own internal `fetch` call and found none. Row 32's detail page (325 lines, fully
  built) was completely unreachable through the UI. Codebase 1's `UsersPage` links both the
  name and email cells plus an explicit "Inspect User →" button to `/admin/users/[id]`.
  Fixed: wrapped the name and email/joined-date line in `Link`s to `/admin/users/${user.id}`,
  and added an explicit "Inspect" button alongside the existing Suspend/Reactivate action —
  verified live, clicking any of the three lands on the correct user's detail page.
- No tier/role filter existed — only a free-text search box. Codebase 1's `UsersPage` has an
  explicit ALL/FREE/PRO tier `Select`. Codebase 2's user model has 4 roles (FREE/PRO/ADMIN/
  AFFILIATE), so a role filter is a strict superset of C1's capability, not a divergence.
  Fixed: added an ALL/FREE/PRO/ADMIN/AFFILIATE `Select` next to the search box, combined
  with the existing text search in `filteredUsers`.
- Found and fixed a real, pre-existing display bug while touching the header line: the
  translation key literally baked in `'USER ACCOUNT DIRECTORY (4)'` and then appended a
  second, separately-computed `({users.length})` after it — always showing a static "(4)"
  regardless of the real list, doubled up with the dynamic count. Fixed to
  `{t('User Account Directory')} ({filteredUsers.length})` so the header now reflects the
  actual filtered count (confirmed live: uppercased by the existing `uppercase` class to
  "USER ACCOUNT DIRECTORY (4)" when unfiltered, matching the real row count).

**Files touched:** `components/admin/user-table.tsx`.

### Row 32 — Admin User Detail (`/admin/users/[id]`)

**Rule-1 gaps found (fixed):** Codebase 1's real page (`prisma`-backed, 5 read-only
sections: Profile & Account Status, Subscription & Billing, Security & 2FA, Fraud Alerts
with per-alert links to `/admin/fraud-alerts/[id]`, Affiliate & Code Info) has substantially
more informational coverage than Codebase 2's editable-form version had. Found the same
"cut mid-build" signature as row 91: the file imported `Mail`, `CreditCard`, `ShieldAlert`,
`Clock`, `Calendar`, `Layers`, `Zap`, `Users`, `ShieldCheck`, `Lock` from `lucide-react` and
used almost none of them — strong evidence entire sections were planned and never wired up.
Missing sections, now added:

- **Email Verified** status — added as a third badge next to the existing Tier/Role badges.
- **Active Sessions** count — added as a third stat box in what was a 2-column (2FA +
  Affiliate code) grid, now 3 columns.
- **Subscription & Billing** — entirely absent before; added a new read-only card (status,
  provider, subscription ID, plan, period end, trial status), matching C1's own field set.
- **Fraud Alerts** — entirely absent before (a genuine gap: no way to see a user's fraud
  history from their own detail page). Added a new card listing alerts with a working `Link`
  to `/admin/fraud-alerts/[id]` per item, mirroring C1's own per-alert link pattern —
  verified live, the link routes to the correct fraud alert detail page.
- **Affiliate & Code Info** — the existing "Attributed Referral Code" box only showed the
  code itself; expanded into a full card adding Status/Codes Distributed/Total Earnings/
  Pending Commissions, matching C1's 4-stat breakdown.

**Files touched:** `app/admin/users/[id]/page.tsx`.

### Rows 24/25 — Admin Fraud Alerts List (`/admin/fraud-alerts`) & Detail (`/admin/fraud-alerts/[id]`)

**Rule-1 gap found (fixed), row 25:** `app/admin/fraud-alerts/page.tsx` had **no link to the
detail page at all** — Codebase 1's `FraudAlertCard` has an explicit "View & Investigate"
button routing to `/admin/fraud-alerts/[id]`; Codebase 2's list only had two action buttons
("Suspend Account & Block IP", "Dismiss as False Positive") with **no `onClick` handlers at
all** — both fully non-functional, and row 24's detail page (167 lines, fully built with
working Dismiss/Freeze actions) was completely unreachable. Fixed: added a working "View &
Investigate" link/button per item routing to `/admin/fraud-alerts/${item.id}` (verified live
— routes correctly), and wired the two previously-dead buttons to real local state
(Suspend → BLOCKED, Dismiss → DISMISSED, each disabling further action on that item and
updating its status badge color), since leaving them silently non-functional right next to
a fix in the same file would be a worse regression than not touching them.

**Row 24 (detail page):** already fully functional once reachable — Dismiss/Freeze actions
both work with real local state and a success banner. **Observed, not fixed:** the detail
page's content (title, suspect affiliate, colliding accounts, telemetry) is fully static and
identical regardless of which alert ID is opened (`FRAUD-101` vs `FRAUD-102` both render the
same "Self-Referral & Fingerprint Collision" story) — a cosmetic demo-data limitation, not a
missing capability, and consistent with this app's established static-seed-data pattern
elsewhere (Batch 2's notification list, this batch's own outbox/jobs pages). Not built out
further given the reachability fix was the real, severe gap.

**Files touched:** `app/admin/fraud-alerts/page.tsx`.

### Row 26 — Admin Login Portal (`/admin/login`)

**Finding (new — not in master plan §2's known-exceptions table):** Codebase 1 has **no
live standalone `/admin/login` page anymore**. `git log --all` shows `app/admin/login/
page.tsx` existed at initial release but was deliberately retired in commit `7d47a54a`
("consolidate admin tree into `app/(dashboard)/admin` and overhaul admin nav (F62)") —
replaced with a permanent `next.config.js` redirect to `/login`, per Davin's own explicit
direction recorded in that commit message ("No role-aware redirect preserved... an admin who
signs in via `/login` reaches `/admin` the same way any admin does today"). Confirmed
`app/admin/` has no `login/` subdirectory in the live tree today. This means Rule 1 is N/A
for this row — same treatment as rows 57/58/94/95 per master plan §2, just not listed there
since it wasn't known at master-plan-drafting time. **Flagging for Davin/the master plan's
own maintainers** to fold into §2's exceptions table for future batches that might touch
`/admin/login`.

**Dependency check (per this batch's own note):** confirmed `app/admin/login/page.tsx` does
**not** share any component with the regular `/login` page covered in Batch 1 — it's fully
self-contained (only imports shared `ui/` primitives), so no cross-batch conflict exists.

**Rule 2:** page already uses DavinTrade's dark/rose/amber gradient theme consistently, no
leftover Trading-Alerts styling. No fix needed.

**Files touched:** none.

### Row 27 — Admin Settings: Affiliate Program (`/admin/settings/affiliate`)

**Rule-1 gaps found (fixed):** Codebase 1's real page (409 lines) configures the actual
pricing/payout levers that drive the business logic — Customer Discount %, Codes Per Month,
Monthly Subscription Price, 3-Day Trial Price, an optional change Reason (audit trail), plus
a live "Example Calculation" preview panel and an "Important Notes" list. Codebase 2's
version (150 lines) only had Default Commission Rate %, Cookie Lifespan, and 2 toggle
switches — none of the actual price/discount/codes-per-month levers existed anywhere, and a
third toggle (`allowCustomCoupons`) was declared in state but never rendered (another
instance of the "cut mid-build" pattern seen elsewhere in this batch). Fixed:

- Added the 4 missing pricing fields (Customer Discount %, Codes Per Month, Monthly
  Subscription Price, 3-Day Trial Price) plus the optional Reason-for-Change field.
- Wired the previously-dead `allowCustomCoupons` state to a new "Allow Custom Coupon Codes"
  toggle.
- Added a live "Example Calculation" preview card (Regular Price → Discount → Customer Pays
  → Affiliate Earns → Company Revenue, all recomputed from the live form state) and an
  "Important Notes" card, matching C1's own two-panel layout — restructured the page into a
  2-column grid (form left, live preview right) to fit both.
- Added the missing "← Back to Affiliates" link C1 has at the top of its page.
  Verified live: changing the discount/price fields updates the Example Calculation numbers in
  real time; all fields submit through the existing `handleSave` flow.

**Files touched:** `app/admin/settings/affiliate/page.tsx`.

### Row 28 — Admin System Config History (`/admin/system/config-history`)

**No Rule-1 gap.** Codebase 1's real page is backed by a Prisma model
(`SystemConfigHistory`) that has **zero readers or writers anywhere in that codebase** —
confirmed by C1's own code comment ("exists in the schema with zero readers or writers...
Renders an honest 'no entries recorded' empty state rather than fabricating audit rows").
Codebase 2's version shows 3 illustrative demo rows in a well-styled dark-themed table — a
richer, more useful presentation than C1's genuinely-always-empty state, not a gap. Only
difference is C1 additionally has a "Reason" column; given the underlying data is static
demo content on both README-documented "no live backend" sides of this comparison, not
worth adding for a column C1 itself never actually populates. Rule 2: dark/amber theme,
consistent, no leftover styling. No fix needed.

**Files touched:** none.

### Row 29 — Admin Cron/Job Monitor (`/admin/system/jobs`)

**Rule-1 gap found (fixed):** Codebase 1's real page gates every "Run Now" behind an
`AlertDialog` confirmation ("This triggers the exact same code money-service runs on its own
schedule, right now, for real. Only proceed if you intend a real, immediate execution.").
Codebase 2's "Trigger" button ran the job immediately on click with no confirmation step —
a missing flow step for a real, consequential action. Fixed: wrapped the trigger button in
the already-available `components/ui/alert-dialog.tsx` primitive (unused until now),
reproducing C1's own confirmation copy adapted to Codebase 2's job-name field. Verified
live: clicking "Trigger" opens a confirmation dialog naming the specific job; "Cancel"
closes without running anything, "Run now" proceeds with the existing loading/success flow.

**Files touched:** `app/admin/system/jobs/page.tsx`.

### Row 30 — Admin Outbox Event Monitor (`/admin/system/outbox`)

**Rule-1 gaps found (fixed):** Codebase 1's real page has status-summary cards (PENDING/
PROCESSED/FAILED counts) and a "Retry Failed Events" button gating a real retry action —
Codebase 2 had neither: a flat table with no summary, no retry capability, and (since every
seed row was hardcoded `SENT`) no way to even demonstrate a failure state. The search box
was also a dead control — bound to `search` state but never used to filter the list. Fixed:

- Added a 4th seed row with `status: 'FAILED'` and a real `lastError` message so the failure
  state and retry flow are actually demonstrable.
- Added SENT/PENDING/FAILED status-summary cards (derived live from `outboxMessages`).
- Added a working "Retry Failed Events" button (disabled when there are no failed events,
  shows the live failed-count as a badge) that moves all `FAILED` rows to `SENT` and clears
  their error text, with a loading state and success banner.
- Added a "Last Error" table column (previously nowhere to see why a delivery failed).
- Fixed the dead search box to actually filter by ID/recipient/subject.
  Verified live: before the fix, SENT/PENDING/FAILED = 3/0/1 with the new failed row visible
  and its SES-throttling error shown; clicking "Retry Failed Events" moved the count to 4/0/0
  and cleared the error text.

**Files touched:** `app/admin/system/outbox/page.tsx`.

### Row 31 — Admin MT5 Terminal Health (`/admin/system/terminals`)

**No Rule-1 gap.** Codebase 1's real page is a pure read-only live-reachability monitor
against flask-api (connected/total terminals, avg response time, per-terminal
connected/disconnected table) with **no restart/reboot capability at all** — its only action
is "Retry now" (re-fetch, not a terminal action). Codebase 2's "Soft Reboot Terminal Node"
button is a DavinTrade-only capability with no C1 counterpart to gate behind a missing
confirmation step, and its per-node ping/CPU/RAM/uptime cards are a reasonable equivalent
presentation of C1's connected-terminal metrics. Rule 2: consistent amber/rose/emerald dark
theme. No fix needed.

**Files touched:** none.

### Row 94 — Admin Broadcast Notification (`/admin/notifications/broadcast`)

**No C1 counterpart (Rule 1 N/A per master plan §2).** Rule 2 only: page uses DavinTrade
dark theme, amber CTA, slate-bordered inputs/cards throughout — fully functional (audience
select, headline/body fields with `required` validation, 3 delivery-channel toggles, disabled
submit while sending, success banner). No leftover Trading-Alerts styling found. No fix
needed.

**Files touched:** none.

### Row 12 — Admin API Usage & Rate Limits (`/admin/api-usage`)

**No Rule-1 gap.** Codebase 1's real page shows a generic per-REST-endpoint breakdown (calls
by FREE/PRO tier, avg response time, error rate with a >5%-error alert banner) plus a
date-range filter. Codebase 2 instead breaks down usage by DavinTrade's own real subsystems
(MT5 tick feed, AI conversational engine, Stripe/dLocal webhooks, Wise payout API,
TimescaleDB ingestion) with per-subsystem latency/quota/capacity bars — a legitimately
different, arguably more relevant presentation of "API usage" for this product's actual
architecture, matching master plan §1's "richer, not a redesign-to-match" philosophy. The
working "Refresh Telemetry" button covers C1's manual-refresh capability; the date-range
filter has no equivalent, but has no functional consequence for this session's own
frontend-only static-data model. No fix needed.

**Files touched:** none.

### Row 23 — Admin System Error Logs (`/admin/errors`)

**Rule-1 gap found (fixed):** the search box (`search` state, bound `Input onChange`) was
never actually used to filter the `errors` list — a non-functional interactive element per
master plan §5's own definition of a Rule-1 gap, independent of C1 parity. Fixed: added a
`filteredErrors` derivation (matches source/message/ID, case-insensitive) and an empty-state
message when a search matches nothing. The rest of the page (click-to-select stack-trace
panel, per-error Resolve action) was already fully functional and is a DavinTrade-only
richer presentation than C1's type/tier/date-filtered table — not rebuilt to match C1
literally, per master plan §1.

**Files touched:** `app/admin/errors/page.tsx`.

### Rule-2 sweep (all 15 rows)

Grepped `app/admin` and `components/admin` for any leftover Codebase-1 "Trading Alerts"
styling (`bg-gray-700/800/900`, `text-blue-400`, `bg-blue-600`, `border-gray-600/700`) —
zero hits across the whole batch. Every page already uses DavinTrade's dark theme with
slate/amber/rose/emerald/cyan tokens consistently; no light-mode leftovers, no unstyled
shadcn defaults, no wrong brand assets found in this batch's 15 rows.

### Verification

`tsc --noEmit` clean (exit 0). `npm run build` — compiled successfully, all 88 static routes
generated including every row in this batch (`/admin`, `/admin/users`, `/admin/users/[id]`,
`/admin/fraud-alerts`, `/admin/fraud-alerts/[id]`, `/admin/login`,
`/admin/settings/affiliate`, `/admin/system/config-history`, `/admin/system/jobs`,
`/admin/system/outbox`, `/admin/system/terminals`, `/admin/api-usage`, `/admin/errors`,
`/admin/notifications/broadcast`, `/status`). Live-verified via the already-running seed-code
dev server (`localhost:3100`): admin nav now shows all 11 links from `/admin` itself; user
table's Inspect links and role filter work; user detail page renders all 5 new/expanded
sections; fraud-alerts list's "View & Investigate" routes to the real detail page; outbox's
Retry Failed Events moved a FAILED row to SENT live (3/0/1 → 4/0/0); jobs page's Trigger
button now opens a real confirmation dialog before running. One pre-existing, unrelated
console warning ("Can't perform a React state update on a component that hasn't mounted
yet") was observed during testing — not caused by any change in this batch (reproduces on
simple button clicks with no unmount involved) and not chased further, flagged here for
whichever session next touches global providers/layout.

**Files touched this session (9):** `components/admin/admin-nav.tsx`,
`components/admin/user-table.tsx`, `app/admin/page.tsx`, `app/admin/users/[id]/page.tsx`,
`app/admin/fraud-alerts/page.tsx`, `app/admin/settings/affiliate/page.tsx`,
`app/admin/system/jobs/page.tsx`, `app/admin/system/outbox/page.tsx`,
`app/admin/errors/page.tsx`. 6 rows required no code change (12, 26, 28, 31, 94, plus row
34's dashboard-quick-links sub-question) — each documented above with the reasoning.
