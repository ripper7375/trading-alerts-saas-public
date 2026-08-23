# Migration Order — Session 10-3 — Blueprint Reconciliation & Close

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **near zero**: this is a
> VERIFY-RETIRE session — checklists exist to be obeyed, not a build session. **PRE-DRAFTed by the
> Executor at Session 10-2's close (2026-08-23)** per `MASTER-ROADMAP-PHASES-7-15.md` §3.
> **Fast-path eligible** (`EXECUTOR-PROTOCOL.md` §4): as a VERIFY-RETIRE session, this PRE-DRAFT
> may go straight to Davin for `APPROVED`, skipping the Advisor DRAFT step.

**Session:** 10-3 · **Phase:** 10 (Drawing Engine & Line-Alert Closure — final session) ·
**Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 10-2's close) · **Estimated time:** ~1–1.5h
(pure documentation reconciliation — no code changes).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: "10-3 — Blueprint reconciliation & close (VERIFY-RETIRE):
rewrite the blueprint's §3/§7/§14 status callouts to describe the `operation-service` reality
(they still describe monolith `lib/alert-engine/`, Prisma 6 and `prisma/schema.prisma` — all three
moved); fold `implementation-progress-files-and-folder-directory.md` into
`migration-stack-analysis.md`." This is Phase 10's own **final** session — closing it closes the
whole phase, and per the roadmap's own trigger table, **this session also owes Phase 8A's handover
prompt** (`10-3 writes 8A's` — NOT Phase 11's; the 10-2 order's own "Next-session handoff" text
said Phase 11, confirmed wrong against the roadmap's own authoritative table and corrected in
`CLAUDE.md`'s Session 10-2 entry, not propagated here).

Session 10-1 resolved F67 (live smoke test) and Session 10-2 resolved F82 plus shipped durable
Playwright/Newman regression coverage. The drawing engine and line alerts are now fully built,
cut over, live-verified, and regression-tested — the **only** remaining Phase 10 debt is that its
own architecture blueprint still describes a stack topology that stopped being true at Sessions
4B-2/4B-3/4B-8 (mid-Phase-4B, well before Phase 9's frontend swap or this Phase 10 even opened).

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 10-2 CLOSED SUCCESSFUL** — F82 resolved, Playwright + Newman coverage green
      (`10-2-e2e-api-coverage.migration-order.md`).
- [ ] **No Phase 10 work remains unclosed** — F67 and F82 both RESOLVED in `DECISION-LOG.md`;
      re-check nothing new was registered against Phase 10 between 10-2's close and this
      session's open.
- [ ] **Baseline test suites 100% green** (re-verify fresh, don't trust the 10-2 close number if
      any source has changed since): monolith `test:ci`, `operation-service`, `money-service`.
- [ ] **Blueprint and companion doc both still exist at their known paths** —
      `davintrade-draw-engine-and-line-alerts-stack/architecture-design-blueprint/
DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` and
      `davintrade-draw-engine-and-line-alerts-stack/implementation-progress/
implementation-progress-files-and-folder-directory.md` (both confirmed present at Session 10-2's
      own PRE-DRAFT time; re-verify, don't assume).

---

## Checklist

**RETIRE / EXIT-REVIEW block**

1. **Rewrite the blueprint's stale status callouts** in
   `DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`:
   - **§3 (Existing stack inventory, table around line 48–83):** the table's "Database" row says
     `PostgreSQL via Prisma 6 (@prisma/client, pg) | prisma/schema.prisma` — the schema is now
     split (`prisma/non-market-data/schema.prisma` + `prisma/market-data/schema.prisma`, per
     Session 4B-1/F9's hoist). "Web framework" row says Next.js 15.5 — live `next dev` boots
     Next.js 16.3.0. The §3 prose note (lines 78–83, "Phase 4 status callout in §7... only the
     live cross-process round trip... remains unverified, see `PHASE-4-SMOKE-TEST-RUNBOOK.md`") is
     now fully resolved — F67 closed at Session 10-1, live proof at Sessions 10-1/10-2.
   - **§7 (Per-phase architecture, "Phase 4 — Server-side alert engine," ~line 234):** describes
     `scripts/alert-worker.ts` and monolith `lib/alert-engine/*` — this code no longer exists in
     the monolith. The real implementation is `operation-service/src/alert-engine/*` (worker,
     dispatcher, evaluator, detect, notify-bridge — Sessions 4B-2/4B-3), `operation-service/src/
drawings/*` (Session 4B-8), and line alerts inside `operation-service/src/alerts/*` (Sessions
     4B-5/6/7). Rewrite this phase's status callout to name the real files and cite F67/F82's
     resolutions as the closing proof, not an open blocker.
   - **§14 (Verification Notes, 2026-07-05, ~line 402):** written the same day the Flask→Redis
     publish leg and `scripts/alert-worker.ts` wiring were the "one remaining blocker" — both
     statements are now stale. Replace with a 2026-08-23 verification note citing Sessions
     10-1 (F67, all 4 Invariant Proofs live) and 10-2 (F82, Newman/Playwright regression coverage)
     as the actual closing evidence. Leave the `sync/`-pipeline caveat (Contabo VPS deployment,
     not this repo) as-is — still accurate, unrelated to this reconciliation.
   - Do **not** touch §1, §2, §4–§6, §8–§13 unless CONFIRM finds them also stale (unlikely — §14's
     own note says "everything else checked out" as of 2026-07-05, and nothing in Phase 10 touched
     the drawing engine's own geometry/tool code).
2. **Fold `implementation-progress-files-and-folder-directory.md` into `migration-stack-analysis.md`.**
   The former (150 lines, a build-time file-tree manifest for the original drawing-engine build)
   duplicates what `migration-stack-analysis.md` already tracks per-session — fold its historical
   content into a dedicated `migration-stack-analysis.md` entry (or its own clearly-labeled
   historical section), then either delete the standalone file or replace it with a one-line
   pointer to its new home (Advisor/Davin's call at DRAFT/CONFIRM). This order leans toward
   deletion with a pointer rather than `phase-6-frontend-gap-matrix.md`'s own precedent of a
   superseded-banner (kept when a doc still has independent historical value) — this one is a pure
   file listing with no narrative value of its own, so deletion is the leaner choice, but flag
   for Davin rather than assume.
3. **Write Phase 8A's handover prompt** —
   `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-8A.md`, per
   `MASTER-ROADMAP-PHASES-7-15.md`'s own trigger table and its own stated rule ("written by Davin
   or an Advisor-side assistant at the close of the last session of the preceding phase, and must
   carry that session's real closing baselines rather than a figure copied forward"). **This is
   explicitly NOT the Executor's job per `EXECUTOR-PROTOCOL.md` §3** ("close-out duties end at
   PRE-DRAFTing the next order") — flagging its existence/entry-criteria (Phase 8A's own entry
   criteria per the roadmap: 4A-13/14/15/16 CLOSED, Phase 9-10 CLOSED, Phase 10-3 CLOSED, F65
   resolved) so Davin/the Advisor has what's needed, not drafting the prompt itself here.
4. **Confirm Phase 10 phase-exit criteria**, walking each explicitly with evidence: F67 RESOLVED
   (10-1), F82 RESOLVED (10-2), durable Playwright + Newman regression coverage shipped (10-2),
   blueprint reconciled (this session's own step 1). Record the phase as CLOSED.
5. **Record:** `migration-cutover-table.md` (expected: no changes — no route/slice moves in a
   pure-docs session), `CLAUDE.md` (Current/Previous rotation — Session 10-1 moves to
   `history/sessions-archive.md`), `DECISION-LOG.md` (no flag touched by this session's own scope
   unless CONFIRM finds one). PRE-DRAFT the next session's order — per the roadmap's own running
   order (§0), that's **Session 8-1** (Phase 8A — Decommission, part 1), whose entry criteria
   include 4A-13/14/15/16 CLOSED (not yet true — Phase 4X is a separate, parallel track per the
   roadmap's own gate) and F65 resolved (already RESOLVED, Session 9-0). **Flag this gate
   explicitly in the PRE-DRAFT rather than assuming 8-1 can start immediately** — Phase 4X's own
   closure status needs a live check at that PRE-DRAFT's own time, not assumed from this session.

- **Rollback:** `git revert` of the doc-only commit(s) — zero code touched, trivially safe.

---

## Rules specific to this variant

- **No new code, no fixes, no "while I'm here"** — pure documentation reconciliation. If CONFIRM
  or execution surfaces a real code defect, STOP, register it as a `DECISION-LOG.md` flag, and
  route it to its own scoped session — do not fix it inline (near-zero creativity dial).
- Any red baseline-test result = stop and document, never "probably fine."

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

## Next-session handoff

- **Next session:** `8-1` — Deletion sweep (Phase 8A, part 1). **Entry criteria include** Phase 4X
  (4A-13/14/15/16) CLOSED and Phase 9-10 CLOSED (already true) — **re-verify Phase 4X's own closure
  status live at that session's own PRE-DRAFT/CONFIRM**, it is a separate track this session does
  not check.
- **Prerequisite:** Session 10-3 CLOSED SUCCESSFUL (closes Phase 10 in full).
