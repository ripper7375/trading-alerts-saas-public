# Migration Order — Session 8-2 — Gateway Deployment & Schema Dedup

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (INFRA variant:
> the end-state, grants, and names are fixed by the plan; the deployment approach is flexible).
> **PRE-DRAFTed by the Executor at Session 8-1's close (2026-08-24)** per
> `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A" and the session playbook's own Session 8-2 entry.

**Session:** 8-2 · **Phase:** 8A (Decommission, part 2 — final session) · **Variant:** INFRA ·
**Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, at Session 8-1's close) · **Flags touched:** none identified
yet — the Advisor should check whether the schema-dedup mechanism itself deserves a flag (see
Decision-needed #1 below). **Estimated time:** ~2–4h (this touches the must-never-blip ingest
path — expect staging-first verification to dominate the time, not the deploy itself).

---

## Why this session exists

Per `monolith-to-microservices-migration-session-playbook.md` §"Session 8-2":
"Deploy the `railway-gateway` backend to the `postgre for staging` Railway project (which contains
the required Postgres and Redis infrastructure). Point it at the shared market-data schema/types
package; align its Prisma to 7.8.0; verify ingest." **Done when:** `railway-gateway` is live on
`postgre for staging`, one source of truth for `MarketDataV6`; ingest verified end-to-end.

This is Phase 8A's second and final session, and a hard prerequisite for **Session 13-1** (Stack
E's narrative-engine work wants to add a PL/pgSQL trigger to the very `market_data_v6` schema this
session deduplicates — `MASTER-ROADMAP-PHASES-7-15.md` F71's entry criterion is explicitly "Session
8-2 CLOSED").

---

## Facts verified live at PRE-DRAFT time (not fabricated — re-verify fresh at CONFIRM)

- **The schema duplication is real and already identified:** `railway-gateway/prisma/schema.prisma`
  exists as its own, separate file from the monolith's `prisma/market-data/schema.prisma` — two
  independent schema definitions for what should be one `MarketDataV6` source of truth. This is
  the concrete thing "dedup" refers to.
- **Version gap confirmed:** `railway-gateway/package.json` pins `prisma`/`@prisma/client` at
  `^6.19.2`. The rest of the monorepo (monolith, `operation-service`, `money-service`) is already
  on Prisma `7.9.1` (verified live at Session 10-3's CONFIRM). The playbook's own target for this
  session is `7.8.0` — close to but not identical to the rest of the repo's `7.9.1`; the Advisor
  should confirm whether `7.8.0` is still the right target or whether it should match the repo's
  actual current pin.
- **Target Railway project exists and is reachable:** `railway list` (this Executor's
  authenticated CLI) confirms `postgre for staging` is a real project in the same Railway account
  as `trading-alerts`, `prisma-migration`, `zoological-motivation`, `feisty-amazement`. Unlike
  Vercel (no CLI/credentials in this environment, per 4A-16's own finding), **this Executor's
  environment CAN drive the actual `railway up`/link/deploy steps** — this session does not need
  to be handed to Davin the way 4A-16's flag-flip was.
  `railway-gateway`'s own `railway.toml` and current project linkage were not inspected yet — that
  is this session's own Step 1, not pre-empted here.
- **Entry criterion now met:** Session 8-1 (Deletion Sweep) is CLOSED SUCCESSFUL as of this
  PRE-DRAFT's own writing (2026-08-24) — re-verify fresh at this session's own CONFIRM regardless.

---

## Decisions needed (flagged for the Advisor to resolve at DRAFT — not resolved here)

1. **Which schema file becomes the source of truth, and by what mechanism?** The playbook says
   "point it at the shared market-data schema/types package," which implies a package that doesn't
   fully exist yet as such — today there are two independent `schema.prisma` files, not one shared
   package consumed by both. Options the Advisor should weigh: (a) `railway-gateway` adopts
   `prisma/market-data/schema.prisma` directly (path/symlink/copy-with-generate-step), (b) both
   consume a new shared package under `packages/*` (this repo's pnpm workspace already has a
   `packages/*` convention — `F9`'s resolution), (c) `railway-gateway` keeps its own file but a CI
   check enforces the two never drift. This is the actual "dedup," not just the version bump —
   get this right before writing Ordered Steps naming specific files.
2. **Prisma target version:** `7.8.0` (playbook) vs. `7.9.1` (rest of the repo, live) — confirm
   which, and whether bumping `railway-gateway` this session should also re-verify Prisma 7's own
   breaking-change audit (F19, resolved Session 2-1) applies cleanly to `railway-gateway`'s schema
   too.
3. **Staging-first sequencing, given the must-never-blip constraint** (`EXECUTOR-PROTOCOL.md` §5):
   the INFRA template requires "production changes only after the identical change succeeded in
   staging." `postgre for staging` is presumably the staging target itself — the Advisor should
   make explicit what "success in staging" looks like before this touches whatever
   `railway-gateway` currently has live in production, and whether ingest verification needs a
   synthetic feeder (Session 10-1's own F67 precedent) or can safely use a live-but-low-risk read.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 8-1 (Deletion Sweep) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Blast-radius statement confirmed:** what could this session break if it goes wrong? Draft
      answer (Advisor to refine): a bad schema-dedup migration or a botched `railway-gateway`
      redeploy could interrupt live market-data ingest — the one path `EXECUTOR-PROTOCOL.md` §5
      says must never blip. Everything in this session's Ordered Steps must state explicitly how
      it avoids that.
- [ ] Railway CLI access confirmed live (already true in this Executor's environment — re-verify
      `railway whoami` fresh at CONFIRM, not assumed from this PRE-DRAFT).
- [ ] Baseline test suites 100% green (monolith, `operation-service`, `money-service` — figures to
      be re-verified fresh at CONFIRM, not copied from 8-1's close).

---

## Ordered steps (Advisor to complete — sketch only, do not execute from this PRE-DRAFT)

_(each step = change → immediate verification → rollback note; stage before production)_

1. **Inventory `railway-gateway`'s current live deployment state** — is anything already running
   on `postgre for staging` or elsewhere? What does `railway.toml` currently point at? Do not
   assume greenfield.
2. **Resolve Decision 1 above** (schema source-of-truth mechanism) and implement it as committed
   config/code, never a dashboard-only or one-off manual step.
3. **Prisma version bump** (Decision 2) — staged, with the F19-style breaking-change check applied
   to `railway-gateway` specifically.
4. **Deploy to `postgre for staging`**, verified via a real health check (not just `railway
logs`/`status` — `LESSONS-LEARNED.md` L13, same lesson 4A-16 applied).
5. **Ingest verification end-to-end** — prove `MarketDataV6` writes actually land through the
   deployed gateway, with the must-never-blip path demonstrably undisturbed throughout (e.g.
   before/after row-count or latency check on the live ingest, not just "it deployed").

---

## Rules specific to this variant

- **Nothing dashboard-only.** Every setting lands in a committed file (`railway.toml`, schema
  files, CI config) or is documented in the secret matrix — never a Railway-dashboard-only change.
- **Production changes only after the identical change succeeds in staging.**
- **Never break the always-on paths:** `railway-gateway` ingest and the live monolith must not
  blip — each Ordered Step must state explicitly how it avoids this, per `EXECUTOR-PROTOCOL.md` §5.
- **Secrets:** names in the matrix, values only in Railway — never in git.

---

## Done when

- [ ] `railway-gateway` is live on `postgre for staging`, confirmed via a real health check.
- [ ] `MarketDataV6` has one source of truth (schema-dedup mechanism resolved and implemented).
- [ ] `railway-gateway`'s Prisma aligned to the Advisor-confirmed target version.
- [ ] Ingest verified end-to-end with the must-never-blip path demonstrably undisturbed.
- [ ] Baseline test suites 100% green.
- [ ] Session 13-1's own entry criterion ("8-2 CLOSED") satisfied — noted in `DECISION-LOG.md`/F71
      context if applicable.

---

## Rollback

<Ordered teardown/revert plan for the whole session — Advisor to draft once Decision 1's mechanism
is chosen; must be verified plausible in staging before this order reaches APPROVED.>

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

- **Next session:** `11-1` — Tier matrix decision + types/config (Phase 11, first of 3 sessions).
  Per `MASTER-ROADMAP-PHASES-7-15.md` §0's running order, Phase 11 (gate 6) runs immediately after
  Phase 8A closes (gate 5) — Phase 8B (8-3/8-4/8-5, gate 11) runs **last**, after Phases 12–15, not
  next. Per the roadmap's own trigger table, **Session 8-2 owes
  `HANDOVER-PROMPT-phase-11.md`** — flag this obligation for the Advisor at DRAFT time; it was not
  authored by this PRE-DRAFT.
