# Migration Order — Session 9-4 — `(dashboard)` core 7 + `/terminal` + `/free`

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-3's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-3's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-4 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD (dial HIGH
for page bodies, ZERO on data) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-3's close) · **Flags touched:** none new (Stack
D/E panels are flag-gated empty states pending F69/F71, not resolved until Phase 12/13 — see Open
Question 2)
**Surface:** `app/(dashboard)/layout.tsx` (the layout boundary this session moves — NOT YET READ
this PRE-DRAFT, see Open Question 1) · 5 core pages: `dashboard`, `alerts`, `alerts/new`,
`alerts/[id]/edit`, `notifications` (route group already exists, currently holds the OLD "Trading
Alerts" page bodies) · 2 new chart-workspace pages: `app/(dashboard)/terminal/page.tsx` (PRO,
4-panel), `app/(dashboard)/free/page.tsx` (FREE, 3-panel) · 3 retired routes:
`app/(dashboard)/charts/page.tsx` + `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`
(superseded by `/terminal` + `/free` — deletion, not a port).
**Feeds on:** `GET /api/alerts` (+ `POST`, `GET/PATCH /api/alerts/[id]`), `GET /api/notifications`
(+ `/[id]/read`), `GET /api/user/profile` (dashboard aggregate), `GET /api/drawings`,
`GET /api/alerts/line`, `GET /api/candles/[symbol]`, `GET /api/market-data/channel`,
`GET /api/realtime/token` (terminal/free Panel 1). Existing real components:
`components/alerts/alert-form.tsx`, `components/notifications/notification-bell.tsx` — not yet
read this PRE-DRAFT, confirm still real and unmocked at CONFIRM.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session ports the `(dashboard)` core layout boundary
plus the two new chart-workspace pages that retire codebase 1's old `/charts` routes. `frontend-
swap-route-map.md` assigns this session 10 rows (49, 50, 51, 55, 56, 57, 58, 59, 62, 68) — 8
distinct routes after collapsing the 3 RETIRED (N/A) rows, all `SESSION REQUIRED`.
Session 9-3's own close confirmed live login/session works end-to-end (PRO test user →
`/dashboard`), so this session's live click-through has real credentials to exercise, unlike 9-0
through 9-2.

---

## Decisions taken

<!-- Left as open questions with evidence, not decisions — PD1: the Advisor decides from
     documents at DRAFT, not the Executor at PRE-DRAFT. -->

**Open Question 1 — sizing.** `frontend-swap-route-map.md`'s own §4 sizing table already flags
this session as **"Over threshold"**: `/terminal` and `/free` are both Large effort on top of 5
Medium/Small core pages plus 3 retirements, and the roadmap's own ~4h estimate for 9-4 is noted as
tight. This PRE-DRAFT has not attempted the split itself (no per-page effort re-measurement done
this session) — recommend the Advisor decide at DRAFT whether to split into 9-4a (dashboard core:
`dashboard`, `alerts`, `alerts/new`, `alerts/[id]/edit`, `notifications`, retiring the 3 old chart
routes) and 9-4b (`/terminal` + `/free`), mirroring the split already anticipated for 9-7/9-8.

**Open Question 2 — Stack D/E empty-state mechanism.** The roadmap requires `/terminal`'s Panels
2 (`AIAnalystPanel`, Stack D) and 3 (`MarketCommentsFeed`, Stack E) to ship as **flag-gated empty
states, never mock data** — Session 6-1b's own founding lesson. But `F69` (LLM provider/cost
ceiling) and `F71` (Stack E generation mechanism) are Phase 12/13 flags, not yet resolved in
`DECISION-LOG.md`, and neither is a code-level feature flag today — there is nothing to gate on
yet. This PRE-DRAFT has not read `seed-code/.../terminal/page.tsx` closely enough to state whether
its Panel 2/3 components already have an empty-state affordance to reuse, or whether this session
needs to design one from scratch (e.g., a static "Coming in a future phase" panel with no env-var
gate at all, since none exists). Recommend the Advisor decide the concrete mechanism at DRAFT.

**Open Question 3 — `app/(dashboard)/layout.tsx`'s current state, unread this PRE-DRAFT.** Unlike
9-3's own auth layout (confirmed from-scratch, no seed-code counterpart), this PRE-DRAFT has not
read either the current live `(dashboard)/layout.tsx` or seed-code's own `(dashboard)/layout.tsx`
in full — whether this is a restyle-in-place (9-2's marketing-layout pattern) or a from-scratch
build (9-3's auth-layout pattern) is unknown. Read both trees in full before writing step 1.

**Open Question 4 — gap-6e residual split between 9-4 and 9-5.** Session 9-1's own Deviations
handed `chat-panel.tsx`, `market-comments-panel.tsx`, and `settings/layout.tsx`'s Light Clean Mode
token fixes to "Sessions 9-4/9-5" without a row-level split. Evidence: `chat-panel.tsx` and
`market-comments-panel.tsx` are terminal-panel components (Stack D/E, Open Question 2's own
territory) — this PRE-DRAFT's reading is they belong to 9-4, while `settings/layout.tsx` belongs
to 9-5 (which owns `(dashboard)/settings/` outright). Not yet confirmed against the live files.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] Session 9-3 CONFIRMED, executed, CLOSED — `(auth)` pages + `/welcome` live, real login
      verified end-to-end, route-manifest diff clean.
- [ ] **Route-map rows 49, 50, 51, 55, 56, 57, 58, 59, 62, 68 re-read directly** (not this
      PRE-DRAFT's paraphrase) — confirm no further drift beyond Open Questions 1-4 above.
- [ ] **`app/(dashboard)/{dashboard,alerts,alerts/new,alerts/[id]/edit,notifications}` confirmed
      still holding the OLD page bodies**; `app/(dashboard)/{terminal,free}/` confirmed still not
      existing (new pages, not a port-in-place); `app/(dashboard)/charts*` confirmed still present
      (this session's own deletion target, not already gone).
- [ ] **Test credentials confirmed available and working** — de facto resolved as of 9-1/9-3's own
      live CONFIRMs (Waiting-on #117); re-verify the quick-fill flow still works, don't just cite
      this PRE-DRAFT.
- [ ] Sequential test suite baselines green (`LESSONS-LEARNED.md` L24) — monolith `tsc`/`npx
    eslint app components lib hooks --max-warnings 5`/`test:ci`, then money-service, then
      operation-service, run one at a time, not in parallel.
- [ ] `DECISION-LOG.md` **F69**/**F71** status re-checked — if either resolved between now and
      CONFIRM, Open Question 2 may already have its answer.

---

## Ordered steps

_(candidate — the Advisor may reorder/restructure freely per the UI-BUILD dial)_

1. **Resolve Open Questions 1-4 before touching any page file** — sizing affects whether this is
   one session or two; the empty-state mechanism affects `/terminal`'s own step 3; the layout's
   current state affects whether step 2 is a restyle or a from-scratch build.
2. **Build/restyle `app/(dashboard)/layout.tsx`** per however Open Question 3 resolves.
   _Verify:_ `tsc` clean; renders around all 5 core pages + `/terminal` + `/free` without a
   double-chrome regression (the recurring class of bug 9-2/9-3 both had to contain).
3. **Port the 5 core pages' bodies from `seed-code/`**, preserving real API bindings — apply the
   same "read both trees before assuming a visual-only port" discipline 9-2/9-3 both had to apply
   (seed-code pages have repeatedly turned out to be mock prototypes for exactly the highest-stakes
   flows — auth logins, and here, live alert/notification data).
4. **Build `/terminal` and `/free`** — Panel 1 (live chart + drawing toolbar) bound to the real
   endpoints listed above; Panels 2/3 per however Open Question 2 resolves.
5. **Delete the 3 retired chart routes** (`app/(dashboard)/charts/page.tsx` and
   `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`) — confirm no other page links to them
   before deleting (a stale internal link is a roadmap exit-criterion failure).
6. **Live authenticated click-through** — dashboard aggregate data, create/edit/delete an alert,
   mark a notification read, terminal/free workspace load with a real chart render and a real
   drawing-toolbar interaction. Use the quick-fill test credentials (PRO for `/terminal`, FREE for
   `/free`).
7. **Route-manifest diff** — confirm exactly this session's own rows' worth of URLs
   added/changed/removed (`/terminal` and `/free` new; 5 core pages changed; 2 `/charts` routes
   removed) and nothing else.

---

## Rules specific to this variant

- **UI creativity: High** for page-body content/layout — none of the 6 Protected-page constraints
  block this (all 7 pages here ARE among Phase 9's Protected pages, so this is the FIRST session
  where that constraint actually applies — re-read `00-SKELETON-AND-RULES.md` §4's Protected-page
  clause before assuming the same High-creativity latitude 9-2/9-3 had).
- **Zero on data:** every page binds to the real endpoint its own route-map row names — no
  fabricated alert counts, no mock chart candles, no fake drawing state.
- **Stack D/E panels are empty states, never mock data** — this is Session 6-1b's own founding
  lesson and the roadmap's own explicit instruction; re-litigating it as a "just add sample data
  for now" shortcut is exactly the failure this rule exists to prevent.
- A11y from the start — the reset-password `htmlFor`/`id` gap 9-3 found and fixed is a reminder to
  check every ported form/label pairing, not just auth ones.
- Record design decisions in Deviations — they inform 9-5 onward's own page-body work.

---

## Done when

- [ ] All 5 `(dashboard)` core pages + `/terminal` + `/free` live with DavinTrade content,
      consuming `app/(dashboard)/layout.tsx`.
- [ ] Real alert CRUD, real notification read-state, real dashboard aggregate, and a real chart +
      drawing-toolbar render on `/terminal`/`/free` — all live-verified end-to-end with real test
      credentials, not just component-level unit tests.
- [ ] Stack D/E panels render as genuine empty states, zero fabricated content.
- [ ] No double-chrome regression on any of the 7 pages.
- [ ] The 3 retired `/charts` routes are gone, with zero remaining internal links to them.
- [ ] Route-manifest diff matches this session's own rows and nothing else.
- [ ] `tsc`/`eslint`/`test:ci` (monolith, money-service, operation-service) all green.

---

## Rollback

`git revert` of this session's commits — no cutover flag (Phase 9 ships progressively on `main`
per F66). Prefer one commit per logical group (layout / 5 core pages / terminal+free / charts
deletion) so a bad step can be reverted without losing the good ones.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

_(DRAFT order for Session 9-5 — `(dashboard)/settings/` 11, UI-BUILD)_
