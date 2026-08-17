# Batch 5 — Affiliate Portal

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.

## Scope

14 pages under `/affiliate/*` in both codebases (the partner/affiliate program portal,
distinct from the `/admin/affiliates/*` admin-side pages covered by Batches 6–7). Shared nav
component: `components/affiliate/affiliate-nav.tsx` — check this once, it affects every row
below.

If this batch feels too large for one session, split it at row 42
(`/affiliate/dashboard` overview) into "Affiliate Dashboard Suite" (35–42) and "Affiliate
Public/Onboarding" (43–48).

## Rows

| No. | Page Name                             | Route                                  | Codebase 1 file                                                                                                                                                                                                                                                                                                                                            | Codebase 2 file                                    |
| --- | ------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 35  | Affiliate Code Inventory              | `/affiliate/dashboard/code-inventory`  | evidence → `app/api/affiliate/dashboard/code-inventory/route.ts`; locate page at `app/affiliate/dashboard/code-inventory/page.tsx`                                                                                                                                                                                                                         | `app/affiliate/dashboard/code-inventory/page.tsx`  |
| 36  | Affiliate Dashboard - Referral Codes  | `/affiliate/dashboard/codes`           | `app/affiliate/dashboard/codes/page.tsx`                                                                                                                                                                                                                                                                                                                   | `app/affiliate/dashboard/codes/page.tsx`           |
| 37  | Affiliate Dashboard - Commissions     | `/affiliate/dashboard/commissions`     | evidence → `prisma/non-market-data/schema.prisma`; locate page at `app/affiliate/dashboard/commissions/page.tsx`                                                                                                                                                                                                                                           | `app/affiliate/dashboard/commissions/page.tsx`     |
| 38  | Affiliate Payouts / Transfer Status   | `/affiliate/dashboard/payouts`         | evidence → `prisma/non-market-data/schema.prisma`; locate page at `app/affiliate/dashboard/payouts/page.tsx`                                                                                                                                                                                                                                               | `app/affiliate/dashboard/payouts/page.tsx`         |
| 39  | Affiliate Dashboard - Payment Setup   | `/affiliate/dashboard/profile/payment` | evidence → `app/affiliate/dashboard/layout.tsx`; locate page at `app/affiliate/dashboard/profile/payment/page.tsx`                                                                                                                                                                                                                                         | `app/affiliate/dashboard/profile/payment/page.tsx` |
| 40  | Affiliate Dashboard - Partner Profile | `/affiliate/dashboard/profile`         | `app/affiliate/dashboard/profile/page.tsx`                                                                                                                                                                                                                                                                                                                 | `app/affiliate/dashboard/profile/page.tsx`         |
| 41  | Affiliate - Monthly Statements        | `/affiliate/dashboard/statements`      | `app/affiliate/dashboard/statements/page.tsx`                                                                                                                                                                                                                                                                                                              | `app/affiliate/dashboard/statements/page.tsx`      |
| 42  | Affiliate Portal Dashboard            | `/affiliate/dashboard`                 | `app/affiliate/dashboard/page.tsx`                                                                                                                                                                                                                                                                                                                         | `app/affiliate/dashboard/page.tsx`                 |
| 43  | Affiliate Join                        | `/affiliate/join`                      | `app/affiliate/join/page.tsx`                                                                                                                                                                                                                                                                                                                              | `app/affiliate/join/page.tsx`                      |
| 44  | Affiliate Partner Registration        | `/affiliate/register`                  | `app/affiliate/register/page.tsx`                                                                                                                                                                                                                                                                                                                          | `app/affiliate/register/page.tsx`                  |
| 45  | Affiliate - Marketing Resources       | `/affiliate/resources`                 | evidence → `app/affiliate/dashboard/resources/page.tsx` (note: C1 path has an extra `dashboard` segment — confirm whether Codebase 2's `app/affiliate/resources/page.tsx` (no `dashboard` segment) is a real URL divergence, and if so this is itself a Rule-1 URL-consistency issue worth flagging even though it wasn't asked about directly this round) | `app/affiliate/resources/page.tsx`                 |
| 46  | Affiliate Settings - Payout Options   | `/affiliate/settings/payout`           | `app/affiliate/settings/payout/page.tsx`                                                                                                                                                                                                                                                                                                                   | `app/affiliate/settings/payout/page.tsx`           |
| 47  | Affiliate Partner Verification        | `/affiliate/verify`                    | `app/affiliate/verify/page.tsx`                                                                                                                                                                                                                                                                                                                            | `app/affiliate/verify/page.tsx`                    |
| 48  | Affiliate Program Landing             | `/affiliate`                           | `app/affiliate/page.tsx`                                                                                                                                                                                                                                                                                                                                   | `app/affiliate/page.tsx`                           |

## Batch-specific notes

- **Row 45 is flagged above for a possible URL-structure mismatch** (`/affiliate/dashboard/resources`
  in Codebase 1 vs `/affiliate/resources` in Codebase 2, per the evidence-column paths) —
  verify this first before anything else in this batch, since a route-path mismatch is a
  bigger Rule-1 problem than any visual difference, and confirm whether it's real or just an
  artefact of how the evidence column was filled in.
- `wise-recipient-form.tsx` (shared component, used somewhere in the payment/payout flow —
  rows 38, 39, or 46) handles third-party payout integration (Wise); compare its field set
  against Codebase 1's equivalent payout form carefully, this is real functional logic, not
  content.
- Commission/payout/statement pages (37, 38, 41) are data-table-heavy — Rule-1 check should
  cover table columns, filters, and any export/download actions Codebase 1 offers, not just
  overall page structure.

## Findings

_(Append here per row: what was wrong, what changed, file(s) touched.)_
