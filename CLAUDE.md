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

- **Current:** Session 11-3 (Token Metering & Schema, Phase 11 — third and final session, INFRA +
  PORT), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-25. **Phase 11 (Preparatory
  Tier-Access & Core Refactoring) is now CLOSED SUCCESSFUL** — all 3 sessions (11-1, 11-2, 11-3)
  complete. Builds the Redis `trackAiTokenUsage()` sliding-window token-quota limiter and the
  `TokenUsageLog`/`User.profile` schema — the mechanism Stack D (Phase 12) will meter and cap
  AI-token spend against, proven end-to-end by a dummy tier-gated route returning 429 at quota.
  **CONFIRM found a variant of the same L3 status-integrity gap every recent session's own CONFIRM
  has found, but with a real difference this time:** the order's committed HEAD held `Status:
PRE-DRAFT` (4 "Decisions needed", sketch-only Ordered Steps) and the uncommitted working copy
  held `Status: DRAFT` (4 "Decisions taken", full 5-step Ordered Steps) — **neither version claimed
  `APPROVED`**, unlike 11-1/11-2 where the working copy already claimed it. Surfaced directly as a
  genuine blocker, not assumed; **Davin explicitly confirmed live in chat, 2026-08-25: "Yes,
  authentic. I explicitly confirm that the working-copy DRAFT for Session 11-3 is now officially
  APPROVED by me (marked Status: APPROVED in the header)."** — verified the header edit was
  genuinely present on disk before proceeding, not just taken on his word.
  **Execution hit a real plan-vs-live-code conflict at Step 1, not scope creep or a preference
  call:** the order's own literal Step 1 instruction (`prisma db push --schema
prisma/non-market-data/schema.prisma`) refused live, proposing to **DROP the live, non-empty
  `market_data_v6` table** — `railway-gateway`'s protected ingest path
  (`EXECUTOR-PROTOCOL.md` §5, "must never blip"). Root cause: `prisma/non-market-data/` and
  `prisma/market-data/` share ONE physical database (`prisma.config.ts` routes both through the
  same `DIRECT_URL`, no `multiSchema` fencing), so `db push` against either file diffs the _entire_
  live database and proposes dropping whatever the sibling file owns. Not a new problem —
  `migration-stack-analysis.md`'s own "Database Architecture" section (lines ~1095–1098) already
  documented Session 2-3 hitting this identically, and Session 8-2 used the same
  hand-reviewed-script pattern for its own `market_data_v6` DDL. Stopped and reported to Davin
  before touching the database; Davin approved the established workaround live. Applied via
  `prisma migrate diff --from-schema <committed HEAD> --to-schema <edited schema> --script` (pure
  schema-to-schema diff, zero DB connection — `LESSONS-LEARNED.md` L6) to generate the exact
  additive DDL, saved as `docs/migration-orders/session-11-3-token-metering-schema.sql`, applied
  via `prisma db execute --file <script>` (raw SQL, no full-database diff). Live spot-check
  post-apply confirmed `User.profile`/`token_usage_log` exist and `market_data_v6` is untouched at
  its original row count.
  **Baselines re-verified fresh at CONFIRM (before any code changed), all exact matches to the
  order's own numbers:** monolith `test:ci` 150/150·2190/2190, `operation-service` 42/42·395/395,
  `money-service` 62/62·532/532, `railway-gateway` 3/3·23/23; live Redis `PING` → `PONG` confirmed
  connectivity.
  **`operation-service/prisma/schema.prisma` deliberately NOT synced with `profile`/
  `TokenUsageLog`:** it's a hand-maintained, narrow `User`-subset mirror (same drift class
  `LESSONS-LEARNED.md` L19's Session 11-2 finding already named) — neither of this session's own
  deliverables need it (`trackAiTokenUsage()` is Redis-only; the dummy route lives in the
  monolith). Flagged for whichever future session first needs `operation-service` to read
  `TokenUsageLog` (Session 12-3's cost surveillance is the likely first consumer).
  **Full re-verification post-change, all 4 codebases, run sequentially (not concurrently) after
  Step 4's own CONFIRM-time finding that running all 4 at once OOM-crashes a `money-service` Jest
  worker:** `tsc --noEmit` clean across all 4. Full suites re-run fresh: monolith `test:ci`
  **151/151·2204/2204** (+1 suite/+14 tests, zero regressions), `operation-service`
  **43/43·401/401** (+1 suite/+6 tests), `money-service` **62/62·532/532** (unchanged; clean on
  this isolated run, no repeat of the concurrent-load `prisma.shutdown.spec.ts` flake seen at
  CONFIRM), `railway-gateway` **3/3·23/23** (unchanged, untouched).
  **`migration-cutover-table.md` needs no changes** (a plumbing/metering session, no route/slice
  had a flag or rollback mechanism to move). **`migration-stack-analysis.md` DOES need an entry**
  (5 new, 4 modified) — added. **`DECISION-LOG.md` needed no flag resolution** (order's own header:
  "Flags touched: none" — plumbing, no product-level decision).
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — a recurrence note appended to
  **L6** (`prisma db push`/`migrate dev`'s destructive-diff behavior isn't unique to
  migration-history drift, its original symptom — ANY schema file sharing a datasource with a
  sibling schema file will propose dropping whatever the sibling owns, regardless of migration
  history state; the safe pattern, `migrate diff --script` + `db execute`, generalizes to this
  case too).
  **Artifacts updated:** `11-3-token-metering-and-schema.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, full Deviations, checked Done-when/entry-criteria boxes),
  `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`
  (authored — Phase 12 handover, per the roadmap's own "11-3 writes phase-12's" trigger),
  `docs/migration-orders/12-0-decisions-and-contracts.migration-order.md` (PRE-DRAFTed), this file
  (Current/Previous rotation — Session 11-1 moved to `history/sessions-archive.md`).
- **Previous:** Session 11-2 (Guards, JWT Claims & Header Forwarding, Phase 11 — second of 3
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
