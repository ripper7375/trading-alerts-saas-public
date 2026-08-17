# Batch 6 — Admin: Affiliate Reports & Directory

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.
> This is one of three Admin sub-batches (6, 7, 8) — they partition `/admin/*` between them
> with no overlap; you only need this one's rows.

## Scope

7 pages under `/admin/affiliates*` — the affiliate directory and its 5 report views. Shared
nav component: `components/admin/admin-nav.tsx` (only needs auditing once across all three
Admin batches — if Batch 7 or 8 already covered it, skip re-auditing, just check your rows
render correctly through it).

## Rows

| No. | Page Name                        | Route                                         | Codebase 1 file                                                                                                                                                                                      | Codebase 2 file                                           |
| --- | -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 5   | Admin Affiliate Detail           | `/admin/affiliates/[id]`                      | `app/(dashboard)/admin/affiliates/[id]/page.tsx`                                                                                                                                                     | `app/admin/affiliates/[id]/page.tsx`                      |
| 6   | Admin Report - Code Flows        | `/admin/affiliates/reports/code-flows`        | evidence → `app/api/admin/affiliates/reports/code-flows/route.ts`; locate page at `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`                                                     | `app/admin/affiliates/reports/code-flows/page.tsx`        |
| 7   | Admin Report - Code Inventory    | `/admin/affiliates/reports/code-inventory`    | evidence → `app/api/admin/codes/[code]/cancel/route.ts` (likely wrong/unrelated evidence link — locate the real page at `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx` directly) | `app/admin/affiliates/reports/code-inventory/page.tsx`    |
| 8   | Admin Report - Commission Owings | `/admin/affiliates/reports/commission-owings` | `app/(dashboard)/admin/affiliates/reports/commission-owings/page.tsx`                                                                                                                                | `app/admin/affiliates/reports/commission-owings/page.tsx` |
| 9   | Admin Report - Profit & Loss     | `/admin/affiliates/reports/profit-loss`       | `app/(dashboard)/admin/affiliates/reports/profit-loss/page.tsx`                                                                                                                                      | `app/admin/affiliates/reports/profit-loss/page.tsx`       |
| 10  | Admin Report - Sales Performance | `/admin/affiliates/reports/sales-performance` | `app/(dashboard)/admin/affiliates/reports/sales-performance/page.tsx`                                                                                                                                | `app/admin/affiliates/reports/sales-performance/page.tsx` |
| 11  | Admin Affiliates Directory       | `/admin/affiliates`                           | `app/(dashboard)/admin/affiliates/page.tsx`                                                                                                                                                          | `app/admin/affiliates/page.tsx`                           |

Note the route-group difference: Codebase 1 nests these under `(dashboard)/admin/...` while
Codebase 2 nests them under a plain `admin/...` (no route group). That's just a Next.js
routing-group naming choice, not a URL difference — both resolve to the same `/admin/...`
public path. Don't flag it as a Rule-1 gap; it's invisible to the user.

## Batch-specific notes

- Row 7's evidence link looks mismatched to its own page (`codes/[code]/cancel` route is
  about cancelling a code, not a "Code Inventory" report) — treat this as a bad xlsx cell,
  not as a hint about the page's actual purpose. Go straight to the real Codebase-1 page
  path.
- These are all data-table/report pages — Rule-1 comparison should focus on: table columns,
  sort/filter controls, date-range pickers, export buttons, and pagination, since that's
  where "core interactive elements" actually live on a reporting page (not just page chrome).
- Report pages are a good place to double-check number/currency formatting matches Codebase
  1's convention (this repo has separate multi-currency/locale work elsewhere — don't
  reinvent formatting logic here, just confirm Codebase 2 isn't silently using a different
  format than Codebase 1 for the same data).

## Findings

> Executed 2026-08-17. `components/admin/admin-nav.tsx` was confirmed untouched at session
> start (clean `git status`, no Batch 6/7/8 commits in `git log`) so it was safe to treat as
> a fresh baseline. Partway through this session it began changing under what is almost
> certainly a concurrent Batch 8 session (a live `read_page` snapshot showed
> `/admin/settings/affiliate` and `/status` added and `/admin/system/outbox` /
> `/admin/notifications/broadcast` no longer in the visible list — consistent with Batch 8
> owning "row 91: admin sidebar nav card"). Per this batch's own instructions that shared
> component was **not** re-audited — only reconfirmed that the "Affiliates & Reports" entry
> pointing at `/admin/affiliates` kept existing and routing correctly throughout, which it
> did on every check.

### Row 11 — `/admin/affiliates` (Admin Affiliates Directory)

**Rule-1 gaps found:** no Country filter or Country column at all (Codebase 1 has both); the
status filter only covered `ALL/ACTIVE/SUSPENDED` against Codebase 1's real 4-state schema
(`ACTIVE/PENDING_VERIFICATION/SUSPENDED/INACTIVE`); no "Clear Filters" control; no empty-state
row when a filter combination matches nothing.

**Fixed:** added `country` to the mock affiliate records plus a Country filter input and table
column; expanded the status filter to all 4 real statuses with matching badge colors
(`getStatusBadgeClass` helper); added a "Clear Filters" reset action; added a "No affiliates
found" empty-state row. Rule-2 (DavinTrade dark styling) was already fully compliant — no
changes needed there.

**File(s):** `app/admin/affiliates/page.tsx`

### Row 5 — `/admin/affiliates/[id]` (Admin Affiliate Detail)

**Rule-1 gaps found — the largest gap in this batch.** Codebase 1's detail page has a Profile
Information panel (Country, Payment Method, Verified At, Joined, Suspension Reason), an
Earnings Summary panel (Total Earnings, Paid Commissions, Codes Distributed/Used, Conversion
Rate), a full Affiliate Codes history table (Status/Reason/Distributed/Expires/Used), and a
Recent Commissions table — Codebase 2 had **none** of these; it only showed 3 stat tiles and a
bare row of promo-code chips with no status/date metadata. Notably, 5 lucide-react icons
(`Landmark`, `Percent`, `DollarSign`, `ShieldCheck`, `AlertTriangle`) were imported but never
referenced anywhere in the file — strong evidence the page was scaffolded for this content and
left unfinished rather than deliberately simplified.

**Fixed:** added a Profile Information card and an Earnings Summary card (both reusing the
pre-imported icons above); converted the bare code chips into a full Affiliate Codes table
(status/reason/distributed/expires/used) while keeping the existing "Allocate Promo Code" add
flow, now pushing fully-detailed entries; added a Recent Commissions table; wired the
Suspend/Reactivate toggle to capture a suspension reason via `prompt()` (matching Codebase 1's
own flow) and surfaced it in the Profile card when suspended.

**File(s):** `app/admin/affiliates/[id]/page.tsx`

### Row 6 — `/admin/affiliates/reports/code-flows` (Code Flows report)

**Rule-1 gap found:** Codebase 1 is a period-reconciliation report built around a Start/End
date-range picker (opening + additions − reductions = closing balance) — the date-range picker
itself, an explicitly-flagged "core interactive element" per this batch's own notes, was
completely absent from Codebase 2, which instead shows a per-code redemption-velocity table (a
legitimate DavinTrade-only superset view, kept as-is per the master plan's philosophy).

**Fixed:** added Start/End date inputs, genuinely wired to filter the table by each code's
issued date (not decorative), plus a "Period: X – Y · N codes issued" caption and an
empty-state row for zero-match ranges. Default range set to Jan 1 of the current year through
today so all 3 mock rows are visible out of the box.

**Not fixed / flagged for a future session:** Codebase 1's opening/closing-balance
reconciliation panels (Additions-by-reason / Reductions breakdown) have no natural equivalent
in Codebase 2's per-code redemption model — building them would require a second, parallel
mock dataset rather than a simple UI parity fix, so this is flagged rather than forced.

**File(s):** `app/admin/affiliates/reports/code-flows/page.tsx`

### Row 7 — `/admin/affiliates/reports/code-inventory` (Code Inventory report)

**Rule-1 gaps found:** Codebase 1 has a period selector (3/6/12 months), an All-Time Statistics
panel (5 cards), a Period Metrics panel (4 cards), status/reason breakdown bars, expiring-soon
and low-stock alerts, and a "Cancel a Code" admin widget. Codebase 2 only had its pool-based
inventory table (Tier/Standard/Institutional pools) with none of the above.

**Fixed:** added an aggregate summary-stat row (Total Minted / Assigned to Partners / Available
Stock / Assignment Rate) computed live from the existing pool data, plus an Export CSV button
matching the convention already established on all 4 sibling report pages.

**Not fixed / flagged for a future session:** the period selector, status/reason breakdown
bars, expiring-soon alerts, and the Cancel-a-Code mutation widget don't have a natural mapping
onto Codebase 2's pool model — pools aren't scoped to individual codes or distribution dates,
so a period filter would have nothing real to filter. Building a decorative, non-functional
control seemed worse than flagging the underlying data-model gap; this needs a product/data
decision (does Codebase 2 want per-code inventory tracking, or does the pool model replace it
outright?) before it can be built correctly.

**Resolved (Davin's decision, 2026-08-17): keep the pool model as the permanent design.**
Codebase 1's per-code period selector, status/reason breakdown, expiring-soon alerts, and
Cancel-a-Code widget are intentionally superseded by Codebase 2's pool-based tracking, not
missing. This finding is closed — no further build work planned against it. If per-code
tracking is ever wanted, it should be scoped as new product work against a real backend, not
retrofitted onto this mock-data page.

**File(s):** `app/admin/affiliates/reports/code-inventory/page.tsx`

### Row 8 — `/admin/affiliates/reports/commission-owings` (Commission Owings report)

**Rule-1 gaps found:** missing Country column; 3 of Codebase 1's 4 summary cards were missing
(Affiliates Owed count, Ready for Payout count, Min Payout Threshold — only an equivalent of
"Total Owed" existed, via the Overview box); no per-row "Pay" action (Codebase 2 only offered a
bulk "Queue Wise Disbursement Batch" button, whereas Codebase 1 lets an admin pay one affiliate
at a time); no "View" link to the affiliate detail page per row at all.

**Fixed:** added the Country column; added the 3 missing summary cards; added a per-row "Pay"
action (prompts for a payment reference, mirrors Codebase 1's `prompt()`-based flow) for
affiliates that are ready for batch; added a "View" link per row to `/admin/affiliates/{id}`;
added an Export CSV button matching sibling report pages.

**File(s):** `app/admin/affiliates/reports/commission-owings/page.tsx`

### Row 9 — `/admin/affiliates/reports/profit-loss` (Profit & Loss report)

**Rule-1 gap found:** Codebase 1's period selector (3/6/12 months) — the single most
consistently-missing control across this whole batch — was entirely absent. Codebase 2's
existing 4-month table and 4 summary cards were already a reasonable superset and were kept.

**Fixed:** added a functional period selector wired to 3 distinct summary datasets (verified
live in-browser that all 3 states render genuinely different values, e.g. "6 Months" showing
$128,900.00 gross revenue vs. the "3 Months" default of $64,850.00), with the "Gross Revenue
(Period)" card label updating to match the current selection.

**Not fixed / flagged for a future session:** Codebase 1's Revenue Breakdown (gross / discounts
/ net / average ticket) and Commission Breakdown (paid / approved / pending split) cards have
no equivalent in Codebase 2 — flagged rather than built, given the proportionate scope of this
pass and that the period selector was the higher-value, explicitly-called-out gap.

**Resolved (2026-08-17): both breakdown cards added.** Extended `SUMMARY_BY_PERIOD` with
`discountPercent`/`discounts`/`netRevenue`/`totalSales`/`averageTicket` and
`paidCommissions`/`approvedCommissions`/`pendingCommissions` per period (all figures derived
consistently from the existing `grossRevenue`/`affiliateExpense` values already in this file —
5% discount rate, 70/20/10 paid/approved/pending split, and `averageTicket` fixed at
`lib/tier-config.ts`'s real `PRO_MONTHLY_PRICE` ($29) rather than an arbitrary number, so
`totalSales` backs out cleanly). Added the two card sections in the same
`border-slate-800/80 bg-[#090b14]/90` styling already used by this page's summary cards, sums
verified to tie out exactly to the existing Gross Revenue / Affiliate Expense figures at all 3
period selections. `tsc --noEmit` and `next build` clean.

**File(s):** `app/admin/affiliates/reports/profit-loss/page.tsx`

**File(s):** `app/admin/affiliates/reports/profit-loss/page.tsx`

### Row 10 — `/admin/affiliates/reports/sales-performance` (Sales Performance report)

**Rule-1 gaps found:** missing period selector; all 4 of Codebase 1's summary cards were
missing (Active Affiliates, Total Conversions, Total Commissions, Avg per Affiliate); missing
Country column; missing "View" link to the affiliate detail page (Codebase 1 has one per row,
Codebase 2's leaderboard had zero navigation into affiliate profiles).

**Fixed:** added the period selector (matching the Row 9 pattern); added the 4 summary cards,
computed live from the leaderboard data; added a Country column; added a "View" action column
linking each row to `/admin/affiliates/{id}`.

**File(s):** `app/admin/affiliates/reports/sales-performance/page.tsx`

### Cross-cutting notes

- **Dead icon imports removed, several later reused for real:** every one of the 7 files had
  lucide-react icons imported but never rendered (`Share2`, `RefreshCw`, `Send` in some files;
  `Layers`, `TrendingUp`, `Percent`, `AlertTriangle`, `ArrowRight`, `Ban`, `Sparkles`,
  `QrCode`, `Filter`, `Calendar`, `Users`, `DollarSign`, `ShieldCheck`, `Landmark` in others),
  plus every file importing `CardContent` from `@/components/ui/card` without using it. Cleaned
  up throughout; the icons that made sense for the new sections built in this session
  (`Filter`, `QrCode`, `Calendar`, `Users`, `TrendingUp`, `Landmark`, `DollarSign`, `Percent`,
  `ShieldCheck`, `AlertTriangle`) were put to real use rather than just deleted.
- **Currency/date formatting:** confirmed consistent with Codebase 1's convention throughout
  (`$X.XX` via `.toFixed(2)`, `en-US` short dates) — no new formatting scheme was introduced
  per this batch's own note to check this.
- **Timezone bug caught during live verification:** `new Date(year, 0, 1).toISOString()` (and
  `.toISOString().slice(0, 10)` on a locally-constructed `Date`) silently rolls back a day in
  negative-UTC-offset timezones — caught live in-browser on Row 6 (`Start` showed
  `2025-12-31` instead of `2026-01-01`). Fixed in both new call sites (Row 6's date-range
  default, Row 5's code-allocation date stamps) with a local
  `getFullYear`/`getMonth`/`getDate` string-builder instead of round-tripping through
  `toISOString()`.
- **Verification:** `tsc --noEmit` clean, `next build` succeeds (all 88 routes generate,
  including all 7 rows in this batch), and every row was click-verified live against the dev
  server (`localhost:3100`, already running from a concurrent session — reused rather than
  starting a second, port-conflicting instance) via `get_page_text`/`read_console_messages`/
  direct JS execution: no console errors, Row 9's period toggle confirmed to genuinely swap
  values, Row 8/10/5's new "View"/navigation links confirmed to point at the correct
  `/admin/affiliates/{id}` hrefs.
- **Scope discipline:** every edit stayed inside `seed-code/trading-conversational-ai-ui-pages-increment`;
  `components/admin/admin-nav.tsx` was read but not modified (see note above); no Codebase 1
  file was touched.
