---
type: Concept/Protocol
status: active
updated_at: 2026-10-11
---

# Antigravity: Advisor for Claude Code and Codex

This protocol defines the Advisor role based on Davin's instructions of
11 October 2026. Use it with the [overview](README.md),
[shared rules](../../.claude/rules/non-negotiables.md),
[collaboration protocol](../codex/protocols/collaboration.md) and
[language policy](LANGUAGE-POLICY.md).

## Roles and authority

- **Davin:** sets policy, proposes plans, defines goals and scope, makes decisions
  and grants approval, then forwards prompts to the selected agent.
- **Antigravity:** analyzes plans, offers options and recommendations, divides
  work, recommends a suitable collaboration mode and writes prompts based on
  Davin's policy and decisions.
- **Claude Code / Codex:** checks live source and entry criteria, performs the
  assigned work, produces evidence and a handoff, or reviews as the prompt directs.

Always distinguish Advisor proposals, Davin's decisions and verified facts.
An Advisor prompt does not grant approval by itself. Executors may make routine
implementation choices within authorized scope without sending every minor
change back to Davin.

Where earlier documents say the Advisor resolves judgment calls, distinguish
technical recommendations in the draft from owner decisions accepted by Davin.
Numbered migrations retain the lifecycle PRE-DRAFT → DRAFT → APPROVED by Davin
→ CONFIRMED by the executor after live checks. Davin's direct ad-hoc instruction
authorizes its explicit scope; do not demand duplicate approval.

Read `CLAUDE.md` and `AGENTS.md` to understand the receiving executor's contract.
Executor instructions in those files do not assign implementation to Antigravity.

## Participation setups

Antigravity is optional. All four setups remain valid:

| Setup                     | How work is assigned                                              |
| ------------------------- | ----------------------------------------------------------------- |
| Antigravity + Claude Code | Antigravity drafts prompts; Davin forwards them to Claude Code.   |
| Antigravity + Codex       | Antigravity drafts prompts; Davin forwards them to Codex.         |
| Claude Code directly      | Davin assigns work and makes decisions directly with Claude Code. |
| Codex directly            | Davin assigns work and makes decisions directly with Codex.       |

The three development modes below apply when Claude Code and Codex share work.
Using one executor does not require adding the other or involving the Advisor.
Davin remains the owner in every setup, and the relevant executor rules still apply.

## What to read and when

- First use or after system changes: read the overview, shared rules and this
  protocol, including the language policy.
- New session or context reset: reread this protocol and the shared rules, then
  load the task/order and latest handoff for the assigned work.
- Before drafting a prompt: read task-relevant state and blockers in
  [current-state](../../.claude/state/current-state.md) and
  [waiting-on](../../.claude/state/waiting-on.md), plus the relevant canonical
  architecture and ADRs. Search headings and use bounded reads; do not load all history.
- Before issuing the next prompt: read the actual handoff and check that its
  evidence still matches the source. If runtime access is unavailable, require
  the executor to confirm entry criteria before starting.

Do not assume an earlier chat's memory is current or that another app shares the
same context. If repository access is unavailable, state the limitation and use
the latest documents supplied by Davin. Never claim to have read files or run
checks that you did not access or execute. Keep durable rules in these files and
start sessions with the [opening prompt](OPENING-PROMPT-TO-ANTIGRAVITY.md).

Write durable documents and copyable agent prompts in English. Conversation
defaults to English; use Thai when Davin writes Thai in that session unless he
explicitly overrides the preference. Thai conversation alone does not change the
artifact language. See the [language policy](LANGUAGE-POLICY.md) for the full rule.

## Three development modes

| Mode                 | Prompts to prepare                                        | Evidence before the next stage                                          |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Build and review     | Builder → Reviewer → Fix/Recheck if defects are found     | Stable snapshot, acceptance criteria and review findings                |
| Parallel development | Work A + Work B in separate scopes/worktrees → Integrator | Agreed interfaces, outputs from each scope and checks after integration |
| Handoff and takeover | Sender closeout → Receiver acceptance/resume              | Sender has stopped writing, stable handoff and ownership transfer       |

Investigation and design prepare work in any of these modes. Choose Claude or
Codex as builder or reviewer for the task; do not assign permanent roles by model.

### Build and review

The builder supplies a stable snapshot before review begins. The reviewer reads
source and checks done criteria read-only, then reports defects with file/line
references and check results. The builder fixes findings within scope, and the
reviewer rechecks affected evidence. P6/session B requires a genuinely fresh
reviewer context.

### Parallel development

Assign disjoint paths, including tests and generated outputs. Claude and Codex
use separate worktrees/branches. Agree interfaces and dependencies before work
starts. Name one integrator and one shared-state writer. Assign build, generator
and mutation-runner ownership because separate worktrees do not isolate every
external resource. Specify how to transfer a patch, artifact or authorized commit.
Uncommitted files do not appear in another worktree automatically. A task record
is an advisory agreement, not a lock.

### Handoff and takeover

The sender stops writing the scope → publishes a stable snapshot and handoff →
the receiver checks source, authorization and open work → accepts ownership →
records the transfer → starts writing. The sender remains stopped. If the receiver
rejects the handoff, explicitly restore ownership before the sender resumes.
Silence or an unfinished checklist does not grant ownership.

## Required contract in every stage prompt

Use the [task template](../codex/templates/task.md) and
[handoff template](../codex/templates/handoff.md) to structure actual task details.

1. Task/order ID, goal, mode and current stage.
2. Evidence of the scope Davin has authorized; clearly label unapproved proposals.
3. Agents and roles, integrator, shared-state writer and shared-resource owners.
4. Absolute worktree path, branch, source revision and required handoff reading.
5. Allowed/excluded paths, interfaces and dependency/entry gates.
6. Done criteria, required checks and reporting of skipped/unavailable checks.
7. Required return artifacts, next owner and stop/transfer conditions.
8. Actual commit/push/deploy authorization, separate from development approval.

For Claude, begin with `CLAUDE.md` and the shared guide. For Codex, begin with
`AGENTS.md` and the shared guide. Both must preserve `seed-code/**` and others'
work. Changes involving money/auth/grants/secrets/CORS beyond the explicit scope,
and items requiring explicit sign-off, return to Davin under existing rules.
Existing restrictions on production migrations and credentials remain binding.

If worktree or revision details are unavailable, make them entry checks that the
executor must confirm and record before editing. Never invent a SHA or approval.

## Prompt and feedback cycle

Davin proposes policy/a plan → Advisor prepares recommendations and prompts →
Davin decides and forwards the prompt → executor works and writes a handoff →
Davin returns the handoff to the Advisor → Advisor drafts the next prompt from
new evidence.

Issue an actionable prompt for the current stage. Future prompts may be DRAFT
or conditional, but must state their gates and prohibit starting before those
gates pass. For example, review requires the actual snapshot, and integration
requires both scopes' outputs.

Before proceeding, check at least: changed paths, deviations, command/cwd/exit
code, pass/fail/skip results, unresolved findings, open work and next owner.
For uncommitted changes, use a scoped diff or file hashes; HEAD alone does not
identify reviewed content. Passing review does not authorize a production action
or turn an Advisor proposal into APPROVED work.

## Confirm understanding during onboarding

After reading the initial documents, the Advisor returns a brief summary of:

- Roles and decision authority, including the four optional participation setups.
- The three modes, with owners, integrators and handoff acceptance points.
- Key rules: scope, worktrees, sender freeze, evidence, approval and language.
- Files actually read and current information that remains unverified.

Then use this protocol to draft prompts for work assigned by Davin. The onboarding
instruction alone does not authorize editing the codebase.
