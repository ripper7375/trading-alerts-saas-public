# Migration Order — Session 9-7b — `app/affiliate/dashboard/*` authenticated partner portal

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-7a's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-7a's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-7b · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-7a's close) · **Flags touched:** F79 (`DECISION-LOG.md`,
OPEN) is this session's own to resolve — see Open Question 1.
**Surface:** `app/affiliate/dashboard/*` (8 subroutes) + `app/affiliate/resources` (Row 45) +
`app/affiliate/settings/payout` (Row 46) — the authenticated partner-portal cluster, 10 rows
total. Per 9-7a's Decision 1 (approved by Davin), rows 45/46 sit here rather than in the 9-0
map's own literal Session-column assignment (which read `9-7a` for both) — see Open Question 2.
**Feeds on:** `GET /api/affiliate/dashboard/stats` (row 42), `/code-inventory` (35), `/codes`
(36), `/commission-report` (37, note: route map's own row 37 cites `prisma/non-market-data/
schema.prisma` as the "backing API," which is not an endpoint — read the real route file before
assuming what's live), `GET/PATCH /api/affiliate/profile` (40), `GET/PATCH /api/affiliate/
profile/payment` (39 and 46, same endpoint, two pages), `GET /api/affiliate/dashboard/resources`
(+ `/[id]/copy`, `/[id]/download`) (45). Rows 38 (`/payouts`) and 41 (`/statements`) have **no
self-service backing endpoint at all** — confirmed in `frontend-swap-route-map.md` §3.3/§5 row 7;
only admin-side `/api/disbursement/*` exists.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and 9-7a's own Next-session handoff: `app/affiliate/*`'s
5 nested layouts split into 9-7a (public onboarding, CLOSED SUCCESSFUL 2026-08-22) and this
session — the authenticated affiliate-portal half, requiring a real logged-in-and-registered
affiliate account to verify, which 9-7a's own close now provides (see Waiting-on-turned-fixture
below).

`frontend-swap-route-map.md`'s own §7 sizing table already flagged an 8-row version of this
session as **over the ~4h playbook threshold**, for two concrete reasons: it carries a real
backend-gap that has to be _built_, not just bound (§5 row 7 — rows 38/41's missing endpoints),
and this order now carries 10 rows, not 8, per 9-7a's Decision 1. Both facts are evidence for the
Advisor to weigh at DRAFT — see Open Question 3.

---

## A fixture this session did not have to build

9-7a's own required live verification (its Step 5) registered the real test account
`free-test@trading-alerts.test` as a genuine, DB-backed affiliate (`profileId:
cmt4hxzk30005asv2vdq8bpws`) — the authenticated-affiliate session fixture this session needs to
click-through its own pages now exists and does not need to be created here.

---

## Open questions (Advisor resolves at DRAFT, per PD1)

1. **Does this session fix `DECISION-LOG.md` F79, or just work around it to test its own pages?**
   `app/affiliate/dashboard/layout.tsx:56-70` redirects to `/affiliate/register` whenever
   `session.user.isAffiliate` is false — reading the JWT, not the DB — so the fixture above will
   hit this exact redirect loop on first click-through until the JWT rotates (next sign-in) or the
   guard is fixed. `lib/auth/session.ts`'s own `requireAffiliate()` helper already re-checks the
   DB directly for exactly this race condition (its own code comment says so) — swapping
   `dashboard/layout.tsx`'s guard to use it (or re-signing-in the fixture before each session's
   click-through) are both live options. Recommend fixing it here, since this session already owns
   the file and every one of its own 8 dashboard pages sits behind that same guard.
2. **Is rows 45/46's assignment to this session settled, or does it need re-confirming against
   the 9-0 map's own literal Session column?** 9-7a's Decision 1 (Davin-approved) put them here;
   the 9-0 map's main table (`frontend-swap-route-map.md` lines 196-197) and its own §7 sizing
   table both still read `9-7a` for both rows, unedited since 9-0. Recommend the Advisor treat
   9-7a's Decision 1 as the standing resolution (a later, explicit, Davin-approved decision
   overriding an earlier map assignment) and have this order note the map's own text as stale
   rather than re-opening the question — but flagging it here rather than silently assuming, per
   PD1's own rule that a settled choice isn't reopened on preference, only 9-0's own text is now
   inconsistent with it and should eventually be corrected for future readers.
3. **Does this 10-row, 2-real-backend-gap session need its own a/b split?** `frontend-swap-route-
map.md` §7 already flagged an 8-row version as over threshold with 1 gap; this version is
   larger (10 rows, same 2 gaps — rows 38/41). Options: build the two missing endpoints as part of
   this session (as the map's own §5 row 7 suggests), ship rows 38/41 as an explicit, disclosed
   gap (empty/placeholder state, not fabricated data) and defer the endpoints to a follow-up, or
   split into 9-7b1 (rows 35-37,39,40,42 — bindable today) / 9-7b2 (38,41,45,46 — needs backend
   work first, or at least 38/41 do).
4. **Row 37's route-map citation needs a live read before trusting it.** The map's own "Backing
   API" column for row 37 (`/affiliate/dashboard/commissions`) cites
   `prisma/non-market-data/schema.prisma` — a schema file, not an endpoint — while its own
   "Real Data Source" column separately names `GET /api/affiliate/dashboard/commission-report`.
   Read `app/api/affiliate/dashboard/commission-report/route.ts` directly before assuming its
   shape; do not carry the schema-file citation into this order's own Ordered Steps.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-7a CONFIRMED, executed, CLOSED** — public onboarding live on `main`,
      route-manifest diff clean.
- [ ] **All 10 rows' current page files confirmed existing** and read in full: the 8 under
      `app/affiliate/dashboard/*` plus `app/affiliate/resources/page.tsx` and
      `app/affiliate/settings/payout/page.tsx` (both already exist on disk at Session 9-7a's
      close — confirm whether they're stale codebase-1 pages needing a full port, or already
      partially real).
- [ ] **Each of the 8 real/likely-real endpoints confirmed live and its request/response shape
      read** before binding — do not trust the route map's "Backing API" column at face value
      (see Open Question 4).
- [ ] **Rows 38/41's endpoint gap re-confirmed** — grep `app/api/affiliate/**` and
      `app/api/disbursement/**` fresh; do not assume the 9-0 map's finding is still current
      without a live check.
- [ ] **`DECISION-LOG.md` F79 re-verified live** (see Open Question 1) — reproduce the redirect
      loop against the real `free-test@trading-alerts.test` fixture before deciding whether to
      fix it in this session or work around it.
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24 — run each in isolation,
      not in parallel; Session 9-7a's own CONFIRM hit two worker-OOM/SIGTERM false negatives on
      `operation-service` running right after the other two suites):

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

- **Zero Mock Data:** every page binds to its real endpoint; rows 38/41 without one are a finding
  for Davin/Antigravity (per Open Question 3), not a licence to fabricate payout/statement data.
- **100%-fidelity invariant:** restyle to DavinTrade tokens while preserving any real
  validation/error-handling logic already in the live pages at `app/affiliate/resources/page.tsx`
  and `app/affiliate/settings/payout/page.tsx`.
- **Scope discipline:** this order does not touch `app/affiliate/page.tsx`, `/join`, `/register`,
  or the retired `/verify` — those are 9-7a's, CLOSED.

---

## Done when

- [ ] All 10 rows live with DavinTrade branding, bound to real endpoints (or an explicitly
      disclosed, Davin-acknowledged gap for rows 38/41).
- [ ] `DECISION-LOG.md` F79 resolved or explicitly re-scoped with Davin's sign-off on the
      work-around chosen.
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and
      `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per page/step so changes can be
isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->
