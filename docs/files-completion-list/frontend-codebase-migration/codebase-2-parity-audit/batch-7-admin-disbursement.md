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

_(Append here per row: what was wrong, what changed, file(s) touched.)_
