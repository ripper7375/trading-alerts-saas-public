# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 2, Session 2-3 (complete — production migration history
  baselined, F20 RESOLVED; cross-domain FK audit applied, 4 money models' `@relation`
  to `User` dropped) — 2026-07-20. Phase 1 still formally NOT exit-clean (F18 the sole
  blocker, unchanged, dashboard-only). Phase 0 still formally open (CC-A gap
  unchanged, see below).
- **Current order:** `docs/migration-orders/2-3-baseline-migration-fk-audit.migration-order.md`
  (EXECUTED, both Ordered Steps complete, all 6 Slice-level verification items
  checked)
- **Order status:** EXECUTED — F20 RESOLVED. `drop_watchlists` handled per Davin's
  live decision (option b, strip-and-orphan): removed from `prisma/migrations/`
  entirely, never applied; `Watchlist`/`WatchlistItem` remain live in production,
  permanently orphaned. The other 5 migrations baselined via `resolve --applied`
  (zero SQL executed — live schema already matched). FK audit: `Subscription`,
  `Payment`, `FraudAlert`, `AffiliateProfile`'s `@relation` to `User` removed in
  `prisma/non-market-data/schema.prisma` (+ `User`'s 4 reverse fields); `userId`
  columns + existing `@@index([userId])` unchanged. Applied to production via a
  hand-written migration (4 `ALTER TABLE ... DROP CONSTRAINT ...`, constraint names
  confirmed from the init migration's SQL — NOT via `prisma migrate dev`, which would
  have shadow-diffed the partial schema and proposed dropping `market_data_v6`).
  **Major deviation, Davin-approved live:** the PRE-DRAFT's plan for two independent
  migration histories (one per split schema) was abandoned at CONFIRM — Prisma 7's
  migrations path is a single, config-driven setting, not per-`--schema`, and two
  histories would likely share one `_prisma_migrations` table untestably (no staging
  env). Single shared `prisma/migrations/` kept as sole source of truth for both
  schemas until a future physical DB split. Full detail: the order's own Deviations
  section, `DECISION-LOG.md` F20, `LESSONS-LEARNED.md` L24. Full `npm run test:ci`:
  111/111 suites, 2046/2046 tests, exact parity with Session 2-2's baseline, zero
  deltas. Consumer imports and old `prisma/schema.prisma` still untouched — that's
  Session 2-4, next.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys (Session 2-1 confirmed Vercel's own mechanism works independently),
  just dead/broken CI hygiene, not urgent. `DIRECT_URL` on Vercel RESOLVED (Session
  2-1, Davin added it). (2, RESOLVED Session 2-3) Production's Prisma migration
  history is now baselined — F20 closed, see `DECISION-LOG.md`. `drop_watchlists`
  was never executed (Davin's option b); `Watchlist`/`WatchlistItem` remain live,
  permanently orphaned. (3, non-blocking, unchanged) F18's RPO gap — Railway
  automated-backup cadence still unverified via CLI (dashboard-only). (4, unchanged,
  carried over) Davin to grant Vercel dashboard/preview-branch access — Railway
  access exists in this environment, Vercel access still fully absent. (5, unchanged,
  carried over) A human with delete permission to remove 5 remote branches — this
  session's git credential can push/create branches but gets `HTTP 403` on
  `git push --delete`. Branches: `fix/tsconfig-exclude-case-sensitivity`,
  `salvage/windowed-centroid-cfl-indicator` (both merged), plus 3 stale `claude/*`
  branches. (6, unchanged, carried over) `railway`'s `tcp-proxy`/`private-network`
  CLI commands still not verified — low priority, nobody's blocked on it.
  (7, unchanged, carried into Session 2-4) Session 2-2's preliminary grep found none
  of the 16 known consumer files appear to touch `MarketDataV6` directly (all
  reference disbursement/affiliate/auth/session models) — if this holds at Session
  2-4's CONFIRM, all 16 repoint to the non-market client and zero to the market
  client, but this needs re-verifying per-file (by model usage, not just the import
  line), not assumed. (8, resolved Session 2-2's follow-up close, carried as
  reference) Session numbering was corrected then — the cutover order is **Session
  2-4** ("Rewire the monolith"), not "2-2b"; see `LESSONS-LEARNED.md` L23. (9,
  RESOLVED Session 2-3) F20's hard escalation is closed — Davin gave his live
  `drop_watchlists` decision (option b) and a staging-waiver; both executed exactly
  as instructed and quoted verbatim in the order's Deviations section and
  `DECISION-LOG.md` F20. (10, RESOLVED Session 2-3) The FK audit's 4 models
  (`Subscription`, `Payment`, `FraudAlert`, `AffiliateProfile`) had their `@relation`
  to `User` dropped in production this session — **now live, not just planned.**
  Session 2-4 must grep for and adapt any consumer call site doing
  `include: { user: true }` (or `select: { user: ... }`) on these 4 models, or it
  will fail to compile once repointed to the non-market client. (11, unchanged,
  carried over as F21) The 24h Account-Deletion GDPR gap — no production code path
  performs the deletion `app/api/user/account/deletion-confirm/route.ts` promises;
  only test/seed scripts call `prisma.user.delete()`. F21 in `DECISION-LOG.md`,
  requires Davin's product decision (hard-delete vs anonymize), scheduled for a
  future session — not this migration's scope. (12, new) **Architectural note for
  future planning:** the two split schema files (`prisma/market-data/`,
  `prisma/non-market-data/`) share ONE migration history (`prisma/migrations/`) and
  ONE Postgres database as of this session — NOT two independent histories as
  Phase 2's plan document originally implied. This is a deliberate, Davin-approved
  deviation (see `DECISION-LOG.md` F20, `LESSONS-LEARNED.md` L24), not a bug, but the
  plan document (`monolith-to-microservices-migration-implementation-plan.md`)
  should be updated before any future session assumes the two-history model is real.
  Doesn't block Session 2-4 (consumer-repointing doesn't touch migration history).
- **Last session did:** Session 2-3 (Baseline migration history + cross-domain FK
  audit, PORT + INFRA-borrowed rigor, hard-escalation session) — CONFIRM re-verified
  all 6 entry criteria against live state: Session 2-2 closure + schema validity
  confirmed; fresh `migrate status` re-run (still 6 unapplied, `drop_watchlists`
  still last/only destructive); FK-audit grep re-verified (exactly 9 `@relation`s to
  `User`, same 4 money models, zero drift); row-count check skipped (Davin's later
  call, moot under option b); **the two-migration-histories open question answered —
  and it changed the plan** (Prisma 7's migrations path is config-driven and
  singular, not per-`--schema`; empirically confirmed via
  `migrate status --schema=prisma/market-data/schema.prisma` still reading
  `prisma/migrations`). Presented Step 1 findings and stopped per the order's own
  hard gate. **Davin's live decisions, quoted verbatim in the order's Deviations and
  `DECISION-LOG.md` F20:** `drop_watchlists` → option (b) strip-and-orphan; explicit
  staging-waiver; row-count check skipped as moot; and — the major one — abandon the
  two-independent-histories plan, keep the single shared `prisma/migrations/` for
  both split schemas until a future physical DB split. **Executed both steps:** Step
  2 removed `20260706000000_drop_watchlists/` from history (never applied) and
  baselined the other 5 via `resolve --applied` (zero SQL executed). Step 3 edited
  `prisma/non-market-data/schema.prisma` to remove `Subscription`/`Payment`/
  `FraudAlert`/`AffiliateProfile`'s `@relation` to `User` (+ `User`'s 4 reverse
  fields), then applied a **hand-written** migration (4
  `ALTER TABLE ... DROP CONSTRAINT ...`, constraint names read directly from
  `20251227000000_init`'s SQL per L16) via `migrate deploy` — deliberately not
  `prisma migrate dev`, which would have shadow-diffed the partial schema and
  proposed dropping `market_data_v6`. Verified: schema validates clean, generated
  `.d.ts` spot-checked (no `user` accessor on the 4 payload/include types), full
  `npm run test:ci` — 111/111 suites, 2046/2046 tests, exact parity with Session
  2-2's baseline. F20 fully RESOLVED in `DECISION-LOG.md`. Two commits:
  `2aca8b00` (baseline) and `1c3179fb` (FK drop). New `LESSONS-LEARNED.md` entry
  L24 — the migrations-path-is-singular finding cost real CONFIRM-phase diagnostic
  time and changed the session's plan, so it earned a rule, not just a note.
- **Next session must:** Session 2-4 — Rewire the monolith (repoint all 16 consumer
  imports to their correct new client, retire old `prisma/schema.prisma`).
  PRE-DRAFTed: `docs/migration-orders/2-4-rewire-monolith-cutover.migration-order.md`
  — currently **PRE-DRAFT** (needs the Advisor to produce the DRAFT, then Davin's
  APPROVAL). Must additionally: (a) re-verify per-file which of the 16 consumers
  actually touch `MarketDataV6` vs the other 26 models (Waiting-on item 7); (b) grep
  for and adapt any consumer call site doing `include: { user: true }` on
  `Subscription`/`Payment`/`FraudAlert`/`AffiliateProfile` — this now fails to
  compile against the non-market client, not just a future risk (Waiting-on item
  10); (c) be aware the two schema files share one migration history now, not two
  (Waiting-on item 12) — doesn't change 2-4's scope, but don't assume otherwise.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-2)** — two-file layout via explicit
  `--schema=` CLI invocations, cutover split into 2-2/2-4 · **F21 OPEN** (24h
  Account-Deletion GDPR gap — requires Davin's product decision on hard-delete vs
  anonymize, scheduled for a future session) · F6–F16 OPEN
  (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).
