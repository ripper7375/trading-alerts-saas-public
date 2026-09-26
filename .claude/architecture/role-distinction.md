---
type: Concept/Roles
authority: binding
source: 'CLAUDE.md header (pre-OKF L1-L12), verbatim'
tags: [roles, governance, antigravity, executor]
related_docs:
  - ../rules/non-negotiables.md
  - ../protocols/session-lifecycle.md
---

# Role distinction (three-role Development Chain Protocol)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

The third role is **Davin** (owner): approves orders (`APPROVED`), signs off items marked
`⚠ NEEDS EXPLICIT SIGN-OFF`, applies production migrations, and performs any step that needs
credentials, MetaEditor, or dashboard access.

**Ad-hoc sessions** (direct chat instructions outside the playbook numbering) follow the same
open/close rituals; label them "phase/session unchanged" (`EXECUTOR-PROTOCOL.md` §6).
