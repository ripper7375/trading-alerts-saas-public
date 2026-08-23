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

- **Current:** Session 10-2 (Drawing Engine & Line-Alert e2e + API Coverage, Phase 10, VERIFY with
  scoped bugfix), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Resolves **F82**
  (orphaned `Alert` row on `Drawing` deletion) and ships durable, repeatable automated regression
  coverage (Playwright e2e + Newman API) for the drawing engine and line alerts — the roadmap's
  own Phase 10 line item, converting Session 10-1's one-off manual proof into CI-grade proof.
  **L3 pattern again, benign:** committed HEAD held the bare `Status: PRE-DRAFT` order; the
  corrected `Status: APPROVED` version (4 Decisions, Davin's approval line) existed only as an
  uncommitted working-copy edit — confirmed authentic by Davin live, committed at session open.
  **A real, load-bearing live-code contradiction found and escalated, not silently worked
  around** (`⚠ NEEDS EXPLICIT SIGN-OFF`, separate from general approval): Decision 1's Playwright
  scope assumed a toast fires and `AppHeader` shows a live unread badge for fired-alert events.
  Neither exists live — `AppHeader`'s bell (`components/layout/app-header.tsx:238`) is a static
  decorative dot with no state/fetch/socket; the only `onNotification` consumer, `NotificationList`,
  shows no toast, only a screen-reader-only announcement + list re-fetch. This directly matches
  this file's own immediately-preceding Session 9-10 entry (`notification-bell.tsx` deleted, never
  rewired into `AppHeader`, "no home since the chrome swap") — a `LESSONS-LEARNED.md` L37-class
  gap (an order's claim not cross-checked against this project's own already-correct maintained
  document, here CLAUDE.md itself). Davin chose live: keep the WS-frame capture as-is (real,
  unaffected — both `notification` and `alert_fired` frames captured via Playwright's native
  WebSocket inspection, content-asserted), swap the toast/badge legs for `/notifications` (the same
  `NotificationList` component) actually rendering the new notification body and its own live
  unread counter off the identical socket push. No new UI built (would have been UI-BUILD scope
  creep inside a VERIFY session). The chart-marker DOM assertion stayed out of scope per Session
  10-1's own precedent (marker logic already unit-tested, `mt5-service`'s OHLCV feed is
  `SEPARATE_STACK`) — Davin re-confirmed this explicitly at CONFIRM.
  **F82 fixed in both live paths, not dead code in either:** `operation-service/src/drawings/
drawings.service.ts` (`remove()`, live path in Vercel production, `MIGRATE_DRAWINGS=true`) and
  monolith `app/api/drawings/[id]/route.ts` (`DELETE`, live path in this local dev environment,
  flag unset/`false`) both now collect the drawing's attached `DrawingAlert.alertId`(s) before the
  cascading `Drawing` delete, then explicitly delete those now-orphaned `Alert` row(s).
  **Live end-to-end proof, not just unit tests:** new Newman collection
  (`postman/collections/drawing-line-alerts.postman_collection.json`, `npm run test:api:drawings`,
  authenticated via the real `token-login` bridge rather than the existing collection's fictional
  `/api/auth/login`/bearer pattern) — 14/14 requests, 28/28 assertions, including a direct F82
  zero-orphan check (create drawing → attach line alert → delete drawing → `GET /api/alerts`
  confirms the backing `Alert.id` is gone), run twice (alone and under concurrent load) both green.
  New Playwright spec (`e2e/tests/drawing-line-alerts.spec.ts`, `e2e/playwright.config.ts` created
  fresh — never existed outside `e2e/archive/` despite `package.json`'s `test:e2e*` scripts already
  pointing at this path): draw → attach alert → synthetic Redis price cross (10-1's own proven
  mechanism) → fires → both WS frames captured and content-asserted → `/notifications` shows the
  live update. 1/1 passed.
  **One incidental, disclosed transcript exposure at CONFIRM (not a fix — flagged for Davin):**
  checking `operation-service/.env` for entry-criteria presence used a content-printing `grep`
  instead of a presence-only check, echoing the real `NEXTAUTH_SECRET`/`DATABASE_URL`/`REDIS_URL`
  values (local dev Railway instances, not production) into the transcript — `LESSONS-LEARNED.md`
  L4's exact failure mode. Disclosed live immediately, not repeated afterward; rotation is Davin's
  call.
  **One incidental, real test flake under this session's own concurrent load, confirmed benign:**
  `money-service`'s `prisma.shutdown.spec.ts` (completely untouched this session) failed once
  during the full post-change baseline run (4 heavy suites + Newman + Playwright all concurrent);
  isolated re-run passed clean — the same test failing the same way under the same kind of load is
  independently recorded at Session 10-1's own CONFIRM (`history/decisions-archive.md`'s F67
  entry), confirming `LESSONS-LEARNED.md` L24's pattern, not a regression.
  **All baselines re-verified fresh, post-session:** monolith `test:ci` 153/153 suites/2198/2198
  tests (unchanged); `operation-service` 42/42 suites/395/395 tests (+2, F82 coverage);
  money-service 62/62 suites/526/526 tests (one transient flake above, isolated re-run clean).
  **`migration-cutover-table.md` needs no changes** (no route/slice status moved — F82's fix lives
  entirely inside already-cutover Slice 7/8 code paths). **`migration-stack-analysis.md` DOES need
  an entry** (3 new test-infrastructure files, 4 modified) — added.
  **`DECISION-LOG.md` size-gate check: 64,325 bytes, over the ~50KB target — checked and found not
  actionable, same conclusion as 9-9's/9-10's own checks.** F82's full entry moved to
  `history/decisions-archive.md` (its register row was missing entirely — added); the remaining
  overage is inherent to F80/F81 both still being genuinely OPEN.
  **Artifacts updated:** `10-2-e2e-api-coverage.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 5 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F82
  RESOLVED, register row added), `LESSONS-LEARNED.md` (recurrence note on L37, no new lesson —
  stayed at the cap), `migration-stack-analysis.md` (Session 10-2 entry, 3 new/4 modified/0
  deleted, TEST INFRA), this file (Current/Previous rotation — Session 9-10 moved to
  `history/sessions-archive.md`). Session 10-3's order (Blueprint reconciliation & close,
  VERIFY-RETIRE, fast-path eligible) PRE-DRAFTed per this session's own obligation
  (`10-3-blueprint-reconciliation-close.migration-order.md`); it also owes **Phase 8A's** own
  handover prompt per `MASTER-ROADMAP-PHASES-7-15.md`'s own trigger table ("10-3 writes 8A's") —
  **the 10-2 order's own "Next-session handoff" text says Phase 11, which is wrong** (`8-2 writes
  phase-11's`, per the same table); caught and corrected here rather than propagated into 10-3.
- **Previous:** Session 10-1 (Drawing Engine & Line-Alert Live Smoke Test, Phase 10, INFRA/VERIFY),
  APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Resolves **F67** (smoke-test
  execution environment) — Phase 10's own "one remaining unverified link": a real, live,
  cross-process round trip from a price-cross through the alert worker to a real DB write,
  realtime relay, and browser delivery.
  **Both `⚠ NEEDS EXPLICIT SIGN-OFF` decisions confirmed separately by Davin, live in chat, distinct
  from the order's general approval** (per `EXECUTOR-PROTOCOL.md` §0): Option B (local
  `operation-service` HTTP+worker against the already-reachable dev Redis/Postgres, not Contabo VPS
  or Railway scratch) as the primary environment, and a deterministic synthetic Redis price
  publisher (not passive live MT5 ticks) as the crossing-trigger mechanism.
  **L3 pattern again, benign:** committed HEAD held the bare `Status: PRE-DRAFT` order (no
  `Decisions taken` section); the corrected `Status: APPROVED` version (4 Decisions, Davin's
  approval line) existed only as an uncommitted working-copy edit — confirmed authentic by Davin
  live, committed at session open.
  **Two real defects found and fixed live, both disclosed, neither a drive-by:**
  **1) `nest-cli.json`'s `deleteOutDir: true` races `start:dev` watch mode against
  `start:worker`'s static `node dist/main-worker`.** Booting per the order's literal `npm run
start:dev` crashed the worker (watch-mode rebuild wiped `dist/` mid-require of
  `./alert-engine/alert-cron.scheduler`). Fixed by running one clean `npm run build` then booting
  BOTH processes statically (`node dist/main` + `node dist/main-worker` — the order's own text
  already sanctions this as equivalent). **2) CSP `connect-src` never allowed the local
  `operation-service` origin, only its production Railway one** (same bug class as F54, just for
  localhost) — browser WS connections to `ws://localhost:3001` were blocked before the handshake
  could start. Minimal fix (`next.config.js`, added `http://localhost:3001`/`ws://localhost:3001`),
  restarted, re-verified: `RealtimeGateway` logs `Client <id> authenticated as user <userId>`.
  **All 4 Invariant Proofs verified live:** (1) worker log `dispatching fire`/`fire dispatched`
  with correct correlationId; (2) Postgres `Notification` row created
  (`"Price 2005 touched line @ 2000"`) + `Alert.triggerCount` incremented; (3) `RealtimeGateway`
  relayed with zero malformed-payload rejection; (4) browser confirmed connected+authenticated in
  the right room and `GET /api/notifications` matched the fired row — **the chart-canvas marker's
  visual rendering could not be confirmed**, because `/terminal`'s separate OHLCV candlestick feed
  (`mt5-service`'s own Flask-SocketIO server, `ws://localhost:5001`) was never in this session's
  scope/running (no candle data loaded at all, independent of alerts). Escalated live per
  `EXECUTOR-PROTOCOL.md` §7; **Davin approved accepting the confirmed WS-delivery evidence as
  sufficient**, registering the visual check as a follow-up rather than a session blocker.
  **Cooldown and one-shot both verified live, DB- and Redis-state-confirmed:** cooldown —
  `triggerCount` held at 1 across an immediate re-cross 2.5s later, `alert:cd:<id>:line` confirmed
  present in Redis with active TTL; one-shot — fired once (`triggerCount: 1`, `isActive: false`),
  a second crossing well past its own 5s cooldown produced zero further fire
  (`alert:fired:<id>` guard).
  **One incidental, real Prisma `P2028`** ("Unable to start a transaction in the given time") on
  the first fire-dispatch attempt, root-caused to this session's own concurrent load (monolith dev
  server + both operation-service processes + several ad-hoc diagnostic scripts against the same
  shared pooled dev Postgres) — reproduced standalone, confirmed slow-but-working (3.5s) with an
  extended timeout, resolved by reducing concurrent load and retrying; no production code touched.
  Registered as a recurrence on `LESSONS-LEARNED.md` L24 (stayed at the 40-entry cap).
  **One new, real, disclosed data-hygiene defect found during test-fixture cleanup, registered as
  `DECISION-LOG.md` F82** (not fixed here — out of this INFRA/VERIFY session's scope, doesn't
  block the smoke test): `DELETE /api/drawings/:id` cascades `Drawing → DrawingAlert` but never
  touches the `Alert` row itself — every deleted line-alert-bearing drawing leaves a permanently
  orphaned `PRICE_TOUCH_LINE` `Alert` row. Reproduced 4/4 times cleaning up this session's own
  fixtures; cleaned up manually. Flagged for Session 10-2 (API coverage for `/api/drawings`) to
  catch with a real assertion.
  **All test fixtures cleaned up, DB and Redis left clean:** 4 test drawings deleted via the real
  API (cascading their `DrawingAlert` rows), the 4 resulting orphaned `Alert` rows deleted manually
  (F82 above), all test `Notification` rows deleted, Redis state keys for all 4 test alertIds
  cleared, worker confirmed back to `watches loaded: 0 rows`. Both `operation-service` processes
  and the monolith dev server stopped cleanly at close — no stray background processes left
  running.
  **All baselines re-verified fresh, post-session, zero regressions from this session's own
  `next.config.js` CSP change:** monolith `test:ci` 153/153 suites/2198/2198 tests;
  `operation-service` 42/42 suites/393/393 tests; money-service 62/62 suites/526/526 tests
  (untouched, unaffected).
  **`migration-cutover-table.md` and `migration-stack-analysis.md` correctly need no changes**
  (no route/slice moved, no files created/moved/deleted — `next.config.js` was modified in place;
  Slice 6's own cutover-table row already correctly notes `MIGRATE_ALERT_ENGINE` has no reader,
  independently re-confirmed this session).
  **Artifacts updated:** `10-1-drawing-alert-smoke.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, 6 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md`
  (F67 resolved, F82 registered OPEN), `LESSONS-LEARNED.md` (recurrence note on L24, no new lesson
  — stayed at the cap), this file (Current/Previous rotation — Session 9-9 moved to
  `history/sessions-archive.md`). Session 10-2's order PRE-DRAFTed per this session's own
  obligation (`10-2-e2e-api-coverage.migration-order.md`) — 4 open questions flagged for the
  Advisor at DRAFT, most load-bearing: the chart-marker visual gap (`mt5-service`'s OHLCV socket
  server, out of scope in 10-1) directly blocks 10-2's own stated e2e success criterion and needs
  a real resolution, not another reduced-evidence acceptance, since a Playwright assertion needs a
  concrete checkable condition.

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
