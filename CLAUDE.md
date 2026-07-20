# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 2 CODE-COMPLETE (all 4 sessions executed) — Session 2-4 done,
  2026-07-20. Production still needs a deploy decision from Davin before Phase 2 is
  fully exit-clean (see F22 below — `npm run build` currently fails on a
  **pre-existing, unrelated** bug, unverified whether it also blocks real Vercel
  builds). Phase 1 still formally NOT exit-clean (F18 the sole blocker, unchanged,
  dashboard-only). Phase 0 still formally open (CC-A gap unchanged).
- **Current order:** `docs/migration-orders/2-4-rewire-monolith-cutover.migration-order.md`
  (EXECUTED — CONFIRMed, corrected, and fully executed in one session; all Slice-level
  verification items checked except the pre-existing build issue, see below)
- **Order status:** EXECUTED. CONFIRM found the order's original Entry Criteria #2/#3
  ("16 known consumer files") both stale (14, not 16, by that narrow definition) and
  methodologically wrong — ~97 more files consume Prisma via the `lib/db/prisma.ts`
  singleton, invisible to the literal-import grep the "16" came from. Davin approved
  a live scope correction (rewrote Entry Criteria #2/#3 to target the singleton +
  full-repo `.user`-include grep; added a missing prisma.config.ts/script-wiring
  step) and cleared execution. **What actually shipped, far beyond the original
  "repoint imports" framing:**
  - `lib/db/prisma.ts` repointed to `.prisma/non-market-client`; new
    `lib/db/market-prisma.ts` singleton added for `.prisma/market-client` (2 call
    sites genuinely touch `MarketDataV6` — a case-sensitive grep miss
    (`MarketDataV6` vs `marketDataV6`) not caught until `tsc --noEmit`, itself found
    only after CONFIRM's "zero files touch MarketDataV6" claim turned out false).
  - 14 more direct `@prisma/client` importers repointed.
  - **17 files / ~24 call sites** adapted for Session 2-3's FK-audit relation drop
    (`Subscription`/`Payment`/`FraudAlert`/`AffiliateProfile`'s `.user` include →
    separate `prisma.user` lookup) — not the 3 files/6 sites CONFIRM's own report
    first estimated; found via full-repo grep, several only surfacing via `tsc
--noEmit` (including the **reverse** relation direction —
    `User.include.subscription/payments` in 5 files — which CONFIRM never checked
    at all).
  - `prisma.config.ts` default schema + `package.json` `prebuild`/`postinstall`/
    `db:generate` repointed off the (now-deleted) default schema.
  - `prisma/schema.prisma` **deleted**.
  - Test infra: `__tests__/setup.ts` and every affected test file's mocks updated to
    match the new call shapes. Hit and fixed a real, reproducible Jest gotcha:
    `jest.mock()` hoisting is per-file, not cross-file — a test file only gets
    `setup.ts`'s mocked Prisma client if it imports `'../../setup'` **before** any
    import that transitively touches `@/lib/db/prisma`; import order matters and
    `eslint --fix`'s `import/order` rule will silently reorder it wrong (did, once,
    mid-session — see `LESSONS-LEARNED.md` L26). 5 files now carry
    `eslint-disable`/`eslint-enable import/order` blocks to survive future
    `eslint --fix` runs; do not remove them.
  - Full `npm run test:ci`: **111/111 suites, 2046/2046 tests**, exact parity with
    Session 2-3's baseline — re-verified AFTER running the exact `eslint --fix` the
    pre-commit hook runs, twice, to be sure it survives commit-time auto-fix.
  - `npm run type-check`: clean except 2 pre-existing, unrelated Drawing-model JSON
    typing errors (confirmed pre-existing via git blame + a pristine-checkout
    comparison).
  - `npm run build`: **still fails** — see F22, new this session, OPEN.
  - Six commits: `b6c92001` (order correction), `b48f74cd` (railway-gateway comment
    sync), `b673f388` (repoint + FK-adapt), `4c712820` (test mocks),
    `7d34753d` (eslint-proof fix), `ad7e6a4c` (retire + housekeeping).
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys (Session 2-1 confirmed Vercel's own mechanism works independently),
  just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3, unchanged)
  Production's Prisma migration history is baselined — F20 closed. (3, non-blocking,
  unchanged) F18's RPO gap — Railway automated-backup cadence still unverified via
  CLI (dashboard-only). (4, unchanged, carried over) Davin to grant Vercel
  dashboard/preview-branch access. (5, unchanged, carried over) A human with delete
  permission to remove 5 remote stale branches (`HTTP 403` on `git push --delete`
  from this environment's credential). (6, unchanged, carried over) `railway`'s
  `tcp-proxy`/`private-network` CLI commands still not verified — low priority.
  (7, RESOLVED Session 2-4) The "which of the consumers touch MarketDataV6" question
  — answered for real: exactly 2 files, both now on `lib/db/market-prisma.ts`; every
  other consumer is on the non-market client. (9)/(10) RESOLVED Session 2-3,
  superseded by this session's execution. (11, unchanged, carried over as F21) The
  24h Account-Deletion GDPR gap — requires Davin's product decision, scheduled for a
  future session. (12, unchanged, carried over) The two split schema files still
  share ONE migration history and ONE Postgres database — deliberate, Davin-approved
  (F20, L24) — the plan document should still be updated before any future session
  assumes the two-history model is real. **(13, NEW, urgent) F22 — `npm run build`
  fails** on a confirmed pre-existing bug (predates Session 2-4; introduced by
  Session 2-1's adapter-pg pattern, same calendar day): `lib/affiliate/constants.ts`
  mixes a client-safe constant with a top-level `import { prisma } from
'@/lib/db/prisma'`, tainting any `'use client'` page that imports it
  (`app/affiliate/register/page.tsx` does) with the `pg`/`dns` server-only
  dependency chain. **Needs Davin's go-ahead** — fix requires splitting that file
  into client-safe vs server-only modules, out of Session 2-4's mandate. Unverified
  whether this also blocks real Vercel deploys; if Vercel's pipeline runs `next
build` (near-certain), production builds may have been broken since Session 2-1.
  **(14, NEW) Production deploy of Session 2-4's changes has NOT happened** — code is
  committed to `main` and fully tested, but per EXECUTOR-PROTOCOL.md §7 production
  deploys need Davin's explicit approval, and deploying right now would hit F22's
  build failure regardless.
- **Last session did:** Session 2-4 (Rewire the monolith — CONFIRM found and
  corrected a scope gap live, then full execution in the same session; PORT variant,
  low creativity dial). See "Order status" above for the full breakdown — this was a
  far larger session than its "repoint imports, retire old schema" framing implied.
  New `LESSONS-LEARNED.md` entries L25 (grep-based consumer-inventory methodology
  needs to account for indirect/singleton consumption, camelCase model-property
  case-sensitivity, and the reverse relation direction, not just literal import
  matches) and L26 (jest.mock() hoisting is per-file; `import/order` autofix can
  silently break shared test-mock imports — needs an eslint-disable block, not just
  correct ordering).
- **Next session:** two independent threads, Davin to prioritize/sequence:
  (a) **F22 fix** — split `lib/affiliate/constants.ts` into client-safe constants vs
  server-only DB-config modules so `npm run build` (and likely real Vercel deploys)
  work again; genuinely ad-hoc/incident work, not on the playbook, small in scope.
  (b) **Session 3-1** (Phase 3, auth) per the playbook — resolve F6/F7 (auth
  strategy, HS256 vs JWKS), scaffold `operation-service`, implement `JwtAuthGuard`.
  Neither is PRE-DRAFTed yet pending Davin's sequencing call — F22 arguably blocks
  verifying Session 2-4's own "production runs on split clients" done-when criterion
  (per the playbook), so likely goes first, but that's Davin's call, not assumed
  here.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-4)** — split clients live in production code,
  every consumer repointed, old schema retired · **F21 OPEN** (24h Account-Deletion
  GDPR gap — requires Davin's product decision on hard-delete vs anonymize, scheduled
  for a future session) · **F22 OPEN, new, urgent** (`npm run build` broken by a
  pre-existing `lib/affiliate/constants.ts` client/server split bug — needs Davin's
  go-ahead + priority call) · F6–F16 OPEN
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
