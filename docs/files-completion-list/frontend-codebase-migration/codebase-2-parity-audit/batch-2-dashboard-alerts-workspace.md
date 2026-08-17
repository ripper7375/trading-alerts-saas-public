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

Session date: 2026-08-17. Confirmed Batch 0 (shared shell) already landed. All 5 in-scope
rows (49, 50, 51, 68, 87) reviewed field-by-field against Codebase 1's real, currently-live
page/component (not just the xlsx evidence pointer) before making any change; every edit was
re-verified live via the seed-code dev server (`npm run dev` on port 3009) using the browser
tool, not just `tsc`/build.

### Rows 55, 56, 59 — retired chart-workspace routes (confirm-only, no build)

Confirmed `app/charts` and any `app/**/charts*` route do not exist anywhere under
`seed-code/trading-conversational-ai-ui-pages-increment/app` (`find ... -iname "*charts*"`
returned nothing). Confirmed no component under `components/` or route under `app/` contains
a `/charts` string reference (grepped both trees) — no dead links to clean up. No files
touched, matches the master plan's "retired, don't build" instruction.

### Rows 57, 58, 62 — Protected (`/terminal`, `/free`, `/dashboard`)

Not opened. No files under `app/terminal`, `app/free`, or `app/(dashboard)/dashboard`
(wherever that route resolves) were read or touched for editing purposes — only referenced
read-only to confirm they exist as valid `Link` targets for row 51's new "View chart" button
(see below), which does not alter how those pages themselves render.

### Row 86 — `/test-api` (retirement flag only, not polished)

Confirmed `seed-code/.../app/test-api/page.tsx` still exists and Codebase 1's own
`app/test-api/` is genuinely gone (per master plan §2, an earlier monolith session deleted
it for zero real consumers). No Codebase-1 counterpart exists to diff against, so no Rule-1
or Rule-2 work was attempted here. **Flagging as a retirement candidate for Davin** —
recommend deleting `app/test-api/` from Codebase 2 in a future session once Davin confirms,
matching Codebase 1's own precedent. Not deleted in this session (master plan says leave the
deletion decision to Davin unless authorized directly).

### Row 51 — Alerts Management (`/alerts`)

**Rule-1 gaps found (all fixed):**

- Codebase 2's `AlertList` (`components/alerts/alert-list.tsx`) had no way to reach the Edit
  Alert page at all — no Edit button/link anywhere in the row, even though row 49's real page
  (`app/(dashboard)/alerts/[id]/edit/page.tsx`) exists and is otherwise fully built. Codebase
  1's `alerts-client.tsx` has an explicit `Edit` button per card linking to
  `/alerts/[id]/edit`. Fixed: added a `Pencil`-icon button per row linking to
  `/alerts/${alert.id}/edit`.
- Delete had no confirmation step — clicking the trash icon deleted the alert immediately.
  Codebase 1's `alerts-client.tsx` gates delete behind a confirmation dialog ("Delete Alert?
  ... This action cannot be undone."). Fixed: added a dark-themed `AlertDialog` (component
  already existed in `components/ui/alert-dialog.tsx`, unused until now) confirming before
  delete; verified live — clicking Delete opens the dialog with the correct alert name
  interpolated, Cancel closes without deleting, confirming removes the row.
- No "View Chart" action existed on any alert row. Codebase 1's card has a "View Chart"
  button routing to `/charts/[symbol]/[timeframe]` — but that route is permanently retired in
  Codebase 2 (rows 55/56/59). Since this is a single-symbol (XAUUSD-only) platform and
  `/terminal` is the PRO trading workspace that replaced the old per-symbol chart route,
  added a `LineChart`-icon "View chart" button per row linking to `/terminal` as the
  functionally-equivalent destination — does not modify `/terminal` itself (Protected, row
  57), only links to it.
- `Trash2` delete button had no `aria-label`; new Edit/View-chart/Delete icon buttons all
  carry proper `aria-label`s (verified in the accessibility tree via the browser tool).

**Confirmed as intentional DavinTrade design, not a gap (no fix needed):** the combined
status-tabs-and-symbol-filter UI from Codebase 1 (`Active/Paused/Triggered/All` tabs +
symbol dropdown + search box) is represented differently in Codebase 2 (a single active-toggle
`Switch` per row + one filter text box) — this is a legitimate alternate presentation of the
same underlying capability (toggle pause/resume, filter alerts), not a missing element, and
matches the master plan §1 guidance that Rule 1 is about capability parity, not literal
layout replication.

**Files touched:** `components/alerts/alert-list.tsx`.

### Rows 49 & 50 — Edit Alert / Create New Alert forms

Compared field-by-field per the batch's own hint (symbol picker, threshold type, drawn-line
rule config, notification channel toggles) against Codebase 1's real live pages
(`app/(dashboard)/alerts/new/create-alert-client.tsx` + `components/alerts/alert-form.tsx`
used by `EditAlertClient` — note Codebase 1 itself has two parallel form implementations;
`create-alert-client.tsx` is the one actually mounted by `new/page.tsx`, `AlertForm` is the
one actually mounted by `edit-alert-client.tsx`).

**No Rule-1 gaps found — all 4 hinted fields present and working in Codebase 2:**

- Symbol picker: present (Codebase 2 correctly locks to the single XAUUSD symbol, matching
  Codebase 1's own V8 single-symbol-platform behaviour on the create page).
- Threshold/condition type: present, as a `Select` (`components/alerts/alert-form.tsx`) and
  as a `Select` labelled "Condition Direction" (edit page) — richer taxonomy than Codebase
  1's 3 plain radio options, but a superset, not a gap (Rule 1 allows DavinTrade-only
  richness per master plan §1).
- Drawn-line rule config: present as a selectable "Drawing Line Alert"/`CROSS` condition
  option — Codebase 1's own alert-creation form (`alert-form.tsx`/`create-alert-client.tsx`)
  never exposed line-drawing config in the form itself either (that's a separate
  `LineAlertsController` flow attached from the chart's drawing tool, confirmed via
  `lib/operation-service/flags.ts` + `lib/api/generated/operation-api/schema.ts` in Codebase
  1. — so Codebase 2 representing it as a condition-type option is not a structural
     regression from anything Codebase 1's form itself did.
- Notification channel toggles: present (Email/In-App on create; In-App/Sound/Webhook on
  edit) — Codebase 1's real forms don't have channel toggles on the alert form at all, so
  this is a DavinTrade-only addition, not a required-and-missing element.

**Observed, not a gap:** Codebase 1's edit form locks Symbol/Timeframe/Condition Type after
creation ("can't be changed after creation — delete and recreate instead") and only submits
`name`+`targetValue`; Codebase 2's edit page allows editing every field. This is _more_
capability, not less, so it is not a Rule-1 violation — noted here for Davin's awareness in
case the immutability rule was meant to be a deliberate business constraint carried into
Codebase 2's copy later, but not changed in this session (no instruction to restrict
functionality, and doing so wasn't requested).

**Files touched:** none (both forms already met Rule 1 for the hinted fields; the only real
gap affecting these two pages — no way to reach the Edit page from the list — is fixed under
Row 51 above).

### Row 68 — Notifications Centre (`/notifications`)

**Rule-1 gaps found (all fixed):**

- No delete action on any notification — the `Trash2` icon was imported but never used
  anywhere in the component. Codebase 1's `NotificationList`
  (`components/notifications/notification-list.tsx`) has a delete button per item plus an
  "Undo" banner (5s auto-hide) matching the same pattern already used in this batch's own
  `alerts-client.tsx`/`alert-list.tsx`. Fixed: added a delete button (now actually using the
  imported `Trash2`) with `e.stopPropagation()` so it doesn't also trigger mark-as-read, plus
  a matching Undo banner/timeout. Verified live: deleting removes the item and shows "Notification
  '...' deleted" with a working Undo button; confirmed the item count and unread count update
  correctly.
- Type-filter tabs didn't cover all 4 notification categories that exist in the data model.
  Codebase 1 has explicit filter buttons for all 4 of its types (`ALERT`/`SUBSCRIPTION`/
  `PAYMENT`/`SYSTEM`). Codebase 2's `NotificationItem.category` is `ALERT | SYSTEM | BILLING
| SECURITY` but the tab row only offered `All/Unread/Signals(=ALERT)/System` — there was no
  way to filter to only `BILLING` or `SECURITY` notifications even though seed data contains
  both. Fixed: added `Billing` and `Security` filter tabs (and, since Codebase 1 also has an
  explicit status filter Codebase 2 lacked, a `Read` tab alongside the existing `Unread`).
  Verified live: all 7 tabs (`All/Unread/Read/Signals/System/Billing/Security`) render and the
  seed data's 4 categories are all reachable.

**Flagged, not fixed (lower priority, judgment call):** Codebase 1 has working pagination
(`Previous`/`Next`, `Page X of Y`) for a real, page-sized `/api/notifications` result set.
Codebase 2's notification list is a fixed 4-item local seed array with no backend — building
full pagination UI for a permanently-4-item demo list would be speculative scaffolding with
nothing to page through, so left as a documented gap rather than built. If Davin wants
pagination scaffolding added anyway (e.g. for visual parity even with only 4 items), flag for
a follow-up session.

**Files touched:** `app/(dashboard)/notifications/page.tsx`.

### Row 87 — Upgrade Success (`/upgrade/success`)

**Rule-1 gap found (fixed):** Codebase 1's real page (`app/upgrade/success/page.tsx`) always
shows a "Confirming your upgrade..." loading state before the success view — the upgrade
confirmation is a genuine async flow step (waiting on `GET /api/subscription` since Stripe's
webhook can lag). Codebase 2's version rendered the success view unconditionally and
instantly, skipping that flow step entirely. Fixed: added a brief (~900ms) simulated
"Confirming your upgrade..." loading state before the success view, using the same
`setTimeout`-based simulated-async pattern already established elsewhere in this codebase
(e.g. `components/alerts/alert-form.tsx`'s own submit handler) rather than introducing a new
pattern. Verified live: reloading `/upgrade/success` shows the loading spinner first, then
transitions to the "Welcome to DavinTrade PRO!" success view.

**Flagged, not fixed (judgment call, out of scope for this session):** Codebase 1 also has a
genuine "Finishing up your upgrade" _pending_ state (payment succeeded but webhook hasn't
landed yet, with a "Check Again" retry button) and an authenticated-session redirect gate.
Codebase 2 has no backend/session layer anywhere in this increment (confirmed: no other page
audited in this batch calls a real API for its primary data either), so simulating a
webhook-delay failure mode here would be inventing a fake failure path with nothing behind
it — deliberately left undone rather than building speculative error-state UI. The
loading→success transition (the actual "flow step" gap) is fixed; the payment-provider-lag
edge case is noted for Davin in case a future session wires this page to a real
subscription-status check.

**Files touched:** `app/upgrade/success/page.tsx`.

## Verification

- `npx tsc --noEmit` — clean, no errors, run from
  `seed-code/trading-conversational-ai-ui-pages-increment`.
- `npx next build` — compiled successfully, all 88 routes generated including
  `/alerts`, `/alerts/[id]/edit`, `/alerts/new`, `/notifications`, `/upgrade/success`,
  `/test-api` (still present, unmodified, per the retirement-flag-only instruction).
- `eslint` — not runnable for this sub-project (`eslint .` reports every file ignored; no
  `eslint.config.*` exists under `seed-code/trading-conversational-ai-ui-pages-increment`).
  Pre-existing environment gap, not introduced by this session — not required by the master
  plan's own verification instruction (§3.6 only calls out `tsc`/build), so not blocking.
- Live-verified all 3 edited pages via `npm run dev` (port 3009) + the browser tool: alerts
  list (Edit/Delete/View-chart buttons + delete confirmation dialog + live delete), edit-alert
  navigation from the list, notifications (all 7 filter tabs + delete + undo banner), and
  upgrade-success (loading state → success transition). No console errors on any page.
- No files modified outside `seed-code/trading-conversational-ai-ui-pages-increment`.

**Files touched this session:**

- `seed-code/trading-conversational-ai-ui-pages-increment/components/alerts/alert-list.tsx`
- `seed-code/trading-conversational-ai-ui-pages-increment/app/(dashboard)/notifications/page.tsx`
- `seed-code/trading-conversational-ai-ui-pages-increment/app/upgrade/success/page.tsx`
