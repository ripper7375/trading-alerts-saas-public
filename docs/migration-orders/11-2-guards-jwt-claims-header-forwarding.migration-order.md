# Migration Order — Session 11-2 — Guards, JWT Claims & Header Forwarding

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (PORT variant:
> the end-state — tier enforcement mirrored consistently across the monolith and operation-service —
> is fixed by the spec; the exact refactor path for consolidating tier representations and header
> forwarding is this session's own judgment call).
> **PRE-DRAFTed by the Executor at Session 11-1's close (2026-08-24)**, upgraded to **authoritative
> DRAFT by the Advisor / Antigravity (2026-08-24)** per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11"
> and `davintrade-stack-d-and-e/PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md` §3 (Core Areas 2, 3, 6).

**Session:** 11-2 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, second of 3 sessions) · **Variant:** PORT · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-24 (Advisor / Antigravity) · **Approved:** 2026-08-24 (Davin) · **Confirmed:** 2026-08-24 (Executor; Davin confirmed the working-copy APPROVED text authentic, live in chat) · **Closed:** 2026-08-24  
**Flags touched:** none (plumbing, guards, JWT claims, and header forwarding; no runtime feature flag needed).  
**Estimated time:** ~3–4h (DECISION-LOG.md archival pass, consolidating 3 tier representations, fixing `canAccessSymbol` argument order, wiring JWT claims in `operation-service`, fixing `forwardedRequestContext()` header drop, full test pass).  
**Target components:** `DECISION-LOG.md`, `lib/tier-validation.ts`, `operation-service/src/tier/tier.schemas.ts`, `operation-service/src/auth/` (`jwt-auth.guard.ts`, `next-auth-jwt.util.ts`, `tier.guard.ts`), `lib/operation-service/client.ts`.

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.

1. **Tier Representation Consolidation & `canAccessSymbol` Footgun Resolution**
   - **Chosen:** Consolidate all three tier representations to consume `@trading-alerts/types/tier` directly:
     1. In `lib/tier-validation.ts`: Re-export canonical `TierConfig`, `TIER_CONFIGS`, `Tier` from `@trading-alerts/types/tier`. Fix `canAccessSymbol` signature to match the canonical order `canAccessSymbol(symbol: string, tier?: Tier): boolean`, and update its two internal callers (`validateTierAccess` at line 123, `validateAlertCreation` at line 318).
     2. In `operation-service/src/tier/tier.schemas.ts`: Re-export `Tier`, `SYMBOLS`, `TIMEFRAMES`, `canAccessSymbol` from `@trading-alerts/types/tier` instead of locally duplicating them.
     3. Add new validation helpers `canAccessAiAnalyst(tier: Tier): ValidationResult` and `canAccessMarketComments(tier: Tier): ValidationResult` to `lib/tier-validation.ts` (Core Area 2).
   - **Rejected:** Leaving divergent local re-implementations in place with duplicate interfaces.
   - **Why:** `@trading-alerts/types` is already linked in `operation-service`'s `package.json` (`file:./packages/types`). Unifying around the hoisted package eliminates the argument-order footgun and guarantees identical tier behavior across frontend and backend.
   - **How hard to undo:** Plain import/export refactoring.

2. **JWT Claims & `TierGuard` Wiring in `operation-service` (Core Areas 2 & 3)**
   - **Chosen:**
     1. In `operation-service/src/auth/next-auth-jwt.util.ts`: Type `tier: Tier` (where `Tier = 'FREE' | 'PRO'`).
     2. In `operation-service/src/auth/jwt-auth.guard.ts`: Ensure `request.user` is populated with `tier: claims.tier === 'PRO' ? 'PRO' : 'FREE'` (defaulting safely to `'FREE'` instead of `'PRO'` if absent/unrecognized, avoiding accidental privilege escalation).
     3. In `operation-service/src/auth/tier.guard.ts`: Import `Tier` and `REQUIRE_TIER_KEY` from `@trading-alerts/types/tier` and ensure `@RequireTier('PRO')` enforces `request.user.tier === 'PRO'` with clean `403 Forbidden` (`reason: "TIER_PRO_REQUIRED"`).
   - **Rejected:** Defaulting missing tier claims to `PRO` or re-verifying sessions against database on every request.
   - **Why:** Preserves stateless JWE token verification performance while guaranteeing safe default-deny security semantics.
   - **How hard to undo:** Straightforward TypeScript logic in `jwt-auth.guard.ts`.

3. **Complete Header-Forwarding Fix in `forwardedRequestContext()` (Core Area 6)**
   - **Chosen:** Update `forwardedRequestContext()` in `lib/operation-service/client.ts` to forward the full suite of client metadata and tracing headers:
     - Tracing: `x-correlation-id`, `x-request-id`
     - Network & Client: `user-agent`, `x-forwarded-for`, `x-forwarded-proto`, `x-real-ip`
     - Context & Locale (2026-08-19 GeoIP): `x-user-id`, `x-user-tier`, `x-user-country`, `x-user-currency`, `x-user-timezone`
   - **Rejected:** Forwarding only `user-agent` and `x-forwarded-for` (which silently dropped GeoIP and correlation context).
   - **Why:** Solves the root cause of why the 2026-08-19 GeoIP and correlation tracing could not be mirrored into `operation-service`, enabling downstream microservices to access client context without redundant database lookups.
   - **How hard to undo:** Plain header dictionary mapping in `client.ts`.

4. **`DECISION-LOG.md` Archival Pass at Session Open**
   - **Chosen:** Execute the mandatory §1 size gate at Step 1: archive resolved legacy flag descriptions (F1–F64) to `history/decisions-archive.md`, keeping the active register table and recent/open flags (F65–F78) intact in `DECISION-LOG.md` to bring total file size under the ~50KB target.
   - **Rejected:** Deferring the archival pass again.
   - **Why:** Satisfies `EXECUTOR-PROTOCOL.md` §1 entry gate and keeps decision tracking fast and maintainable.
   - **How hard to undo:** Text migration between markdown files.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11":
"11-2 — Guards, JWT claims & header forwarding (PORT, Core Areas 2/3/6). `lib/tier-validation.ts`, NestJS `TierGuard`, the JWT payload in `operation-service/src/auth/`, and Next.js → service header forwarding."

Session 11-1 defined the tier matrix. This session ensures that **tier enforcement** is unified, active, and robust across the boundary between the Next.js frontend/BFF and `operation-service`. Stack D (Phase 12: Conversational AI) and Stack E (Phase 13: Live Comments & Metrics) require these guards, claims, and header pathways to enforce feature access.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 11-1 (Tier Matrix Decision + Types/Config) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [x] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 150/150 suites, 2190/2190 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 532/532 tests.
  - `railway-gateway`: 3/3 suites, 23/23 tests.
- [x] **Blast-radius confirmed**: All changes preserve 100% backwards compatibility for existing active routes; zero user-facing regressions. Verified post-execution: all 4 baselines re-run fresh, zero regressions (see Deviations).

---

## Ordered Steps

_(each step = change → immediate verification → rollback note)_

### Step 1: Run `DECISION-LOG.md` Archival Pass (Mandatory Size Gate)

- **Action:**
  - Archive resolved flag entries from `DECISION-LOG.md` into `history/decisions-archive.md`.
  - Maintain the main register table (F1–F78) and active/open flag details.
- **Safety Guarantee:** Markdown documentation archival only; zero code impact.
- **Verify:** `DECISION-LOG.md` file size reduced to $\le 55\text{ KB}$.
- **Rollback:** `git checkout -- docs/migration-orders/DECISION-LOG.md docs/migration-orders/history/decisions-archive.md`.

### Step 2: Consolidate Tier Representations & Fix `canAccessSymbol` Argument Order

- **Action:**
  1. In `lib/tier-validation.ts`:
     - Import `Tier`, `TierConfig`, `TIER_CONFIGS`, `FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`, `SYMBOLS`, `TIMEFRAMES` directly from `@trading-alerts/types/tier` (or `./tier-config`).
     - Fix `canAccessSymbol(symbol: string, tier?: Tier): boolean` signature to match `@trading-alerts/types/tier`.
     - Update internal call sites in `lib/tier-validation.ts` (`validateTierAccess` line 123, `validateAlertCreation` line 318) to pass `(symbol, tier)`.
     - Add `canAccessAiAnalyst(tier: Tier): ValidationResult` and `canAccessMarketComments(tier: Tier): ValidationResult` (Core Area 2).
  2. In `operation-service/src/tier/tier.schemas.ts`:
     - Re-export `Tier`, `SYMBOLS`, `TIMEFRAMES`, `canAccessSymbol` from `@trading-alerts/types/tier`.
- **Safety Guarantee:** Internal function signature alignment; maintains full backwards compatibility.
- **Verify:** Run `npx tsc --noEmit` across monolith and `operation-service`.
- **Rollback:** `git checkout -- lib/tier-validation.ts operation-service/src/tier/tier.schemas.ts`.

### Step 3: Wire JWT Claims & Update `TierGuard` in `operation-service`

- **Action:**
  1. In `operation-service/src/auth/next-auth-jwt.util.ts`:
     - Update `NextAuthTokenClaims` interface: type `tier: Tier`.
  2. In `operation-service/src/auth/jwt-auth.guard.ts`:
     - Update claim assignment: `tier: (claims.tier === 'PRO' ? 'PRO' : 'FREE') as Tier`.
  3. In `operation-service/src/auth/tier.guard.ts`:
     - Import `Tier`, `REQUIRE_TIER_KEY`, and `RequireTier` decorator cleanly.
     - Ensure `TierGuard` throws `ForbiddenException` with `{ error: 'Forbidden', message: 'This feature requires a PRO subscription.', reason: 'TIER_PRO_REQUIRED' }` when tier check fails.
- **Safety Guarantee:** Purely additive guard enhancement; existing routes without `@RequireTier()` pass unaffected.
- **Verify:** Run `pnpm --filter operation-service test` (all auth & tier unit tests pass).
- **Rollback:** `git checkout -- operation-service/src/auth/`.

### Step 4: Fix `forwardedRequestContext()` Header Forwarding in Monolith

- **Action:**
  - In `lib/operation-service/client.ts`:
    - Expand `forwardedRequestContext(request)` to extract and forward:
      - `user-agent`
      - `x-forwarded-for`
      - `x-forwarded-proto`
      - `x-real-ip`
      - `x-correlation-id`
      - `x-request-id`
      - `x-user-id`
      - `x-user-tier`
      - `x-user-country`
      - `x-user-currency`
      - `x-user-timezone`
    - Apply equivalent clean forwarding if similar client helper exists in `lib/money-service/` or `lib/api/`.
- **Safety Guarantee:** Additive header propagation; downstream services ignore unknown headers gracefully.
- **Verify:** Unit test `forwardedRequestContext()` ensuring all present headers are correctly populated.
- **Rollback:** `git checkout -- lib/operation-service/client.ts`.

### Step 5: Full Monorepo Build, Typecheck, and Test Suites

- **Action:**
  - Run `npx tsc --noEmit` across all 4 codebases (monolith, `operation-service`, `money-service`, `railway-gateway`).
  - Run full test suites:
    - Monolith `npm run test:ci` (expect $\ge 150$ suites, $\ge 2190$ tests).
    - `operation-service` `npm test` (42/42 suites, 395/395 tests).
    - `money-service` `npm test` (62/62 suites, 532/532 tests).
    - `railway-gateway` `npm test` (3/3 suites, 23/23 tests).
- **Safety Guarantee:** Read-only test execution.
- **Verify:** All 4 test suites pass 100% green with zero regressions.
- **Rollback:** None.

### Step 6: Session Close-Out & Next-Session Handoff

- **Action:**
  - Update `CLAUDE.md`: Current entry Session 11-2 CLOSED SUCCESSFUL.
  - Update `migration-stack-analysis.md`: Add Session 11-2 entry.
  - PRE-DRAFT Session 11-3 (`11-3-token-metering-and-schema.migration-order.md`).
- **Safety Guarantee:** Documentation updates only.
- **Verify:** Git working tree clean.
- **Rollback:** None.

---

## Rules specific to this variant

- **Ground truth priority:** `@trading-alerts/types/tier` is the authoritative definition of tier structures.
- **Safe Defaults:** Unauthenticated or missing tier claims must always resolve to `'FREE'` (default deny), never `'PRO'`.
- **Zero Breakage:** No existing endpoint or test suite in the monolith or microservices may be broken.

---

## Done when

- [x] `DECISION-LOG.md` archival pass completed (file size under target). 66,296 → 26,320 bytes.
- [x] Three tier representations consolidated to `@trading-alerts/types/tier`.
- [x] `canAccessSymbol` argument order unified to `(symbol, tier)` across the entire repository.
      Two live call sites the order didn't name (`middleware/tier-check.ts`,
      `app/api/drawings/route.ts`) found and fixed too — see Deviations.
- [x] `canAccessAiAnalyst` and `canAccessMarketComments` validation helpers added to `lib/tier-validation.ts`.
- [x] `operation-service` JWT claims and `TierGuard` verified.
- [x] `forwardedRequestContext()` forwards full header context (correlation, GeoIP, tier, user).
- [x] All 4 test suites pass 100% green with zero regressions.
- [x] Session 11-3 PRE-DRAFTed.

---

## Rollback

- Code changes: `git checkout` / `git revert` on modified files.
- Tokens: In-flight NextAuth sessions retain valid JWE decryption since claims structure is backward-compatible.

---

## Deviations

**1. Two extra `canAccessSymbol` call sites found and fixed, not named in Step 2 (Davin-approved
at CONFIRM).** The order's Step 2 named exactly two internal `lib/tier-validation.ts` call sites
to update (`validateTierAccess` line 123, and a line-318 site the order mis-cited as
`validateAlertCreation` — no such function exists in that file; the real containing function is
`validateFullTierAccess`, line number correct, name wrong). A live grep at CONFIRM found two more:
`middleware/tier-check.ts:82` and `app/api/drawings/route.ts:135` both import `canAccessSymbol`
directly from `lib/tier-validation.ts` and called it with the old `(tier, symbol)` order. Flipping
the signature without updating these would have silently swapped the arguments' meaning at two
live call sites — the exact footgun class this session exists to eliminate. Fixed alongside the
two named sites, plus the 3 test files asserting the old order
(`__tests__/lib/tier-validation.test.ts`, `__tests__/integration/tier1-workflows.test.ts`,
`__tests__/integration/tier2-workflows.test.ts`).

**2. `REQUIRE_TIER_KEY` kept local, not imported from `@trading-alerts/types/tier` as Decision 2.3
literally says (Davin-approved at CONFIRM).** `packages/types/src/tier/index.ts` exports `Tier`/
`TierConfig`/constants/helpers only — no `REQUIRE_TIER_KEY`. It's defined in
`operation-service/src/auth/tier.guard.ts` itself, alongside the `RequireTier` decorator. Only
`Tier` was moved to import from the shared package; `REQUIRE_TIER_KEY`/`RequireTier` stayed local
— adding them to the shared package would be new scope beyond this order's `Decisions taken`.

**3. Undisclosed pre-existing gap found executing Step 2: `operation-service`'s own embedded
`packages/types` mirror was never synced with Session 11-1's new `tier/` module.**
`operation-service/packages/types/` is a physically separate, git-tracked copy of
`@trading-alerts/types` (commit `87242f09`, "embed packages/types locally for Railway
single-directory upload") — `operation-service`'s `package.json` depends on
`file:./packages/types`, a nested subdirectory, not a symlink to the monorepo root. Session 11-1
added the entire `tier/` module (types/constants/helpers/index) to the canonical
`packages/types/src/tier/` but this embedded mirror was never updated: no `src/tier`, no
`dist/tier`, no `./tier` export in its own `package.json`. Invisible until `operation-service`'s
own `npm test` tried to resolve `@trading-alerts/types/tier` and failed outright
(`jest-resolve`'s `_throwModNotFoundError`). Fixed by copying `src/tier/*.ts` and the root barrel
(`src/index.ts`) verbatim from the canonical copy into the mirror, adding the `./tier`
exports/`typesVersions` entries to its `package.json`, and rebuilding `dist/` via its own
`prebuild`/`build` script. Not scope creep — squarely inside Step 2's "consolidate ... to consume
`@trading-alerts/types/tier` directly" and impossible to complete without it.

**4. Header-forwarding "why" framing corrected, no action needed.** The order's own "Why this
session exists" (quoting the roadmap) claimed `forwardedRequestContext()` "forwards only
`x-correlation-id`/`user-agent`/`x-forwarded-for`." Live code at CONFIRM showed it forwarded only
`user-agent`/`x-forwarded-for` — `x-correlation-id` was never actually forwarded. Step 4's target
list was already a correct superset, so the fix itself needed no change; noted for the record.

**5. A pre-commit-hook incident during Step 2's first commit attempt, recovered cleanly, zero work
lost.** The commit failed on a real (pre-existing, unrelated) `eslint` error — an unused
`checkFeatureAccess` import in `__tests__/integration/tier1-workflows.test.ts`, fixed inline.
`lint-staged`'s own stash-based "revert to original state" recovery step then itself crashed
(`unable to unlink old '...migration-process-handbook-antigravity-v12.xlsx': Invalid argument` — a
file elsewhere in the working tree was locked, likely open in another program), aborting with
`fatal: Could not reset index file to revision 'HEAD'` and leaving several just-edited files
reverted in the working tree while the git index still held the correct staged content. Recovered
via the automatic `lint-staged automatic backup` stash it creates before touching anything —
`git checkout stash@{0} -- <path>` (updates both index and working tree) for files whose index was
also affected, `git checkout -- <path>` (restores from the still-correct index) for the rest —
verifying zero diff against the stash at each step before re-attempting the commit. No files or
edits were lost; `LESSONS-LEARNED.md` L36 extended with the recovery procedure.

**6. A transient test flake during CONFIRM's baseline re-verification, not a regression.** Running
all 4 codebases' test suites concurrently produced `money-service` 61/62 · 531/532 —
`prisma.shutdown.spec.ts`'s SIGTERM graceful-shutdown test exceeded its 5000ms timeout under the
combined CPU load. Re-run in isolation: clean 62/62 · 532/532. `LESSONS-LEARNED.md` L24 territory,
not a new lesson.

---

## Next-session handoff

- **Next session:** `11-3` — Token Metering & Schema (Phase 11, third of 3 sessions).
- **Prerequisite:** Session 11-2 CLOSED SUCCESSFUL.
- **Scope:** Redis `trackAiTokenUsage()` sliding-window limiter, `TokenUsageLog` model and `profile` JSONB in `prisma/non-market-data/schema.prisma`, author `HANDOVER-PROMPT-phase-12.md`.
