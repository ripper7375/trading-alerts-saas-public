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

- **Current:** Session 11-2 (Guards, JWT Claims & Header Forwarding, Phase 11 — second of 3
  sessions, PORT), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24. Unifies tier
  **enforcement** (not just config) across the monolith/`operation-service` boundary — guards, JWT
  claims, header forwarding — the plumbing Stack D (Phase 12) and Stack E (Phase 13) will gate
  their endpoints against.
  **CONFIRM found the same L3 status-integrity gap as every recent session's own CONFIRM** —
  committed HEAD held the order at `Status: PRE-DRAFT` with 3 "Decisions needed" and sketch-only
  Ordered Steps; the `APPROVED` version (4 Decisions taken, full 6-step Ordered Steps) existed only
  as an uncommitted working-copy edit, zero corroborating record in `DECISION-LOG.md` or this file.
  Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-24: "Yes, authentic. The
  working-copy APPROVED text for Session 11-2 is confirmed authentic."**
  **CONFIRM also found two real plan-vs-live-code discrepancies, both corrected before execution
  with Davin's explicit approval:** (1) the order's Step 2 named exactly 2 internal
  `lib/tier-validation.ts` call sites to fix the `canAccessSymbol` argument-order footgun on (one
  of which it mis-cited as `validateAlertCreation` — no such function exists; the real containing
  function is `validateFullTierAccess`, line number correct, name wrong) — a live grep found 2 more
  external call sites (`middleware/tier-check.ts`, `app/api/drawings/route.ts`) that import the
  function directly and would have silently had their arguments swapped by the fix; folded into
  Step 2's scope. (2) Decision 2.3 said to import `REQUIRE_TIER_KEY` from
  `@trading-alerts/types/tier` — that package doesn't export it (only `Tier`/`TierConfig`/
  constants/helpers); kept `REQUIRE_TIER_KEY`/`RequireTier` locally defined in
  `operation-service/src/auth/tier.guard.ts`, only moving `Tier` itself to the shared import.
  **Baselines re-verified fresh at CONFIRM, all exact matches to the order's own numbers:**
  monolith `test:ci` 150/150·2190/2190, `operation-service` 42/42·395/395, `money-service`
  62/62·532/532 (after ruling out a concurrent-run flake — `prisma.shutdown.spec.ts`'s SIGTERM test
  blew its 5000ms timeout running alongside 3 other suites at once; clean in isolation,
  `LESSONS-LEARNED.md` L24 territory, not a regression), `railway-gateway` 3/3·23/23.
  **Execution surfaced one genuinely undisclosed pre-existing gap, not scope creep:**
  `operation-service`'s own embedded `packages/types` — a physically separate, git-tracked copy
  (commit `87242f09`, "embed packages/types locally for Railway single-directory upload";
  `operation-service`'s `package.json` depends on `file:./packages/types`, a nested subdirectory,
  not a symlink to the monorepo root) — was never updated with Session 11-1's new `tier/` module:
  no `src/tier`, no `dist/tier`, no `./tier` export in its own `package.json`. Invisible until
  `operation-service`'s own `npm test` tried to resolve `@trading-alerts/types/tier` and failed
  outright. Synced `src/tier/*.ts` and the root barrel verbatim from the canonical copy, added the
  `./tier` exports/`typesVersions` entries, rebuilt `dist/`.
  **A pre-commit-hook incident during Step 2's first commit attempt, recovered cleanly, zero work
  lost:** the commit failed on a real, pre-existing, unrelated `eslint` error (an unused
  `checkFeatureAccess` import, fixed inline); `lint-staged`'s own stash-based "revert to original
  state" recovery step then itself crashed trying to unlink a locked `.xlsx` file elsewhere in the
  working tree, aborting mid-revert and leaving several just-edited files reverted in the working
  tree while the git index still held the correct staged content. Recovered fully via the
  automatic `lint-staged automatic backup` stash — `git checkout stash@{0} -- <path>` /
  `git checkout -- <path>` per file, verifying zero diff against the stash before each retry.
  `LESSONS-LEARNED.md` L36 extended with the recovery procedure.
  **`DECISION-LOG.md` archival pass completed (Step 1, mandatory §1 size gate, carried forward
  from 11-1's own CONFIRM finding):** 66,296 → 26,320 bytes. Moved 50 RESOLVED `F1`–`F64` rows
  verbatim to `history/decisions-archive.md`'s new "Legacy Flag Register (F1–F64)" table
  (`F12`/`F21` still OPEN and `PD1` stayed in the main table); removed 6 now-redundant stub
  sections duplicating content already in the register table or already fully archived — zero
  unique content lost.
  **`migration-cutover-table.md` needs no changes** (a guards/plumbing session, no route/slice had
  a flag or rollback mechanism to move). **`migration-stack-analysis.md` DOES need an entry** (4
  new, 14 modified) — added. **`DECISION-LOG.md` needed no flag resolution** (order's own header:
  "Flags touched: none" — plumbing, no product-level decision).
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — recurrence notes appended to
  **L19** (a monorepo-mirror-drift variant: a service's own embedded copy of a shared package, kept
  separate purely for an isolated-directory deploy, can silently miss a module added to the
  canonical copy) and **L36** (a more severe variant: the pre-commit hook's own stash-based
  revert-on-failure step can itself crash mid-recovery on a locked file, not just leave a benign
  cosmetic diff — recovery procedure documented).
  **Artifacts updated:** `11-2-guards-jwt-claims-header-forwarding.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, full Deviations, checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md`, `history/decisions-archive.md`, `LESSONS-LEARNED.md`,
  `migration-stack-analysis.md`,
  `docs/migration-orders/11-3-token-metering-and-schema.migration-order.md` (PRE-DRAFTed), this
  file (Current/Previous rotation — Session 8-2 moved to `history/sessions-archive.md`).
- **Previous:** Session 11-1 (Tier Matrix Decision + Types/Config, Phase 11 — first of 3 sessions,
  CONTRACT + PORT), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-24. Resolves
  **F68** (Master Tier Access Rights Matrix, Parts 02–33) and **F74** (Payment Currency Wiring).
  **CONFIRM found the same L3 status-integrity gap as 8-1/8-2/4A-16's own CONFIRMs** — committed
  HEAD held the order at `Status: PRE-DRAFT` with F68/F74 both still `OPEN` in `DECISION-LOG.md`
  ("Decisions needed" — 3 open questions, Ordered Steps marked "sketch only, do not execute from
  this PRE-DRAFT"); the `APPROVED` version (4 `Decisions taken`, F68/F74 marked SIGNED OFF, full
  Ordered Steps) existed only as an uncommitted working-copy edit, zero corroborating record in
  `DECISION-LOG.md` or this file. Surfaced directly rather than trusted; **Davin explicitly
  confirmed live in chat, 2026-08-24: "Yes, authentic. I explicitly confirm my live sign-offs on
  both F68 (Master Tier Matrix Specification) and F74 (Payment Currency Wiring Architecture)."**
  **All entry criteria re-verified fresh:** Phase 8A CLOSED in this file (met); baselines
  re-verified fresh pre-execution — monolith `test:ci` 150/150·2176/2176, `operation-service`
  42/42·395/395, `money-service` 62/62·532/532, `railway-gateway` 3/3·23/23, all exact matches to
  the order's own numbers, zero drift since 8-2's close; a live read-only Stripe API call against
  `STRIPE_PRO_PRICE_ID` confirmed `unit_amount: 2900` (USD/month, `active: true`) — Stripe **test
  mode** (the only key configured in this environment, same method Session 9-6 used).
  **Davin also directed, at CONFIRM:** add a `./tier` subpath export to
  `packages/types/package.json` alongside the root re-export — CONFIRM had found Decision 4's own
  prose naming `@trading-alerts/types/tier` as the import path while the package's `exports` map
  only listed `.`/`./geometry`/`./alert-engine`/`./validations`, which would have made that subpath
  import fail at runtime under Node's `exports`-map enforcement even though the root import would
  work.
  **Execution surfaced one real, undisclosed pre-existing collision, not scope creep:** hoisting
  `SYMBOLS`/`TIMEFRAMES` into `@trading-alerts/types/tier` and re-exporting from the package's root
  barrel (`src/index.ts`) hit a `tsc TS2308` ambiguous-export error — `./validations/alert.ts`
  already exports identically-valued `SYMBOLS`/`TIMEFRAMES` constants at that same root barrel, a
  duplication Decision 4's own "Rejected: Keeping TierConfig duplicated..." framing didn't know
  about. Resolved by explicitly re-exporting `./tier`'s other members from the root barrel while
  omitting its `SYMBOLS`/`TIMEFRAMES` (the root barrel keeps the `validations/alert` copies it
  already had); both the `@trading-alerts/types/tier` and `@trading-alerts/types/validations`
  subpaths still export their own copies, unaffected. `validations/alert.ts` itself left untouched
  — out of scope, a build-tooling collision fix resolved under the order's own "live code wins"
  rule, not escalated (not a payments/auth/entitlement decision).
  **Built:** `packages/types/src/tier/{types,constants,helpers,index}.ts` — canonical `Tier`,
  `TierConfig` (5 new fields: `drawingAlertsAllowed`, `aiAnalystAllowed`, `aiMonthlyTokenQuota`,
  `marketCommentsFeedAllowed`, `marketQualityMetricsAllowed`), `FREE_TIER_CONFIG`/
  `PRO_TIER_CONFIG`/`TIER_CONFIGS`/`TRIAL_CONFIG`, and helpers (`getTierConfig`,
  `canAccessDrawingAlerts`, `canAccessAiAnalyst`, `canAccessMarketComments`,
  `canAccessMarketQualityMetrics`, plus the existing symbol/timeframe helpers). `PRO_TIER_CONFIG`'s
  price in the shared package is the $29 catalog default (matches the live Stripe cross-check);
  `lib/tier-config.ts` reconciled to re-export the shared canonical shape/values while layering its
  own `NEXT_PUBLIC_PRO_PRICE_MONTHLY` env override on top — deliberately NOT hoisted into the
  shared package, since that's Next.js client-bundle plumbing with no equivalent in the NestJS
  services the package also feeds. `getTierConfig`/`getAccessibleSymbols`/`getAccessibleTimeframes`/
  `getChartCombinations` stay locally defined in `lib/tier-config.ts` (must read that file's own
  `TIER_CONFIGS`, which carries the env-priced `PRO_TIER_CONFIG`, not the shared package's
  default-priced one); `canAccessSymbol`/`canAccessTimeframe` now delegate directly to the shared
  package. All existing `lib/tier-config.ts` exports (`FREE_SYMBOLS`, `PRO_SYMBOLS`,
  `PRO_EXCLUSIVE_SYMBOLS`, `FREE_TIMEFRAMES`, `PRO_TIMEFRAMES`, `PRO_EXCLUSIVE_TIMEFRAMES`)
  unchanged — confirmed by the 46 pre-existing `__tests__/lib/tier-config.test.ts` tests passing
  unedited.
  **Tests:** `packages/types` has no test runner, jest config, or test files today (confirmed live
  — no `test` script in its `package.json`, no `*.test.ts`/`*.spec.ts` anywhere in the package);
  per the order's own "and/or `__tests__/lib/tier-config.test.ts`" latitude, extended that existing
  monolith test file instead of scaffolding a new jest setup for one spec file — 14 new tests
  covering every FREE/PRO entitlement line from F68's resolution and all four new access helpers.
  60/60 passing in that file.
  **Full re-verification post-change:** `tsc --noEmit` clean across all 4 codebases (monolith,
  `operation-service`, `money-service`, `railway-gateway`). Full suites re-run fresh: monolith
  `test:ci` **150/150·2190/2190** (net +14, zero regressions — only the new tests moved the count),
  `operation-service` 42/42·395/395 (unchanged, untouched this session), `money-service`
  62/62·532/532 (unchanged, untouched), `railway-gateway` 3/3·23/23 (unchanged, untouched).
  **CONFIRM-time finding, not this session's to fix:** `DECISION-LOG.md` is 66,292 bytes, over
  `EXECUTOR-PROTOCOL.md` §1's ~50KB archival-gate target — should have been caught at this
  session's own OPEN and wasn't; confirmed pre-existing (66,298 bytes already at Session 8-2's own
  close, this session's F68/F74 row edits net −6 bytes, not the cause). Not addressed here — an
  unscoped rewrite of other sessions' OPEN-flag entries under this session's own time pressure
  risked information loss; carried forward as **the next session's own mandatory §1 OPEN-gate
  action**, same handling as this file's existing CLAUDE.md/LESSONS-LEARNED.md archival-backlog
  item.
  **`migration-cutover-table.md` needs no changes** (a types/config session, no route/slice had a
  flag or rollback mechanism to move). **`migration-stack-analysis.md` DOES need an entry** (4 new,
  4 modified) — added. **`DECISION-LOG.md` updated** — F68 and F74 both marked RESOLVED, full
  detail (quoting Davin's sign-off) moved to `history/decisions-archive.md`.
  **Lesson harvested:** no new lesson — this is L3 recurring again (now 29+ times through this
  session), recurrence count bumped; no other lesson met the >30min/recurred/reached-CI bar this
  session.
  **Artifacts updated:** `11-1-tier-matrix-decision-types-config.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, full Deviations, checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md`, `history/decisions-archive.md`, `LESSONS-LEARNED.md`,
  `migration-stack-analysis.md`, `docs/migration-orders/11-2-guards-jwt-claims-header-forwarding.migration-order.md`
  (PRE-DRAFTed), this file (Current/Previous rotation — Session 8-1 moved to
  `history/sessions-archive.md`).

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
