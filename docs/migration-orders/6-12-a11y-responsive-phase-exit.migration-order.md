# Migration Order — Session 6-12 — A11y + Responsive Audit (Phase 6 Exit Review)

> For the **final session of Phase 6** — audits every surface built across Sessions 6-1 through 6-11 for accessibility and responsive layout gaps, resolves `DECISION-LOG.md` **F11**, deletes `app/test-api/page.tsx`, and verifies Phase 6 exit criteria. Adapted from `TEMPLATE-UI-BUILD.md`, dial **MEDIUM**.

**Session:** 6-12 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:** CONFIRMED · **Generated:** 2026-08-10 · **Confirmed:** 2026-08-11 ·
**Flags touched:** none · **Estimated time:** ~3-4h
**Surface:** `app/(dashboard)/*`, `app/(marketing)/*`, `app/affiliate/*` (all Phase 6 surfaces), `app/test-api/page.tsx` (deleted) ·
**Feeds on:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` (all 59 rows triaged — see Deviation 2 for the 90-vs-59 reconciliation), `DECISION-LOG.md` F11 (resolved).

---

## Context

Final session of Phase 6 (Frontend Redesign). Verifies all Phase 6 exit criteria:

- **Gap Matrix Fully Triaged (F11 Resolved):** All 59 rows in `phase-6-frontend-gap-matrix.md` (the re-verified, deduplicated matrix — distinct from the 90-row raw source register) land on built pages, live components, or verified internal-only routes across Sessions 6-1 through 6-11.
- **Decision Log Alignment:** F61 (`/api/geo/detect`), F62 (Admin IA consolidation), F63 (Public legal pages), and F11 (Gap matrix triage) are all marked RESOLVED in `DECISION-LOG.md`.
- **Test API Route Deletion:** `app/test-api/page.tsx` is deleted.
- **Accessibility & Responsive Quality Pass:** Audits keyboard navigation, screen reader ARIA labels/roles, focus states, and mobile/tablet viewport responsiveness across all redesigned pages.
- **Phase Handoff:** Phase 6 closes cleanly; handoff to Phase 7 (API Client Rewrite — Session 7-1).

## User Review Required

> [!IMPORTANT]
> **Phase 6 Exit Authorization:** Execution of Session 6-12 marks the official completion of Phase 6 (Frontend Redesign). The codebase is fully verified for Phase 7 (API Client Rewrite).

> [!IMPORTANT]
> **Test Route Deletion:** `app/test-api/page.tsx` is deleted as required by Phase 6 exit criteria.

> [!NOTE]
> **Zero Microservice Cutover Required:** Session 6-12 is a pure frontend audit session — zero backend microservice feature flags, zero cutover table updates, and zero manual production test steps are required.

## Entry criteria

- [x] Session 6-11 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [x] `phase-6-frontend-gap-matrix.md` fully triaged (all 59 rows built/verified across Sessions 6-1..6-11) — verified live at CONFIRM: every row's Triage column now holds a real value (`BUILT (Session N)` / `VERIFIED (...)` / `OUT_OF_SCOPE (Ticketed)`), footer reads "F11 RESOLVED."
- [x] `DECISION-LOG.md` F11 resolved — Davin confirmed live this is his own authentic APPROVED authorization and that the triage pass is genuinely his own product judgment, not fabricated (see Deviations).
- [x] Monolith baseline re-measured at CONFIRM (`tsc --noEmit` clean; `eslint --max-warnings 0` — exactly 4 pre-existing warnings, 0 new; `test:ci` **148 suites/148 passed, 2312 tests/2312 passed** — matches 6-11's real close-out baseline exactly, confirming zero drift since 6-11).
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — Davin confirmed live, in chat, that the `APPROVED` status is his own authentic authorization (the by-now-familiar `LESSONS-LEARNED.md` L11 pattern — order arrived modified-but-uncommitted with no visible DRAFT-stage commit trail; resolved the same way as every prior recurrence: reported in full, Davin confirmed live before CONFIRM).

## Integration points

- **In:** All Phase 6 UI components and pages built across 6-1..6-11.
- **Out:** No backend service changes.
- **Owns:** Audit fix targets across `app/` and `components/`, deletion of `app/test-api/page.tsx`.

## Ordered steps

### Step 1 — Verify Gap Matrix Triage & Phase 6 Exit Criteria (F11)

- Re-read `phase-6-frontend-gap-matrix.md` and confirm all 59 rows land on built components, pages, or verified internal-only routes.
- Confirm F61, F62, F63, and F11 are all marked RESOLVED in `DECISION-LOG.md`.
- _Verify:_ Gap matrix sweep complete; all Phase 6 exit requirements satisfied.
- _Commit:_ `docs(6-12): verify gap matrix triage and phase 6 exit criteria (resolves F11)`

### Step 2 — Delete `app/test-api/page.tsx`

- Delete `app/test-api/page.tsx` (and any associated test-api components/routes) per Phase 6 exit criteria.
- _Verify:_ `app/test-api/page.tsx` deleted; `tsc --noEmit` compiles cleanly.
- _Commit:_ `refactor(6-12): delete app/test-api/page.tsx per phase 6 exit requirements`

### Step 3 — Run Accessibility Audit & Fix A11y Gaps

- Audit keyboard navigation, screen reader ARIA labels/roles, focus traps, and color contrast across `app/(dashboard)/*`, `app/(marketing)/*`, `app/affiliate/*`.
- Fix any missing `aria-label`, dialog focus trapping, or semantic heading hierarchy gaps.
- _Verify:_ All interactive elements possess accessible labels and keyboard focus states.
- _Commit:_ `fix(6-12): accessibility audit fixes for keyboard focus and ARIA labels`

### Step 4 — Run Responsive Layout Audit & Mobile/Tablet Breakpoint Pass

- Audit viewport behavior across mobile (320px–480px), tablet (768px–1024px), and desktop (1280px+) breakpoints across all dashboard tables, forms, and marketing cards.
- Fix horizontal scroll overflow or awkward element stacking on small viewports.
- _Verify:_ All dashboard and marketing layouts scale fluidly without horizontal scroll.
- _Commit:_ `fix(6-12): responsive layout audit fixes for mobile and tablet viewports`

### Step 5 — Unit Tests & Final Baseline Re-measurement

- Create `__tests__/pages/phase-6-exit.test.tsx` verifying route integrity, a11y focus traps, and 404 handling.
- Run `tsc --noEmit`, `eslint --max-warnings 0`, and `test:ci`.
- _Verify:_ Baseline passes cleanly with zero regressions.
- _Commit:_ `test(6-12): add unit tests for phase 6 exit verification`

## Rules specific to this variant

- **UI Creativity (Dial MEDIUM):** Focus on fixing real audit findings without redesigning existing working pages.
- **Data Discipline (Dial LOW):** Zero hardcoded data or mock placeholders.
- **Retire Route:** Delete `app/test-api/page.tsx`.
- **A11y Standards:** Complete WCAG 2.1 AA compliance across all redesigned pages.

## Done when

- [ ] All Phase 6 exit criteria satisfied and verified.
- [ ] F11 resolved and all 59 gap matrix rows triaged.
- [ ] Accessibility and responsive layout audit clean across all Phase 6 pages.
- [ ] `app/test-api/page.tsx` deleted.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

`app/test-api/page.tsx` deleted per Phase 6 exit requirements.

## Deviations

1. **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again.** The committed
   PRE-DRAFT (commit `f013aa5c`, 6-11's own close) sat at `Status: PRE-DRAFT`, explicitly left
   its own Ordered Steps blank pending a real audit, explicitly framed itself as "not fast-path
   eligible," and explicitly left F11 as its own "central blocker-shaped item" pending Davin's
   triage. The working copy was a full uncommitted rewrite to `Status: APPROVED` with F11 already
   asserted resolved and a full 5-step plan fabricated with no audit run — and at first read, the
   gap matrix itself (the one artifact that could prove or disprove the F11 claim) had **zero**
   uncommitted changes: every one of its rows still showed an unfilled `—` Triage value, directly
   contradicting the order's own claim. Reported in full to Davin before treating any of it as
   trustworthy, per every prior recurrence of this pattern in this migration's history. Davin
   confirmed live, in chat, that the `APPROVED` rewrite was his own authentic authorization and
   that he had completed the row-by-row triage — and moments later the gap matrix itself picked up
   real, substantive changes (60 lines: a genuine `BUILT`/`VERIFIED`/`OUT_OF_SCOPE` value on every
   one of the 59 rows, footer updated to "F11 RESOLVED"), independently confirmed before proceeding
   rather than taken on the claim alone.
2. **Row-count reconciliation (90 vs. 59).** The order's own citations (Context, Entry criteria,
   Step 1, Done-when) all said "all 90 rows," inherited from `DECISION-LOG.md` F11's own citation
   of `ui-page-gap-register.xlsx`'s raw 90-row source count. `phase-6-frontend-gap-matrix.md` — the
   actual matrix this session verifies — has **59** real, independently re-verified rows (18 A1 +
   12 A2 + 5 B1 + 20 B2 + 4 C, grep-counted), a fact the matrix's own Correction #4 had already
   flagged as a cross-artifact count inconsistency at Session 6-1. Davin acknowledged this
   explicitly in his go-ahead. Corrected every "90" citation in this order (this file) and in
   `DECISION-LOG.md`'s F11 register row + detail entry to "59," and added Correction #7 to the
   gap matrix itself documenting the reconciliation for any future reader.
3. **Baseline citation was stale by one session.** The order's own Entry criteria cited "146/146
   suites, 2291/2291 tests" as the last-known baseline — that is Session 6-10's number
   (`CLAUDE.md:166`), not 6-11's real close-out figure. A fresh `npm run test:ci` run at CONFIRM
   returned **148/148 suites, 2312/2312 tests**, matching 6-11's own committed close-out
   (`CLAUDE.md:88`) exactly — zero drift since 6-11, the citation was simply copied from the wrong
   session. Corrected in this order's own Entry criteria.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5) — Phase 7's concern.
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F64** (subscription-card Undo flow) stay open, non-blocking.

## Next-session handoff

Phase 6 complete! Phase 7 (API Client Rewrite — Session 7-1) is next.
