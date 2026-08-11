# Migration Order — Session 6-11 — Admin System Operations

> For a session that closes the ADMIN-SYSTEM-OPERATIONS gap-matrix rows assigned to it
> (B2-14, B2-15, B2-16, B2-17) — builds `/admin/system/terminals`, `/admin/system/jobs`,
> `/admin/system/outbox`, and `/admin/system/config-history` under the consolidated admin
> tree (F62, Session 6-2). Adapted from `TEMPLATE-UI-BUILD.md`, dial HIGH for the new admin
> UI, LOW for data (all 4 pages read existing, live backend state — no new business logic).

**Session:** 6-11 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:**
PRE-DRAFT · **Generated:** 2026-08-11 (at Session 6-10 close) · **Flags touched:** none expected ·
**Estimated time:** ~4-6h (4 rows, all flagged "not independently re-checked" by the gap-matrix
session itself — re-verify every citation at CONFIRM per `LESSONS-LEARNED.md` L27)

**Surface:** `app/(dashboard)/admin/system/terminals/page.tsx`,
`app/(dashboard)/admin/system/jobs/page.tsx`, `app/(dashboard)/admin/system/outbox/page.tsx`,
`app/(dashboard)/admin/system/config-history/page.tsx` (all new), plus whatever admin-nav entry
point makes all 4 reachable (likely `components/layout/admin-nav.tsx` or equivalent — verify the
real component name/path at CONFIRM, not assumed here).

**Feeds on:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` rows B2-14/B2-15/B2-16/B2-17.

---

## Context

Four rows from `phase-6-frontend-gap-matrix.md`, **re-verify every citation at CONFIRM** per
`LESSONS-LEARNED.md` L27 (order text drifts from its own cited ground truth — this pattern has
recurred in nearly every Phase 6 session so far) — this PRE-DRAFT was authored from the gap
matrix at Session 6-10's close, not from re-reading every target file in full. All 4 rows are
explicitly flagged by the gap-matrix session itself as "not independently re-checked":

- **B2-14 (`/admin/system/terminals`):** the gap matrix cites "5 OpenAPI endpoints (`flask-api`),
  zero UI" — confirm the real endpoint list and response shapes against `flask-api`'s actual
  OpenAPI spec before building anything; `flask-api` has been reported OFFLINE at least once this
  migration (Waiting-on #101, Session 4B-18d) — check its live status before assuming this page
  can show real data rather than an honest "service unavailable" state.
- **B2-15 (`/admin/system/jobs`):** the gap matrix cites "8 `/api/cron/*` endpoints exist... no run
  history/manual trigger UI" — confirm the real 8 endpoints and whether any already have a
  manual-trigger mechanism (Session 4A-3's own crons-cutover work built one) before designing a
  new one from scratch.
- **B2-16 (`/admin/system/outbox`):** the gap matrix confirms `OutboxEvent`/`OutboxPublisherCron`
  are genuinely live in production (`DECISION-LOG.md` F14, Session 4A-12) — this is the one row
  with real, already-verified backend liveness; re-confirm the schema/model shape hasn't drifted
  since, then build a real admin view (event counts by status, recent failures) rather than a mock.
- **B2-17 (`/admin/system/config-history`):** the gap matrix cites "`SystemConfigHistory` model
  referenced in schema" but its absence from the UI was NOT independently re-checked — confirm the
  model actually exists and has real rows before building a page around it; if it's an empty or
  unused table, that changes the page's own honest framing (same discipline as the 6-10 `/careers`/
  F64 precedent — do not fabricate history rows).

## User Review Required

> [!IMPORTANT]
> **`flask-api` availability (B2-14):** if `flask-api` is confirmed offline at CONFIRM (matching
> the standing Waiting-on #101 gap), does this session still build `/admin/system/terminals` with
> an honest "service unavailable" state, or defer the row until `flask-api` is restored? Not
> decided here — needs Davin's call once CONFIRM re-checks live status.

> [!NOTE]
> **No fabricated data, per the F64/6-1b and 6-10 `/status`/`/careers` precedent:** every one of
> these 4 pages reads real backend state (even if that state is "zero rows" or "service down") —
> none may show mocked/hardcoded "healthy" indicators.

## Entry criteria

- [ ] Session 6-10 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] All 4 rows re-verified live at CONFIRM — all 4 are flagged "not independently re-checked" by
      the gap-matrix session itself; none may be trusted from the matrix's own citation alone.
- [ ] `flask-api`'s live status re-checked (Waiting-on #101) — confirms B2-14's actual scope.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
  --max-warnings 0` clean [4 pre-existing warnings], `test:ci` — last known at 6-10's close:
      146/146 suites, 2291/2291 tests).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM — not fast-path eligible (B2-14's
      `flask-api`-availability question is a real, undecided scope question).

## Integration points

- **In:** `flask-api` OpenAPI spec (read-only, B2-14), `/api/cron/*` endpoints (read-only, B2-15),
  `OutboxEvent`/`OutboxPublisherCron` Prisma models (read-only, B2-16), `SystemConfigHistory`
  Prisma model (read-only, B2-17).
- **Out:** no `operation-service`/`money-service` changes expected; no new cron/job-trigger
  mechanism unless B2-15's own re-verification finds a real gap worth closing (decide at CONFIRM,
  not assumed here).
- **Owns:** the 4 new page files listed under Surface above, plus the admin-nav entry point(s)
  needed to make them reachable (all 23 admin pages already share one nav tree since F62/Session
  6-2 — verify the real component before assuming which file to edit).

## Ordered steps

_(to be finalized at DRAFT — this PRE-DRAFT intentionally leaves step-level detail for the
Advisor/CONFIRM pass, per the same discipline Session 6-10's own PRE-DRAFT used before its own
DRAFT/APPROVED rewrite)_

1. Re-verify all 4 rows' real backend state (`flask-api` OpenAPI + live status, `/api/cron/*` list,
   `OutboxEvent` schema, `SystemConfigHistory` schema + row count) before writing any page.
2. Build `/admin/system/terminals` (B2-14) — scope contingent on `flask-api`'s live status.
3. Build `/admin/system/jobs` (B2-15) — run history + manual trigger if a real mechanism exists.
4. Build `/admin/system/outbox` (B2-16) — real event counts/status/recent-failures view.
5. Build `/admin/system/config-history` (B2-17) — honest empty-state if the table has no rows.
6. Unit tests for all 4 pages; wire admin-nav entries.

## Rules specific to this variant

- **UI Creativity (Dial HIGH)** for layout/visual polish.
- **Data Discipline (Dial LOW):** every page reads real backend state — no fabricated "healthy"/
  "operational" indicators (same discipline as 6-10's `/status` and `/careers` pages).
- **No orphan creation:** each page must be reachable from the admin nav once built.

## Done when

- [ ] All 4 rows (`terminals`, `jobs`, `outbox`, `config-history`) have either a real page reading
      live backend state, or a documented, deliberate deferral with Davin's explicit sign-off.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A — no existing code retired by this session (new pages + nav wiring only).

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and
  **F64** (subscription-card Undo flow) stay open, non-blocking.
- `flask-api` offline status (Waiting-on #101) may narrow B2-14's real scope — do not assume it's
  back online without checking.

## Next-session handoff

Session **6-12** (a11y + responsive + Phase 6 exit review, was 6-9) is next in Phase 6 — the last
session before Phase 6 closes.
