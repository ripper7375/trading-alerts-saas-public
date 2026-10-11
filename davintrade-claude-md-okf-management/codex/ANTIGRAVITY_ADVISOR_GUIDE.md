---
type: Concept/Guide
status: active
updated_at: 2026-10-11
version: '1.0'
---

# Antigravity Advisor user guide

Use Antigravity to analyze Davin's plans and prepare task prompts for Claude
Code or Codex. Davin sets policy, proposes plans, chooses scope, decides and
approves. The Advisor gives technical recommendations; the selected executor
checks live evidence and performs authorized work.

The binding Advisor workflow is the current
[Advisor protocol](../../docs/agent-collaboration/ADVISOR-PROTOCOL.md). This guide
explains how to apply it. Antigravity is optional; direct executor work uses the
[Operating Manual](OPERATING_MANUAL.md) and [Prompt Library](PROMPT_LIBRARY.md).

## 1. Give the Advisor real access to the rules

Open the repository in Antigravity's workspace if that session supports local
file access. Otherwise supply the current contents of the listed documents.
The path `D:\SaaS Project\trading-alerts-saas-public` identifies the repository;
it does not give the Advisor access to Davin's disk.

Copy the full [Opening Prompt](OPENING_PROMPT_TO_ANTIGRAVITY.md). It loads the
rules and asks for a short understanding report before any task-specific prompt
is prepared. The opening instruction alone authorizes no code editing or dispatch.

| Read                                                                                                                                | Purpose                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [This package index](README.md)                                                                                                     | Find design, manuals and stage examples                            |
| [Shared guide](../../docs/agent-collaboration/README.md) and [Advisor protocol](../../docs/agent-collaboration/ADVISOR-PROTOCOL.md) | Current roles, modes and prompt contract                           |
| [Shared standing rules](../../.claude/rules/non-negotiables.md)                                                                     | Approval, scope, evidence and explicit sign-off gates              |
| [Language policy](../../docs/agent-collaboration/LANGUAGE-POLICY.md)                                                                | English artifacts and session-specific conversation                |
| [CLAUDE.md](../../CLAUDE.md) or [AGENTS.md](../../AGENTS.md)                                                                        | Receiving executor's route and restrictions; both for a joint task |
| Relevant task/order, handoff and domain rules                                                                                       | Current scope, entry conditions, evidence and outstanding work     |

Read the architecture for initial orientation or a design question. For each
actual task, load current operational rules and only the relevant domain files.
Do not send the entire knowledge tree into every prompt. Task-specific reads
include relevant sections of project state and blockers, canonical architecture
and ADRs. Live source wins when a plan's factual assumptions have been disproved.

## 2. Check the understanding report

The Advisor should return:

- Files actually read, access limitations and any supplied-content date/version.
- Davin's decision authority, Advisor recommendations and executor responsibilities.
- Four available participation setups and three joint development modes.
- Numbered APPROVED -> CONFIRMED checks, direct ad-hoc authorization and separate
  explicit sign-off requirements.
- Path/resource ownership, stable source evidence and sender-freeze/transfer order.
- Language behavior and the distinction between documents and automatic loading.

If it claims memory or file access without evidence, correct that assumption and
supply the missing current contents. If the rules differ from an older session,
use current sources rather than repeating the older prompt. This report is an
access/understanding check, not production or implementation approval.

## 3. Provide Davin's plan and decisions

Supply the actual goal, allowed/excluded scope, desired result and known
constraints. Identify decisions already approved and proposals that remain open.
Provide an existing task/order and handoff path when continuing work. Do not
invent a numbered order for a direct ad-hoc task.

A concise planning request:

```text
Use repository D:\SaaS Project\trading-alerts-saas-public and the current
ADVISOR-PROTOCOL.md and LANGUAGE-POLICY.md under docs/agent-collaboration/.
My goal: <concrete result>.
My authorized scope: <actual instruction or approved order; exact paths>.
Excluded scope: <paths and actions>.
Decisions already made: <decision references and answers>.
Proposals still open: <questions requiring my decision>.
Current evidence: <task/order, stable handoff, branch/revision or entry checks>.

Recommend a participation setup and, if both executors share work, a development
mode. Explain dependencies and name proposed owners. Separate your proposals,
my decisions and verified facts. Draft only the current executable stage within
already-authorized scope. Label unresolved later stages DRAFT/conditional.
Use English for the prompt. Routine implementation choices within authorized
scope stay with the executor unless an applicable owner gate requires otherwise.
```

Replace every placeholder before treating this as a task assignment. A field
called authorization documents Davin's actual instruction; it does not grant it.
The Advisor can help clarify a missing scope while useful investigation proceeds
within whatever scope is already authorized.

## 4. Choose participants and a development mode

| Participation setup       | Advisor's part                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| Antigravity + Claude Code | Draft Claude's current-stage prompt and interpret its returned evidence |
| Antigravity + Codex       | Draft Codex's current-stage prompt and interpret its returned evidence  |
| Claude Code directly      | No Advisor required; Davin assigns and decides with Claude              |
| Codex directly            | No Advisor required; Davin assigns and decides with Codex               |

Davin can switch setups between stages. When both executors participate, select:

| Joint mode           | Use when                                                        | Stage sequence                                                                                      |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Build and review     | One writable scope benefits from independent checking           | Builder -> stable handoff -> reviewer -> fixes -> recheck                                           |
| Parallel development | Work can be divided into disjoint scopes with agreed interfaces | Interface agreement -> A and B -> one integrator -> combined verification                           |
| Handoff and takeover | The other executor should resume unfinished work                | Sender stops -> stable handoff -> receiver verifies/accepts -> recorded transfer -> receiver writes |

Choose roles by the task and available access. Neither model owns the frontend
or backend permanently. A required P6/session B check uses a fresh independent
reviewer context; a builder's helper cannot substitute for that gate.

## 5. Draft a complete current-stage prompt

Use the [Prompt Library](PROMPT_LIBRARY.md) and current
[task](../../docs/codex/templates/task.md) / [handoff](../../docs/codex/templates/handoff.md)
templates. Fill these items for every stage:

| Contract item   | What to put in the prompt                                                          |
| --------------- | ---------------------------------------------------------------------------------- |
| Task and stage  | ID/order, goal, mode, current stage and concrete done criteria                     |
| Authorization   | Exact scope already authorized; unapproved proposals clearly labeled               |
| Participants    | Implementer/reviewer, one integrator, state writer and resource owners             |
| Source          | Absolute checkout/worktree, actual branch, SHA and stable diff/hashes where needed |
| Boundaries      | Allowed/excluded writes, generated artifacts and frozen paths                      |
| Dependencies    | Interface versions, outputs to obtain, entry checks and stop conditions            |
| Verification    | Required relevant checks and reporting of command/cwd/exit/pass/fail/skip          |
| Return artifact | Unique handoff/report path, open items and next owner                              |
| Publication     | Actual commit/push/deploy authorization, separate from development permission      |

For Codex, require `AGENTS.md` and explicit reading of shared non-negotiables.
For Claude, require `CLAUDE.md` and relevant routed rules. Joint work also reads
the shared collaboration guide. Missing worktree/runtime details become entry
checks to verify and record; do not fill them with assumed facts.

Numbered migration prompts preserve APPROVED by Davin -> CONFIRMED by the
executor after live source/runtime checks. Direct ad-hoc instructions authorize
their stated scope without duplicate approval. An item requiring explicit
sign-off remains separate from general task approval.

## 6. Return executor evidence before preparing the next stage

Davin forwards the prompt, receives the executor's handoff and returns that
artifact to Antigravity. The Advisor checks the actual content and freshness.

```text
Read <absolute handoff/report path> and the relevant task/order.
Separate verified delivery, failed/skipped/unavailable checks, unresolved
findings, ownership and decisions I still need to make.
Check whether the branch/revision/diff or file hashes still identify current
source. If you cannot access source/runtime, state that limitation and require
the next executor to perform the relevant live entry checks.
Draft the next-stage English prompt only after its dependencies are available.
Future stages with open gates remain DRAFT/conditional.
```

A report of passing tests is evidence about a particular source and environment.
It does not authorize deployment or prove production health. HEAD alone does not
identify uncommitted changes. For parallel work, both scopes' outputs must reach
the integrator explicitly; other worktrees do not continuously synchronize them.

Use a short next-stage response format:

```text
Evidence read: <actual files and source snapshot>
Delivered: <verified behavior and scope>
Limits/open items: <failed, skipped, unavailable or unresolved evidence>
Davin decisions needed: <exact decisions, or none>
Current owner and next stage: <owner, gate and scope>
Current-stage prompt: <fully populated English prompt>
```

An Advisor can recommend a correction. The implementation owner makes fixes;
a read-only reviewer writes findings and its own report. If ownership changes,
the sender stops first and the transfer is recorded before the receiver writes.

## 7. Reuse the workflow in later sessions

Keep rules and task evidence on disk. A new Advisor session reads the protocol,
shared rules and current task/handoff again. Use the shorter reminder in the
opening-prompt document only when all required files are accessible. If an app
supports a workspace instruction feature already used by Davin, a short pointer
can route it to these files; verify an actual new session before relying on it.
This package does not configure Antigravity settings or promise persistent memory.

Durable documents and copyable prompts default to English. Thai messages from
Davin select Thai conversational replies in that session, unless explicitly
overridden; they do not by themselves change artifact language.

For problems or rule updates, follow
[Maintenance and Troubleshooting](MAINTENANCE_AND_TROUBLESHOOTING.md). The Advisor
may also read a handoff from direct executor work when Davin later engages it;
no prior Advisor participation is required.
