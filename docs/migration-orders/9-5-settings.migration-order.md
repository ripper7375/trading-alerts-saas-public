# Migration Order — Session 9-5 — `(dashboard)/settings/` 11

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-4's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-4's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-5 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD (dial HIGH
for page bodies, ZERO on data) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-4's close) · **Flags touched:** F21 (24h
account-deletion GDPR gap), F64 (subscription-card optimistic-undo bug) — both scheduled to close
this session per `MASTER-ROADMAP-PHASES-7-15.md`'s own Sessions breakdown (its "Already-open
flags" table lists them as "owed by 9-4" instead — a drafting error in that document Session 9-4
found and disclosed, not corrected there; this PRE-DRAFT follows the Sessions breakdown, which
Davin confirmed live at 9-4's own CONFIRM is the correct owner).
**Surface:** `app/(dashboard)/settings/layout.tsx` (the layout boundary this session moves — NOT
YET READ this PRE-DRAFT) + 11 settings pages: `settings` (hub), `settings/account`,
`settings/appearance` (Protected Page #5), `settings/billing`, `settings/help` (Protected Page
#6), `settings/language`, `settings/privacy`, `settings/profile`, `settings/security`,
`settings/security/activity`, `settings/terms`.
**Feeds on:** `GET/PATCH /api/user/profile`, `/api/user/password`,
`/api/user/account/deletion-request`, `/api/user/preferences` (appearance/language/timezone/
privacy keys), `GET /api/subscription` (+ `/cancel`), `/api/invoices`,
`GET/PATCH /api/user/2fa/{setup,verify-setup,disable,backup-codes}`,
`GET /api/user/sessions` (+ `/[id]`), `GET /api/user/login-history`, `/api/user/security-alerts`.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session ports the `(dashboard)/settings/` layout
boundary and all 11 route-map rows under it (73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83) —
appearance and language/timezone already have real backends (Session 2.4/2.5 hand-offs); this
session is the UI port against those existing endpoints, not new backend work. Closes **F21**
(24h account-deletion GDPR gap) and **F64** (subscription-card optimistic-undo bug) — both live on
the account/billing surfaces this session rebuilds.

---

## Decisions taken

<!-- Left as open questions with evidence, not decisions — PD1: the Advisor decides from
     documents at DRAFT, not the Executor at PRE-DRAFT. -->

**Open Question 1 — `app/(dashboard)/settings/layout.tsx`'s chrome, given Session 9-4's own
finding.** Session 9-4 originally moved `app/(dashboard)/layout.tsx` to a thin `AppHeader`-per-page
model, then found (live browser testing) this broke `/settings/*` and `/admin/*` — both still
depend on the PARENT `app/(dashboard)/layout.tsx` for their chrome, and it was restored to its
**original** legacy `Header`/`Sidebar`/`Footer` form specifically so those surfaces keep working
untouched. That means every settings page today still renders inside a DOUBLE shell:
`app/(dashboard)/layout.tsx` (legacy Header/Sidebar/Footer) wrapping
`app/(dashboard)/settings/layout.tsx` (its own nested chrome, not yet read this PRE-DRAFT). This
session must resolve the exact same architecture question 9-4 already hit once: does
`(dashboard)/settings/` move out to a top-level `app/settings/` route (mirroring 9-4's own
`app/dashboard/`, `app/alerts/`, `app/terminal/`, `app/free/` moves) with its own AppHeader/
ChatSidebar-or-equivalent chrome and a minimal auth-gate layout, leaving `app/(dashboard)/
layout.tsx` to keep serving only `/admin/*` (9-8's own scope) until that session makes the same
call? Recommend the Advisor decide this explicitly at DRAFT, informed by reading
`seed-code`'s own `(dashboard)/settings/layout.tsx` and at least 2-3 real settings page bodies in
full first (not just their route-map citation) — 9-4's own biggest live-testing finding was that
this exact class of question cannot be answered from the route map alone.

**Open Question 2 — F64's real fix scope.** `DECISION-LOG.md` F64: `components/billing/
subscription-card.tsx`'s optimistic-cancel "Undo" button never calls a reactivation API. Session
6-1b's own finding (component read, never wired) is now over a month old — re-verify the
component's current implementation directly before assuming the described bug still exists
verbatim; if `/settings/billing`'s real backend (`GET /api/subscription` + `/cancel`) has changed
shape since, the fix approach may need to change with it.

**Open Question 3 — F21's product decision (hard-delete vs anonymize) is still genuinely open,
not just a UI question.** `DECISION-LOG.md` F21 has been OPEN since Session 2-3 pending "Davin's
product decision" — this session cannot silently resolve it by picking one in the UI. Needs
Davin's explicit input before or during this session, not assumed at DRAFT.

**Open Question 4 — `/settings/security`'s real 2FA/session-management surface is large (Effort:
L per the route map) and may want its own sub-split**, similar to how 9-7/9-8 already anticipate
a split. Not attempted this PRE-DRAFT (no per-page effort re-measurement done); flag for the
Advisor to size at DRAFT.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] Session 9-4 CONFIRMED, executed, CLOSED — `(dashboard)` core 7 + `/terminal` + `/free` live,
      route-manifest diff clean. **Note the one open item Session 9-4 hands forward
      undisclosed-to-nobody:** `DECISION-LOG.md` **F77** (OPEN) — `/alerts`/`/alerts/new`
      client-side double-render on reload, real functional consequence confirmed, root cause not
      found. Not this session's own scope to fix, but re-check it hasn't regressed further before
      assuming the baseline is stable.
- [ ] **Route-map rows 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83 re-read directly** against
      `frontend-swap-route-map.md` (not this PRE-DRAFT's paraphrase).
- [ ] **`app/(dashboard)/settings/*` confirmed still holding the OLD page bodies** — not yet
      touched by Session 9-4 (confirmed via that session's own route-manifest diff showing zero
      changes under `settings/`).
- [ ] **`app/(dashboard)/layout.tsx`'s current (restored, legacy) form re-read directly** — do not
      assume Session 9-4's own CLAUDE.md description is current; confirm live.
- [ ] Test credentials confirmed still working (PRO/FREE/ADMIN quick-fill).
- [ ] Sequential test suite baselines green (`LESSONS-LEARNED.md` L24) — monolith `tsc`/`npx
  eslint app components lib hooks --max-warnings 5`/`test:ci`, then money-service (use
      `--maxWorkers=1` if a shared-resource run shows worker OOM — Session 9-4's own finding, not
      a real regression), then operation-service, run one at a time, not in parallel.
- [ ] **`DECISION-LOG.md` F21's product decision (hard-delete vs anonymize) obtained from Davin**
      before this session's `settings/account` deletion-request UI is built.

---

## Ordered steps

_(candidate — the Advisor may reorder/restructure freely per the UI-BUILD dial)_

1. **Resolve Open Questions 1-4 before touching any page file** — the layout-chrome question
   affects every one of the 11 pages' own wrapper structure.
2. **Build/restyle `app/(dashboard)/settings/layout.tsx`** (or its top-level replacement, per
   however Open Question 1 resolves) — settings nav, active-tab highlighting.
3. **Port the 11 settings pages' bodies from `seed-code/`**, preserving real API bindings —
   apply the same "read both trees before assuming a visual-only port" discipline every Phase 9
   session has had to apply so far.
4. **Close F21** — account-deletion UI, gated on Davin's product decision (Open Question 3).
5. **Close F64** — re-verify `subscription-card.tsx`'s current implementation (Open Question 2),
   fix the optimistic-undo reactivation gap or retire the component per whatever the live code
   shows.
6. **Live authenticated click-through** — all 11 pages, appearance accent-persist round trip,
   language/timezone real preference writes, 2FA setup/verify/disable, session list + revoke,
   account deletion request (test-safe path only), billing cancel + undo (if F64's fix lands).
7. **Route-manifest diff** — confirm exactly this session's own 11 rows' worth of URLs
   added/changed and nothing else; explicit re-check that `/admin/*` (9-8's own scope) is
   untouched, mirroring the exact live-browser check Session 9-4 had to add mid-session.

---

## Rules specific to this variant

- **UI creativity: High** for page-body content/layout. `/settings/appearance` and
  `/settings/help` are Protected Pages #5/#6 — 100% fidelity to Codebase 2's approved design,
  non-negotiable (same invariant Session 9-4's Decision 5 already established for
  `/dashboard`/`/terminal`/`/free`).
- **Zero on data:** every page binds to the real endpoint its own route-map row names.
- **Live-verify chrome with a real browser, not just `tsc`/`test:ci`.** Session 9-4's own
  highest-cost finding: removing/relocating a shared layout's chrome broke pages outside that
  session's own file diff in a way no static check could catch. Whatever Open Question 1 resolves
  to, browser-check `/admin/*` specifically before closing this session, not just the 11 pages
  this session owns.
- A11y from the start — 9-2/9-3 both found real `htmlFor`/`id` gaps in ported forms; settings has
  the highest form density of any Phase 9 session so far.
- Record design decisions in Deviations.

---

## Done when

- [ ] All 11 settings pages live with DavinTrade content, consuming whatever layout boundary Open
      Question 1 resolves to.
- [ ] `/settings/appearance` and `/settings/help` faithfully match Protected Pages design specs.
- [ ] F21 and F64 both closed in `DECISION-LOG.md`, with Davin's product decision recorded for F21.
- [ ] Real 2FA setup/disable, session list/revoke, account deletion request, and billing
      cancel — all live-verified end-to-end with real test credentials.
- [ ] No double-chrome regression on any of the 11 pages, **and** `/admin/*` confirmed unaffected
      by whatever this session does to `app/(dashboard)/layout.tsx` or its own settings layout.
- [ ] Route-manifest diff matches this session's own rows and nothing else.
- [ ] `tsc`/`eslint`/`test:ci` (monolith, money-service, operation-service) all green.

---

## Rollback

`git revert` of this session's commits — no cutover flag (Phase 9 ships progressively on `main`
per F66). Prefer one commit per logical group (layout / settings pages / F21 fix / F64 fix) so a
bad step can be reverted without losing the good ones.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

_(DRAFT order for Session 9-6 — Payments flow, UI-BUILD + PORT, deliberately cross-boundary per
`MASTER-ROADMAP-PHASES-7-15.md` §3)_
