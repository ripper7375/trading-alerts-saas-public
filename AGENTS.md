# Codex repository router

Codex collaborates with Claude Code on Davin's assigned tasks. Davin approves
owner decisions; Antigravity remains the Advisor. Use one canonical knowledge
tree, `.claude/`, and live source. Codex operating details are in
[docs/codex](docs/codex/index.md); the shared
[collaboration guide](docs/agent-collaboration/README.md) applies when agents share work.

## Language

Use English for agent-facing documents, tasks, handoffs and prompts by default.
Reply in English normally; use Thai conversational replies when Davin writes
Thai in that session. Thai chat keeps artifacts in English unless requested
otherwise. Follow the shared [language policy](docs/agent-collaboration/LANGUAGE-POLICY.md).

## Start and scope

- Explicitly read [.claude/rules/non-negotiables.md](.claude/rules/non-negotiables.md).
  Codex does not inherit Claude's automatic rule loading. Follow relevant nested
  `AGENTS.md`/`AGENTS.override.md` before editing those paths.
- Inspect branch, HEAD and working-tree changes. Preserve others' edits,
  untracked files and deletions. Never use `git stash` or broad reset/restore/clean.
- Read the frontmatter and task-relevant sections of
  [shared state](.claude/state/current-state.md), plus relevant orders/handoffs
  and [Codex continuity](docs/codex/state/current-state.md). Search headings and
  use bounded reads; do not load all history or the whole knowledge tree.
- Numbered migrations follow [EXECUTOR-PROTOCOL](docs/migration-orders/EXECUTOR-PROTOCOL.md)
  and APPROVED -> CONFIRMED after live entry checks. For ad-hoc work, Davin's
  direct instruction authorizes its explicit scope; record it and confirm
  relevant source. Do not demand another approval already given.
- For 3+ steps or cross-agent work, create a unique durable task record using
  [this template](docs/codex/templates/task.md). Resume only your assigned work.
  Never overwrite or delete Claude's `.claude/state/active-tasks.md`.

## Route by task

- **Open/resume/close:** [Codex lifecycle](docs/codex/protocols/session-lifecycle.md).
- **Shared work/review/handoff:** [Collaboration](docs/codex/protocols/collaboration.md).
- **Dependencies:** [Security overrides](.claude/rules/security-overrides.md).
- **UI/locales/money/date display:** [i18n rules](.claude/rules/i18n-compliance.md).
- **DB/schema/migrations:** [DB traps](.claude/architecture/database-traps.md) and [blockers](.claude/state/waiting-on.md).
- **Deploy/VPS/Stack C/R2:** [Infrastructure](.claude/architecture/infrastructure.md) and blockers.
- **Numbered migration/scope:** [Cutover routing](.claude/architecture/microservices-cutover.md).
- **Stack D/MCDs:** [Canonical architecture](docs/STACK-D-ARCHITECTURE.md), [ADRs](docs/adr/README.md), [MCD standard](docs/MCD-DEVELOPMENT-STANDARD.md).
- **Tooling surprises:** [Environment gotchas](.claude/architecture/environment-gotchas.md).
- **Before done:** [Codex verification](docs/codex/protocols/verification.md) and [shared checks](.claude/protocols/verification-checklist.md).
- **Prior incident/decision:** Search [history](.claude/state/history/index.md) before re-investigating.

## Working together and finishing

- One owner per writable scope; one integrator for shared contracts/state.
  Concurrent Claude/Codex implementation uses separate worktrees. Read-only
  review may share a stable checkout. Internal Codex subagents may write only
  explicitly disjoint files under one integrator and the current host policy.
- Task records are advisory, not locks. Uncommitted work does not appear in
  another worktree automatically. Coordinate build/client generation and
  mutation tests before touching shared generated resources.
- Continue authorized, unblocked checklist items after progress updates or
  compaction. Settled decisions reopen only on user steering or new evidence.
- `seed-code/**` is read-only. Respect frozen/out-of-scope code. Out-of-scope
  money, auth, grants, secrets or CORS changes require Davin's decision; an
  explicit sign-off gate is not satisfied by general task approval.
- Never enter login credentials or apply production migrations. Commit/push
  only when Davin asks; merge/deploy/flag actions need their applicable approval.
- Verify the affected scope and report exit codes and skipped/unavailable
  checks. UI changes need browser evidence. Root tsc does not type-check tests.
- Write a unique [handoff](docs/codex/templates/handoff.md). Only the named
  shared-state writer updates/rotates Claude state; other agents publish their
  report for that owner. Keep session narratives out of both root routers.
- For operating-doc changes run `node scripts/agents/check-operating-docs.mjs`.
  Keep this file <=6,000 bytes / 150 lines. Read installed Next.js guides under
  `node_modules/next/dist/docs/` before changing Next.js code, as required by
  the [Claude router](CLAUDE.md).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
