---
type: Concept/Task
status: completed
updated_at: 2026-10-11
task_id: 2026-10-11-codex-collaboration-system
owner: Codex
integrator: Codex
reviewer: Codex independent review agent
shared_state_writer: handoff-only; Claude project state not claimed
approval: direct instruction from Davin in this chat
order_mode: ad-hoc; phase/session unchanged
base_commit: 81dd9b01
---

# Establish Codex collaboration with Claude Code

## Authorization and scope

Davin asked Codex to study the two OKF designs and create its own system for
collaborating with Claude Code on this repository. The direct request approves
this ad-hoc operating-documentation and local-validator task. Scope was confirmed
against the live routers, rules and working tree. Checkout:
`D:/SaaS Project/trading-alerts-saas-public`, branch `main` at the recorded base.

- Codex owns `AGENTS.md`, `docs/codex/**`, `docs/agent-collaboration/**`, the new
  collaboration handoff and `scripts/agents/check-operating-docs*`.
- Shared routing edits: a link in `CLAUDE.md` and catalog row in `.claude/index.md`.
- Checker subagent owns only the two validator files; reviewers are read-only.
- Existing modified gotchas, workflow and glossary test, mobile and MT5
  moves/deletions and other untracked work are excluded and preserved.
- No runtime feature, numbered migration, Git publication or deployment scope.

## Done when

- [x] Read both requested designs and compare the live Claude implementation.
- [x] Check Codex instruction discovery against official OpenAI documentation.
- [x] Create router and protocols reusing canonical domain knowledge.
- [x] Define task ownership, review, worktree and handoff contracts.
- [x] Add the minimal Claude collaboration bridge and catalog entry.
- [x] Run validator tests, document checks and independent consistency review.
- [x] Publish final handoff and compact Codex continuity pointer.

## Decisions and deviations

- A real `AGENTS.md` handles Codex loading; no symlink or duplicated domain tree.
- Durable per-task checklists preserve compaction continuity and Claude ownership.
- Shared state is large; use relevant sections, without pruning another owner.
- Claims are advisory; no automatic lock, hook, daemon or agent dispatch.
- `.codex/` write protection led to using the ordinary `docs/codex/` folder.
  No Codex application configuration or new skill is required.
- Application test counts are historical. The local validator is the only
  executable change; it receives unit tests and real document validation.

## Verification and continuation

Complete: validator tests 8/8, 11 operating documents pass, targeted Prettier
and git whitespace checks pass. Independent review P2 fixed and rechecked;
no findings remain. Full evidence: [handoff](../../handoffs/2026-10-11-codex-collaboration-system.md).
No open checklist items. Next work requires its own assignment and task scope.
