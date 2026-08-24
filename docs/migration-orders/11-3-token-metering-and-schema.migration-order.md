# Migration Order — Session 11-3 — Token Metering & Schema

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (INFRA + PORT
> variant: the end-state — a Redis sliding-window token limiter gating AI-token usage, backed by a
> `TokenUsageLog` model and `User.profile` JSONB field — is fixed by the spec; the exact integration
> into the existing rate-limiter and schema layout is this session's own judgment call).
> **PRE-DRAFTed by the Executor at Session 11-2's close (2026-08-24)**, upgraded to **authoritative
> DRAFT by the Advisor / Antigravity (2026-08-25)** per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11"
> and `davintrade-stack-d-and-e/PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md` §3 (Core Areas 4 & 5).

**Session:** 11-3 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, third and final session of Phase 11) · **Variant:** INFRA + PORT · **Status:** CONFIRMED  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-25 (Advisor / Antigravity) · **Approved:** 2026-08-25 (Davin, live in chat — explicit confirmation quoted in CONFIRM) · **Confirmed:** 2026-08-25 (Executor — entry criteria + fresh baselines re-verified live, see CONFIRM report)  
**Flags touched:** none (plumbing, token metering, and schema extensions; no runtime feature flag needed).  
**Estimated time:** ~3–4h (schema extensions in `prisma/non-market-data/schema.prisma`, `prisma db push`, `trackAiTokenUsage()` Redis integration, dummy tier-gated AI route + tests, authoring `HANDOVER-PROMPT-phase-12.md`, closing Phase 11).  
**Target components:** `prisma/non-market-data/schema.prisma`, `lib/rate-limit.ts`, `operation-service/src/redis/redis.service.ts`, `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`.

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.

1. **`TokenUsageLog` Model & `User.profile` JSONB Schema Design (Core Area 5)**
   - **Chosen:** In `prisma/non-market-data/schema.prisma` (root monolith):
     - Add `profile Json?` to the `User` model (stores user-level AI preferences, e.g. `{ preferredLlm: "gemini-3-6-flash", riskTolerance: "moderate" }`).
     - Add `TokenUsageLog` model:

       ```prisma
       model TokenUsageLog {
         id               String   @id @default(cuid())
         userId           String
         model            String   // "gemini-3-6-flash" | "claude-3-5-sonnet"
         promptTokens     Int
         imageTokens      Int      @default(0)
         completionTokens Int
         estimatedCostUsd Float
         timestamp        DateTime @default(now())

         user User @relation(fields: [userId], references: [id], onDelete: Cascade)

         @@index([userId, timestamp])
         @@map("token_usage_log")
       }
       ```

     - Add `tokenLogs TokenUsageLog[]` relation on `User`.
     - Apply to Postgres database via `npx prisma db push` from the root monolith, followed by `npx prisma generate` in root and `operation-service` (`LESSONS-LEARNED.md` L1).

   - **Rejected:** Creating tracked Prisma migration folders (this repo manages non-market-data schema via `prisma db push`) or running schema mutations from `operation-service`.
   - **Why:** Event-log style rows enable granular per-call AI auditability, cost monitoring (Session 12-3), and computer vision token tracking, while `User.profile` provides lightweight JSONB extensibility.
   - **How hard to undo:** Plain Prisma schema rollback via `db push`.

2. **Redis Token Usage Limiter Integration (Core Area 4 — No 4th Layer)**
   - **Chosen:** Implement `trackAiTokenUsage()` by integrating directly into the existing Redis infrastructure (`lib/rate-limit.ts` in monolith and `operation-service/src/redis/redis.service.ts` in NestJS):
     - Monthly key pattern: `ratelimit:ai_tokens:${userId}:${yearMonth}` (e.g. `ratelimit:ai_tokens:usr_123:2026-08`).
     - Uses atomic Redis `INCRBY` + 35-day TTL (`EXPIRE key 3024000`) on first write.
     - Compares total consumed tokens against `monthlyQuota` (500,000 for PRO, 0 for FREE from `@trading-alerts/types/tier`).
     - Returns `{ allowed: boolean, limit: number, remaining: number, currentUsage: number }`.
   - **Rejected:** Adding an isolated 4th rate-limiting daemon or creating separate Redis connection pools.
   - **Why:** Reuses existing Redis clients and connection pooling with $O(1)$ atomic increment performance, fulfilling the strict "do not add a 4th layer" architectural mandate.
   - **How hard to undo:** Trivial helper refactoring.

3. **Tier-Gated Dummy AI Route & 429 Quota Test**
   - **Chosen:** Create a dedicated test route (`app/api/test/ai-metering/route.ts` or `operation-service/src/test/ai-metering.controller.ts`) to prove end-to-end enforcement:
     - FREE tier user request $\rightarrow$ `403 Forbidden` (`reason: "TIER_PRO_REQUIRED"`).
     - PRO tier user request below quota ($< 500\text{k}$ tokens) $\rightarrow$ `200 OK` with remaining token balance.
     - PRO tier user request exceeding quota ($\ge 500\text{k}$ tokens) $\rightarrow$ `429 Too Many Requests` (`error: "Monthly AI token quota exceeded"`).
     - Backed by unit/integration tests asserting exact 403, 200, and 429 response codes.
   - **Rejected:** Skipping route verification or waiting until Phase 12 to test token enforcement.
   - **Why:** Establishes concrete, automated proof that the tier and token metering boundary works before building the real Multimodal AI Analyst in Phase 12.
   - **How hard to undo:** Route deletion at Phase 12 start.

4. **Phase 11 Close & Phase 12 Handover Prompt Generation**
   - **Chosen:** Author `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md` at close, and mark Phase 11 **CLOSED SUCCESSFUL** across `CLAUDE.md` and roadmap tracking.
   - **Rejected:** Deferring handover prompt creation.
   - **Why:** Fulfills the phase transition protocol and unblocks Phase 12 (Stack D: Conversational AI Analyst).
   - **How hard to undo:** Markdown documentation maintenance.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11":
"11-3 — Token metering & schema (INFRA + PORT, Core Areas 4/5). Redis `trackAiTokenUsage()` sliding-window limiter (integrate with the existing three-layer rate limiter, do not add a fourth), `TokenUsageLog` model and `profile` JSONB via `prisma db push` (this repo's convention — no migrations folder; L1 applies: author in `prisma/non-market-data/schema.prisma`, `prisma generate` only on the service side). **Done when:** a tier-gated dummy AI route returns 429 at quota, proven by test."

This session is the third and final session of Phase 11. It completes the preparatory access control and metering foundation required by Stack D (Phase 12: Multimodal AI Analyst) and Stack E (Phase 13: Live Market Comments & Quality Metrics).

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 11-2 (Guards, JWT Claims & Header Forwarding) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 150/150 suites, 2190/2190 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 532/532 tests.
  - `railway-gateway`: 3/3 suites, 23/23 tests.
- [ ] **Prisma schema target verified**: `prisma/non-market-data/schema.prisma` exists and is the sole target for `User.profile` and `TokenUsageLog` schema authoring (`LESSONS-LEARNED.md` L1).
- [ ] **Redis client connectivity verified**: Redis is accessible for sliding-window and token counter operations.

---

## Ordered Steps

_(each step = change → immediate verification → rollback note)_

### Step 1: Author Schema Extensions in `prisma/non-market-data/schema.prisma`

- **Action:**
  1. In `prisma/non-market-data/schema.prisma`:
     - Add `profile Json?` to `User` model.
     - Add `tokenLogs TokenUsageLog[]` to `User` model.
     - Add `model TokenUsageLog` with `id`, `userId`, `model`, `promptTokens`, `imageTokens`, `completionTokens`, `estimatedCostUsd`, `timestamp`, and `@@index([userId, timestamp])`.
  2. Run `npx prisma db push --schema prisma/non-market-data/schema.prisma` from root monolith.
  3. Run `npx prisma generate --schema prisma/non-market-data/schema.prisma` in root monolith.
  4. In `operation-service/`: run `npx prisma generate` (`LESSONS-LEARNED.md` L1 — never run `db push` from `operation-service`).
- **Safety Guarantee:** Additive schema change (one optional nullable column, one new table); zero impact on existing tables.
- **Verify:** Monolith and `operation-service` TypeScript compilers recognize `prisma.tokenUsageLog` and `User.profile`.
- **Rollback:** Remove model/column from schema and re-run `prisma db push`.

### Step 2: Implement Redis `trackAiTokenUsage()` in Monolith & `operation-service`

- **Action:**
  1. In `lib/rate-limit.ts` (monolith):
     - Implement `trackAiTokenUsage(userId: string, tokensUsed: number, monthlyQuota?: number): Promise<{ allowed: boolean; limit: number; remaining: number; currentUsage: number }>`.
     - Key: `ratelimit:ai_tokens:${userId}:${new Date().toISOString().slice(0, 7)}`.
     - TTL: 35 days (3,024,000s) on initial `INCRBY`.
  2. In `operation-service/src/redis/redis.service.ts` (or `operation-service/src/token-metering/`):
     - Implement identical `trackAiTokenUsage()` method using the service's Redis client.
- **Safety Guarantee:** Standalone Redis key namespace (`ratelimit:ai_tokens:*`); zero collision with existing session or price keys.
- **Verify:** Run Redis token metering unit tests; verify increment, TTL, quota limit calculation.
- **Rollback:** `git checkout -- lib/rate-limit.ts operation-service/src/`.

### Step 3: Implement Dummy Tier-Gated AI Route & Quota Tests

- **Action:**
  1. Create dummy test endpoint `app/api/test/ai-metering/route.ts`:
     - Checks user authentication and tier.
     - FREE tier $\rightarrow$ `403 Forbidden` (`reason: "TIER_PRO_REQUIRED"`).
     - PRO tier $\rightarrow$ calls `trackAiTokenUsage(userId, tokensUsed, 500_000)`.
     - Over quota $\rightarrow$ `429 Too Many Requests` (`error: "Monthly AI token quota exceeded"`).
     - Under quota $\rightarrow$ `200 OK` (`{ success: true, remainingTokens }`).
  2. Create automated unit/integration tests in `__tests__/api/test-ai-metering.test.ts` (and `operation-service` test suite) testing:
     - 403 response for FREE tier user.
     - 200 response for PRO tier user with remaining tokens.
     - 429 response when simulated token consumption exceeds 500,000.
- **Safety Guarantee:** Test-only endpoint and test suites; zero production traffic impact.
- **Verify:** Run `npm test` covering the dummy route; all test cases pass 100%.
- **Rollback:** `git checkout -- app/api/test/ __tests__/`.

### Step 4: Full Monorepo Build, Typecheck, and Test Suites

- **Action:**
  - Run `npx tsc --noEmit` across monolith, `operation-service`, `money-service`, and `railway-gateway`.
  - Run full test suites:
    - Monolith `npm run test:ci` (expect $\ge 150$ suites, $\ge 2190$ tests).
    - `operation-service` `npm test` (42/42 suites, 395/395 tests).
    - `money-service` `npm test` (62/62 suites, 532/532 tests).
    - `railway-gateway` `npm test` (3/3 suites, 23/23 tests).
- **Safety Guarantee:** Read-only test execution.
- **Verify:** All 4 test suites pass 100% green with zero regressions.
- **Rollback:** None.

### Step 5: Author Phase 12 Handover Prompt & Close Phase 11

- **Action:**
  - Author `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`.
  - Update `CLAUDE.md`: Current entry Session 11-3 CLOSED SUCCESSFUL, Phase 11 **CLOSED SUCCESSFUL**.
  - Update `migration-stack-analysis.md`: Add Session 11-3 entry.
  - PRE-DRAFT Session 12-0 (`12-0-decisions-and-contracts.migration-order.md`).
- **Safety Guarantee:** Documentation updates only.
- **Verify:** Git working tree clean.
- **Rollback:** None.

---

## Rules specific to this variant

- **`LESSONS-LEARNED.md` L1 is binding:** Schema mutations (`prisma db push`) run strictly from root monolith (`prisma/non-market-data/schema.prisma`). Consuming services (`operation-service`) run only `prisma generate`.
- **Integrate into existing Redis limiter:** Do not introduce a fourth rate-limiting library or unpooled connection.
- **Done When Criteria:** The dummy AI route must verifiably return `429 Too Many Requests` at token quota exhaustion, covered by an automated test.

---

## Done when

- [ ] `TokenUsageLog` model and `User.profile` JSONB field exist in `prisma/non-market-data/schema.prisma`, pushed and generated.
- [ ] `trackAiTokenUsage()` implemented in monolith and `operation-service` Redis layers.
- [ ] Tier-gated dummy AI route returns `429` at quota limit, proven by automated unit tests.
- [ ] All 4 monorepo test suites pass 100% green with zero regressions.
- [ ] `HANDOVER-PROMPT-phase-12.md` authored.
- [ ] Phase 11 declared **CLOSED SUCCESSFUL**.
- [ ] Session 12-0 PRE-DRAFTed.

---

## Rollback

- Database schema: Remove `TokenUsageLog` and `User.profile` from `prisma/non-market-data/schema.prisma` and run `prisma db push`.
- Code: `git checkout` / `git revert` on Step 2 and Step 3 commits.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

**Step 1 — `db push` replaced with a targeted `prisma db execute` script (real plan-vs-live-code
conflict, not a preference change).** The order's own Step 1 Safety Guarantee ("Additive schema
change... zero impact on existing tables") is true of the schema edit itself but not of running
`prisma db push --schema prisma/non-market-data/schema.prisma` as literally instructed: this repo's
two schema files (`prisma/non-market-data/`, `prisma/market-data/`) share one physical database via
the same `DIRECT_URL` (`prisma.config.ts`), with no `multiSchema` fencing. `db push` diffs the
_entire_ live database against whichever single schema file is targeted, so `market_data_v6`
(declared only in the sibling file, owned by `railway-gateway`'s protected ingest path —
`EXECUTOR-PROTOCOL.md` §5) reads as an orphaned table and gets proposed for a destructive DROP. Live
run confirmed this: `db push` refused with "You are about to drop the `market_data_v6` table, which
is not empty (1 rows)" and exited without applying anything (no `--accept-data-loss` was passed).
This is a known, previously-solved landmine, not a new one — `migration-stack-analysis.md:1095-1098`
documents Session 2-3 hitting the identical issue and hand-writing migration SQL instead of using
`prisma migrate dev`/`db push` for exactly this reason; Session 8-2 followed the same
hand-reviewed-script pattern for its own `market_data_v6` DDL. Stopped and reported to Davin before
applying anything; Davin approved the established workaround live in chat. Applied: generated the
exact DDL via `prisma migrate diff --from-schema <committed HEAD> --to-schema
prisma/non-market-data/schema.prisma --script` (pure schema-to-schema diff, zero DB connection —
`LESSONS-LEARNED.md` L6), saved as `docs/migration-orders/session-11-3-token-metering-schema.sql`,
applied via `prisma db execute --file <script>` (raw SQL, no full-database diff). Live spot-check
post-apply (`LESSONS-LEARNED.md` L14): `User.profile` column exists, `token_usage_log` table exists,
`market_data_v6` untouched at its original 1 row. `prisma generate` then ran normally on both the
monolith (`--schema prisma/non-market-data/schema.prisma`) and `operation-service` (plain `prisma
generate`, per L1 — schema mutations never run from the consuming service). Monolith `tsc --noEmit`
clean, confirms `prisma.tokenUsageLog`/`User.profile` types resolve.

**`operation-service/prisma/schema.prisma` deliberately NOT updated with `profile`/`TokenUsageLog`.**
That file is a hand-maintained, physically separate _narrow_ mirror (only auth-relevant `User`
fields + `RefreshToken`, no relations) — its own header comment already documents "any future change
... must be mirrored here by hand" (the same drift class `LESSONS-LEARNED.md` L19 flagged for
`operation-service`'s embedded `packages/types` copy at Session 11-2). Neither of this session's own
deliverables need it: `trackAiTokenUsage()` (Step 2) is Redis-only, and the dummy tier-gated route
(Step 3) targets the monolith. `prisma generate` still ran in `operation-service` per the order's own
Step 1 instruction — a no-op regen of its existing, unchanged client. Flagged here (not filed as a
new `DECISION-LOG.md` item — no decision was made, just scope correctly excluded) so whichever future
session first needs `operation-service` to read `TokenUsageLog` (Session 12-3's "cost surveillance
into `TokenUsageLog`" is the likely first consumer) knows the hand-sync is still owed.

---

## Next-session handoff

- **Next Phase:** Phase 11 CLOSED. **Phase 12 (Stack D: Multimodal Conversational AI Analyst)** begins.
- **Next Session:** `12-0` — Decisions & Contracts (CONTRACT variant, no code). Resolves **F69** (LLM provider/model/cost ceiling, `⚠ NEEDS EXPLICIT SIGN-OFF`) and **F70** (VANNA/txtai runtime host + `market_data_v6` DB-role grants).
- **Handoff Artifact:** `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md` (authored in Step 5).
