# Migration Order: Tier (Guard) Extraction & Cutover to operation-service (Session 4B-10)

> PRE-DRAFT — raw facts for the Advisor to upgrade into a DRAFT. Not yet reviewed by Davin.

**Session:** 4B-10
**Phase / plan section:** Phase 4B step 10, plan §6 (session playbook line ~326: "alerts CRUD →
drawings + drawing-alerts → notifications → **tier (guard)** → user/profile/2FA/sessions →
market-data channel proxy")
**Target service:** `operation-service` & Next.js Monolith
**Variant:** likely PORT (+CUTOVER, combined — same shape as Sessions 4B-8/4B-9, small blast
radius, no payment/webhook surface) — **Advisor to confirm this is still the right shape 3
sessions running.**
**Status:** PRE-DRAFT (2026-08-02)
**Flags touched:** `MIGRATE_TIER` (not introduced yet — reserved name only, pending Advisor's
naming decision, see open question below)

---

## Raw facts (Executor, for the Advisor to upgrade into a DRAFT)

**Open question #1 for the Advisor, not resolved here:** the playbook literally says "tier
**(guard)**", not "tier API" or "tier routes" — this could mean either (a) port the 3 existing
tier-info REST endpoints below, (b) build a reusable NestJS `TierGuard` (`CanActivate`) that other
domain modules can attach via `@UseGuards()` for tier-gated routes, mirroring how
`JwtAuthGuard`/`AffiliateGuard`/`AdminGuard` already work in this service, or (c) both. Nothing in
the plan doc elaborates further than the one line cited above. This session's own scope should be
decided explicitly, not assumed, before drafting Ordered Steps.

**SOURCE candidates (3 files, 387 lines total, re-verify at DRAFT/CONFIRM — these are this
session's own fresh `wc -l` counts):**

- `app/api/tier/symbols/route.ts` (118 lines) — `GET`, returns the platform's symbol list with
  per-symbol metadata (`proOnly` flag) and the caller's own tier. V8 note in its own header:
  "hardcoded to XAUUSD — both tiers have identical symbol access, so no tier gating is applied" —
  i.e. this endpoint currently does NOT enforce anything, it only REPORTS.
- `app/api/tier/check/[symbol]/route.ts` (124 lines) — `GET`, checks whether the caller's tier can
  access a specific `:symbol` path param. Not yet read in full this session — re-read at DRAFT time
  to confirm whether it also checks timeframe or just symbol.
- `app/api/tier/combinations/route.ts` (145 lines) — `GET`, imports both `SYMBOLS` and
  `TIMEFRAMES` from `lib/tier-config.ts` — likely returns the full symbol×timeframe access matrix
  for the caller's tier. Not yet read in full this session.

All 3 use `getServerSession(authOptions)` (same pattern as the Notifications/Drawings routes, NOT
the `getSession()` wrapper Alerts CRUD uses) and import from `@/lib/tier-config` +
`@/types/tier`'s `Tier` type — NOT `@/lib/tier-validation.ts` (that's a separate, 371-line file
with `canAccessSymbol()`/`validateTimeframeAccess()`, already partially re-implemented locally
inside `operation-service`'s `DrawingsService`/`AlertsService`/`LineAlertsService` per Session
4B-8's own established pattern — re-check at DRAFT time whether these 3 tier routes need that same
local-reimplementation treatment, since `operation-service` cannot import monolith `lib/*` code
directly).

**Established transport pattern (reuse, don't reinvent):** `forwardRequestToOperationService()`
(`lib/operation-service/write-routes.ts`) + `getOperationServiceToken()` (`lib/operation-service/
client.ts`) + a new `shouldUseOperationServiceForTier()` (or similar name pending the Advisor's
call on open question #1) in `lib/operation-service/flags.ts`, matching every prior slice's shape.

**Not checked this session, flag for DRAFT/CONFIRM:**

- Whether any OTHER monolith code (crons, other API routes, admin pages) reads `lib/tier-config.ts`
  or `lib/tier-validation.ts` in a way that would need auditing before this domain is considered
  fully "owned" by operation-service — not checked here, same class of gap the 4B-9 PRE-DRAFT
  flagged for Notifications (which turned out to matter: real other writers existed for that
  domain). Given `lib/tier-validation.ts`'s functions are ALREADY duplicated inline inside 3
  existing operation-service modules (Drawings/Alerts/LineAlerts), this session may be about
  consolidating those into a shared, real `TierGuard`/service rather than a fresh 1:1 route port —
  worth the Advisor's explicit framing before Ordered Steps are written.
- Whether `operation-service`'s `AuthenticatedRequest.user.tier` (already present, used by
  Drawings/Alerts today) is sufficient for whatever these 3 routes need, or whether a live DB fetch
  is still required (e.g. if tier can change mid-session and the JWE claim goes stale) — not
  checked.
- Real production traffic exposure: these are read-only, no payment/webhook surface, matching the
  LOW-risk profile of 4B-8/4B-9 — but confirm this holds after actually reading all 3 files in
  full.

**New finding from Session 4B-9's own close, carried forward as a reminder (not this session's
scope):** `migration-cutover-table.md`'s Slice 7 (Alerts CRUD) row has a pre-existing
pipe-count/formatting defect (21 pipes, not the correct 11) — CLAUDE.md Waiting-on #90. Worth a
quick cleanup pass whenever convenient, not blocking this order.

---

## Candidate steps (mirror Sessions 4B-8/4B-9's structure — Advisor to confirm/adjust once open

question #1 is resolved)

0. Resolve open question #1 (route port vs. reusable guard vs. both) and pick the flag name.
1. Port/build whatever Step 0 decided — `TierService`/`TierController` and/or `TierGuard`.
2. Unit tests + module registration.
3. Monolith forwarding layer (if routes are being ported) + flag wiring.
4. Deploy + Davin live-approval checkpoint + cutover + live smoke test (mind Session 4B-9's own
   incident: verify REAL HTTP status codes via a real e2e spec, not just a controller-construction
   unit test — NestJS's `@Post()`/`@Get()` per-verb defaults can silently diverge from a ported
   Next.js route's own implicit status).

---

## Deviations

_(none yet — PRE-DRAFT, not executed)_
