# Batch 4 — Marketing, Legal & Commerce Pages

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first
> (shared public-page header from `components/header.tsx`).

## Scope

15 xlsx rows, but **1 is Protected (see `00-MASTER-PLAN.md` §0) — only 14 are actually in
scope**: public marketing/legal content pages plus the pricing → checkout commerce flow.
Most of these are simple static/mostly-static content pages in Codebase 1 — expect Rule-2
(DavinTrade restyling) to dominate the findings here more than Rule-1 gaps, except for
pricing/checkout where real form/flow logic exists.

## Rows

| No. | Page Name                      | Route              | Codebase 1 file                                                                                                            | Codebase 2 file                                                                         |
| --- | ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Landing Page                   | `/`                | —                                                                                                                          | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 2   | About                          | `/about`           | `app/(marketing)/about/page.tsx`                                                                                           | `app/about/page.tsx`                                                                    |
| 52  | Blog                           | `/blog`            | `app/(marketing)/blog/page.tsx`                                                                                            | `app/blog/page.tsx`                                                                     |
| 53  | Careers                        | `/careers`         | `app/(marketing)/careers/page.tsx`                                                                                         | `app/careers/page.tsx`                                                                  |
| 54  | Changelog                      | `/changelog`       | `app/(marketing)/changelog/page.tsx`                                                                                       | `app/changelog/page.tsx`                                                                |
| 60  | Payment Return / Status        | `/checkout/return` | evidence → `app/checkout/page.tsx` (check for a dedicated return/status sub-page or a query-param branch in the same file) | `app/checkout/return/page.tsx`                                                          |
| 61  | Checkout Page                  | `/checkout`        | `app/checkout/page.tsx`                                                                                                    | `app/checkout/page.tsx`                                                                 |
| 63  | Risk Disclaimer                | `/disclaimer`      | `app/(marketing)/disclaimer/page.tsx`                                                                                      | `app/disclaimer/page.tsx`                                                               |
| 64  | Documentation                  | `/docs`            | `app/(marketing)/docs/page.tsx`                                                                                            | `app/docs/page.tsx`                                                                     |
| 66  | Help Centre (public)           | `/help`            | `app/(marketing)/help/page.tsx`                                                                                            | `app/help/page.tsx`                                                                     |
| 69  | Pricing Page                   | `/pricing`         | `app/(marketing)/pricing/page.tsx`                                                                                         | `app/pricing/page.tsx`                                                                  |
| 70  | Privacy Policy (public)        | `/privacy`         | `app/(marketing)/privacy/page.tsx`                                                                                         | `app/privacy/page.tsx`                                                                  |
| 84  | System Status                  | `/status`          | `app/(marketing)/status/page.tsx`                                                                                          | `app/status/page.tsx`                                                                   |
| 85  | Terms of Service (public)      | `/terms`           | `app/(marketing)/terms/page.tsx`                                                                                           | `app/terms/page.tsx`                                                                    |
| 95  | Welcome / First-run Onboarding | `/welcome`         | **No C1 counterpart ("Proposed / Pending Creation")**                                                                      | `app/welcome/page.tsx` — Rule 2 only                                                    |

## Batch-specific notes

- **Row 1 (landing page) is Protected — do not open it expecting work.** It's cited in
  `00-MASTER-PLAN.md` §1 only as the worked example of "Codebase 2 is a DavinTrade superset,
  not a stripped-down replica" (illustrating the general design philosophy the other 13
  in-scope pages in this batch should follow) — Davin has separately confirmed it's already
  finished, so treat it as reference material only, never as an edit target.
- Rows 60/61 (checkout flow): this is the one pair in this batch with real transactional
  logic (multi-currency, dLocal/UK payment providers per this repo's own docs) — give the
  form fields, payment-method selection, and success/return-status handling the same
  field-by-field Rule-1 check as a settings form, not just a visual pass.
- Row 84 (`/status`) is also referenced by row 91 in Batch 8 (an admin-sidebar nav card
  linking to it) — if you find a structural issue with the status page itself, note it here;
  if it's specifically about the admin sidebar's link to it, that belongs in Batch 8's
  findings instead.
- Row 95 (`/welcome`) has no Codebase-1 page to match — Rule 1 N/A, Rule 2 only. This is a
  first-run onboarding flow unique to DavinTrade.
- The remaining rows (About, Blog, Careers, Changelog, Disclaimer, Docs, Help, Privacy,
  Terms) are mostly static content — Rule-1 check is mainly "does the same set of
  sections/links exist," Rule-2 check is "does it use DavinTrade dark theme + tokens
  instead of Codebase 1's plain light styling."

## Findings

_(Append here per row: what was wrong, what changed, file(s) touched.)_
