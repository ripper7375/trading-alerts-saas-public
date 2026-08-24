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

- **Current:** Session 8-1 (Deletion Sweep, Phase 8A — first of 2 sessions, VERIFY-RETIRE),
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
  Session 8-2 (Gateway Deployment & Schema Dedup, Phase 8A — second of 2 sessions, INFRA)
  PRE-DRAFTed, grounded in a live check (not fabricated): `railway-gateway/`'s Prisma is still
  6.19.2 (playbook's own task says align to 7.8.0 — a real, currently-true gap), and the target
  Railway project `postgre for staging` is confirmed to exist and reachable from this Executor's
  authenticated `railway` CLI (unlike Vercel at 4A-16 — this session's environment CAN drive the
  actual deploy, not just hand it to Davin).
- **Previous:** Session 4A-16 (dLocal Payment Method ID Mapping & Recutover, Phase 4X — final
  session, PORT + CUTOVER), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24.
  Resolves **F76** and completes Slice 4 to 4/4 write-API groups — **Phase 4X is now CLOSED**, all
  four of 4A-13/14/15/16 resolved, satisfying Session 8-1's own long-standing entry criterion.
  **CONFIRM found the order's own live status was inconsistent across two passes in the same
  session** — first read showed `Status: DRAFT` with no Davin approval line anywhere (committed
  HEAD still held the original PRE-DRAFT); re-checked minutes later and the working copy had
  flipped to `Status: APPROVED` with an unexplained approval stamp, still uncommitted, with zero
  corroborating record in `DECISION-LOG.md` or this file. Treated per `LESSONS-LEARNED.md` L3 —
  did not silently trust it, asked Davin directly, including naming the specific concern that
  Decision 1's method codes (`TM`/`TH_QR`/`MOMO`, …) were byte-identical to the roadmap's own
  explicitly-labeled "unconfirmed placeholder" examples with no new verification cited anywhere.
  Davin confirmed live, in chat: the order is authentic, and gave explicit separate sign-off on
  both `⚠ NEEDS EXPLICIT SIGN-OFF` items (Decision 1's mapping table, Decision 4's cutover/flag-flip
  protocol) — the `00-SKELETON-AND-RULES.md` §1.0 rule that a general order approval doesn't cover
  these on its own.
  **Steps 1–2 (mapping implementation, both sides):** `DLOCAL_METHOD_CODE_MAP` +
  `getDLocalMethodCode(country, displayName)` added to `money-service/src/dlocal/
payment-methods.service.ts` and `lib/dlocal/payment-methods.service.ts`, covering all 23
  country/method pairs (22 unique display names — the order's own draft said "18," corrected here);
  both `createPayment()` call sites (`money-service/src/dlocal/dlocal-payment.service.ts`,
  `lib/dlocal/dlocal-payment.service.ts`) updated to resolve the mapped code instead of the display
  name; fails loud (`Error`) on any unmapped name, never sends an unmapped string to dLocal. Real
  dLocal codes came from Davin directly in chat, not guessed and not the roadmap's own placeholder
  examples. Real-fetch-path tests added both sides (`jest.resetModules()` + env override, 4A-14
  precedent) asserting the outbound `payment_method_id` is the mapped code, plus a fail-loud test
  for unmapped names. One drafting-accuracy fix along the way: the order named
  `__tests__/lib/dlocal/dlocal-payment.service.test.ts`, which doesn't exist — the real file is
  `__tests__/lib/dlocal/dlocal-payment.test.ts` (no `.service`); used the real path. Committed as
  two separate step commits (`942e2e5d` money-service, `0a4f942c` monolith), each with its own
  fresh green baseline before committing.
  **Step 3 (deploy) hit a real, pre-existing repo bug, found and fixed:** `railway up` failed the
  build with `TS2307: Cannot find module './dlocal/dlocal.module'` — root `.railwayignore`'s
  unanchored `dlocal`/`riseworks` patterns (meant only for the two top-level reference folders of
  the same name) were also matching `money-service/src/dlocal/` and `money-service/src/riseworks/`,
  silently stripping both modules from every CLI-driven upload. Anchored both patterns with a
  leading `/` (root-only, commit `8796fdfa`) and redeployed clean — confirmed via a direct
  `/health` check showing a fresh `uptime` (18.8s), not `railway logs`/`railway status` alone
  (`LESSONS-LEARNED.md` L13). Pre-existing bug, not introduced this session — never previously
  exercised via `railway up` in this migration's history.
  **Steps 4–5 (flag flip + live smoke test) executed by Davin directly, not the Executor:** no
  Vercel CLI/credentials exist in this Executor's environment, and the order's own Decision 4/Step 5
  design already assigns these actions to Davin personally. Davin flipped
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel production and ran the live TH/TrueMoney
  test-mode checkout himself: monolith forwarded correctly, dLocal accepted `payment_method_id:
  'TM'` with zero `5010` errors, real redirect URL returned and followed
  (`https://sandbox.dlocal.com/payment/R-1804074-g1l8n07m-oumvi7djjl1gpc-2o922ds992v0`).
  **Independently cross-checked against money-service's own first-party structured logs, not just
  Davin's report:** `Creating payment` (country=TH, paymentMethod=TrueMoney) → `Payment record
  created` (`paymentId: cmt6fo3ty00000fnwahf0e8v8`) → `Creating dLocal payment` → `dLocal payment
  created` (`paymentId: R-1804074-g1l8n07m-oumvi7djjl1gpc-2o922ds992v0` — matches Davin's redirect
  URL exactly), zero error-level log lines anywhere in the sequence. `provider: 'DLOCAL'`/`status:
  'PENDING'` confirmed hardcoded (not response-derived) in `dlocal-payment.controller.ts`'s
  `prisma.payment.create()` call, reading the actual source rather than assuming. **A direct
  Postgres row read was attempted for full verification and had no path from this environment**
  (`pgbouncer.railway.internal` unreachable from a local shell even via `railway run`; `railway
  ssh` needs an SSH key not present here, not generated for a one-off read) — disclosed rather than
  silently skipped; logs + the deterministic code path are the verification of record.
  **All baselines re-verified fresh at close:** monolith `test:ci` 153/153 suites/2204/2204 tests
  (+6); `operation-service` 42/42 suites/395/395 tests (untouched, unchanged); money-service 62/62
  suites/532/532 tests (+6). `tsc --noEmit` and targeted `eslint` clean on every file this session
  touched (one pre-existing, untouched warning found elsewhere — `three-day-validator.test.ts`,
  out of scope, not fixed).
  **`migration-cutover-table.md` updated** (Slice 4 → CUT-OVER 4/4, flags all `true`, session list
  +16, narrative note appended). **`DECISION-LOG.md` updated** (F76 → RESOLVED, register row +
  full resolution moved to `history/decisions-archive.md`). **`migration-stack-analysis.md` DOES
  need an entry** (8 modified: 4 `dlocal` service files + 4 test files across both codebases; 1
  modified: `.railwayignore`) — added.
  **Still outstanding, unchanged, flagged again:** both orphaned `Payment` rows from 4A-10c
  (`cms7hlmb900000fmpz9i9fv1q`) and 4A-14 (`cmt2yflxe00000fnw8gy7jm53`) — not this session's job to
  clean up, not touched.
  **Artifacts updated:** `4a-16-dlocal-payment-method-id-mapping.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, Deviations + checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md`, `migration-cutover-table.md`, `migration-stack-analysis.md`, this file
  (Current/Previous rotation — Session 10-2 moved to `history/sessions-archive.md`). Session 8-1's
  own order (`8-1-deletion-sweep.migration-order.md`) re-verified: its Phase 4X entry criterion is
  now satisfied — updated to reflect that.

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
