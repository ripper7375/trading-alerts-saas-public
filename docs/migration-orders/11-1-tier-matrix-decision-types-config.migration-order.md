# Migration Order — Session 11-1 — Tier Matrix Decision + Types/Config

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (CONTRACT+PORT
> variant: the 6 Core Areas and their order are fixed by the spec; the exact tier-line values and
> currency-wiring approach are this session's own judgment call, subject to the sign-off carve-out
> below).

**Session:** 11-1 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, first of 3 sessions)
· **Variant:** CONTRACT + PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, at Session 8-2's close) · **Flags touched:** F68, F74 (both
OPEN, both registered 2026-08-20, both due at this session per `DECISION-LOG.md`) · **Estimated
time:** ~3–4h (F68 alone needs a live Stripe cross-check before any code moves).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11": "11-1 — Tier matrix decision + types/config
(CONTRACT + PORT, Core Area 1). Resolve F68 ... and F74 ... Then update `@trading-alerts/types`
and `lib/tier-config.ts`, including the drawing tool-set entitlements deferred from Phase 10."

This is Phase 11's first of 3 sessions and the one every later Phase-12/13 tier-gating decision
depends on — Stack D (Phase 12) and Stack E (Phase 13) both gate on entitlements this session
defines.

---

## Facts verified live at PRE-DRAFT time (not fabricated — re-verify fresh at CONFIRM)

- **`lib/tier-config.ts` exists today** (166 lines) — the Advisor's DRAFT must read it in full and
  reconcile the new tier matrix against its _current_ shape, not assume a blank slate.
- **`packages/types` exists** (the `@trading-alerts/types` package, hoisted at Session 4B-1 per
  `CLAUDE.md`/`migration-cutover-table.md` history) — this is where the tier-matrix types land,
  consumed by both the monolith (pnpm workspace) and, from Phase 12/13 onward, the NestJS services.
- **F68 and F74 are both still OPEN** in `DECISION-LOG.md`, both registered 2026-08-20, neither
  touched since. Both carry `⚠ NEEDS EXPLICIT SIGN-OFF` in the roadmap's own flag table — this is
  not a routine flag resolution; F68 explicitly changes entitlements on a product with paying
  users.
- **Entry criterion met:** Phase 8A (Sessions 8-1, 8-2) is CLOSED SUCCESSFUL as of this PRE-DRAFT's
  own writing (2026-08-24) — re-verify fresh at this session's own CONFIRM regardless.
- **Not this session's job, flagged so it isn't rediscovered as a surprise:** `DECISION-LOG.md`
  F70 (DB role/schema grants for `market_data_v6`) picked up new evidence at Session 8-2's close —
  unrelated to Phase 11, owned by Session 12-0.

---

## Decisions needed (flagged for the Advisor to resolve at DRAFT — not resolved here)

1. **F68 — the tier matrix itself.** The prep spec proposes redefining FREE/PRO entitlements
   platform-wide, including surfaces already sold to paying users. The Advisor must cross-check
   every proposed FREE/PRO line against `lib/tier-config.ts`'s _current_ entitlements and the
   live Stripe product/price catalog before writing a single line — a line that silently
   downgrades an already-sold entitlement is a real customer-facing regression, not a drafting
   nuance. Mark `⚠ NEEDS EXPLICIT SIGN-OFF` — Davin's general order approval does not cover this
   item on its own (`EXECUTOR-PROTOCOL.md` §0).
2. **F74 — payment currency wiring.** Reading `userPreference.currency` into checkout requires
   per-currency Stripe Price objects — a product-catalog decision (which currencies, whose price
   points), not a code one. The Advisor should recommend a scope (e.g., which currencies ship in
   this pass vs. deferred) and mark it `⚠ NEEDS EXPLICIT SIGN-OFF`.
3. **Drawing tool-set entitlements deferred from Phase 10.** `MASTER-ROADMAP-PHASES-7-15.md`
   §"Phase 10" explicitly defers tool-set gating-by-tier here rather than building it twice. The
   Advisor should confirm exactly which tool-set flags/values Phase 10 left unresolved (read
   Session 10-3's own close-out notes, don't assume) before folding them into the new matrix.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 8A (Sessions 8-1, 8-2) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Baseline test suites 100% green** (monolith, `operation-service`, `money-service` —
      figures to be re-verified fresh at CONFIRM, not copied from 8-2's close).
- [ ] **Live Stripe entitlement list actually pulled** (dashboard or API), not assumed from
      `lib/tier-config.ts` alone — the two can have already drifted.
- [ ] **F68's blast-radius statement confirmed:** what breaks for an existing paying user if this
      matrix ships wrong? Draft answer (Advisor to refine): an entitlement downgrade on an
      already-sold tier is a real billing-support incident, not a bug report.

---

## Ordered steps (Advisor to complete — sketch only, do not execute from this PRE-DRAFT)

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Read `lib/tier-config.ts` and the prep spec's §3 Core Area 1 side by side** — produce a
   reconciliation table (current entitlement → proposed entitlement → source cited for each row).
2. **Pull the live Stripe product/price catalog** and cross-check every proposed FREE/PRO line
   against it — flag any row that would downgrade an already-sold entitlement.
3. **Resolve F68** (Decision Log entry, `⚠ NEEDS EXPLICIT SIGN-OFF`) and **F74** (same) with the
   evidence from steps 1–2.
4. **Update `@trading-alerts/types`** with the new tier-matrix types, consumed by the monolith
   (and staged for Phase 12/13's NestJS consumers).
5. **Update `lib/tier-config.ts`** to the resolved matrix, including the Phase-10-deferred drawing
   tool-set entitlements.
6. **Full baseline re-run** — `test:ci` must not go backwards (`LESSONS-LEARNED.md` L3-adjacent
   discipline: a test needing its assertion changed because an entitlement moved is a finding to
   disclose, never a silent edit).

---

## Rules specific to this variant

- Ground truth priority: live code (`lib/tier-config.ts`) > live Stripe dashboard > the prep spec
  > any older build-order.
- Distinguish verified facts from assumptions in the DRAFT explicitly — an assumed entitlement
  line becomes an entry-criteria check for Session 11-2/11-3 to re-verify, not a settled fact.
- If the prep spec's proposed matrix contradicts what's actually live on Stripe today, that's a
  finding to record and route through Davin — never silently reconcile toward either source.

---

## Done when

- [ ] F68 and F74 both resolved in `DECISION-LOG.md`, both with Davin's explicit sign-off quoted.
- [ ] `@trading-alerts/types` and `lib/tier-config.ts` updated to the resolved matrix.
- [ ] Phase-10-deferred drawing tool-set entitlements folded in, not left as a second future TODO.
- [ ] Baseline test suites 100% green, net-neutral-or-better (no silently-adjusted assertions).

---

## Rollback

Primarily a types/config change — `git revert` the session's commits. If any live Stripe setting
was touched during the cross-check (should be read-only), list its restoration here at DRAFT time.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

- **Next session:** `11-2` — Guards, JWT claims & header forwarding (Phase 11, second of 3
  sessions). Per `MASTER-ROADMAP-PHASES-7-15.md`'s own trigger table, **Session 11-3 owes
  `HANDOVER-PROMPT-phase-12.md`** — not this session's job, noted for the record only.
