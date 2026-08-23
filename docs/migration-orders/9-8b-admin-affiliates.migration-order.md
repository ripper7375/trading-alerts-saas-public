# Migration Order — Session 9-8b — `app/(dashboard)/admin/*` cluster 2 (affiliates, reports, settings, resources)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-8a's close (2026-08-23)**, informed by `frontend-swap-route-map.md` and 9-8a's own Deviations.
> Per PD1, `Open Questions` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-8b · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 9-8a's close) · **Flags touched:** none known yet.
**Surface:** `app/(dashboard)/admin/*` cluster 2, 11 rows per `frontend-swap-route-map.md`'s own
Session column and §7 sizing table:

- Row 11: `app/(dashboard)/admin/affiliates/page.tsx` (Affiliates List)
- Row 5: `app/(dashboard)/admin/affiliates/[id]/page.tsx` (Affiliate Detail)
- Row 6: `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`
- Row 7: `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx`
- Row 8: `app/(dashboard)/admin/affiliates/reports/commission-owings/page.tsx`
- Row 9: `app/(dashboard)/admin/affiliates/reports/profit-loss/page.tsx`
- Row 10: `app/(dashboard)/admin/affiliates/reports/sales-performance/page.tsx`
- Row 24: `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`
- Row 25: `app/(dashboard)/admin/fraud-alerts/page.tsx`
- Row 27: `app/(dashboard)/admin/settings/affiliate/page.tsx`
- Row 96: `app/(dashboard)/admin/resources/page.tsx` (new — no live page exists yet; backend
  shipped 2026-08-20)

**Feeds on (per `frontend-swap-route-map.md`, not yet re-verified live this session):**
`GET /api/admin/affiliates` (11), `GET /api/admin/affiliates/[id]` + suspend/reactivate/
distribute-codes actions (5), `GET /api/admin/affiliates/reports/code-flows` (6),
`GET /api/admin/affiliates/reports/code-inventory` + cancel via `/api/admin/codes/[code]/cancel`
(7), `GET /api/admin/affiliates/reports/commission-owings` (8), `GET /api/admin/affiliates/
reports/profit-loss` (9), `GET /api/admin/affiliates/reports/sales-performance` (10),
`GET /api/admin/fraud-alerts/[id]` (24), `GET /api/admin/fraud-alerts` (25),
`GET/PATCH /api/admin/settings/affiliate` + `/api/config/affiliate` (27),
`GET/POST /api/admin/resources` (+ `/[id]`), `prisma.marketingAsset` (96).
**Estimated time:** ~3.5–4h (11 pages, all sizing-table `M` per the 9-0 map — "at/near threshold,
matches roadmap's own flag"; real per-page effort not yet measured this session).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: `app/(dashboard)/admin/*`
comprises 19 CB1 routes (excluding the 10-route disbursement subtree, owned separately by
Session 9-9). Session 9-8a shipped the first cluster (10 core admin rows). This session ships the
second cluster: affiliate management, 5 affiliate reports, affiliate program settings, fraud
alerts, and marketing resources — closing out `app/(dashboard)/admin/*` proper before 9-9 takes
the disbursement subtree.

---

## Open Questions (for the Advisor at DRAFT — not decisions, evidence only)

1. **10 of 11 target pages already exist and are live; only `admin/resources` is new.** All ten
   affiliate/fraud-alerts/settings pages listed above were confirmed present on disk this session
   (Session 9-8a's own CONFIRM check, done in passing while verifying Row 5's neighboring rows in
   the route map). Not yet read in full or contract-verified against their live backing endpoints
   — that is this session's own CONFIRM obligation, not assumed here. Does this session execute as
   a single unified restyle-plus-one-new-page session (mirroring 9-8a's own Decision 2 reasoning:
   "live codebase inspection confirms working data bindings, no backend gap to build"), or does
   the Advisor want a fresh check before assuming that holds for all 11 rows?
2. **`admin/resources` (Row 96) is a genuine new page — no live counterpart exists.** Its backend
   (`GET/POST /api/admin/resources` (+ `/[id]`), `prisma.marketingAsset`) shipped 2026-08-20 per
   the route map's own citation, ahead of any frontend. Same shape as Session 9-8a's own Row 94
   (`admin/notifications/broadcast`) — port from `seed-code/trading-conversational-ai-ui-pages-
increment/app/admin/resources/page.tsx`'s body with DavinTrade tokens, real data binding this
   time (not a preview/disabled-dispatch page — the backend is real and already shipped). Needs
   the Advisor/Davin's sign-off that this is in scope for 9-8b specifically (the route map already
   assigns it here) and not deferred further.
3. **Fraud alert action endpoints not yet enumerated.** The route map cites `GET /api/admin/
fraud-alerts` and `GET /api/admin/fraud-alerts/[id]` as the two rows' read paths, but Session
   9-8a's own overview page (`admin/page.tsx`) already links to `/admin/fraud-alerts/${alert.id}`
   for individual alerts and shows severity/status badges implying write actions (mark reviewed/
   dismissed/blocked) may exist. Confirm at this session's own CONFIRM whether `fraud-alerts/[id]`
   has any PATCH/action route this order should also wire, rather than assuming read-only.
4. **Affiliate suspend/reactivate/distribute-codes actions on Row 5 need their own live-verification
   plan.** These are consequential admin actions (per `EXECUTOR-PROTOCOL.md` — not money movement,
   but real state changes to a partner's standing) — the Ordered Steps below should include an
   explicit AlertDialog-confirmation pattern (mirroring 9-8a's own `jobs`/`outbox` "Run Now"/
   "Retry" confirmation-dialog precedent) rather than one-click irreversible actions.
5. **DavinTrade token restyle convention already established at 9-8a — reuse, don't reinvent.**
   `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground` for chrome, `bg-primary`/
   `text-primary-foreground` for PRO-tier-equivalent emphasis, `bg-muted`/`text-muted-foreground`
   for neutral/FREE-equivalent states, literal semantic colors (green/red/yellow/blue) preserved
   for genuinely multi-state status badges (fraud severity, affiliate status, report figures).
   Carry this forward rather than re-deriving a new convention.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-8a CONFIRMED, executed, CLOSED** — admin core cluster live on `main`,
      route-manifest diff clean.
- [ ] **Admin test account confirmed active** (`admin-test@trading-alerts.test`, per 9-8a's own
      corrected entry-criteria citation).
- [ ] **All 11 target page files confirmed existing** (10 already do; `admin/resources` does not
      yet) **and read in full.**
- [ ] **All backing API routes + Prisma Server Components read and contract-verified** — including
      the open questions above (fraud-alerts action routes, affiliate suspend/reactivate/
      distribute-codes routes).
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

1. **Restyle affiliate list & detail (Rows 11, 5)** — DavinTrade tokens; wire suspend/reactivate/
   distribute-codes behind explicit confirmation dialogs (Open Question 4).
2. **Restyle the 5 affiliate reports (Rows 6, 7, 8, 9, 10)** — DavinTrade tokens on tables/charts;
   preserve existing filtering/export if present.
3. **Restyle fraud alerts list & detail (Rows 25, 24)** — resolve Open Question 3 (action routes)
   before wiring any write action.
4. **Restyle affiliate program settings (Row 27)** — `GET/PATCH /api/admin/settings/affiliate`.
5. **Port `admin/resources` (Row 96, new)** — from seed-code's page body, DavinTrade tokens, real
   `prisma.marketingAsset` binding via the already-shipped backend. Add to `adminNavItems`.
6. **Live Verification & Click-Through** — log in as `admin-test@trading-alerts.test`, navigate
   all 11 pages, verify zero layout shift, theme reactivity, real API/DB responses, and that the
   affiliate suspend/reactivate/distribute-codes + resources upload/delete actions round-trip for
   real (not just render).
7. **Route-Manifest Diff & Test Suites Verification.**

---

## Rules specific to this variant

- **Zero Mock Data:** every page binds to its real API route or Prisma Server Component query —
  re-verify this holds for all 11 rows at CONFIRM (9-8a's own CONFIRM found 2 of its 10 rows
  didn't, undetected by the 9-0 map; do not assume 9-8b's rows are clean without checking).
- **100%-Fidelity Invariant:** preserve all existing filtering, pagination, and confirmation
  dialogs.
- **Scope Discipline:** do not touch `admin/disbursement/*` (Session 9-9's surface) or any of
  9-8a's own 10 rows.
- **Record Design Decisions:** document all UI token alignments in Deviations at close.

---

## Done when

- [ ] All 11 pages live with DavinTrade branding, dark/light theme tokens, and semantic badges.
- [ ] Live admin user traverses all 11 pages with real API/DB data bindings and zero redirect
      loops.
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

- **Next session:** `9-9` — `admin/disbursement/*` (10 rows, one nested layout), per
  `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-8b CLOSED — `app/(dashboard)/admin/*` proper (all 19 non-disbursement
  rows) live on `main`.
- **9-8b obligation carried to close:** PRE-DRAFT Session 9-9's migration order per
  `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
