---
type: Concept/Protocol
authority: guidance
updated_at: 2026-09-27
tags: [subagents, parallel, audit]
related_docs:
  - ./session-lifecycle.md
  - ../rules/non-negotiables.md
---

# Subagent orchestration

For broad sweeps that split cleanly: codebase audits, file inventories, checks across several
services. **Use subagents only when Davin asks for them or authorizes them for the task.** Each one
starts cold and costs a full context; most tasks are faster done inline.

1. **Partition by domain.** One subagent per service, package or route slice (e.g. one for
   `money-service/`, one for `operation-service/`), with no overlap. Each prompt must stand alone:
   give paths, the question and the expected output format. A subagent does not see this session.
2. **Scope the tools.** Audits and searches → read-only agent types (`Explore`, `Plan`). A
   subagent that edits works in its own worktree (`isolation: "worktree"`) and never on `main`.
3. **One integrator.** The primary agent reviews and merges subagent output, and is the only one
   that commits — and only when Davin asks. Subagents obey the same
   [non-negotiables](../rules/non-negotiables.md); money/auth findings escalate, never auto-fix.
4. **Aggregate into the normal artifacts.** Subagent reports are not shown to Davin. The primary
   agent verifies them (a subagent's claim is a lead, not evidence) and records the result where
   it always would: the order's Deviations, the session entry, `waiting-on.md`. No per-subagent
   files in `.claude/state/`.
5. **Track the fan-out** in `.claude/state/active-tasks.md` (one item per subagent), so a
   compaction mid-run does not lose which slices are done.
