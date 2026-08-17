# Batch 3 — Settings Suite

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.

## Scope

11 xlsx rows under `/settings/*`, but **2 are Protected (see `00-MASTER-PLAN.md` §0) — only
9 are actually in scope**. Both codebases have a shared settings layout wrapper — compare
`app/(dashboard)/settings/layout.tsx` between codebases first (it drives the settings
sub-nav shared by every row below, including the 2 protected ones — see note below) before
diffing individual pages.

## Rows

| No. | Page Name                          | Route                         | Codebase 1 file                                                                                                                                                                                                                                                                | Codebase 2 file                                                                         |
| --- | ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 73  | Settings - Account Management      | `/settings/account`           | `app/(dashboard)/settings/account/page.tsx`                                                                                                                                                                                                                                    | `app/(dashboard)/settings/account/page.tsx`                                             |
| 74  | Settings - Appearance & Theme      | `/settings/appearance`        | —                                                                                                                                                                                                                                                                              | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 75  | Settings - Billing & Subscriptions | `/settings/billing`           | `app/(dashboard)/settings/billing/page.tsx`                                                                                                                                                                                                                                    | `app/(dashboard)/settings/billing/page.tsx`                                             |
| 76  | Settings - Help & Support          | `/settings/help`              | —                                                                                                                                                                                                                                                                              | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 77  | Settings - Language & Region       | `/settings/language`          | `app/(dashboard)/settings/language/page.tsx`                                                                                                                                                                                                                                   | `app/(dashboard)/settings/language/page.tsx`                                            |
| 78  | Settings - Privacy & Data          | `/settings/privacy`           | `app/(dashboard)/settings/privacy/page.tsx`                                                                                                                                                                                                                                    | `app/(dashboard)/settings/privacy/page.tsx`                                             |
| 79  | Settings - User Profile            | `/settings/profile`           | `app/(dashboard)/settings/profile/page.tsx`                                                                                                                                                                                                                                    | `app/(dashboard)/settings/profile/page.tsx`                                             |
| 80  | Security Activity Log              | `/settings/security/activity` | evidence → `lib/security/device-detection.ts`; the actual page should be at `app/(dashboard)/settings/security/activity/page.tsx` (built per this repo's own migration history — check there directly, the evidence column is pointing at a supporting lib file, not the page) | `app/(dashboard)/settings/security/activity/page.tsx`                                   |
| 81  | Settings - Security & 2FA          | `/settings/security`          | `app/(dashboard)/settings/security/page.tsx`                                                                                                                                                                                                                                   | `app/(dashboard)/settings/security/page.tsx`                                            |
| 82  | Settings - Terms of Service        | `/settings/terms`             | `app/(dashboard)/settings/terms/page.tsx`                                                                                                                                                                                                                                      | `app/(dashboard)/settings/terms/page.tsx`                                               |
| 83  | User Settings Overview             | `/settings`                   | `app/(dashboard)/settings/page.tsx`                                                                                                                                                                                                                                            | `app/(dashboard)/settings/page.tsx`                                                     |

## Batch-specific notes

- 9 of the 11 rows have a real, dual-existing Codebase-1 counterpart — full Rule 1 + Rule 2
  applies to those 9. **Rows 74 and 76 are Protected — skip them entirely,** including not
  screenshot-comparing or opening their source files expecting to find work.
- The settings sub-nav is shared by all 11 pages, including the 2 protected ones — if a
  Rule-1/Rule-2 fix to the shared nav/layout would change how `/settings/appearance` or
  `/settings/help` render (e.g. a new tab item appearing on their page too), that's fine
  since it's a side effect of a shared component, not a direct edit to those pages — but if
  you find yourself editing something _specific_ to either page's own content, stop.
- Row 80's Free-tier screenshot cell in the xlsx reads "Not available" for Codebase 1 (Free
  tier may not have access to security activity log there) — check whether Codebase 2 gates
  this the same way; if Codebase 2 exposes it to Free-tier where Codebase 1 doesn't, that's
  itself a Rule-1 flow mismatch worth flagging (over-exposure, not just under-exposure,
  counts).
- The settings sub-nav (sidebar/tabs listing all 10 sub-pages) is the single highest-leverage
  thing to get right first in this batch — if it's missing an item, missing a route, or
  ordered differently in a way that breaks a user's expected flow, every downstream page
  inherits that gap.

## Findings

_(Append here per row: what was wrong, what changed, file(s) touched.)_
