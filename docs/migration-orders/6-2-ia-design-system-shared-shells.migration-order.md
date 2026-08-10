# Migration Order — Session 6-2 — IA + Design System + Shared Shells

> For a session that **fixes information architecture and navigation across FREE/PRO, admin, and
> public surfaces** — no cross-stack PORT, no flags, no new backend endpoints. Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **High for layout/nav/component structure, Low for data** (every
> page touched here already has a real, live data source — this session is IA and plumbing, not
> a fresh wire-up). Everything named below is sourced from `docs/migration-orders/
phase-6-frontend-gap-matrix.md`'s own rows tagged "→ 6-2" — re-verify each at CONFIRM per
> `LESSONS-LEARNED.md` L27, the same discipline 6-1b's own CONFIRM used.

**Session:** 6-2 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (adapted, no
flags) · **Status:** PRE-DRAFT · **Generated:** 2026-08-10 (at Session 6-1b close) ·
**Flags touched:** none · **Estimated time:** ~4-6h (structurally the largest Phase 6 session so
far — F62's own resolution alone is "structurally hard to undo")
**Surface:** `app/admin/*` + `app/(dashboard)/admin/*` (nav/IA only), `components/layout/
{sidebar,mobile-nav}.tsx`, `app/(dashboard)/settings/page.tsx` (grid links only), `app/
not-found.tsx` (new), `app/global-error.tsx` (new), `middleware.ts` (matcher only), `app/
(marketing)/layout.tsx` (nav only) · **Feeds on:** no new endpoints — every page this session
touches already has a real backend behind it (or, for admin, needs a nav path to reach a page that
already exists).

---

## Context

This is the direct follow-on to Session 6-1's gap matrix and Session 6-1b's mock-data fixes.
Every row below is a genuine, independently re-verified finding (Session 6-1's own CONFIRM),
not a proposal:

- **F62 (`DECISION-LOG.md`, OPEN, owner Davin):** admin pages exist in two incompatible trees —
  `app/(dashboard)/admin/*` (15 pages, guarded by `app/(dashboard)/layout.tsx`'s
  `getServerSession()` check, 4-entry nav: `/admin`, `/admin/api-usage`, `/admin/errors`,
  `/admin/users`) and `app/admin/*` (8 pages: `affiliates`, `affiliates/[id]`, `affiliates/
reports/{code-inventory,commission-owings,profit-loss,sales-performance}`, `settings/affiliate`,
  plus `login` — **no shared `layout.tsx` at all**, no guard, no nav). **19 of 23 admin pages are
  unreachable from the admin nav.** `middleware.ts`'s matcher (`/dashboard/:path*`,
  `/alerts/:path*`, `/charts/:path*`, `/settings/:path*`) doesn't cover `/admin` or `/affiliate`
  at all — deliberate per an existing code comment (layout-level guard instead), but worth
  re-confirming that's still the intended mechanism once the trees are touched.
- **A1-3(b):** `/admin`'s nav has no link to `/admin/affiliates`, `/admin/disbursement`,
  `/admin/fraud-alerts`, or `/admin/settings/affiliate`.
- **A1-4(b):** `/settings`'s grid links to only 4 of 9 real subpages (`appearance`, `billing`,
  `privacy`, `profile`) — `account`, `security`, `help`, `language`, `terms` all exist as real
  pages and are simply unlinked.
- **A1-12:** `components/layout/sidebar.tsx` and `mobile-nav.tsx` both link to `/analytics` and
  `/indicators`, neither of which exists as a page.
- **A1-18 (nav half only — destination pages are 6-10's job):** `(marketing)/layout.tsx`'s
  footer links to 10 paths, most of which don't exist yet (`/about`, `/blog`, `/careers`,
  `/changelog`, `/docs`, `/help`, `/affiliate`, `/disclaimer` — `/terms`/`/privacy` also missing,
  tracked separately as F63); `register-form.tsx`'s consent checkbox links to two of them.
- **B1-1 / B1-2:** `app/not-found.tsx` and `app/global-error.tsx` don't exist — Next.js falls
  back to its own generic defaults for both.
- **C-3:** 14 dead internal links, individually confirmed missing at the top-level route (see the
  matrix's own C-3 row for the full list).

## User Review Required

> [!IMPORTANT]
> **F62 is this session's real entry criterion, not a finding to work around.** Per
> `EXECUTOR-PROTOCOL.md`'s Rules ("Davin's call to resolve, not the Executor's"), this PRE-DRAFT
> does NOT pick an admin-tree consolidation approach. Three options, not exhaustive — Davin/the
> Advisor should choose or propose another before this order reaches DRAFT:
>
> - **(a) Merge `app/admin/*` into `app/(dashboard)/admin/*`** — move all 8 pages under the
>   existing guarded tree, delete `app/admin/*`, `app/admin/login` becomes redundant with however
>   the dashboard's own auth entry point works today (needs checking, not assumed).
> - **(b) Give `app/admin/*` its own `layout.tsx`** (guard + nav matching `(dashboard)/admin`'s
>   own pattern) and cross-link both trees' navs to each other, keeping them as two trees.
> - **(c) Something else Davin prefers** — e.g. a single top-level `/admin` route group spanning
>   both, if that's a smaller diff than it looks once someone reads both layouts in full.
>
> Whichever is chosen determines whether `middleware.ts`'s matcher needs a new `/admin/:path*`
> entry (C-2) or stays layout-guard-only by design — don't assume either without re-reading
> `middleware.ts`'s own existing comment on why admin was excluded.

> [!NOTE]
> **B2-13 (`/welcome` onboarding) is explicitly NOT in this session's committed scope.** The
> matrix's own row flags it "doesn't fit cleanly... recommend 6-2 (IA) or its own slot" — a
> genuine open question, not a decided assignment. Confirm with Davin/the Advisor before
> including it; if undecided, leave it out and let a future session pick it up.

> [!NOTE]
> **A1-18's "6-2 (nav)" half may end up being near-zero-scope.** Most of the 10 footer
> destinations don't exist until 6-10 — before adding/removing any footer link, check whether the
> honest fix here is "link only to what exists today" (small, real, in-scope) vs. "wait for 6-10"
> (nothing to do here at all). Don't build placeholder destination pages to make links valid —
> that's exactly 6-10's job, not this session's.

## Entry criteria

- [ ] Session 6-1b CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [ ] `DECISION-LOG.md` F62 resolved (Davin) — admin-tree consolidation approach chosen. **Hard
      block — do not CONFIRM this order until this is answered.**
- [ ] Every matrix row cited above (F62/C-1/C-2, A1-3(b), A1-4(b), A1-12, A1-18-nav, B1-1, B1-2,
      C-3) re-verified at CONFIRM against live code, not assumed still-accurate from Session 6-1's
      own re-check (per `LESSONS-LEARNED.md` L27 — this order was drafted the same day as 6-1's
      CONFIRM, so drift risk is low, but re-verify anyway).
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0`, `test:ci` — last known: 133/133 suites, 2206/2206 tests, 3 pre-existing lint
      warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — **not fast-path eligible**, per F62's
      own "structurally hard to undo" framing and this session's real blast radius (touches the
      admin auth/nav surface every admin page depends on).

## Ordered steps (dependency order — foundational, low-risk pieces first; the F62-gated admin

tree consolidation last, since it's the one genuinely hard-to-undo piece)

1. **`app/not-found.tsx` + `app/global-error.tsx`** (B1-1, B1-2) — standard Next.js 16 App
   Router files, no dependency on anything else this session touches. Match the existing design
   system (`components/ui/*`), not a bespoke one-off.
   _Verify:_ a genuinely unmatched route renders the new 404, not Next's generic default; a
   thrown error in a page renders the new global-error boundary.
2. **`/settings` grid completion** (A1-4b) — add the 5 missing links (`account`, `security`,
   `help`, `language`, `terms`) to the existing grid, matching its current card style exactly.
   _Verify:_ all 9 subpages reachable from `/settings`; no layout regression on the 4 existing
   links.
3. **Dead nav-link removal** (A1-12, C-3) — remove `/analytics`/`/indicators` from
   `sidebar.tsx`/`mobile-nav.tsx`; audit the other 12 of the 14 dead links from C-3 (2 are
   `/terms`/`/privacy`, tracked under F63/6-10, not this step) and remove or fix each at its
   real source file.
   _Verify:_ no remaining link (nav, footer, in-page) points at a route that returns a real 404 —
   except where F63/6-10 ownership means leaving it as a deliberate, tracked gap, not a silent
   fix.
4. **`(marketing)/layout.tsx` footer nav** (A1-18, nav half only) — per the User-Review note
   above, resolve to either "link only to what's real today" or "no-op, deferred to 6-10" — a
   real decision, not a default.
5. **Admin tree consolidation** (F62/C-1/C-2, A1-3b) — execute whichever option Davin chose at
   Entry Criteria. Rebuild the admin nav to cover all sections regardless of which structural
   option wins. Update `middleware.ts`'s matcher only if the chosen option needs it — confirm the
   existing exclusion comment's reasoning before touching it either way.
   _Verify:_ all 23 admin pages reachable from the admin nav (or a documented, deliberate
   exception); a non-admin user hitting any admin URL gets the same denial behavior as today,
   not a regression.

## Rules specific to this variant

- Creativity on layout/nav/IA is expected and welcome — but every design decision goes in
  Deviations with its why, per the UI-BUILD template's own rule, so 6-3 through 6-12 inherit a
  coherent system rather than rediscovering the same questions.
- No new backend endpoints, no new Prisma queries — every page here already has real data
  (Session 6-1b closed that gap for the 4 pages that didn't).
- Money/tier/role data still renders exactly as the backend returns it — this session doesn't
  touch any data-fetching logic, only navigation and structure.
- A11y from the start on anything new (`not-found.tsx`, `global-error.tsx`, any new nav markup),
  not deferred to 6-12's own cleanup pass.

## Done when

- [ ] `app/not-found.tsx` + `app/global-error.tsx` live and correctly triggered.
- [ ] `/settings` grid links to all 9 real subpages.
- [ ] Zero remaining `/analytics`/`/indicators` nav references; C-3's dead links resolved or
      explicitly deferred to F63/6-10 with no silent gaps.
- [ ] F62 resolved and executed — all 23 admin pages reachable from nav (or documented exception);
      `middleware.ts` matcher decision made deliberately, not left as an accidental gap.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green,
      count recorded.
- [ ] Live manual check with a real admin session (carries forward 6-1b's own undone item —
      this session is the first realistic opportunity to also close Waiting-on #117, since it's
      the first session that needs a real admin browser session to verify its own nav changes
      anyway).

## Rollback

No flag (same as 6-1b — this is same-stack navigation/IA work, not a cutover). Rollback is
`git revert` of the relevant commit(s); the admin-tree consolidation step should be its own
commit specifically so it can be reverted independently of the smaller, safer steps if needed.

## Retire

`app/admin/*`'s current file locations may be deleted as part of Step 5 if Option (a) is chosen —
record exactly which files moved vs. deleted vs. newly created in Deviations, not just "merged."

## Deviations

_(filled during execution)_

## Next-session handoff

Session **6-3** (alerts/charts) is next in the Phase 6 order per the matrix (A1-11's own target).
Carries forward from 6-1b: the deferred live-manual-check (Waiting-on #117) and `DECISION-LOG.md`
F64 (`subscription-card.tsx` undo bug) — neither blocks 6-3, both still need a home.
