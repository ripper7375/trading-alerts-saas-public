---
type: Concept/Index
status: active
updated_at: 2026-10-11
version: '1.0'
---

# Codex and Claude Code: design and user guides

This English documentation package explains how Davin, Antigravity, Claude Code
and Codex use the collaboration system established in this repository. It
contains the architecture, daily operating procedures and prompts needed to
start work, review it, split it safely or hand it to the other executor.

Repository: `D:\SaaS Project\trading-alerts-saas-public`
Package: `davintrade-claude-md-okf-management/codex/`

## Start here

1. For the system design, read the [Architecture Design](CODEX_CLAUDE_COLLABORATION_ARCHITECTURE_DESIGN.md).
2. For daily work, follow the [Operating Manual](OPERATING_MANUAL.md).
3. For an Advisor session, use the [Antigravity Guide](ANTIGRAVITY_ADVISOR_GUIDE.md),
   then copy the [Opening Prompt](OPENING_PROMPT_TO_ANTIGRAVITY.md).
4. For direct executor work or the next joint stage, use the
   [Prompt Library](PROMPT_LIBRARY.md). Replace placeholders with real details
   and the approval Davin has actually given.
5. For validation, stale instructions, conflicting ownership or unavailable
   access, use [Maintenance and Troubleshooting](MAINTENANCE_AND_TROUBLESHOOTING.md).

## Document map

| Document                                                                 | What it answers                                                                        | Primary reader               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------- |
| [Architecture Design](CODEX_CLAUDE_COLLABORATION_ARCHITECTURE_DESIGN.md) | Components, knowledge ownership, lifecycle, evidence, concurrency and design decisions | Davin and all agents         |
| [Operating Manual](OPERATING_MANUAL.md)                                  | How to start, execute, verify, review, integrate, resume and close work                | Davin, Claude Code and Codex |
| [Prompt Library](PROMPT_LIBRARY.md)                                      | What to send for each executor, mode and stage                                         | Davin and Antigravity        |
| [Antigravity Advisor Guide](ANTIGRAVITY_ADVISOR_GUIDE.md)                | How the Advisor learns rules, analyzes plans and prepares stage prompts                | Davin and Antigravity        |
| [Opening Prompt](OPENING_PROMPT_TO_ANTIGRAVITY.md)                       | The complete copyable onboarding instruction, plus a new-session reminder              | Davin and Antigravity        |
| [Maintenance and Troubleshooting](MAINTENANCE_AND_TROUBLESHOOTING.md)    | How to keep documents consistent and recover from coordination problems                | All agents                   |

## Four participation setups, three joint development modes

Davin can use Antigravity + Claude Code, Antigravity + Codex, Claude Code directly
or Codex directly. The Advisor is optional. Davin remains the policy owner and
decision maker in every setup.

When Claude Code and Codex share a task, choose build and review, parallel
development or handoff and takeover. Either executor can build or review;
roles depend on the assigned work. Investigation and design support these
modes. Working with one executor does not require a second executor.

## How this package relates to the running system

This directory is the design and user-guide layer. The operating contracts stay
in their existing locations:

| Concern                                         | Current operational source                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Codex entry point                               | [AGENTS.md](../../AGENTS.md)                                                                                   |
| Claude Code entry point                         | [CLAUDE.md](../../CLAUDE.md)                                                                                   |
| Shared standing rules                           | [non-negotiables](../../.claude/rules/non-negotiables.md)                                                      |
| Shared domain knowledge and project state       | [.claude catalog](../../.claude/index.md), canonical architecture / ADRs and live source                       |
| Codex lifecycle, collaboration and verification | [Codex operating catalog](../../docs/codex/index.md)                                                           |
| Cross-agent ownership and workflow              | [Shared guide](../../docs/agent-collaboration/README.md)                                                       |
| Advisor prompt contract                         | [Advisor protocol](../../docs/agent-collaboration/ADVISOR-PROTOCOL.md)                                         |
| Language preference                             | [Language policy](../../docs/agent-collaboration/LANGUAGE-POLICY.md)                                           |
| Task and handoff formats                        | [Task template](../../docs/codex/templates/task.md), [handoff template](../../docs/codex/templates/handoff.md) |

Read current operational sources when using a guide. Examples explain those
contracts; they do not grant approval, amend governance or record project status.
Host/system instructions and Davin's authorized scope still apply. If a guide
conflicts with an operational rule or verified live source, report the conflict
and follow the applicable authority; update the guide within its owner's scope.

The two original [OKF architecture](../OKF_CLAUDE_MD_ARCHITECTURE_DESIGN.md) and
[model-adaptation design](../OKF_OPUS_5_5_FINE_TUNING_ARCHITECTURE.md) documents
explain the design background. They contain proposals and historical estimates;
inspect live files to establish which parts exist. The current architecture in
this package describes the implemented collaboration documents and their limits.

## Language and access

Write durable agent documents and prompts in English by default. Conversation
also defaults to English; when Davin writes Thai in a session, use Thai replies
there unless he gives a different explicit language instruction. Thai chat alone
does not request Thai artifacts. The shared language policy contains the full rule.

These files require actual reading. A filename or local path alone does not give
an external app filesystem access. If an agent cannot access the repository,
Davin supplies current contents; the agent reports what it actually received
and what it could not verify. Cross-agent chat context is not assumed to be shared.

## Validation and current limits

From the repository root, run the document gate when changing this package:

```powershell
node scripts/agents/check-operating-docs.mjs
```

Use the maintenance guide for scoped formatting and validator tests. The gate
checks selected documents, local links and router budgets. It does not enforce
ownership, grant approval or prove that another app loaded instructions.

The system uses durable files and explicit coordination. There is no automatic
cross-agent dispatcher, global task lock or daemon in this installation. New
Claude/Antigravity sessions and actual mixed-agent execution require their own
access and evidence checks. No performance or token-saving guarantee is made.
