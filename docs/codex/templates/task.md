---
type: Concept/Template
status: active
updated_at: 2026-10-11
---

# Durable task contract template

For Codex, copy the following into a unique file under `docs/codex/tasks/`.
Both agents may read it. Claude may instead reference its existing approved
order/build plan while recording the same ownership information. Delete
unused optional fields; never leave placeholder approval as a real approval.
Write the task in English by default under the shared
[language policy](../../agent-collaboration/LANGUAGE-POLICY.md).

```markdown
---
type: Concept/Task
status: in_progress
updated_at: YYYY-MM-DD
task_id: YYYY-MM-DD-unique-slug
owner: Codex or Claude Code
integrator: named primary agent
reviewer: named reviewer or not-required
shared_state_writer: named owner or handoff-only
approval: exact user instruction or approved order reference
order_mode: numbered order ID or ad-hoc; phase/session unchanged
base_commit: full SHA
worktree: absolute path
branch: actual branch
---

# Objective

Concrete behavior and done criteria, including relevant review/sign-off gates.

## Scope and ownership

- Allowed writes: exact paths/directories, including generated artifacts.
- Excluded writes and existing dirty paths:
- Reviewer: read-only scope and independent-review requirement, if any.
- Shared interfaces and dependency order:
- Resource owner: dev/build/generators/mutation runner.
- Existing authorization for commit/push/deploy, if any:

## Checklist

- [ ] Inspect live source, instructions and relevant entry criteria.
- [ ] Implement the authorized scope.
- [ ] Verify affected acceptance criteria; record exact checks.
- [ ] Complete required independent review and fixes.
- [ ] Write handoff and publish owned state.

## Decisions and deviations

Record new evidence, changed requirements and why a deviation is within scope.

## Verification

| Command | Cwd | Exit | Pass/fail/skip | Evidence / limitation |
| ------- | --- | ---- | -------------- | --------------------- |

## Continuation

- Next action and owner:
- Open blocked items and exact missing input:
- Latest source SHA/diff or file hashes:
- Durable handoff path:
- Ownership transfer: sender released; receiver acknowledged, if applicable.
```

Suggested statuses: `in_progress`, `ready_for_review`, `awaiting_review`,
`blocked`, `completed`. `completed` requires all scope and review gates to hold.
A record is advisory and remains on disk; it is not an enforced lock or Codex
application goal. See [collaboration](../protocols/collaboration.md).
