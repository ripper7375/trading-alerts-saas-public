# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 8-2 (Gateway Deployment & Schema Dedup, Phase 8A — second of 2 sessions,
  INFRA), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24. **Phase 8A
  (Decommission) is now CLOSED** — both 8-1 and 8-2 complete.
  **CONFIRM found the same L3 status-integrity gap as 8-1's and 4A-16's own CONFIRMs** — committed
  HEAD held the order at `Status: PRE-DRAFT` with 3 unresolved "Decisions needed" and stub Ordered
  Steps/Rollback; the `APPROVED` version (4 Decisions, full Ordered Steps) existed only as an
  uncommitted working-copy edit, zero corroborating record in `DECISION-LOG.md` or this file.
  Surfaced directly; Davin confirmed live it is authentic.
  **A second, more consequential CONFIRM-time finding: the order's own "zero-blip rolling
  redeploy" framing was contradicted by live infrastructure.** A live audit of all 5 Railway
  projects in this account found no service named `railway-gateway`/`gateway` anywhere —
  `railway-gateway` had been built (Phase 4/backend-stack-c era) but **never actually deployed to
  Railway**, contrary to `migration-stack-analysis.md`'s stale (2026-07-11) "already deployed"
  claim; `migration-cutover-table.md`'s own Slice 12 note (2026-08-02) had already flagged this as
  "a separate, still-open question." Davin confirmed live: this is genuinely a first deployment;
  live alert-relevant price data flows via Redis channels directly today, `market_data_v6` had
  never received a live Railway Gateway write. Corrected the order's Decision 3/Steps 3–5 framing
  accordingly before CONFIRM completed.
  **Execution surfaced a real chain of first-deployment defects, none of them scope creep** — all
  squarely inside Decision 2's "verify `prisma generate` compiles cleanly" / Decision 3's "verify
  ingest" mandates, each found and fixed in turn: (1) Prisma 7 requires a driver adapter, not a
  schema-declared `url` — removed `url` from `railway-gateway/prisma/schema.prisma`, added
  `@prisma/adapter-pg` + a `PrismaPg` adapter mirroring money-service's own pattern; (2) no
  `engines` field — Nixpacks defaulted to Node 18, Prisma 7 needs ≥20 — added the same
  `engines.node >=20.0.0` the other three services already declare; (3) no `postinstall` script —
  Railway's `npm ci` never ran `prisma generate`, `nest build` failed with 5 `TS2305` errors —
  added `"postinstall": "prisma generate"`; (4) `BullModule.forRoot`'s separate `REDIS_HOST`/
  `REDIS_PORT`/`REDIS_PASSWORD` fields could not reach Railway's managed Redis reliably — switched
  to a single `REDIS_URL`, matching `operation-service`'s own exclusive convention.
  **Two pre-existing staging-infrastructure gaps found and fixed, Davin-approved each time:** the
  `postgre for staging` project's own `Redis` add-on had zero active deployments (dormant since
  the project's creation, 2026-01-07) — `railway redeploy --service Redis --from-source` was
  flagged by the environment's own permission classifier, escalated, Davin approved live, started
  it, then restarted `railway-gateway` for a fresh connection; staging's Postgres had zero
  application schema at all (no `market_data_v6`) — generated the single-table DDL via a read-only
  `prisma migrate diff` (no DB touched), presented it verbatim, applied only after Davin's explicit
  approval (`docs/migration-orders/session-8-2-staging-market-data-v6.sql`).
  **Full staging pipeline proven end-to-end, independently DB-verified, not just queue
  bookkeeping:** `GET /api/v1/health` → `healthy` (redis/queue/database all up); a synthetic test
  vector landed the exact submitted row in `market_data_v6`; re-sending the identical key left the
  table at 1 total row (idempotent upsert confirmed, no duplicate).
  **Production deployment (new service in `trading-alerts`) succeeded cleanly on the first
  attempt** — `GET /api/v1/health` returned `healthy` immediately via proper internal networking.
  **Production's first real write exposed a wiring assumption that didn't hold and, beneath it, a
  genuine pre-existing gap this session doesn't own.** `${{Postgres.DATABASE_URL}}` turned out not
  to be the same database `operation-service`/`money-service` actually use; escalated rather than
  guessed, Davin's own diagnosis (app services connect via `pgbouncer`) led to checking
  `operation-service`'s real `DATABASE_URL` — which itself resolves directly to the `Postgres`
  service's own private domain, not a distinct `pgbouncer` host (confirmed live: `pgbouncer` has
  no `DATABASE_URL` variable of its own at all). Re-pointed to
  `${{operation-service.DATABASE_URL}}` (byte-identical, confirmed via SHA-256-prefix + length
  comparison, values never printed) — satisfying Davin's actual intent even though the literal
  mechanism he named didn't hold up. **Even on that byte-identical connection, the write still
  failed** — re-running the exact DDL against production returned `relation "market_data_v6"
  already exists`, proving the table is real but sitting in whatever schema the connecting role's
  own `search_path` resolves first, not `public`. This is `DECISION-LOG.md` **F70**'s own
  already-registered, still-open question (which DB role reads `market_data_v6`, owned by Session
  12-0) — not a new problem, not guessed at. **Per Davin's explicit direction**, this session's
  verification of record is the complete staging end-to-end proof plus production's healthy
  `/health`; production ingest verification is deferred to F70's own resolution.
  **A secret-exposure incident, not repeated:** checking Railway CLI link state, `cat
~/.railway/config.json` printed this environment's real Railway `accessToken`/`refreshToken` into
  the transcript (`LESSONS-LEARNED.md` L4 territory) — disclosed immediately, rotation is Davin's
  call.
  **Baselines re-verified fresh at close:** monolith `test:ci` 150/150·2176/2176 (unchanged),
  `operation-service` 42/42·395/395 (unchanged), `money-service` 62/62·532/532 (unchanged, clean
  this time — no repeat of the concurrent-run flake), `railway-gateway` (new) 3/3·23/23, clean
  build. None of monolith/operation-service/money-service were touched this session
  (`railway-gateway` is `SEPARATE_STACK`).
  **`migration-cutover-table.md` needs no changes** (an INFRA deployment session, no
  `MIGRATE_*`-flagged route/slice moved). **`migration-stack-analysis.md` DOES need an entry** (1
  new, 7 modified — `railway-gateway/*` + `money-service/src/main.ts`) — added. **`DECISION-LOG.md`
  updated** — F70 gets a progress note (new evidence, not a resolution; resolution stays owned by
  Session 12-0).
  **Lesson harvested:** still at the 40-entry cap, no new lesson — recurrence notes appended to
  **L19** (three first-deploy gotchas: `railway up`'s upload source is the shell's current
  directory at invocation time, not the linked service's own; a brand-new service needs
  `engines`/`postinstall` parity with its already-deployed siblings before its first build; a
  plausible `${{Service.VAR}}` reference isn't proof of a working topology — only a
  hash-compared, known-working sibling's own value is) and **L33** (a schema-resolution variant:
  a Prisma "table does not exist" error can mean the connecting role's `search_path` resolves a
  different schema first, not that data was lost).
  **Artifacts updated:** `8-2-gateway-deployment-schema-dedup.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, full Deviations, checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md`, `LESSONS-LEARNED.md`, `migration-stack-analysis.md`,
  `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-11.md`
  (authored), `docs/migration-orders/11-1-tier-matrix-decision-types-config.migration-order.md`
  (PRE-DRAFTed), this file (Current/Previous rotation — Session 4A-16 moved to
  `history/sessions-archive.md`).
- **Previous:** Session 8-1 (Deletion Sweep, Phase 8A — first of 2 sessions, VERIFY-RETIRE),
  APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24.
  **CONFIRM found the same L3 status-integrity gap as 4A-16's own CONFIRM** — committed HEAD
  (`d06647ce`) held the order at `Status: PRE-DRAFT` with an unresolved "open question" about F65
  scope; the `APPROVED` version (4 Decisions, restructured checklist) existed only as an
  uncommitted working-copy edit, zero corroborating record in `DECISION-LOG.md` or this file.
  Surfaced directly rather than trusted; Davin confirmed live it is authentic.
  **All 5 entry criteria re-verified fresh and MET:** Phase 4X/9/10 all CLOSED in this file, F65
  RESOLVED in `DECISION-LOG.md` (Session 9-0), and — critically — Phase 9 (9-0…9-10 incl. the
  9-7a/b, 9-8a/b splits) confirmed CLOSED in `history/sessions-archive.md` with live proof
  (`app/(marketing)`, `(public)`, `(auth)`, `(dashboard)`, `settings`, `terminal`, `free`,
  `affiliate`, `admin` all present in the real `app/` tree) — not just trusted from the roadmap's
  own sequencing table. Baselines re-verified fresh pre-execution: monolith 153/153·2204/2204,
  operation-service 42/42·395/395, money-service 62/62·532/532 (one `prisma.shutdown.spec.ts`
  timeout on the first concurrent 3-suite run, isolated re-run clean in 20s — the same benign
  concurrency flake as 10-1/10-2/10-3's own CONFIRMs, `LESSONS-LEARNED.md` L24, not re-noted).
  **The order's own text named only 3 legacy categories to verify absent** (`token-2fa-*`,
  `app/test-api/`, `app/admin/login`) — all three already gone from earlier sessions, `vercel.json`
  crons already `[]`. Rather than close the session as a no-op, ran a live audit of all 127
  `app/api/**` route files (cross-referenced against real callers in `app/`/`components/`/`hooks/`,
  `frontend-swap-route-map.md`, `migration-stack-analysis.md`) — an Explore-agent-assisted pass —
  and surfaced 14 additional genuinely dead routes the order's own text never named, plus one
  ambiguous file. Presented the full list to Davin before touching anything; Davin confirmed:
  delete the 14, retain `app/api/test/seed/route.ts` (only referenced by an archived/inactive e2e
  config), leave `MarketingAsset` monolith-only (no money-service mirror — a roadmap §5 residual
  named as "owned by 8-1" that the order's own 4 Decisions never covered), defer the stale
  money-service CORS comment (`main.ts:35`, references a phantom `NEXT_PUBLIC_MONEY_API_URL` dead
  since F65) to Session 8-2.
  **Deleted:** `app/api/affiliate/profile/payment/route.ts`, `app/api/candles/[symbol]/route.ts`,
  `app/api/checkout/validate-code/route.ts`, all 8 `app/api/cron/*` handlers (superseded by the
  admin-triggered money-service `CronTriggerController` forward — confirmed via that route's own
  doc comment), `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`,
  `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts` (the `frontend-swap-route-map.md`
  citation for this page was itself stale — the real page calls a different route),
  `app/api/payments/dlocal/exchange-rate/route.ts`. Zero `stackA`/`stackB` usage found anywhere
  (confirmed already deleted at Session 7-3, nothing to clean up there). `frontend/` mirror dLocal
  slice confirmed untouched (`EXECUTOR-PROTOCOL.md` §5).
  **3 test files died with their routes, per the test-count reconciliation rule** (never a
  silently-adjusted assertion): `__tests__/api/affiliate-conversion.test.ts` (13 tests, sole
  subject was the deleted `checkout/validate-code`), `__tests__/api/cron-jobs.test.ts` (10 tests:
  distribute-codes/expire-codes/send-monthly-reports), `__tests__/api/cron/process-pending.test.ts`
  (5 tests: process-pending-disbursements). `__tests__/lib/cron/*.test.ts` (check-expiring-
  subscriptions, downgrade-expired-subscriptions) test the underlying `lib/cron/*` business-logic
  modules directly, not the deleted route wrappers — confirmed unaffected, left untouched.
  **Baseline reconciled exactly:** monolith `test:ci` 153/153·2204/2204 → **150/150·2176/2176**
  (100% green, −3 suites/−28 tests, matching the 3 deleted test files' own counts exactly). `tsc
--noEmit` clean, `eslint app components lib hooks --max-warnings 0` clean (0/0), `npm run build`
  compiled successfully (`✓ Compiled successfully in 105s`) with zero route collisions — all 14
  deleted paths independently confirmed absent from the printed route manifest.
  `operation-service`/`money-service` untouched this session, stand at their fresh CONFIRM-time
  baselines above. Committed as one step commit (`b7f8ab8e`, 17 files, all deletions).
  **`migration-cutover-table.md` needs no changes** (no route/slice had a flag or rollback
  mechanism — dead monolith-only handlers, not a traffic-carrying cutover, same "no Phase-6-style
  row" reasoning the table already documents for surfaces without a `MIGRATE_*` flag).
  **`migration-stack-analysis.md` DOES need an entry** (17 deleted: 14 routes + 3 tests) — added.
  **`DECISION-LOG.md` needs no changes** (Flags touched: none — F65 was already RESOLVED at 9-0,
  this session only executed against it).
  **Artifacts updated:** `8-1-deletion-sweep.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, Deviations + checked Done-when/entry-criteria boxes), `migration-stack-analysis.md`,
  this file (Current/Previous rotation — Session 10-3 moved to `history/sessions-archive.md`).

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
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
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
