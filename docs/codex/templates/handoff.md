---
type: Concept/Template
status: active
updated_at: 2026-10-11
---

# Handoff template

Create `docs/handoffs/YYYY-MM-DD-<task-id>-<agent>-<stage>.md` with a unique name.
Use project-relative Markdown links within the artifact; use full absolute
paths when linking local files to Davin in chat. Write the handoff in English
by default under the shared [language policy](../../agent-collaboration/LANGUAGE-POLICY.md).
Copy the structure below.

```markdown
# Handoff: task ID / stage

Date: YYYY-MM-DD, Asia/Bangkok (add UTC if useful)
From / to: named sender and receiving owner
Task / order: linked task and authorization
Phase/session: numbered order or unchanged
Source: absolute worktree path, branch, base/head SHA
Uncommitted review snapshot: scoped diff or SHA-256 of reviewed files
Status: built / reviewed / awaiting owner action / completed

## Needs from Davin

None, or the exact decision/approval required and the concrete reviewable result.

## Changed and verified

Behavior delivered and exact changed paths, including deletions/generated files.

| Command | Cwd | Exit | Pass/fail/skip | Evidence / limitation |
| ------- | --- | ---- | -------------- | --------------------- |

## Review findings

Defects: severity, path/line, trigger, consequence and correction.
State whether findings are fixed and rechecked; separate unverified suspicions.

## Unconfirmed / found

Unavailable checks, remaining work, contradictions and pre-existing changes.
Be explicit about deployment/migration/flag state when relevant.

## Next action and ownership

What the receiver does next, allowed files and remaining acceptance criteria.
How another worktree obtains uncommitted artifacts or the scoped patch/commit.
Which agent updates shared state; pending state publication if applicable.
Ownership release/acceptance, or awaiting acknowledgment.
```

A review handoff names what was independently checked; it does not silently
approve deployment or claim that a fresh-session gate has happened. See
[collaboration](../protocols/collaboration.md) and
[session lifecycle](../protocols/session-lifecycle.md).
