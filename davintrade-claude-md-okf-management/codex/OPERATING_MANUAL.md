---
type: Concept/Guide
status: active
updated_at: 2026-10-11
---

# Operating manual: Codex and Claude Code

Use this manual to assign, execute, review and transfer work in
`D:/SaaS Project/trading-alerts-saas-public/`. It covers the repository workflow;
actual agent access and host permissions still determine what can run.

The [architecture design](CODEX_CLAUDE_COLLABORATION_ARCHITECTURE_DESIGN.md)
explains the design. The [prompt library](PROMPT_LIBRARY.md) supplies copyable
stage prompts. For Advisor-assisted work, use the
[Advisor guide](ANTIGRAVITY_ADVISOR_GUIDE.md) and
[Antigravity opening prompt](OPENING_PROMPT_TO_ANTIGRAVITY.md).

## 1. Prepare a session

1. Open the repository checkout in the selected agent. Confirm the absolute
   working directory; do not infer it from the previous chat.
2. Have Codex read [AGENTS.md](../../AGENTS.md), or Claude Code read
   [CLAUDE.md](../../CLAUDE.md). Both use the shared
   [non-negotiables](../../.claude/rules/non-negotiables.md). Codex must read
   them explicitly; Claude's rule loading does not apply to Codex.
3. Read the [shared collaboration guide](../../docs/agent-collaboration/README.md),
   the relevant task/order and latest handoff. Check task-related state and
   blockers. Search headings and read only the sections needed for the work.
4. Identify the participation setup, development mode, owner and allowed paths.
   Apply nested `AGENTS.md` or `AGENTS.override.md` before editing their paths.
5. Verify access to the actual source and required runtime. Record unavailable
   access instead of claiming that a supplied document proves live state.

This documentation installs no daemon/dependencies. Links are reading instructions;
they do not share context, dispatch agents or enforce locks.

Durable agent documents and prompts use English. Conversation normally uses
English, and uses Thai when Davin writes Thai in that session, unless he
explicitly overrides it. Thai chat alone keeps artifacts in English. This rule
comes from the [language policy](../../docs/agent-collaboration/LANGUAGE-POLICY.md)
and does not change product locales or existing i18n requirements.

## 2. Choose participants, then a development mode

Davin sets policy, proposes plans, decides and approves owner gates. Antigravity
is an optional Advisor that recommends and drafts prompts for Davin to forward.
Either coding agent may build, investigate or review; roles depend on the task.

| Participation setup       | How Davin uses it                                                                |
| ------------------------- | -------------------------------------------------------------------------------- |
| Antigravity + Claude Code | Discuss the plan with the Advisor, decide, then send its stage prompt to Claude. |
| Antigravity + Codex       | Discuss the plan with the Advisor, decide, then send its stage prompt to Codex.  |
| Claude Code directly      | Assign the scope directly to Claude and review its returned evidence.            |
| Codex directly            | Assign the scope directly to Codex and review its returned evidence.             |

These four setups remain valid. Using one executor does not require involving
the other. When both executors share work, choose one of three development modes:

| Mode                         | Use it when                                           | Required arrangement                                                                           |
| ---------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Build and independent review | One implementation needs a second agent's assessment. | One builder, a stable snapshot, a read-only reviewer and a fix/recheck cycle.                  |
| Parallel development         | Work can be divided into independent slices.          | Disjoint paths in separate worktrees, agreed interfaces and one integrator.                    |
| Handoff and takeover         | Another agent must continue unfinished work.          | Sender stops, publishes stable evidence, receiver accepts and records transfer before writing. |

For example, a change contained in one service can use direct Codex assignment.
A shared API change can use Claude as builder and Codex as reviewer. Parallel
work is suitable only after the producer/consumer contract is agreed; an
unresolved interface belongs to a named owner before dependent work begins.

## 3. Establish authorization and a task contract

A numbered migration must follow the
[executor protocol](../../docs/migration-orders/EXECUTOR-PROTOCOL.md):
PRE-DRAFT -> DRAFT -> APPROVED by Davin -> CONFIRMED by the executor after live
source, runtime and entry checks. Read the approved order's Decisions taken.
Missing runtime evidence remains unconfirmed. A DRAFT future stage may be
prepared, but its implementation cannot start before its stated gates hold.

For ad-hoc work, Davin's direct instruction authorizes its explicit scope.
Record it, verify the relevant source and label `phase/session unchanged`.
Do not request the same approval again. A task record or Advisor prompt does
not grant approval, expand scope or satisfy a separate explicit sign-off.

For 3+ steps, a broad audit, migration or shared work, copy the
[task template](../../docs/codex/templates/task.md) into
`docs/codex/tasks/YYYY-MM-DD-<unique-task-id>.md`. Fill all fields from evidence.
Claude may record equivalent ownership in its approved order/build plan. Only
the owner edits its checklist; Codex never takes Claude's `active-tasks.md`.

Before editing, the contract must identify:

- Task/order ID, exact authorization, objective and acceptance criteria.
- Builder, reviewer, integrator, shared-state writer and resource owners.
- Absolute checkout path, actual branch, verified base HEAD and dirty paths.
- Allowed/excluded paths, including tests, generated files and report artifacts.
- Interfaces, dependencies, review gates and next stage's entry conditions.
- Required checks, output paths and any separate commit/push/production approval.

Example: assign a service's runtime/test paths to Claude, a unique read-only
review report to Codex and shared state to Claude. Fill actual paths and criteria
from Davin's assignment; a task ID is not approval.

Ownership records are advisory agreements, not filesystem locks. Consult
accessible active tasks and inspect dirty target files. Unknown ownership
requires scope separation or an explicit handoff; silence is not release.

## 4. Inspect the live checkout

Run these read-only commands from the intended checkout:

```powershell
Get-Location
git branch --show-current
git rev-parse HEAD
git status --short
git worktree list --porcelain
```

Record the output in the task. A blank branch can mean a detached HEAD; record
that fact instead of inventing a branch. Compare relevant source against the
order and handoff. Preserve others' tracked edits, untracked files and deletions.
Do not use `git stash`, broad reset/restore/clean or overwrite another owner's work.

For concurrent Claude/Codex implementation, use separate worktrees and branches.
The worktree contract names an actual verified starting ref; do not substitute
an assumed default branch or made-up SHA. New Codex branches normally use
`codex/`. Follow the active host's permissions when creating the checkout.

Uncommitted files do not travel between worktrees. Transfer task/interface/source
artifacts by accessible local path, scoped patch or authorized commit, then verify
the snapshot. Include new/deleted files; unstaged diffs omit untracked content.
Do not transfer secrets or unrelated local configuration.

## 5. Execute and maintain continuity

The executor works through authorized, unblocked checklist items. Record
meaningful deviations, changed requirements and check results as they arise.
Mark a step complete only when its acceptance criteria hold. Progress updates,
status questions and context compaction do not end the assignment.

Executors make routine choices within scope. Settled decisions reopen on Davin's
steering or new contradictory evidence. Record the contradiction and its effect;
live source/runtime evidence takes precedence over obsolete assumptions.

The following existing rules remain binding:

- `seed-code/**` is read-only; respect change freezes and excluded paths.
- Out-of-scope money, auth, grants, secrets or CORS changes return to Davin.
  An item marked NEEDS EXPLICIT SIGN-OFF needs its own sign-off.
- Never enter login credentials or apply production migrations. Commit/push
  only when Davin asks; merge, deploy and flags need applicable approval.
- Dependency overrides require their dedicated process in
  [security overrides](../../.claude/rules/security-overrides.md).
- Read installed Next.js guidance under `node_modules/next/dist/docs/` before
  changing Next.js code, as directed by the root routers.

Record blocked decisions and next owners; finish independent authorized work.
Never push through a broken cutover or claim a half-deployed unit is complete.

After compaction or resume, read the current task, latest user steering, handoff
and live diff. Reconcile the checklist with disk before repeating work. Confirm
ownership still belongs to the receiver of the session. A completed record is
historical evidence and does not authorize resuming that task.

## 6. Verify the affected change

Use the [verification adapter](../../docs/codex/protocols/verification.md) and
[shared checklist](../../.claude/protocols/verification-checklist.md), plus any
mandated order checks. Inspect package scripts, configs and test prerequisites
before selecting commands. Do not treat a command table as an instruction to
run every package's tests for every task.

| Change                            | Verification selection                                                           |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Operating documentation           | Document validator, targeted formatting and whitespace checks.                   |
| Document validator implementation | Its unit tests and the real document validator.                                  |
| Runtime code                      | The affected package's type-check, lint/test checks and required broader checks. |
| TypeScript tests                  | Relevant tests plus actual test type coverage; root tsc excludes tests.          |
| UI                                | Automated checks plus browser evidence at affected sizes/locales.                |
| Shared schema/API                 | Producer and consumer checks, drift/parity and owned regeneration.               |
| Python/Stack D                    | Relevant standalone/unit/fixture checks selected from current paths.             |

From repository root, a documentation-only change can use:

```powershell
node scripts/agents/check-operating-docs.mjs
node node_modules/prettier/bin/prettier.cjs --check <explicit-document-paths>
git diff --check
```

Replace placeholders before running. Use installed tools. If tools or runtime
access are missing, state that limitation and follow host approval/network rules.
The checker verifies selected budgets, metadata and local links; it does not
prove correct behavior, instruction loading, approvals or concurrency safety.

Coordinate resource ownership before checks that write shared outputs. Root
`npm run build` runs a prebuild that clears `.next`, `tsconfig.tsbuildinfo` and
`node_modules/.prisma` and rebuilds shared types. Root `type-check` regenerates
both Prisma clients. These can conflict with dev servers or generators. Mutation
tests need a suitable scratch environment, not another agent's active checkout.
Separate worktrees do not isolate a shared test database or other external service.

Record evidence in the task and handoff:

| Command        | Cwd              | Exit        | Pass/fail/skip | Evidence / limitation                     |
| -------------- | ---------------- | ----------- | -------------- | ----------------------------------------- |
| Actual command | Actual directory | Actual code | Actual counts  | Snapshot, output and any unavailable gate |

Classify every gate as passed/failed/skipped/not run. Nonzero exits remain failures
even with passing assertions. Name unavailable runtime/browser/MetaEditor gates
and their next owners. Historical counts do not prove current source passes.

## 7. Build and review cycle

1. Builder implements and verifies the allowed scope, then identifies a stable
   review snapshot. Avoid writes to reviewed paths while review is in progress.
2. Davin sends the reviewer prompt with the actual task, handoff, paths and
   snapshot. Required fresh P6/session B review uses a fresh reviewer context;
   a helper that built the implementation does not satisfy that gate.
3. Reviewer reads implementation without editing it and writes only its own
   assigned report. Checks that generate files require resource ownership or
   an isolated snapshot. Report severity, file/line, trigger, consequence and
   a practical correction; separate defects from suspicions.
4. Builder fixes authorized findings. Out-of-scope decisions go to Davin.
5. Reviewer rechecks the fixes against the new snapshot and identifies which
   earlier findings/evidence remain valid. A review pass does not approve deploy.

With uncommitted implementation, HEAD alone is insufficient. Record a scoped
diff or SHA-256 of relevant files, including new files. Record deletions and
paths separately. For an actual file, this read-only command gives its hash:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<actual-file-path>'
```

Capture the reviewed content before producing the report. Recheck the snapshot
at the end. If source changed, affected evidence needs a new review; do not
silently claim a pass for a different revision.

## 8. Parallel development and integration

Before dispatch, agree interfaces and allocate disjoint implementation, test,
generated and metadata paths. Name one owner for shared contracts, lockfiles,
common types, generated clients, flags and state. Each executor uses its own
worktree and task record; the integrator receives both returned artifacts.

Example: integrator defines interface -> Davin assigns A to Claude/B to Codex ->
both build and publish stable evidence -> integrator combines scoped outputs and
runs producer/consumer checks -> designated writer publishes state. A pending
interface does not authorize either slice to invent its own contract.

Before integration, inspect the current HEAD and diff in the destination and
verify each received patch/artifact. Do not overwrite unrelated dirty files.
Integration can use an explicitly transferred scoped patch; creating commits,
pushing or merging branches still requires the authorization stated in the
contract. If the combined source differs from a reviewed snapshot, rerun the
checks that depended on it. Publish shared status once through the named writer.

## 9. Transfer unfinished work

Use the [handoff template](../../docs/codex/templates/handoff.md) at a unique path:
`docs/handoffs/YYYY-MM-DD-<task-id>-<agent>-<stage>.md`.

The sender stops writing the assigned scope **before** capturing the stable
snapshot and publishing the handoff. Include authorization, absolute checkout,
branch, base/head SHA, scoped diff or file hashes, changed/deleted paths,
completed/remaining checklist, verification and exact next action. Explain how
the receiver obtains uncommitted source and task artifacts in another checkout.

The receiver verifies scope, authorization, snapshot, open work and resource
availability. It then acknowledges acceptance and records the ownership transfer
in its assigned artifact before any implementation writes. The sender stays
stopped. If acceptance is rejected, explicitly restore the prior owner before
that owner resumes. An unfinished checklist or an absent reply is not a transfer.

Example: Claude stops after a handler implementation and lists unfinished
error-path tests. Codex verifies the snapshot, accepts only the handler/test
scope, records transfer, then continues and runs checks for its new edits.

## 10. Close and publish the result

Read the checklist before closing. Complete all required work and review gates,
or label the record `ready_for_review`, `awaiting_review` or `blocked` with the
exact remaining action. Use `completed` only after the stated done criteria hold.
These file statuses are documentation, not application goal controls.

The final handoff leads with Needs from Davin, then Changed and verified, then
Unconfirmed/found, and ends with the next action and owner. If no decision is
needed, write `None`; do not invent an approval request for already authorized work.

Only the named shared-state writer updates
[Claude current-state](../../.claude/state/current-state.md), blockers or history,
following the [Claude lifecycle](../../.claude/protocols/session-lifecycle.md),
including its two-entry/archive rules. Other executors publish handoffs for that
writer and state pending publication explicitly. Only the owner/integrator of
the [Codex continuity pointer](../../docs/codex/state/current-state.md) updates it.
Link task and handoff; keep session narratives out of both root routers.

Davin can return the handoff to Antigravity or assign the next task directly.
Writing artifacts sends no external messages. Report onboarding/runtime checks
only when actually performed.

## Reading matrix

| When                                  | Files to read                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every executor session                | Its root router, shared non-negotiables, task/order and latest relevant handoff.                                                                                                          |
| Codex session open/resume/close       | [Lifecycle](../../docs/codex/protocols/session-lifecycle.md), relevant [shared state](../../.claude/state/current-state.md) and [Codex pointer](../../docs/codex/state/current-state.md). |
| Both agents share work                | [Collaboration](../../docs/codex/protocols/collaboration.md) and relevant ownership/checklist records.                                                                                    |
| Advisor session                       | [Advisor protocol](../../docs/agent-collaboration/ADVISOR-PROTOCOL.md), this package's opening prompt and current task evidence.                                                          |
| Money/auth/dependencies               | Shared non-negotiables and [security overrides](../../.claude/rules/security-overrides.md), plus task-related domain rules.                                                               |
| UI/locales                            | [i18n compliance](../../.claude/rules/i18n-compliance.md).                                                                                                                                |
| DB/schema                             | [Database traps](../../.claude/architecture/database-traps.md) and [waiting-on](../../.claude/state/waiting-on.md).                                                                       |
| Infrastructure/deploy                 | [Infrastructure](../../.claude/architecture/infrastructure.md), blockers and applicable approval.                                                                                         |
| Stack D                               | [Architecture](../../docs/STACK-D-ARCHITECTURE.md), [ADRs](../../docs/adr/README.md) and [MCD standard](../../docs/MCD-DEVELOPMENT-STANDARD.md).                                          |
| Before done                           | Verification adapter, shared verification checklist and acceptance criteria.                                                                                                              |
| Repeated incident or tooling surprise | Search [history](../../.claude/state/history/index.md) and [environment gotchas](../../.claude/architecture/environment-gotchas.md).                                                      |

For stale evidence, missing files, conflicting owners or validation failures,
use [maintenance and troubleshooting](MAINTENANCE_AND_TROUBLESHOOTING.md).
