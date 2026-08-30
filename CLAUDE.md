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

- **Current:** Session 14-0 (Web Chat Decisions & Contract, Phase 14 — first of 4 sessions,
  CONTRACT), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. Resolves **F72**
  (Contabo chat stack scope) — freezes the Socket.IO event contract, the 3-container Docker/Nginx
  spec, the dual-mode BFF-token socket auth bridge, and the bot-worker system prompt/quota rules
  for Sessions 14-1…14-3 to build against. No application code this session (CONTRACT variant).
  **This session had no PRE-DRAFT** — Session 11-3 closed on 2026-08-24, before Davin's 2026-08-30
  reorder decision (Phase 14 now runs ahead of Phases 12/13) existed; the Advisor wrote the order
  straight to `DRAFT` from `TEMPLATE-CONTRACT.md` per its own handover prompt
  (`HANDOVER-PROMPT-phase-14.md`), and Davin marked it `APPROVED`. Expected, not a gap.
  **CONFIRM found the same L3 status-integrity pattern as nearly every recent session, in its most
  extreme form yet:** the order file itself was entirely untracked (zero git history at all, not
  just a lagging header), and its prerequisites — `MASTER-ROADMAP-PHASES-7-15.md`'s 2026-08-30
  reorder banner and this file's own matching note — existed only as uncommitted working-tree
  edits. Unlike most recurrences, this wasn't a single self-contradicting document: the reorder
  story was told consistently across four independent artifacts (roadmap, this file, the handover
  prompt, and the order), all dated 2026-08-30 with matching rationale — support for treating it as
  benign, but not a substitute for asking. Both `⚠ NEEDS EXPLICIT SIGN-OFF` items (Decision 1
  Domain/TLS, Decision 4 auth semantics) are not covered by a general order approval per
  `EXECUTOR-PROTOCOL.md` §0. Surfaced directly; **Davin explicitly confirmed live in chat,
  2026-08-30: "I explicitly confirm that I have reviewed and APPROVED the Session 14-0 order, with
  explicit sign-offs on Decision 1 (Domain/TLS architecture for chat-api) and Decision 4 (Dual-mode
  socket auth semantics via BFF token bridge)."**
  **Execution found and corrected a real drafting error, not scope creep:** the DRAFT assumed the
  chat subdomain would be `chat-api.davintrade.com` throughout (Nginx `server_name`, DNS target,
  CSP `connect-src`, the `NEXT_PUBLIC_SOCKET_CHAT_URL` example) — but neither the codebase nor
  `DECISION-LOG.md` had ever resolved Session 9-0's own still-open Batch-0 finding ("`davintrade.com`
  vs `davin-trade.com`"), so this was asked of Davin directly rather than guessed between the two
  flawed options on the table. **The real domain is `davintrade.app`** — neither `.com` spelling was
  correct — confirmed via a live Zoho Mail admin dashboard screenshot showing the registered domain
  and mail hosting (support email corrected to `support@davintrade.app` the same way, using a
  generic alias, not the personal super-admin address the screenshot incidentally showed). This
  also definitively resolves Session 9-0's long-open Batch-0 ambiguity; formally closing that
  finding in `frontend-swap-route-map.md` is left to a future session. Every hostname/email
  reference in the order was corrected to `.app` before being treated as frozen.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **151/151·2239/2239** (+35 tests vs. 11-3's close — the 2026-08-29/30 VAT/affiliate ad-hoc work
  landed in between, not a regression), `operation-service` **43/43·401/401** (unchanged),
  `money-service` **62/62·565/565** (+33 tests, same reason) with one transient
  `prisma.shutdown.spec.ts` timeout in the full run — re-ran in isolation (`--runInBand`), passed
  clean in 7.0s, confirmed the known `LESSONS-LEARNED.md` L24 flake, not a regression,
  `railway-gateway` **3/3·23/23** (unchanged).
  **Step 4's bot-worker system-prompt deliverable, named in the order's Ordered Steps but never
  written out verbatim in the DRAFT, authored during execution** — grounded in copy that already
  ships in `lib/socket-client.ts`'s `generateFallbackResponse()` (existing, already-reviewed
  product claims), not new copy invented for this order.
  **`migration-cutover-table.md` needs no changes** (a CONTRACT/decision session, no route/slice
  had a flag or rollback mechanism to move — confirmed no Phase 14 rows exist yet, as expected).
  **`migration-stack-analysis.md` needs no entry** (no files created/moved/deleted — only the
  pre-existing order file itself was edited). **`DECISION-LOG.md` DOES need a flag resolution** —
  **F72** resolved (all 4 sub-questions), full detail in `history/decisions-archive.md`.
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — a recurrence note appended to
  **L3** (the untracked-order-plus-prerequisites variant described above) and to **L24** (a fourth
  occurrence of the `prisma.shutdown.spec.ts` parallel-worker timeout flake, same resolution).
  **Artifacts updated:** `14-0-web-chat-decisions-and-contract.migration-order.md` (Status →
  CONFIRMED → CLOSED SUCCESSFUL, domain corrections, bot system prompt added, full Deviations,
  checked Done-when/entry-criteria boxes), `DECISION-LOG.md`, `history/decisions-archive.md`,
  `LESSONS-LEARNED.md`, `docs/migration-orders/14-1-container-stack-build-and-deploy.migration-order.md`
  (PRE-DRAFTed), this file (Current/Previous rotation — Session 11-2 moved to
  `history/sessions-archive.md`).
- **Previous:** Session 11-3 (Token Metering & Schema, Phase 11 — third and final session, INFRA +
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
  `docs/migration-orders/12-0-decisions-and-contracts.migration-order.md` (PRE-DRAFTed — **PARKED 2026-08-30 — Phase 14 runs first**; the next session is **14-0**, whose order does not exist yet and must be created from `TEMPLATE-CONTRACT.md`. Run order after 11-3: 14-0…14-3 → 12-0…12-5 → 13-0…13-3 → 15-0…15-4 → 8B, per `MASTER-ROADMAP-PHASES-7-15.md` §0), this file
  (Current/Previous rotation — Session 11-1 moved to `history/sessions-archive.md`).

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
