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

_(Append here per row: what was wrong, what changed, file(s) touched.)_
