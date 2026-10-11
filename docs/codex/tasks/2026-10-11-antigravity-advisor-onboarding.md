---
type: Concept/Task
status: completed
updated_at: 2026-10-11
task_id: 2026-10-11-antigravity-advisor-onboarding
owner: Codex
integrator: Codex
reviewer: Codex independent read-only agent
shared_state_writer: handoff-only for Claude project state
approval: Davin's follow-up requesting how Antigravity learns the shared workflow
order_mode: ad-hoc; phase/session unchanged
---

# Antigravity advisor onboarding

## Objective and scope

Explain the three development collaboration modes and equip Antigravity with a
reusable reading contract and opening prompt. Davin sets policy, proposes plans
and makes owner decisions. Antigravity advises and drafts prompts for Davin to
forward; Claude Code and Codex perform the assigned work.

Allowed writes: advisor documents under `docs/agent-collaboration/`, links in
its README and `docs/codex/index.md`, the collaboration mode clarification,
this task, its handoff, the Codex continuity pointer, and document-checker
required-document entries. Preserve previous setup artifacts and unrelated work.
No runtime, Git publication, external dispatch or numbered migration scope.

## Checklist

- [x] Inspect existing collaboration and governance documents.
- [x] Create Advisor protocol and copyable Antigravity opening prompt.
- [x] Connect the reading path and clarify three development modes.
- [x] Run document checks and independent review; fix actionable findings.
- [x] Publish evidence and Codex continuity pointer; explain usage to Davin.

## Continuation

Complete: Advisor documents, reading links and checker manifest updated.
Checks: 14 documents pass; 8/8 validator tests; scoped formatting/whitespace
checks pass; independent review reports no actionable findings.
Evidence: [handoff](../../handoffs/2026-10-11-antigravity-advisor-onboarding.md).
Next: Davin forwards the opening prompt to Antigravity; no Codex work remains.
