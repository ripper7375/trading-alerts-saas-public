---
type: Concept/Protocol
status: active
updated_at: 2026-10-11
---

# Claude Code and Codex collaboration

The shared [roles](../../../.claude/architecture/role-distinction.md) remain:
Davin owns decisions and approvals; Antigravity advises architecture;
Claude Code executes its assigned work. Codex can implement, investigate or
review the work Davin assigns. Neither coding agent self-approves owner gates.

## Choose a mode by task

| Mode                                   | Implementer                              | Other agent                                   | Integration                                                 |
| -------------------------------------- | ---------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Implementation plus independent review | Claude or Codex                          | Reads source and verifies acceptance criteria | Implementer fixes findings; reviewer rechecks               |
| Parallel independent slices            | Owner for each disjoint package/path set | Owns a separate slice and worktree            | One named integrator combines changes                       |
| Take over unfinished work              | Named receiving owner                    | Previous owner stops writing that scope       | Receiving owner acknowledges handoff and revalidates source |

These are the three development modes. Investigation and design prepare work
within any mode. When engaged, Antigravity drafts stage prompts using the
[Advisor protocol](../../agent-collaboration/ADVISOR-PROTOCOL.md); Davin makes
owner decisions and forwards the prompts. Davin may also assign work directly
to either executor, using any of the four [participation setups](../../agent-collaboration/README.md).

Do not permanently assign frontend to one model and backend to another.
Select by the current task, access and availability. For a P6/session B or
other independent sign-off, use a fresh reviewer context; a builder subagent
checking its own implementation is not that independent gate.

## Before editing: establish a task contract

Use the [task template](../templates/task.md) for a material task. Record:

- Task ID, user authorization/order and concrete done criteria.
- Implementer, reviewer, integrator and shared-state writer.
- Checkout/worktree, branch, base SHA and observed dirty target files.
- Exact allowed files or directory scopes; exclusions and freeze rules.
- Shared interfaces and generated outputs that must have one owner.
- Who may run build, generate clients, mutate tests or publish Git changes.

The task record is an **advisory ownership claim, not a filesystem lock**.
This system installs no mutex or ownership enforcement. Consult the relevant
Claude checklist/order and other accessible task records before claiming
paths. Unknown ownership on dirty or currently active paths requires a
handoff or scope separation; do not interpret silence as release.

## Concurrent work and shared resources

1. Default to one writing agent per checkout. Another agent can review it
   read-only after confirming the source is stable enough for that review.
   Use separate worktrees/branches for concurrent implementation. New branches
   use `codex/` unless Davin specifies otherwise.
2. Codex internal subagents may implement in one checkout only when the
   integrator assigns strictly disjoint files, including generated outputs,
   tests and metadata. Prefer read-only delegation when ownership is unclear.
   Follow the current host's delegation policy; Claude's own
   [subagent protocol](../../../.claude/protocols/subagent-orchestration.md)
   remains in effect for Claude.
3. Different worktrees do not share uncommitted files. Put the source worktree
   and absolute artifact path in a local handoff, or transfer a scoped patch
   or authorized commit. Git-tracked files become visible in another worktree
   only when explicitly transferred or integrated. A task file committed on
   one branch is not a global registry or a lock across branches/machines.
4. Changes to contracts, Prisma schemas/clients, generated API files, lockfiles,
   common types, flags and shared state have one owner. Agree the interface
   before splitting dependent implementation. Do not run generators over
   another owner's outputs.
5. A root `npm run build` runs `prebuild`, which deletes `.next`,
   `tsconfig.tsbuildinfo` and `node_modules/.prisma` and rebuilds shared types.
   Coordinate it with active dev servers, client generation and test processes.
   Do not run mutation tests against a checkout another agent is editing; use
   a scratch copy and verify restoration when appropriate.
6. Re-read source and `git diff` immediately before integration. If HEAD or
   the reviewed paths changed, invalidate the affected evidence and rerun the
   checks that depended on it. Do not discard findings by overwriting files.

## Review with evidence

- Name the base/head revision and exact paths read. With uncommitted work,
  capture the diff or SHA-256 of the reviewed files; HEAD alone is insufficient.
- Review behavior, contracts, security and acceptance criteria. Report
  actionable findings with severity, file/line, concrete failure and suggested
  correction. Separate verified defects from suspicions or unavailable checks.
- The reviewer creates a report and does not silently fix the implementation
  or rewrite builder state. Fixes return to the owner unless Davin assigns a
  new scope. Re-review affected findings after fixes.
- A review pass does not authorize production actions or replace a required
  owner sign-off. Never declare tests green solely from another agent's claim.

## Handoff and publication

Use a unique [handoff](../templates/handoff.md) under `docs/handoffs/`.
Before publishing the handoff, the sender stops writes to the scope and records
a stable revision/diff or file hashes. The receiver then verifies authorization,
source and open items, and acknowledges acceptance. Record that transfer before
the receiver starts writing. The sender remains stopped after transfer; if the
handoff is rejected, explicitly restore the prior owner before writes resume.

The integrator combines only scoped changes, verifies the combined state and
publishes shared status once. Preserve Claude's two-entry/archive rules when
updating its state. Use links to task reports rather than duplicating long logs.
For an ad-hoc read-only review, the standalone handoff can be the only change.

Local artifacts are the cooperation channel. Creating this system does not
send messages to another Codex chat, contact a person, launch Claude or dispatch
work automatically. External messages and cross-chat dispatch require Davin's
authorization under the active host's rules.
