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

### Shared settings shell (layout.tsx, both codebases) — audited, not modified

Compared `app/(dashboard)/settings/layout.tsx` between codebases. Codebase 2's sub-nav
(9 items: Profile, Appearance, Security & 2FA, Billing & Invoices, Privacy & Data,
Language & Region, Help & Support, Terms & Disclosures, Account & Deletion) is a
structural superset of Codebase 1's 8-item nav (missing only a dedicated "Terms" tab,
which C1 doesn't surface as a tab either — see row 82). No Rule-1 gap in the nav itself.

Noticed the shared layout and `components/layout/app-header.tsx` hardcode DavinTrade's
amber accent (`amber-400`/`amber-500` Tailwind classes) rather than the dynamic
`--accent` CSS variable (`app/globals.css`) that changes with the user's Appearance →
Accent Scheme selection. This is a real Rule-2 question, but it's a **codebase-wide**
convention — `app-header.tsx` (shared shell, owned by Batch 0) does the same thing, so
this settings layout is consistent with, not deviant from, the rest of the app. Per this
batch's own instruction ("if a shared-nav fix would change how either protected page
renders, stop and flag it"), **not touched** — flagging for a dedicated
accent-token pass across the whole shell if Davin wants it, rather than a one-off fix
here that would only apply to `/settings/*`.

**No file changes in this section** (audit only).

### Row 73 — `/settings/account` (Rule-1: major gaps found and fixed)

Codebase 1's account page (`account-settings-client.tsx`) has 4 sections Codebase 2's
`account/page.tsx` was completely missing: **Change Password** (form with
show/hide toggles), **Two-Factor Authentication** (entry-point card linking out to
`/settings/security`), **Active Sessions** (device list with per-session revoke), and a
**typed "DELETE"-confirmation gate** before the deletion request actually fires (C2 had
only a single unguarded click). C2's existing "Request Data Archive" button also had no
`onClick` at all — clicking it did nothing.

Added all 4 missing sections/behaviors, matching this codebase's own established
mock-interactivity convention (local `useState` + timeout-reset "Saved!" button text,
same pattern already used on `profile.tsx`/`privacy.tsx`) since Codebase 2 has no
backend (`app/api/` doesn't exist in this repo) to wire real requests to. The deletion
flow now opens a `Dialog` requiring the literal string `DELETE` before the "Delete
Account" button enables — verified live (typed DELETE → button enabled → scheduled-
deletion state shown), matching C1's own confirm-to-avoid-fumble-fingering pattern.
Kept C2's DavinTrade-styled grace-period messaging as-is (superset styling, not a
defect).

**Files touched:** `app/(dashboard)/settings/account/page.tsx` (full rewrite, still a
single client component — C1 splits server/client but C2 has no server/session layer to
split on).

### Row 75 — `/settings/billing` (Rule-1 + Rule-2: fixed)

**Confirmed via live screenshot** (`codebase-2-free/row_75_...png` vs.
`codebase-1-free/row_75_...png`) that Codebase 2's billing page **always** renders an
active "PRO PLAN ACTIVE" badge with 3 paid invoices, regardless of tier — even the
screenshot captured under the "free" tier folder shows a fabricated PRO subscription.
Codebase 1 shows a real FREE-tier upgrade-prompt view (feature list + "Upgrade to PRO"
CTA, no invoices) for FREE users. This was the clearest, most visually-verifiable
Rule-1 defect in the batch.

Added the missing FREE-tier branch to `SubscriptionCard` (feature comparison list,
"Upgrade to PRO" + "Start 7-Day Free Trial" CTAs to `/pricing`, no fabricated invoice
data), gated behind a new `tier?: 'FREE' | 'PRO'` prop (default `'PRO'`, preserving
existing behavior for all current call sites).

**Known limitation, flagged not silently fixed:** Codebase 2 has no session/auth layer
and no cross-page tier-detection mechanism for the shared `/settings/*` route tree.
The only existing tier-simulation idiom in this codebase
(`usePathname().startsWith('/free')`, used by `app/(dashboard)/alerts/page.tsx` and
`components/layout/app-header.tsx`'s own `tier` prop) only works for pages actually
nested under the `/free` route — `/settings/billing` is not, so there is currently no
live signal that would ever pass `tier="FREE"` in production navigation. The missing
UI now **exists and is correct**, but nothing calls it with `tier="FREE"` yet. Closing
this fully would need a cross-app "current simulated tier" mechanism (e.g., a cookie
set on `/free` entry, read by `/settings/*`) — an architectural decision beyond one
settings-page file, flagged for Davin/a future session rather than invented here.

Also fixed the **double `<AppHeader>` bug** on this page (see cross-cutting section
below) and left the invoice-row "Download" icon button unwired (no real PDF exists to
download in this frontend-only codebase; C1's own equivalent downloads a real
Stripe-hosted PDF URL that has no C2 counterpart to fetch — lower priority than the
tier-branch defect, not fixed this session).

**Files touched:** `app/(dashboard)/settings/billing/page.tsx`,
`components/billing/subscription-card.tsx`.

### Cross-cutting: double `<AppHeader>` bug on 4 rows (Rule-1/Rule-2, fixed)

**Confirmed live** (both via the deployed site and the local dev server) that
`account/page.tsx`, `billing/page.tsx`, `profile/page.tsx`, and `security/page.tsx` each
rendered their **own** `<AppHeader>` + full-height wrapper `<div>` + `<main>` INSIDE the
content area that `app/(dashboard)/settings/layout.tsx` already wraps in its own
`<AppHeader>` — producing two stacked header/nav bars on every one of these 4 pages
(visible on the live site: a second "DavinTrade > Billing & Invoices ... Main Dashboard /
AI Analyst Workspace / Real-Time Alerts ... GB GB Trader User" bar duplicated inside the
page body). `language.tsx`, `privacy.tsx`, `terms.tsx`, `security/activity/page.tsx`, and
the settings root already followed the correct pattern (no page-level `AppHeader`).

Removed the duplicate `<AppHeader>`/wrapper/`<main>` from all 4 affected pages so they
render their content directly inside the layout's own content slot, matching the
already-correct pages. Re-verified all 4 routes on the local dev server after the fix —
single header/breadcrumb/nav on each, content otherwise unchanged.

**Files touched:** `account/page.tsx`, `billing/page.tsx`, `profile/page.tsx`,
`security/page.tsx` (all under `app/(dashboard)/settings/`).

### Row 77 — `/settings/language` — no gaps found

Already a full, working superset of C1: every C1 field (language, timezone, date/time
format, currency) present and wired to real `useLocale()` context state (live-updating
formatted previews), plus DavinTrade-specific dLocal-market language/currency options.
No Rule-1 or Rule-2 defects. **No file changes.**

### Row 78 — `/settings/privacy` — no gaps found

Already a full, working superset of C1: profile visibility radio group, both data-
sharing toggles (show stats / show email), and a GDPR data-export flow with mocked
loading/success states — all present and matching C1's structure. **No file changes.**

### Row 79 — `/settings/profile` (Rule-1: fixed)

C1's profile page has `username`, `bio`, and `company` fields that C2 was missing
entirely (C2 only had Display Name + Email, plus DavinTrade-specific Timezone/Trading-
Experience fields that C1 doesn't have — kept as a valid superset). Added the 3 missing
fields with the same local-state pattern as the rest of the form. Also fixed the double
`<AppHeader>` bug (see cross-cutting section above).

**Files touched:** `app/(dashboard)/settings/profile/page.tsx`.

### Row 80 — `/settings/security/activity` (Rule-1: gap found and fixed; one item flagged)

Codebase 1's `/settings/security/activity` is a **security event log** (password
changes, 2FA enabled/disabled, new-device logins, suspicious-login flags) — a
completely different concept from what Codebase 2 built at the same URL, which is an
**active-sessions list** (device/browser/location, revoke). Neither codebase's page was
"wrong" in isolation, but C2 was missing the event-log content entirely, and nowhere
else in C2's settings suite has it either.

Added a "Security Event Log" section to this page (mock data: new-device login,
password changed, 2FA enabled) rather than replacing the existing sessions content —
the sessions UI here is still functional and reasonably matches what C1 puts on
`/settings/account` instead (also now present there, see row 73), so keeping both
avoids deleting working functionality while closing the specific missing-content gap.

**Flagged, not fixed:** the batch notes ask whether C2 exposes this page to Free-tier
where C1's xlsx cell says "Not available." Same root cause as row 75's tier-detection
gap — `/settings/*` has no live tier signal to gate on, so this cannot be verified or
fixed without the same cross-app tier-mechanism decision noted under row 75.

**Files touched:** `app/(dashboard)/settings/security/activity/page.tsx`.

### Row 81 — `/settings/security` (Rule-1: major gaps found and fixed)

Codebase 1's security page has **Security Alerts preferences** (new-device / password-
change toggles), a **Login History** section (paginated list with status badges), and a
**"Security Activity" link-out** to `/settings/security/activity` — all 3 were entirely
absent from Codebase 2. C2's existing 2FA card also had a non-functional "View Backup
Codes" button (no dialog, no `onClick`), and the Change-Password form's submit button
had no `onClick`/`onSubmit` at all.

Added all 3 missing sections, wired the backup-codes button to a real `Dialog` (mock
codes + copy-to-clipboard), wired the password form to a mock save-state submit
handler, and wired the session "Revoke" icon button (previously inert) to actually
remove the row from the local session list. Also fixed the double `<AppHeader>` bug (see
cross-cutting section above).

**Files touched:** `app/(dashboard)/settings/security/page.tsx`.

### Row 82 — `/settings/terms` — no gaps found

Codebase 1's `/settings/terms` is a bare `redirect('/terms')` — no dedicated content of
its own. Codebase 2 instead renders a full in-context Terms & Risk Disclosure page
(subscription agreement, GDPR/privacy clause, cancellation policy). This is a superset,
not a gap — C2's own public `/terms` route also still exists independently. **No file
changes.**

### Row 83 — `/settings` overview (Rule-1: major gap found and fixed)

Codebase 1's `/settings` root is a full landing page: current plan/tier card with usage
stats and an upgrade prompt for FREE users, plus a grid of quick-link cards to every
sub-settings page. Codebase 2's `/settings/page.tsx` was a bare client-side
`router.replace('/settings/profile')` with `return null` — no content of its own at all,
just an invisible redirect.

Replaced the redirect with a real overview page: a plan-summary card (same PRO-default
tier-signal limitation as row 75 — see that row's note; flagged, not re-litigated here)
and a 9-item quick-link grid to every sub-settings page (Profile, Appearance, Security &
2FA, Billing & Invoices, Privacy & Data, Language & Region, Help & Support, Terms &
Disclosures, Account & Deletion), styled to match the rest of the DavinTrade settings
suite. Verified live: renders correctly, all 9 links resolve.

**Files touched:** `app/(dashboard)/settings/page.tsx`.

## Verification

- `npx tsc --noEmit` (inside `seed-code/trading-conversational-ai-ui-pages-increment`):
  **clean, zero errors** after all changes.
- `npm run build` (`next build`): **succeeded**, all 88 routes compiled including every
  `/settings/*` route.
- `npm run lint`: **pre-existing, unrelated failure** — this project has no
  `eslint.config.*`/`.eslintrc*` file at all, so ESLint refuses to run ("all of the
  files matching the glob pattern '.' are ignored") regardless of this batch's changes.
  Not fixed here (tooling gap, out of this batch's scope — flagged for whichever session
  owns repo tooling).
- Live-verified on a local dev server (`next dev -p 3009`) for every touched route —
  `/settings`, `/settings/account`, `/settings/billing`, `/settings/profile`,
  `/settings/security`, `/settings/security/activity` — plus both Protected pages
  (`/settings/appearance`, `/settings/help`) to confirm the double-`AppHeader` fix and
  new content did not affect them (neither was touched; both still render with a single
  header, as before). Exercised the account-deletion typed-confirmation dialog
  end-to-end (open → type `DELETE` → button enables → scheduled-deletion state renders).
- Also compared against the **live deployments** named in the master plan
  (`https://trading-conversational-ai-ui-pages.vercel.app`) to confirm the double-header
  and fabricated-PRO-billing defects before fixing, and against
  `https://trading-alerts-saas-frontend.vercel.app` for the Codebase-1 reference
  behavior cited above.
