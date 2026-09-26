# CLAUDE.md — Executor lean router (Migration Mode)

> **Roles:** Antigravity (chat UI) = Advisor & Architect · Claude Code (terminal) = Executor ·
> Davin = owner/approver. Details: [role-distinction](.claude/architecture/role-distinction.md).
> Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md`.

## 1. Load knowledge on demand (read this first)

**Do NOT read the whole `.claude/` tree at session start.** This router plus
`.claude/rules/non-negotiables.md` (auto-loaded) is your standing context.

1. At session start read **only** [.claude/state/current-state.md](.claude/state/current-state.md).
2. Read other files **only when the task touches their domain** — use the matrix in §3.
3. Before re-investigating a bug or decision, Grep [.claude/state/history/](.claude/state/history/index.md);
   it is probably already written up.

## 2. State and session close

- **Now:** [current-state.md](.claude/state/current-state.md) — last numbered session 14-3 (Phase 14
  complete); recent work is ad-hoc. Next numbered: Phase 12 / Session 12-0.
- **Blockers & unverified items:** [waiting-on.md](.claude/state/waiting-on.md).
- **Session close:** follow [session-lifecycle.md](.claude/protocols/session-lifecycle.md) — new entry
  at the top of `current-state.md`, max 2 entries, rotate the oldest to `history/`.
  **NEVER write session narratives, logs or blockers into this file.**

## 3. Navigation matrix (task trigger → file)

- **Any task (binding, auto-loaded):** [rules/non-negotiables.md](.claude/rules/non-negotiables.md) —
  CONFIRMED orders only, one verifiable unit, artifacts, scope, escalate money/auth, verify, live code wins.
- **`package.json` / dependencies:** [rules/security-overrides.md](.claude/rules/security-overrides.md)
- **UI, text, prices, dates:** [rules/i18n-compliance.md](.claude/rules/i18n-compliance.md)
- **Schema, migrations, DB queries:** [architecture/database-traps.md](.claude/architecture/database-traps.md)
- **Deploys, VPS, Stack C, R2:** [architecture/infrastructure.md](.claude/architecture/infrastructure.md)
- **Numbered migration session, scope:** [architecture/microservices-cutover.md](.claude/architecture/microservices-cutover.md)
- **Tooling misbehaves (git, Jest, dev server):** [architecture/environment-gotchas.md](.claude/architecture/environment-gotchas.md)
- **Before declaring done:** [protocols/verification-checklist.md](.claude/protocols/verification-checklist.md)
- **Past sessions, old decisions:** [state/history/index.md](.claude/state/history/index.md)
- **Full catalog:** [.claude/index.md](.claude/index.md)

## 4. Verification commands (monolith)

- Types: `npx tsc --noEmit` · Lint: `npm run lint` · Tests: `npm run test:ci` · Build: `npm run build`
- NestJS services and Stack C have their own commands: see the verification checklist.

## 5. Always true

- The Executor never enters login credentials, never applies production migrations, and commits
  or pushes only when Davin asks.
- `seed-code/**` is read-only. Money, auth, secrets and CORS changes escalate to Davin.
- This checkout is Windows + CRLF; never use `git stash` (see environment gotchas).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
