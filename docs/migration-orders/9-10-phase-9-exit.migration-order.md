# Migration Order — Session 9-10 — Phase 9 Exit (VERIFY-RETIRE)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed. If executing it
> uncovers real work, STOP — that work gets its own session with the right variant.
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-23.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-10 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED
**Generated:** 2026-08-23 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-23 (Advisor DRAFT) · **Approved:** 2026-08-23 (Davin) ·
**Confirmed:** 2026-08-23 (Executor — codebase + runtime re-verified live; see CONFIRM report in session transcript)
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

- [ ] **Session 9-9 CONFIRMED, executed, CLOSED** — disbursement nested layout live on `main`, route-manifest diff clean.
- [ ] **`frontend-swap-route-map.md` available and current** — confirm all 97 rows accurately reflect shipped dispositions across Sessions 9-1 through 9-9.
- [ ] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, `role: ADMIN` in DB).
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

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

- [ ] All 9 checklist items verified with evidence recorded in Session 9-10 close report.
- [ ] `phase-6-frontend-gap-matrix.md` marked `SUPERSEDED-BY-PHASE-9`.
- [ ] Dead codebase-1 legacy components safely cleaned up with zero test regressions.
- [ ] Monolith `tsc --noEmit`, `eslint`, and `npm run test:ci`, plus `money-service` and `operation-service` test suites all pass 100% green.
- [ ] Phase 9 recorded as CLOSED in `CLAUDE.md` and roadmap.
- [ ] Session 10-1 PRE-DRAFT generated.

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
shell. Execution detail below as each step lands.

---

## Next-session handoff

- **Next session:** `10-1` — Phase 10 (Drawing Engine & Line-Alert Closure: Live end-to-end smoke test), per `MASTER-ROADMAP-PHASES-7-15.md` §3. Resolves **F67** (execution environment for drawing-alert smoke test).
- **Prerequisite:** Session 9-10 CLOSED — Phase 9 fully verified and exited.
- **9-10 obligation carried to close:** PRE-DRAFT Session 10-1's migration order.
