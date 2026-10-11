---
type: Concept/Task
status: completed
updated_at: 2026-10-11
task_id: 2026-10-11-english-agent-workflow
owner: Codex
integrator: Codex
reviewer: independent Codex read-only agent
shared_state_writer: handoff-only for canonical Claude project state
approval: Davin's direct request to make the created files and documents English
order_mode: ad-hoc; phase/session unchanged
base_commit: 96fbf410004aaee8abd7f69985b56cfbd100aa80
worktree: D:/SaaS Project/trading-alerts-saas-public
branch: main
---

# English agent workflow documentation

## Objective and scope

Translate the workflow documents created in this conversation into English.
Persist Davin's preference: agent-facing prompts and durable documents use
English by default; conversational replies use English normally and Thai in
sessions where Davin writes Thai, subject to an explicit language override.
A Thai chat does not itself change the language of durable agent artifacts.

Allowed writes: AGENTS.md; a minimal language-policy pointer in CLAUDE.md and
.claude/index.md; docs/agent-collaboration/**; docs/codex/**; the two historical
setup/onboarding handoffs plus this task's handoff; scripts/agents/check-operating-docs\*.
Do not translate the supplied source designs, unrelated repository docs, product
locales, code fixtures or other agents' state. Keep original paths and links.

Delegated ownership: one writer for README.md; one writer for ADVISOR-PROTOCOL.md
and OPENING-PROMPT-TO-ANTIGRAVITY.md; parent owns language policy/routing/records.
Reviewer is read-only. Existing unrelated working-tree work is preserved.

## Checklist

- [x] Inspect authored files, rules and language references.
- [x] Translate the three shared workflow/Advisor documents into English.
- [x] Add canonical language policy and route both executors to it.
- [x] Update templates, labels and history notes without inventing past evidence.
- [x] Verify formatting, local links, validator tests and language inventory.
- [x] Finish independent review, task record, handoff and continuity pointer.

## Decisions and deviations

- One shared [language policy](../../agent-collaboration/LANGUAGE-POLICY.md)
  serves all three agents and every participation setup. No parallel Thai edition
  is maintained by this task.
- All four participation setups remain valid. The Advisor is optional; the three
  development modes describe cooperation when both executors share work.
- Earlier handoff counts, revisions and SHA-256 values remain intact as historical
  evidence, explicitly labeled as pretranslation editions.
- The validator's UTF-8 test character uses a Unicode escape with the same runtime
  value; the 6003-byte boundary assertion is unchanged.

## Verification

| Check                                                         | Cwd             | Exit | Evidence                                                                             |
| ------------------------------------------------------------- | --------------- | ---- | ------------------------------------------------------------------------------------ |
| `node scripts/agents/check-operating-docs.mjs`                | Repository root | 0    | 16 operating documents; budgets, metadata, local links and routing pass              |
| `node --test scripts/agents/check-operating-docs.test.mjs`    | Repository root | 0    | 8 passed, 0 failed, 0 skipped                                                        |
| Local Prettier check on 22 scoped files                       | Repository root | 0    | All selected files formatted                                                         |
| Scoped language and byte inventory                            | Repository root | 0    | No literal Thai source characters; valid UTF-8 without BOM; LF                       |
| `git diff --check`                                            | Repository root | 0    | No whitespace errors                                                                 |
| Independent read-only translation/contract review and recheck | Source checkout | n/a  | No actionable findings; optional-Advisor wording and historical provenance rechecked |

The review covered both routers, the collaboration/Advisor/language documents,
Codex lifecycle/templates and historical provenance. Application checks were
not required because no application behavior changed. No external agent session
or automatic rule loading was tested.

## Continuation

Completed. [Handoff](../../handoffs/2026-10-11-english-agent-workflow.md) records
changed paths, the stable reviewed snapshot and verification limits. Davin may
forward the English opening prompt to Antigravity or assign either executor
directly. Codex owns its continuity pointer; Claude's canonical state remains
with its current owner. No commit, push, deploy or cross-agent ownership transfer
was performed by this task.
