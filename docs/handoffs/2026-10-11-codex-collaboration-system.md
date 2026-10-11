# Handoff: Codex collaboration system

Date: 2026-10-11, Asia/Bangkok
From: Codex; readers: Davin and Claude Code
Task: [operating-system task](../codex/tasks/2026-10-11-codex-collaboration-system.md)
Authorization: Davin's direct instruction in this chat; ad-hoc, phase/session unchanged.
Source checkout: `D:/SaaS Project/trading-alerts-saas-public`, branch `main`.
Base/final HEAD: `81dd9b01561f5fc527a1073a47a607fbd07bb606` (unchanged).
Status: completed; files are local and uncommitted.

Historical record: the checks, sizes, revisions and hashes below describe the
original installation before the English-language update. The current English
editions and language policy are documented in the
[translation handoff](2026-10-11-english-agent-workflow.md).

## Needs from Davin

None for this installation. Davin can assign the next implementation or review
using the [shared guide](../agent-collaboration/README.md). No task has been
dispatched to another chat or Claude process automatically.

## Changed and verified

Codex now has a lean repository router, explicit shared-rule loading, durable
per-task continuity and operating protocols that cooperate with Claude's OKF
knowledge tree. The system defines path ownership, independent review, one
integrator, resource coordination and a handoff that freezes the sender before
the receiver starts writing.

Created 13 files:

- `AGENTS.md`: Codex entry point and task routing.
- `docs/codex/index.md`: Codex operating catalog.
- `docs/codex/protocols/session-lifecycle.md`: authorization, tracking, resume and close.
- `docs/codex/protocols/collaboration.md`: ownership, review, worktrees and integration.
- `docs/codex/protocols/verification.md`: change-based checks and current coverage limits.
- `docs/codex/state/current-state.md`: compact Codex continuity pointer.
- `docs/codex/templates/task.md` and `docs/codex/templates/handoff.md`: reusable contracts.
- `docs/codex/tasks/2026-10-11-codex-collaboration-system.md`: this completed task.
- `docs/agent-collaboration/README.md`: architecture/setup guide and example prompts, initially in Thai.
- `scripts/agents/check-operating-docs.mjs` and its `.test.mjs`: read-only validator and tests.
- This handoff.

Modified two existing files: one shared-protocol link in `CLAUDE.md`; one catalog
row and update date in `.claude/index.md`. No canonical rule, project-state,
blocker/history, runtime feature, package manifest, CI or hook was changed by this task.

| Check                                                            | Cwd             | Exit | Result                                                         |
| ---------------------------------------------------------------- | --------------- | ---- | -------------------------------------------------------------- |
| `node --test scripts/agents/check-operating-docs.test.mjs`       | Repository root | 0    | 8 passed, 0 failed, 0 skipped                                  |
| `node scripts/agents/check-operating-docs.mjs`                   | Repository root | 0    | 11 operating documents; budgets, metadata and local links pass |
| `node ../../scripts/agents/check-operating-docs.mjs`             | `docs/codex/`   | 0    | Same result; CLI resolves root independently of cwd            |
| Local Prettier `--check --end-of-line auto` on the 15 task files | Repository root | 0    | All selected files formatted                                   |
| `git diff --check`                                               | Repository root | 0    | No whitespace errors                                           |
| Independent operating-document consistency review and P2 recheck | Source checkout | n/a  | No unresolved findings                                         |

The eight validator tests cover valid documents and read-only behavior; missing
or unreadable files; UTF-8 byte and line boundaries; relative/reference links;
code/external-link exclusion; metadata; and invalid paths/shared-routing gates.
The validator does not mutate source, install dependencies or use the network.

Measured after formatting: `AGENTS.md` 4,543 bytes; `CLAUDE.md` 4,820 bytes;
Codex continuity pointer 1,072 bytes. Root router and state size gates pass.

## Independent review

One P2 finding was fixed: earlier wording allowed the receiver to accept work
before the sender stopped writing. Both guides now require sender freeze,
stable snapshot, receiver acknowledgment and recorded transfer before new writes.
The reviewer rechecked the fix and reported no remaining findings in scope.
This is an operating-document consistency review, not a product P6 sign-off.

Reviewed protocol SHA-256:
`43b6924f5666172f4ca2e81deca9d0530b5747e8c6d7703751637f38b076f281`.
Reviewed original Thai guide SHA-256 (before translation):
`59e798aa21dd8b6c082dba8197e993884f7352afb0c53df98332595c86ad5515`.
Those hashes identify the stable reviewed content; the new task/handoff closeout
metadata was finalized afterwards.

## Unconfirmed / found

- The two supplied designs are proposals; live Claude rules were used when
  examples differed. No model latency, token-use or success-rate claim was tested.
- Shared Claude project state is large despite the two-session limit. It was
  preserved; Codex reads relevant sections and records short continuity pointers.
- Existing modified gotchas, workflow and glossary test, mobile/MT5 moves and
  other untracked work were preserved. Comparing status with the captured
  baseline showed only the scoped additions/routing changes and no removed
  baseline status entries. HEAD remained unchanged.
- `.codex/` is write-protected in this workspace; ordinary `docs/codex/` holds
  knowledge instead. No Codex application configuration or skill was installed.
- This is an advisory protocol with a manually invoked document gate. It has no
  automatic mutex, CI integration, daemon or cross-worktree task registry.
- New-session instruction loading and live Claude/Codex cooperation have not
  been exercised end-to-end. The active Codex session inspected and applied the
  repository documents manually. Application tests/build were not run because
  no application behavior changed; the executable validator was unit-tested.
- No commit, push, migration, deployment, flag change or credential entry occurred.

## Next action and ownership

The installation is complete. Both agents can use the shared guide and task/
handoff templates on the next assigned job. For independent review, give the
reviewer the exact stable source revision or uncommitted diff/file hashes and
a readable absolute handoff path. Separate worktrees need explicit artifact
or patch transfer; they do not share uncommitted files automatically.

Codex owns its task record and continuity pointer. Claude's canonical project
state was not claimed or rewritten by this installation; no project status
transition or state-publication step remains pending for this setup task.
