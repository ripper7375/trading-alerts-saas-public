# Batch 7 — Admin: Disbursement Suite

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.
> This is one of three Admin sub-batches (6, 7, 8) — they partition `/admin/*` between them
> with no overlap; you only need this one's rows.

## Scope

10 pages under `/admin/disbursement/*` — affiliate commission payout reconciliation
(accounts, batches, transactions, config, audit trail). This is the most operationally
sensitive admin surface in scope (real payout data) — read carefully, don't guess at fields.

## Rows

| No. | Page Name                               | Route                                          | Codebase 1 file                                                                                                                                                   | Codebase 2 file                                            |
| --- | --------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 13  | Admin Disbursement Accounts             | `/admin/disbursement/accounts`                 | `app/(dashboard)/admin/disbursement/accounts/page.tsx`                                                                                                            | `app/admin/disbursement/accounts/page.tsx`                 |
| 14  | Admin Per-Affiliate Disbursement Report | `/admin/disbursement/affiliates/[affiliateId]` | evidence → `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`; locate page at `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` | `app/admin/disbursement/affiliates/[affiliateId]/page.tsx` |
| 15  | Admin Disbursement Affiliates           | `/admin/disbursement/affiliates`               | `app/(dashboard)/admin/disbursement/affiliates/page.tsx`                                                                                                          | `app/admin/disbursement/affiliates/page.tsx`               |
| 16  | Admin Disbursement Audit Trail          | `/admin/disbursement/audit`                    | `app/(dashboard)/admin/disbursement/audit/page.tsx`                                                                                                               | `app/admin/disbursement/audit/page.tsx`                    |
| 17  | Admin Disbursement Batch Detail         | `/admin/disbursement/batches/[batchId]`        | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`                                                                                                   | `app/admin/disbursement/batches/[batchId]/page.tsx`        |
| 18  | Admin Disbursement Batches              | `/admin/disbursement/batches`                  | `app/(dashboard)/admin/disbursement/batches/page.tsx`                                                                                                             | `app/admin/disbursement/batches/page.tsx`                  |
| 19  | Admin Disbursement Configuration        | `/admin/disbursement/config`                   | `app/(dashboard)/admin/disbursement/config/page.tsx`                                                                                                              | `app/admin/disbursement/config/page.tsx`                   |
| 20  | Admin Disbursement Recipients           | `/admin/disbursement/recipients`               | `app/(dashboard)/admin/disbursement/recipients/page.tsx`                                                                                                          | `app/admin/disbursement/recipients/page.tsx`               |
| 21  | Admin Disbursement Transactions         | `/admin/disbursement/transactions`             | `app/(dashboard)/admin/disbursement/transactions/page.tsx`                                                                                                        | `app/admin/disbursement/transactions/page.tsx`             |
| 22  | Admin Disbursement Overview             | `/admin/disbursement`                          | `app/(dashboard)/admin/disbursement/page.tsx`                                                                                                                     | `app/admin/disbursement/page.tsx`                          |

(Same `(dashboard)/admin/...` vs plain `admin/...` route-group note as Batch 6 — not a
Rule-1 gap, just a folder-naming difference invisible to the URL.)

## Batch-specific notes

- This is real financial-operations tooling (batch approval/rejection controls, recipient
  bank/wire/crypto details, config thresholds). Rule-1 parity here is not optional polish —
  a missing "approve batch" button or a hidden config field is a functional regression, not
  a cosmetic gap. Treat every action button/toggle/confirmation-dialog Codebase 1 exposes on
  these pages as a hard requirement to find in Codebase 2.
- Row 17/18 (batch detail/list) and row 21 (transactions) likely share status-badge/colour
  conventions (pending/approved/failed/reversed) — check these badges use DavinTrade tokens
  consistently across all three rather than fixing one and missing the others.
- Do **not** invent or guess at payout amounts, account numbers, or any other financial data
  while comparing screenshots — if a screenshot shows real-looking figures, treat them as
  placeholder/mock data for comparison purposes only, never copy values as if they were real
  and never expose anything that looks like a real credential or account number in your
  findings notes.

## Findings

> Executed 2026-08-17. Read `00-MASTER-PLAN.md` in full first. All 10 rows compared against
> Codebase 1 source + the `codebase-{1,2}-admin/row_{13-22}_*.png` screenshot pairs before
> editing. No screenshot figures were copied as real data — all mock amounts/IDs below are
> new placeholder values.

### Cross-cutting gap (affects all 10 rows): missing disbursement sub-navigation

**Rule-1 gap.** Codebase 1's entire `/admin/disbursement/*` section is wrapped by its own
`layout.tsx` — a persistent secondary sidebar with 7 links (Overview, Payable Affiliates,
Payment Batches, Transactions, Payout Accounts, Audit Logs, Configuration) plus a "Payment
Provider" status widget (pulsing dot + active provider). Codebase 2 had **no equivalent at
all** — no `app/admin/disbursement/layout.tsx` existed, so every disbursement page was a dead
end reachable only by typing a URL directly; there was no way to navigate from Overview to
Batches, from Batches to Transactions, etc. Only 1 of the 10 pages (`accounts/page.tsx`) even
included the outer admin pill-nav (`AdminNav`), the other 9 didn't.

**Fixed:** added `app/admin/disbursement/layout.tsx` — desktop sub-sidebar + mobile
horizontal tabs (mirrors the existing `/settings/layout.tsx` convention already established
in Batch 3, for consistency), a breadcrumb (Admin › Disbursement › page), and a "Payment
Provider" status widget ("Wise Business — Live", pulsing dot) matching Codebase 1's sidebar
footer. Moved `AppHeader` + `AdminNav` out of all 10 individual page files and into this one
layout (previously each page duplicated/omitted them inconsistently). Verified live: the
sidebar highlights the active section and every link resolves correctly.

### Cross-cutting gap: inconsistent status-badge styling (flagged explicitly in this batch's notes)

**Rule-2 gap.** Batches, batch detail, transactions, audit, affiliates and recipients each
had their own ad-hoc status-badge logic. Some used Codebase 1's literal un-restyled
`bg-green-600`/`bg-red-600` solid classes (the plain palette Rule 2 says to replace), and the
batches list page used a completely different status vocabulary (`QUEUED`/`SETTLED`) than
Codebase 1's real `PaymentBatchStatus` enum (`PENDING`/`QUEUED`/`PROCESSING`/`COMPLETED`/
`FAILED`/`CANCELLED`) — a batch could show "SETTLED" on the list page but the equivalent
concept never appeared anywhere else in the suite.

**Fixed:** added `components/disbursement/status-badge.tsx` — one shared, DavinTrade-styled
(translucent border + tint, not solid fill) badge set for batch/transaction/audit/KYC/Wise-
recipient statuses, imported by every page that shows one of these statuses. All 6 real
`PaymentBatchStatus` values now render consistently across the batches list, batch detail,
and the affiliate-detail transaction table.

---

### Row 22 — `/admin/disbursement` (Overview)

**Rule-1 gap.** Codebase 1's Overview is a real dashboard: System Health card (DB/provider
dots, pending/failed badges, warnings), 4 metric cards (Total Paid, Pending Payout, Payment
Batches w/ success-rate badge, Transactions w/ failed-count badge), a Quick Actions card (4
links, including a `?status=FAILED` deep link into Transactions), a Batch Performance card
with progress bars, an Affiliates Ready card, and an "About" info card. Codebase 2's page was
an unrelated 2-item batch-execution widget ("Affiliate Commission Payout Batches") with none
of the above — effectively a duplicate of the Batches page, not a dashboard.

**Fixed:** rebuilt to cover every section listed above using DavinTrade tokens (emerald/amber/
blue accents on `#090c14` cards). Live-verified: all 4 metric cards, System Health, Quick
Actions (including the failed-transactions deep link, confirmed below), Batch Performance
bars, and the Info card all render.

**File:** `app/admin/disbursement/page.tsx`

### Row 13 — `/admin/disbursement/accounts`

**Structural note, not a defect.** Codebase 1's real file at this route is a **retired
redirect** (`redirect('/admin/disbursement/recipients')`) — RiseWorks accounts management was
folded into the Recipients page in an earlier Codebase-1 session. There is no live C1 UI at
this exact route to diff against for Rule 1. Codebase 2's page is a distinct, legitimate
DavinTrade addition (a Treasury/Payout-accounts balance view — Wise Business USD/EUR pools +
RiseWorks Global wallet) with no C1 analogue, so Rule 1 is N/A here and Rule 2 was the only
applicable check.

**Fixed (Rule 2 / consistency only):** removed the duplicated `AppHeader`/`AdminNav` (now
supplied by the new section layout) and an unused `Link` import; page content (already
DavinTrade-styled) kept as-is.

**File:** `app/admin/disbursement/accounts/page.tsx`

### Row 20 — `/admin/disbursement/recipients`

**Rule-1 gap.** This is the real destination Codebase 1's `accounts` redirect points at, and
carries real functionality Codebase 2 lacked entirely: a **Wise Recipients / RiseWorks
(Historical)** tab split (not one merged table), a status filter dropdown (Draft/Pending
Details/Active/Invalid/Archived), and — on the RiseWorks tab — KYC-status badges and
invitation-sent/accepted badges with an explicit "archived, no sync/create actions" notice.
Codebase 2 also rendered a `Search` input whose `onChange` never filtered anything — a
non-functional control.

**Fixed:** rebuilt with the Wise/RiseWorks tab split, a working status-filter `Select`, a
search box now wired to actually filter the Wise table by name/ID, and the RiseWorks
historical table (KYC/invitation badges, "Historical" badge, archived notice). Kept the masked
account-number convention (`•••• 1234`) already present — never raw numbers.

**File:** `app/admin/disbursement/recipients/page.tsx`

### Row 18 — `/admin/disbursement/batches` (list)

**Rule-1 gap — hard requirement per this batch's own notes.** Missing: status-filter pills
(all 6 real statuses), the "Create Batch" flow was a bare `alert()` instead of Codebase 1's
preview-before-create modal (summary counts + per-affiliate eligibility table), and per-row
**Execute**/**Delete** actions were entirely absent (only a "View Batch" link existed).

**Fixed:** added status-filter pills; replaced the `alert()` with a real `Dialog`-based Create
Batch flow (eligible/ineligible affiliate breakdown, disabled when 0 eligible); added
status-gated **Execute** (PENDING only) and **Delete** (PENDING/CANCELLED/FAILED) actions, each
a real state mutation with an `AlertDialog` confirmation step (a hard requirement for a
money-moving action per this batch's own scope note). Live-verified: PENDING batch shows
Execute+Delete+Details, COMPLETED batches show only Details.

**File:** `app/admin/disbursement/batches/page.tsx`

### Row 17 — `/admin/disbursement/batches/[batchId]`

**Rule-1 gap.** Missing the 4 summary cards (Total Amount/Payments/Completed/Failed), the
Batch Details card (Provider/Currency/Executed-Completed-Failed timestamps/Error message), the
Delete action, the Audit Logs section, and 3 transaction-table columns (Transaction ID,
Provider TX, Retries). The "Execute Batch Now" button also didn't change anything visible —
it showed a success toast but every row stayed "QUEUED" forever, and the button never
disabled/hid itself after use.

**Fixed:** added all of the above; Execute now goes through an `AlertDialog` confirmation, then
genuinely flips the batch and every transaction to `COMPLETED`, appends an audit-log entry, and
the Execute/Delete buttons disappear once the batch is no longer `PENDING`. Live-verified: a
fetched batch detail page renders summary cards, details, a 6-column transaction table, and the
audit-log list correctly.

**File:** `app/admin/disbursement/batches/[batchId]/page.tsx`

### Row 21 — `/admin/disbursement/transactions`

**Rule-1 gap — broke a cross-page link.** No status-filter pills, no pagination, no "Failed
Transaction Details" panel, and critically: the Overview page's "🚨 View Failed Transactions"
quick action links to `/admin/disbursement/transactions?status=FAILED` — Codebase 2's
transactions page never read that query param at all, so the link landed on an unfiltered
table (a "relocated-and-broken" defect per this audit's own done-checklist).

**Fixed:** added status-filter pills wired to the real `?status=` query param (via
`useSearchParams`/`router.push`, wrapped in `Suspense` per this Next.js version's requirement),
client-side pagination, and the Failed Transaction Details panel (shown when filtering by
FAILED). **Live-verified the previously-broken link**: navigating to
`?status=FAILED` now correctly filters to the one FAILED seed transaction and shows its error
detail panel.

**File:** `app/admin/disbursement/transactions/page.tsx`

### Row 15 — `/admin/disbursement/affiliates` (list)

**Rule-1 gap — hard requirement.** No summary cards, no Ready/Not-Ready split (Codebase 2 had
one flat table), no row checkboxes / select-all / bulk "Create Batch (N)" action, no per-row
"Pay Now" quick-pay action, no KYC-status badge. The `Search` input's `onChange` didn't filter
anything.

**Fixed:** rebuilt with 3 summary cards, the Ready-for-Payout / Not-Ready-for-Payout table
split (matching Codebase 1's own two-table structure and column sets), row + select-all
checkboxes with a bulk "Create Batch (N)" button, a "Pay Now" quick-pay action per ready row,
`KycStatusBadge`, and a working search filter over both tables. Live-verified: summary cards,
both table sections, and Pay Now/View actions render correctly.

**File:** `app/admin/disbursement/affiliates/page.tsx`

### Row 14 — `/admin/disbursement/affiliates/[affiliateId]`

**Rule-1 gap.** Missing the 5 stat cards (Total Earnings/Pending/Paid/Codes Distributed/Codes
Used), the Pending Commissions card (oldest date + "meets payout threshold" badge), the
RiseWorks historical account card, and the entire Recent Transactions table (with batch
cross-reference + batch-status badge). The payout button also never updated any visible state
after a simulated success — pending amount stayed frozen.

**Fixed:** added all of the above; the "Disburse Accrued Balance" action now goes through an
`AlertDialog` confirmation (money-moving action) and, on confirm, actually zeroes the pending
balance and moves it into "Paid" — and the button itself disappears once there's nothing left
to disburse.

**File:** `app/admin/disbursement/affiliates/[affiliateId]/page.tsx`

### Row 16 — `/admin/disbursement/audit`

**Rule-1 gap.** No status badges (Success/Failure/Warning/Info) and no action-based filter
pills — Codebase 1 has both. Also found and removed a stray "← Back to Disbursement Batches"
link that pointed Audit at Batches specifically for no evident reason (a leftover from before
the section had real navigation) — now redundant/confusing next to the new section sidebar.

**Fixed:** added `AuditStatusBadge` per row and action-filter pills (derived from the events
present, matching Codebase 1's own "extract unique actions" approach); removed the stray link.

**File:** `app/admin/disbursement/audit/page.tsx`

### Row 19 — `/admin/disbursement/config`

**Rule-1 gap.** Missing the Payment Provider selector (MOCK/RISE/WISE, with the explicit
"informational only, env-var-driven" disclaimer Codebase 1 shows), the master Enabled/Disabled
toggle gating whether batches can be created/executed, the Maximum Batch Size field, and the
Configuration Guide info card explaining Provider/Minimum-Payout/Batch-Size semantics.

**Fixed:** added the provider radio group (WISE selected, MOCK available, RISE disabled/
archived) with the disclaimer banner, an Enabled/Disabled `Switch` with status badge, a Batch
Size input, and the Configuration Guide card. Kept Codebase 2's own DavinTrade-only additions
(auto-execute cron toggle, dual-admin multi-sig toggle, monthly disbursement day, masked API
key fields) — these have no Codebase 1 counterpart to conflict with. **Flagging for Davin,
not changed:** the Wise/RiseWorks API-key fields are plain editable `Input`s (masked
placeholder values only, no real keys) — Codebase 1 doesn't expose API keys on this page at
all. Not clearly wrong per the two rules, but worth a second look given this is the most
sensitive surface in scope.

**File:** `app/admin/disbursement/config/page.tsx`

---

### Verification

- `npx tsc --noEmit -p tsconfig.json` — clean, zero errors.
- `npx next build` — succeeded; all 10 disbursement routes compiled
  (`/admin/disbursement`, `/accounts`, `/affiliates`, `/affiliates/[affiliateId]`, `/audit`,
  `/batches`, `/batches/[batchId]`, `/config`, `/recipients`, `/transactions`), no new routes
  broken elsewhere in the 88-route build.
- `npx eslint` could not be run scoped to this batch — `seed-code/` has no ESLint config of its
  own, and `eslint .` from inside it picks up the **repo root's** `eslint.config.mjs`, which
  ignores everything under `seed-code/` as outside its base path. Pre-existing condition,
  unrelated to this batch's changes; not something in scope to fix here.
- Live-verified in a real browser (an already-running dev server for this project, found on
  port 3100) rather than screenshots alone: Overview's 4 metric cards + System Health + Quick
  Actions render; the Overview → Transactions `?status=FAILED` deep link now genuinely filters
  and shows the error-detail panel; the Batches list shows status-gated Execute/Delete/Details
  actions; batch detail renders summary cards + 6-column transaction table + audit log; the
  Payable Affiliates page renders both table sections with working checkboxes and Pay Now
  actions. (A `.claude/launch.json` edit to add a dedicated dev-server entry was attempted for
  this, then reverted — that file lives outside `seed-code/`, which this audit may not touch;
  an already-running instance of the app was used instead.)
