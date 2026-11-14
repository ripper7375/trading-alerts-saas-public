# Review prompt for Claude Fable

Paste everything below the line into the Fable session. Written in English per this project's
own language policy (`docs/agent-collaboration/LANGUAGE-POLICY.md`): agent-facing prompts stay
English by default regardless of what language the surrounding chat uses.

---

## Your task

You are reviewing a draft architecture and its draft implementation for a new data pipeline in a
production trading-alerts SaaS codebase ("DavinTrade"). Everything was built by Claude Code
(Sonnet 5.5, acting as "the Executor" in this project's own role vocabulary) in one long working
session with the project owner, Davin, and has **never been deployed, migrated, committed to a
remote, or run against live infrastructure.**

Do this in order:

1. **Read the two entry-point documents first**, both in
   `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/new-market-context-synthesis-and-analysis-architecture/`:
   - `TRENDLINE-CONTEXT-BLUEPRINT.md` — the database schema and JSON contract design.
   - `DATA-PIPELINE-ARCHITECTURE.md` — the end-to-end pipeline, source (MT5 terminal) to
     destination (PostgreSQL / eventually the AI reply). Its **§1a File Inventory** lists every
     file this work touches, inside and outside that folder, with exact paths — use it as your
     checklist so nothing is missed.
     Both documents already contain a verification record (§7 of the pipeline document), explicit
     "not built yet" lists, open feasibility questions the Executor itself raised (Blueprint §10,
     pipeline document §9), and a note about a live operational constraint (pipeline document §8).
     Read those sections closely: your job is to find what they _missed_, not to re-report what
     they already say.

2. **Read every file the inventory names**, not just the two documents. In particular:
   - `TrendlineLabelUtils.mqh`, `TrendlineScreenshotAndLabelExport_v2_29.mq5`,
     `TrendlineValueExport_v2_29.mq5`, `trendline_context_uploader.py` (all in the same folder).
   - `railway-gateway/src/trendline-context/**` (the module, controller, processor, service,
     keys, DTO).
   - `prisma/market-data/schema.prisma` and `railway-gateway/prisma/schema.prisma` (search for
     `TrendlinePolicySession`, `TrendlinePolicyLine`, `TrendlineContextReading`), and
     `prisma/migrations/20261114000000_add_trendline_context_tables/migration.sql`.
   - The one-line change in `railway-gateway/src/app.module.ts` that registers the new module.
     Check that the code actually matches what the documents claim — the Executor's own audit pass
     already found and fixed two real mismatches (a documented field that was never implemented; a
     documented example missing a real constraint); assume there may be more you can still find.
     Two files in the folder (`Objects Copier_6Sources_1Dest_v2_29.mq5`,
     `SsaCrossingAndFractal_v2_29.mq5`) were built by Davin himself, read but not modified by the
     Executor, and are marked in the inventory as out of this pipeline's scope — you may still read
     them for context, but they are not what you are being asked to feasibility-check.

3. **Do a feasibility analysis.** For each of the following, say plainly whether it is sound,
   workable, risky, or actually wrong — do not just summarize, take a position:
   - **Architectural soundness** of the two-layer split (Layer 1 policy, human-written, rare;
     Layer 2 context, machine-computed, every 5-minute cycle) and whether the idempotency design
     (keyed on `(symbol, published_at)` for Layer 1, `(cycle_slot, policy_line_id)` for Layer 2)
     actually holds under the failure modes the pipeline document's §3 table claims.
   - **Data integrity**: the TSV wire format and its escaping, the anchor-point-not-frozen-value
     design for a sloped line's price, the `slot` vs `slot_key` distinction, whether an unbounded
     `InpMaxTrendlines` line count makes the one-transaction write in
     `trendline-context.processor.ts` unsafe at some size.
   - **Operational feasibility**: the fact that nothing currently enforces which
     `InpCaptureEveryMinutes` value goes on which of the 8 screenshot attachments (pipeline
     document §2.1a already names this gap) — is "a human sets 8 inputs by hand" actually workable
     long-term, or does this need the "one coordinator EA" alternative the document mentions was
     discussed but never built? Also: whether sending up to 8 images per AI request (not yet
     implemented, but designed for) is a sound target given today's reply pipeline accepts one.
   - **Security and this project's own non-negotiables** (read
     `.claude/rules/non-negotiables.md` and the root `CLAUDE.md` if you have repository access):
     no real infrastructure addresses or credentials anywhere (the Executor scanned for this; spot
     -check it yourself), the gateway auth pattern reused correctly, the migration file never
     applied, nothing pushed.
   - **Consistency with this codebase's own established Stack D patterns**: dynamic-module-gated-
     behind-an-env-flag (mirrored from `SensorsModule`), append-only tables, reusing the
     `VALID`/`CAUTIONARY`/`INVALID`/`STALE` vocabulary rather than inventing a new one, and in
     particular **ADR-025** ("rules decide, the model explains" — a sensor or hint must never
     silently change what bias a trader is shown; any path from `bias_hint`/`regime_hint` into an
     actual shown answer must go through the existing SYN rules table as a deliberate, versioned,
     owner-approved decision, never a direct read by the model). Confirm the design as built
     actually respects this and does not quietly open a side door around it.
   - Anything else you notice that looks architecturally wrong, hard to build as specified, or
     under-specified enough that a future implementer would have to guess.

4. **If you find something infeasible, defective, or risky: fix it, don't just flag it.** Work out
   a concrete resolution. If the fix changes a contract (a field, a table, an endpoint shape, a
   cadence, a file's content), write out the corrected version precisely enough that someone could
   apply it directly — not "this should probably change somehow." Where a finding is really a
   **content decision that belongs to Davin** rather than an engineering feasibility question (for
   example: the exact closed vocabulary for `role`; whether `bias_hint`/`regime_hint` should ever
   enter the SYN rules table, and how; which model and cost ceiling the eventual `model`-path label
   parser should use) — say so explicitly and frame it as a question for him, rather than deciding
   it yourself.

5. **Once you have resolved what you can and clearly flagged what you cannot, write an
   implementation plan**, broken into phases or parts, reflecting the FINAL design (including any
   fixes you made in step 4), not the as-found state. A reasonable starting shape — revise this as
   you see fit, it is a suggestion, not a mandate:
   - Finish and verify Layer-1 ingestion end-to-end (a first real MT5-to-Postgres row, which has
     never happened yet — everything so far is unit-level or schema-level verification only).
   - Layer-2 computation (the sensor-worker step that is explicitly not built yet).
   - The reply-pipeline read side: assembling the JSON envelope and extending the context
     assembler to carry more than one chart image.
   - The label parser (Blueprint §4.4): the `rule` path first (cheap, deterministic), the `model`
     path second.
   - Operational rollout: attaching the exporter to all 6 charts with the right cadence, the
     `off → shadow → live` flag progression this project already uses for comparable features,
     and applying the migration — all of which explicitly wait on Davin and on Stage B3 (the live
     shadow run named in the pipeline document's §8) being clear, not on anything engineering-
     ready alone.

## What your output should be

A written review (your findings from step 3, your fixes from step 4) and the implementation plan
from step 5. **Do not edit the repository's files yourself.** This project's own role split (see
`.claude/architecture/role-distinction.md` if you have repository access) has the Advisor —
the role you are filling here — decide from documents and hand off a plan; the Executor decides
from live code and implements under the project owner's explicit, session-by-session approval.
Your output becomes the input to that next Executor session, not a direct edit.
