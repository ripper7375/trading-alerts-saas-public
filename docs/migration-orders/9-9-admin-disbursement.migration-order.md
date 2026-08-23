# Migration Order — Session 9-9 — `app/(dashboard)/admin/disbursement/*` (10 rows, nested layout)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-8b's close (2026-08-23)**, informed by `frontend-swap-route-map.md` and 9-8b's own Deviations.
> Per PD1, `Open Questions` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-9 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 9-8b's close) · **Flags touched:** none known yet.
**Surface:** `app/(dashboard)/admin/disbursement/*`, 10 rows per `frontend-swap-route-map.md`'s own
Session column and §7 sizing table (11M — "at/near threshold"):

- Row 22: `app/(dashboard)/admin/disbursement/page.tsx` (Disbursement Overview)
- Row 13: `app/(dashboard)/admin/disbursement/accounts/page.tsx` (RiseWorks Accounts — already a
  bare redirect, see Open Question 1)
- Row 15: `app/(dashboard)/admin/disbursement/affiliates/page.tsx` (Payable Affiliates List)
- Row 14: `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` (Affiliate
  Disbursement Detail)
- Row 16: `app/(dashboard)/admin/disbursement/audit/page.tsx` (Disbursement Audit Log)
- Row 18: `app/(dashboard)/admin/disbursement/batches/page.tsx` (Disbursement Batches List)
- Row 17: `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` (Batch Detail — includes
  `POST .../execute`, a real fund-movement action)
- Row 19: `app/(dashboard)/admin/disbursement/config/page.tsx` (Disbursement Config — Row 97,
  `admin/disbursement/settings`, consolidates into this row per the 9-0 map's own §6 disposition,
  not a standalone page)
- Row 20: `app/(dashboard)/admin/disbursement/recipients/page.tsx` (Wise Recipients — Row 13's
  redirect target)
- Row 21: `app/(dashboard)/admin/disbursement/transactions/page.tsx` (Disbursement Transactions)

**Feeds on (per `frontend-swap-route-map.md`, not yet re-verified live this session):**
`GET /api/disbursement/health` + `/reports/summary` (22), `GET /api/disbursement/reports/
affiliate/[affiliateId]` (14), `GET /api/disbursement/affiliates/[affiliateId]` (+ `/affiliates/
payable`) (15), `GET /api/disbursement/audit-logs` (16), `GET /api/disbursement/batches` (+
`/preview`) (18), `GET /api/disbursement/batches/[batchId]` (+ `/execute` — **real fund
movement**) (17), `GET/PATCH /api/disbursement/config` (19), `GET /api/wise/recipients` (+
`/requirements`, `/[id]/revalidate`) (20), `GET /api/disbursement/transactions` (21). Row 13 has
no real backing endpoint of its own — it is a `redirect()` to Row 20 (Session 6-6, see Open
Question 1).

**Estimated time:** ~3.5–4h (10 pages, all sizing-table `M` per the 9-0 map — "at/near
threshold"; real per-page effort not yet measured this session — all 10 pages already exist on
disk with substantial content (191–572 lines each, per a size spot-check at this PRE-DRAFT),
suggesting a restyle-plus-verify session similar to 9-8a/9-8b rather than net-new building, but
this is not yet contract-verified against live endpoints).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: `app/(dashboard)/admin/
disbursement/*` is the one nested layout boundary under `admin/` not yet shipped — 10 CB1 routes
(11 counting the pre-resolved Row 97 consolidation), all real disbursement/payout tooling
(RiseWorks archive history, Wise recipients, batches, config, audit, transactions). Sessions 9-8a
and 9-8b shipped the other 19 `app/(dashboard)/admin/*` rows; this session closes out the admin
shell in full ahead of Session 9-10's phase exit.

---

## Open Questions (for the Advisor at DRAFT — not decisions, evidence only)

1. **Row 13 (`/admin/disbursement/accounts`) is already a bare `redirect()`, not a page — the
   9-0 map's own citation is stale.** Live read at this PRE-DRAFT:
   `app/(dashboard)/admin/disbursement/accounts/page.tsx` (16 lines) is a Session 6-6 redirect to
   `/admin/disbursement/recipients`, with a doc comment explaining RiseWorks is archived (F42)
   and Wise is the live provider (F36/4A-W7) — the create/sync actions the route map's own
   citation (`POST /api/disbursement/riseworks/accounts`, `.../sync`) describes were
   _intentionally_ not carried forward. Does 9-9 do anything with this row beyond confirming the
   redirect still resolves correctly (i.e., it's a Done-when checkbox, not a restyle target), or
   should the route map itself be corrected to mark Row 13 `RETIRED — folds into Row 20` the same
   way it already marks Rows 26/47/86?
2. **Row 17's `POST .../execute` is real fund disbursement — money movement, not a UI
   restyle.** Per `EXECUTOR-PROTOCOL.md` §7, "anything that would touch real money movement...
   escalate to Davin" is a standing stop-and-ask trigger. This session's own Rules should almost
   certainly carry an explicit ⚠ NEEDS EXPLICIT SIGN-OFF on wiring/restyling this action (batch
   execute triggers real Wise payouts), separate from and stricter than 9-8b's own Decision-4
   confirmation-guard pattern (which covered consequential-but-non-money actions). Needs the
   Advisor/Davin's explicit call on whether this session may restyle+verify the existing execute
   button's real behavior, or whether it must stay strictly read-only-verified (render the
   existing button, do not click-confirm it live) with actual execution deferred to a dedicated,
   Davin-witnessed session.
3. **All 10 target pages already exist with substantial real content — same shape as 9-8a's/
   9-8b's own "10 of 11 already exist" pattern, not yet contract-verified.** A line-count spot
   check (191–572 lines per file) at this PRE-DRAFT suggests these are working, DB/Wise-bound
   pages already, not stubs — consistent with the disbursement backend (Wise integration,
   Sessions 4A-W1…4A-W8) having shipped well before Phase 9's frontend swap started. Does this
   session execute as a single unified restyle-plus-verify session (9-8a's/9-8b's own precedent:
   "live codebase inspection confirms working data bindings, no backend gap to build"), or does
   the Advisor want a fresh per-page check before assuming that holds for all 10 rows — 9-8a's
   own CONFIRM found 2 of its 10 "already exists" rows were undisclosed mock stubs the 9-0 map
   missed, so this assumption has been wrong before.
4. **Consequential-action confirmation-guard pattern established at 9-8b — reuse, don't
   reinvent, except where Open Question 2 requires stricter treatment.** `<AlertDialog>` from
   `components/ui/alert-dialog.tsx` is now the established pattern for admin write actions
   needing confirmation (affiliate suspend/reactivate/distribute-codes, fraud-alert block, code
   cancellation, commission-pay recording — all restyled at 9-8b). This session's own likely
   candidates: batch `execute`/`fund`/`cancel` (Row 17), Wise recipient `revalidate` (Row 20),
   config `PATCH` (Row 19). Carry the same component and pattern forward — but Row 17's `execute`
   specifically needs Open Question 2 resolved first, since it is money-adjacent in a way none of
   9-8b's own actions were.
5. **DavinTrade token restyle convention established at 9-8a/9-8b — reuse, don't reinvent.**
   `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground` for chrome, `bg-primary`/
   `text-primary-foreground` for emphasis, semantic `bg-{color}-500/10 text-{color}-500`
   (red/orange/yellow/green/blue) for status badges — carry forward rather than re-deriving.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-8b CONFIRMED, executed, CLOSED** — admin affiliates cluster live on `main`,
      route-manifest diff clean.
- [ ] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, `role: ADMIN` in
      DB — the FIXED_TEST_ACCOUNTS login upsert forces this fresh on every login, per 9-7b's
      F80 finding; confirm via a fresh login, not a stale session).
- [ ] **All 10 target page files confirmed existing and read in full** (all 10 confirmed present
      at this PRE-DRAFT; not yet read in full).
- [ ] **All backing API routes + Wise integration contract-verified**, including whether
      `money-service` needs to be running locally for live verification (per
      `LESSONS-LEARNED.md` L42, recurred a third time at 9-8b for `distribute-codes` — very
      likely true here too given Wise/disbursement routes proxy through `money-service`; start
      it via the existing `moneyservice` launch config proactively rather than discovering the
      gap live).
- [ ] **Row 17's `execute` action scope resolved** (Open Question 2) before any Ordered Step
      touches it.
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

## Ordered steps (draft — the Advisor may resequence at DRAFT)

1. **Restyle disbursement overview & accounts redirect (Rows 22, 13)** — confirm Row 13's
   redirect still resolves correctly; no restyle needed on a page with no UI.
2. **Restyle payable affiliates list & detail (Rows 15, 14).**
3. **Restyle audit log (Row 16).**
4. **Restyle batches list & detail (Rows 18, 17)** — resolve Open Question 2 before wiring/
   restyling the `execute` action; confirmation-guard pattern per Open Question 4 once scope is
   settled.
5. **Restyle config (Row 19, absorbing Row 97's disposition).**
6. **Restyle Wise recipients (Row 20)** — confirmation guard on `revalidate` per Open Question 4.
7. **Restyle transactions (Row 21).**
8. **Live Verification & Click-Through** — log in as `admin-test@trading-alerts.test`, navigate
   all 10 pages (+ confirm Row 13's redirect), verify zero layout shift, theme reactivity, real
   API/DB/Wise responses, and that every write action round-trips for real (not just render) —
   except Row 17's `execute` if Open Question 2 keeps it out of this session's scope.
9. **Route-Manifest Diff & Test Suites Verification.**

---

## Rules specific to this variant

- **Zero Mock Data:** every page binds to its real API route, Prisma Server Component, or Wise
  API call — re-verify this holds for all 10 rows at CONFIRM (9-8a's/9-8b's own CONFIRM/
  live-verification found real gaps undetected by the 9-0 map or the order's own Feeds-on list;
  do not assume this session's rows are clean without checking).
- **100%-Fidelity Invariant:** preserve all existing filtering, pagination, and confirmation
  dialogs.
- **Money escalation:** Row 17's `execute` action stays gated on Open Question 2's resolution —
  do not wire or live-confirm it without an explicit, separate Davin sign-off distinct from the
  order's general approval (per `EXECUTOR-PROTOCOL.md` §7 and the `⚠ NEEDS EXPLICIT SIGN-OFF`
  convention).
- **Scope Discipline:** do not touch any of 9-8a's or 9-8b's own 19 rows.
- **Record Design Decisions:** document all UI token alignments in Deviations at close.

---

## Done when

- [ ] All 10 pages live with DavinTrade branding, dark/light theme tokens, and semantic badges
      (Row 13 confirmed as a correctly-functioning redirect, not restyled).
- [ ] Live admin user traverses all 10 pages with real API/DB/Wise data bindings and zero
      redirect loops (except Row 13's own intentional one).
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and
      `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical page group so changes can
be isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-10` — Phase 9 exit (VERIFY-RETIRE): every row of the 9-0 map live and
  bound to real data, zero mock constants repo-wide, component tests rebuilt and `test:ci`
  green, light and dark verified on every route, dead codebase-1 components deleted,
  `phase-6-frontend-gap-matrix.md` marked SUPERSEDED-BY-PHASE-9, per
  `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-9 CLOSED — all 29 `app/(dashboard)/admin/*` rows (core + affiliates
  - disbursement) live on `main`.
- **9-9 obligation carried to close:** PRE-DRAFT Session 9-10's migration order per
  `MASTER-ROADMAP-PHASES-7-15.md` §3.
