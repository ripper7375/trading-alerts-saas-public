---
type: Concept/Index
status: active
updated_at: 2026-10-11
---

# Codex operating knowledge

Entry point: [AGENTS.md](../../AGENTS.md). Read this catalog only when a task
needs a protocol. The shared domain catalog is [.claude/index.md](../../.claude/index.md).

| Trigger                                            | Read                                                    | Purpose                                             |
| -------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| New task, resume, context compaction, close        | [Session lifecycle](protocols/session-lifecycle.md)     | Authorization, durable task checklist, continuity   |
| Claude and Codex share work; independent review    | [Collaboration](protocols/collaboration.md)             | Owners, worktrees, integration and review evidence  |
| Choose or report checks                            | [Verification](protocols/verification.md)               | Current commands, prerequisites and check scope     |
| Create a task with 3+ steps                        | [Task template](templates/task.md)                      | Scope, acceptance criteria, checklist, continuation |
| Send a durable result to another agent             | [Handoff template](templates/handoff.md)                | Exact revision, files, findings and verification    |
| Find the latest Codex handoff                      | [Codex continuity pointer](state/current-state.md)      | Agent state only; project status stays shared       |
| Human setup, architecture and ready-to-use prompts | [Collaboration guide](../agent-collaboration/README.md) | English guide for Davin and both coding agents      |

Antigravity's stage prompts follow the shared
[Advisor protocol](../agent-collaboration/ADVISOR-PROTOCOL.md). Davin can start
an Advisor session with the [opening prompt](../agent-collaboration/OPENING-PROMPT-TO-ANTIGRAVITY.md).

All agents use the shared [language policy](../agent-collaboration/LANGUAGE-POLICY.md):
English artifacts and prompts, with session-specific conversational language.

For the full architecture and usage manuals, start with the
[design and user-guide package](../../davintrade-claude-md-okf-management/codex/README.md).
It includes the Antigravity opening prompt and stage-prompt library.

## Knowledge ownership

- Business rules, schemas, deployments and project status remain in `.claude/`,
  canonical `docs/` architecture, ADRs and live source. Link rather than copy.
- `docs/codex/tasks/` contains one durable record per Codex task; it is not a
  second project changelog. Completed records remain available for handoff.
- `docs/codex/state/current-state.md` is a compact pointer, at most 6,000 bytes
  and 100 lines. It never claims that a reviewed task is deployed.
- This directory contains Markdown operating knowledge. Codex does not
  auto-load it; `AGENTS.md` explicitly routes to relevant files.

## Maintenance

Run `node scripts/agents/check-operating-docs.mjs` from the repository root
when changing these routers or protocols. It validates the scoped document
structure, budgets and local links; it does not enforce task ownership or
run application tests. Keep each protocol below 16,000 bytes. Archive detail
into a task or handoff before enlarging a router.
