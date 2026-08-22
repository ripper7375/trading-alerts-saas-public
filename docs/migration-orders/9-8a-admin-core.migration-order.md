# Migration Order — Session 9-8a — `app/(dashboard)/admin/*` core (overview, users, system, api-usage, errors)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-7b's close (2026-08-23)**, informed by `frontend-swap-route-map.md` and 9-7b's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-8a · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 9-7b's close) · **Flags touched:** none known yet
(see Open Question 3).
**Surface:** `app/(dashboard)/admin/*` core cluster, 10 rows per `frontend-swap-route-map.md`'s
own §7 sizing table (the 9-0 map's Session column already splits `admin/*`'s 19 core rows into
9-8a/9-8b, ahead of Master Roadmap's generic "expect a split" framing):

- Row 34: `/admin` (Executive Overview Dashboard)
- Row 33: `/admin/users` (User Management List)
- Row 32: `/admin/users/[id]` (User Detail)
- Row 12: `/admin/api-usage` (API Usage Metrics)
- Row 23: `/admin/errors` (Error Log Viewer)
- Row 28: `/admin/system/config-history` (Config Change History)
- Row 29: `/admin/system/jobs` (Scheduled Jobs Monitor)
- Row 30: `/admin/system/outbox` (Outbox Event Monitor)
- Row 31: `/admin/system/terminals` (Active Terminal Sessions)
- Row 94: `/admin/notifications/broadcast` (Broadcast Composer — disabled-dispatch preview only,
  per the map's own §6 disposition, not a real send path until Phase 10/14)

**Feeds on:** `GET /api/admin/analytics` (34), `GET /api/admin/users` (33), `GET /api/admin/users/
[id]` (32 — route existence confirmed on disk this session, not yet contract-read), `GET /api/
admin/api-usage` (12), `GET /api/admin/error-logs` (23), `GET /api/admin/system/terminals` (31).
Rows 28/29/30/94 have a confirmed real gap — see Open Question 1.
**Estimated time:** unknown — `frontend-swap-route-map.md` §7 already flags this row count as
likely over the ~4h playbook threshold even before the three endpoint gaps are built; real
per-page effort not yet measured (see Open Question 2).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`'s own Session column:
`app/(dashboard)/admin/*` core is 19 CB1 rows, pre-split by the 9-0 map into 9-8a (this session,
10 rows: overview/users/system/api-usage/errors/broadcast) and 9-8b (11 rows: affiliates +
5 reports + settings/affiliate + fraud-alerts + resources). This session is the first half.

Session 9-7b's own close carries this obligation forward per `EXECUTOR-PROTOCOL.md` §3 step 5.

---

## Open questions (Advisor resolves at DRAFT, per PD1)

1. **Three of this session's 10 rows have a confirmed, real backend gap — re-verified live this
   session, not just cited from the map.** `find app/api/admin/system/jobs` and `.../outbox` show
   only `[jobId]/trigger/route.ts` and `retry/route.ts` respectively — no base `route.ts` (no
   list/GET endpoint exists for either). `app/api/admin/system/config-history` does not exist at
   all — zero endpoint. Options, same shape as 9-7b's own Decision 3 precedent: build the three
   missing list endpoints in-session (map's own §5 suggestion), ship as an explicit
   Davin-acknowledged empty/placeholder state and defer the endpoints, or split further. Row 94
   (`notifications/broadcast`) has no endpoint either, but the map's own §6 already disposes this
   as a deliberate disabled-dispatch preview (not a gap to fix) — confirm that disposition still
   holds rather than re-litigating it.
2. **Does this 10-row session need its own further split?** `frontend-swap-route-map.md` §7 rates
   9-8a as "Over threshold once the two endpoint gaps are built in-session" (written before this
   session's own re-verification found a third gap, config-history — see Open Question 1). Real
   per-row effort has not been measured for this cluster the way 9-7b's rows were re-verified at
   its own CONFIRM; recommend the Advisor either accept the risk for a single session or propose
   a further split (e.g., 9-8a1 = overview/users/api-usage/errors — all bindable today; 9-8a2 =
   the three system/\* gap rows + broadcast preview).
3. **Auth/tier gate for `app/(dashboard)/admin/layout.tsx` — read fresh, not assumed.** Not yet
   read in full this PRE-DRAFT; confirm at CONFIRM whether it already gates on `role === 'ADMIN'`
   correctly (Sessions 6-2/F62 built this tree) or needs the same JWT-staleness treatment F79 just
   fixed for the affiliate layouts — an admin role change would hit the identical race if the
   layout trusts the JWT's `role` claim directly rather than re-checking on a stale token.
4. **Row 32's route-map citation needs a live read before trusting it, same class as 9-7b's own
   Row 37 finding.** The map's "Backing API" column for `/admin/users/[id]` cites
   `prisma/non-market-data/schema.prisma` — a schema file, not an endpoint — while a real
   `app/api/admin/users/[id]/` directory does exist on disk (confirmed this session). Read the
   actual route file's request/response shape before binding, don't carry the schema-file citation
   into Ordered Steps.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-7b CONFIRMED, executed, CLOSED** — authenticated affiliate portal live on
      `main`, route-manifest diff clean.
- [ ] **All 10 target page files confirmed existing** and read in full (9 confirmed present on
      disk this PRE-DRAFT via `find`; `/admin/notifications/broadcast` not yet confirmed — codebase-2
      source only per the map, main-repo destination not yet checked for existence).
- [ ] **Each bindable endpoint's request/response shape read** before binding — do not trust the
      route map's "Backing API" column at face value (Open Question 4).
- [ ] **Rows 28/29/30's endpoint gap re-confirmed** — grep `app/api/admin/system/**` fresh; do not
      assume this PRE-DRAFT's own finding is still current without a live re-check.
- [ ] **`app/(dashboard)/admin/layout.tsx` read in full** for its real auth/role gate (Open
      Question 3) before assuming it needs no F79-class fix.
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24 — run each in isolation):

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

## Rules specific to this variant

- **Zero Mock Data:** every page binds to its real endpoint; rows 28/29/30 without one are a
  finding for Davin/Antigravity (per Open Question 1), not a licence to fabricate config-history/
  job/outbox data. Row 94 ships as an explicitly disabled/preview composer, never a working send.
- **100%-fidelity invariant:** restyle to DavinTrade tokens while preserving existing pagination,
  filtering, and any destructive-action confirmation flows already live (e.g. job trigger, outbox
  retry).
- **Scope discipline:** this order does not touch `app/(dashboard)/admin/affiliates/*`,
  `/admin/fraud-alerts/*`, `/admin/settings/affiliate`, or `/admin/resources` — those are 9-8b's.
  Does not touch `app/(dashboard)/admin/disbursement/*` (its own nested layout, Session 9-9).

---

## Done when

- [ ] All 10 rows live with DavinTrade branding, bound to real endpoints (or an explicitly
      disclosed, Davin-acknowledged gap for rows 28/29/30, and the confirmed-disabled state for
      row 94).
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and
      `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per page/row group so changes can be
isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-8b` — `app/(dashboard)/admin/*` cluster 2 (affiliates + 5 reports +
  settings/affiliate + fraud-alerts + resources), per `MASTER-ROADMAP-PHASES-7-15.md` §3 and
  `frontend-swap-route-map.md`.
- **Prerequisite:** Session 9-8a CLOSED — admin core cluster live on `main`.
- **9-8a obligation carried to close:** PRE-DRAFT Session 9-8b's migration order.
