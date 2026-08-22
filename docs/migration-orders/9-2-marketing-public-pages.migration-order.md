# Migration Order — Session 9-2 — `(marketing)` 12 + `(public)` 2

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-1's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-1's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-2 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD (dial HIGH
for page bodies, ZERO on data) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-1's close) · **Flags touched:** none new
**Surface:** `app/(marketing)/{page.tsx,about,blog,careers,changelog,disclaimer,docs,help,
pricing,privacy,status,terms}` (12 pages, route group already exists, currently holds the OLD
"Trading Alerts" page bodies) · `app/(public)/settings/account/delete/{cancel,confirm}/page.tsx`
(2 pages — see Open Question 1 on the actual target path).
**Feeds on:** `MarketingNavbar`/`MarketingFooter` (built Session 9-1, already theme-reactive),
`GET /api/status` (row 84/91), `GET /api/subscription` + Stripe price env vars (row 69),
`GET/POST /api/user/account/deletion-{cancel,confirm}` (rows 3-4, already exist and match the
route-map's cited backing endpoints — only the PAGE path is in question, not the API).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: these are the only pages that render without a session,
so they're verifiable end-to-end while the no-test-credentials gap is closed for other tiers —
deliberately second, right after the shell. `frontend-swap-route-map.md` assigns this session
14 rows (1-2, 3-4, 52-54, 63-64, 66, 69-70, 84-85, 91), 9 of them static (no backend at all) and
sized `9S/5M` — under the playbook's ~4h threshold per the route-map's own §7 sizing table.

---

## Decisions taken

<!-- Left as open questions with evidence, not decisions — PD1: the Advisor decides from
     documents at DRAFT, not the Executor at PRE-DRAFT. -->

**Open Question 1 — the route-map's target path for rows 3-4 doesn't match live code.**
`frontend-swap-route-map.md` rows 3/4 name the main-repo target as
`app/account/deletion-cancel/page.tsx` / `app/account/deletion-confirm/page.tsx` (no `/settings`
prefix). Live `ls` this session shows the pages actually live at
`app/(public)/settings/account/delete/cancel/page.tsx` and `.../delete/confirm/page.tsx` — and
`middleware.ts`'s `PUBLIC_SETTINGS_PATHS` allowlist (built Session 6-5, confirmed still in place
after 9-1's own middleware merge) is keyed on exactly THIS path
(`/settings/account/delete/confirm`, `/settings/account/delete/cancel`), not the route-map's
named target. The backing API routes (`app/api/user/account/deletion-{cancel,confirm}`) DO exist
at the route-map's cited path, so only the PAGE URL is in question, not the endpoint. Given the
roadmap's own standing rule ("every codebase-2 URL must match codebase 1 exactly" — codebase 1 is
the URL authority), this reads as a stale/incorrect target column in the route-map rather than an
intended URL change — recommend keeping the existing `/settings/account/delete/{cancel,confirm}`
URLs (port codebase-2's page body into the EXISTING page files) rather than moving the route or
touching `middleware.ts`'s allowlist. Needs an explicit call, and if confirmed, `frontend-swap-
route-map.md` rows 3-4 should be corrected with a dated addendum (same pattern 9-0/9-1 used for
their own corrections) so 9-3+ don't inherit the same wrong citation.

**Open Question 2 — row 69 (`/pricing`) re-verification scope.** The route-map marks this row
"9-2 (re-verified in 9-6 flow)" and its Backing API column cites `GET /api/subscription` plus
"Stripe price IDs from env — see F66 Stripe-catalog decision." F66 (RESOLVED, Session 9-0) already
settled that live Stripe Dashboard objects stay untouched in code — checkout UI renders
"DavinTrade Pro" bound to the existing `STRIPE_PRO_MONTHLY_PRICE_ID`. Does 9-2 wire the real
`GET /api/subscription` call now (full port), or ship the pricing page's static tier-comparison
content now and defer the live-subscription-aware bits (e.g. "you're already on PRO") to 9-6's own
end-to-end payments-flow pass, since 9-6 re-verifies this exact page anyway? Low-stakes either way
but affects this session's own step ordering.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] Session 9-1 CONFIRMED, executed, CLOSED — root shell, `MarketingNavbar`/`MarketingFooter`,
      design tokens, and providers live on `main`.
- [ ] **Route-map rows 1-2, 3-4, 52-54, 63-64, 66, 69-70, 84-85, 91 re-read directly** (not this
      PRE-DRAFT's paraphrase) — confirm no further drift beyond Open Question 1 above.
- [ ] **`app/(marketing)/*` and `app/(public)/settings/account/delete/*` confirmed still holding
      the OLD page bodies** (i.e., no other session touched them between 9-1's close and this
      session's start).
- [ ] `GET /api/status`, `GET /api/subscription`, `GET/POST /api/user/account/deletion-{cancel,
    confirm}` confirmed live and contract-tested (or staging-live).
- [ ] Sequential test suite baselines green (`LESSONS-LEARNED.md` L24) — monolith `tsc`/`npx
    eslint app components lib hooks --max-warnings 5`/`test:ci`, then money-service, then
      operation-service, run one at a time, not in parallel.

---

## Ordered steps

_(candidate — the Advisor may reorder/restructure freely per the UI-BUILD dial)_

1. **Resolve Open Questions 1-2 before touching any page file** — both affect which files this
   session actually edits.
2. **Static pages first (9 of 14 rows, no backend at all):** `/`, `/about`, `/blog`, `/careers`,
   `/changelog`, `/disclaimer`, `/docs`, `/help`, `/privacy`, `/terms` — port codebase-2's page
   body into the existing `app/(marketing)/*` route files, consuming `MarketingNavbar`/
   `MarketingFooter` from 9-1 via `app/(marketing)/layout.tsx`. _Verify:_ each page renders with
   DavinTrade content/branding, `tsc` clean.
3. **`/status` (rows 84 + 91, one page, two nav references):** wire `GET /api/status` for real
   health/uptime/dependency display — no mock data. _Verify:_ live API response reflected on
   page, not a hardcoded "All Systems Operational."
4. **`/pricing` (row 69):** scope per Open Question 2's resolution.
5. **The 2 `(public)` account-deletion pages (rows 3-4):** port codebase-2's page bodies into
   whichever file path Open Question 1 resolves to; verify the token-based, no-session flow still
   works unauthenticated (these are in `middleware.ts`'s `PUBLIC_SETTINGS_PATHS` allowlist —
   don't accidentally regress that).
6. **Route-manifest diff** — confirm zero URLs added/removed/changed beyond this session's own
   14 rows (per the roadmap's own per-session exit check).

---

## Rules specific to this variant

- **UI creativity: High** for page-body content/layout — these pages have no Protected-page
  constraint (none of the 6 Protected pages are in this session's scope).
- **Zero on data:** every page binds to the real endpoint its own route-map row names, or ships
  static content where the row says `static (no API)` — no fabricated/mock dynamic data.
- A11y from the start, not deferred.
- Record design decisions in Deviations — they inform 9-3 onward's own page-body work.

---

## Done when

- [ ] All 12 `(marketing)` pages + 2 `(public)` account-deletion pages live with DavinTrade
      content, consuming 9-1's shared chrome.
- [ ] `/status` bound to the real `GET /api/status`, no mock data.
- [ ] `/pricing` scoped per Open Question 2's resolution, recorded not silently decided.
- [ ] Account-deletion pages verified reachable unauthenticated (token-based flow intact).
- [ ] Route-manifest diff matches this session's own 14 rows and nothing else.
- [ ] `tsc`/`eslint`/`test:ci` all green.

---

## Rollback

`git revert` of this session's commits — no cutover flag (Phase 9 ships progressively on `main`
per F66). Prefer one commit per logical group (static pages / `/status` / `/pricing` / account
deletion) so a bad step can be reverted without losing the good ones.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-3` — `(auth)` 7 (UI-BUILD). login, register, forgot/reset password,
  verify-2fa, verify-email(+pending). Binds to the real NextAuth bridge
  (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`, F56) — **this session unblocks live verification for every
  session after it** (Waiting-on #117's no-test-credentials gap becomes an active requirement
  starting here, per 9-0's own scoping).
- **Prerequisite:** 9-2 CLOSED — marketing/public pages live, route-manifest diff clean.
