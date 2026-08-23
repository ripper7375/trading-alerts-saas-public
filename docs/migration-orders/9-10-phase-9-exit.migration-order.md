# Migration Order — Session 9-10 — Phase 9 Exit (VERIFY-RETIRE)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed. If executing it
> uncovers real work, STOP — that work gets its own session with the right variant.
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-23.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-10 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** VERIFY-RETIRE · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-23 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-23 (Advisor DRAFT) · **Approved:** 2026-08-23 (Davin) ·
**Confirmed:** 2026-08-23 (Executor — codebase + runtime re-verified live; see CONFIRM report in session transcript) ·
**Closed:** 2026-08-23 (Executor — all 9 checklist items + Deviation 1 admin-layout retirement executed, all baselines green)
**Flags touched:** none new (verifies Phase 9 closure; F81 carried to future admin session).
**Estimated time:** ~2–3h (comprehensive phase exit review across 10 prior sessions' worth of frontend replacement surface).

**CONFIRM finding, folded in as a scoped Deviation (Davin, live in chat, 2026-08-23):** CONFIRM found
`app/(dashboard)/admin/**` (all 29 rows) rendering double chrome — the legacy codebase-1
`Header`/`Sidebar`/`Footer` (still "Trading Alerts"-branded) wrapping the DavinTrade `admin/
layout.tsx` shell built at 9-8a. Root cause: Session 9-4 reverted `app/(dashboard)/layout.tsx` to
its legacy form specifically to keep serving `/admin/*` and `/charts` after finding the new-shell
mount broke them live (its own Deviation 13); Session 9-5 later gave `/settings` the correct
top-level-route fix but `/admin` never got the equivalent treatment — `migration-stack-analysis.md`
(Session 9-4 entry) explicitly flagged the legacy shell components as "fully orphaned... flagged
for Session 9-10's own dead-code exit criterion." Davin approved folding the fix into this session:
promote `app/admin` and `app/charts` to top-level routes (mirroring 9-5's settings precedent),
retire `app/(dashboard)/layout.tsx` and the route group, then complete checklist item 5 for real.
Full decision list in Deviations below.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: Session 9-9 shipped the last of Phase 9's 10 implementation sessions — all 85 CB1 routes ported across `app/layout.tsx`, `(marketing)`, `(public)`, `(auth)`, `(dashboard)` core, `(dashboard)/settings`, root commerce, `app/affiliate/*`, `(dashboard)/admin` core, and `(dashboard)/admin/disbursement`.

Session 9-10 is the phase-exit verification: **prove** the frontend replacement is complete, 100% bound to real APIs/services, zero mock data remains repo-wide, all 12 layout boundaries render seamlessly in light and dark modes, legacy dead components are safely retired, and the codebase is verified ready for Phase 10 (Drawing Engine & Line-Alert closure).

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-9 CONFIRMED, executed, CLOSED** — disbursement nested layout live on `main`, route-manifest diff clean.
- [x] **`frontend-swap-route-map.md` available and current** — confirm all 97 rows accurately reflect shipped dispositions across Sessions 9-1 through 9-9. (Two minor doc-drift spots found and corrected — see Deviation 3.)
- [x] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, `role: ADMIN` in DB).
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test -- --maxWorkers=1; cd ..

  # 3. Operation service
  cd operation-service; npm test -- --maxWorkers=1; cd ..
  ```

---

## Checklist (RETIRE / EXIT-REVIEW block)

1. **Route-Map Audit & Closure**
   - Walk `frontend-swap-route-map.md` row by row (all 97 rows: 85 CB1 routes + codebase-2 additions/triaged items).
   - Ensure every row has an unambiguous final status (`PORTED`, `RETIRED`, `CONSOLIDATED`, `REPLACED`).
   - Cross-check against the 9 prior sessions' close notes in `CLAUDE.md` and `history/sessions-archive.md`.

2. **Global Zero-Mock Audit**
   - Run grep scans across `app/`, `components/`, and `lib/` for fabricated data patterns:
     - Hardcoded mockup arrays standing in for live API responses.
     - `Math.random()` or hardcoded simulated charts/statistics.
     - Unbound placeholder forms or fake action toasts.
   - Confirm honest disclosures are present where accepted debt exists (e.g. Rows 12/23 mock headers, Row 19 env-based config notice).

3. **Test Suite Baseline & Net-Neutrality Comparison**
   - Compare current test suite count and pass rate against Session 9-0's pre-swap baseline.
   - Ensure `npm run test:ci` (160 suites / 2400 tests), `money-service` (62 suites / 526 tests), and `operation-service` (42 suites / 393 tests) pass 100% clean.
   - Verify that any test updates made across Phase 9 were valid assertion modernizations (e.g. DavinTrade token/class updates) rather than skipped tests.

4. **Multi-Theme & Responsive Sanity Check**
   - Spot-check representative routes across every layout boundary in both **Dark Mode** and **Light Clean Mode**:
     - Root / Marketing (`/`, `/pricing`, `/about`)
     - Auth (`/login`, `/register`)
     - Dashboard Core (`/dashboard`, `/alerts`, `/terminal`)
     - Settings (`/settings/profile`, `/settings/appearance`, `/settings/billing`)
     - Affiliate Portal (`/affiliate`, `/affiliate/dashboard`)
     - Admin Core (`/admin`, `/admin/users`, `/admin/affiliates`, `/admin/fraud-alerts`)
     - Admin Disbursement (`/admin/disbursement`, `/admin/disbursement/batches`)
   - Confirm proper contrast, theme toggle reactivity, and zero flash of unstyled content.

5. **Dead Codebase-1 Components & Stubs Cleanup**
   - Identify obsolete codebase-1 components, unused legacy styles, or orphaned files superseded by codebase 2 ports.
   - Safely remove confirmed dead code. Run full test suites after each removal batch.

6. **Mark Phase 6 Gap Matrix Superseded**
   - Update [`docs/migration-orders/phase-6-frontend-gap-matrix.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/migration-orders/phase-6-frontend-gap-matrix.md) with header banner:
     `> **SUPERSEDED BY PHASE 9** (2026-08-23) — All frontend surfaces replaced with DavinTrade design system and real data bindings.`
   - Preserve historical matrix content intact.

7. **Final Route-Manifest Diff against 9-0 Map**
   - Execute full repository URL-level route diff.
   - Verify zero collisions (no duplicate `app/about` vs `app/(marketing)/about`), zero orphaned routes, and exact correspondence to the 9-0 map.

8. **Master Roadmap Phase 9 Exit Criteria Verification**
   - Literally verify every requirement of `MASTER-ROADMAP-PHASES-7-15.md` §3 Phase 9 exit:
     - Route parity with 9-0 map.
     - No dead internal navigation links.
     - No fabricated/mock data on live routes.
     - Accessibility & responsive layout standards verified.
     - `test:ci` net-neutral or better.
     - Clean route-manifest diff.

9. **Governance Updates & Phase 10 Handoff**
   - Update `CLAUDE.md` to record Phase 9 as CLOSED SUCCESSFUL.
   - Check `DECISION-LOG.md` status: confirm F65/F66 RESOLVED, F81 OPEN (held for future admin endpoint session).
   - PRE-DRAFT `docs/migration-orders/10-1-drawing-alert-smoke.migration-order.md` for Session 10-1 per `MASTER-ROADMAP-PHASES-7-15.md` §3.

---

## Rules specific to this variant

- **Near-Zero Dial:** Observation, deletion of dead code, and documentation only. No new unapproved code or feature additions.
- **Stop on Failure:** Any red test, unresolved route row, or undetected mock data hit must be documented as a finding and addressed explicitly.
- **Preserve Historical Records:** Mark `phase-6-frontend-gap-matrix.md` superseded without deleting its historical triage contents.

---

## Done when

- [x] All 9 checklist items verified with evidence recorded in Session 9-10 close report.
- [x] `phase-6-frontend-gap-matrix.md` marked `SUPERSEDED-BY-PHASE-9`.
- [x] Dead codebase-1 legacy components safely cleaned up with zero test regressions.
- [x] Monolith `tsc --noEmit`, `eslint`, and `npm run test:ci`, plus `money-service` and `operation-service` test suites all pass 100% green.
- [x] Phase 9 recorded as CLOSED in `CLAUDE.md` and roadmap.
- [x] Session 10-1 PRE-DRAFT generated.

---

## Rollback

`git revert` of this session's deletion and documentation commits.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

**Deviation 1 (CONFIRM finding, Davin-approved live in chat, 2026-08-23) — admin layout
retirement folded into this session's scope.** CONFIRM's live browser verification found
`/admin/**` (all 29 routes) rendering two `<header>` elements, two `<aside>` sidebars, and one
legacy `<footer>` (hardcoded `bg-white dark:bg-gray-800`, still "Trading Alerts"-branded) — real,
measured, non-zero layout (old header 65px @ top:0, new admin header 61px @ top:153, footer @
top:1650 on a 1718px page), not a rendering artifact. Root cause: `app/(dashboard)/layout.tsx`
was reverted to its legacy form at Session 9-4 specifically to keep serving `/admin/*` + `/charts`
(9-4's own Deviation 13) after the new-shell mount broke live; Session 9-5 gave `/settings` the
correct top-level-route fix, `/admin` never got the same. `migration-stack-analysis.md`'s own
9-4 entry predicted this exactly ("fully orphaned... flagged for Session 9-10's own dead-code exit
criterion"). checklist item 5 as originally scoped ("safely remove dead codebase-1 components")
could not proceed as a plain deletion — `components/layout/{header,sidebar,footer,mobile-nav}.tsx`
are still the only chrome `/admin/**` and `/charts` have; deleting them first would break 29 live
routes. Davin approved (live in chat) folding the real fix in as a scoped Deviation rather than
spinning off a separate session: promote `app/admin` and `app/charts` to top-level routes
(mirroring 9-5's proven settings precedent), retire `app/(dashboard)/layout.tsx` + the route
group, verify clean single chrome + a11y landmarks, then delete the now-genuinely-orphaned legacy
shell.

**Executed** (commits `5436db7f` step 1, `e4b3cb49` step 2): `app/(dashboard)/admin` → `app/admin`,
`app/(dashboard)/charts` → `app/charts` (git mv, zero relative imports in either subtree — both
moves content-safe). `app/(dashboard)/layout.tsx` deleted, route group retired. `app/admin/
layout.tsx` gained `AppearanceProvider`+`LoginTracker`+`TokenRefreshProvider` (matching every
other top-level protected layout) plus `aria-label` on its nav/aside landmarks. Fixed 5
`__tests__/pages/admin/*.test.tsx` import paths. Live-verified (real DOM measurements): `/admin`,
`/admin/users` now render exactly 1 header/1 aside/1 main; `/admin/disbursement/*`'s own 2-level
chrome (admin nav + disbursement sub-nav) confirmed as pre-existing, intentional Session 9-9
design, not a regression; `/charts` + `/charts/[symbol]/[timeframe]` still correctly redirect to
`/terminal`; zero "Trading Alerts" text anywhere in the admin render tree. Then deleted the now-
genuinely-orphaned `components/layout/{header,sidebar,footer,mobile-nav}.tsx` + their one test
file (33 tests) — zero-importer-verified immediately before deletion, not just trusting the
CONFIRM-time audit. `tsc` clean both steps; `test:ci` 160→159→153 suites (each drop fully
reconciled: -1/-33 tests for the deleted header test, matches the file removed).

**Deviation 2 (Davin's explicit list, item 2) — remaining dead codebase-1 components deleted.**
Zero-importer-verified immediately before each deletion (not solely trusting the CONFIRM-time
audit): `components/billing/subscription-card.tsx` (F64's known broken-Undo dead code, unmounted
since before Phase 9), `components/alerts/{alert-card,alert-list}.tsx` (orphaned pair, superseded
by `AlertsClient` pre-Phase-9), 12 legacy `components/admin/*.tsx` (superseded by 9-8b's inline
table/card builds) + their 6 orphaned test files. `components/notifications/notification-bell.tsx`
retired (deleted) per Davin's explicit choice between the two options CONFIRM presented (wire into
`AppHeader` vs. consciously retire) — this is a **disclosed functional regression**, not a silent
removal: real-time notification-bell UI has had no home since the chrome swap; a future session
can re-wire it into `AppHeader` if wanted. Not touched: `components/admin/
{FraudAlertCard,FraudPatternBadge}.tsx` (capitalized, built 9-8b, live). **Executed** (commit
`dcd42231`): `tsc` clean, `test:ci` 153/153 suites (-6, expected)/2198/2198 tests (-169, expected,
all from the 6 deleted test files), zero unexplained failures.

**Deviation 3 (Davin's explicit list, item 3) — route map + gap matrix doc updates.**
`frontend-swap-route-map.md` rows 45/46 Session column corrected `9-7a` → `9-7b` (both actually
shipped by 9-7b — confirmed via that session's own close-out and `git log` commit `05c10b89`, the
map was never updated after the live reassignment). Rows 49/50/51/57/58/59/62/68 (9-4's own rows)
Main-Repo-Target/Layout-Boundary columns corrected to their real, shipped, top-level paths
(`app/alerts`, `app/terminal`, `app/free`, `app/charts`, `app/dashboard`, `app/notifications`) —
9-4 documented this architecture correction live in its own close notes but the map's cells were
never updated to match. New addendum #9 added to the map's §3, documenting this session's own
admin+charts promotion and explaining why the ~40 admin/disbursement row citations are left as
historical record (per the map's own established convention, see addendum #6a) rather than
individually rewritten. `phase-6-frontend-gap-matrix.md` given its `SUPERSEDED-BY-PHASE-9` banner,
full historical content preserved. **Executed** (commit `48c00cdf`).

**Deviation 4 — multi-theme sweep + final baseline, and one incidental finding not fixed here.**
Spot-checked every route named in the order's own checklist item 4 (marketing, auth, dashboard
core, settings, admin core, admin disbursement) plus `/charts` in both dark and light mode (dark
via the real `davintrade-theme` mechanism; light via a direct `documentElement` class check after
confirming the per-user persisted `UserAppearance.theme` legitimately takes precedence over a
fresh client-side hint, not a bug) — zero regressions, zero new console errors (only pre-existing
dev-only HMR/CSP-blocked-localhost-socket noise from `operation-service` not running locally,
unrelated to this session). Final baseline, fresh and full-scope (`LESSONS-LEARNED.md` L24): `tsc`
clean; `eslint` **0 errors/0 warnings** (down from the 2-warning entry baseline — both were in the
now-deleted `header.tsx`, a genuine improvement, not just net-neutral); `test:ci` 153/153 suites,
2198/2198 tests; money-service 62/62 suites, 526/526 tests (unchanged); operation-service 42/42
suites, 393/393 tests (unchanged). Route-manifest diff clean: 90 `page.tsx` files before and after
(renames only), zero duplicate-URL collisions repo-wide.
**Incidental finding, not fixed (out of this session's scope, unrelated file):** `/terminal`'s
`<title>` renders "Terminal | DavinTrade | DavinTrade" — `app/terminal/page.tsx`'s own
`metadata.title` already includes `| DavinTrade`, and the root layout's title template
(`'%s | DavinTrade'`) appends a second one. Pre-existing since Session 9-4, unrelated to this
session's admin/charts work; a one-line fix (`metadata.title` should be just `'Terminal'`) for
whichever session next touches that file.

**Deviation 5 — a candidate lesson noted, not promoted (`LESSONS-LEARNED.md` at its 40-entry
cap).** The root cause behind Deviation 1's double-chrome bug wasn't that nobody knew — Session
9-4 wrote it directly into `migration-stack-analysis.md`'s own prose ("flagged for Session 9-10's
own dead-code exit criterion"). But that note lives in a document sessions read for _file
inventory_, not for _outstanding obligations_ — three intervening sessions (9-8a, 9-8b, 9-9) each
touched `app/(dashboard)/admin/**` directly and none surfaced it, because the one document
designed for exactly this ("a known, still-open, needs someone" item) is `DECISION-LOG.md`, and
this was never registered there as a flag. Candidate rule: a deferred action item belongs in
`DECISION-LOG.md` as a flag, not only in `migration-stack-analysis.md`'s prose, even when the
finding surfaces mid-session in a file-inventory context. Not promoted to a numbered lesson this
session per the file's own cap rule (would need a consolidation pass first); left for the Advisor
to judge whether it's worth merging into an existing lesson or promoting once room exists.

---

## Next-session handoff

- **Next session:** `10-1` — Phase 10 (Drawing Engine & Line-Alert Closure: Live end-to-end smoke test), per `MASTER-ROADMAP-PHASES-7-15.md` §3. Resolves **F67** (execution environment for drawing-alert smoke test).
- **Prerequisite:** Session 9-10 CLOSED — Phase 9 fully verified and exited.
- **9-10 obligation carried to close:** PRE-DRAFT Session 10-1's migration order. **Done** —
  `docs/migration-orders/10-1-drawing-alert-smoke.migration-order.md` generated, `Status: PRE-DRAFT`,
  F67 posed as an open ⚠ NEEDS EXPLICIT SIGN-OFF decision for the Advisor/Davin (three options per
  the roadmap: Contabo VPS / local Docker / Railway scratch environment) — not resolved here, per
  `EXECUTOR-PROTOCOL.md` §7.
