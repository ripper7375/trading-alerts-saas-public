# Batch 2 — Dashboard, Alerts & Trading Workspace

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.

## Scope

12 xlsx rows, but **3 are Protected (see `00-MASTER-PLAN.md` §0) — only 9 are actually in
scope**: the alert management pages, the retired/replaced chart-workspace rows, notifications,
upgrade confirmation, and the `/test-api` retirement flag.

## Rows

| No. | Page Name                            | Route                          | Codebase 1 file                                                                                               | Codebase 2 file                                                                         |
| --- | ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 49  | Edit Alert                           | `/alerts/[id]/edit`            | evidence → `app/api/alerts/[id]/route.ts`; locate real page at `app/(dashboard)/alerts/[id]/edit/page.tsx`    | `app/(dashboard)/alerts/[id]/edit/page.tsx`                                             |
| 50  | Create New Alert                     | `/alerts/new`                  | evidence → `components/alerts/alert-form.tsx`; page at `app/(dashboard)/alerts/new/page.tsx`                  | `app/(dashboard)/alerts/new/page.tsx`                                                   |
| 51  | Alerts Management                    | `/alerts`                      | `app/(dashboard)/alerts/page.tsx`                                                                             | `app/(dashboard)/alerts/page.tsx`                                                       |
| 55  | Trading Chart Workspace (XAUUSD M5)  | `/charts/[symbol]/[timeframe]` | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`                                                        | **Retired — do not build. Confirm still absent.**                                       |
| 56  | Trading Chart Workspace (XAUUSD M15) | `/charts/[symbol]/[timeframe]` | same file as row 55                                                                                           | **Retired — do not build. Confirm still absent.**                                       |
| 57  | Trading Chart Workspace (TERMINAL)   | `/terminal`                    | —                                                                                                             | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 58  | Trading Chart Workspace (FREE)       | `/free`                        | —                                                                                                             | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 59  | Charts Workspace Overview            | `/charts`                      | `app/(dashboard)/charts/page.tsx`                                                                             | **Retired — do not build. Confirm still absent.**                                       |
| 62  | Main User Dashboard                  | `/dashboard`                   | —                                                                                                             | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 68  | Notifications Centre                 | `/notifications`               | evidence → `components/notifications/notification-bell.tsx`; page at `app/(dashboard)/notifications/page.tsx` | `app/(dashboard)/notifications/page.tsx`                                                |
| 86  | API Test Scratch Page                | `/test-api`                    | **Deleted — confirmed absent from `app/test-api/` in Codebase 1**                                             | `app/test-api/page.tsx` — **flag for retirement, don't polish**                         |
| 87  | Upgrade Success Confirmation         | `/upgrade/success`             | evidence → `app/api/checkout/route.ts`; locate real page under `app/upgrade/success/page.tsx` or equivalent   | `app/upgrade/success/page.tsx`                                                          |

## Batch-specific notes

- **Rows 55/56/59**: per `00-MASTER-PLAN.md` §2 these are permanently retired in Codebase 2,
  replaced by `/terminal` (57) and `/free` (58). Your job here is just to confirm
  `app/charts` doesn't exist anywhere in Codebase 2 and that nothing links to it (check nav
  components from Batch 0 don't have dead links to `/charts/*`). Do not create these routes.
- **Rows 57, 58, 62 (`/terminal`, `/free`, `/dashboard`) are Protected — do not open them
  expecting work.** Davin confirmed 2026-08-17 these are already fully designed. Skip them
  entirely; if `components/trading-chart.tsx`, `components/chat-panel.tsx`, or
  `components/market-comments-panel.tsx` also happen to be shared by other Batch-2 pages,
  it's fine to touch those files for a non-protected page's sake — just don't let that
  change alter how `/terminal`, `/free`, or `/dashboard` themselves render, and flag it if
  you can't avoid that.
- **Row 86 (`/test-api`)**: this is a dev-only scratch page. Codebase 1's copy was already
  deleted by an earlier session for having zero real consumers (confirmed on disk). Don't
  spend time making Codebase 2's version match a page that no longer exists — instead note
  in your findings that it's a retirement candidate, matching Codebase 1's precedent, and
  leave the actual deletion decision to Davin unless the master plan is updated to authorize
  it directly.
- Alert rows (49–51): compare the alert-rule creation/edit form fields (symbol picker,
  threshold type, drawn-line rule config, notification channel toggles) field-by-field
  against Codebase 1 — this is a good example of a "core interactive element" check under
  Rule 1 that's easy to under-verify from a screenshot alone (open both source files).

## Findings

_(Append here per row: what was wrong, what changed, file(s) touched.)_
