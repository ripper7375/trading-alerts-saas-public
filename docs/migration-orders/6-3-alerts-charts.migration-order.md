# Migration Order — Session 6-3 — Alerts & Charts

> For a session that **wires 3 orphan tier endpoints into the alerts UI and adds a missing
> alert-edit route** — no cross-stack PORT, no flags, no new backend endpoints (all 4 the UI
> needs already exist and are already live). Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for
> the new edit-form UI/flow, Low for data** (every read this session needs is already a real,
> live endpoint). Sourced from `docs/files-completion-list/ui-page-gap-analysis.md` rows A1-11
> and A2-4.

**Session:** 6-3 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for UI/flow, LOW for data) · **Status:** CONFIRMED · **Generated:** 2026-08-10 · **Confirmed:** 2026-08-10 (Davin, live) ·
**Flags touched:** none · **Estimated time:** ~3-5h
**Surface:** `app/(dashboard)/alerts/[id]/edit/page.tsx` (new), `components/alerts/*` (`alert-form.tsx`, `alerts-client.tsx`) · **Feeds on:** `GET /api/tier/symbols`, `GET /api/tier/combinations`, `GET /api/tier/check/[symbol]`, `GET /api/alerts/[id]`, `PATCH /api/alerts/[id]`.

---

## Context

Two rows from `docs/files-completion-list/ui-page-gap-analysis.md`, independently re-verified:

- **A1-11 (`/alerts` + `/alerts/new`):** [`components/alerts/alert-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/alerts/alert-form.tsx)'s own comment at line 70 says the form is "for creating and editing price alerts," but no `alerts/[id]/edit` route exists anywhere in the tree. Separately, 3 real, live tier endpoints have zero UI consumers: `GET /api/tier/symbols` (138 lines), `GET /api/tier/combinations` (165 lines), `GET /api/tier/check/[symbol]` (145 lines).
- **A2-4 (`/alerts/[id]/edit`):** The backing API this new route needs is already live — `GET`/`PATCH /api/alerts/[id]` (Slice 7 / Session 4B-7). Building the page is pure frontend work against an already-proven contract.

Existing pages sit at [`app/(dashboard)/alerts/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/alerts/page.tsx>) (list) and [`app/(dashboard)/alerts/new/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/alerts/new/page.tsx>) (create).

## User Review Required

> [!IMPORTANT]
> **V8 PRO Gating Preserved:** Alerts are a PRO-exclusive feature in V8 (`maxAlerts` FREE=0, PRO=100). FREE users accessing `/alerts`, `/alerts/new`, or `/alerts/[id]/edit` MUST be rendered the [`<AlertsProUpgrade />`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/alerts/alerts-pro-upgrade.tsx) landing component.

> [!IMPORTANT]
> **Tier Endpoints UX Design:**
>
> - `GET /api/tier/symbols` & `GET /api/tier/combinations` populate dynamic symbols and timeframes in `AlertForm`.
> - `GET /api/tier/check/[symbol]` runs an inline validation check when a symbol is selected in the form, providing instant feedback if the symbol is accessible.

> [!NOTE]
> **Form Component Reuse:** [`components/alerts/alert-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/alerts/alert-form.tsx) already supports `isEditing` and `initialData` props. Step 2 creates `app/(dashboard)/alerts/[id]/edit/page.tsx` and wraps `AlertForm` in edit mode without rewriting form logic.

## Entry criteria

- [x] Session 6-2 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry). Verified: `2d16e927` is the close-out commit.
- [x] A1-11 and A2-4 re-verified at CONFIRM against live code — held, with two corrections: tier-endpoint line counts are 137/164/144 (not 138/165/145 as this working copy's rewrite cited — matches the committed PRE-DRAFT's own numbers exactly); `alert-form.tsx`'s `AlertForm` component is currently **orphaned** (zero live callers anywhere in `app/`/`components/` — `/alerts/new` uses a separate hand-rolled `create-alert-client.tsx`, not `AlertForm`), so Step 1/Step 2 are this component's first real usage, not a "reuse" in the sense of an already-wired consumer.
- [x] Monolith baseline re-measured at CONFIRM — `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` → 3 warnings/0 errors (same 2 pre-existing files/lines tracked since Session 6-1, L56 — 0 new); `test:ci` → **132/132 suites, 2202/2202 tests** — exact match, zero drift.
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — working-copy rewrite (PRE-DRAFT→APPROVED, no git-verifiable DRAFT-stage trail) confirmed live by Davin as his own authentic authorization before execution began.

## Integration points

- **In:** `getServerSession()`, `GET /api/tier/*`, `GET`/`PATCH /api/alerts/[id]`.
- **Out:** No backend service changes.
- **Owns:** `app/(dashboard)/alerts/[id]/edit/page.tsx`, `components/alerts/alert-form.tsx` tier integration.

## Ordered steps

### Step 1 — Wire 3 Orphan Tier Endpoints in Alert Form (A1-11)

- Update [`components/alerts/alert-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/alerts/alert-form.tsx) and its client caller to fetch available symbols and combinations from `GET /api/tier/symbols` and `GET /api/tier/combinations`.
- Call `GET /api/tier/check/[symbol]` when a symbol is chosen to provide real-time tier access validation feedback.
- _Verify:_ Symbols and timeframes are dynamically populated from tier endpoints; invalid symbol selection displays tier warning banner.
- _Commit:_ `feat(6-3): wire tier endpoints (symbols, combinations, check) into alert form`

### Step 2 — Build `app/(dashboard)/alerts/[id]/edit/page.tsx` & Client Handler (A2-4)

- Create server component at `app/(dashboard)/alerts/[id]/edit/page.tsx`:
  - Check session & user tier (`tier !== 'PRO'` renders `<AlertsProUpgrade />`).
  - Fetch alert by ID, verify ownership (`alert.userId === session.user.id`), return 404 for missing alerts.
- Create client wrapper `edit-alert-client.tsx` passing `initialData` to `<AlertForm isEditing={true} ... />`.
- Handle form submission by calling `PATCH /api/alerts/[id]` and redirecting back to `/alerts` on success.
- _Verify:_ Direct navigation to `/alerts/[id]/edit` populates existing alert fields; updating target value calls `PATCH /api/alerts/[id]` and redirects to `/alerts`.
- _Commit:_ `feat(6-3): build /alerts/[id]/edit page and edit flow`

### Step 3 — Link Edit Action in Alerts List (`alerts-client.tsx`)

- Update [`app/(dashboard)/alerts/alerts-client.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/alerts/alerts-client.tsx>) to render an "Edit Alert" button/icon on each alert card/row linking to `/alerts/${alert.id}/edit`.
- _Verify:_ Clicking Edit button on an alert item opens `/alerts/${id}/edit` with pre-filled form.
- _Commit:_ `feat(6-3): connect edit link on alert items in alerts list`

### Step 4 — Unit Tests for Edit Route & Tier Endpoints Integration

- Add unit test file `__tests__/pages/alerts/edit.test.tsx` covering:
  - Render existing alert data in form.
  - PRO upgrade landing rendering for FREE tier users.
  - `PATCH /api/alerts/[id]` submit success and error states.
  - 404 handling for non-existent alert ID.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-3): add unit tests for alert edit route and tier endpoint integration`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** Full freedom on form layout, alert badges, status indicators, loading skeletons, and notification toasts.
- **Data Contract (Dial LOW):** Payloads for `GET`/`PATCH /api/alerts/[id]` and `/api/tier/*` must strictly match backend contracts.
- **V8 PRO Gating:** Preserve PRO-only gating (`maxAlerts` FREE=0, PRO=100).
- **A11y Standards:** Keyboard navigation and ARIA labels on all form controls and action buttons.

## Done when

- [x] All 3 orphan `/api/tier/*` endpoints (`symbols`, `combinations`, `check`) have active UI consumers — `AlertForm` self-fetches all 3.
- [x] `app/(dashboard)/alerts/[id]/edit/page.tsx` exists, renders pre-populated data, and handles updates via `PATCH /api/alerts/[id]`.
- [x] Edit action linked from alert list page (`alerts-client.tsx`).
- [x] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings (same 2 pre-existing files/3 warnings tracked since Session 6-1); `test:ci` **133/133 suites, 2209/2209 tests** (was 132/132, 2202/2202 — +1 suite/+7 tests, exactly this session's own new file, zero regressions elsewhere).
- [~] Live manual check of the create + edit alert flows — **not done**, per Davin's explicit instruction to carry Waiting-on #117 forward rather than attempt it this session (no test credentials available since Session 4B-21 removed `CredentialsProvider`). Partial substitute: the new `/alerts/[id]/edit` route was confirmed to compile and run cleanly under the real Next.js/Turbopack dev pipeline (not just `tsc`) — an unauthenticated request correctly redirected to `/login?callbackUrl=%2Falerts%2F...%2Fedit`, proving the route's auth gate and build both work end-to-end short of an actual authenticated render.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

**Deviation 1 (CONFIRM, L11 recurrence):** committed `HEAD` had this order at `Status: PRE-DRAFT`
citing `phase-6-frontend-gap-matrix.md`; the working copy was a full, uncommitted rewrite to
`Status: APPROVED` (source citation swapped to the less-authoritative
`docs/files-completion-list/ui-page-gap-analysis.md`, the explicit "not fast-path eligible /
needs a design decision" framing dropped, and the PRE-DRAFT's own carried-forward
"live manual check" Done-when item silently removed) — no git-verifiable DRAFT-stage trail.
Reported to Davin in full before treating any of it as trustworthy; he confirmed live it was his
own authentic authorization, resolved the tier-endpoint UX question directly (wire all 3 as
specified — V8 single-symbol architecture means this "cleanly wires the endpoints without needing
redundant multi-symbol modals" rather than building dead code), and explicitly reinstated the
"live manual check" carry-forward as Waiting-on #117 rather than letting it drop silently.

**Deviation 2 (CONFIRM, citation drift):** the working-copy rewrite cited 138/165/144 lines for
the three tier route files; live `wc -l` confirms 137/164/144 — matching the original committed
PRE-DRAFT's own numbers exactly, the classic "+1 across every citation" drift class. No code
impact, corrected in the Entry criteria above.

**Deviation 3 (CONFIRM, real gap in the order's own "Form Component Reuse" framing):**
`components/alerts/alert-form.tsx`'s `AlertForm` component was found to be **completely orphaned**
— zero live callers anywhere in `app/` or `components/` (`/alerts/new` uses a separate, hand-rolled
`create-alert-client.tsx` with its own duplicated form fields, never `AlertForm`). The order's own
NOTE described wrapping it as "reuse... without rewriting form logic," which held true for its prop
signature (`isEditing`/`initialData` are real, wired-through props) but understated that Step 2 is
this component's first real usage anywhere, not a retrofit of an already-consumed component. Per
`LESSONS-LEARNED.md` L57's own precedent, read the component's full implementation (not just its
props) before trusting it — found no latent bugs, but did find its symbol/timeframe props were
static (caller-supplied), meaning "wire tier endpoints into alert-form.tsx" (Step 1) had no
existing "client caller" to update, since none existed. Resolved by redesigning `AlertForm` to
self-fetch (`GET /api/tier/symbols` + `/combinations` on mount, `GET /api/tier/check/[symbol]` on
symbol change) rather than requiring `availableSymbols`/`availableTimeframes` as props — a safe,
non-breaking redesign of its own prop contract given zero existing callers to break.

**Deviation 4 (Step 1, own addition beyond the order's literal text):** locked the condition-type
selector (`fieldset disabled={isEditing}`) in edit mode, matching the existing
`disabled={isEditing}` pattern already on the Symbol/Timeframe selects. Not in the order's own
text — added because the real `updateAlertSchema` (`app/api/alerts/[id]/route.ts`) only accepts
`isActive`/`name`/`targetValue`; leaving condition type editable would let a user pick "Price Below"
in the UI while the backend silently keeps evaluating the alert's original condition (Zod strips
unknown keys rather than rejecting them), a real data-contract-dial-LOW violation the order's own
"Rules" section explicitly warns against.

**Deviation 5 (Step 1, own design note):** `GET /api/tier/check/[symbol]`'s "invalid symbol
selection displays tier warning banner" (Step 1's own Verify bullet) has no reachable trigger for
any real user today — confirmed via `lib/tier-config.ts` (`SYMBOLS = ['XAUUSD']`,
`PRO_EXCLUSIVE_SYMBOLS = []`) and `GET /api/tier/combinations`'s own doc comment ("No tier gating,
no upgrade prompt — chart access is no longer a tier differentiator"): there is exactly one
platform symbol, universally accessible, and FREE users never reach the form (page-level PRO gate).
Wired in exactly as specified anyway, per Davin's own explicit confirmation this session — genuine,
forward-compatible defensive code for if the platform ever adds a second symbol, not dead code.

**Deviation 6 (Step 2, own design choice):** `EditAlertPage`'s initial alert read is a **direct
Prisma query** (mirroring `/alerts/page.tsx`'s and `/alerts/new/page.tsx`'s own established
server-component convention), not a self-referential `fetch('/api/alerts/[id]')` call — same data,
same ownership check, avoids an unnecessary same-origin HTTP round-trip from a server component
that already has direct DB access. `PATCH /api/alerts/[id]` (the real write path) is unaffected —
`edit-alert-client.tsx` calls it exactly as specified.

**Deviation 7 (Step 2, security choice, not explicit in the order):** a non-existent alert ID and
an alert owned by a different user both call `notFound()` (reusing Session 6-2's own
`app/not-found.tsx`) — the response never distinguishes "doesn't exist" from "not yours," so a
caller can't enumerate other users' alert IDs by comparing 403 vs. 404 responses. Covered by a
dedicated test (`__tests__/pages/alerts/edit.test.tsx`).

**Deviation 8 (Step 4, first-of-its-kind test infrastructure):** no existing test file in this
repo tests an async Server Component page directly — grepped for the pattern, found none. Built
`__tests__/pages/alerts/edit.test.tsx` by calling `EditAlertPage()` directly and awaiting its
resolved JSX before `render()`, with `next/navigation`'s `redirect`/`notFound` mocked to throw
(matching their real Next.js behavior) so the page's control flow halts correctly and the test can
assert on which one fired. 7 tests total, all green.

**Not done, disclosed per Davin's own explicit instruction (Waiting-on #117 carried forward
again):** the live manual check of the create + edit alert flows against a real logged-in session —
same standing gap as every Phase 6 session since 6-1b (no test credentials available,
`CredentialsProvider` removed at Session 4B-21). Partial substitute performed instead: started the
real Next.js dev server (Turbopack) and confirmed `/alerts/[id]/edit` compiles and runs cleanly
outside `tsc` — an unauthenticated request correctly redirected to
`/login?callbackUrl=%2Falerts%2F...%2Fedit`, proving the route's build and auth gate both work
end-to-end short of an actual authenticated render.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21**, **F50**, and **F64** stay open, non-blocking.

## Next-session handoff

Session **6-4** (Notifications UI-BUILD) is next in Phase 6 — builds the `/notifications` page (the bell icon already links to it and currently 404s).
