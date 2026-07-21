# Migration Order — money-service: crons (Slice 1) — BUILD

> **Status: PRE-DRAFT** — written by the Executor at Session 4A-1's close, per
> `EXECUTOR-PROTOCOL.md` §3.5. Needs the Advisor to produce the DRAFT (PORT variant, Low
> creativity dial per `00-SKELETON-AND-RULES.md` §2 — behavior preservation IS the
> deliverable) then Davin's APPROVAL — no fast-path (only VERIFY-RETIRE sessions get that).
> **Session:** 4A-2 · **Phase:** Phase 4A — money-service, blueprint §5.5 Slice 1 (of 5) ·
> **Candidate variant:** `TEMPLATE-PORT.md` (per the playbook's own line for this session;
> worked example `4B-2-alert-engine.migration-order.md`) · **Target service:**
> money-service · **Flags touched:** none new (F14/F15/F16 all already resolved).

## Why this session, why now

Session 4A-1 (this close) scaffolded and deployed `money-service`'s skeleton — `/health`
live, NextAuth JWE auth guard ported from operation-service's proven bridge, Redis wired
under the `money.*` namespace (F15), no domain business logic yet. Per the playbook
(`monolith-to-microservices-migration-session-playbook.md` line ~262), the next session is
**4A-2 — Slice 1 (8 cron jobs), BUILD half**. The playbook explicitly separates BUILD
(4A-2) from CUTOVER (4A-3) for this slice — "Small [cutover] session on purpose — never
combine with new build work" (playbook line ~254) — so this order's scope is BUILD only:
port the 8 cron jobs' logic into `money-service`'s `@nestjs/schedule` module, get their
ported test suites green, and start a shadow-run (same UTC schedule running in both
places, comparing outputs) — NOT flipping `vercel.json`'s `crons` empty yet. That's 4A-3,
a separate small session, only after this one's shadow-run is clean.

## Head start already in place (don't rediscover this)

- **`money-service/` skeleton is live** (Session 4A-1): NestJS 11.1.28, Prisma 7.8.0,
  `PrismaService` already proven to authenticate as `money_svc` through PgBouncer in
  production (`/health` → `database: up`, first real proof that role works at all).
  **Important divergence found this session:** money-service's `PrismaService` does
  **NOT** set `ssl: { rejectUnauthorized: false }` like operation-service's does —
  PgBouncer's listener rejects a TLS handshake outright. Don't copy operation-service's
  Prisma adapter config verbatim for anything else in money-service; use money-service's
  own `src/prisma/prisma.service.ts` as the reference instead.
- **`BullModule.forRoot` is already registered** (`src/app.module.ts`) with the `money`
  queue prefix (`src/queue/queue.constants.ts`) — no new queue infra decision needed,
  just `BullModule.registerQueue(...)` for whichever of these 8 jobs turn out to need
  async/retryable work (the blueprint's own guidance: "Long work... goes to BullMQ
  queues... so webhook responses stay <1s" — crons aren't webhooks, so this may not
  apply to all 8; the Advisor should decide job-by-job, not by default).
- **Prisma schema is still model-less** (`money-service/prisma/schema.prisma`) — every one
  of these 8 jobs touches money-domain tables (`Subscription`, `AffiliateCode`,
  `PaymentBatch`, `DisbursementTransaction`, etc. per blueprint §5.1's `money_svc` grant
  list). **This session must add those specific models** (hand-copied from the root app's
  `prisma/non-market-data/schema.prisma`, same "byte-for-byte hand-sync, no automated
  check" convention operation-service's own schema.prisma already carries for
  `User`/`RefreshToken`, per LESSONS-LEARNED.md L24) — narrow subset covering only what
  these 8 jobs actually read/write, not the full money-domain model set (that's later
  slices' job as they land).

## Candidate scope — the 8 jobs and their real dependencies (verified this session, re-verify at DRAFT)

Per `vercel.json`'s current `crons` array (8 entries, confirmed exact match against the 8
route handlers below) and each handler's own `lib/*` imports:

| #   | Route (`app/api/cron/.../route.ts`) | Schedule (UTC)    | Underlying logic                                                   | Lines (route → logic) |
| --- | ----------------------------------- | ----------------- | ------------------------------------------------------------------ | --------------------- |
| 1   | `check-expiring-subscriptions`      | `0 0 * * *`       | `lib/cron/check-expiring-subscriptions.ts`                         | 93 → 168              |
| 2   | `daily-maintenance`                 | `0 4 * * *`       | calls #1 + #4's logic directly (no separate lib file)              | 190 → n/a             |
| 3   | `distribute-codes`                  | `0 0 1 * *`       | `lib/cron/monthly-distribution.ts`                                 | 91 → 148              |
| 4   | `downgrade-expired-subscriptions`   | `0 1 * * *`       | `lib/cron/downgrade-expired-subscriptions.ts`                      | 93 → 170              |
| 5   | `expire-codes`                      | `59 23 28-31 * *` | inline in route (`lib/db/prisma` only, no separate lib file)       | 96 → n/a              |
| 6   | `process-pending-disbursements`     | `0 2 * * *`       | `lib/disbursement/cron/disbursement-processor.ts`                  | 90 → 387              |
| 7   | `send-monthly-reports`              | `0 6 1 * *`       | inline in route (`lib/db/prisma` only)                             | 243 → n/a             |
| 8   | `sync-riseworks-accounts`           | `0 3 * * *`       | `lib/disbursement/cron/disbursement-processor.ts` (shared with #6) | 86 → 387              |

**Open questions for the Advisor to firm up, not to guess past:**

1. **`daily-maintenance` (job #2) calls into #1's and #4's logic directly** rather than
   having its own `lib/cron/*` file — confirm whether money-service should port it as a
   4th `@Cron()` handler that calls the already-ported `check-expiring-subscriptions`/
   `downgrade-expired-subscriptions` services, or whether its extra maintenance-only work
   (190 lines vs. the two ~93-line callees combined) hides something not yet accounted
   for — read the full file before assuming it's just a thin composition wrapper.
2. **Jobs #6 and #8 share `DisbursementProcessor`** (387 lines) — confirm this single
   class cleanly supports being invoked from two different `@Cron()` schedules (it very
   likely takes a mode/job-type parameter; don't assume, read it).
3. **CRON_SECRET**: per blueprint §5.2's porting notes, "CRON_SECRET auth becomes
   unnecessary (no public cron endpoints) but keep the guard for manual triggers" — decide
   the actual shape of that manual-trigger guard for money-service (mirror
   operation-service's `JwtAuthGuard`? A separate admin-only guard? The blueprint doesn't
   say, and money-service's skeleton doesn't have an admin/role guard yet).
4. **Prisma schema models needed**: enumerate the exact fields each of these 8 jobs
   touches (Subscription tier/expiry fields, AffiliateCode/PaymentBatch/
   DisbursementTransaction rows, whatever `daily-maintenance`'s extra logic needs) before
   writing money-service's schema addition — narrow subset, not the full model, per the
   operation-service precedent.

## Rules specific to this variant (PORT, Low creativity)

- Behavior preservation IS the deliverable — the current `lib/cron/*` code and
  `app/api/cron/*/route.ts` handlers are ground truth; port their tests' assertions
  UNCHANGED (they're the parity oracle).
- SOURCE files (`app/api/cron/*`, `lib/cron/*`, `lib/disbursement/cron/*`) become
  change-frozen (CC-F) the moment this session's shadow-run starts — no drive-by fixes.
- This session ends with the shadow-run STARTED (both old and new running on the same UTC
  schedule, outputs diffed), not cut over — cutover is 4A-3, a separate session.

## Slice-level verification (done when)

- [ ] All 8 jobs ported to `@nestjs/schedule` `@Cron()` handlers in money-service, same
      UTC expressions as `vercel.json`
- [ ] Ported test suites green in money-service; monolith's own cron tests still green
      (source untouched)
- [ ] Shadow-run started: both implementations run on schedule, outputs/side-effects
      diffed for at least one full cycle of each job's own cadence before 4A-3 can start
- [ ] money-service's Prisma schema has exactly the models these 8 jobs need (hand-synced,
      documented divergence if any field is narrowed)

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** empty `vercel.json`'s `crons` array once shadow-run diff is clean and
  Davin approves — a separate 4A-3 CUTOVER session (`TEMPLATE-VERIFY-RETIRE.md`).
- **Rollback:** re-add the `vercel.json` crons entries; money-service's own scheduler can
  keep running harmlessly in parallel (idempotent jobs) or be disabled.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` — known-broken by design, Phase 7 only, do not touch even in passing.
- `frontend/`'s dLocal mirror files are explicitly OUT of this slice's scope (blueprint
  §5.4 removes them only once the backend is fully real — later than this slice).

## Next-session handoff

_(DRAFT order for 4A-3 — money-service: Slice 1 CUTOVER, TEMPLATE-VERIFY-RETIRE, small
session, Davin's live approval to flip `vercel.json`)_
