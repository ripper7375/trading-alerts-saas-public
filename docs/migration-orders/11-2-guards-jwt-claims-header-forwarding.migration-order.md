# Migration Order — Session 11-2 — Guards, JWT Claims & Header Forwarding

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (PORT variant:
> the end-state (tier enforcement mirrored correctly across the monolith and operation-service) is
> fixed by the spec; the exact refactor path for reconciling three independent tier
> representations is this session's own judgment call).

**Session:** 11-2 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, second of 3 sessions) · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, at Session 11-1's close) · **Flags touched:** none registered yet — this session's own investigation may surface a new flag for a genuinely product-level call (see Decisions needed below). **Estimated time:** ~3–4h (three independent tier representations to reconcile, one documented argument-order footgun to fix, plus the header-forwarding gap).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11":
"11-2 — Guards, JWT claims & header forwarding (PORT, Core Areas 2/3/6). `lib/tier-validation.ts`, NestJS `TierGuard`, the JWT payload in `operation-service/src/auth/`, and Next.js → service header forwarding. **Known defect to fix here, not discover later:** `forwardedRequestContext()` forwards only `x-correlation-id`/`user-agent`/`x-forwarded-for` and silently drops everything else — that is why the 2026-08-19 GeoIP work could not be mirrored into `operation-service`."

Session 11-1 hoisted the canonical FREE/PRO tier matrix into `@trading-alerts/types/tier` and reconciled `lib/tier-config.ts` against it. This session's job is making tier **enforcement** (not just config) consistent — the guards, JWT claims, and cross-service header forwarding that Stack D (Phase 12) and Stack E (Phase 13) will depend on to actually gate their endpoints.

---

## Facts verified live at PRE-DRAFT time (not fabricated — re-verify fresh at CONFIRM)

- **Three independent tier representations exist today, not one** — this is more fragmented than the roadmap's own framing ("`lib/tier-validation.ts`, NestJS `TierGuard`") suggests:
  1. `lib/tier-config.ts` (160 lines post-11-1) — the canonical source, now backed by `@trading-alerts/types/tier` as of Session 11-1.
  2. `lib/tier-validation.ts` (371 lines) — its own **locally-defined** `TierConfig` interface (`maxSymbols`, `allowedSymbols`, `allowedTimeframes`, `maxAlerts`, `rateLimit` — a different shape than `lib/tier-config.ts`'s `TierConfig` entirely, same name, different module) and its own `TIER_CONFIGS`. It does import `SYMBOLS`/`TIMEFRAMES`/`FREE_TIER_CONFIG`/`PRO_TIER_CONFIG`/`Tier` from `./tier-config`, so it is not fully divergent, but its own `TierConfig`/`TIER_CONFIGS` are locally re-declared, not imported.
  3. `operation-service/src/tier/tier.schemas.ts` (39 lines) — a **third**, independent re-implementation (`Tier`, `SYMBOLS`, `TIMEFRAMES`, `FREE_SYMBOLS`/`PRO_SYMBOLS`/`FREE_TIMEFRAMES`/`PRO_TIMEFRAMES`, `canAccessSymbol`). Its own doc comment explains why: `operation-service` cannot import monolith `lib/*` code directly, so these are locally re-defined, "matching the established Drawings/Alerts precedent (Session 4B-8) of locally re-implementing `lib/tier-validation.ts`'s semantics rather than importing across the service boundary."
- **A documented, live argument-order footgun, not a hypothetical one:** `tier.schemas.ts`'s own doc comment states its `canAccessSymbol(symbol, tier)` matches `lib/tier-config.ts`'s argument order, explicitly **NOT** `lib/tier-validation.ts`'s `canAccessSymbol(tier, symbol)` — same function name, different signature, in two files, already known and commented but never fixed. A future call site reconciling these three by simple find/replace would silently swap the arguments' meaning.
- **`operation-service/src/auth/tier.guard.ts` (51 lines) already exists** — built Session 4B-10, per its own doc comment: a generic, reusable `TierGuard` (`CanActivate`, `@RequireTier(tier)` decorator via `Reflector`/`SetMetadata`, reads `request.user.tier`) — "built alongside the (tier-independent) `TierController` but not used by any of its 3 handlers — for future tier-gated endpoints in other domains." The roadmap's framing ("NestJS `TierGuard`") may read as this session building it from scratch; live code says it already exists and is unused. This session's real job on that front is likely: (a) confirming `request.user.tier` is actually populated correctly by the JWT payload today, (b) wiring `@RequireTier()` onto real endpoints as Stack D/E need it, and (c) reconciling `tier.guard.ts`'s `Tier` import (from `../tier/tier.schemas`) against the new `@trading-alerts/types/tier` canonical type — not necessarily writing a new guard.
- **`operation-service/src/tier/tier.controller.ts` (59 lines) exists** — not read in full this PRE-DRAFT; the DRAFT/CONFIRM pass should read it alongside `tier.schemas.ts` before deciding scope.
- **`forwardedRequestContext()` confirmed live** at `lib/operation-service/client.ts:190` — its own doc comment: "Best-effort forwarding of the real client's IP/user-agent for operation-service's audit fields (`RefreshToken.userAgent`/`ipAddress`) — not security-critical." Confirmed it extracts `user-agent` at minimum; the roadmap's claim that it also forwards `x-correlation-id`/`x-forwarded-for` and drops everything else was **not independently re-verified line-by-line this PRE-DRAFT** — read the full function body at DRAFT/CONFIRM before treating that claim as settled.
- **Entry criterion met:** Session 11-1 (types/config) is CLOSED SUCCESSFUL as of this PRE-DRAFT's own writing (2026-08-24) — re-verify fresh at this session's own CONFIRM regardless.
- **Not this session's job, flagged so it isn't rediscovered as a surprise:** `DECISION-LOG.md` is currently over `EXECUTOR-PROTOCOL.md` §1's ~50KB archival-gate target (66,292 bytes as of Session 11-1's close) — Session 11-1's own CONFIRM found this pre-existing and deferred it. **This session's own OPEN (step 0) must run the archival pass before anything else** — it is now a hard gate, not optional housekeeping.

---

## Decisions needed (flagged for the Advisor to resolve at DRAFT — not resolved here)

1. **Reconciliation scope for the three tier representations.** Does 11-2 collapse `lib/tier-validation.ts`'s locally-defined `TierConfig`/`TIER_CONFIGS` and `operation-service/src/tier/tier.schemas.ts`'s local re-implementation down to consume `@trading-alerts/types/tier` directly (highest consistency, touches the Drawings/Alerts call sites `tier.schemas.ts` explicitly says depend on its current shape), or does it leave the local re-implementations in place and only fix the argument-order mismatch + wire the JWT/guard path (lower blast radius, defers full consolidation)? The Advisor should weigh `tier.schemas.ts`'s own stated reason for existing (operation-service cannot import monolith `lib/*` — but it **can** and does import `@trading-alerts/types` per Session 11-1's own precedent) against the Drawings/Alerts call sites' current expectations.
2. **JWT payload claim design.** What tier-related claims does `operation-service/src/auth/`'s JWT payload need for Stack D/E gating (e.g., just `tier`, or also `aiMonthlyTokenQuota` snapshot, entitlement flags)? Cross-check against `TierGuard`'s existing `request.user.tier` read and how token refresh keeps it current after a mid-session tier change (relevant to the still-OPEN `DECISION-LOG.md` **F78** — `AppHeader` nav/badge staleness after a server-side tier change — a related but distinct staleness class worth citing, not solving here).
3. **Header-forwarding fix scope.** `forwardedRequestContext()`'s exact current behavior needs full verification before scoping the fix (see Facts above) — what's the complete list of headers Stack D/E's own endpoints will need forwarded, beyond the GeoIP case that originally surfaced this gap?

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 11-1 (Tier Matrix Decision + Types/Config) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **`DECISION-LOG.md` archival pass completed** (§1 size gate — file was over ~50KB target as of 11-1's close; this session's own OPEN must run it before proceeding, per `EXECUTOR-PROTOCOL.md` §1 step 0).
- [ ] **Baseline test suites 100% green** (monolith, `operation-service`, `money-service`, `railway-gateway` — figures to be re-verified fresh at CONFIRM, not copied from 11-1's close).
- [ ] **`lib/tier-validation.ts`'s and `tier.schemas.ts`'s current call sites inventoried** (which Drawings/Alerts code paths actually call the argument-order-mismatched `canAccessSymbol`, so the reconciliation Decision above is made from evidence, not assumption).

---

## Ordered steps (Advisor to complete — sketch only, do not execute from this PRE-DRAFT)

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Run the `DECISION-LOG.md` archival pass** (entry criterion, not optional) before any other work.
2. **Inventory every call site** of `lib/tier-validation.ts`'s and `operation-service/src/tier/tier.schemas.ts`'s tier functions/types — which ones would break under which reconciliation approach.
3. **Resolve the reconciliation-scope Decision** (Advisor, per the evidence from step 2) and fix the documented `canAccessSymbol` argument-order mismatch regardless of scope chosen — that footgun should not survive this session either way.
4. **Design and implement the JWT payload claims** for tier gating, verify `TierGuard`/`request.user.tier` reads them correctly end-to-end.
5. **Read `forwardedRequestContext()` in full**, fix the header-forwarding gap per the resolved Decision 3 scope.
6. **Full baseline re-run** — `test:ci` must not go backwards.

---

## Rules specific to this variant

- Ground truth priority: live code (`lib/tier-config.ts`, `lib/tier-validation.ts`, `operation-service/src/tier/`, `operation-service/src/auth/`) > the prep spec > any older build-order.
- The argument-order mismatch between `lib/tier-config.ts`'s and `lib/tier-validation.ts`'s same-named `canAccessSymbol` is a live footgun, not a hypothetical — treat any reconciliation that doesn't fix it as incomplete.
- If reconciling the three tier representations touches Drawings/Alerts call sites, that's `EXECUTOR-PROTOCOL.md` §5 change-frozen territory only if those specific call sites are CC-F — verify before assuming either way.

---

## Done when

- [ ] The `canAccessSymbol` argument-order mismatch is fixed (one canonical signature, or clearly-named distinct functions — no more same-name/different-order footgun).
- [ ] JWT payload claims for tier gating designed, implemented, and verified end-to-end against `TierGuard`.
- [ ] `forwardedRequestContext()`'s header-forwarding gap fixed per the resolved scope.
- [ ] Baseline test suites 100% green, net-neutral-or-better (no silently-adjusted assertions).

---

## Rollback

Primarily a guards/JWT/header-forwarding change — `git revert` the session's commits per step. If the JWT payload shape changes, note the token-compatibility impact (in-flight sessions with the old payload shape) here at DRAFT time.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

- **Next session:** `11-3` — Token Metering & Schema (Phase 11, third of 3 sessions).
