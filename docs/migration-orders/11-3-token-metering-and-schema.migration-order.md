# Migration Order — Session 11-3 — Token Metering & Schema

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (INFRA + PORT
> variant: the end-state — a Redis sliding-window limiter gating AI-token usage, backed by a
> `TokenUsageLog` model — is fixed by the spec; the exact integration path into the existing
> rate-limiter and schema layout is this session's own judgment call).

**Session:** 11-3 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, third of 3 sessions) · **Variant:** INFRA + PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-24 (Executor, at Session 11-2's close) · **Flags touched:** none registered yet — this session's own investigation may surface one if the token-quota numbers themselves turn out to be a genuinely product-level call (see Decisions needed below). **Estimated time:** ~3–4h (Redis limiter integration, one new Prisma model + one new JSONB field, a dummy tier-gated AI route to prove the 429 end-to-end, `HANDOVER-PROMPT-phase-12.md`).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11":
"11-3 — Token metering & schema (INFRA + PORT, Core Areas 4/5). Redis `trackAiTokenUsage()` sliding-window limiter (integrate with the existing three-layer rate limiter, do not add a fourth), `TokenUsageLog` model and `profile` JSONB via `prisma db push` (this repo's convention — no migrations folder; L1 applies: author in `prisma/non-market-data/schema.prisma`, `prisma generate` only on the service side). **Done when:** a tier-gated dummy AI route returns 429 at quota, proven by test."

Sessions 11-1 and 11-2 built the tier matrix and the enforcement plumbing (guards, JWT claims,
header forwarding) that Stack D (Phase 12) needs. This session closes Phase 11 by giving Stack D
somewhere to record and cap AI token spend per user — the mechanism `F69` (Stack D's LLM cost
ceiling, still OPEN, owned by Session 12-0) will actually enforce against.

---

## Facts verified live at PRE-DRAFT time (not fabricated — re-verify fresh at CONFIRM)

- **`TokenUsageLog` does not exist anywhere in the codebase today** (confirmed via repo-wide grep,
  zero matches) — this is genuinely new work, not a reconciliation.
- **`trackAiTokenUsage()` does not exist anywhere either** — same, new work.
- **`lib/rate-limit.ts` (monolith) is a real, working Redis sliding-window limiter** — two
  configs today: `AUTH_RATE_LIMIT_CONFIG` (5 req/15min) and `TIER_RATE_LIMIT_CONFIGS` (FREE
  60/hour, PRO 300/hour), both keyed by a `prefix` + Redis sorted-set sliding window. The
  roadmap's "three-layer rate limiter" framing implies a third layer beyond these two — not
  independently confirmed at PRE-DRAFT time; `operation-service/src/auth/{auth.service.ts,
auth-error.filter.ts, errors.ts}` reference rate-limiting too and may be that third layer, or a
  service-side mirror of the same two. **Read all of `lib/rate-limit.ts` plus those 3
  operation-service files in full at DRAFT/CONFIRM before deciding the integration shape** — the
  order's own "do not add a fourth" constraint depends on knowing exactly how many layers exist
  and where token metering fits alongside them, not just request-count limiting.
- **`prisma/non-market-data/schema.prisma`'s `User` model has no `profile` JSONB field today**
  (checked the model's own field list) — the roadmap's "`profile` JSONB" addition is net-new, not
  a rename or expansion of an existing column. Its exact purpose (a cache of derived
  token-usage/quota state? something else Stack D needs?) is not specified anywhere found at
  PRE-DRAFT time — needs sourcing from `PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md`
  §3 Core Areas 4/5 directly at DRAFT (not re-derived from the roadmap's one-line summary alone,
  per `LESSONS-LEARNED.md` L39).
- **This repo's schema convention has no migrations folder** — confirmed by the roadmap's own
  citation and consistent with every other schema change this migration has made; `prisma db push`
  is the mechanism, authored in `prisma/non-market-data/schema.prisma`, `prisma generate` re-run
  only on the consuming service side (per `LESSONS-LEARNED.md` L1 — **never** run a schema mutation
  command from `money-service` or `operation-service`, only `prisma generate`).
- **Entry criterion met:** Session 11-2 (guards/JWT/header-forwarding) is CLOSED SUCCESSFUL as of
  this PRE-DRAFT's own writing (2026-08-24) — re-verify fresh at this session's own CONFIRM
  regardless.
- **This session's own close owes `HANDOVER-PROMPT-phase-12.md`** per
  `MASTER-ROADMAP-PHASES-7-15.md`'s phase-handover-trigger table ("11-3 writes phase-12's") — a
  phase-level artifact for Davin/the Advisor, not covered by the Executor's normal PRE-DRAFT duty;
  flagged here so it isn't missed at this session's own close.
- **Not this session's job, flagged so it isn't rediscovered as a surprise:** `F69` (Stack D's LLM
  provider/model/cost ceiling) is still OPEN, owned by Session 12-0 — this session builds the
  metering _mechanism_ (count tokens, cap at a quota, return 429), not the real quota numbers or
  provider choice. Use a placeholder/config-driven quota for the "Done when" dummy route; do not
  guess at F69's real answer.

---

## Decisions needed (flagged for the Advisor to resolve at DRAFT — not resolved here)

1. **Integration shape with the existing rate limiter(s).** Does `trackAiTokenUsage()` become a
   third `RateLimitConfig`-style entry in `lib/rate-limit.ts` (same sliding-window primitive,
   different unit — tokens instead of requests), a wholly separate Redis key scheme reusing only
   the underlying sliding-window function, or something operation-service-side instead (Stack D's
   actual AI routes will live in `operation-service`, not the monolith, per Phase 12's own
   session list)? The order's own "integrate ... do not add a fourth [layer]" constraint needs the
   real layer count from the Facts-above investigation before this can be answered.
2. **`profile` JSONB's actual shape and purpose.** Source directly from the prep spec's Core Areas
   4/5 text (not the roadmap's one-line summary) — what fields, who writes it, does it duplicate
   anything `TokenUsageLog` itself would already need to track.
3. **`TokenUsageLog`'s own schema.** Per-request rows (one row per AI call, aggregated on read) vs.
   a single running-counter row per user per window (updated in place)? The former is easier to
   audit/debug and matches this repo's other event-log-style models (`SecurityAlert`,
   `DisbursementAuditLog`); the latter is cheaper to query at request time. Needs a call from the
   Advisor informed by Stack D's actual read pattern (Session 12-3's "cost surveillance into
   `TokenUsageLog`" — read that session's own scope before deciding this schema's shape, since
   12-3 is the real consumer).
4. **The dummy AI route's exact placement and quota value for the "Done when" proof.** A genuinely
   throwaway route (deleted before Phase 12 builds the real ones) vs. a route Phase 12 later
   fleshes out. Recommend throwaway — Phase 12's own sessions (12-3 particularly) own the real
   integration and its own quota semantics from F69.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 11-2 (Guards, JWT Claims & Header Forwarding) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Baseline test suites 100% green** (monolith, `operation-service`, `money-service`,
      `railway-gateway` — figures to be re-verified fresh at CONFIRM, not copied from 11-2's close).
- [ ] **The real layer count of "the existing three-layer rate limiter" confirmed** (see Facts
      above) — the Decisions-needed integration-shape question can't be answered from this
      PRE-DRAFT's own incomplete read.
- [ ] **`PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md` §3 Core Areas 4/5 read in
      full** (not just the roadmap's one-line summary) — sources the `profile` JSONB shape and any
      `TokenUsageLog` field requirements this PRE-DRAFT couldn't find.

---

## Ordered steps (Advisor to complete — sketch only, do not execute from this PRE-DRAFT)

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Read the prep spec's Core Areas 4/5 in full**, plus `lib/rate-limit.ts` and the 3
   `operation-service/src/auth/*` rate-limit-referencing files, to resolve Decisions 1–3 above.
2. **Author the `TokenUsageLog` model and `User.profile` JSONB field** in
   `prisma/non-market-data/schema.prisma`, per the resolved schema shape; `prisma db push` +
   `prisma generate` (monolith side); re-run `prisma generate` only (never a schema mutation) on
   whichever service(s) the resolved integration shape touches, per L1.
3. **Implement `trackAiTokenUsage()`**, integrated into the existing limiter per the resolved
   Decision 1 shape — reuse the existing sliding-window primitive, don't reimplement it.
4. **Build the dummy tier-gated AI route** proving the "Done when" 429-at-quota behavior, covered
   by a real test (not just a code read).
5. **Full baseline re-run** — `test:ci` must not go backwards.
6. **Author `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`**
   (this session's own phase-handover duty, not the Executor's usual PRE-DRAFT-next-session duty —
   see Facts above) at session close, informed by this session's own real closing baselines.

---

## Rules specific to this variant

- Ground truth priority: live code (`lib/rate-limit.ts`, `operation-service/src/auth/*`,
  `prisma/non-market-data/schema.prisma`) and the prep spec's own Core Areas 4/5 text > the
  roadmap's one-line summary of them (`LESSONS-LEARNED.md` L39 — a paraphrase of a paraphrase can
  drop a scoping detail).
- `prisma db push`, never a migrations-folder command — this repo has none (see Facts above).
  `LESSONS-LEARNED.md` L1 applies without exception: schema mutation commands run from the
  monolith only; every other codebase only ever runs `prisma generate`.
- "Do not add a fourth [rate-limit layer]" is the order's own explicit constraint — resolve the
  real current layer count before designing the integration, don't assume 2 (monolith) or 3
  (roadmap's own count) without checking `operation-service` too.

---

## Done when

- [ ] `TokenUsageLog` model and `User.profile` JSONB field exist in
      `prisma/non-market-data/schema.prisma`, pushed and generated.
- [ ] `trackAiTokenUsage()` implemented, integrated with the existing rate-limiter architecture
      (no new, independent 4th mechanism).
- [ ] A tier-gated dummy AI route returns 429 at quota, proven by a real test.
- [ ] Baseline test suites 100% green, net-neutral-or-better (no silently-adjusted assertions).
- [ ] `HANDOVER-PROMPT-phase-12.md` authored.
- [ ] Phase 11 marked CLOSED in `CLAUDE.md` / `MASTER-ROADMAP-PHASES-7-15.md`-adjacent tracking.

---

## Rollback

Primarily an additive schema + Redis-key change. `git revert` the session's commits per step. If
`prisma db push` already applied the schema change before a later step needs reverting, the new
model/column can be dropped via a follow-up `db push` against a schema with the change removed
(document the exact revert schema here at DRAFT time, not left implicit).

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

- **Next:** Phase 11 CLOSED. Phase 12 (Stack D: Conversational AI Analyst) begins at Session
  12-0 — Decisions & contracts (CONTRACT, no code), resolving **F69** (LLM provider/model/cost
  ceiling, ⚠ NEEDS EXPLICIT SIGN-OFF) and **F70** (VANNA/txtai runtime host + `market_data_v6`
  DB-role/schema question, still OPEN per `DECISION-LOG.md`).
- **Prerequisite:** Session 11-3 CLOSED SUCCESSFUL; `HANDOVER-PROMPT-phase-12.md` authored at this
  session's own close (see Ordered Steps above).
