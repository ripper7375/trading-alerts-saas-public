---
type: Concept/Protocol
status: active
updated_at: 2026-10-11
---

# Codex session lifecycle

Shared rules: [non-negotiables](../../../.claude/rules/non-negotiables.md).
Shared Claude lifecycle: [session-lifecycle](../../../.claude/protocols/session-lifecycle.md).
This protocol adapts storage and host behavior for Codex. It does not replace
Claude's session numbering, checklist or archive policy.

## Open and authorize

1. Read `AGENTS.md` and the shared non-negotiables explicitly. Claude's automatic
   rule loading does not apply to Codex. Check nested `AGENTS.md` and
   `AGENTS.override.md` along paths that will be edited; follow the host's
   instruction precedence and Davin's current scope. Apply the shared
   [language policy](../../agent-collaboration/LANGUAGE-POLICY.md) to replies
   and durable artifacts.
2. Record branch, HEAD, worktree path and existing changes. Inspect changed
   target files before editing; preserve unrelated changes and deletions.
3. Read the shared current-state frontmatter and the status sections matching
   the task. Use heading searches and bounded reads: that file can be large
   even with only two entries. Read the relevant handoff, order, blockers and
   domain files. Do not infer current production health from an old session.
4. Numbered migration: follow [EXECUTOR-PROTOCOL](../../migration-orders/EXECUTOR-PROTOCOL.md),
   the approved order, roadmap and decision log. Verify source, runtime and
   entry criteria before marking CONFIRMED. If runtime access is unavailable,
   record what remains unconfirmed; do not manufacture confirmation.
5. Ad-hoc task: Davin's direct instruction supplies authorization for its
   explicit scope. Record that instruction and confirm the relevant live
   source in the task record. Label `phase/session unchanged`; do not require
   a new numbered order or repeat permission already granted. A task record
   documents authorization; it never grants it.
6. Before writing, establish ownership through [collaboration](collaboration.md).
   Take a small task directly; create a [task record](../templates/task.md)
   for 3+ steps, a broad audit, migration, or cross-agent handoff.

## Track and execute

- Store the checklist at `docs/codex/tasks/YYYY-MM-DD-<unique-task-id>.md`.
  Include owner, integrator, approval scope, base commit, allowed paths,
  acceptance criteria and next action. The task ID must distinguish
  simultaneous tasks. Only its owner edits that checklist.
- Claude keeps `.claude/state/active-tasks.md`. Its existence is evidence of
  someone else's work, not authorization for Codex to resume or delete it.
- Work on unblocked, authorized checklist items until they are complete and
  verified. A progress message, status question or compaction does not end
  the task. New user instructions steer the existing objective unless they
  clearly cancel it or replace it with an incompatible objective.
- Mark items complete only after their acceptance criteria hold. Record newly
  found work, meaningful deviations and exact check results as they arise.
- On compaction or resume, re-read the current task, user steering and source
  diff. Reconcile the checklist with disk before repeating work. `completed`
  records are historical evidence, not tasks to resume automatically.
- Keep settled decisions unless Davin questions them or new evidence disagrees.
  Explain choices with conclusions and evidence, not private reasoning traces.
- An out-of-scope money/auth/secrets/CORS decision or explicit sign-off gate
  stays pending. Finish independent authorized work while awaiting its answer.
- Never stash, broadly restore, clean, reset or delete another agent's work.
  A partial attempt can be reverted only for your own unchanged edits after
  comparing the current file; otherwise preserve it and record the blocker.

## Verify and close

1. Follow [verification](verification.md). Record command, working directory,
   exit code, pass/fail/skip counts and limitations. Do not equate transpiling
   TypeScript tests with type-checking them.
2. Read the task checklist. Continue if authorized, unblocked items remain.
   Mark `completed` only when all required work is done; otherwise use
   `blocked`, `awaiting_review` or `ready_for_review` as appropriate and state
   the exact remaining action. Those file statuses are documentation, not
   Codex application's goal status controls.
3. Create a unique handoff in `docs/handoffs/` using the
   [template](../templates/handoff.md). Lead with Needs from Davin, then Changed
   and verified, then Unconfirmed/found. Do not invent a blocker if none exists.
4. The integrator refreshes shared artifacts only when it owns those writes.
   A Codex reviewer ordinarily adds its report only. A Codex implementer
   without shared-state ownership leaves a handoff for the state owner;
   record this pending publication explicitly. Never silently prune or rotate
   Claude's current-state/history. Numbered orders still require their
   Deviations and applicable decision/cutover/inventory updates.
5. Update the compact [Codex continuity pointer](../state/current-state.md)
   only when this session owns it. Link the task and handoff, plus the next
   action. Concurrent Codex sessions publish their individual records first;
   one integrator updates the pointer. Keep full reports out of both routers.
6. Report completion and material limitations to Davin. No commit, push or
   merge unless Davin authorized that action. A passing check is not approval
   to apply a migration, deploy or enable a production flag.

Retain completed task records for audit. Archive them only with ownership and
repair incoming links; there is no automatic deletion or rotation job.
