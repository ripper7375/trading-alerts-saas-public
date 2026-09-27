---
type: Concept/Index
status: active
updated_at: 2026-09-27
format: 'Open Knowledge Format (OKF): one concept per file, YAML frontmatter, relative Markdown links'
tags: [index, catalog]
---

# `.claude/` knowledge tree — catalog

Entry point: root `CLAUDE.md` (the lean router). Load files **on demand**; do not read the whole
tree. Files in `rules/` are loaded by Claude Code itself (`non-negotiables.md` always; the others
only when matching files are read, via their `paths:` frontmatter). Nothing else here loads
automatically.

| File                                                                             | Concept                                           | Read when                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| [state/current-state.md](./state/current-state.md)                               | Latest ≤ 2 sessions, playbook position            | Every session start                                   |
| [state/waiting-on.md](./state/waiting-on.md)                                     | Open blockers, unverified items, pending deploys  | Deploys, migrations, auth, VPS, "what's outstanding?" |
| [state/history/index.md](./state/history/index.md)                               | Catalog of every archived session entry           | Before re-investigating any past bug or decision      |
| [state/history/2026-09-sessions.md](./state/history/2026-09-sessions.md)         | September 2026 session narratives (verbatim)      | Via the history index / Grep                          |
| [state/history/2026-08-sessions.md](./state/history/2026-08-sessions.md)         | August 2026 sessions + Session 14-3/14-2          | Via the history index / Grep                          |
| [state/history/resolved-waiting-on.md](./state/history/resolved-waiting-on.md)   | Resolved blockers (verbatim)                      | When an old blocker resurfaces                        |
| `state/active-tasks.md` (gitignored, exists only mid-task)                       | Live checklist of an in-flight multi-step task    | Session start if present; tasks with 3+ steps         |
| [rules/non-negotiables.md](./rules/non-negotiables.md)                           | The 8 binding executor rules                      | Always (auto-loaded)                                  |
| [rules/security-overrides.md](./rules/security-overrides.md)                     | `package.json` overrides policy                   | Dependency changes (auto-loaded on package files)     |
| [rules/i18n-compliance.md](./rules/i18n-compliance.md)                           | Locale / translation / currency rules             | UI work (auto-loaded on `app/`, `components/` `.tsx`) |
| [architecture/role-distinction.md](./architecture/role-distinction.md)           | Advisor vs Executor vs Davin                      | Unsure who decides                                    |
| [architecture/database-traps.md](./architecture/database-traps.md)               | Which DB is which, Prisma layout, migration traps | Any schema/migration/DB task                          |
| [architecture/infrastructure.md](./architecture/infrastructure.md)               | Deploy topology, Vultr VPS, Railway, R2 facts     | Deploys, VPS, Stack C, chart renders                  |
| [architecture/microservices-cutover.md](./architecture/microservices-cutover.md) | Key migration docs, roadmap position, scope       | Numbered migration sessions, scope questions          |
| [architecture/environment-gotchas.md](./architecture/environment-gotchas.md)     | Windows/git/Jest/browser traps                    | Tooling misbehaves; before mutation tests             |
| [protocols/session-lifecycle.md](./protocols/session-lifecycle.md)               | Session open/track/close, action-first entries    | Session start, 3+ step tasks, session close           |
| [protocols/subagent-orchestration.md](./protocols/subagent-orchestration.md)     | Partitioning, scoping, aggregating subagents      | Only when Davin asks for parallel subagents           |
| [protocols/verification-checklist.md](./protocols/verification-checklist.md)     | Commands and baselines per project                | Before declaring done                                 |

Pre-OKF snapshot of `CLAUDE.md`: git history before the OKF refactor commit (sha256 of the file
`ad804d401c5250f8d1a48f55c517e7fe20983d2a975bbc63e94b4e480c68a1ef`, 480,403 bytes, 5,376 lines).
