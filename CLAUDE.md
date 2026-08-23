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

- **Current:** Session 10-3 (Blueprint Reconciliation & Close, Phase 10 — final session,
  VERIFY-RETIRE), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24. **Phase 10
  (Drawing Engine & Line-Alert Closure) is now CLOSED** — all 3 sessions complete: 10-1 (F67, live
  cross-process proof), 10-2 (F82, automated Playwright/Newman regression coverage), 10-3 (this
  session, documentation reconciliation). No code changes this session — pure doc reconciliation
  per the roadmap's own scope.
  **L3 pattern again, benign:** committed HEAD held the bare `Status: PRE-DRAFT` order; the
  corrected `Status: APPROVED` version (4 Decisions, Davin's approval line) existed only as an
  uncommitted working-copy edit — confirmed authentic by Davin live, committed at session open
  (the 27th+ recurrence of this exact shape, `LESSONS-LEARNED.md` L3).
  **Blueprint reconciled to `operation-service` reality:**
  `DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` §3 (Database row Prisma 6/`prisma/schema.prisma`
  → Prisma 7/split schema; Web framework row Next.js 15.5 → 16.3.0; key-takeaway note now cites
  Sessions 10-1/10-2 as closing proof), §7 (Phase 4 status callout rewritten from stale monolith
  `lib/alert-engine/*`/`scripts/alert-worker.ts` to the real `operation-service/src/
{alert-engine,drawings,alerts}/*` file map + `main-worker.ts`), §14 (2026-07-05 "one remaining
  blocker" note replaced with a 2026-08-24 reconciliation entry). Independently verified all three
  factual claims against live code before writing (Prisma 7.9.1, Next.js 16.3.0,
  `operation-service`'s actual directory structure) rather than trusting the order's own paraphrase
  (`LESSONS-LEARNED.md` L22). **Deviation:** §3's Price/Alert/Notification/Tiering rows and §8's
  stack-summary table still cite the pre-split `prisma/schema.prisma:<line>` path — outside this
  session's explicit Decision-1 scope (Database + Web framework rows + note only), left as-is,
  noted for a future doc pass.
  `implementation-progress-files-and-folder-directory.md` (150-line build-time file-tree manifest,
  stopped tracking after Session 4B-2) replaced with a clean pointer to
  `migration-stack-analysis.md`, which already tracks the active file inventory per session.
  **`HANDOVER-PROMPT-phase-8A.md` authored** per the roadmap's own trigger table obligation
  (`10-3 writes 8A's`) — and while writing it, found and surfaced two real, load-bearing gaps
  rather than a clean handover: **(1)** Phase 4X is **not** fully closed — 4A-13/14/15 are, but
  **4A-16 has not run and F76 is still OPEN** (dLocal `payment_method_id` is a display name, not
  the real method code; `MIGRATE_WRITE_APIS_MONEY_DLOCAL` stays `false`), which is the roadmap's
  own explicit gate for Session 8-1 to open — a currently-failing entry criterion, not yet met.
  **(2)** The roadmap's literal "delete migrated `app/api/**`" instruction for 8-1 predates **F65**'s
  actual resolution (Session 9-0: retain `app/api/**` permanently as the BFF proxy layer) — the
  real deletion candidates are routes with zero remaining callers, not every migrated route; the
  Advisor needs to resolve this before 8-1's checklist names specific files. Both surfaced in the
  handover prompt and in 8-1's own PRE-DRAFT rather than glossed over. One self-correction during
  drafting: the handover prompt's own first draft speculated 8-1's variant as "likely
  PORT/RETIRE-leaning" before `00-SKELETON-AND-RULES.md` §2 was actually read — that document
  names Session 8-1 directly as a VERIFY-RETIRE example; fixed rather than left as an unverified
  guess in a document whose stated purpose is avoiding fabrication (`LESSONS-LEARNED.md` L27).
  One markdown-corruption fix in the 8-1 PRE-DRAFT (backtick-code-span-adjacent-to-bold-marker
  collision from the pre-commit prettier pass — same class as prior sessions' underscore/`+`
  corruptions) — caught and fixed before this close.
  **Phase 10 formally declared CLOSED SUCCESSFUL** (all Done-when items checked in
  `10-3-blueprint-reconciliation-close.migration-order.md`); Session 8-1 (Deletion Sweep, Phase
  8A, VERIFY-RETIRE) PRE-DRAFTed with both open items above surfaced in its own Entry Criteria and
  a dedicated "Open question" section rather than a clean checklist.
  **All baselines re-verified fresh, at CONFIRM (before any doc edit) and unaffected by this
  session's own doc-only changes:** monolith `test:ci` 153/153 suites/2198/2198 tests;
  `operation-service` 42/42 suites/395/395 tests; money-service 62/62 suites/526/526 tests (one
  `prisma.shutdown.spec.ts` timeout under this session's own three-suite concurrent CONFIRM run,
  isolated re-run clean in 19.9s — the third recurrence of this exact test under this exact load
  pattern, independently confirmed benign at Sessions 10-1 and 10-2's own CONFIRMs too;
  `LESSONS-LEARNED.md` L24's pattern, no new entry added per Session 10-2's own established
  precedent of not re-noting an identical repeat).
  **`migration-cutover-table.md` needs no changes** (no route/slice status moved — pure
  documentation session). **`migration-stack-analysis.md` DOES need an entry** (1 modified: the
  blueprint; 1 replaced: implementation-progress doc; 2 new: `HANDOVER-PROMPT-phase-8A.md`,
  `8-1-deletion-sweep.migration-order.md`) — added next.
  **`DECISION-LOG.md` size-gate check: still ~64KB, over the ~50KB target — same non-actionable
  conclusion as 9-9's/9-10's/10-2's own checks** (inherent to F80/F81 both still being genuinely
  OPEN); no flags touched this session (F67/F82 already resolved at 10-1/10-2).
  **Artifacts updated:** `10-3-blueprint-reconciliation-close.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, Deviations + checked Done-when/entry-criteria boxes),
  `migration-stack-analysis.md` (Session 10-3 entry), this file (Current/Previous rotation —
  Session 10-1 moved to `history/sessions-archive.md`). Session 8-1's order PRE-DRAFTed
  (`8-1-deletion-sweep.migration-order.md`) and `HANDOVER-PROMPT-phase-8A.md` authored per this
  session's own obligations.
  **Ad-hoc correction, same close (phase/session numbering unchanged, `EXECUTOR-PROTOCOL.md` §6):**
  Davin caught a real sequencing gap in the above — the 8-1 PRE-DRAFT correctly surfaced Phase 4X's
  gate as currently failing (4A-16 never run, F76 still OPEN) but the Executor PRE-DRAFTed the
  nominally-next session (8-1) instead of the actually-blocking one (4A-16). Corrected per Davin's
  direct instruction: `4a-16-dlocal-payment-method-id-mapping.migration-order.md` PRE-DRAFTed
  (PORT + CUTOVER, mirrors 4A-14's own shape directly). Live-code inspection while drafting it
  found the exact bug location (`createPayment()` in both `lib/dlocal/dlocal-payment.service.ts`
  and its money-service twin send `payment_method_id: request.paymentMethod` verbatim — a
  display-name string, never a real dLocal code, confirmed byte-for-byte identical on both sides)
  but **no source of truth for the real codes anywhere in this repo** — even the original
  `part-18-dlocal-payment-openapi.yaml` spec uses a display name as its own example, meaning the
  bug predates this migration entirely. The order's own biggest, loudest section is a stop-here
  data dependency: the real dLocal `payment_method_id` per display name must come from Davin (or
  whoever holds dLocal merchant-dashboard access) — not guessed, and not the roadmap's own
  illustrative examples (`TM`, `TH_QR`, `MOMO`), which are unconfirmed placeholders. A full 18-row
  mapping template (all 8 countries' existing display names) is in the order awaiting real values.
  Two secondary findings disclosed rather than silently carried forward: `DLOCAL_API_KEY` in
  `.env.local` was empty at 4A-14's own CONFIRM (forcing a unit-test-only substitute for live
  sandbox proof) but now shows _some_ value present — flagged for re-verification at 4A-16's own
  CONFIRM rather than assumed usable; and 4A-14's own orphaned `Payment` row
  (`cmt2yflxe00000fnw8gy7jm53`) is still outstanding, not cleaned up by the Executor per standing
  practice, flagged again for Davin. No code changed by this correction — tests unaffected, still
  the same fresh-green baselines from this session's own close verification above.
  **Candidate lesson, not promoted** (`LESSONS-LEARNED.md` stays at its 40-entry cap, same
  discipline Sessions 9-10/10-1/10-2 followed): when a session's own entry-criteria check finds a
  currently-failing gate blocking the nominally-next session, PRE-DRAFT the gate-closing session
  next, not the nominally-next one in the roadmap's own numbering — noted here for the Advisor to
  consider consolidating into an existing lesson (closest candidates: L3's "never trust status
  alone, cross-check" or L37's "cross-check against maintained artifacts," neither an exact fit)
  or promoting once room exists.
- **Previous:** Session 10-2 (Drawing Engine & Line-Alert e2e + API Coverage, Phase 10, VERIFY with
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
