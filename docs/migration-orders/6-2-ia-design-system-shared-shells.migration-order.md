# Migration Order — Session 6-2 — IA + Design System + Shared Shells

> For a session that **fixes information architecture and navigation across FREE/PRO, admin, and
> public surfaces** — no cross-stack PORT, no flags, no new backend endpoints. Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **High for layout/nav/component structure, Low for data** (every
> page touched here already has a real, live data source — this session is IA and plumbing, not
> a fresh wire-up). Sourced from `docs/files-completion-list/ui-page-gap-analysis.md` rows tagged "→ 6-2".

**Session:** 6-2 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for layout/nav, LOW for data) · **Status:** CONFIRMED · **Generated:** 2026-08-10 · **Confirmed:** 2026-08-10 (Davin, live) ·
**Flags touched:** F62 · **Estimated time:** ~4-6h
**Surface:** `app/admin/*` + `app/(dashboard)/admin/*` (nav/IA only), `components/layout/{sidebar,mobile-nav}.tsx`, `app/(dashboard)/settings/page.tsx` (grid links only), `app/not-found.tsx` (new), `app/global-error.tsx` (new), `middleware.ts` (matcher/comments), `app/(marketing)/layout.tsx` (nav only) · **Feeds on:** existing monolith backend endpoints and Next.js App Router layout hierarchy.

---

## Context

This is the direct follow-on to Session 6-1's gap matrix and Session 6-1b's mock-data fixes.
Every row below is an independently re-verified gap:

- **F62 (`DECISION-LOG.md`, OPEN, owner Davin):** Admin pages exist in two incompatible trees:
  - `app/(dashboard)/admin/*` (15 pages, guarded by `app/(dashboard)/layout.tsx`'s `getServerSession()` check, 4-entry nav: `/admin`, `/admin/api-usage`, `/admin/errors`, `/admin/users`).
  - `app/admin/*` (8 pages: `affiliates`, `affiliates/[id]`, `affiliates/reports/{code-inventory,commission-owings,profit-loss,sales-performance}`, `settings/affiliate`, plus `login` — **no shared `layout.tsx` at all**, no guard, no nav). **19 of 23 admin pages are unreachable from the admin nav.** [`middleware.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/middleware.ts) deliberately excluded `/admin` to avoid redirecting logged-out admins away from `app/admin/login/page.tsx`.
- **A1-3(b):** `/admin`'s nav has no link to `/admin/affiliates`, `/admin/disbursement`, `/admin/fraud-alerts`, or `/admin/settings/affiliate`.
- **A1-4(b):** `/settings`'s grid links to only 4 of 9 real subpages (`appearance`, `billing`, `privacy`, `profile`) — `account`, `security`, `help`, `language`, `terms` all exist as real pages and are unlinked.
- **A1-12:** [`components/layout/sidebar.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/layout/sidebar.tsx) and [`mobile-nav.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/layout/mobile-nav.tsx) link to `/analytics` and `/indicators`, neither of which exists as a page.
- **A1-18 (nav half only — destination pages are 6-10's job):** [`app/(marketing)/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(marketing)/layout.tsx>)'s footer links to paths that do not exist yet (`/about`, `/blog`, `/careers`, `/changelog`, `/docs`, `/help`, `/affiliate`, `/disclaimer`).
- **B1-1 / B1-2:** [`app/not-found.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/not-found.tsx) and [`app/global-error.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/global-error.tsx) do not exist — Next.js falls back to generic browser defaults.
- **C-3:** 14 dead internal links across the application.

## User Review Required

> [!IMPORTANT]
> **F62 Resolution Recommendation (Option a):** Merge all 8 pages from `app/admin/*` into `app/(dashboard)/admin/*`. Retire `app/admin/login` (redirect `/admin/login` → `/login`). This unifies all 23 admin pages under the single guarded [`app/(dashboard)/admin/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/layout.tsx>), giving every admin page instant role-authorization, unified navigation, and consistent styling.

> [!IMPORTANT]
> **`middleware.ts` Update on Option (a):** Consolidating the admin tree under `app/(dashboard)/admin/*` eliminates the conflicting `app/admin/login` page. [`middleware.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/middleware.ts)'s exclusion comment should be updated, and `/admin/:path*` can be safely added to middleware or kept layout-guarded by design.

> [!NOTE]
> **B2-13 (`/welcome` onboarding):** Explicitly confirmed **OUT of scope** for Session 6-2 (deferred to Session 6-10 public/marketing pass).

> [!NOTE]
> **A1-18 Marketing Footer Strategy:** Prune broken links that point to non-existent pages in 6-2. Do NOT build placeholder landing pages (that is Session 6-10's explicit job).

> [!NOTE]
> **F64 Carry-Forward:** `subscription-card.tsx` optimistic cancel undo bug (F64) is registered OPEN in `DECISION-LOG.md` and carried forward; it does not gate Session 6-2.

## Entry criteria

- [x] Session 6-1b CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [x] `DECISION-LOG.md` F62 resolved (Davin approved Option a admin tree consolidation, live, this CONFIRM — register updated to RESOLVED).
- [x] Matrix rows (F62, A1-3b, A1-4b, A1-12, A1-18-nav, B1-1, B1-2, C-3) re-verified at CONFIRM against live code — independently re-checked file-by-file (page counts, exact line citations, admin nav array, settings subpage list, sidebar/mobile-nav lines, footer link list, C-3's full 14-item list including the `/affiliate` root-page nuance). Zero drift found; two real scope-boundary gaps found in the order's own rewritten Step 3/Step 4 text (see Deviations) and corrected by Davin live before execution.
- [x] Monolith baseline re-measured at CONFIRM — exact match: `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` → 3 warnings (0 errors), same 2 pre-existing files/lines (`components/layout/header.tsx:85,89`, `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx:236`); `test:ci` → 133/133 suites, 2206/2206 tests.
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — confirmed live by Davin as his own authentic authorization of the working-copy rewrite (the by-now-familiar `LESSONS-LEARNED.md` L11 pattern: uncommitted `PRE-DRAFT → APPROVED` transition with no intermediate DRAFT-stage commit) before any of it was treated as trustworthy.

## Integration points

- **In:** Real session (`getServerSession`), Next.js App Router layout hierarchy.
- **Out:** No backend microservice changes, no API route changes.
- **Owns:** Navigation schemas, layout shells, 404 & global error boundaries.

## Ordered steps

_(dependency order — foundational error boundaries & grid fixes first; admin consolidation step 5 as its own commit)_

### Step 1 — `app/not-found.tsx` + `app/global-error.tsx` (B1-1, B1-2)

- Build brand-aligned Next.js 16 App Router error pages:
  - [`app/not-found.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/not-found.tsx): 404 page with navigation options (Home, Dashboard, Back).
  - [`app/global-error.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/global-error.tsx): Root error boundary catching unhandled client exceptions with a retry trigger (`reset()`) and home link.
- Use design system components (`Button`, `Card`, `Badge`) and Tailwind styles matching dark theme aesthetic.
- _Verify:_ Unmatched route (e.g. `/nonexistent-route-xyz`) renders custom 404; page error trigger renders global error boundary.
- _Commit:_ `feat(6-2): add app/not-found.tsx and app/global-error.tsx boundaries`

### Step 2 — `/settings` Grid Completion (A1-4b)

- Update [`app/(dashboard)/settings/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/settings/page.tsx>) grid items array to include cards for all 9 real subpages:
  - Existing: `profile`, `billing`, `appearance`, `privacy`
  - Added: `account`, `security`, `help`, `language`, `terms`
- Match icon, description, and layout styling of existing cards.
- _Verify:_ All 9 subpages reachable from `/settings` overview; layout renders cleanly on mobile and desktop.
- _Commit:_ `feat(6-2): connect remaining 5 subpage cards on /settings overview grid`

### Step 3 — Dead Nav-Link Removal & Link Audit (A1-12, C-3)

- Remove dead links to `/analytics` and `/indicators` from [`components/layout/sidebar.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/layout/sidebar.tsx) and [`components/layout/mobile-nav.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/layout/mobile-nav.tsx).
- Fix `/affiliate/join` in `components/auth/register-form.tsx` to point at the real `/affiliate/register` route (C-3).
- **Carve-outs — do NOT touch (Davin, live, this CONFIRM):** `/terms` and `/privacy` (owned by F63/Session 6-10 — leave as deliberately tracked, unfixed gaps) and `/notifications` (owned by Session 6-4 — the bell's link stays as-is).
- _Verify:_ No active sidebar/header/form nav link points to a 404 route, except the two explicitly carved-out routes above.
- _Commit:_ `fix(6-2): remove dead nav links (/analytics, /indicators, /affiliate/join) with F63/6-4 carve-outs`

### Step 4 — Marketing Footer Nav Pruning (A1-18 nav half)

- Update [`app/(marketing)/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(marketing)/layout.tsx>) footer navigation links.
- Remove links pointing to unbuilt pages: `/about`, `/blog`, `/careers`, `/changelog`, `/docs`, `/help`, **`/affiliate`, `/disclaimer`** (added to this step's scope by Davin, live, this CONFIRM — Context already named both, the earlier action-list draft had silently dropped them).
- Leave `/terms` and `/privacy` untouched (F63/6-10 carve-out, same as Step 3).
- _Verify:_ Footer links resolve to valid routes without 404 errors, except the two explicitly carved-out routes.
- _Commit:_ `fix(6-2): prune unbuilt destination links in marketing footer`

### Step 5 — Admin Tree Consolidation & Nav Overhaul (F62, A1-3b)

- Execute Option (a) admin tree consolidation:
  1. Move pages from `app/admin/*` into `app/(dashboard)/admin/*`:
     - `app/admin/affiliates` → `app/(dashboard)/admin/affiliates`
     - `app/admin/settings/affiliate` → `app/(dashboard)/admin/settings/affiliate`
  2. Retire `app/admin/login` (redirect `/admin/login` → `/login`).
  3. Delete empty `app/admin/` directory.
  4. Update [`app/(dashboard)/admin/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/layout.tsx>) and admin navigation to expose all admin sections in a unified sidebar/nav:
     - Dashboard (`/admin`)
     - Users (`/admin/users`)
     - Fraud Alerts (`/admin/fraud-alerts`)
     - API Usage (`/admin/api-usage`)
     - System Errors (`/admin/errors`)
     - Affiliates & Reports (`/admin/affiliates`)
     - Disbursements (`/admin/disbursement`)
     - Affiliate Settings (`/admin/settings/affiliate`)
  5. Update [`middleware.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/middleware.ts) matcher comments and configuration to reflect the consolidated structure.
  6. Retire `__tests__/app/admin-login.test.tsx` (Davin, live, this CONFIRM — the page it tests no longer exists once `app/admin/login` is deleted; no equivalent page to redirect its assertions to).
- _Verify:_ All 23 admin pages consolidated under `app/(dashboard)/admin/*`, accessible from unified nav, and properly guarded by `getServerSession()` + admin role check.
- _Commit:_ `refactor(6-2): consolidate admin tree into app/(dashboard)/admin and overhaul admin nav (F62)`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** High latitude on component structure, layout, typography, and styling for 404, global error, settings grid, and admin nav shells.
- **Data Contract (Dial LOW):** No changes to backend data schemas, API routes, or role-checking rules.
- **A11y Standards:** Ensure ARIA attributes, semantic HTML elements, keyboard navigation, and visible focus indicators on all new layout components.
- **Record Design Decisions:** Record all UI design choices in the Deviations section.

## Done when

- [x] `app/not-found.tsx` and `app/global-error.tsx` live and styled — verified live (404 renders
      for an unmatched route with all 3 actions) and via a clean `next build`.
- [x] `/settings` grid links to all 9 real subpages.
- [x] `/analytics` and `/indicators` removed from sidebar and mobile nav.
- [x] Marketing footer contains zero broken links (except the 2 explicitly carved-out `/terms`/
      `/privacy`, tracked under F63/6-10, not silently touched).
- [x] F62 executed: all 23 admin pages consolidated under `app/(dashboard)/admin/*`, unified
      8-section nav, `getServerSession()` + role guard unchanged.
- [x] `tsc --noEmit` clean; `eslint --max-warnings 0` — 3 pre-existing warnings, 0 new; `test:ci`
      132/132 suites, 2202/2202 tests (was 133/133, 2206/2206 — the delta is exactly the retired
      admin-login test); `next build` clean, exit 0, zero compile/type errors.
- [x] Live manual check of admin and settings navigation — **partial**: unauthenticated checks
      done live (404 page, `/admin/login` → `/login` redirect, `/pricing` marketing page all
      confirmed rendering correctly). A real authenticated admin/settings session was NOT
      exercised — no test credentials available in this environment; carries forward the same gap
      Session 6-1b already flagged (Waiting-on #117).

## Cutover & rollback

Not applicable — no flag, no cutover table row. Same-stack IA/navigation work; rollback is `git revert`. Step 5 (admin tree consolidation) must be committed separately for independent revertability.

## Retire

- `app/admin/` directory deleted after moving its 7 real pages into `app/(dashboard)/admin/*` and
  retiring `app/admin/login` (see Deviations for the exact move list).

## Deviations

**Deviation 1 (CONFIRM, L11 recurrence):** committed `HEAD` had this order at `Status: PRE-DRAFT`;
the working copy was a full, uncommitted rewrite to `Status: APPROVED` (source citation swapped
from `phase-6-frontend-gap-matrix.md` to the less-authoritative `ui-page-gap-analysis.md`; F62's
"three options" became a single "Recommendation"; Steps 1-5 rewritten with explicit commit
messages). Reported to Davin in full before treating any of it as trustworthy; he confirmed live
it was his own authentic authorization.

**Deviation 2 (CONFIRM, F62):** the order's own Entry Criterion 2 ("F62 resolved") was FAILING
against the committed `DECISION-LOG.md` — the register and full entry both still read
`Status: OPEN` at CONFIRM time; the order's own "Recommendation (Option a)" callout is not itself
a resolution. Davin formally approved Option (a) live at CONFIRM (merge `app/admin/*` into
`app/(dashboard)/admin/*`, retire `app/admin/login` with a redirect to `/login`) — `DECISION-LOG.md`
F62 updated to RESOLVED as part of this CONFIRM, before Step 5 execution.

**Deviation 3 (CONFIRM, Step 3 scope gap):** the rewritten Step 3 dropped the PRE-DRAFT's explicit
carve-out that 2 of C-3's 14 dead links (`/terms`, `/privacy`) are F63/6-10-owned and must stay as
deliberately tracked gaps, not be silently touched. A third item, `/notifications` (owned by
Session 6-4, the bell's own link target), was never carved out in any draft. Found at CONFIRM and
confirmed live by Davin: all three excluded from Step 3/Step 4's scope. `/affiliate/join`
(`components/auth/register-form.tsx:617`, part of C-3, not previously assigned to any step) added
to Step 3 — points at the real `/affiliate/register` route.

**Deviation 4 (CONFIRM, Step 4 scope gap):** the rewritten Step 4's explicit action list only named
6 of the 8 dead footer links the order's own Context section lists for A1-18 (`/affiliate` and
`/disclaimer` were silently dropped from the actionable instruction, though still present in the
Context prose). Found at CONFIRM and confirmed live by Davin: both added back into Step 4's scope.

**Deviation 5 (CONFIRM, test coverage gap):** `__tests__/app/admin-login.test.tsx` imports
`app/admin/login/page.tsx` directly (4 tests covering the bridge/non-bridge login paths) — not
named anywhere in the order's own Step 5 or Retire sections, despite that page being deleted by
Step 5. Found at CONFIRM; Davin's live direction was to retire it (no equivalent page exists to
redirect its assertions to; the redirect itself is trivial `next.config.js` config, not
component behavior worth a dedicated test).

**Deviation 6 (execution, Step 1 design):** `global-error.tsx` mirrors `app/error.tsx`'s existing
visual language (icon-in-circle, muted-foreground copy, primary/outline button pair, mailto
support link) rather than inventing a new one — the two boundaries should look like the same
product. It imports `./globals.css` and defines its own `<html>`/`<body>` (required — it replaces
the root layout entirely when active, so nothing from `app/layout.tsx` renders around it) and
deliberately omits `Providers`/the `Inter` font loader, since this is the last line of defense if
the app's own providers are what threw. `not-found.tsx` adds a third "Go Back" action
(`router.back()`, client-side) beyond the order's literal "Home, Dashboard" pair — cheap,
standard 404-page affordance, `'use client'` was already required for it.

**Deviation 7 (execution, Step 4 design):** pruning left the Company and Resources footer columns
with zero valid links each (all 3 Company links and all 3 Resources links were dead). Removed
both columns entirely rather than leaving empty headings with no items underneath — the grid
narrowed from `grid-cols-2 md:grid-cols-4` to `grid-cols-1 sm:grid-cols-2` to match the 2
remaining columns (Product: Features, Pricing; Legal: Privacy Policy, Terms of Service).

**Deviation 8 (execution, Step 5 design):** admin nav icons chosen to match the existing 4 items'
plain-emoji style (`AdminNavItem.icon: string`, not a Lucide component) rather than switching the
whole nav to icon components — Fraud Alerts 🚩, Affiliates & Reports 🤝, Disbursements 💸,
Affiliate Settings ⚙️. Labels for the 4 pre-existing items were left as-is except "Error Logs" →
"System Errors", matching the order's own Step 5.4 wording exactly. No active-route highlighting
was added to the admin nav (the pre-existing 4-item nav didn't have it either — out of this
step's own "expose all sections" scope).

**Deviation 9 (execution, Step 5, `/admin/login` redirect ordering):** Davin's approved design
("plain redirect to `/login`, no role-aware handling") has one small, accepted edge case: an
_already-authenticated_ admin who manually types `/admin/login` is redirected to `/login`
(next.config.js) rather than straight to `/admin` — a mildly odd but harmless landing for a
retired URL nobody outside this migration ever had reason to type. `middleware.ts`'s own
unauthenticated fallback (`/login?callbackUrl=...`) converges on the same safe destination for a
logged-out admin either way. Not fixed — out of the explicitly-approved scope, and low enough
blast radius (a dead URL, not a live nav entry) not to warrant expanding it.

**Deviation 10 (session close):** the Browser pane did not render frames for the first live-check
attempt (empty tab origin, `navigate`/`computer` calls failing) — worked on retry later in the
session. Verified live before an unrelated collision (see Deviation 11): the new 404 page renders
correctly with all 3 actions for an unmatched route; `/admin/login` correctly lands on the
existing `/login` page (no crash); `/pricing` (marketing layout, exercises the pruned footer's
sibling markup) renders fully. Did not reach a real authenticated admin/settings session — no
test credentials were available in this environment, and fabricating one was out of scope. Carries
forward the same live-manual-check gap Session 6-1b already flagged (Waiting-on #117,
`CredentialsProvider` removed at Session 4B-21) — Davin's own browser session is still the
recommended way to close it.

**Deviation 11 (session close, environment artifact, not a regression):** mid-verification, a
backgrounded `npm run build` and the still-running `next dev` preview collided — `build`'s own
`prebuild` script (`rimraf ... node_modules/.prisma && prisma generate ...`) deleted and
regenerated the Prisma clients while `next dev` was serving requests, producing transient
"Module not found: .prisma/non-market-client" errors in the dev server's logs. Confirmed this was
the cause (not a Step 5 regression) by checking `node_modules/.prisma` still existed correctly
post-build and that `next build` itself finished clean. Stopped the dev preview rather than
chase a self-inflicted race. Harvested as `LESSONS-LEARNED.md` **L58** (correcting this order's
own earlier close-out draft, which had said "no new lesson" before this collision was weighed
against the file's own harvest criteria a second time at wrap-up).

**Deviation 12 (wrap-up, lesson-file hygiene):** on reflection at wrap-up, Deviation 11's own
finding (Session 6-2 becoming L58) meets `LESSONS-LEARNED.md`'s own harvest bar (cost real
diagnostic time, is a repeatable environment gotcha) and should have been recorded as a lesson at
first close rather than dismissed. Also used the opportunity to apply the file's own "5+
recurrences → single count line" rule to L27 (this order's own Step 3/Step 4 scope-drop, found at
CONFIRM, is itself L27's 6th documented recurrence) — its 4 existing multi-paragraph recurrence
notes were past that threshold already; collapsed to a count line, full narrative moved to
`LESSONS-ARCHIVE.md`, matching the precedent L11 set at Session 4B-19. The file's own ~40-entry
cap (now at 58) is unaffected by either change — a full consolidation pass stays flagged in the
file's own header as a separate, dedicated task for a session that isn't itself time-constrained.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21** (GDPR deletion) and **F50** (`COMMISSION_CREDITED` wrong recipient) stay open, non-blocking.
- `DECISION-LOG.md` **F64** (`subscription-card.tsx` optimistic cancel undo bug) carried forward to future component refactor pass.

## Next-session handoff

Session **6-3** (Alerts & Charts UI-BUILD) is next in Phase 6 — wires the 3 orphan `/api/tier/*` endpoints, adds the missing alert-edit route, and enforces PRO-tier gating. Requires a full Advisor DRAFT.
