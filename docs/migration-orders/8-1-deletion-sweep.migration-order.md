# Migration Order — Session 8-1 — Deletion Sweep

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **near zero**: this is a
> **VERIFY-RETIRE** session (named explicitly in `00-SKELETON-AND-RULES.md` §2's variant table —
> "every CUTOVER, 8-1, 8-5, phase exits"). Deletion and verification of decommissioned surface only;
> zero new application features.
> **PRE-DRAFTed by the Executor at Session 10-3's close (2026-08-24)**, upgraded to **DRAFT by the
> Advisor / Antigravity (2026-08-24)** per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A" and `00-SKELETON-AND-RULES.md`.

**Session:** 8-1 · **Phase:** 8A (Decommission, part 1 — first of 2 sessions) · **Variant:** VERIFY-RETIRE · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-24 (Advisor / Antigravity) · **Approved:** 2026-08-24 (Davin) · **Confirmed:** 2026-08-24 (Executor)  
**Flags touched:** none (Phase 4X, Phase 9, Phase 10 all closed; Slice 4 at 4/4).  
**Estimated time:** ~1–1.5h (dead file audit, `vercel.json` verification, build & baseline suite execution).  
**Target components:** `vercel.json`, `app/api/**` (BFF audit vs dead route removal), `lib/` legacy cleanup audit.

**CONFIRM note (2026-08-24, Executor):** Committed `HEAD` (`d06647ce`) held this order at `Status:
PRE-DRAFT`; this `APPROVED` version (4 Decisions, header fields, restructured checklist) existed
only as an uncommitted working-copy edit with zero corroborating record in `CLAUDE.md` or
`DECISION-LOG.md` — same `LESSONS-LEARNED.md` L3 shape as 4A-16's own CONFIRM. Surfaced to Davin
directly; Davin confirmed live in chat this version is authentic. All 5 entry criteria
re-verified fresh and MET (Phase 4X/9/10 CLOSED, F65 RESOLVED, baselines green — monolith
153/153·2204/2204, operation-service 42/42·395/395, money-service 62/62·532/532 after an
isolated re-run of `prisma.shutdown.spec.ts`'s known concurrency flake, L24). A live `app/api/**`
audit (127 route files, cross-referenced against real callers, `frontend-swap-route-map.md`, and
`migration-stack-analysis.md`) found the roadmap's own named legacy targets (`token-2fa-*`,
`app/test-api/`, `app/admin/login`) already absent from earlier sessions, and surfaced 14
additional genuinely-dead routes plus one ambiguous file (`app/api/test/seed/route.ts`) not named
anywhere in the order's own text. Davin reviewed the audit and confirmed: delete the 14, retain
the ambiguous one, leave `MarketingAsset` monolith-only (no money-service mirror), defer the
stale money-service CORS comment cleanup to Session 8-2 — none of which the order's own 4
Decisions had addressed. Full list in Deviations below.

---

## Decisions taken

> Four technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> Resolves the open questions regarding F65 BFF retention vs. decommissioning scope.

1. **Deletion Scope & F65 BFF Doctrine Preservation**
   - **Chosen:** Retain all active `app/api/**` route handlers permanently as the NextAuth-aware Backend-For-Frontend (BFF) proxy layer per **F65** (RESOLVED, Session 9-0). Audit and sweep ONLY genuinely dead, uncalled, or orphaned files that have zero callers and no BFF forwarding role.
   - **Rejected:** Blanket deletion of `app/api/**` routes (which would destroy the Next.js frontend proxy and break client fetch requests).
   - **Why:** F65 established that `app/api/**` serves as the live forwarding bridge between browser client components and the backend microservices (`operation-service`, `money-service`).
   - **How hard to undo:** Non-destructive architectural preservation.

2. **`vercel.json` Cron Configuration Confirmation**
   - **Chosen:** Verify and maintain `vercel.json`'s `"crons": []` as empty. All scheduled crons have been ported to dedicated background workers and schedulers in `operation-service` (`AlertCronScheduler`) and `money-service` (`CronsModule`).
   - **Rejected:** Re-introducing serverless cron triggers on Vercel.
   - **Why:** Eliminates unnecessary serverless function invocations and centralizes scheduling in the NestJS microservices.
   - **How hard to undo:** Trivial.

3. **Dead Artifact Audit (`token-2fa-*` & Codebase-1 Remnants)**
   - **Chosen:** Formally verify the complete absence of the 6 legacy `token-2fa-*` route files from `app/api/auth/` (retired in Phase 7), and confirm that dead codebase-1 surfaces (such as `app/test-api/` and `app/admin/login`) remain deleted. Keep the `frontend/` mirror dLocal slice untouched per `EXECUTOR-PROTOCOL.md` §5 exception.
   - **Rejected:** Leaving unverified legacy remnants in the repository.
   - **Why:** Cleans up technical debt and ensures a pristine codebase before Session 8-2.
   - **How hard to undo:** Non-destructive verification.

4. **Phase 8A Milestone Progression to Session 8-2**
   - **Chosen:** Upon clean verification of the deletion sweep and 100% green test baselines across all three suites, declare Session 8-1 **CLOSED SUCCESSFUL** and proceed immediately to Session 8-2 (Gateway Deployment & Schema Dedup).
   - **Rejected:** Adding unnecessary delays between Phase 8A sessions.
   - **Why:** Session 8-2 is the final decommission prerequisite required before Phase 11 opens.
   - **How hard to undo:** Standard phase progression.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 8A":
"8-1 — Deletion sweep. Delete migrated `app/api/**` except keepers, the `frontend/` mirror dLocal slice, empty `vercel.json` crons, and the 6 dead `token-2fa-*` files if 7-2 left them."

With Phase 4X (Sessions 4A-13..16, Slice 4 at 4/4), Phase 9 (Sessions 9-0..10), and Phase 10 (Sessions 10-1..3) all CLOSED SUCCESSFUL, Session 8-1 performs the authoritative decommission audit to remove dead monolith artifacts and confirm the clean BFF architecture ahead of Session 8-2.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Phase 4X CLOSED** — 4A-13, 4A-14, 4A-15, 4A-16 all CLOSED SUCCESSFUL in `CLAUDE.md`, F76 RESOLVED in `DECISION-LOG.md`.
- [x] **Phase 9 CLOSED** — 9-0…9-10 CLOSED SUCCESSFUL in `CLAUDE.md`.
- [x] **Phase 10 CLOSED** — 10-1…10-3 CLOSED SUCCESSFUL in `CLAUDE.md`.
- [x] **F65 (BFF Boundary) RESOLVED** — `app/api/**` established as permanent BFF layer.
- [x] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 153/153 suites, 2204/2204 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 532/532 tests.

---

## Ordered Steps (Checklist)

_(each step = change → immediate verification → rollback note)_

### Step 1: Audit and Confirm `vercel.json` Cron State

- **Action:** Inspect `vercel.json` to verify `"crons": []` contains zero active cron triggers.
- **Verify:** Confirm no serverless functions are invoked on schedules via Vercel.
- **Rollback:** `git checkout -- vercel.json`.

### Step 2: Dead Route and Legacy File Audit

- **Action:**
  1. Verify zero `token-2fa-*` source files exist under `app/api/auth/`.
  2. Verify zero dead codebase-1 routes (`app/test-api/`, `app/admin/login`, etc.) exist.
  3. Confirm all active routes in `app/api/**` are valid BFF proxy handlers forwarding to `operation-service` or `money-service` (or local auth/session endpoints).
  4. Confirm `frontend/` mirror dLocal slice remains untouched per `EXECUTOR-PROTOCOL.md` §5.
- **Verify:** Run `npm run type-check` and `npx eslint app components lib hooks --max-warnings 0`.
- **Rollback:** `git checkout` if any unintended deletions occurred.

### Step 3: Full Monorepo Build and Test Suite Verification

- **Action:** Run complete builds and test suites across all monorepo workspaces:
  - `npm run build` (Monolith Next.js build verification — ensures zero route collisions or broken imports).
  - `npm run test:ci` (Monolith Jest suite — 153 suites, 2204 tests).
  - `pnpm --filter operation-service test` (42 suites, 395 tests).
  - `pnpm --filter money-service test` (62 suites, 532 tests).
- **Verify:** 100% green across all builds and tests. Zero regressions.
- **Rollback:** None.

### Step 4: Session Close-Out & PRE-DRAFT Session 8-2

- **Action:**
  - Update `CLAUDE.md`: Current entry Session 8-1 CLOSED SUCCESSFUL.
  - PRE-DRAFT `docs/migration-orders/8-2-gateway-deployment-schema-dedup.migration-order.md` (Phase 8A, Session 8-2).
- **Verify:** Working copy clean, ready for Session 8-2.
- **Rollback:** None.

---

## Rules specific to this variant

- **Zero new features, zero fixes:** Pure decommission audit and verification.
- **BFF protection:** Never delete an `app/api/**` route that is actively called by frontend components or pages.
- **Any test failure is a hard stop:** Stop, document, and investigate immediately.

---

## Done when

- [x] `vercel.json` confirmed clean with no active serverless crons.
- [x] Complete absence of legacy dead routes and `token-2fa-*` files confirmed.
- [x] Monolith Next.js `npm run build` succeeds cleanly without route collisions.
- [x] Baseline test suites 100% green across monolith, `operation-service`, and `money-service`.
- [x] Session 8-2 PRE-DRAFTed.

---

## Rollback

- Revert any deletions via `git checkout` / `git revert`.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **Status-integrity gap at CONFIRM (L3 pattern, recurring).** Committed `HEAD` (`d06647ce`) held
   this order at `Status: PRE-DRAFT` with an unresolved "open question" about F65 scope; the
   `APPROVED` version (4 Decisions, restructured checklist) existed only as an uncommitted
   working-copy edit with zero corroborating record in `CLAUDE.md`/`DECISION-LOG.md`. Surfaced to
   Davin directly rather than silently trusted; Davin confirmed live it is authentic. No impact —
   same resolution shape as 4A-16's own CONFIRM.
2. **Scope was audited and made concrete, not just verified.** The order's own Decision 1/Step 2
   named only the roadmap's pre-identified legacy candidates (`token-2fa-*`, `app/test-api/`,
   `app/admin/login`) — all three were already absent, removed by earlier sessions. A live audit
   of all 127 `app/api/**` route files (cross-referenced against real callers,
   `frontend-swap-route-map.md`, `migration-stack-analysis.md`) surfaced 14 additional genuinely
   dead routes the order's own text never named, plus one ambiguous file. Davin reviewed the full
   list and approved: delete the 14, retain `app/api/test/seed/route.ts` (only referenced by an
   archived/inactive e2e config).
3. **Deleted:** `app/api/affiliate/profile/payment/route.ts`, `app/api/candles/[symbol]/route.ts`,
   `app/api/checkout/validate-code/route.ts`, all 8 `app/api/cron/*` handlers
   (check-expiring-subscriptions, daily-maintenance, distribute-codes,
   downgrade-expired-subscriptions, expire-codes, process-pending-disbursements,
   send-monthly-reports, sync-riseworks-accounts — superseded by the admin-triggered
   money-service `CronTriggerController` forward), `app/api/disbursement/affiliates/
[affiliateId]/commissions/route.ts`, `app/api/disbursement/reports/affiliate/[affiliateId]/
route.ts`, `app/api/payments/dlocal/exchange-rate/route.ts`. Zero `stackA`/`stackB` usage found
   anywhere (confirmed already deleted at Session 7-3). `frontend/` mirror dLocal slice and
   `vercel.json` (`crons: []`) both confirmed untouched/already-clean — no action needed.
4. **3 test files died with their routes**, per the test-count reconciliation rule (a dead
   component's test dies explicitly, never a silently-adjusted assertion):
   `__tests__/api/affiliate-conversion.test.ts` (13 tests, sole subject was
   `checkout/validate-code`), `__tests__/api/cron-jobs.test.ts` (10 tests: distribute-codes,
   expire-codes, send-monthly-reports), `__tests__/api/cron/process-pending.test.ts` (5 tests:
   process-pending-disbursements). `__tests__/lib/cron/*.test.ts` (check-expiring-subscriptions,
   downgrade-expired-subscriptions) test the underlying `lib/cron/*` business-logic modules
   directly, not the deleted route wrappers — confirmed unaffected, left untouched.
5. **Baseline reconciled exactly:** monolith `test:ci` 153/153·2204/2204 → **150/150·2176/2176**
   (100% green, −3 suites/−28 tests, matching the 3 deleted test files' own counts exactly).
   `tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0` clean (0/0), `npm run
build` compiles successfully with zero route collisions; all 14 deleted paths independently
   confirmed absent from the printed route manifest. `operation-service` (42/42·395/395) and
   `money-service` (62/62·532/532, after an isolated re-run of `prisma.shutdown.spec.ts`'s known
   concurrency flake — `LESSONS-LEARNED.md` L24) were untouched this session; both stand as
   fresh-verified at this session's own CONFIRM, unaffected by monolith-only changes.
6. **Two roadmap-flagged residuals explicitly deferred, not silently dropped.**
   `MASTER-ROADMAP-PHASES-7-15.md` §5 names both as "owned by 8-1," but neither was in this
   order's own 4 Decisions: (a) `MarketingAsset` mirror-into-money-service decision — Davin
   directed: leave monolith-only; (b) stale CORS comment in `money-service/src/main.ts:35`
   (references phantom `NEXT_PUBLIC_MONEY_API_URL`, dead since F65 kept the browser on the BFF) —
   Davin directed: defer to Session 8-2.
7. Nothing else deviated — `vercel.json` crons, `token-2fa-*`/`test-api`/`admin/login` absence,
   and the `frontend/` mirror were pure verification, no changes needed there.

---

## Next-session handoff

- **Next session:** `8-2` — Gateway deployment & schema dedup (Phase 8A — Decommission, part 2).
- **Prerequisite:** Session 8-1 CLOSED SUCCESSFUL. Must run before Session 13-1.
