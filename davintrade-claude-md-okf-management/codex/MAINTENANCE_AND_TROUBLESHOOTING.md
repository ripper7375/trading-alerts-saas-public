---
type: Concept/Guide
status: active
updated_at: 2026-10-11
version: '1.0'
---

# Maintenance and troubleshooting

Use this guide to maintain the design/user-guide package and recover from
coordination problems. The current [operating catalog](../../docs/codex/index.md),
[shared collaboration contract](../../docs/codex/protocols/collaboration.md) and
[standing rules](../../.claude/rules/non-negotiables.md) remain authoritative.

## Keep one current operating contract

The package explains current rules and supplies examples. Operational sources
remain `AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/codex/` and
`docs/agent-collaboration/`. Keep task history in unique task/handoff files.

When an authorized rule changes:

1. Identify the canonical file and its writing owner. Establish a scoped task;
   a documentation discrepancy does not authorize unrelated code/state edits.
2. Update that rule within authorized scope and adjust affected guides/examples.
   Compare both the package opening prompt and the operational
   [opening prompt](../../docs/agent-collaboration/OPENING-PROMPT-TO-ANTIGRAVITY.md)
   so they continue to route to the same current Advisor/language contracts.
3. Repair links, update relevant `updated_at` metadata and preserve historical
   review hashes/counts with explicit provenance rather than rewriting past results.
4. Run scoped validation and independent consistency review when contracts change.
5. Publish a unique handoff with source evidence and update only the state pointer
   you own. Verify an actual new session before claiming new loading behavior.

Do not move active operational files into this package just to organize them.
Any requested relocation needs link/router updates and a reviewable migration.
No workspace configuration, hook, CI integration or daemon is installed here.

## Validate documents from the repository root

All following paths are relative to `D:\SaaS Project\trading-alerts-saas-public`.
Use installed local tools. These checks do not require client generation or the
application build.

```powershell
node scripts/agents/check-operating-docs.mjs
node node_modules/prettier/bin/prettier.cjs --check davintrade-claude-md-okf-management/codex/*.md
git diff --check
```

The document validator's explicit manifest includes the seven package files.
It checks file presence, local-link destinations and selected router/state
budgets. Its frontmatter gate applies to `docs/codex/` files; package metadata
and English text also need a scoped review. Links inside example code blocks
and heading anchors are outside its local-file checks.

If the validator source or manifest changes, also run:

```powershell
node --test scripts/agents/check-operating-docs.test.mjs
```

Fix reported defects within your assigned paths. Apply Prettier only to the
specific files you own, respecting `.prettierignore`; do not format the whole
repository to satisfy a narrow documentation task. Record command/cwd/exit and
pass/fail/skip results, including unavailable tools. For application changes,
select relevant checks from the [verification adapter](../../docs/codex/protocols/verification.md)
and current package scripts; document validation does not replace them.

## Troubleshooting matrix

| Symptom                                                          | Check                                                                 | Action                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Antigravity claims it read files but only received paths         | Session filesystem access and its actual-read report                  | Supply current contents or open the correct workspace; identify missing source/runtime evidence                 |
| Codex does not apply the expected rules                          | Correct repository/worktree, active instruction sources and overrides | Explicitly read the router and required files in this session; verify a new session before relying on discovery |
| A new chat remembers an older policy                             | Current file versions, latest task/handoff and explicit user steering | Reload the current contracts and reconcile with live source                                                     |
| The two executors edit the same file                             | Task scope, active checklist and named owners                         | Stop overlapping writes; separate scopes or perform a recorded handoff                                          |
| The receiver starts while the sender still edits                 | Sender freeze and snapshot evidence                                   | Stop the receiving writes; establish a stable snapshot and record acceptance/transfer before resuming           |
| A worktree lacks another agent's work or new documents           | Actual checkout path, revision and uncommitted artifact location      | Transfer an explicit patch/artifact or an authorized commit; verify arrival before dependent work               |
| Review evidence points to an old SHA/hash                        | Changed paths, current diff and recorded snapshot                     | Recheck the affected evidence; preserve prior findings as historical records                                    |
| Shared Prisma/generated files or dev server break during a build | Build/generator/resource owner and package prebuild                   | Coordinate access and rerun the relevant verification after restoring owned outputs                             |
| A numbered order is APPROVED but runtime is unavailable          | Mandatory entry checks and current order                              | Leave CONFIRMED pending; record missing evidence and owner; continue independent authorized work                |
| A direct instruction gets stuck waiting for another approval     | Exact authorized ad-hoc scope and separate sign-off requirements      | Record existing permission; continue that scope without duplicate approval                                      |
| A prompt has an authorization placeholder                        | Actual user instruction or approved order                             | Keep it a template/DRAFT until populated; never treat the placeholder as permission                             |
| A reviewer makes implementation fixes                            | Read-only scope and current implementation owner                      | Return fixes to the owner unless Davin assigns a new writing scope                                              |
| Tests are reported green but some suites skipped                 | Exit code, collection rules, environment and skip counts              | Record the coverage gap and run required affected gates when prerequisites exist                                |
| Root type-check passes after a test edit                         | Test exclusions and actual runner/tsconfig                            | Obtain appropriate test type coverage; root tsc alone excludes many test files                                  |
| Task/state files are large or duplicate project history          | Router budgets and canonical state ownership                          | Keep a compact pointer and per-task reports; do not prune another agent's state                                 |
| Documentation output switches to Thai during Thai chat           | Language policy and explicit artifact request                         | Keep durable artifacts/prompts English by default; conversational Thai stays session-specific                   |
| A path is protected or a tool is unavailable                     | Actual host access/approval policy                                    | Report the precise limit and complete authorized independent work; do not bypass access checks                  |

Ownership records are advisory. They work only when agents read and follow them;
there is no filesystem lock or global cross-worktree registry in this setup.

## Instruction discovery and worktree boundaries

Codex documents instruction discovery from global/project guidance toward the
current directory, including overrides. Ordinary design documents are not
instruction files merely because they mention Codex. Keep the root router
small and explicitly route to relevant knowledge. For precise current behavior,
consult [official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
This package does not change Codex configuration or test every host's loading path.

Worktree setup and desktop handoff features can transfer state in specific ways.
Inspect the actual resulting files and revision rather than assuming a shared
checkout. App worktree transfer is distinct from the Claude/Codex ownership
handoff defined here. See [official worktree documentation](https://learn.chatgpt.com/docs/environments/git-worktrees).

A Git revision does not include all local uncommitted artifacts. Put an accessible
absolute artifact path and a stable diff/hash in the handoff, and specify how the
receiver obtains the content. Avoid moving credentials or copying environment
files just to transfer a documentation task.

## Recovery report

When something prevents completion, record:

```text
Task and current owner:
Observed failure and exact evidence:
Current worktree/branch/revision and relevant file hashes:
Allowed work completed:
Failed/skipped/unavailable checks:
Missing decision/access/dependency:
Next owner and precise action:
Sender freeze / ownership transfer status, when relevant:
```

Use a unique [handoff](../../docs/codex/templates/handoff.md). Do not claim
completion while required scope/review gates remain open. Do not claim deploy
or production health from documentation, source review or fixture tests.

## Periodic maintenance without automatic scheduling

Review these documents when a workflow or host capability changes, a rule
conflict appears or a new task exposes a gap. Compare actual router sizes and
link destinations rather than copying historical counts. Keep source references
and prompt examples aligned with canonical rules. This is a maintenance
procedure; no recurring automation was scheduled by creating this guide.
