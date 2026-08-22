# Migration Order — Session 9-1 — Root Shell & Design System

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for layout/component/interaction design, but
> **Low** for the two root-boundary pages this session ports (Batch-0 already fixed their parity
> gaps in codebase 2 itself — see Step 1). **PRE-DRAFTed by the Executor at Session 9-0's close
> (2026-08-22)**, informed by `frontend-swap-route-map.md` and a fresh read of
> `codebase-2-parity-audit/batch-0-shared-shell.md`. Per PD1, `Decisions taken` below is
> deliberately left as open questions with evidence, not decisions — that's the Advisor's job at
> DRAFT.

**Session:** 9-1 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD (dial HIGH
for shell/design work, LOW for the two already-fixed root boundaries) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-0's close) · **Flags touched:** none new
(F65/F66 already RESOLVED at 9-0) · **Estimated time:** roadmap estimate ~4h; this PRE-DRAFT's
own finding below (Protected-page entanglement + a real Tailwind major-version gap) makes that
estimate optimistic — flagged for the Advisor to re-budget, not silently accepted.
**Surface:** `app/layout.tsx`, `app/providers.tsx`, `app/globals.css` design tokens, Tailwind
config, fonts, brand assets, `theme-provider`, the appearance engine wiring, `AppHeader`/
`ChatSidebar`/marketing header+footer, `app/not-found.tsx` + `app/global-error.tsx` (+ `app/
error.tsx`, present in the monolith but absent from the 97-row census — see Open Question 4).
**Feeds on:** `lib/appearance/server-appearance.ts` + `UserAppearance` Prisma model (real,
already-built backend, confirmed live this session), `lib/tier-config.ts` (confirmed
structurally compliant between both trees by the parity audit, no fix needed here).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and this table's own reason 1: "nothing else can be
migrated before this lands" — every other Phase 9 session renders inside the shell, header, and
sidebar this session builds. `frontend-swap-route-map.md` (Session 9-0's own deliverable) assigns
this session exactly 2 direct rows (92: `app/global-error.tsx`, 93: `app/not-found.tsx`) plus 6
wholesale gaps from that same document's §5 (NextAuth/session hydration, `middleware.ts` auth
gating, i18n provider wiring, root error/loading boundaries, and 4 of the 5 Batch-0 findings).

**This PRE-DRAFT exists to hand the Advisor two things a document review alone can't produce:**
live-code-verified specifics on those 6 gaps (not the route-map's own one-line summaries), and one
finding the route-map's own gap inventory got wrong — see Open Question 2 below.

---

## Decisions taken

<!-- Left as open questions with evidence, not decisions — PD1: the Advisor decides from
     documents at DRAFT, not the Executor at PRE-DRAFT. Two of these (OQ2, OQ3) are corrections
     to claims this session's own predecessor (9-0) made; both are disclosed here rather than
     silently patched into `frontend-swap-route-map.md` after the fact, since that file is
     already Davin-approved as this phase's binding contract. -->

**Open Question 1 — the 6 Protected pages constraint, not previously surfaced in any Phase 9
artifact.** `codebase-2-parity-audit/00-MASTER-PLAN.md` (via `batch-0-shared-shell.md` §0) records
that Davin confirmed live on 2026-08-17: `/`, `/terminal`, `/free`, `/dashboard`,
`/settings/appearance`, `/settings/help` are **Protected — never modify, not even as a side
effect of a shared-component change**, because they're "already fully designed." Every one of
these 6 pages renders through `AppHeader`/`ChatSidebar` — the exact components this session must
build/port. **This is a real constraint on this session's own scope that neither
`frontend-swap-route-map.md` nor the roadmap's own 9-1 description mentions.** The Advisor needs
to decide how 9-1's shell work respects this: ship the new shell chrome in a way that is
byte-for-byte visually identical on those 6 pages (verified via screenshot diff, not just "looks
about right"), or explicitly re-confirm with Davin whether the Protected-page designation still
holds now that the shell itself is being rebuilt around them.

**Open Question 2 — correcting `frontend-swap-route-map.md` §5, gap 6e.** That document's own gap
inventory describes the 38-file "Light Clean Mode hardcoded-dark" bug as owned "distributed —
each session fixes its own files as it ports them." Having now read `batch-0-shared-shell.md`
directly (not available to 9-0 as a summary, only as a citation), that framing is wrong: the
bug's own root files (`chat-sidebar.tsx`, `app-header.tsx`, `chat-panel.tsx`,
`market-comments-panel.tsx`, `settings/layout.tsx`) render on **5 of the 6 Protected pages**, so
no single downstream session can "fix its own files" without touching shared chrome this session
owns. The parity audit's own author recommended this become "its own decision from Davin" — either
a coordinated fix scoped explicitly against the 6 Protected pages' current appearance, or an
explicit call that Light Clean Mode stays dark-chrome-only for now. Recommend the Advisor either
scope that decision into this session (it owns the shared chrome anyway) or register it as a new
flag (`F77`?) with its own session, rather than let 8 future sessions independently rediscover the
same entanglement problem this document already solved.

**Open Question 3 — Tailwind major-version gap between the two trees, not previously flagged
anywhere in Phase 9 planning.** Confirmed live this session: the monolith is pinned to
`tailwindcss@^3.3.0` (classic JS `tailwind.config.ts`, read this session — extends colors via
oklch in a `theme.extend` block); codebase 2 is on `tailwindcss@^4.1.9` (CSS-first `@theme`
tokens inside `app/globals.css`, no `tailwind.config.ts` at all, `postcss.config.mjs` instead).
This is a real dependency-version decision, not just a file-move: does 9-1 upgrade the monolith to
Tailwind v4 (its own migration risk — v3→v4 is a documented breaking change, arguably warrants
`TEMPLATE-UPGRADE.md`'s own dial rather than being absorbed silently into a UI-BUILD session), or
does codebase 2's CSS get adapted back onto v3's config-file model (loses v4's CSS-first tokens,
more porting work, but avoids a version bump touching all 85 existing pages at once)? Neither
`frontend-swap-route-map.md` nor the roadmap's own Phase-9 description names this decision.

**Open Question 4 — `app/error.tsx` exists in the monolith but has no row in the 97-row census.**
Confirmed live: `app/error.tsx` is a real, existing file in the main repo (route-segment error
boundary, distinct from `app/global-error.tsx`'s root-layout-level boundary). The roadmap's own
9-1 scope line lists "the three root boundaries (`not-found.tsx`, `error.tsx`, `global-error.tsx`)"
but `frontend-swap-route-map.md` only carries rows for 2 of the 3 (92, 93) — `error.tsx` was
never in the source xlsx census at all, so 9-0's own "zero unmapped rows" claim is accurate for
the census it walked, but the census itself has this one gap. Does 9-1 port/restyle the existing
`app/error.tsx` to DavinTrade branding (no codebase-2 counterpart exists to source from, since it
was never in the census), or leave it as-is? Low-stakes either way, but needs an explicit call so
it isn't silently forgotten a second time.

---

## Entry criteria (draft — re-verify all at CONFIRM)

- [ ] Session 9-0 CONFIRMED, executed, CLOSED — `frontend-swap-route-map.md` exists and committed;
      F65/F66 RESOLVED in `DECISION-LOG.md`.
- [ ] **Protected-pages list re-confirmed live** against `codebase-2-parity-audit/00-MASTER-PLAN.md`
      §0 (this PRE-DRAFT cites `batch-0-shared-shell.md`'s own restatement of it — read the
      primary source at CONFIRM, not this secondhand citation, per `LESSONS-LEARNED.md` L22).
- [ ] **Batch-0's own two "Fixed" rows re-verified still fixed** in codebase 2 at CONFIRM time
      (`app/global-error.tsx`'s mailto line, `app/not-found.tsx`'s 3-action button set) — that
      work already happened once; re-verify it wasn't reverted by any later `seed-code/` edit
      before treating Step 1 as a pure port with no redesign needed.
- [ ] **`seed-code/` still read-only except the two rows this session's predecessor already
      confirmed as Davin's intentional in-progress edits** (`affiliate/dashboard/payouts` +
      `statements`, unrelated to this session's own surface) — fresh `git status seed-code/`
      should show only those two files modified, or an explanation if not.
- [ ] Monolith `tsc`/`eslint`/`test:ci` baseline re-measured at CONFIRM, sequential per L24
      (last known: `tsc` clean, `eslint` 0 errors/5 warnings via `npx eslint` — not `npm run
    lint`, see `LESSONS-LEARNED.md` L38 — `test:ci` 160/160 suites/2400/2400 tests).

---

## Ordered steps

_(candidate — the Advisor may reorder/restructure freely per the UI-BUILD dial; each step still
needs its own investigate → build → verify shape)_

1. **Port the two already-fixed root boundaries (Rows 92, 93).** Batch-0's own parity pass
   already brought codebase 2's `global-error.tsx`/`not-found.tsx` to full Rule-1 parity with the
   monolith (added the missing mailto contact-support line; added the 2 missing action buttons).
   This step is closer to PORT than UI-BUILD for these two files specifically — copy the
   already-fixed codebase-2 versions into the main repo root, adjusting only import paths.
   Decide `app/error.tsx`'s fate here too (Open Question 4).
   _Verify:_ unmatched route renders the 3-action 404; a forced render error renders the global
   boundary with its mailto link; `next build` clean.
2. **Resolve the Tailwind version question (Open Question 3) before touching any token file** —
   whichever the Advisor/Davin decides, this session's entire design-token work depends on it.
   _Verify:_ a plausible smoke check (one Protected page's computed styles unchanged) before
   committing to the chosen direction.
3. **Root shell + providers.** Port `app/layout.tsx`, `app/providers.tsx`,
   `theme-provider`/`appearance-provider.tsx` wired to the REAL `lib/appearance/
server-appearance.ts` + `UserAppearance` backend (confirmed live this session — do not re-invent,
   the backend already exists and already works). Wire NextAuth `SessionProvider` (gap #1 from
   the route map's own §5) — this is the dependency every other Phase 9 session needs before
   their own auth gates can be real.
4. **`AppHeader`/`ChatSidebar`/marketing header+footer**, built against Open Question 1's
   resolution (the Protected-page constraint). Delete `components/header.tsx` if Davin gives
   explicit go-ahead this session (confirmed dead, zero import sites, a prior batch already tried
   and had to revert for lack of that explicit sign-off — see the parity audit's own note).
5. **`middleware.ts` auth/session gating** — currently a real, working locale-rewrite (see
   `frontend-swap-route-map.md` §3.1 correction) with zero auth logic. Port the monolith's real
   gating rules (dashboard/alerts/settings/admin/notifications/affiliate redirect-to-login,
   `/admin/*` role gate, ADMIN-away-from-`/affiliate` redirect) onto the locale-aware rewrite
   already in place — do not replace it outright. Carve out the Protected `/settings/appearance`
   and `/settings/help` paths correctly within the broader `/settings/*` gate, per the parity
   audit's own explicit warning about this exact carve-out being easy to get wrong.
6. **Accent-foreground contrast fix (Batch-0 finding, quantified: ~2.2:1 vs ~4.5:1 WCAG AA in
   light mode)** and the sidebar-missing-Help-item fix (Batch-0 finding) — both entangled with
   Protected pages per Open Question 1/2's own reasoning; scope the fix against verified
   Protected-page visual equivalence, not just "looks fine."
7. **Support-email domain consistency** (`support@davintrade.com` vs `support@davin-trade.com`) —
   pick one (Batch-0 already used the non-hyphenated form in its own fix; the Protected
   `/settings/help` page is the one holdout using the hyphenated form and can't be touched without
   Open Question 1's own sign-off).
8. **Root error/loading boundaries beyond the two ported in Step 1** — `loading.tsx` at the root,
   per the route map's own gap #5.

---

## Rules specific to this variant

- **UI creativity: High** for shell/header/sidebar/design-token work — propose freely on layout,
  component structure, interaction. **Low** for Step 1's two files — they're already
  parity-fixed in codebase 2, port them, don't redesign them again.
- **The 6 Protected pages are the hard constraint of this entire session** (Open Question 1) —
  every step above that touches shared chrome must be checked against them before being called
  done, not just before being merged.
- A11y from the start (the accent-foreground fix in Step 6 is exactly this kind of issue, not a
  cleanup deferred to later).
- Record every design decision in Deviations, same as every UI-BUILD session before this one —
  they inform 9-2 through 9-9's own shell consumption.

---

## Done when

- [ ] `app/not-found.tsx` + `app/global-error.tsx` live in the main repo, matching codebase 2's
      already-parity-fixed versions; `app/error.tsx`'s fate (Open Question 4) explicitly decided,
      not silently skipped a second time.
- [ ] Tailwind version question (Open Question 3) resolved and recorded, not left implicit in
      whichever config file happens to exist after this session.
- [ ] Root shell + providers + real appearance-engine wiring live; `SessionProvider` in place.
- [ ] `AppHeader`/`ChatSidebar`/marketing header+footer live, verified pixel-equivalent (not just
      "looks right") on all 6 Protected pages.
- [ ] `middleware.ts` carries real auth/session gating on top of its existing (unremoved)
      locale-rewrite logic, with the Protected-page carve-outs correct.
- [ ] Accent-foreground contrast, sidebar Help item, dead `components/header.tsx` (if authorized),
      and email-domain consistency all resolved or explicitly re-deferred with a named owner.
- [ ] Route-manifest diff matches this session's own layout-boundary row and nothing else (per
      roadmap §Phase-9-preamble's own per-session exit check) — no stray `app/about/` etc.
      surviving beside a new grouped route.
- [ ] `tsc`/`eslint`/`test:ci` all green; `next build` clean.

---

## Rollback

Not applicable in the traditional flag-flip sense (no cutover flag — Phase 9 sessions ship on
`main` per F66's progressive-replacement decision). Rollback is `git revert` of this session's
commits; because Step 3-5 touch the root shell every other route renders through, prefer one
commit per step (matching the precedent set by every prior UI-BUILD session) so a bad step can be
reverted without losing the good ones.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-2` — `(marketing)` 12 + `(public)` 2 (UI-BUILD). Per
  `frontend-swap-route-map.md`, this session's own 14 rows (1-2, 3-4, 52-54, 63-64, 66, 69-70,
  84-85, 91) are all NON-LOGIN, verifiable without the no-test-credentials gap (Waiting-on #117)
  — the roadmap's own stated reason for running it second. Depends entirely on 9-1's shell/design
  tokens/marketing header+footer landing first.
- **Prerequisite:** 9-1 CLOSED — all 4 "Done when" shell/chrome items live, route-manifest diff
  clean, Protected pages visually unchanged.
