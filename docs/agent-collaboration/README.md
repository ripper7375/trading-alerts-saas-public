# Codex and Claude Code collaboration system

This system was established by Davin's instruction on 11 October 2026 after
reading the [OKF architecture](../../davintrade-claude-md-okf-management/OKF_CLAUDE_MD_ARCHITECTURE_DESIGN.md)
and [frontier-model adaptation](../../davintrade-claude-md-okf-management/OKF_OPUS_5_5_FINE_TUNING_ARCHITECTURE.md)
documents and comparing them with the repository's live files.

The principle is **one shared knowledge base, clear ownership, and evidence
stored on disk for handoff**. Codex has its own router,
[AGENTS.md](../../AGENTS.md), and shares rules, architecture, project state and
history with Claude Code.

For the complete English architecture, operating manual and copyable prompts,
see the [Codex documentation package](../../davintrade-claude-md-okf-management/codex/README.md).
The package explains this system; the operational rules remain in their current locations.

## Participation setups and Antigravity's Advisor role

Davin can use any of these four participation setups and switch between them
as the work requires:

| Setup                     | How work is assigned                                                     |
| ------------------------- | ------------------------------------------------------------------------ |
| Antigravity + Claude Code | Antigravity advises and drafts prompts; Davin sends them to Claude Code. |
| Antigravity + Codex       | Antigravity advises and drafts prompts; Davin sends them to Codex.       |
| Claude Code directly      | Davin assigns work and makes decisions directly with Claude Code.        |
| Codex directly            | Davin assigns work and makes decisions directly with Codex.              |

Antigravity is an optional Advisor. Davin sets policy, proposes plans and makes
decisions. When engaged, Antigravity analyzes the work, drafts prompts for Davin
to send, and uses returned handoffs to plan the next stage.

These four participation setups are independent of the **three cross-agent
development modes**: implementation plus review, parallel implementation, and
takeover of unfinished work. Those modes apply when Davin chooses to involve
both Claude Code and Codex in the same work. A task can also be assigned to just
one coding agent.

Start an Advisor session with the
[opening prompt for Antigravity](OPENING-PROMPT-TO-ANTIGRAVITY.md), and use the
[Advisor protocol](ADVISOR-PROTOCOL.md) as the standing prompt-writing rules.
At the start of a new session, load the protocol and latest relevant task and
handoff; do not rely on memory from another chat.

## Language

Agent-facing durable documents, prompts, task records and handoffs use English
by default. Conversational replies normally use English; in sessions where
Davin writes in Thai, replies use Thai unless Davin explicitly requests another
language. Thai conversation alone does not change the language of durable
artifacts or the product's internationalization requirements. Follow the shared
[language policy](LANGUAGE-POLICY.md) for the full rules and explicit overrides.

## Findings from the source documents

| Approach in the source documents                | Current repository evidence                                | Codex adaptation                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Lean router and domain-based reading            | `CLAUDE.md` and `.claude/` already exist.                  | Add `AGENTS.md` linking to the existing knowledge.                               |
| Stable rules and settled answers                | The non-negotiables contain eight rules.                   | Read the rules explicitly; reopen settled matters when new evidence warrants it. |
| Checklists stored on disk                       | Claude uses a temporary file per checkout.                 | Codex uses one file per task to avoid overwriting Claude's checklist.            |
| Reports lead with decisions the owner must make | The lifecycle uses an action-first report.                 | Use a consistent template for evidence and remaining work.                       |
| Multiple agents                                 | A Claude protocol already exists.                          | Add ownership, worktree and independent review contracts.                        |
| Bounded context                                 | Shared state has two entries, but their text remains long. | Keep Codex state as a compact pointer with a byte budget.                        |

The two documents are blueprints containing older examples and claims about
models. This system follows live source and current policy. It does not treat
sample SQL or speed/success figures as verified guarantees, and it does not
fine-tune model weights.

## Active structure

```text
AGENTS.md                         Codex entry point
CLAUDE.md                         Claude entry point + collaboration link
.claude/                          Shared domain knowledge and project state
  rules/                          Standing policies
  architecture/                   Domain facts and recurring traps
  state/                          Canonical project continuity
  protocols/                      Existing Claude workflow

docs/codex/                       Codex host adaptation
  index.md                        Read-on-demand catalog
  protocols/session-lifecycle.md  Open, track, resume, verify, close
  protocols/collaboration.md      Ownership, review and integration
  protocols/verification.md       Checks and known coverage gaps
  state/current-state.md          Compact pointer to Codex's latest task
  templates/                      Task and handoff formats
  tasks/                          One durable checklist per task

docs/handoffs/                    Durable results visible to either agent
scripts/agents/                   Read-only document validator + unit tests
```

`docs/codex/` contains guidance and task records. It is not Codex app
configuration. The setup creates no skill and changes no personal settings.
Write access to this workspace's `.codex` directory is restricted, so the
guidance lives in ordinary documentation directories.

OpenAI documents directory-based discovery of `AGENTS.md` and support for
`AGENTS.override.md`. This system therefore uses Codex's repository router with
links to the guidance needed for the task.
[Official AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

Claude Code loads its own rules, but Codex must explicitly read
`.claude/rules/`. Markdown links provide paths to read; they do not
automatically load every linked document. Existing skills under
`.agents/skills/` are used when appropriate to the task, following the discovery
and progressive disclosure described in the
[official skills documentation](https://learn.chatgpt.com/docs/build-skills).

## Sources of truth and decision authority

1. Davin defines goals and scope, and approves owner gates under the applicable
   rules.
2. Numbered migrations require an APPROVED order and verification of entry
   criteria before CONFIRMED. Ad-hoc work uses Davin's direct instruction with
   the scope recorded; do not request duplicate approval.
3. Shared rules live in the
   [non-negotiables](../../.claude/rules/non-negotiables.md). Stack D follows the
   [canonical architecture](../STACK-D-ARCHITECTURE.md) and
   [ADRs](../adr/README.md). Archives provide history, not current policy.
4. When a plan conflicts with code, runtime state or tests, record the evidence
   and correct the plan's assumptions. Do not change live code to fit older
   information that has been disproved.
5. Commit or push only when Davin asks. Production migrations and steps
   requiring login credentials remain subject to the existing rules. Passing
   review does not authorize deployment.

Codex serves as implementer, investigator or reviewer for its assigned task.
Claude Code retains its existing role, and Antigravity serves as Advisor and
Architect when engaged. No model permanently owns the frontend or backend.

## Recommended development modes

**Implementation plus independent review:** The implementer has an explicit
writable scope. The reviewer reads source, runs appropriate checks and writes
findings to a file. The implementer fixes findings, and the reviewer rechecks
the affected scope. If the workflow requires fresh P6/session B review, use a
new reviewer context; a subagent that helped build the work cannot replace that
sign-off.

**Parallel implementation:** Use separate worktrees and path ownership. Agree
on interfaces before splitting the work. Name one integrator for shared
contracts, generated outputs and project state. Another worktree does not
automatically see uncommitted files; transfer a patch, an authorized commit, or
an accessible artifact identified by its absolute path.

**Takeover of unfinished work:** The sender first stops writing the scope,
then provides the task ID, stable snapshot, paths, checklist, authorization,
check results and next action. The receiver verifies these and acknowledges
ownership. Record the transfer before the receiver begins writing. The sender
remains stopped after transfer. If the handoff is rejected, explicitly restore
ownership before writing resumes. An unfinished checklist alone does not
authorize takeover.

Ownership records are agreements agents must follow; **there is no enforced
locking system**. If another agent has work in a file, separate the scopes or
obtain a handoff before editing. Do not use `git stash`, restore or clean to
remove another agent's work. Do not run mutation tests in a checkout another
agent is editing.

The root build has a prebuild step that clears `.next` and regenerates Prisma
clients. Coordinate with the owners of dev servers, builds and generators
before running it. A report of passing checks must also identify skipped
tests. See the [verification adapter](../codex/protocols/verification.md) for
commands and coverage limitations.

## Getting started

Start work from this repository so the host can discover `AGENTS.md`, then
assign the task normally. If an existing session does not include the newly
added instructions, start a new session or explicitly ask it to read the
appropriate router. The setup has not yet been tested end to end by starting
new Claude/Codex sessions. Installation checks covered files, links and the
validator only.

Example: Claude implements, Codex reviews.

```text
Claude: Read CLAUDE.md and docs/agent-collaboration/README.md, then implement
<assigned task> within <paths/order>. You are the implementer and shared-state
writer. Publish a handoff with the revision, changed files, done criteria and
check results.

Codex: Read AGENTS.md, then review handoff <absolute path> against live source.
Act as an independent read-only reviewer. Report defects with file/line and
evidence. Write a new report under docs/handoffs/. If source changes, identify
which evidence requires rechecking.
```

Example: Codex implements, Claude reviews.

```text
Codex: Read AGENTS.md, then implement <assigned task> within <paths/order>.
You are the implementer and integrator. Create a durable task checklist and
handoff. Coordinate ownership before editing shared state, and complete the
checks required for the scope.

Claude: Read CLAUDE.md and docs/agent-collaboration/README.md. Review handoff
<absolute path> against live source in a fresh reviewer context. Verify the
acceptance criteria and report findings without editing the implementer's
implementation files.
```

Replace `<...>` placeholders with the actual task and paths. These examples do
not dispatch prompts to another agent automatically. Davin starts the work or
authorizes dispatch under the active host's rules.

## Validate the system and inspect installation results

From the repository root:

```powershell
node scripts/agents/check-operating-docs.mjs
node --test scripts/agents/check-operating-docs.test.mjs
```

The validator is read-only. It checks router/state size, frontmatter and
internal links. Run it as a manual gate when changing this system. The setup
adds no hook, CI job, daemon or automatic deployment. Installation results and
limitations are recorded in the
[handoff](../handoffs/2026-10-11-codex-collaboration-system.md).
