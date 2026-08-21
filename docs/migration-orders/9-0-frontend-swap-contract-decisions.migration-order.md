# Migration Order — Session 9-0 — Frontend Swap Contract & Decisions

> For sessions whose output is a **document or decision**, not running code: read
> `00-SKELETON-AND-RULES.md` first — §4 autonomy clause applies. **Creativity dial: Medium**
> (how you investigate is yours; what counts as evidence is not).
> PRE-DRAFTed by the Executor at Session 4A-15's close (2026-08-21), per
> `MASTER-ROADMAP-PHASES-7-15.md`'s own per-phase trigger table ("4A-15 writes phase-9's").
> Resolves `DECISION-LOG.md` **F65** (⚠ NEEDS EXPLICIT SIGN-OFF) and **F66**, opening Phase 9
> (Frontend Stack Replacement).

**Session:** 9-0 (Frontend Swap Contract & Decisions) · **Variant:** CONTRACT · **Status:** PRE-DRAFT
**Generated:** 2026-08-21 (Executor, at Session 4A-15's close)
**Flags touched:** F65 (OPEN → target RESOLVED, ⚠ NEEDS EXPLICIT SIGN-OFF), F66 (OPEN → target RESOLVED)
**Target artifact:** `docs/migration-orders/frontend-swap-route-map.md` (new) — no application code
this session.
**Estimated time:** unestimated — first CONTRACT session of a new phase, scope is genuinely
open until F65/F66 are resolved and the route census is actually walked.

---

## Decisions taken

<!-- Left deliberately unresolved in this PRE-DRAFT — F65 and F66 are both explicitly flagged
     `⚠ NEEDS EXPLICIT SIGN-OFF` in DECISION-LOG.md and are THIS session's own reason for existing.
     Inventing them here from a PRE-DRAFT would defeat the point. Same discipline as every recent
     PRE-DRAFT (per `DECISION-LOG.md` PD1 — the Advisor decides from documents at DRAFT, not the
     Executor at PRE-DRAFT). -->

1. **F65 — BFF boundary** `⚠ NEEDS EXPLICIT SIGN-OFF` — does the browser keep calling monolith
   `app/api/**` forever (current de facto state — F45/F30 and Session 7-1's server-only
   `lib/api/index.ts` both assume this), or does Phase 9's new frontend eventually call
   `operation-service`/`money-service` directly (what the original plan's own 8-1 language,
   "monolith contains only UI + keepers," implies)? Needs a fresh read of `lib/api/generated/`
   (the `operationApi`/`moneyApi` clients Session 7-1 built), a census of which `app/api/**`
   routes are pure pass-through vs. carry real logic (session translation, aggregation,
   response shaping), and the actual constraint that `NEXT_PUBLIC_*` env vars are the only way a
   browser-side call could reach a service directly (CORS, auth-cookie `httpOnly` semantics — see
   F45's own resolution). Gates Session 8-1's whole deletion list AND Phase 9's entire data-layer
   design — every route-map row's "real endpoint it binds to" column depends on this answer.
2. **F66 — Swap mechanism + brand scope** — big-bang branch swap (all 85→93 pages cut over
   together, one release) vs. progressive per-surface replacement (codebase-2 subtrees ship
   beside un-migrated codebase-1 pages, sharing the root layout, over multiple sessions — the
   shape Sessions 9-1…9-9 are already cut into). The roadmap's own §Phase-9-preamble already
   flags this as load-bearing for whether the layout-boundary session cut (9-1…9-9) is "mild
   bookkeeping" or genuinely structural. Also: how far the "Trading Alerts" → "DavinTrade" rename
   reaches — page titles and OG images are cheap; Stripe product/price display names and legal
   copy are not (touches money/compliance-adjacent surfaces, escalate per `EXECUTOR-PROTOCOL.md`
   §7 if the rename touches anything Stripe-Dashboard-side).

---

## Why this session exists

Phase 9 (Frontend Stack Replacement, `MASTER-ROADMAP-PHASES-7-15.md` §3) replaces the monolith's
85-page "Trading Alerts" frontend with `seed-code/trading-conversational-ai-ui-pages-increment/`
(93 pages, "DavinTrade" brand, parity-audited, light/dark verified) — but codebase 2 has **no
backend, no NextAuth, no session, and a no-op `middleware.ts`**. Supplying those against a real
data layer, real auth, and real tier gates is the substance of the phase; Sessions 9-1…9-9 cannot
start correctly without this session's own two decisions and its route-map contract — per the
roadmap's own §6 "single biggest risk," a session that ports pages visually without binding them
to real data is Session 6-1b's exact defect at ten times the scale, and "Session 9-0's route map
is the contract" is the roadmap's own first named guard against it.

**Independent of F76/4A-16's own timeline.** Phase 4X closed with 4A-15 (F47/F50 resolved); dLocal
Group B (F76) still needs its own dedicated fix-and-recutover session (working title `4A-16`)
before Phase 4X's gate for Session 8-1 is fully satisfied — but per the roadmap's own posted
running order, Phase 9 runs immediately after Phase 4X as a whole, and 9-0 itself has zero
technical dependency on F76 (different provider, no shared code path). This session proceeds
regardless of F76/4A-16's own resolution timeline.

---

## Entry criteria (draft — re-verify all at CONFIRM)

- [ ] `DECISION-LOG.md` **F65** and **F66** reviewed directly — confirm both still OPEN.
- [ ] **Phase 7 confirmed CLOSED** (it is, per `CLAUDE.md`'s own 2026-08-20 note) — 9-0 assumes
      `lib/api/generated/` (`operationApi`/`moneyApi`) is the settled client surface; re-verify
      `lib/api/index.ts` hasn't drifted since.
  - [ ] **Git drift check re-measured live**: `git log --oneline 8810b260..HEAD -- app/api/ lib/api/
    seed-code/trading-conversational-ai-ui-pages-increment/` — confirm nothing has changed in
        either tree since this PRE-DRAFT (use a real, verified commit hash at CONFIRM time).
- [ ] **Source documents exist and are current** (read, do not re-derive, per the roadmap's own
      "Inputs" note):
      `docs/files-completion-list/frontend-codebase-migration/ui-pages-replication.xlsx` (sheet
      `codebase_1_vs_codebase_2`, 97 rows), `…/codebase-2-parity-audit/00-MASTER-PLAN.md` +
      `batch-0…8`, `…/light-dark-mode-theme-migration/`,
      `docs/files-completion-list/page-comparison-PUBLIC-VS-PAGES-INCREMENT.xlsx`.
- [ ] **`seed-code/**` still read-only, zero drift since 4A-15's own CONFIRM observed 2 unrelated
    uncommitted edits** (`app/affiliate/dashboard/payouts/page.tsx`,
    `.../statements/page.tsx`) — re-check `git status`on`seed-code/` fresh; if those 2 files
      are still uncommitted, ask Davin directly whether they're intentional in-progress work
      before this session's own route-map treats that subtree as settled.
- [ ] **No-test-credentials gap re-confirmed** (Waiting-on #117, per the roadmap's own §5): can
      this session get real authenticated credentials for live click-through verification, or
      does the route-map's "auth gate" column stay design-only? Ask Davin directly — Phase 9
      cannot be verified without this, per the roadmap's own explicit call-out.
- [ ] **Codebase test baselines re-measured at CONFIRM** (even though this is a no-code session,
      confirm the starting point is genuinely green): monolith `tsc`/`eslint`/`test:ci`;
      money-service `test`; operation-service `test` — all fresh, isolated runs, one service at a
      time (`LESSONS-LEARNED.md` L24 — do not launch all three in parallel, see 4A-15's own Step 4
      finding).

---

## Ordered steps

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Resolve F65 (BFF boundary)** — sources: `lib/api/generated/` (`operationApi`/`moneyApi`
   clients, Session 7-1), a full census of `app/api/**` routes classifying each as pure
   pass-through vs. real server-side logic, `F45`'s resolution (`httpOnly` cookie semantics —
   `DECISION-LOG.md`), `F30` (if it names the same boundary — verify, don't assume from the
   roadmap's own paraphrase). Output: a decision doc section with the two options, evidence for
   each, and a recommendation. _Verify:_ Decision Log entry drafted; `⚠ NEEDS EXPLICIT SIGN-OFF`
   means this goes to Davin directly, not silently resolved by the Advisor at DRAFT.
2. **Resolve F66 (swap mechanism + brand scope)** — sources: the roadmap's own §Phase-9-preamble
   risk framing, `codebase-2-parity-audit/00-MASTER-PLAN.md`'s own stated assumptions (if any),
   a scan for "Trading Alerts"/"DavinTrade" across Stripe-adjacent surfaces (`lib/stripe/`,
   `app/api/stripe/`, any Stripe product/price display name) to scope the rename question
   concretely rather than abstractly. Output: decision doc section, options + recommendation.
   _Verify:_ Decision Log entry drafted; if the rename touches Stripe Dashboard-side config,
   flag `⚠ NEEDS EXPLICIT SIGN-OFF` per `EXECUTOR-PROTOCOL.md` §7 rather than deciding it here.
3. **Produce `docs/migration-orders/frontend-swap-route-map.md`** — one row per route, columns:
   codebase-2 source file → main-repo destination (including its target layout boundary, per the
   roadmap's own 9-1…9-9 layout-boundary table) → the real endpoint/hook it binds to (per F65's
   resolution) → auth gate → tier gate → which codebase-1 file it retires. Walk BOTH directions
   (every codebase-1 page has a destination fate; every codebase-2 page has a source justification)
   — zero unmapped rows either way is this session's own done-when bar. _Verify:_ spot-check 10
   rows against the real file tree on both sides before treating the map as complete.
4. **Inventory what codebase 2 lacks wholesale** — session/auth, middleware gating, real data
   fetching (vs. mocked), i18n `<T>` bound to the real `GET /api/user/preferences`, error/loading
   boundaries, and the 5 Batch-0 findings still open (no-op `middleware.ts`;
   `--accent-foreground` light-mode contrast; missing sidebar Help item; dead
   `components/header.tsx`; `davintrade.com` vs `davin-trade.com`). Output: a gap list in the
   route-map doc, one entry per gap, each naming which future 9-N session owns closing it.
   _Verify:_ cross-check each Batch-0 finding against the parity-audit's own batch files, not
   from memory of this order's paraphrase (`LESSONS-LEARNED.md` L22).
5. **Triage the 4 codebase-2-only admin pages with no codebase-1 counterpart** — `admin/resources`
   (take — its backend shipped 2026-08-20, no UI yet), `admin/notifications/broadcast` (triage —
   needs a real endpoint or it ships as another mock), `admin/disbursement/settings` (triage —
   same, belongs to 9-9 if kept), `admin/login` (do NOT take — F62 already RESOLVED to retire it
   behind a redirect to `/login`). Also confirm `app/test-api/` (6-12 deleted it from codebase 1
   on purpose) isn't resurrected by the swap. Output: disposition recorded per page in the
   route-map doc. _Verify:_ re-read F62's actual resolution text in `DECISION-LOG.md`/archive,
   don't paraphrase from the roadmap's own summary.
6. **Docs-reorg residual** — 2 unstaged doc deletions + untracked
   `seed-code/lovable-mobile-app/docs/`, found 2026-08-19 per the roadmap's own §5 residuals
   table. Resolve or explicitly re-schedule; don't silently drop it a second time.
7. **Real per-page effort estimates** — for every route-map row, a rough size (S/M/L) so 9-7's
   (14 pages, 5 nested layouts) and 9-8's (19 pages) likely splits into `9-7a/b`/`9-8a/b` can be
   decided on evidence per the roadmap's own §Phase-9-preamble, not guessed.

---

## Rules specific to this variant

- Ground truth priority: live code > live dashboards > recent docs > old build-orders.
- Distinguish **verified facts** from **assumptions** in `frontend-swap-route-map.md\*\* — mark
  assumptions explicitly; they become entry-criteria checks for Session 9-1 onward.
- If investigation contradicts the plan/playbook/roadmap, that's a finding — record it, propose
  the amendment, don't silently absorb it (this is exactly what 4A-15's own CONFIRM found twice).
- **`seed-code/**` stays read-only** — this session reads it exhaustively but never edits it
(`CLAUDE.md` §5; also re-check the 2 files flagged uncommitted at 4A-15's close, entry criteria
  above).
- **No live money-adjacent decisions without explicit escalation** — F66's brand-rename question
  can touch Stripe product/price display names; treat that sub-question as `EXECUTOR-PROTOCOL.md`
  §7 territory, not a CONTRACT-variant judgment call.

---

## Done when

- [ ] `frontend-swap-route-map.md` committed; zero unmapped rows in either direction (every
      codebase-1 page has a destination fate; every codebase-2 page has a source justification);
      every claim sourced, every assumption marked.
- [ ] F65 and F66 both in `DECISION-LOG.md` with Davin's sign-off quoted where required (F65 is
      `⚠ NEEDS EXPLICIT SIGN-OFF` — not covered by a general order approval).
- [ ] Codebase-2 wholesale-gap inventory complete, each gap assigned to a future 9-N session.
- [ ] The 4 codebase-2-only admin pages triaged with an explicit disposition each.
- [ ] Real per-page effort estimates recorded for the full 85→93-page set.

---

## Rollback

Usually none (read-only/document session). If any live setting is touched during investigation
(none expected), list its restoration here at CONFIRM/CLOSE.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-1` — Root Shell & Design System (UI-BUILD), per the roadmap's own §3
  session ordering. Nothing can migrate before 9-1 lands (`app/layout.tsx`, `providers.tsx`,
  design tokens, the appearance engine, the 3 root boundaries).
- **Prerequisite:** 9-0 CLOSED — route map committed, F65/F66 both RESOLVED with Davin's sign-off.
- **9-0 obligation carried to close:** PRE-DRAFT Session 9-1's order, informed by this session's
  own route-map row for the root-shell layout boundary and the Batch-0 findings this session
  inventories.
